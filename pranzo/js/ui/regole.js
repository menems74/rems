/* =========================================================================
   ui/regole.js — "Come mangiate": persone, leggeri o sostanziosi, pranzo e
   cena o solo cena. Tre domande, e il bottone per rifare la settimana.
   ========================================================================= */

import { el } from './dom.js';
import { icona } from './icone.js';
import { apriFoglio, segmenti } from './comuni.js';
import * as M from '../model.js';

export function mostraRegole(stato) {
  apriFoglio('Come mangiate', (corpo) => disegna(corpo, stato));
}

function disegna(corpo, stato) {
  const pref = stato.preferenze;
  const cambia = (chiave, valore) => {
    stato.azioni.salvaPreferenze(Object.assign({}, pref, { [chiave]: valore }))
      .then(() => mostraRegole(stato));
  };
  const persone = pref.porzioni || 1;

  corpo.appendChild(el('div', { class: 'domanda' }, [
    el('span', { class: 'etichettaDomanda' }, 'Persone a tavola'),
    el('div', { class: 'contatore' }, [
      el('button', { type: 'button', class: 'tondo', 'aria-label': 'Una persona in meno',
        disabled: persone <= 1 ? 'disabled' : null, onclick: () => cambia('porzioni', persone - 1) }, '−'),
      el('span', { class: 'numero', 'aria-live': 'polite' }, String(persone)),
      el('button', { type: 'button', class: 'tondo', 'aria-label': 'Una persona in più',
        disabled: persone >= 8 ? 'disabled' : null, onclick: () => cambia('porzioni', persone + 1) }, '+')
    ])
  ]));

  corpo.appendChild(el('div', { class: 'domanda' }, [
    el('span', { class: 'etichettaDomanda' }, 'Che piatti'),
    segmenti(M.PESI.map((p) => ({ valore: p, testo: M.NOME_PESO[p] })), pref.peso || 'tutti',
      (v) => cambia('peso', v), 'Che piatti')
  ]));

  const conPranzo = (pref.pasti || []).includes('pranzo');
  corpo.appendChild(el('div', { class: 'domanda' }, [
    el('span', { class: 'etichettaDomanda' }, 'Quali pasti'),
    segmenti([{ valore: true, testo: 'Pranzo e cena' }, { valore: false, testo: 'Solo cena' }], conPranzo,
      (v) => cambia('pasti', v ? ['pranzo', 'cena'] : ['cena']), 'Quali pasti')
  ]));

  corpo.appendChild(el('p', { class: 'nota' },
    'Leggeri e sostanziosi si decidono dalle calorie: ogni piatto si confronta con gli altri del suo tipo. ' +
    'Le nuove scelte valgono dai prossimi piatti proposti; per applicarle subito rifai la settimana.'));

  corpo.appendChild(el('button', { class: 'grande', type: 'button',
    onclick: () => stato.azioni.generaSettimana() }, [icona('rigenera'), 'Rifai la settimana']));
  corpo.appendChild(el('p', { class: 'nota centro' }, 'I piatti che hai scelto tu restano dove sono.'));
}
