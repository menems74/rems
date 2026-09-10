/* =========================================================================
   app.js — avvio, seed al primo giro, router a hash e azioni sul menù.
   Le schermate non parlano con il database: chiedono a `stato.azioni`.
   ========================================================================= */

import * as DB from './db.js';
import * as M from './model.js';
import * as P from './planner.js';
import { el, svuotaNodo, avviso } from './ui/dom.js';
import * as Settimana from './ui/week.js';
import * as Catalogo from './ui/catalog.js';
import { chiudiDettaglio } from './ui/dish.js';

const stato = {
  ingredienti: [], piatti: [],
  indiceIngredienti: new Map(), indicePiatti: new Map(),
  preferenze: M.preferenzePredefinite(),
  menu: null,
  voti: {},                 // piattoId -> [voti]
  ultimaVolta: new Map(),   // piattoId -> 'AAAA-MM-GG'
  dispensa: new Set(),
  azioni: {}
};

const ROTTE = {
  settimana: { titolo: 'Settimana', render: (c) => Settimana.render(c, stato) },
  spesa:     { titolo: 'Lista spesa', render: (c) => inArrivo(c, 'M3', 'la lista aggregata e la dispensa') },
  catalogo:  { titolo: 'Catalogo', render: (c) => Catalogo.render(c, stato) },
  gusti:     { titolo: 'Gusti', render: (c) => inArrivo(c, 'M4', 'le liste dei gusti e i voti') },
  altro:     { titolo: 'Altro', render: (c) => inArrivo(c, 'M5-M6', 'nuovi piatti, impostazioni e backup') }
};

function inArrivo(contenitore, milestone, cosa) {
  svuotaNodo(contenitore);
  contenitore.appendChild(el('p', { class: 'vuoto' }, `Qui arriva ${cosa}: milestone ${milestone}.`));
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
    contenitore.appendChild(el('p', { class: 'errore' }, 'Non riesco ad aprire l\'archivio: ' + errore.message));
    return;
  }

  document.getElementById('motore').textContent =
    DB.motoreInUso() === 'indexeddb' ? 'IndexedDB' : 'localStorage';

  stato.azioni = {
    generaSettimana, rigeneraGiorno, bloccaGiorno, cambiaModalita
  };

  window.addEventListener('hashchange', disegna);
  document.getElementById('pannelloChiudi').addEventListener('click', chiudiDettaglio);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiDettaglio(); });
  disegna();
}

async function seedSeServe() {
  const [quantiIngredienti, quantiPiatti] = await Promise.all([
    DB.conta(DB.STORE.ingredienti), DB.conta(DB.STORE.piatti)
  ]);
  if (quantiIngredienti > 0 && quantiPiatti > 0) return;

  const [ingredienti, piatti] = await Promise.all([
    scarica('data/seed-ingredienti.json'), scarica('data/seed-piatti.json')
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
  const [ingredienti, piatti, preferenze, voti, cucinato, dispensa, menu] = await Promise.all([
    DB.leggiTutti(DB.STORE.ingredienti),
    DB.leggiTutti(DB.STORE.piatti),
    DB.leggi(DB.STORE.preferenze, 'preferenze'),
    DB.leggiTutti(DB.STORE.voti),
    DB.leggiTutti(DB.STORE.cucinato),
    DB.leggiTutti(DB.STORE.dispensa),
    DB.leggiTutti(DB.STORE.menu)
  ]);

  stato.ingredienti = ingredienti;
  stato.piatti = piatti;
  stato.indiceIngredienti = M.indicizza(ingredienti);
  stato.indicePiatti = M.indicizza(piatti);
  stato.preferenze = preferenze || M.preferenzePredefinite();

  stato.voti = {};
  for (const v of voti) (stato.voti[v.piattoId] = stato.voti[v.piattoId] || []).push(v);

  // "ultima volta" = il più recente tra ciò che ho cucinato e i menù passati
  stato.ultimaVolta = new Map();
  const segna = (piattoId, data) => {
    if (!piattoId || !data) return;
    const attuale = stato.ultimaVolta.get(piattoId);
    if (!attuale || attuale < data) stato.ultimaVolta.set(piattoId, data);
  };
  for (const c of cucinato) segna(c.piattoId, c.data);
  const oggi = P.iso(new Date());
  for (const m of menu) {
    for (const g of m.giorni || []) {
      if (g.data && g.data <= oggi) for (const id of g.piatti || []) segna(id, g.data);
    }
  }

  stato.dispensa = new Set(dispensa.filter((d) => d.qta > 0).map((d) => d.ingredienteId));

  const lunedi = P.lunediDi(new Date());
  const idSettimana = P.idMenu(lunedi);
  stato.menu = menu.find((m) => m.id === idSettimana) || null;
  // i menù delle settimane passate diventano archiviati
  for (const m of menu) {
    if (m.id !== idSettimana && m.stato === 'attivo') {
      m.stato = 'archiviato';
      await DB.scrivi(DB.STORE.menu, m);
    }
  }
}

/* ---------------------------------------------------------- il contesto -- */

function contesto() {
  return {
    piatti: stato.piatti,
    indiceIngredienti: stato.indiceIngredienti,
    preferenze: stato.preferenze,
    voti: stato.voti,
    ultimaVolta: stato.ultimaVolta,
    dispensa: stato.dispensa,
    mese: M.mesecorrente(),
    oggi: new Date()
  };
}

/** Il menù salvato non porta gli oggetti piatto, solo gli id. */
function perSalvare(menu) {
  return {
    id: menu.id,
    dataInizio: menu.dataInizio,
    stato: menu.stato || 'attivo',
    rilassamenti: menu.rilassamenti || [],
    avvisi: menu.avvisi || [],
    perche: menu.perche || {},
    giorni: (menu.giorni || []).map((g) => ({
      giorno: g.giorno, data: g.data, modalita: g.modalita,
      piatti: g.piatti || [], macroCoperti: g.macroCoperti || [], bloccato: !!g.bloccato
    }))
  };
}

/* ---------------------------------------------------------- le azioni ---- */

async function generaSettimana() {
  const lunedi = P.lunediDi(new Date());
  const ctx = contesto();

  // i giorni bloccati restano come sono
  const fissi = {};
  for (const g of (stato.menu && stato.menu.giorni) || []) {
    if (g.bloccato) {
      fissi[g.giorno] = {
        modalita: g.modalita, piatti: g.piatti, macroCoperti: g.macroCoperti,
        piattiOggetti: (g.piatti || []).map((id) => stato.indicePiatti.get(id)).filter(Boolean),
        data: g.data
      };
    }
  }

  const esito = P.generaSettimana(ctx, { giorniFissi: fissi });
  if (!esito.giorni.length) {
    avviso(esito.avvisi[0] || 'Non riesco a comporre la settimana.', 'errore');
    return;
  }

  const menu = {
    id: P.idMenu(lunedi),
    dataInizio: P.iso(lunedi),
    stato: 'attivo',
    giorni: P.conDate(esito.giorni, lunedi),
    perche: Object.assign({}, (stato.menu && stato.menu.perche) || {}, esito.perche),
    rilassamenti: esito.rilassamenti,
    avvisi: esito.avvisi
  };

  await DB.scrivi(DB.STORE.menu, perSalvare(menu));
  stato.menu = perSalvare(menu);
  avviso('Settimana generata.');
  disegna();
}

async function rigeneraGiorno(giorno) {
  if (!stato.menu) return;
  const riga = stato.menu.giorni.find((g) => g.giorno === giorno);
  if (riga && riga.bloccato) { avviso('Il giorno è bloccato: sbloccalo prima.'); return; }

  const menuConOggetti = Object.assign({}, stato.menu, {
    giorni: stato.menu.giorni.map((g) => Object.assign({}, g, {
      piattiOggetti: (g.piatti || []).map((id) => stato.indicePiatti.get(id)).filter(Boolean)
    }))
  });

  const esito = P.rigeneraGiorno(contesto(), menuConOggetti, giorno);
  if (!esito) { avviso('Nessun piatto disponibile per questo giorno con i vincoli attuali.', 'errore'); return; }

  const nuovo = Object.assign({}, stato.menu);
  nuovo.giorni = nuovo.giorni.map((g) => (g.giorno === giorno ? esito.giorno : g));
  nuovo.perche = Object.assign({}, nuovo.perche || {}, esito.perche);
  nuovo.rilassamenti = esito.rilassamenti.length ? esito.rilassamenti : (nuovo.rilassamenti || []);

  await DB.scrivi(DB.STORE.menu, perSalvare(nuovo));
  stato.menu = perSalvare(nuovo);
  disegna();
}

async function bloccaGiorno(giorno) {
  if (!stato.menu) return;
  const nuovo = Object.assign({}, stato.menu);
  nuovo.giorni = nuovo.giorni.map((g) => (g.giorno === giorno ? Object.assign({}, g, { bloccato: !g.bloccato }) : g));
  await DB.scrivi(DB.STORE.menu, perSalvare(nuovo));
  stato.menu = perSalvare(nuovo);
  disegna();
}

async function cambiaModalita(giorno) {
  if (!stato.menu) return;
  const riga = stato.menu.giorni.find((g) => g.giorno === giorno);
  if (!riga) return;
  if (riga.bloccato) { avviso('Il giorno è bloccato: sbloccalo prima.'); return; }

  const modalita = riga.modalita === 'primoSecondo' ? 'unico' : 'primoSecondo';
  const menuConOggetti = Object.assign({}, stato.menu, {
    giorni: stato.menu.giorni.map((g) => Object.assign({}, g, {
      piattiOggetti: (g.piatti || []).map((id) => stato.indicePiatti.get(id)).filter(Boolean)
    }))
  });

  const esito = P.rigeneraGiorno(contesto(), menuConOggetti, giorno, { modalita });
  if (!esito) { avviso(`Non riesco a comporre un ${modalita === 'unico' ? 'piatto unico' : 'primo + secondo'} per questo giorno.`, 'errore'); return; }

  const nuovo = Object.assign({}, stato.menu);
  nuovo.giorni = nuovo.giorni.map((g) => (g.giorno === giorno ? esito.giorno : g));
  nuovo.perche = Object.assign({}, nuovo.perche || {}, esito.perche);
  await DB.scrivi(DB.STORE.menu, perSalvare(nuovo));
  stato.menu = perSalvare(nuovo);
  disegna();
}

/* ------------------------------------------------------------ router ----- */

function rottaCorrente() {
  const nome = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  return ROTTE[nome] ? nome : 'settimana';
}

function disegna() {
  const nome = rottaCorrente();
  const rotta = ROTTE[nome];
  document.getElementById('titolo').textContent = rotta.titolo;
  for (const link of document.querySelectorAll('nav a')) {
    link.setAttribute('aria-current', link.dataset.rotta === nome ? 'page' : 'false');
  }
  chiudiDettaglio();
  rotta.render(document.getElementById('vista'));
}

avvia();
