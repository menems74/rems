/* =========================================================================
   ui/shopping.js — Lista spesa.
   È la schermata che si usa in piedi al supermercato, quindi è l'unica con
   una forma sua: uno scontrino. Nome a sinistra, filetto di puntini,
   quantità in monospazio a destra. Toccare la riga segna "comprato" e la
   barra: resta visibile, così sai cosa hai già preso.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import * as M from '../model.js';
import * as S from '../shopping.js';

const vista = { soloDaComprare: false };
const NOME_REPARTO = {
  ortofrutta: 'Ortofrutta', macelleria: 'Macelleria', pescheria: 'Pescheria',
  latticini: 'Latticini', panetteria: 'Panetteria', dispensa: 'Dispensa',
  surgelati: 'Surgelati', altro: 'Altro'
};

export function render(contenitore, stato) {
  svuotaNodo(contenitore);

  if (!stato.menu || !stato.menu.giorni || !stato.menu.giorni.length) {
    contenitore.appendChild(el('p', { class: 'vuoto' },
      'Prima serve un menù: genera la settimana.'));
    return;
  }
  if (!stato.lista) {
    contenitore.appendChild(el('p', { class: 'vuoto' },
      'Nessuna lista per questa settimana.'));
    contenitore.appendChild(el('button', {
      class: 'azione', type: 'button', onclick: () => stato.azioni.generaLista()
    }, 'Prepara la lista della spesa'));
    return;
  }

  const lista = stato.lista;
  const { fatti, totale } = S.conteggio(lista);

  contenitore.appendChild(el('div', { class: 'testaLista' }, [
    el('p', { class: 'contatore num' }, `comprati ${fatti} di ${totale}`),
    el('div', { class: 'comandiLista' }, [
      el('button', {
        class: 'testuale' + (vista.soloDaComprare ? ' acceso' : ''), type: 'button',
        onclick: () => { vista.soloDaComprare = !vista.soloDaComprare; render(contenitore, stato); }
      }, vista.soloDaComprare ? 'mostra tutto' : 'solo da comprare'),
      el('button', { class: 'testuale', type: 'button', onclick: () => stato.azioni.generaLista() },
        'ricalcola')
    ])
  ]));

  for (const problema of lista.problemi || []) {
    contenitore.appendChild(el('p', { class: 'rilassato' }, problema));
  }

  const gruppi = S.perReparto(lista, stato.preferenze.ordineReparti || M.REPARTI);
  const scontrino = el('div', { class: 'scontrino' });
  let mostrate = 0;

  for (const [reparto, voci] of gruppi) {
    const visibili = voci.filter((v) => !nascosta(v));
    if (!visibili.length) continue;
    scontrino.appendChild(el('p', { class: 'reparto' }, NOME_REPARTO[reparto] || reparto));
    for (const voce of visibili) { scontrino.appendChild(riga(voce, stato)); mostrate++; }
  }

  if (!mostrate) {
    scontrino.appendChild(el('p', { class: 'vuoto' },
      vista.soloDaComprare ? 'Preso tutto.' : 'Lista vuota.'));
  }
  contenitore.appendChild(scontrino);

  contenitore.appendChild(aggiungiLibera(stato));
}

function nascosta(voce) {
  if (voce.giaInCasa) return true;                       // sta in dispensa, non si compra
  if (vista.soloDaComprare && voce.comprato) return true;
  return false;
}

function riga(voce, stato) {
  const chiave = voce.libera ? voce.id : voce.ingredienteId;
  const quantita = voce.libera ? '' : M.formattaQta(voce.qtaDaComprare, voce.unita);

  const principale = el('button', {
    class: 'voce' + (voce.comprato ? ' preso' : ''),
    type: 'button', 'aria-pressed': String(!!voce.comprato),
    onclick: () => stato.azioni.segnaComprato(chiave)
  }, [
    el('span', { class: 'casella', 'aria-hidden': 'true' }, voce.comprato ? '×' : ''),
    el('span', { class: 'voceNome' }, voce.nome),
    el('span', { class: 'filo', 'aria-hidden': 'true' }),
    el('span', { class: 'voceQta num' }, quantita)
  ]);

  const dettagli = [];
  if (voce.notaArrotondamento) dettagli.push(el('span', {}, voce.notaArrotondamento));
  if (voce.qtaInDispensa > 0) {
    dettagli.push(el('span', {}, `in dispensa ${M.formattaQta(voce.qtaInDispensa, voce.unita)}`));
  }
  if (voce.usatoIn && voce.usatoIn.length) {
    dettagli.push(el('span', { class: 'usato' }, 'per ' + voce.usatoIn.join(', ').toLowerCase()));
  }

  const secondarie = voce.libera
    ? el('button', { class: 'testuale', type: 'button', onclick: () => stato.azioni.togliLibera(voce.id) }, 'toglie')
    : el('button', {
        class: 'testuale', type: 'button',
        onclick: () => stato.azioni.segnaInCasa(voce.ingredienteId)
      }, 'ce l\'ho già');

  return el('div', { class: 'bloccoVoce' }, [
    principale,
    el('div', { class: 'sottoVoce' }, [
      el('p', { class: 'notaVoce' }, dettagli.length ? dettagli : ''),
      secondarie
    ])
  ]);
}

function aggiungiLibera(stato) {
  const campo = el('input', {
    type: 'text', placeholder: 'Aggiungi una voce (detersivo, caffè…)',
    'aria-label': 'Aggiungi una voce alla lista'
  });
  const invia = () => {
    const testo = campo.value.trim();
    if (!testo) return;
    campo.value = '';
    stato.azioni.aggiungiLibera(testo);
  };
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') invia(); });
  return el('div', { class: 'aggiungi' }, [
    campo,
    el('button', { class: 'testuale', type: 'button', onclick: invia }, 'aggiungi')
  ]);
}

/** Serve anche alla schermata Dispensa per resettare il filtro. */
export function reimpostaVista() { vista.soloDaComprare = false; }
