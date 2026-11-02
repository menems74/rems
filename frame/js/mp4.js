/* =========================================================================
   mp4.js — lettura dell'indice di un file MP4/MOV, senza librerie esterne.

   Si legge SOLO il box 'moov' (l'indice, pochi KB/MB). I dati dei frame
   restano nel file e si leggono a pezzi quando servono (File.slice), così
   anche un video da 1 GB non occupa memoria.

   Restituisce la traccia video con:
   - codec (stringa WebCodecs), description (avcC/hvcC), dimensioni, rotazione
   - samples[] in ordine di DECODIFICA: { offset, size, dts, cts, sync }
   - display[] = indici dei samples in ordine di PRESENTAZIONE (il "frame n")
   ========================================================================= */

const CONTENITORI = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts']);

/* Legge i box di primo livello direttamente dal File, cercando 'moov'. */
export async function leggiIndice(file) {
  let pos = 0, moov = null, frammentato = false;
  while (pos + 8 <= file.size) {
    const h = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
    let size = h.getUint32(0);
    const tipo = fourcc(h, 4);
    let header = 8;
    if (size === 1) { size = Number(h.getBigUint64(8)); header = 16; }
    else if (size === 0) size = file.size - pos;
    if (size < header) throw new Error('File MP4 non valido');
    if (tipo === 'moov') moov = new DataView(await file.slice(pos + header, pos + size).arrayBuffer());
    if (tipo === 'moof') frammentato = true;
    pos += size;
  }
  if (!moov) throw new Error('il file non è un MP4/MOV');

  const tracce = [];
  for (const b of figli(moov, 0, moov.byteLength)) {
    if (b.tipo === 'trak') {
      const t = leggiTraccia(moov, b);
      if (t) tracce.push(t);
    }
  }
  const v = tracce.find((t) => t.video);
  if (!v) throw new Error('Nessuna traccia video nel file');
  if (!v.samples.length) throw new Error(frammentato
    ? 'MP4 frammentato: non supportato in modalità precisa'
    : 'La traccia video è vuota');
  return v;
}

function fourcc(dv, o) {
  return String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
}

/* Itera i box figli contenuti tra start e end. */
function* figli(dv, start, end) {
  let p = start;
  while (p + 8 <= end) {
    let size = dv.getUint32(p);
    const tipo = fourcc(dv, p + 4);
    let header = 8;
    if (size === 1) { size = Number(dv.getBigUint64(p + 8)); header = 16; }
    else if (size === 0) size = end - p;
    if (size < header || p + size > end) return;
    yield { tipo, start: p + header, end: p + size };
    p += size;
  }
}

/* Cerca ricorsivamente il primo box con quel percorso, es. 'mdia/minf/stbl'. */
function trova(dv, box, percorso) {
  let cur = box;
  for (const nome of percorso.split('/')) {
    let next = null;
    for (const b of figli(dv, cur.start, cur.end)) if (b.tipo === nome) { next = b; break; }
    if (!next) return null;
    cur = next;
  }
  return cur;
}

function leggiTraccia(dv, trak) {
  const hdlr = trova(dv, trak, 'mdia/hdlr');
  if (!hdlr || fourcc(dv, hdlr.start + 8) !== 'vide') return null;

  const mdhd = trova(dv, trak, 'mdia/mdhd');
  const ver = dv.getUint8(mdhd.start);
  const timescale = dv.getUint32(mdhd.start + (ver === 1 ? 20 : 12));

  const stbl = trova(dv, trak, 'mdia/minf/stbl');
  const stsd = trova(dv, stbl, 'stsd');
  const entry = leggiStsd(dv, stsd);

  const samples = leggiCampioni(dv, stbl);
  const tkhd = trova(dv, trak, 'tkhd');

  // ordine di presentazione: ordina per cts
  const display = samples.map((_, i) => i).sort((a, b) => samples[a].cts - samples[b].cts || a - b);
  const base = samples.length ? samples[display[0]].cts : 0;

  return {
    video: true,
    timescale,
    ...entry,
    rotazione: tkhd ? rotazione(dv, tkhd) : 0,
    samples,
    display,
    base // cts del primo frame: il tempo mostrato parte da 0
  };
}

/* La matrice di tkhd dice come ruotare il video (telefoni in verticale). */
function rotazione(dv, tkhd) {
  const ver = dv.getUint8(tkhd.start);
  const m = tkhd.start + (ver === 1 ? 52 : 40);
  const a = dv.getInt32(m) / 65536, b = dv.getInt32(m + 4) / 65536;
  const ang = Math.round(Math.atan2(b, a) * 180 / Math.PI);
  return ((ang % 360) + 360) % 360;
}

function leggiStsd(dv, stsd) {
  // full box (4) + entry_count (4), poi la prima sample entry
  const it = figli(dv, stsd.start + 8, stsd.end).next();
  if (it.done) throw new Error('Descrizione del codec mancante');
  const e = it.value;
  const tipo = e.tipo;
  const width = dv.getUint16(e.start + 24), height = dv.getUint16(e.start + 26);
  let codec = null, description;
  for (const c of figli(dv, e.start + 78, e.end)) {
    const payload = new Uint8Array(dv.buffer, dv.byteOffset + c.start, c.end - c.start).slice();
    if (c.tipo === 'avcC') {
      codec = `${tipo === 'avc3' ? 'avc3' : 'avc1'}.${hex(payload[1])}${hex(payload[2])}${hex(payload[3])}`;
      description = payload;
    } else if (c.tipo === 'hvcC') {
      codec = codecHevc(tipo === 'hev1' ? 'hev1' : 'hvc1', payload);
      description = payload;
    } else if (c.tipo === 'vpcC') {
      // full box: version/flags (4), profile, level, bitDepth(4 bit alti)
      codec = `vp09.${pad(payload[4])}.${pad(payload[5])}.${pad(payload[6] >> 4)}`;
    } else if (c.tipo === 'av1C') {
      const profilo = payload[1] >> 5, livello = payload[1] & 31;
      const tier = payload[2] >> 7 ? 'H' : 'M';
      const alto = (payload[2] >> 6) & 1, dodici = (payload[2] >> 5) & 1;
      codec = `av01.${profilo}.${pad(livello)}${tier}.${alto ? (dodici ? '12' : '10') : '08'}`;
    }
  }
  if (!codec) throw new Error(`Codec "${tipo}" non supportato in modalità precisa`);
  return { codec, description, width, height, sampleEntry: tipo };
}

function codecHevc(prefisso, p) {
  const spazio = p[1] >> 6, tier = (p[1] >> 5) & 1, profilo = p[1] & 31;
  let compat = ((p[2] << 24) | (p[3] << 16) | (p[4] << 8) | p[5]) >>> 0;
  let inv = 0;
  for (let i = 0; i < 32; i++) { inv = (inv << 1) | (compat & 1); compat >>>= 1; }
  const vincoli = Array.from(p.slice(6, 12));
  while (vincoli.length && vincoli[vincoli.length - 1] === 0) vincoli.pop();
  let s = `${prefisso}.${spazio ? String.fromCharCode(64 + spazio) : ''}${profilo}.${(inv >>> 0).toString(16)}.${tier ? 'H' : 'L'}${p[12]}`;
  for (const v of vincoli) s += '.' + v.toString(16).toUpperCase();
  return s;
}

function leggiCampioni(dv, stbl) {
  const box = {};
  for (const b of figli(dv, stbl.start, stbl.end)) box[b.tipo] = b;

  // dimensioni
  const stsz = box.stsz;
  const fisso = dv.getUint32(stsz.start + 4), n = dv.getUint32(stsz.start + 8);
  const size = new Array(n);
  for (let i = 0; i < n; i++) size[i] = fisso || dv.getUint32(stsz.start + 12 + i * 4);

  // offset dei chunk
  const chunk = [];
  if (box.stco) {
    const c = dv.getUint32(box.stco.start + 4);
    for (let i = 0; i < c; i++) chunk.push(dv.getUint32(box.stco.start + 8 + i * 4));
  } else if (box.co64) {
    const c = dv.getUint32(box.co64.start + 4);
    for (let i = 0; i < c; i++) chunk.push(Number(dv.getBigUint64(box.co64.start + 8 + i * 8)));
  }

  // campioni per chunk (stsc) -> offset di ogni campione
  const stsc = [];
  const nsc = dv.getUint32(box.stsc.start + 4);
  for (let i = 0; i < nsc; i++) {
    const o = box.stsc.start + 8 + i * 12;
    stsc.push({ primo: dv.getUint32(o), quanti: dv.getUint32(o + 4) });
  }
  const offset = new Array(n);
  let s = 0;
  for (let e = 0; e < stsc.length && s < n; e++) {
    const fine = e + 1 < stsc.length ? stsc[e + 1].primo - 1 : chunk.length;
    for (let c = stsc[e].primo - 1; c < fine && s < n; c++) {
      let p = chunk[c];
      for (let k = 0; k < stsc[e].quanti && s < n; k++) { offset[s] = p; p += size[s]; s++; }
    }
  }

  // tempi di decodifica (stts)
  const dts = new Array(n);
  let t = 0; s = 0;
  const nst = dv.getUint32(box.stts.start + 4);
  for (let i = 0; i < nst; i++) {
    const o = box.stts.start + 8 + i * 8;
    const c = dv.getUint32(o), d = dv.getUint32(o + 4);
    for (let k = 0; k < c && s < n; k++) { dts[s++] = t; t += d; }
  }
  while (s < n) dts[s++] = t;

  // offset di composizione (ctts): presenti se ci sono B-frame
  const cts = dts.slice();
  if (box.ctts) {
    const nct = dv.getUint32(box.ctts.start + 4);
    s = 0;
    for (let i = 0; i < nct; i++) {
      const o = box.ctts.start + 8 + i * 8;
      const c = dv.getUint32(o), d = dv.getInt32(o + 4);
      for (let k = 0; k < c && s < n; k++) { cts[s] += d; s++; }
    }
  }

  // keyframe (stss): se manca, sono tutti keyframe
  const sync = new Array(n).fill(!box.stss);
  if (box.stss) {
    const c = dv.getUint32(box.stss.start + 4);
    for (let i = 0; i < c; i++) {
      const k = dv.getUint32(box.stss.start + 8 + i * 4) - 1;
      if (k >= 0 && k < n) sync[k] = true;
    }
    sync[0] = true; // il primo campione è sempre il punto di partenza
  }

  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = { offset: offset[i], size: size[i], dts: dts[i], cts: cts[i], sync: sync[i] };
  return out.filter((x) => x.offset !== undefined && x.size > 0);
}

const hex = (v) => v.toString(16).padStart(2, '0');
const pad = (v) => String(v).padStart(2, '0');
