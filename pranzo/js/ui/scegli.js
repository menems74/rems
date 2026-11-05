/* =========================================================================
   ui/scegli.js — "Scegli tu": un piatto preso dal catalogo per un pasto.
   Si vedono solo i piatti giusti per quel pasto (a pranzo primi e piatti
   unici, a cena secondi e piatti unici), prima quelli col cuore.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import { icona } from './icone.js';
import { apriFoglio, fotoPiatto, occhiello, datiPiatto } from './comuni.js';
import * as M from '../model.js';

export function mostraScelta(giorno, pasto, stato) {
  const amati = new Set(stato.preferenze.amoPiatti || []);
  const tipi = M.TIPI_PASTO[pasto] || [];
  const contesto = { indiceIngredienti: stato.indiceIngredienti, preferenze: stato.preferenze, mese: M.mesecorrente() };
  const tutti = stato.piatti
    .filter((p) => tipi.includes(p.tipo) && !M.motivoIndisponibilita(p, contesto))
    .sort((a, b) => (amati.has(b.id) - amati.has(a.id)) || a.nome.localeCompare(b.nome, 'it'));

  apriFoglio(`${M.NOME_PASTO[pasto]} di ${M.NOME_GIORNO[giorno]}`, (corpo) => {
    const elenco = el('div', { class: 'elencoScelta' });
    const cerca = el('label', { class: 'cerca' }, [
      icona('cerca'),
      el('input', { type: 'search', placeholder: 'Cerca un piatto', 'aria-label': 'Cerca un piatto',
        oninput: (e) => disegna(e.target.value) })
    ]);
    corpo.appendChild(cerca);
    corpo.appendChild(elenco);
    disegna('');

    function disegna(testo) {
      svuotaNodo(elenco);
      const t = testo.trim().toLowerCase();
      const trovati = t ? tutti.filter((p) => p.nome.toLowerCase().includes(t)) : tutti;
      if (!trovati.length) {
        elenco.appendChild(el('p', { class: 'nota' }, 'Nessun piatto con questo nome.'));
        return;
      }
      for (const p of trovati) {
        elenco.appendChild(el('button', { class: 'rigaPiatto', type: 'button',
          onclick: () => stato.azioni.scegliPiatto(giorno, pasto, p.id) }, [
          fotoPiatto(p, stato, 'mini'),
          el('div', { class: 'testoPasto' }, [
            el('div', { class: 'nomePiatto piccolo' }, p.nome),
            occhiello([M.NOME_TIPO[p.tipo], ...datiPiatto(p, stato)])
          ]),
          amati.has(p.id) ? el('span', { class: 'cuoricino' }, [icona('cuore', 'ti piace')]) : null
        ]));
      }
    }
  });
}
