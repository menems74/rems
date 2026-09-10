/* =========================================================================
   app.js — avvio, seed al primo giro, router a hash e azioni sul menù.
   Le schermate non parlano con il database: chiedono a `stato.azioni`.
   ========================================================================= */

import * as DB from './db.js';
import * as M from './model.js';
import * as P from './planner.js';
import { el, svuotaNodo, avviso } from './ui/dom.js';
import * as S from './shopping.js';
import * as Casa from './ui/home.js';
import * as Settimana from './ui/week.js';
import * as Catalogo from './ui/catalog.js';
import * as Spesa from './ui/shopping.js';
import * as Dispensa from './ui/pantry.js';
import * as Gusti from './ui/tastes.js';
import * as Nuovi from './ui/import.js';
import * as Impostazioni from './ui/settings.js';
import * as B from './backup.js';
import * as G from './tastes.js';
import { mostraDettaglio, chiudiDettaglio } from './ui/dish.js';

const stato = {
  ingredienti: [], piatti: [],
  indiceIngredienti: new Map(), indicePiatti: new Map(),
  preferenze: M.preferenzePredefinite(),
  menu: null,
  voti: {},                 // piattoId -> [voti]
  ultimaVolta: new Map(),   // piattoId -> 'AAAA-MM-GG'
  dispensa: new Set(),      // ingredienti presenti, per il punteggio
  dispensaMappa: new Map(), // ingredienteId -> qta
  dispensaRighe: [],
  suggerimenti: [],       // proposte sugli ingredienti, da confermare
  lista: null,
  azioni: {}
};

const ROTTE = {
  casa:      { titolo: 'Pranzo 2.0', render: (c) => Casa.render(c, stato) },
  settimana: { titolo: 'Settimana', render: (c) => Settimana.render(c, stato) },
  spesa:     { titolo: 'Lista spesa', render: (c) => Spesa.render(c, stato) },
  catalogo:  { titolo: 'Catalogo', render: (c) => Catalogo.render(c, stato) },
  gusti:     { titolo: 'Gusti', render: (c) => Gusti.render(c, stato) },
  dispensa:  { titolo: 'Dispensa', render: (c) => Dispensa.render(c, stato) },
  nuovi:     { titolo: 'Nuovi piatti', render: (c) => Nuovi.render(c, stato) },
  impostazioni: { titolo: 'Impostazioni', render: (c) => Impostazioni.render(c, stato) },
  altro:     { titolo: 'Altro', render: (c) => altro(c) }
};

function inArrivo(contenitore, milestone, cosa) {
  svuotaNodo(contenitore);
  contenitore.appendChild(el('p', { class: 'vuoto' }, `Qui arriva ${cosa}: milestone ${milestone}.`));
}

/** "Altro" raccoglie le sezioni che non stanno nella barra in basso. */
function altro(contenitore) {
  svuotaNodo(contenitore);
  const voci = [
    { testo: 'Dispensa', nota: 'quello che hai in casa', href: '#/dispensa' },
    { testo: 'Gusti', nota: 'liste, voti e suggerimenti', href: '#/gusti' },
    { testo: 'Nuovi piatti', nota: 'farsi aiutare da un\'AI', href: '#/nuovi' },
    { testo: 'Impostazioni e backup', nota: 'pranzi, spesa, aspetto, backup', href: '#/impostazioni' }
  ];
  if (Impostazioni.siPuoInstallare()) {
    voci.unshift({ testo: 'Installa sul telefono', nota: 'diventa un\'icona, funziona offline',
                   href: '#/impostazioni' });
  }

  const elenco = el('div', { class: 'elencoAltro' });
  for (const v of voci) {
    elenco.appendChild(v.href
      ? el('a', { class: 'vociAltro', href: v.href }, [
          el('span', {}, v.testo), el('span', { class: 'nota' }, v.nota)])
      : el('span', { class: 'vociAltro spento' }, [
          el('span', {}, v.testo), el('span', { class: 'nota' }, v.nota)]));
  }
  contenitore.appendChild(elenco);
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
    generaSettimana, rigeneraGiorno, bloccaGiorno, cambiaModalita,
    generaLista, segnaComprato, segnaInCasa, aggiungiLibera, togliLibera,
    salvaDispensa, cucinato,
    salvaVoto, eliminaVoto, aggiungiGusto, togliGusto,
    confermaSuggerimento, scartaSuggerimento, importaPiatto,
    salvaPreferenze, ricarica
  };

  applicaTema(stato.preferenze.tema);
  window.addEventListener('hashchange', disegna);
  document.getElementById('pannelloChiudi').addEventListener('click', chiudiDettaglio);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiDettaglio(); });
  disegna();

  // dopo il primo disegno, così non rallentano l'avvio
  registraServiceWorker();
  B.istantaneaSeServe().catch((e) => console.warn('istantanea non fatta:', e.message));
}

/** Il tema: 'chiaro', 'scuro' o 'auto' (come il telefono). */
function applicaTema(tema) {
  const scelto = ['chiaro', 'scuro', 'auto'].includes(tema) ? tema : 'chiaro';
  const radice = document.documentElement;
  radice.dataset.tema = scelto;
  const scuro = scelto === 'scuro' ||
    (scelto === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  radice.style.colorScheme = scuro ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', scuro ? '#15171a' : '#f6f6f3');
  // copia per il primo disegno al prossimo avvio: evita il lampo di bianco
  try { localStorage.setItem('pranzo.tema', scelto); } catch (e) { /* pazienza */ }
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((stato.preferenze.tema || 'chiaro') === 'auto') applicaTema('auto');
  });
}

function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js')
    .catch((errore) => console.warn('service worker non registrato:', errore.message));
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

  const oggi = P.iso(new Date());
  await DB.transazione([DB.STORE.ingredienti, DB.STORE.piatti, DB.STORE.preferenze, DB.STORE.dispensa],
    'readwrite', async (stores) => {
      for (const x of ingredienti) await stores[DB.STORE.ingredienti].scrivi(x);
      for (const x of piatti) await stores[DB.STORE.piatti].scrivi(x);
      const pref = await stores[DB.STORE.preferenze].leggi('preferenze');
      if (!pref) await stores[DB.STORE.preferenze].scrivi(M.preferenzePredefinite());
      // sale, olio, spezie: si danno per presenti, o la prima lista è assurda
      for (const x of ingredienti) {
        if (!x.dispensaBase) continue;
        await stores[DB.STORE.dispensa].scrivi({
          ingredienteId: x.id, qta: x.formatoAcquisto.qta, unita: x.unita, aggiornato: oggi
        });
      }
    });

  avviso(`Catalogo caricato: ${piatti.length} piatti, ${ingredienti.length} ingredienti.`);
}

async function scarica(percorso) {
  const risposta = await fetch(percorso, { cache: 'no-cache' });
  if (!risposta.ok) throw new Error(`${percorso}: HTTP ${risposta.status}`);
  return risposta.json();
}

async function caricaStato() {
  const [ingredienti, piatti, preferenze, voti, cucinato, dispensa, menu, suggerimenti] = await Promise.all([
    DB.leggiTutti(DB.STORE.ingredienti),
    DB.leggiTutti(DB.STORE.piatti),
    DB.leggi(DB.STORE.preferenze, 'preferenze'),
    DB.leggiTutti(DB.STORE.voti),
    DB.leggiTutti(DB.STORE.cucinato),
    DB.leggiTutti(DB.STORE.dispensa),
    DB.leggiTutti(DB.STORE.menu),
    DB.leggiTutti(DB.STORE.suggerimenti)
  ]);

  stato.ingredienti = ingredienti;
  stato.piatti = piatti;
  stato.indiceIngredienti = M.indicizza(ingredienti);
  stato.indicePiatti = M.indicizza(piatti);
  stato.preferenze = preferenze || M.preferenzePredefinite();

  stato.voti = {};
  for (const v of voti) (stato.voti[v.piattoId] = stato.voti[v.piattoId] || []).push(v);

  stato.suggerimenti = suggerimenti.sort((a, b) => (a.data || '').localeCompare(b.data || ''));

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

  stato.dispensaRighe = dispensa.filter((d) => d.qta > 0);
  stato.dispensaMappa = new Map(stato.dispensaRighe.map((d) => [d.ingredienteId, d.qta]));
  stato.dispensa = new Set(stato.dispensaMappa.keys());

  const lunedi = P.lunediDi(new Date());
  const idSettimana = P.idMenu(lunedi);
  stato.menu = menu.find((m) => m.id === idSettimana) || null;
  stato.lista = stato.menu ? (await DB.leggi(DB.STORE.listeSpesa, stato.menu.id)) || null : null;
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

/* ------------------------------------------------- lista della spesa ----- */

function contestoSpesa() {
  return {
    indicePiatti: stato.indicePiatti,
    indiceIngredienti: stato.indiceIngredienti,
    dispensa: stato.dispensaMappa,
    porzioni: stato.preferenze.porzioni || 1,
    ordineReparti: stato.preferenze.ordineReparti || M.REPARTI
  };
}

/** Ricalcola la lista senza perdere le spunte già fatte. */
async function generaLista() {
  if (!stato.menu) { avviso('Prima genera la settimana.', 'errore'); return; }
  const nuova = S.generaLista(stato.menu, contestoSpesa(), stato.lista);
  await DB.scrivi(DB.STORE.listeSpesa, nuova);
  stato.lista = nuova;
  avviso(`Lista pronta: ${nuova.voci.length} voci.`);
  disegna();
}

async function salvaLista() {
  if (!stato.lista) return;
  await DB.scrivi(DB.STORE.listeSpesa, stato.lista);
}

async function segnaComprato(chiave) {
  if (!stato.lista) return;
  S.segnaComprato(stato.lista, chiave);
  await salvaLista();
  disegna();
}

/** "Ce l'ho già": esce dalla lista ed entra in dispensa con la quantità che serviva. */
async function segnaInCasa(ingredienteId) {
  if (!stato.lista) return;
  const aggiornamento = S.segnaInCasa(stato.lista, ingredienteId);
  await salvaLista();
  if (aggiornamento) await scriviDispensa(aggiornamento.ingredienteId, aggiornamento.qta);
  await caricaStato();
  disegna();
}

async function aggiungiLibera(testo) {
  if (!stato.lista) return;
  S.aggiungiVoceLibera(stato.lista, testo);
  await salvaLista();
  disegna();
}

async function togliLibera(id) {
  if (!stato.lista) return;
  S.togliVoceLibera(stato.lista, id);
  await salvaLista();
  disegna();
}

/* ------------------------------------------------------------ dispensa --- */

async function scriviDispensa(ingredienteId, qta) {
  const ing = stato.indiceIngredienti.get(ingredienteId);
  if (!ing) return;
  if (!qta || qta <= 0) {
    await DB.elimina(DB.STORE.dispensa, ingredienteId);
  } else {
    await DB.scrivi(DB.STORE.dispensa, {
      ingredienteId, qta: Math.round(qta * 100) / 100, unita: ing.unita, aggiornato: P.iso(new Date())
    });
  }
}

async function salvaDispensa(ingredienteId, qta) {
  await scriviDispensa(ingredienteId, qta);
  await caricaStato();
  disegna();
}

/** Cucinato: registra la data e scala solo ciò che l'utente ha confermato. */
async function cucinato(piattoId, scarichi) {
  const oggi = P.iso(new Date());
  await DB.scrivi(DB.STORE.cucinato, { id: `cuc_${piattoId}_${oggi}`, piattoId, data: oggi });
  for (const riga of scarichi || []) {
    await scriviDispensa(riga.ingredienteId, riga.restante);
  }
  await caricaStato();
  avviso(scarichi && scarichi.length
    ? `Segnato come cucinato, dispensa aggiornata su ${scarichi.length} ingredienti.`
    : 'Segnato come cucinato.');
  chiudiDettaglio();
  disegna();
}

/* -------------------------------------------------------------- gusti ----
   Voti, liste e suggerimenti. Le liste dei gusti cambiano solo qui, e solo
   per un gesto dell'utente: nessuna funzione le tocca da sola.            */

/**
 * Dopo un voto ricalcola le proposte sugli ingredienti e salva quelle nuove.
 * @returns quante proposte nuove sono comparse
 */
async function aggiornaSuggerimenti() {
  const nuovi = G.suggerimentiDaVoti(contesto(), stato.suggerimenti);
  for (const s of nuovi) await DB.scrivi(DB.STORE.suggerimenti, s);
  stato.suggerimenti = stato.suggerimenti.concat(nuovi);
  return nuovi.length;
}

async function salvaVoto(piattoId, bozza) {
  let voto;
  try {
    voto = G.nuovoVoto({ piattoId, stelle: bozza.stelle, motivo: bozza.motivo, note: bozza.note });
  } catch (errore) {
    avviso(errore.message, 'errore');
    return;
  }
  await DB.scrivi(DB.STORE.voti, voto);
  await caricaStato();
  const nuovi = await aggiornaSuggerimenti();

  const piatto = stato.indicePiatti.get(piattoId);
  avviso(`Voto salvato: ${bozza.stelle} su 5 a ${piatto ? piatto.nome : piattoId}.` +
         (nuovi ? ' Ho notato una cosa: guarda in Gusti.' : ''));
  disegna();

  // con un voto basso il pannello resta aperto: c'è una domanda da fare,
  // ossia se il piatto va tolto dalle proposte per davvero
  const basso = bozza.stelle <= 2 && bozza.motivo !== 'troppoLungo';
  if (basso && piatto) mostraDettaglio(piatto, stato, null);
}

async function eliminaVoto(votoId) {
  await DB.elimina(DB.STORE.voti, votoId);
  await caricaStato();
  avviso('Voto eliminato.');
  chiudiDettaglio();
  disegna();
}

async function aggiungiGusto(lista, id) {
  // salvaPreferenze salva, applica il tema e ridisegna: qui basta il messaggio
  await salvaPreferenze(G.aggiungiAllaLista(stato.preferenze, lista, id));
  avviso(messaggioGusto(lista, id, true));
}

async function togliGusto(lista, id) {
  await salvaPreferenze(G.togliDallaLista(stato.preferenze, lista, id));
  avviso(messaggioGusto(lista, id, false));
}

function messaggioGusto(lista, id, aggiunto) {
  const cosa = G.LISTE[lista].cosa === 'piatti'
    ? (stato.indicePiatti.get(id) || {}).nome
    : (stato.indiceIngredienti.get(id) || {}).nome;
  const nome = cosa || id;
  if (!aggiunto) return `${nome} non è più in "${G.LISTE[lista].titolo.toLowerCase()}".`;
  if (lista === 'escludiPiatti') return `${nome}: non te lo propongo più.`;
  if (lista === 'escludiIngredienti') {
    const quanti = stato.piatti.filter((p) =>
      (p.ingredienti || []).some((v) => v.ingredienteId === id)).length;
    return `${nome} escluso: ${quanti} piatti restano fuori dal menù.`;
  }
  return `${nome} è in "${G.LISTE[lista].titolo.toLowerCase()}".`;
}

async function confermaSuggerimento(id) {
  const sugg = stato.suggerimenti.find((s) => s.id === id);
  if (!sugg) return;
  const nuove = G.applicaSuggerimento(stato.preferenze, sugg);
  const registrato = Object.assign({}, sugg, { stato: 'accettato', deciso: P.iso(new Date()) });
  await DB.transazione([DB.STORE.preferenze, DB.STORE.suggerimenti], 'readwrite', async (stores) => {
    await stores[DB.STORE.preferenze].scrivi(nuove);
    await stores[DB.STORE.suggerimenti].scrivi(registrato);
  });
  stato.preferenze = nuove;
  stato.suggerimenti = stato.suggerimenti.map((s) => (s.id === id ? registrato : s));
  avviso(messaggioGusto(sugg.lista, sugg.ingredienteId, true));
  disegna();
}

async function scartaSuggerimento(id) {
  const sugg = stato.suggerimenti.find((s) => s.id === id);
  if (!sugg) return;
  const registrato = Object.assign({}, sugg, { stato: 'scartato', deciso: P.iso(new Date()) });
  await DB.scrivi(DB.STORE.suggerimenti, registrato);
  stato.suggerimenti = stato.suggerimenti.map((s) => (s.id === id ? registrato : s));
  avviso('Va bene, non te lo chiedo più.');
  disegna();
}

/* ------------------------------------------------------- nuovi piatti ----
   L'importazione è già stata validata dalla schermata: qui si scrive, e si
   scrive tutto insieme — o entra il piatto con i suoi ingredienti nuovi, o
   non entra niente.                                                       */

async function importaPiatto(piatto, ingredientiNuovi) {
  try {
    await DB.transazione([DB.STORE.ingredienti, DB.STORE.piatti], 'readwrite', async (stores) => {
      for (const ing of ingredientiNuovi || []) await stores[DB.STORE.ingredienti].scrivi(ing);
      await stores[DB.STORE.piatti].scrivi(piatto);
    });
  } catch (errore) {
    console.error(errore);
    avviso('Non riesco a salvare il piatto: ' + errore.message, 'errore');
    return false;
  }
  await caricaStato();
  const quanti = (ingredientiNuovi || []).length;
  avviso(`"${piatto.nome}" è in catalogo` + (quanti
    ? `, con ${quanti === 1 ? 'un ingrediente nuovo' : quanti + ' ingredienti nuovi'}.`
    : '.'));
  disegna();
  return true;
}

/* ------------------------------------------------------ impostazioni ----- */

async function salvaPreferenze(nuove) {
  stato.preferenze = nuove;
  await DB.scrivi(DB.STORE.preferenze, nuove);
  applicaTema(nuove.tema);
  disegna();
}

/** Ricarica tutto dall'archivio: serve dopo un import o un ripristino. */
async function ricarica() {
  await caricaStato();
  applicaTema(stato.preferenze.tema);
  disegna();
}

/* ------------------------------------------------------------ router ----- */

function rottaCorrente() {
  const nome = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  return ROTTE[nome] ? nome : 'casa';
}

let rottaDisegnata = null;

/**
 * Ridisegna la schermata corrente.
 *
 * Il punto delicato è lo scorrimento: svuotare la vista fa accorciare la
 * pagina, il browser riporta la barra in cima e quando il contenuto torna
 * sei rimasto in alto. Fastidioso se stavi compilando in fondo o spuntando
 * la spesa. Quindi: cambiando sezione si parte dall'inizio, restando nella
 * stessa si torna esattamente dov'eri.
 */
function disegna() {
  const nome = rottaCorrente();
  const rotta = ROTTE[nome];
  const stessaSezione = nome === rottaDisegnata;
  const scorrimento = stessaSezione ? window.scrollY : 0;

  document.getElementById('titolo').textContent = rotta.titolo;
  const sottoAltro = ['dispensa', 'nuovi', 'impostazioni', 'gusti'];
  const attiva = sottoAltro.includes(nome) ? 'altro' : nome;
  for (const link of document.querySelectorAll('.barra a')) {
    link.setAttribute('aria-current', link.dataset.rotta === attiva ? 'page' : 'false');
  }
  chiudiDettaglio();
  rotta.render(document.getElementById('vista'));

  rottaDisegnata = nome;
  window.scrollTo(0, scorrimento);
}

avvia();
