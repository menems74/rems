/* =========================================================================
   ui/pick.js — "scegli tu": si prende un piatto dal catalogo e si mette in
   un pasto della settimana, al posto di quello che c'era.

   È la via d'uscita da ogni proposta dell'app: quando si sa già cosa si
   vuole mangiare, non si deve combattere col motore. Il pasto scelto a mano
   resta bloccato, così una rigenerazione non lo porta via.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import * as M from '../model.js';

export function mostraSceltaPiatto(stato, giorno, pasto) {
  const pannello = document.getElementById('pannello');
  const corpo = document.getElementById('pannelloCorpo');
  svuotaNodo(corpo);
  // qui non si vota e non si esclude: i bottoni del piatto non c'entrano
  const testa = document.getElementById('pannelloTesta');
  if (testa) for (const b of testa.querySelectorAll('.gustoTesta')) b.remove();

  corpo.appendChild(el('h2', {}, `${M.NOME_PASTO[pasto]} di ${M.NOME_GIORNO[giorno] || giorno}`));
  corpo.appendChild(el('p', { class: 'nota' },
    'Il piatto che scegli prende il posto di tutto il pasto, e il pasto resta ' +
    'bloccato: rigenerando la settimana non si tocca.'));

  const risultati = el('div', { class: 'scelte' });
  const cerca = el('input', {
    type: 'search', class: 'cercaScelta', placeholder: 'cerca un piatto',
    'aria-label': 'cerca un piatto',
    oninput: () => riempi(risultati, stato, giorno, pasto, cerca.value)
  });
  corpo.appendChild(cerca);
  corpo.appendChild(risultati);
  riempi(risultati, stato, giorno, pasto, '');

  pannello.hidden = false;
  pannello.scrollTop = 0;
  cerca.focus();
}

/** I piatti che si possono davvero mettere in tavola, in ordine di nome. */
function ammessi(stato) {
  const mese = M.mesecorrente();
  return stato.piatti
    .filter((p) => !M.motivoIndisponibilita(p, {
      indiceIngredienti: stato.indiceIngredienti,
      preferenze: stato.preferenze,
      mese
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

function riempi(contenitore, stato, giorno, pasto, testo) {
  svuotaNodo(contenitore);
  const cerca = (testo || '').trim().toLowerCase();
  const tutti = ammessi(stato);
  const trovati = cerca
    ? tutti.filter((p) => p.nome.toLowerCase().includes(cerca))
    : tutti;

  contenitore.appendChild(el('p', { class: 'conteggio' },
    trovati.length === 1 ? 'un piatto' : `${trovati.length} piatti`));

  if (!trovati.length) {
    contenitore.appendChild(el('p', { class: 'vuoto' },
      'Nessun piatto con questo nome. I piatti esclusi e quelli fuori stagione non compaiono qui.'));
    return;
  }

  for (const piatto of trovati) {
    contenitore.appendChild(el('button', {
      class: 'voceScelta', type: 'button',
      onclick: () => stato.azioni.scegliPiatto(giorno, pasto, piatto.id)
    }, [
      el('span', { class: 'nomeScelta' }, piatto.nome),
      el('span', { class: 'datiScelta' },
         `${M.NOME_TIPO[piatto.tipo] || piatto.tipo} · ${M.formattaTempo(piatto.tempoMin)}`)
    ]));
  }
}
