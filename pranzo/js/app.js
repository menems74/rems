/* =========================================================================
   app.js — avvio, catalogo, router a hash e azioni.
   Le schermate non parlano con il database: chiedono a `stato.azioni`.
   Ogni volta che il menù cambia, la lista della spesa si rifà da sola
   (le spunte restano).
   ========================================================================= */

import * as DB from './db.js';
import * as M from './model.js';
import * as P from './planner.js';
import * as S from './shopping.js';
import * as F from './photo.js';
import { el, svuotaNodo, avviso } from './ui/dom.js';
import { icona } from './ui/icone.js';
import { chiudiFoglio, foglioAperto } from './ui/comuni.js';
import { mostraPiatto } from './ui/piatto.js';
import { mostraGiorno } from './ui/giorno.js';
import * as Casa from './ui/home.js';
import * as Spesa from './ui/spesa.js';
import * as Piatti from './ui/piatti.js';
import * as Nuovi from './ui/import.js';
import * as Impostazioni from './ui/impostazioni.js';

const stato = {
  ingredienti: [], piatti: [],
  indiceIngredienti: new Map(), indicePiatti: new Map(),
  preferenze: M.preferenzePredefinite(),
  menu: null,              // la settimana che si sta guardando
  lista: null,             // la sua lista della spesa
  scarto: 0,               // 0 = questa settimana, 1 = la prossima
  oggiChiave: P.chiaveGiorno(new Date()),
  ultimaVolta: new Map(),  // piattoId -> 'AAAA-MM-GG'
  fotoDi: new Set(),       // piatti che hanno una foto (le immagini si leggono a richiesta)
  azioni: {}
};

const ROTTE = {
  casa: (c) => Casa.render(c, stato),
  spesa: (c) => Spesa.render(c, stato),
  piatti: (c) => Piatti.render(c, stato),
  nuovi: (c) => paginaNuovi(c),
  impostazioni: (c) => Impostazioni.render(c, stato)
};
/* La voce della barra accesa per ogni pagina: nuovi piatti sta sotto Piatti. */
const VOCE_BARRA = { casa: 'casa', spesa: 'spesa', piatti: 'piatti', nuovi: 'piatti', impostazioni: null };

/* ------------------------------------------------------------- avvio ----- */

async function avvia() {
  disegnaIconeBarra();
  const contenitore = document.getElementById('vista');
  try {
    await DB.apri();
    await aggiornaCatalogo();
    await caricaStato();
    await passaAllaTre();
  } catch (errore) {
    console.error(errore);
    svuotaNodo(contenitore);
    contenitore.appendChild(el('p', { class: 'errore' }, 'Non riesco ad aprire l\'archivio: ' + errore.message));
    return;
  }

  stato.azioni = {
    generaSettimana, cambiaSettimana, rigeneraPasto, rigeneraGiorno, cambiaContorno,
    scegliPiatto, impostaTempo, cuore, escludi,
    segnaComprato, segnaInCasa, aggiungiLibera, togliLibera, copiaLista,
    importaPiatto, salvaPreferenze, ricarica, ridisegna: disegna
  };
  // le foto stanno in IndexedDB come immagini vere: col ripiego su
  // localStorage non si possono tenere, e allora non si promettono
  if (DB.motoreInUso() === 'indexeddb') Object.assign(stato.azioni, { urlFoto, salvaFoto, togliFoto });

  applicaTema(stato.preferenze.tema);
  window.addEventListener('hashchange', () => { chiudiFoglio(true); disegna(); });
  window.addEventListener('popstate', () => { if (foglioAperto()) chiudiFoglio(true); });
  document.getElementById('foglioChiudi').appendChild(icona('chiudi'));
  document.getElementById('foglioChiudi').addEventListener('click', () => chiudiFoglio());
  document.getElementById('foglioVelo').addEventListener('click', () => chiudiFoglio());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiFoglio(); });

  // la prima volta che si apre, la settimana c'è già: niente pagina vuota
  if (!stato.menu && stato.scarto === 0) await generaSettimana({ silenzioso: true });
  disegna();
  registraServiceWorker();
}

function disegnaIconeBarra() {
  for (const posto of document.querySelectorAll('.iconaBarra')) posto.appendChild(icona(posto.dataset.icona));
}

/** Il tema: 'chiaro', 'scuro' o 'auto' (come il telefono). */
function applicaTema(tema) {
  const scelto = ['chiaro', 'scuro', 'auto'].includes(tema) ? tema : 'auto';
  const radice = document.documentElement;
  radice.dataset.tema = scelto;
  const scuro = scelto === 'scuro' ||
    (scelto === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  radice.style.colorScheme = scuro ? 'dark' : 'light';
  try { localStorage.setItem('pranzo.tema', scelto); } catch (e) { /* pazienza */ }
  coloreBarraTelefono();
}

/** Il colore della barra del telefono segue la testata della pagina. */
function coloreBarraTelefono() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const testata = document.querySelector('.testata');
  if (!meta || !testata) return;
  meta.setAttribute('content', getComputedStyle(testata).backgroundColor || '#ffd23f');
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((stato.preferenze.tema || 'auto') === 'auto') applicaTema('auto');
  });
}

function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js')
    .catch((errore) => console.warn('service worker non registrato:', errore.message));
}

/* ---------------------------------------------------------- catalogo -----
   Al primo avvio scrive tutto. Dopo aggiunge soltanto quello che manca: i
   piatti nuovi entrano, quelli già in archivio non si riscrivono mai, così
   voti, foto e piatti importati restano intatti. L'unica eccezione sono le
   calorie: a un ingrediente che non le ha si aggiungono, senza toccare il
   resto.                                                                  */

async function aggiornaCatalogo() {
  const [quantiIngredienti, quantiPiatti] = await Promise.all([
    DB.conta(DB.STORE.ingredienti), DB.conta(DB.STORE.piatti)
  ]);
  const primaVolta = quantiIngredienti === 0 || quantiPiatti === 0;

  let ingredienti, piatti;
  try {
    [ingredienti, piatti] = await Promise.all([
      scarica('data/seed-ingredienti.json'), scarica('data/seed-piatti.json')
    ]);
  } catch (errore) {
    if (primaVolta) throw errore;
    console.warn('catalogo non aggiornato:', errore.message);
    return;
  }

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

  const [inArchivio, chiaviPiatti] = await Promise.all([
    DB.leggiTutti(DB.STORE.ingredienti), DB.leggiChiavi(DB.STORE.piatti)
  ]);
  const giaIngredienti = M.indicizza(inArchivio);
  const giaPiatti = new Set(chiaviPiatti);
  const nuoviIngredienti = ingredienti.filter((x) => !giaIngredienti.has(x.id));
  const nuoviPiatti = piatti.filter((x) => !giaPiatti.has(x.id));
  const senzaKcal = inArchivio
    .filter((x) => typeof x.kcal !== 'number' && indice.has(x.id) && typeof indice.get(x.id).kcal === 'number')
    .map((x) => Object.assign({}, x, { kcal: indice.get(x.id).kcal }));
  if (!nuoviIngredienti.length && !nuoviPiatti.length && !senzaKcal.length) return;

  await DB.transazione([DB.STORE.ingredienti, DB.STORE.piatti, DB.STORE.preferenze], 'readwrite', async (stores) => {
    for (const x of nuoviIngredienti.concat(senzaKcal)) await stores[DB.STORE.ingredienti].scrivi(x);
    for (const x of nuoviPiatti) await stores[DB.STORE.piatti].scrivi(x);
    const pref = await stores[DB.STORE.preferenze].leggi('preferenze');
    if (!pref) await stores[DB.STORE.preferenze].scrivi(Object.assign(M.preferenzePredefinite(), { versioneDati: 3 }));
  });

  if (!primaVolta && nuoviPiatti.length) avviso(`Catalogo aggiornato: ${nuoviPiatti.length} piatti nuovi.`);
}

async function scarica(percorso) {
  const risposta = await fetch(percorso, { cache: 'no-cache' });
  if (!risposta.ok) throw new Error(`${percorso}: HTTP ${risposta.status}`);
  return risposta.json();
}

/**
 * Il passaggio dalla 2.x, una volta sola: i piatti votati bene diventano
 * piatti col cuore. Tutto il resto (piatti, foto, esclusi) è già al suo
 * posto, e i menù vecchi si leggono passando da M.normalizzaMenu.
 */
async function passaAllaTre() {
  if (stato.preferenze.versioneDati >= 3) return;
  const voti = await DB.leggiTutti(DB.STORE.voti).catch(() => []);
  const perPiatto = new Map();
  for (const v of voti) {
    if (!perPiatto.has(v.piattoId)) perPiatto.set(v.piattoId, []);
    perPiatto.get(v.piattoId).push(v.stelle);
  }
  const amati = new Set(stato.preferenze.amoPiatti || []);
  for (const [id, stelle] of perPiatto) {
    const media = stelle.reduce((a, b) => a + b, 0) / stelle.length;
    if (media >= 4) amati.add(id);
  }
  const nuove = Object.assign({}, stato.preferenze, { amoPiatti: [...amati], versioneDati: 3 });
  // chi veniva dalla 2.x aveva i giorni da lunedì a venerdì: restano suoi
  await DB.scrivi(DB.STORE.preferenze, nuove);
  stato.preferenze = nuove;
}

async function caricaStato() {
  const [ingredienti, piatti, preferenze, cucinato, menu, chiaviFoto] = await Promise.all([
    DB.leggiTutti(DB.STORE.ingredienti),
    DB.leggiTutti(DB.STORE.piatti),
    DB.leggi(DB.STORE.preferenze, 'preferenze'),
    DB.leggiTutti(DB.STORE.cucinato),
    DB.leggiTutti(DB.STORE.menu),
    DB.leggiChiavi(DB.STORE.foto).catch(() => [])
  ]);

  stato.ingredienti = ingredienti;
  stato.piatti = piatti;
  stato.indiceIngredienti = M.indicizza(ingredienti);
  stato.indicePiatti = M.indicizza(piatti);
  // le preferenze salvate da una versione vecchia non hanno le chiavi nuove:
  // i predefiniti fanno da fondo, quello che c'è già vince
  stato.preferenze = Object.assign(M.preferenzePredefinite(), preferenze || {});
  stato.fotoDi = new Set(chiaviFoto);
  stato.oggiChiave = P.chiaveGiorno(new Date());

  // "ultima volta" = il più recente tra ciò che ho cucinato e i menù passati
  stato.ultimaVolta = new Map();
  const segna = (id, data) => {
    if (!id || !data) return;
    const attuale = stato.ultimaVolta.get(id);
    if (!attuale || attuale < data) stato.ultimaVolta.set(id, data);
  };
  for (const c of cucinato) segna(c.piattoId, c.data);
  const oggi = P.iso(new Date());
  for (const m of menu) {
    for (const g of M.normalizzaMenu(m, stato.indicePiatti).giorni || []) {
      if (g.data && g.data < oggi) for (const id of M.piattiDelGiorno(g)) segna(id, g.data);
    }
  }

  const id = P.idMenu(lunediScelto());
  stato.menu = M.normalizzaMenu(menu.find((m) => m.id === id) || null, stato.indicePiatti);
  stato.lista = stato.menu ? (await DB.leggi(DB.STORE.listeSpesa, stato.menu.id)) || null : null;
  // una lista della 2.x non sa niente dei contorni nuovi: si rifà
  if (stato.menu && (!stato.lista || stato.lista.formato !== M.FORMATO_MENU)) await aggiornaLista();
}

function lunediScelto() {
  const d = P.lunediDi(new Date());
  d.setDate(d.getDate() + stato.scarto * 7);
  return d;
}

/* ---------------------------------------------------------- il contesto -- */

function contesto() {
  return {
    piatti: stato.piatti,
    indiceIngredienti: stato.indiceIngredienti,
    preferenze: stato.preferenze,
    ultimaVolta: stato.ultimaVolta,
    mese: M.mesecorrente(lunediScelto()),
    oggi: new Date()
  };
}

/** Il menù come si salva: solo id, niente oggetti. */
function perSalvare(menu) {
  return {
    id: menu.id,
    dataInizio: menu.dataInizio,
    formato: M.FORMATO_MENU,
    stato: 'attivo',
    note: menu.note || [],
    giorni: (menu.giorni || []).map((g) => {
      const pasti = {};
      for (const [nome, pasto] of M.pastiDi(g)) pasti[nome] = M.pastoPulito(pasto);
      return { giorno: g.giorno, data: g.data || null, pasti };
    })
  };
}

async function salvaMenu(menu) {
  const pulito = perSalvare(menu);
  await DB.scrivi(DB.STORE.menu, pulito);
  stato.menu = M.normalizzaMenu(pulito, stato.indicePiatti);
  await aggiornaLista();
}

/* ---------------------------------------------------------- le azioni ---- */

/** Rifà la settimana guardata. I pasti scelti a mano, e i tempi scelti, restano. */
async function generaSettimana(opzioni = {}) {
  const lunedi = lunediScelto();
  const fissi = {};
  for (const g of (stato.menu && stato.menu.giorni) || []) {
    for (const [nome, pasto] of M.pastiDi(g)) {
      if (!pasto.scelto && !pasto.tempoMax && !opzioni.soloVuoti) continue;
      fissi[g.giorno] = fissi[g.giorno] || {};
      fissi[g.giorno][nome] = opzioni.soloVuoti ? Object.assign({}, pasto, { tieni: true }) : pasto;
    }
  }
  const esito = P.generaSettimana(contesto(), { fissi });
  if (!esito.giorni.length) {
    avviso(esito.note[0] || 'Non riesco a comporre la settimana.', 'errore');
    return;
  }
  await salvaMenu({
    id: P.idMenu(lunedi),
    dataInizio: P.iso(lunedi),
    giorni: P.conDate(esito.giorni, lunedi),
    note: esito.note
  });
  chiudiFoglio();
  if (!opzioni.silenzioso) avviso(opzioni.soloVuoti ? 'Giorni vuoti completati.' : 'Settimana pronta.');
  disegna();
}

async function cambiaSettimana(scarto) {
  stato.scarto = scarto === 1 ? 1 : 0;
  await caricaStato();
  disegna();
}

function conPastoCambiato(giorno, pasto, nuovo) {
  return Object.assign({}, stato.menu, {
    giorni: stato.menu.giorni.map((g) => {
      if (g.giorno !== giorno) return g;
      const pasti = Object.assign({}, g.pasti);
      if (nuovo) pasti[pasto] = nuovo; else delete pasti[pasto];
      return Object.assign({}, g, { pasti });
    })
  });
}

/** Il menù c'è? Se manca il giorno (giorni cambiati dalle impostazioni) lo aggiunge. */
function conGiorno(giorno) {
  if (!stato.menu) return false;
  if (!stato.menu.giorni.some((g) => g.giorno === giorno)) {
    const lunedi = lunediScelto();
    const giorni = stato.menu.giorni.concat([{ giorno, pasti: {} }])
      .sort((a, b) => M.GIORNI.indexOf(a.giorno) - M.GIORNI.indexOf(b.giorno));
    stato.menu = Object.assign({}, stato.menu, { giorni: P.conDate(giorni, lunedi) });
  }
  return true;
}

async function rigeneraPasto(giorno, pasto, opzioni = {}) {
  if (!conGiorno(giorno)) return;
  const esito = P.rigeneraPasto(contesto(), stato.menu, giorno, pasto, opzioni);
  if (!esito) { avviso('Non trovo un altro piatto adatto.', 'errore'); return; }
  await salvaMenu(conPastoCambiato(giorno, pasto, esito.pasto));
  if (esito.nota) avviso(`Ho trovato solo un piatto ${esito.nota}.`);
  dopoCambio(giorno);
}

/** Il tasto di scambio su un giorno: rifà pranzo e cena di quel giorno. */
async function rigeneraGiorno(giorno) {
  const riga = stato.menu && stato.menu.giorni.find((g) => g.giorno === giorno);
  if (!riga) return;
  for (const [nome, pasto] of M.pastiDi(riga)) {
    if (pasto.scelto) continue;
    const esito = P.rigeneraPasto(contesto(), stato.menu, giorno, nome);
    if (esito) stato.menu = conPastoCambiato(giorno, nome, esito.pasto);
  }
  await salvaMenu(stato.menu);
  disegna();
}

async function cambiaContorno(giorno, pasto) {
  if (!stato.menu) return;
  const nuovo = P.rigeneraContorno(contesto(), stato.menu, giorno, pasto);
  if (!nuovo) { avviso('Non trovo un altro contorno.', 'errore'); return; }
  await salvaMenu(conPastoCambiato(giorno, pasto, nuovo));
  dopoCambio(giorno);
}

/** Il tempo di un pasto per quel giorno: si salva e il piatto si adegua. */
async function impostaTempo(giorno, pasto, minuti) {
  await rigeneraPasto(giorno, pasto, { tempoMax: minuti });
}

/** "Scegli tu": il piatto preso dal catalogo prende il posto del pasto. */
async function scegliPiatto(giorno, pasto, piattoId) {
  if (!conGiorno(giorno)) return;
  const piatto = stato.indicePiatti.get(piattoId);
  if (!piatto) return;
  const riga = stato.menu.giorni.find((g) => g.giorno === giorno);
  const attuale = (riga.pasti || {})[pasto] || {};
  let contorno = null;
  if (piatto.tipo === 'secondo') {
    const c = P.scegliContorno(contesto(), [], 0, piatto);
    contorno = c ? c.id : null;
  }
  await salvaMenu(conPastoCambiato(giorno, pasto, {
    piatto: piattoId, contorno, tempoMax: attuale.tempoMax || null, scelto: true
  }));
  avviso(`${piatto.nome}: scelto da te.`);
  dopoCambio(giorno);
}

/** Dopo un cambio fatto dal foglio del giorno, il foglio resta aperto e aggiornato. */
function dopoCambio(giorno) {
  disegna();
  if (foglioAperto()) mostraGiorno(giorno, stato);
}

/* -------------------------------------------------------------- gusti ---- */

async function cuore(piattoId) {
  const pref = stato.preferenze;
  const amati = new Set(pref.amoPiatti || []);
  const acceso = !amati.has(piattoId);
  if (acceso) amati.add(piattoId); else amati.delete(piattoId);
  await salvaPreferenze(Object.assign({}, pref, { amoPiatti: [...amati] }));
  riapriPiatto(piattoId);
}

/** "Non lo voglio più": esce dalle proposte, e dai menù di questa e della prossima settimana. */
async function escludi(piattoId) {
  const pref = stato.preferenze;
  const esclusi = new Set(pref.escludiPiatti || []);
  const ora = !esclusi.has(piattoId);
  if (ora) esclusi.add(piattoId); else esclusi.delete(piattoId);
  await salvaPreferenze(Object.assign({}, pref, { escludiPiatti: [...esclusi] }));

  let tolti = 0;
  if (ora && stato.menu) {
    for (const g of stato.menu.giorni) {
      for (const [nome, pasto] of M.pastiDi(g)) {
        if (pasto.piatto === piattoId) {
          const esito = P.rigeneraPasto(contesto(), stato.menu, g.giorno, nome);
          if (esito) { stato.menu = conPastoCambiato(g.giorno, nome, esito.pasto); tolti++; }
        } else if (pasto.contorno === piattoId) {
          const nuovo = P.rigeneraContorno(contesto(), stato.menu, g.giorno, nome);
          if (nuovo) { stato.menu = conPastoCambiato(g.giorno, nome, nuovo); tolti++; }
        }
      }
    }
    if (tolti) await salvaMenu(stato.menu);
  }
  const piatto = stato.indicePiatti.get(piattoId);
  avviso(ora
    ? `${piatto ? piatto.nome : 'Il piatto'}: non te lo propongo più${tolti ? ', e l\'ho tolto dalla settimana' : ''}.`
    : `${piatto ? piatto.nome : 'Il piatto'} torna tra le proposte.`);
  disegna();
  riapriPiatto(piattoId);
}

function riapriPiatto(piattoId) {
  const piatto = stato.indicePiatti.get(piattoId);
  if (piatto && foglioAperto()) mostraPiatto(piatto, stato);
}

/* ------------------------------------------------- lista della spesa ----- */

function contestoSpesa() {
  return {
    indicePiatti: stato.indicePiatti,
    indiceIngredienti: stato.indiceIngredienti,
    porzioni: stato.preferenze.porzioni || 1,
    ordineReparti: stato.preferenze.ordineReparti || M.REPARTI
  };
}

/** Rifà la lista dal menù, conservando spunte e voci aggiunte a mano. */
async function aggiornaLista() {
  if (!stato.menu) { stato.lista = null; return; }
  const precedente = stato.lista && stato.lista.menuId === stato.menu.id ? stato.lista : null;
  const nuova = Object.assign(S.generaLista(stato.menu, contestoSpesa(), precedente), { formato: M.FORMATO_MENU });
  await DB.scrivi(DB.STORE.listeSpesa, nuova);
  stato.lista = nuova;
}

async function salvaLista() {
  if (stato.lista) await DB.scrivi(DB.STORE.listeSpesa, stato.lista);
  disegna();
}

async function segnaComprato(chiave) {
  if (!stato.lista) return;
  S.segnaComprato(stato.lista, chiave);
  await salvaLista();
}

async function segnaInCasa(ingredienteId) {
  if (!stato.lista) return;
  S.segnaInCasa(stato.lista, ingredienteId);
  await salvaLista();
}

async function aggiungiLibera(testo) {
  if (!stato.lista) return;
  S.aggiungiVoceLibera(stato.lista, testo);
  await salvaLista();
}

async function togliLibera(id) {
  if (!stato.lista) return;
  S.togliVoceLibera(stato.lista, id);
  await salvaLista();
}

async function copiaLista() {
  if (!stato.lista) return;
  const testo = S.testoDaCopiare(stato.lista, stato.preferenze.ordineReparti || M.REPARTI, M.NOME_REPARTO);
  if (!testo) { avviso('Non manca niente: hai già tutto.'); return; }
  try {
    await navigator.clipboard.writeText(testo);
    avviso('Lista copiata: incollala dove vuoi.');
  } catch (e) {
    avviso('Non riesco a copiare: il telefono non lo permette qui.', 'errore');
  }
}

/* ------------------------------------------------------- nuovi piatti ---- */

function paginaNuovi(contenitore) {
  svuotaNodo(contenitore);
  contenitore.appendChild(el('header', { class: 'testata arancio corta' }, [
    el('div', { class: 'barraTesta' }, [
      el('a', { class: 'tondo chiaro', href: '#/piatti', 'aria-label': 'Torna ai piatti' }, [icona('indietro')]),
      el('span', { class: 'marchio' }, ['Nuovi piatti', el('i', {}, '.')])
    ])
  ]));
  const corpo = el('div', { class: 'corpo nuovi', id: 'corpoNuovi' });
  contenitore.appendChild(corpo);
  Nuovi.render(corpo, Object.assign(stato, { voti: {} }));
}

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
  avviso(`"${piatto.nome}" è nel catalogo.`);
  disegna();
  return true;
}

/* ---------------------------------------------------------- le foto ------
   Una per piatto, ridotta prima di salvare. Non entrano nel backup: sono
   pesanti e il backup deve restare un file che si manda in chat.         */

const urlDelle = new Map();
let spazioChiesto = false;

async function urlFoto(piattoId) {
  if (urlDelle.has(piattoId)) return urlDelle.get(piattoId);
  const record = await DB.leggi(DB.STORE.foto, piattoId);
  if (!record || !record.blob) return null;
  const url = URL.createObjectURL(record.blob);
  urlDelle.set(piattoId, url);
  return url;
}

function dimenticaFoto(piattoId) {
  const url = urlDelle.get(piattoId);
  if (url) URL.revokeObjectURL(url);
  urlDelle.delete(piattoId);
}

async function salvaFoto(piattoId, file) {
  let pronta;
  try {
    pronta = await F.preparaFoto(file);
  } catch (errore) {
    avviso('Non riesco a usare questa foto: ' + errore.message, 'errore');
    return;
  }
  try {
    await DB.scrivi(DB.STORE.foto, {
      piattoId, blob: pronta.blob, larghezza: pronta.larghezza, altezza: pronta.altezza,
      byte: pronta.byte, aggiornata: P.iso(new Date())
    });
  } catch (errore) {
    avviso('Non riesco a salvare la foto: ' + errore.message, 'errore');
    return;
  }
  if (!spazioChiesto) { spazioChiesto = true; F.chiediDiTenere().catch(() => {}); }
  dimenticaFoto(piattoId);
  stato.fotoDi.add(piattoId);
  avviso('Foto salvata.');
  disegna();
  riapriPiatto(piattoId);
}

async function togliFoto(piattoId) {
  await DB.elimina(DB.STORE.foto, piattoId);
  dimenticaFoto(piattoId);
  stato.fotoDi.delete(piattoId);
  avviso('Foto tolta.');
  disegna();
  riapriPiatto(piattoId);
}

/* ------------------------------------------------------ impostazioni ----- */

async function salvaPreferenze(nuove) {
  const vecchie = stato.preferenze;
  stato.preferenze = nuove;
  await DB.scrivi(DB.STORE.preferenze, nuove);
  applicaTema(nuove.tema);
  // le persone cambiano le quantità: la spesa si rifà subito
  if (vecchie.porzioni !== nuove.porzioni) await aggiornaLista();
  disegna();
}

/** Ricarica tutto dall'archivio: serve dopo un backup caricato. */
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
 * Ridisegna la pagina corrente. Restando nella stessa pagina si torna
 * esattamente dov'eri (spuntare la spesa in fondo non deve riportarti su);
 * cambiando pagina si parte dall'inizio.
 */
function disegna() {
  const nome = rottaCorrente();
  const stessa = nome === rottaDisegnata;
  const scorrimento = stessa ? window.scrollY : 0;

  for (const link of document.querySelectorAll('.barra a')) {
    link.setAttribute('aria-current', link.dataset.rotta === VOCE_BARRA[nome] ? 'page' : 'false');
  }
  const conto = stato.lista ? S.conteggio(stato.lista) : null;
  const resto = conto ? conto.totale - conto.fatti : 0;
  document.getElementById('contoSpesa').textContent = resto ? ` · ${resto}` : '';

  ROTTE[nome](document.getElementById('vista'));
  rottaDisegnata = nome;
  window.scrollTo(0, scorrimento);
  coloreBarraTelefono();
}

avvia();
