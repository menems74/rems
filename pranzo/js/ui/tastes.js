/* =========================================================================
   ui/tastes.js — schermata Gusti.
   In alto i suggerimenti pendenti (da confermare uno per uno), poi le
   quattro liste con ricerca, in fondo lo storico dei voti.
   Le liste cambiano solo per un gesto dell'utente: mai da sole.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import * as M from '../model.js';
import * as G from '../tastes.js';
import { mostraDettaglio } from './dish.js';

/* Il testo cercato resta tra un disegno e l'altro, una casella per lista. */
const ricerca = { amoPiatti: '', escludiPiatti: '', amoIngredienti: '', escludiIngredienti: '' };

export function render(contenitore, stato) {
  svuotaNodo(contenitore);

  const pendenti = (stato.suggerimenti || []).filter((s) => s.stato === 'pendente');
  if (pendenti.length) contenitore.appendChild(bloccoSuggerimenti(pendenti, stato));

  for (const lista of Object.keys(G.LISTE)) {
    contenitore.appendChild(bloccoLista(lista, stato));
  }

  contenitore.appendChild(bloccoVoti(stato));
}

/* ------------------------------------------------------- suggerimenti ---- */

function bloccoSuggerimenti(pendenti, stato) {
  const blocco = el('section', { class: 'gruppoGusti proposte' });
  blocco.appendChild(el('h2', { class: 'titoloGusti' }, [
    el('span', {}, 'Ho notato una cosa'),
    el('span', { class: 'quanti num' }, String(pendenti.length))
  ]));

  for (const s of pendenti) {
    const nomiPiatti = (s.piattiIds || [])
      .map((id) => (stato.indicePiatti.get(id) || {}).nome)
      .filter(Boolean);

    blocco.appendChild(el('div', { class: 'proposta' }, [
      el('p', { class: 'testoProposta' }, s.testo),
      el('p', { class: 'conteggio' },
        `media ${String(s.media).replace('.', ',')} su ${s.quantiPiatti} piatti votati` +
        (nomiPiatti.length ? ': ' + nomiPiatti.join(', ') : '')),
      el('div', { class: 'azioniProposta' }, [
        el('button', {
          class: 'testuale acceso', type: 'button',
          onclick: () => stato.azioni.confermaSuggerimento(s.id)
        }, s.tipo === 'escludi' ? 'sì, escludilo' : 'sì, aggiungilo ai preferiti'),
        el('button', {
          class: 'testuale', type: 'button',
          onclick: () => stato.azioni.scartaSuggerimento(s.id)
        }, 'no, lascia così')
      ])
    ]));
  }
  return blocco;
}

/* ----------------------------------------------------------- le liste ---- */

function bloccoLista(lista, stato) {
  const info = G.LISTE[lista];
  const ids = stato.preferenze[lista] || [];
  const blocco = el('section', { class: 'gruppoGusti' });

  blocco.appendChild(el('h2', { class: 'titoloGusti' }, [
    el('span', {}, info.titolo),
    el('span', { class: 'quanti num' }, String(ids.length))
  ]));

  if (!ids.length) {
    blocco.appendChild(el('p', { class: 'conteggio' }, 'niente qui, per ora'));
  } else {
    const elenco = el('div', { class: 'elencoGusti' });
    for (const id of ids) elenco.appendChild(rigaGusto(lista, id, stato));
    blocco.appendChild(elenco);
  }

  blocco.appendChild(cerca(lista, stato));
  if (lista === 'escludiIngredienti' && ids.length) {
    blocco.appendChild(el('p', { class: 'nota' },
      `${quantiPiattiEsclusi(stato)} piatti restano fuori dal menù per questi ingredienti.`));
  }
  return blocco;
}

function quantiPiattiEsclusi(stato) {
  const esclusi = new Set(stato.preferenze.escludiIngredienti || []);
  return stato.piatti.filter((p) =>
    (p.ingredienti || []).some((v) => esclusi.has(v.ingredienteId))).length;
}

function rigaGusto(lista, id, stato) {
  const cosa = G.LISTE[lista].cosa;
  const oggetto = cosa === 'piatti' ? stato.indicePiatti.get(id) : stato.indiceIngredienti.get(id);
  const nome = oggetto ? oggetto.nome : id;

  const etichetta = cosa === 'piatti' && oggetto
    ? el('button', {
        class: 'nomeGusto collegato', type: 'button',
        onclick: () => mostraDettaglio(oggetto, stato, null)
      }, nome)
    : el('span', { class: 'nomeGusto' }, nome);

  return el('div', { class: 'rigaGusto' }, [
    etichetta,
    el('button', {
      class: 'testuale', type: 'button',
      onclick: () => stato.azioni.togliGusto(lista, id)
    }, 'toglie')
  ]);
}

/** Ricerca con risultati sotto: niente tendine, si legge e si tocca. */
function cerca(lista, stato) {
  const cosa = G.LISTE[lista].cosa;
  const zona = el('div', { class: 'cercaGusti' });

  const risultati = el('div', { class: 'risultatiGusti' });
  const campo = el('input', {
    type: 'search', value: ricerca[lista],
    placeholder: cosa === 'piatti' ? 'cerca un piatto da aggiungere' : 'cerca un ingrediente da aggiungere',
    'aria-label': 'Aggiungi a: ' + G.LISTE[lista].titolo,
    oninput: (e) => { ricerca[lista] = e.target.value; disegnaRisultati(risultati, lista, stato); }
  });

  zona.appendChild(campo);
  zona.appendChild(risultati);
  disegnaRisultati(risultati, lista, stato);
  return zona;
}

function disegnaRisultati(nodo, lista, stato) {
  svuotaNodo(nodo);
  const testo = (ricerca[lista] || '').trim().toLowerCase();
  if (testo.length < 2) return;

  const cosa = G.LISTE[lista].cosa;
  const giaDentro = new Set(stato.preferenze[lista] || []);
  const sorgente = cosa === 'piatti' ? stato.piatti : stato.ingredienti;

  const trovati = sorgente
    .filter((x) => x.nome.toLowerCase().includes(testo) && !giaDentro.has(x.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    .slice(0, 6);

  if (!trovati.length) {
    nodo.appendChild(el('p', { class: 'conteggio' }, 'nessun risultato'));
    return;
  }

  for (const x of trovati) {
    nodo.appendChild(el('button', {
      class: 'risultatoGusti', type: 'button',
      onclick: () => { ricerca[lista] = ''; stato.azioni.aggiungiGusto(lista, x.id); }
    }, [
      el('span', {}, x.nome),
      el('span', { class: 'piu num' }, '+')
    ]));
  }
}

/* -------------------------------------------------------------- i voti --- */

function bloccoVoti(stato) {
  const tutti = [];
  for (const [piattoId, voti] of Object.entries(stato.voti || {})) {
    for (const v of voti) tutti.push(v);
  }
  tutti.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const blocco = el('section', { class: 'gruppoGusti' });
  blocco.appendChild(el('h2', { class: 'titoloGusti' }, [
    el('span', {}, 'Voti'),
    el('span', { class: 'quanti num' }, String(tutti.length))
  ]));

  if (!tutti.length) {
    blocco.appendChild(el('p', { class: 'conteggio' },
      'Nessun voto. Apri un piatto e dagli le stelle dopo averlo cucinato: ' +
      'da tre piatti votati comincio a capire gli ingredienti.'));
    return blocco;
  }

  const elenco = el('div', { class: 'elencoGusti' });
  for (const v of tutti.slice(0, 30)) {
    const piatto = stato.indicePiatti.get(v.piattoId);
    elenco.appendChild(el('div', { class: 'rigaVoto' }, [
      el('button', {
        class: 'nomeGusto collegato', type: 'button', disabled: piatto ? null : 'disabled',
        onclick: () => piatto && mostraDettaglio(piatto, stato, null)
      }, piatto ? piatto.nome : v.piattoId),
      el('span', { class: 'stelleVoto num' }, G.stelle(v.stelle)),
      el('span', { class: 'conteggio datoVoto' },
        [G.dataBreve(v.data), G.ETICHETTA_MOTIVO[v.motivo] || v.motivo].filter(Boolean).join(' · ')),
      el('button', {
        class: 'testuale', type: 'button',
        onclick: () => stato.azioni.eliminaVoto(v.id)
      }, 'toglie')
    ]));
  }
  blocco.appendChild(elenco);
  return blocco;
}
