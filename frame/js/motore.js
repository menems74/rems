/* =========================================================================
   motore.js — decodifica frame per frame con WebCodecs.

   Perché serve una cache: per mostrare il frame N bisogna ripartire
   dall'ultimo keyframe e decodificare tutto il gruppo (GOP). Si decodifica
   quindi un GOP intero e si tengono in memoria i frame come ImageBitmap,
   così avanti/indietro dentro il gruppo sono immediati. Il budget di
   memoria è limitato: oltre si scartano i frame usati meno di recente.
   ========================================================================= */

import { leggiIndice } from './mp4.js';

export class MotorePreciso {
  static async apri(file) {
    if (typeof VideoDecoder === 'undefined') throw new Error('WebCodecs non disponibile');
    const t = await leggiIndice(file);
    const config = { codec: t.codec, codedWidth: t.width, codedHeight: t.height, optimizeForLatency: true };
    if (t.description) config.description = t.description;
    const sup = await VideoDecoder.isConfigSupported(config);
    if (!sup.supported) throw new Error(`Codec ${t.codec} non supportato da questo dispositivo`);
    return new MotorePreciso(file, t, config);
  }

  constructor(file, traccia, config) {
    this.file = file;
    this.t = traccia;
    this.config = config;
    this.preciso = true;
    this.totale = traccia.display.length;

    const s = traccia.samples;
    // posizione di presentazione di ogni campione e GOP (in ordine di decodifica)
    this.posDi = new Array(s.length);
    traccia.display.forEach((k, d) => { this.posDi[k] = d; });
    this.gopDi = new Array(s.length);
    this.gop = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i].sync || i === 0) this.gop.push({ da: i, a: i + 1 });
      else this.gop[this.gop.length - 1].a = i + 1;
      this.gopDi[i] = this.gop.length - 1;
    }

    // timestamp WebCodecs (µs) -> posizione di presentazione
    this.tsPos = new Map();
    s.forEach((x, i) => this.tsPos.set(this.ts(i), this.posDi[i]));

    const mem = (navigator.deviceMemory || 4) * 48 * 1024 * 1024;
    this.budget = Math.max(192, Math.min(768, mem / 1048576)) * 1048576;
    this.cache = new Map(); // pos -> { bmp, byte, uso }
    this.byte = 0;
    this.orologio = 0;

    this.richiesta = null;   // ultima posizione chiesta
    this.inCorso = false;
    this.attesa = new Map(); // pos -> [resolve]
    this.decoder = null;
  }

  ts(i) { return Math.round((this.t.samples[i].cts - this.t.base) * 1e6 / this.t.timescale); }

  /* Tempo di presentazione (secondi) del frame in posizione pos. */
  tempo(pos) { return (this.t.samples[this.t.display[pos]].cts - this.t.base) / this.t.timescale; }

  keyframe(pos) { return this.t.samples[this.t.display[pos]].sync; }

  info() {
    const fps = this.totale > 1 ? (this.totale - 1) / Math.max(this.tempo(this.totale - 1), 1e-6) : 0;
    return {
      codec: this.t.codec, larghezza: this.t.width, altezza: this.t.height,
      rotazione: this.t.rotazione, fpsMedi: fps, keyframe: this.gop.length
    };
  }

  inCache(pos) {
    const c = this.cache.get(pos);
    if (c) c.uso = ++this.orologio;
    return c ? c.bmp : null;
  }

  /* Chiede un frame. Si risolve con l'ImageBitmap, oppure con null se nel
     frattempo è arrivata una richiesta più nuova (scorrimento veloce). */
  frame(pos, { soloKeyframe = false } = {}) {
    pos = Math.max(0, Math.min(this.totale - 1, pos));
    const c = this.inCache(pos);
    if (c) return Promise.resolve(c);
    if (soloKeyframe) pos = this.posDi[this.gop[this.gopDi[this.t.display[pos]]].da];
    const c2 = this.inCache(pos);
    if (c2) return Promise.resolve(c2);
    this.richiesta = { pos, soloKeyframe };
    // le richieste superate si risolvono a null
    for (const [p, lista] of this.attesa) if (p !== pos) { lista.forEach((r) => r(null)); this.attesa.delete(p); }
    return new Promise((res) => {
      if (!this.attesa.has(pos)) this.attesa.set(pos, []);
      this.attesa.get(pos).push(res);
      this.ciclo();
    });
  }

  async ciclo() {
    if (this.inCorso) return;
    this.inCorso = true;
    try {
      while (this.richiesta) {
        const r = this.richiesta; this.richiesta = null;
        if (this.cache.has(r.pos)) { this.consegna(r.pos); continue; }
        const k = this.t.display[r.pos];
        let g = this.gopDi[k];
        await this.decodifica(g, r.soloKeyframe ? 1 : Infinity, r.pos);
        // GOP aperto: il frame dipende dal gruppo precedente, si riparte da lì
        if (!this.cache.has(r.pos) && !r.soloKeyframe && g > 0 && !this.richiesta) {
          await this.decodifica(g - 1, Infinity, r.pos, true);
        }
        this.consegna(r.pos);
      }
    } finally { this.inCorso = false; }
  }

  consegna(pos) {
    const lista = this.attesa.get(pos);
    if (!lista) return;
    this.attesa.delete(pos);
    const c = this.inCache(pos);
    lista.forEach((r) => r(c || null));
  }

  nuovoDecoder() {
    if (this.decoder && this.decoder.state !== 'closed') return this.decoder;
    this.decoder = new VideoDecoder({
      output: (f) => this.uscita(f),
      error: (e) => { console.warn('Decoder:', e); }
    });
    this.decoder.configure(this.config);
    return this.decoder;
  }

  uscita(frame) {
    const pos = this.tsPos.get(frame.timestamp);
    if (pos === undefined || this.cache.has(pos) || !this.tieni(pos)) { frame.close(); return; }
    // si converte subito e si chiude: il decoder ha pochi buffer
    const p = createImageBitmap(frame).then((bmp) => {
      frame.close();
      this.metti(pos, bmp);
    }, () => frame.close());
    this.conversioni.push(p);
  }

  /* Quali frame tenere del GOP in decodifica: i più vicini al bersaglio,
     entro metà del budget (l'altra metà resta per il resto della cache). */
  tieni(pos) { return Math.abs(pos - this.bersaglio) <= this.raggio; }

  async decodifica(g, massimo, bersaglio, ancheSuccessivo = false) {
    const s = this.t.samples;
    const da = this.gop[g].da;
    const a = Math.min(ancheSuccessivo && g + 1 < this.gop.length ? this.gop[g + 1].a : this.gop[g].a, da + massimo);

    const byteFrame = this.t.width * this.t.height * 4;
    this.bersaglio = bersaglio;
    this.raggio = Math.max(1, Math.floor(this.budget / 2 / byteFrame / 2));
    this.conversioni = [];

    // un'unica lettura dal file per tutto il GOP
    let min = Infinity, max = 0;
    for (let i = da; i < a; i++) { min = Math.min(min, s[i].offset); max = Math.max(max, s[i].offset + s[i].size); }
    const dati = new Uint8Array(await this.file.slice(min, max).arrayBuffer());

    const dec = this.nuovoDecoder();
    try {
      for (let i = da; i < a; i++) {
        dec.decode(new EncodedVideoChunk({
          type: i === da ? 'key' : (s[i].sync ? 'key' : 'delta'),
          timestamp: this.ts(i),
          data: dati.subarray(s[i].offset - min, s[i].offset - min + s[i].size)
        }));
        // non far crescere troppo la coda del decoder
        if (dec.decodeQueueSize > 8) await new Promise((r) => dec.addEventListener('dequeue', r, { once: true }));
      }
      await dec.flush();
    } catch (e) {
      console.warn('Decodifica interrotta:', e);
      try { dec.close(); } catch (_) { /* già chiuso */ }
      this.decoder = null;
    }
    await Promise.all(this.conversioni);
  }

  metti(pos, bmp) {
    const byte = bmp.width * bmp.height * 4;
    this.cache.set(pos, { bmp, byte, uso: ++this.orologio });
    this.byte += byte;
    while (this.byte > this.budget && this.cache.size > 1) {
      let vecchio = null, chiave;
      for (const [k, v] of this.cache) if (k !== pos && (!vecchio || v.uso < vecchio.uso)) { vecchio = v; chiave = k; }
      if (!vecchio) break;
      vecchio.bmp.close();
      this.cache.delete(chiave);
      this.byte -= vecchio.byte;
    }
  }

  chiudi() {
    for (const v of this.cache.values()) v.bmp.close();
    this.cache.clear();
    if (this.decoder && this.decoder.state !== 'closed') this.decoder.close();
  }
}

/* =========================================================================
   Modalità approssimata: per i file che WebCodecs non sa leggere (WebM,
   MP4 frammentati, codec non supportati). Usa il player del browser e
   avanza di un passo di tempo: il frame mostrato è quello reale a
   quell'istante, ma il numero di frame è stimato.
   ========================================================================= */
export class MotoreVideo {
  static async apri(file) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.src = URL.createObjectURL(file);
    await new Promise((ok, ko) => {
      v.onloadeddata = ok;
      v.onerror = () => ko(new Error('Formato video non leggibile su questo dispositivo'));
    });
    return new MotoreVideo(v);
  }

  constructor(v) {
    this.v = v;
    this.preciso = false;
    this.passo = 1 / 30;
    this.totale = Math.max(1, Math.round(v.duration / this.passo));
    this.ultimo = null;
  }

  tempo(pos) { return pos * this.passo; }
  keyframe() { return false; }
  info() {
    return { codec: 'lettore del browser', larghezza: this.v.videoWidth, altezza: this.v.videoHeight,
      rotazione: 0, fpsMedi: 1 / this.passo, keyframe: null };
  }
  inCache(pos) { return this.ultimo && this.ultimo.pos === pos ? this.ultimo.bmp : null; }

  async frame(pos) {
    pos = Math.max(0, Math.min(this.totale - 1, pos));
    if (this.ultimo && this.ultimo.pos === pos) return this.ultimo.bmp;
    this.richiesta = pos;
    if (this.occupato) return null;
    this.occupato = true;
    try {
      let bmp = null;
      while (this.richiesta !== null) {
        const p = this.richiesta; this.richiesta = null;
        this.v.currentTime = Math.min(this.v.duration - 0.001, p * this.passo + this.passo / 2);
        await new Promise((r) => this.v.addEventListener('seeked', r, { once: true }));
        if (this.v.requestVideoFrameCallback) {
          await new Promise((r) => { this.v.requestVideoFrameCallback(() => r()); setTimeout(r, 250); });
        }
        if (this.ultimo) this.ultimo.bmp.close();
        bmp = await createImageBitmap(this.v);
        this.ultimo = { pos: p, bmp };
      }
      return bmp;
    } finally { this.occupato = false; }
  }

  chiudi() {
    if (this.ultimo) this.ultimo.bmp.close();
    URL.revokeObjectURL(this.v.src);
    this.v.removeAttribute('src'); this.v.load();
  }
}
