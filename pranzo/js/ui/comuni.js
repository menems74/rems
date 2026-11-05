/* =========================================================================
   ui/comuni.js — i pezzi che usano tutte le schermate: il foglio che sale
   dal basso, la foto del piatto (o il suo segnaposto colorato), i chip.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import { icona } from './icone.js';
import * as M from '../model.js';

/* ---------------------------------------------------------- il foglio ----
   Uno solo alla volta. Si chiude con la X, toccando fuori, con Esc o con
   il tasto indietro del telefono (per questo si aggiunge una voce alla
   cronologia quando si apre).                                            */

let fogliAperto = false;

export function apriFoglio(titolo, costruisci) {
  const radice = document.getElementById('foglio');
  const corpo = document.getElementById('foglioCorpo');
  document.getElementById('foglioTitolo').textContent = titolo || '';
  svuotaNodo(corpo);
  costruisci(corpo);
  if (!fogliAperto) {
    fogliAperto = true;
    radice.hidden = false;
    document.body.classList.add('conFoglio');
    try { history.pushState({ foglio: true }, ''); } catch (e) { /* pazienza */ }
    requestAnimationFrame(() => radice.classList.add('aperto'));
  }
  corpo.scrollTop = 0;
}

/** Chiude il foglio. `daCronologia` quando l'ha chiuso il tasto indietro. */
export function chiudiFoglio(daCronologia) {
  if (!fogliAperto) return;
  fogliAperto = false;
  const radice = document.getElementById('foglio');
  radice.classList.remove('aperto');
  document.body.classList.remove('conFoglio');
  setTimeout(() => { if (!fogliAperto) radice.hidden = true; }, 220);
  if (!daCronologia && history.state && history.state.foglio) {
    try { history.back(); } catch (e) { /* pazienza */ }
  }
}

export function foglioAperto() { return fogliAperto; }

/* ---------------------------------------------------------- le foto ------
   Quando un piatto non ha la foto, al suo posto c'è un disegno di che cosa
   c'è nel piatto (pasta, pesce, verdura...) sul suo colore. Quando la foto
   arriva, il disegno sparisce sotto.                                     */

const DISEGNI = {
  pasta: '<path d="M8 26h32a16 16 0 0 1-32 0z"/><path d="M14 22c2-6 6-6 8 0M22 22c2-6 6-6 8 0M30 22c1-4 4-4 5 0"/>',
  cereali: '<path d="M8 25h32a16 16 0 0 1-32 0z"/><path d="M13 21c3-5 19-5 22 0"/><path d="M18 17.5h.1M24 15.5h.1M30 17.5h.1"/>',
  pizza: '<path d="M24 42L8 12c10-5 22-5 32 0z"/><path d="M10 16c9-4 19-4 28 0"/><circle cx="22" cy="22" r="2"/><circle cx="28" cy="28" r="2"/><circle cx="23" cy="33" r="1.6"/>',
  zuppa: '<path d="M8 22h32v6a12 12 0 0 1-12 12h-8A12 12 0 0 1 8 28z"/><path d="M4 22h40"/><path d="M18 16c-2-2 2-4 0-7M24 16c-2-2 2-4 0-7M30 16c-2-2 2-4 0-7"/>',
  carne: '<path d="M10 24c0-8 7-14 16-14s14 5 14 12-6 16-16 16S10 32 10 24z"/><circle cx="29" cy="21" r="4"/><path d="M15 27c3 3 8 4 12 2"/>',
  pesce: '<path d="M14 24c5-7 11-10 18-10 5 0 9 4 11 10-2 6-6 10-11 10-7 0-13-3-18-10z"/><path d="M14 24L5 17v14z"/><circle cx="35" cy="22" r="1.5"/>',
  uova: '<path d="M24 6c-7 0-12 11-12 19a12 12 0 0 0 24 0c0-8-5-19-12-19z"/><path d="M19 22c0-3 1.5-6 3.5-8"/>',
  legumi: '<ellipse cx="17" cy="19" rx="7" ry="5" transform="rotate(-30 17 19)"/><ellipse cx="31" cy="21" rx="7" ry="5" transform="rotate(25 31 21)"/><ellipse cx="23" cy="32" rx="7" ry="5" transform="rotate(-10 23 32)"/>',
  formaggio: '<path d="M6 30l26-16 10 6v14H6z"/><path d="M6 30h36"/><circle cx="16" cy="37" r="2"/><circle cx="31" cy="25" r="2"/><circle cx="35" cy="35" r="1.6"/>',
  verdura: '<path d="M24 40c-9 0-14-7-14-14 6 0 11 3 14 8 3-5 8-8 14-8 0 7-5 14-14 14z"/><path d="M24 34V12M24 18c-3-3-3-6 0-9 3 3 3 6 0 9"/>'
};

function disegno(categoria) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'disegno');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = DISEGNI[categoria] || DISEGNI.verdura;
  return svg;
}

/**
 * Il riquadro foto di un piatto. Se la foto c'è, la carica dopo: intanto si
 * vede il disegno, così la pagina non salta.
 */
export function fotoPiatto(piatto, stato, classe = '') {
  const id = piatto ? piatto.id : '';
  const categoria = M.categoriaPiatto(piatto, stato.indiceIngredienti);
  const box = el('div', { class: 'foto cat-' + categoria + ' ' + classe }, [disegno(categoria)]);
  if (piatto && stato.fotoDi.has(id) && stato.azioni.urlFoto) {
    stato.azioni.urlFoto(id).then((url) => {
      if (!url) return;
      box.style.backgroundImage = 'url("' + url + '")';
      box.classList.add('conFoto');
    }).catch(() => {});
  }
  return box;
}

/* ---------------------------------------------------------- piccoli ------ */

/** La curva morbida che decora le testate. */
export function ghirigoro() {
  return el('div', {
    class: 'ghirigoro', 'aria-hidden': 'true',
    html: '<svg viewBox="0 0 140 90"><path d="M5 60 C 35 10, 60 90, 90 40 S 130 20, 138 50"/></svg>'
  });
}

export function bottoneIcona(nome, etichetta, onclick, classe = '') {
  return el('button', {
    class: `tondo ${classe}`, type: 'button', 'aria-label': etichetta, title: etichetta, onclick
  }, [icona(nome)]);
}

/** Interruttore a due o tre voci: [{valore, testo}], quello acceso, al cambio. */
export function segmenti(voci, acceso, cambia, etichetta) {
  return el('div', { class: 'segmenti', role: 'group', 'aria-label': etichetta || '' },
    voci.map((v) => el('button', {
      type: 'button',
      class: v.valore === acceso ? 'acceso' : '',
      'aria-pressed': v.valore === acceso ? 'true' : 'false',
      onclick: () => { if (v.valore !== acceso) cambia(v.valore); }
    }, v.testo)));
}

/** "PRANZO · 25 MIN · 435 KCAL" sopra il nome del piatto. */
export function occhiello(parti) {
  return el('div', { class: 'occhiello' }, parti.filter(Boolean).join(' · '));
}

/** Tempo e calorie di un piatto, per l'occhiello. */
export function datiPiatto(piatto, stato) {
  if (!piatto) return [];
  const kcal = M.kcalPiatto(piatto, stato.indiceIngredienti);
  return [M.formattaTempo(piatto.tempoMin), kcal ? `${kcal} kcal` : null];
}

/** Il nome di un piatto dato l'id, o un trattino se è sparito. */
export function nomeDi(stato, id) {
  const p = id && stato.indicePiatti.get(id);
  return p ? p.nome : '—';
}
