/* =========================================================================
   ui/week.js — schermata Settimana.
   Una riga per giorno, con il margine del quaderno a sinistra: piatti,
   i tre macro e il tempo totale. Le azioni del giorno sono testo toccabile,
   l'unica azione grossa è rigenerare la settimana.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import * as M from '../model.js';
import * as P from '../planner.js';
import { mostraDettaglio } from './dish.js';

const NOME_GIORNO = {
  lun: 'lunedì', mar: 'martedì', mer: 'mercoledì', gio: 'giovedì',
  ven: 'venerdì', sab: 'sabato', dom: 'domenica'
};
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
    'I giorni bloccati non vengono toccati.'));
}

function intestazione(menu, stato) {
  const date = menu.giorni.map((g) => g.data).filter(Boolean).sort();
  const da = date[0] ? new Date(date[0] + 'T00:00:00') : null;
  const a = date[date.length - 1] ? new Date(date[date.length - 1] + 'T00:00:00') : null;
  const periodo = da && a
    ? `${da.getDate()}–${a.getDate()} ${MESI[a.getMonth()]}`
    : '';
  const { settimana } = P.settimanaIso(da || new Date());
  const minuti = menu.giorni.reduce((somma, g) => somma + tempoGiorno(g, stato), 0);

  return el('p', { class: 'periodo' }, [
    el('span', {}, `settimana ${settimana}`),
    el('span', { class: 'num' }, periodo),
    el('span', { class: 'num' }, M.formattaTempo(minuti) + ' in tutto')
  ]);
}

function tempoGiorno(giorno, stato) {
  return (giorno.piatti || []).reduce((somma, id) => {
    const p = stato.indicePiatti.get(id);
    return somma + (p ? p.tempoMin : 0);
  }, 0);
}

function rigaGiorno(giorno, menu, stato) {
  const piatti = (giorno.piatti || []).map((id) => stato.indicePiatti.get(id)).filter(Boolean);
  const coperti = M.macroCopertiGiorno(piatti, stato.indiceIngredienti);
  const oggi = P.iso(new Date());

  const margine = el('div', { class: 'margine' }, [
    el('span', { class: 'gg' }, giorno.giorno),
    giorno.data ? el('span', { class: 'dd' }, String(new Date(giorno.data + 'T00:00:00').getDate())) : null,
    giorno.bloccato ? el('span', { class: 'lucchetto', title: 'giorno bloccato' }, '⚿') : null
  ]);

  const nomi = el('div', { class: 'piatti' },
    piatti.length
      ? piatti.map((p) => el('button', {
          class: 'nomePiatto', type: 'button',
          onclick: () => mostraDettaglio(p, stato, (menu.perche || {})[p.id])
        }, p.nome))
      : [el('span', { class: 'assente' }, 'niente per questo giorno')]);

  const macro = el('div', { class: 'pastiglie' },
    M.MACRO_NUTRIENTI.map((m) => el('span', {
      class: 'macro ' + (coperti.includes(m) ? 'si' : 'no'),
      title: (coperti.includes(m) ? 'copre ' : 'manca ') + M.NOME_MACRO[m]
    }, M.ETICHETTA_MACRO[m])));

  const dati = el('div', { class: 'datiGiorno' }, [
    macro,
    el('span', { class: 'num tempo' }, M.formattaTempo(tempoGiorno(giorno, stato))),
    el('span', { class: 'num modalita' }, giorno.modalita === 'primoSecondo' ? 'primo + secondo' : 'piatto unico')
  ]);

  // un gusto cambiato dopo la generazione può rendere un piatto non più
  // ammesso: meglio dirlo qui che lasciare un menù che non rispetta le liste
  const nonPiuAmmessi = piatti
    .map((p) => ({ p, blocco: M.motivoIndisponibilita(p, {
      indiceIngredienti: stato.indiceIngredienti,
      preferenze: stato.preferenze,
      mese: M.mesecorrente()
    }) }))
    .filter((x) => x.blocco);

  // Le etichette dicono cosa ottieni, non come si chiama l'operazione:
  // "altri piatti" tiene la forma del giorno e cambia i piatti; l'altra
  // porta il nome della forma in cui il giorno si trasformerebbe, e accanto
  // al tempo c'è scritto com'è adesso.
  const azioni = el('div', { class: 'azioniGiorno' }, [
    el('button', { class: 'testuale', type: 'button', onclick: () => stato.azioni.rigeneraGiorno(giorno.giorno) },
      'altri piatti'),
    el('button', {
      class: 'testuale', type: 'button',
      onclick: () => stato.azioni.cambiaModalita(giorno.giorno)
    }, giorno.modalita === 'primoSecondo' ? 'piatto unico' : 'primo + secondo'),
    el('button', {
      class: 'testuale' + (giorno.bloccato ? ' acceso' : ''), type: 'button',
      onclick: () => stato.azioni.bloccaGiorno(giorno.giorno)
    }, giorno.bloccato ? 'sblocca' : 'blocca')
  ]);

  const corpo = el('div', { class: 'corpoGiorno' }, [nomi, dati]);
  for (const { p, blocco } of nonPiuAmmessi) {
    corpo.appendChild(el('p', { class: 'motivo piccolo' },
      `${p.nome}: ${blocco.motivo}. Rigenera il giorno.`));
  }
  corpo.appendChild(azioni);

  return el('div', { class: 'giorno' + (giorno.data === oggi ? ' oggi' : '') }, [margine, corpo]);
}
