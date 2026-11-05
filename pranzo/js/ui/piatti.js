/* =========================================================================
   ui/piatti.js — il catalogo: cerca, guarda, metti il cuore o escludi.
   Da qui si aggiungono anche i piatti nuovi con un'AI.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import { icona } from './icone.js';
import { fotoPiatto, occhiello, datiPiatto, segmenti, ghirigoro } from './comuni.js';
import { mostraPiatto } from './piatto.js';
import * as M from '../model.js';

/* Ricerca e filtro restano mentre si apre e si chiude un piatto. */
const vista = { testo: '', filtro: 'tutti' };

export function render(contenitore, stato) {
  svuotaNodo(contenitore);
  const pref = stato.preferenze;
  const amati = new Set(pref.amoPiatti || []);
  const esclusi = new Set(pref.escludiPiatti || []);

  contenitore.appendChild(el('header', { class: 'testata arancio' }, [
    ghirigoro(),
    el('div', { class: 'barraTesta' }, [el('span', { class: 'marchio' }, ['Piatti', el('i', {}, '.')])]),
    el('h1', {}, ['Tutti', el('br'), 'i vostri piatti']),
    el('p', { class: 'contoSpesa' }, `${stato.piatti.length} in catalogo, contorni compresi`)
  ]));

  const corpo = el('div', { class: 'corpo sovrapposto' });
  contenitore.appendChild(corpo);

  corpo.appendChild(el('a', { class: 'bandaAi', href: '#/nuovi' }, [
    el('span', { class: 'iconaAi' }, [icona('scintilla')]),
    el('span', { class: 'testoAi' }, [el('b', {}, 'Piatti nuovi con l\'AI'), el('br'), 'Chiedi idee e importale qui']),
    icona('avanti')
  ]));

  const elenco = el('div', { class: 'elencoScelta' });
  corpo.appendChild(el('label', { class: 'cerca' }, [
    icona('cerca'),
    el('input', { type: 'search', placeholder: 'Cerca un piatto', value: vista.testo, 'aria-label': 'Cerca un piatto',
      oninput: (e) => { vista.testo = e.target.value; disegna(); } })
  ]));
  corpo.appendChild(segmenti([
    { valore: 'tutti', testo: 'Tutti' },
    { valore: 'cuori', testo: `Col cuore (${amati.size})` },
    { valore: 'esclusi', testo: `Esclusi (${esclusi.size})` }
  ], vista.filtro, (v) => { vista.filtro = v; render(contenitore, stato); }, 'Quali piatti'));
  corpo.appendChild(elenco);
  disegna();

  function disegna() {
    svuotaNodo(elenco);
    const t = vista.testo.trim().toLowerCase();
    const trovati = stato.piatti
      .filter((p) => vista.filtro !== 'cuori' || amati.has(p.id))
      .filter((p) => vista.filtro !== 'esclusi' || esclusi.has(p.id))
      .filter((p) => !t || p.nome.toLowerCase().includes(t))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    if (!trovati.length) {
      elenco.appendChild(el('p', { class: 'nota' }, vista.filtro === 'cuori'
        ? 'Nessun piatto col cuore. Apri un piatto e tocca "Mi piace".'
        : vista.filtro === 'esclusi' ? 'Nessun piatto escluso.' : 'Nessun piatto con questo nome.'));
      return;
    }
    for (const p of trovati) {
      elenco.appendChild(el('button', { class: 'rigaPiatto' + (esclusi.has(p.id) ? ' spenta' : ''), type: 'button',
        onclick: () => mostraPiatto(p, stato) }, [
        fotoPiatto(p, stato, 'mini'),
        el('div', { class: 'testoPasto' }, [
          el('div', { class: 'nomePiatto piccolo' }, p.nome),
          occhiello([M.NOME_TIPO[p.tipo], ...datiPiatto(p, stato)])
        ]),
        amati.has(p.id) ? el('span', { class: 'cuoricino' }, [icona('cuore', 'ti piace')]) : null,
        esclusi.has(p.id) ? el('span', { class: 'vietato' }, [icona('vieta', 'escluso')]) : null
      ]));
    }
  }
}
