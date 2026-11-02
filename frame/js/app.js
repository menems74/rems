/* =========================================================================
   app.js — interfaccia di Frame.

   Flusso: apri il video -> si legge l'indice (motore preciso, WebCodecs) o,
   se non si può, si usa il lettore del browser (modalità approssimata) ->
   si scorre con tasti, gesti o cursore -> "Condividi" crea il PNG del frame
   in memoria e apre il menu Condividi di Android (nessun salvataggio).
   ========================================================================= */

import { MotorePreciso, MotoreVideo } from './motore.js';

const $ = (id) => document.getElementById(id);
const el = {
  vista: $('vista'), tela: $('tela'), comandi: $('comandi'), cursore: $('cursore'),
  num: $('numFrame'), tot: $('totFrame'), tempo: $('tempo'), nome: $('nomeFile'),
  key: $('tagKey'), anteprima: $('tagAnteprima'), approx: $('tagApprox'), zoom: $('tagZoom'),
  rotella: $('rotella'), avviso: $('avviso'), info: $('btnInfo'), condividi: $('btnCondividi'),
  dlg: $('dlgInfo'), infoLista: $('infoLista'), vai: $('btnVai')
};

const stato = {
  motore: null, file: null, pos: 0, veloce: false,
  mostrato: -1,               // frame effettivamente disegnato
  zoom: 1, px: 0, py: 0       // zoom e spostamento (in pixel dello schermo)
};

/* Il frame corrente, già ruotato, a piena risoluzione: serve per ridisegnare
   lo zoom e per la condivisione senza dipendere dalla cache del motore. */
const frameTela = document.createElement('canvas');

/* ---------------------------------------------------------------- apertura */
for (const id of ['file', 'file2']) {
  $(id).addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) apri(f);
  });
}
// trascinamento del file (comodo da PC)
el.vista.addEventListener('dragover', (e) => e.preventDefault());
el.vista.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) apri(f);
});

async function apri(file) {
  if (stato.motore) stato.motore.chiudi();
  stato.motore = null;
  el.comandi.setAttribute('aria-disabled', 'true');
  el.info.disabled = true;
  el.nome.textContent = file.name;
  attesa(true);
  let motore, motivo = '';
  try {
    motore = await MotorePreciso.apri(file);
  } catch (e) {
    motivo = e.message;
    try {
      motore = await MotoreVideo.apri(file);
    } catch (e2) {
      attesa(false);
      avviso(`Impossibile aprire il video: ${e2.message}`);
      el.nome.textContent = 'Nessun video aperto';
      return;
    }
  }
  stato.motore = motore;
  stato.file = file;
  stato.motivo = motivo;
  stato.mostrato = -1;
  azzeraZoom();
  el.vista.classList.add('carico');
  el.cursore.max = String(motore.totale - 1);
  el.tot.textContent = `/ ${fmtN(motore.totale)}`;
  el.approx.hidden = motore.preciso;
  el.comandi.setAttribute('aria-disabled', 'false');
  el.info.disabled = false;
  if (!motore.preciso) avviso(`Modalità approssimata (${motivo}). Il fotogramma è reale, il numero è stimato a 30 fps.`);
  await vai(0);
}

/* -------------------------------------------------------------- navigazione */
async function vai(pos, veloce = false) {
  const m = stato.motore;
  if (!m) return;
  pos = Math.max(0, Math.min(m.totale - 1, Math.round(pos)));
  stato.pos = pos; stato.veloce = veloce;
  testi();
  let bmp = m.inCache(pos);
  if (!bmp) {
    attesa(true);
    const r = await m.frame(pos, { soloKeyframe: veloce });
    if (stato.motore !== m || stato.pos !== pos || stato.veloce !== veloce) return; // superato
    bmp = veloce ? r : (m.inCache(pos) || r);
  }
  attesa(false);
  if (!bmp) { avviso('Questo frame non si riesce a decodificare.'); return; }
  caricaFrame(bmp, m);
  stato.mostrato = veloce ? -1 : pos;
  el.anteprima.hidden = !veloce;
  disegna();
}

function passo(n) { if (stato.motore) vai(stato.pos + n); }

function testi() {
  const m = stato.motore;
  el.num.textContent = fmtN(stato.pos + 1);
  el.tempo.textContent = fmtT(m.tempo(stato.pos));
  el.cursore.value = String(stato.pos);
  el.key.hidden = !(m.preciso && m.keyframe(stato.pos));
}

// tasti: un tocco = un passo; tenendo premuto si scorre di continuo
for (const b of document.querySelectorAll('.tasto')) {
  const n = Number(b.dataset.passo);
  let t1 = null, t2 = null;
  const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    passo(n);
    t1 = setTimeout(() => { t2 = setInterval(() => passo(n), Math.abs(n) === 1 ? 70 : 160); }, 380);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, stop);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}

// cursore: mentre si trascina si mostrano i keyframe (rapidi), al rilascio il frame esatto
el.cursore.addEventListener('input', () => vai(Number(el.cursore.value), true));
el.cursore.addEventListener('change', () => vai(Number(el.cursore.value), false));

// tastiera (da PC)
document.addEventListener('keydown', (e) => {
  if (!stato.motore || e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  const k = e.key;
  if (k === 'ArrowRight' || k === 'ArrowLeft') {
    e.preventDefault();
    passo((k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1));
  } else if (k === 'Home') { e.preventDefault(); vai(0); }
  else if (k === 'End') { e.preventDefault(); vai(stato.motore.totale - 1); }
});

el.vai.addEventListener('click', () => {
  const m = stato.motore;
  if (!m) return;
  const v = prompt(`Vai al frame (1 – ${m.totale}):`, String(stato.pos + 1));
  const n = parseInt(v, 10);
  if (Number.isFinite(n)) vai(n - 1);
});

/* ---------------------------------------------------------------- disegno */
function caricaFrame(bmp, m) {
  const rot = m.preciso ? m.info().rotazione : 0;
  const giro = rot === 90 || rot === 270;
  const w = giro ? bmp.height : bmp.width, h = giro ? bmp.width : bmp.height;
  if (frameTela.width !== w || frameTela.height !== h) { frameTela.width = w; frameTela.height = h; }
  const c = frameTela.getContext('2d');
  c.save();
  c.translate(w / 2, h / 2);
  c.rotate(rot * Math.PI / 180);
  c.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  c.restore();
}

function disegna() {
  const t = el.tela, dpr = window.devicePixelRatio || 1;
  const cw = Math.round(t.clientWidth * dpr), ch = Math.round(t.clientHeight * dpr);
  if (t.width !== cw || t.height !== ch) { t.width = cw; t.height = ch; }
  const c = t.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, cw, ch);
  if (!frameTela.width) return;
  const s = adatta() * stato.zoom * dpr;
  const w = frameTela.width * s, h = frameTela.height * s;
  // ingrandito molto: pixel netti, utili per leggere testo e dettagli
  c.imageSmoothingEnabled = s / dpr < 2;
  c.drawImage(frameTela, (cw - w) / 2 + stato.px * dpr, (ch - h) / 2 + stato.py * dpr, w, h);
  el.zoom.hidden = stato.zoom === 1;
  el.zoom.textContent = `${stato.zoom.toFixed(stato.zoom < 10 ? 1 : 0)}×`;
}

function adatta() {
  if (!frameTela.width) return 1;
  return Math.min(el.tela.clientWidth / frameTela.width, el.tela.clientHeight / frameTela.height);
}

new ResizeObserver(() => { limita(); disegna(); }).observe(el.vista);

/* ------------------------------------------------------------------ gesti */
const tocchi = new Map();
let gesto = null, ultimoTap = 0;

el.vista.addEventListener('pointerdown', (e) => {
  if (!stato.motore) return;
  el.vista.setPointerCapture(e.pointerId);
  tocchi.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (tocchi.size === 1) {
    gesto = { tipo: null, x0: e.clientX, y0: e.clientY, px: stato.px, py: stato.py, pos0: stato.pos, mosso: false };
  } else if (tocchi.size === 2) {
    const [a, b] = [...tocchi.values()];
    gesto = { tipo: 'pinch', d0: dist(a, b), z0: stato.zoom, c0: centro(a, b), px: stato.px, py: stato.py, mosso: true };
  }
});

el.vista.addEventListener('pointermove', (e) => {
  if (!tocchi.has(e.pointerId) || !gesto) return;
  tocchi.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesto.tipo === 'pinch' && tocchi.size >= 2) {
    const [a, b] = [...tocchi.values()];
    const z = clampZoom(gesto.z0 * dist(a, b) / gesto.d0);
    const c = centro(a, b), r = el.vista.getBoundingClientRect();
    // il punto sotto le dita resta fermo
    const ox = gesto.c0.x - r.left - r.width / 2, oy = gesto.c0.y - r.top - r.height / 2;
    stato.px = c.x - r.left - r.width / 2 - (ox - gesto.px) * z / gesto.z0;
    stato.py = c.y - r.top - r.height / 2 - (oy - gesto.py) * z / gesto.z0;
    stato.zoom = z;
    limita(); disegna();
    return;
  }
  const dx = e.clientX - gesto.x0, dy = e.clientY - gesto.y0;
  if (!gesto.tipo && Math.hypot(dx, dy) > 8) {
    gesto.mosso = true;
    gesto.tipo = stato.zoom > 1 ? 'pan' : (Math.abs(dx) > Math.abs(dy) ? 'scorri' : 'nulla');
  }
  if (gesto.tipo === 'pan') {
    stato.px = gesto.px + dx; stato.py = gesto.py + dy;
    limita(); disegna();
  } else if (gesto.tipo === 'scorri') {
    // 16 px di trascinamento = 1 frame
    const n = gesto.pos0 + Math.round(dx / 16);
    if (n !== stato.pos) vai(n);
  }
});

function fineTocco(e) {
  if (!tocchi.delete(e.pointerId)) return;
  if (tocchi.size === 0) {
    if (gesto && !gesto.mosso) {
      const ora = Date.now();
      if (ora - ultimoTap < 300) { doppioTocco(e); ultimoTap = 0; } else ultimoTap = ora;
    }
    gesto = null;
  } else if (tocchi.size === 1) {
    const [p] = [...tocchi.values()];
    gesto = { tipo: stato.zoom > 1 ? 'pan' : 'nulla', x0: p.x, y0: p.y, px: stato.px, py: stato.py, pos0: stato.pos, mosso: true };
  }
}
el.vista.addEventListener('pointerup', fineTocco);
el.vista.addEventListener('pointercancel', fineTocco);

function doppioTocco(e) {
  if (stato.zoom > 1) { azzeraZoom(); disegna(); return; }
  const r = el.vista.getBoundingClientRect();
  const ox = e.clientX - r.left - r.width / 2, oy = e.clientY - r.top - r.height / 2;
  stato.zoom = 3;
  stato.px = -ox * 2; stato.py = -oy * 2;
  limita(); disegna();
}

// rotellina del mouse: zoom (da PC)
el.vista.addEventListener('wheel', (e) => {
  if (!stato.motore) return;
  e.preventDefault();
  const r = el.vista.getBoundingClientRect();
  const ox = e.clientX - r.left - r.width / 2, oy = e.clientY - r.top - r.height / 2;
  const z = clampZoom(stato.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  stato.px = ox - (ox - stato.px) * z / stato.zoom;
  stato.py = oy - (oy - stato.py) * z / stato.zoom;
  stato.zoom = z;
  limita(); disegna();
}, { passive: false });

function azzeraZoom() { stato.zoom = 1; stato.px = 0; stato.py = 0; }
function clampZoom(z) { return Math.max(1, Math.min(z, Math.max(4, 8 / adatta()))); }
function limita() {
  if (stato.zoom <= 1) { stato.px = stato.py = 0; return; }
  const s = adatta() * stato.zoom;
  const mx = Math.max(0, (frameTela.width * s - el.vista.clientWidth) / 2);
  const my = Math.max(0, (frameTela.height * s - el.vista.clientHeight) / 2);
  stato.px = Math.max(-mx, Math.min(mx, stato.px));
  stato.py = Math.max(-my, Math.min(my, stato.py));
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) || 1;
const centro = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/* ------------------------------------------------------------- condivisione */
el.condividi.addEventListener('click', async () => {
  const m = stato.motore;
  if (!m) return;
  // il PNG va creato subito, nello stesso tocco: il menu Condividi lo richiede
  if (stato.mostrato !== stato.pos) { avviso('Attendi che il frame sia caricato, poi riprova.'); vai(stato.pos); return; }
  el.condividi.disabled = true;
  try {
    const blob = await new Promise((r) => frameTela.toBlob(r, 'image/png'));
    const nome = nomePng();
    const file = new File([blob], nome, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: nome });
    } else {
      // niente menu Condividi (es. PC): si scarica il file
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      avviso('Condivisione non disponibile qui: il PNG è stato scaricato.');
    }
  } catch (e) {
    if (e.name !== 'AbortError') avviso(`Condivisione non riuscita: ${e.message}`);
  } finally {
    el.condividi.disabled = false;
  }
});

function nomePng() {
  const base = stato.file.name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 60);
  const t = stato.motore.tempo(stato.pos);
  const mm = Math.floor(t / 60), ss = Math.floor(t % 60), ms = Math.round((t % 1) * 1000) % 1000;
  return `${base}_f${String(stato.pos + 1).padStart(6, '0')}_${pad2(mm)}m${pad2(ss)}s${String(ms).padStart(3, '0')}.png`;
}

/* ------------------------------------------------------------------- info */
el.info.addEventListener('click', () => {
  const m = stato.motore;
  if (!m) return;
  const i = m.info();
  const righe = [
    ['File', stato.file.name],
    ['Dimensione', `${(stato.file.size / 1048576).toFixed(1)} MB`],
    ['Modalità', m.preciso ? 'precisa (frame reali)' : `approssimata — ${stato.motivo}`],
    ['Codec', i.codec],
    ['Risoluzione', `${frameTela.width || i.larghezza} × ${frameTela.height || i.altezza}`],
    ['Rotazione', `${i.rotazione}°`],
    ['Frame', fmtN(m.totale)],
    ['Durata', fmtT(m.tempo(m.totale - 1))],
    ['FPS medi', i.fpsMedi.toFixed(2) + (m.preciso ? ' (variabili nelle registrazioni schermo)' : ' (ipotesi)')]
  ];
  if (i.keyframe) righe.push(['Keyframe', fmtN(i.keyframe)]);
  el.infoLista.replaceChildren(...righe.flatMap(([k, v]) => {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k; dd.textContent = v;
    return [dt, dd];
  }));
  el.dlg.showModal();
});

/* ------------------------------------------------------------------ utilità */
let tAvviso;
function avviso(testo) {
  el.avviso.textContent = testo;
  el.avviso.hidden = false;
  clearTimeout(tAvviso);
  tAvviso = setTimeout(() => { el.avviso.hidden = true; }, 4500);
}
let tAttesa;
function attesa(si) {
  clearTimeout(tAttesa);
  // la rotella compare solo se l'attesa è percepibile
  if (si) tAttesa = setTimeout(() => { el.rotella.hidden = false; }, 120);
  else el.rotella.hidden = true;
}
const fmtN = (n) => n.toLocaleString('it-IT');
const pad2 = (n) => String(n).padStart(2, '0');
function fmtT(s) {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${pad2(m)}:${r.toFixed(3).padStart(6, '0')}`;
}

// per i test automatici
window.__frame = { stato, vai, frameTela };

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
