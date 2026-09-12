/* =========================================================================
   ui/week.js — schermata Settimana.
   Un blocco per giorno, con il margine del quaderno a sinistra. Dentro il
   giorno, una riga per pasto: pranzo e cena uno sotto l'altro, così ogni
   nome si prende tutta la larghezza e si legge da lontano.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import * as M from '../model.js';
import * as P from '../planner.js';
import { mostraDettaglio } from './dish.js';

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export function render(contenitore, stato) {
  svuotaNodo(contenitore);
  const menu = stato.menu;

  if (!menu || !menu.giorni || !menu.giorni.length) {
    contenitore.appendChild(el('p', { class: 'vuoto' },
      'Nessun menù per questa settimana.'));
    contenitore.appendChild(el('button', {
      class: 'azione', type: 'button',
      onclick: () => stato.azioni.generaSettimana()
    }, 'Genera la settimana'));
    return;
  }

  contenitore.appendChild(intestazione(menu, stato));
  if (menu.rilassamenti && menu.rilassamenti.length) {
    contenitore.appendChild(el('p', { class: 'rilassato' },
      'Ho allentato dei vincoli: ' + menu.rilassamenti.join('; ') + '.'));
  }
  for (const avviso of menu.avvisi || []) {
    contenitore.appendChild(el('p', { class: 'rilassato' }, avviso));
  }

  const lista = el('div', { class: 'settimana' });
  for (const giorno of menu.giorni) lista.appendChild(rigaGiorno(giorno, menu, stato));
  contenitore.appendChild(lista);

  contenitore.appendChild(el('button', {
    class: 'azione', type: 'button',
    onclick: () => stato.azioni.generaSettimana()
  }, 'Rigenera la settimana'));
  contenitore.appendChild(el('p', { class: 'nota' },
    'I pasti bloccati non vengono toccati.'));
}

function intestazione(menu, stato) {
  const date = menu.giorni.map((g) => g.data).filter(Boolean).sort();
  const da = date[0] ? new Date(date[0] + 'T00:00:00') : null;
  const a = date[date.length - 1] ? new Date(date[date.length - 1] + 'T00:00:00') : null;
  const periodo = da && a ? `${da.getDate()}–${a.getDate()} ${MESI[a.getMonth()]}` : '';
  const { settimana } = P.settimanaIso(da || new Date());

  let pasti = 0, minuti = 0;
  for (const g of menu.giorni) {
    for (const [, pasto] of M.pastiDi(g)) {
      pasti++;
      if (!pasto.avanziDa) minuti += tempoPasto(pasto, stato);
    }
  }

  return el('p', { class: 'periodo' }, [
    el('span', {}, `settimana ${settimana}`),
    el('span', { class: 'num' }, periodo),
    el('span', { class: 'num' }, `${pasti} pasti`),
    el('span', { class: 'num' }, M.formattaTempo(minuti) + ' ai fornelli')
  ]);
}

function tempoPasto(pasto, stato) {
  return (pasto.piatti || []).reduce((somma, id) => {
    const p = stato.indicePiatti.get(id);
    return somma + (p ? p.tempoMin : 0);
  }, 0);
}

/* ------------------------------------------------------------ il giorno -- */

function rigaGiorno(giorno, menu, stato) {
  const oggi = P.iso(new Date());

  const margine = el('div', { class: 'margine' }, [
    el('span', { class: 'gg' }, giorno.giorno),
    giorno.data ? el('span', { class: 'dd' }, String(new Date(giorno.data + 'T00:00:00').getDate())) : null
  ]);

  const corpo = el('div', { class: 'corpoGiorno' });
  const pasti = M.pastiDi(giorno);
  pasti.forEach(([nome, pasto], i) => {
    if (i) corpo.appendChild(el('div', { class: 'divisorePasto' }));
    corpo.appendChild(bloccoPasto(giorno, nome, pasto, menu, stato));
  });

  return el('div', { class: 'giorno' + (giorno.data === oggi ? ' oggi' : '') }, [margine, corpo]);
}

function bloccoPasto(giorno, nome, pasto, menu, stato) {
  const blocco = el('div', { class: 'pasto' + (pasto.bloccato ? ' bloccato' : '') });
  const piatti = (pasto.piatti || []).map((id) => stato.indicePiatti.get(id)).filter(Boolean);

  blocco.appendChild(el('p', { class: 'etichettaPasto' }, [
    el('span', {}, M.NOME_PASTO[nome]),
    pasto.avanziDa
      ? el('span', { class: 'segnoAvanzi' }, 'avanzi del pranzo')
      : null,
    pasto.bloccato ? el('span', { class: 'lucchetto', title: 'pasto bloccato' }, '⚿') : null
  ]));

  if (!piatti.length) {
    blocco.appendChild(el('span', { class: 'assente' }, 'niente per questo pasto'));
  } else {
    const nomi = el('div', { class: 'piatti' }, piatti.map((p) => el('button', {
      class: 'nomePiatto', type: 'button',
      onclick: () => mostraDettaglio(p, stato, (menu.perche || {})[p.id])
    }, p.nome)));
    blocco.appendChild(nomi);

    const coperti = M.macroCopertiGiorno(piatti, stato.indiceIngredienti);
    blocco.appendChild(el('div', { class: 'datiGiorno' }, [
      el('div', { class: 'pastiglie' }, M.MACRO_NUTRIENTI.map((m) => el('span', {
        class: 'macro ' + (coperti.includes(m) ? 'si' : 'no'),
        title: (coperti.includes(m) ? 'copre ' : 'manca ') + M.NOME_MACRO[m]
      }, M.ETICHETTA_MACRO[m]))),
      el('span', { class: 'num tempo' },
         pasto.avanziDa ? 'già cucinato' : M.formattaTempo(tempoPasto(pasto, stato))),
      el('span', { class: 'modalita' }, M.NOME_MODALITA[pasto.modalita])
    ]));
  }

  // un gusto cambiato dopo la generazione può rendere un piatto non più
  // ammesso: meglio dirlo qui che lasciare un menù che non rispetta le liste
  for (const p of piatti) {
    const blocco2 = M.motivoIndisponibilita(p, {
      indiceIngredienti: stato.indiceIngredienti,
      preferenze: stato.preferenze,
      mese: M.mesecorrente()
    });
    if (blocco2) {
      blocco.appendChild(el('p', { class: 'motivo piccolo' },
        `${p.nome}: ${blocco2.motivo}. Rigenera il pasto.`));
    }
  }

  blocco.appendChild(azioniPasto(giorno, nome, pasto, stato));
  return blocco;
}

/**
 * Le azioni dicono cosa ottieni: "altri piatti" cambia i piatti tenendo la
 * forma, l'altra porta il nome della forma in cui il pasto diventerebbe.
 */
function azioniPasto(giorno, nome, pasto, stato) {
  const alternativa = prossimaModalita(nome, pasto.modalita);
  const azioni = el('div', { class: 'azioniGiorno' });

  if (!pasto.avanziDa) {
    azioni.appendChild(el('button', {
      class: 'testuale', type: 'button',
      onclick: () => stato.azioni.rigeneraPasto(giorno.giorno, nome)
    }, 'altri piatti'));

    azioni.appendChild(el('button', {
      class: 'testuale', type: 'button',
      onclick: () => stato.azioni.cambiaModalita(giorno.giorno, nome, alternativa)
    }, M.NOME_MODALITA[alternativa]));
  }

  if (nome === 'cena' && (giorno.pasti || {}).pranzo) {
    azioni.appendChild(el('button', {
      class: 'testuale' + (pasto.avanziDa ? ' acceso' : ''), type: 'button',
      onclick: () => stato.azioni.avanziDalPranzo(giorno.giorno)
    }, pasto.avanziDa ? 'cucina una cena' : 'avanzi del pranzo'));
  }

  azioni.appendChild(el('button', {
    class: 'testuale' + (pasto.bloccato ? ' acceso' : ''), type: 'button',
    onclick: () => stato.azioni.bloccaPasto(giorno.giorno, nome)
  }, pasto.bloccato ? 'sblocca' : 'blocca'));

  return azioni;
}

/** A pranzo si alterna con primo+secondo, a cena con secondo+contorno. */
function prossimaModalita(pasto, modalita) {
  const coppia = pasto === 'cena' ? 'secondoContorno' : 'primoSecondo';
  return modalita === coppia ? 'unico' : coppia;
}
