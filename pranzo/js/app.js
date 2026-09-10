/* =========================================================================
   app.js — avvio dell'app, seed al primo giro, router a hash.
   In M1 è implementato il Catalogo; le altre voci esistono ma dichiarano
   in che milestone arrivano, così si vede subito dove siamo.
   ========================================================================= */

import * as DB from './db.js';
import * as M from './model.js';
import { el, svuotaNodo, avviso } from './ui/dom.js';
import * as Catalogo from './ui/catalog.js';
import { chiudiDettaglio } from './ui/dish.js';

const stato = {
  ingredienti: [],
  piatti: [],
  indiceIngredienti: new Map(),
  preferenze: M.preferenzePredefinite()
};

const ROTTE = {
  settimana: { titolo: 'Settimana', render: (c) => inArrivo(c, 'M2', 'la settimana con i pranzi generati') },
  spesa:     { titolo: 'Lista spesa', render: (c) => inArrivo(c, 'M3', 'la lista aggregata e la dispensa') },
  catalogo:  { titolo: 'Catalogo', render: (c) => Catalogo.render(c, stato) },
  gusti:     { titolo: 'Gusti', render: (c) => inArrivo(c, 'M4', 'liste dei gusti e voti') },
  altro:     { titolo: 'Altro', render: (c) => inArrivo(c, 'M5-M6', 'nuovi piatti, dispensa, impostazioni, backup') }
};

function inArrivo(contenitore, milestone, cosa) {
  svuotaNodo(contenitore);
  contenitore.appendChild(el('p', { class: 'vuoto' },
    `Qui arriva ${cosa}: milestone ${milestone}.`));
}

/* ------------------------------------------------------------- avvio ----- */

async function avvia() {
  const contenitore = document.getElementById('vista');
  try {
    await DB.apri();
    await seedSeServe();
    await caricaStato();
  } catch (errore) {
    console.error(errore);
    svuotaNodo(contenitore);
    contenitore.appendChild(el('p', { class: 'motivo' },
      'Non riesco ad aprire l\'archivio: ' + errore.message));
    return;
  }

  document.getElementById('motore').textContent =
    DB.motoreInUso() === 'indexeddb' ? 'IndexedDB' : 'localStorage (ripiego)';

  window.addEventListener('hashchange', disegna);
  document.getElementById('pannelloChiudi').addEventListener('click', chiudiDettaglio);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiDettaglio(); });
  disegna();
}

/**
 * Primo avvio: carica i due file di seed, li valida e li scrive in una sola
 * transazione. Se un file è malformato non si scrive niente: meglio un
 * catalogo vuoto con un errore chiaro che un database a metà.
 */
async function seedSeServe() {
  const quantiIngredienti = await DB.conta(DB.STORE.ingredienti);
  const quantiPiatti = await DB.conta(DB.STORE.piatti);
  if (quantiIngredienti > 0 && quantiPiatti > 0) return;

  const [ingredienti, piatti] = await Promise.all([
    scarica('data/seed-ingredienti.json'),
    scarica('data/seed-piatti.json')
  ]);

  const indice = M.indicizza(ingredienti);
  const errori = [];
  ingredienti.forEach((x, i) => {
    const v = M.validaIngrediente(x);
    if (!v.ok) errori.push(`ingrediente #${i} ${x && x.id}: ${v.errori.join('; ')}`);
  });
  piatti.forEach((x, i) => {
    const v = M.validaPiatto(x, indice);
    if (!v.ok) errori.push(`piatto #${i} ${x && x.id}: ${v.errori.join('; ')}`);
  });
  if (errori.length) throw new Error('dati iniziali non validi:\n' + errori.slice(0, 5).join('\n'));

  await DB.transazione([DB.STORE.ingredienti, DB.STORE.piatti, DB.STORE.preferenze], 'readwrite',
    async (stores) => {
      for (const x of ingredienti) await stores[DB.STORE.ingredienti].scrivi(x);
      for (const x of piatti) await stores[DB.STORE.piatti].scrivi(x);
      const pref = await stores[DB.STORE.preferenze].leggi('preferenze');
      if (!pref) await stores[DB.STORE.preferenze].scrivi(M.preferenzePredefinite());
    });

  avviso(`Catalogo caricato: ${piatti.length} piatti, ${ingredienti.length} ingredienti.`);
}

async function scarica(percorso) {
  const risposta = await fetch(percorso, { cache: 'no-cache' });
  if (!risposta.ok) throw new Error(`${percorso}: HTTP ${risposta.status}`);
  return risposta.json();
}

async function caricaStato() {
  const [ingredienti, piatti, preferenze] = await Promise.all([
    DB.leggiTutti(DB.STORE.ingredienti),
    DB.leggiTutti(DB.STORE.piatti),
    DB.leggi(DB.STORE.preferenze, 'preferenze')
  ]);
  stato.ingredienti = ingredienti;
  stato.piatti = piatti;
  stato.indiceIngredienti = M.indicizza(ingredienti);
  stato.preferenze = preferenze || M.preferenzePredefinite();
}

/* ------------------------------------------------------------ router ----- */

function rottaCorrente() {
  const nome = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  return ROTTE[nome] ? nome : 'catalogo';
}

function disegna() {
  const nome = rottaCorrente();
  const rotta = ROTTE[nome];
  document.getElementById('titolo').textContent = rotta.titolo;
  for (const link of document.querySelectorAll('nav a')) {
    const attiva = link.dataset.rotta === nome;
    link.setAttribute('aria-current', attiva ? 'page' : 'false');
  }
  chiudiDettaglio();
  rotta.render(document.getElementById('vista'));
}

avvia();
