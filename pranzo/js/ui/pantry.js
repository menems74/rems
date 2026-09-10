/* =========================================================================
   ui/pantry.js — Dispensa: quello che c'è in casa, con modifica rapida.
   Persiste tra le settimane e viene sottratta dalla lista della spesa.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import * as M from '../model.js';

export function render(contenitore, stato) {
  svuotaNodo(contenitore);

  const righe = stato.dispensaRighe.slice()
    .sort((a, b) => nomeDi(a, stato).localeCompare(nomeDi(b, stato), 'it'));

  contenitore.appendChild(el('p', { class: 'conteggio' },
    righe.length ? `${righe.length} voci in dispensa` : 'La dispensa è vuota.'));

  if (righe.length) {
    const elenco = el('div', { class: 'dispensa' });
    for (const riga of righe) elenco.appendChild(rigaDispensa(riga, stato));
    contenitore.appendChild(elenco);
  }

  contenitore.appendChild(aggiungi(stato));
}

function nomeDi(riga, stato) {
  const ing = stato.indiceIngredienti.get(riga.ingredienteId);
  return ing ? ing.nome : riga.ingredienteId;
}

function rigaDispensa(riga, stato) {
  const ing = stato.indiceIngredienti.get(riga.ingredienteId);
  const campo = el('input', {
    type: 'number', min: '0', step: 'any', value: String(riga.qta),
    inputmode: 'decimal', 'aria-label': 'Quantità di ' + nomeDi(riga, stato),
    onchange: (e) => stato.azioni.salvaDispensa(riga.ingredienteId, Number(e.target.value))
  });

  return el('div', { class: 'vociDispensa' }, [
    el('span', { class: 'nomeDispensa' }, nomeDi(riga, stato)),
    el('span', { class: 'campoQta' }, [campo, el('span', { class: 'unita num' }, ing ? ing.unita : '')]),
    el('button', {
      class: 'testuale', type: 'button',
      onclick: () => stato.azioni.salvaDispensa(riga.ingredienteId, 0)
    }, 'toglie')
  ]);
}

function aggiungi(stato) {
  const presenti = new Set(stato.dispensaRighe.map((r) => r.ingredienteId));
  const scelta = el('select', { 'aria-label': 'Ingrediente da aggiungere' }, [
    el('option', { value: '' }, 'scegli un ingrediente'),
    ...stato.ingredienti
      .filter((i) => !presenti.has(i.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
      .map((i) => el('option', { value: i.id }, `${i.nome} (${i.unita})`))
  ]);
  const qta = el('input', { type: 'number', min: '0', step: 'any', placeholder: 'quantità', inputmode: 'decimal' });

  return el('div', { class: 'aggiungi' }, [
    scelta, qta,
    el('button', {
      class: 'testuale', type: 'button',
      onclick: () => {
        if (!scelta.value || !Number(qta.value)) return;
        stato.azioni.salvaDispensa(scelta.value, Number(qta.value));
        qta.value = '';
      }
    }, 'aggiungi')
  ]);
}
