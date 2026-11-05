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
   Quando un piatto non ha la foto, il riquadro prende una sfumatura calda
   scelta dal suo id: sempre la stessa per lo stesso piatto.              */

const SFUMATURE = 6;

export function sfumaturaDi(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 'sf' + (h % SFUMATURE);
}

/**
 * Il riquadro foto di un piatto. Se la foto c'è, la carica dopo: intanto si
 * vede la sfumatura, così la pagina non salta.
 */
export function fotoPiatto(piatto, stato, classe = '') {
  const id = piatto ? piatto.id : '';
  const box = el('div', { class: `foto ${sfumaturaDi(id)} ${classe}` }, [icona('foto')]);
  if (piatto && stato.fotoDi.has(id) && stato.azioni.urlFoto) {
    stato.azioni.urlFoto(id).then((url) => {
      if (!url) return;
      box.style.backgroundImage = `url("${url}")`;
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
