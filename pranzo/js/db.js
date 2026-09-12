/* =========================================================================
   db.js — wrapper IndexedDB scritto a mano, senza librerie.
   Espone poche funzioni (leggi, leggiTutti, scrivi, scriviMolti, elimina,
   transazione): il resto dell'app non sa quale motore c'è sotto, così un
   giorno si può affiancare un altro archivio senza toccare le schermate.
   Se IndexedDB non è disponibile si ripiega su localStorage.
   ========================================================================= */

const NOME_DB = 'pranzo';
const VERSIONE = 2;   /* 2: aggiunto lo store delle foto */

/** Nomi degli store, un'entità per store. */
export const STORE = {
  ingredienti: 'ingredienti',
  piatti: 'piatti',
  preferenze: 'preferenze',
  voti: 'voti',
  menu: 'menu',
  listeSpesa: 'listeSpesa',
  dispensa: 'dispensa',
  cucinato: 'cucinato',
  suggerimenti: 'suggerimenti',
  snapshot: 'snapshot',
  foto: 'foto'
};

/* Schema dichiarativo: chiave primaria e indici di ogni store. */
const SCHEMA = {
  ingredienti: { chiave: 'id', indici: [['reparto', 'reparto'], ['macro', 'macro']] },
  piatti:      { chiave: 'id', indici: [['tipo', 'tipo'], ['origine', 'origine'], ['attivo', 'attivo']] },
  preferenze:  { chiave: 'chiave', indici: [] },
  voti:        { chiave: 'id', indici: [['piattoId', 'piattoId'], ['data', 'data']] },
  menu:        { chiave: 'id', indici: [['stato', 'stato'], ['dataInizio', 'dataInizio']] },
  listeSpesa:  { chiave: 'menuId', indici: [] },
  dispensa:    { chiave: 'ingredienteId', indici: [] },
  cucinato:    { chiave: 'id', indici: [['piattoId', 'piattoId'], ['data', 'data']] },
  suggerimenti:{ chiave: 'id', indici: [['stato', 'stato']] },
  snapshot:    { chiave: 'id', indici: [['data', 'data']] },
  /* le foto stanno per conto loro: sono pesanti e non entrano nei backup,
     così leggere un piatto non si porta dietro mezzo megabyte di immagine */
  foto:        { chiave: 'piattoId', indici: [] }
};

let dbAperto = null;
let motore = null;          // 'indexeddb' | 'localstorage'

/** Il motore effettivamente in uso, per mostrarlo nelle impostazioni. */
export function motoreInUso() { return motore; }

/* --------------------------------------------------------- IndexedDB ----- */

function promessa(richiesta) {
  return new Promise((risolvi, rifiuta) => {
    richiesta.onsuccess = () => risolvi(richiesta.result);
    richiesta.onerror = () => rifiuta(richiesta.error);
  });
}

function creaStore(db, nome) {
  const s = SCHEMA[nome];
  const store = db.createObjectStore(nome, { keyPath: s.chiave });
  for (const [nomeIndice, campo] of s.indici) {
    store.createIndex(nomeIndice, campo, { unique: false });
  }
}

export function apri() {
  if (dbAperto) return Promise.resolve(dbAperto);

  if (!('indexedDB' in window) || !window.indexedDB) {
    motore = 'localstorage';
    dbAperto = archivioLocale();
    return Promise.resolve(dbAperto);
  }

  return new Promise((risolvi, rifiuta) => {
    const richiesta = indexedDB.open(NOME_DB, VERSIONE);

    richiesta.onupgradeneeded = (evento) => {
      const db = richiesta.result;
      const da = evento.oldVersion;
      // migrazioni progressive: ogni versione aggiunge solo ciò che manca
      if (da < 1) {
        for (const nome of Object.keys(SCHEMA)) creaStore(db, nome);
      }
      if (da >= 1 && da < 2 && !db.objectStoreNames.contains('foto')) {
        creaStore(db, 'foto');
      }
    };

    richiesta.onsuccess = () => {
      motore = 'indexeddb';
      dbAperto = richiesta.result;
      dbAperto.onversionchange = () => { dbAperto.close(); dbAperto = null; };
      risolvi(dbAperto);
    };

    richiesta.onerror = () => {
      // Safari in navigazione privata apre e poi fallisce: si ripiega
      console.warn('IndexedDB non disponibile, uso localStorage:', richiesta.error);
      motore = 'localstorage';
      dbAperto = archivioLocale();
      risolvi(dbAperto);
    };

    richiesta.onblocked = () => rifiuta(new Error('database bloccato da un altra scheda'));
  });
}

function conMotoreLocale(db) { return motore === 'localstorage'; }

/* --------------------------------------------------------- operazioni ---- */

export async function leggi(nomeStore, chiave) {
  const db = await apri();
  if (conMotoreLocale(db)) return db.leggi(nomeStore, chiave);
  const tx = db.transaction(nomeStore, 'readonly');
  return promessa(tx.objectStore(nomeStore).get(chiave));
}

export async function leggiTutti(nomeStore) {
  const db = await apri();
  if (conMotoreLocale(db)) return db.leggiTutti(nomeStore);
  const tx = db.transaction(nomeStore, 'readonly');
  return promessa(tx.objectStore(nomeStore).getAll());
}

export async function leggiPerIndice(nomeStore, nomeIndice, valore) {
  const db = await apri();
  if (conMotoreLocale(db)) return db.leggiPerIndice(nomeStore, nomeIndice, valore);
  const tx = db.transaction(nomeStore, 'readonly');
  return promessa(tx.objectStore(nomeStore).index(nomeIndice).getAll(valore));
}

/** Solo le chiavi: per sapere chi ha una foto senza leggerne nemmeno una. */
export async function leggiChiavi(nomeStore) {
  const db = await apri();
  if (conMotoreLocale(db)) return db.leggiChiavi(nomeStore);
  const tx = db.transaction(nomeStore, 'readonly');
  return promessa(tx.objectStore(nomeStore).getAllKeys());
}

export async function conta(nomeStore) {
  const db = await apri();
  if (conMotoreLocale(db)) return db.conta(nomeStore);
  const tx = db.transaction(nomeStore, 'readonly');
  return promessa(tx.objectStore(nomeStore).count());
}

export async function scrivi(nomeStore, valore) {
  const db = await apri();
  if (conMotoreLocale(db)) return db.scrivi(nomeStore, valore);
  const tx = db.transaction(nomeStore, 'readwrite');
  const p = promessa(tx.objectStore(nomeStore).put(valore));
  await fineTransazione(tx);
  return p;
}

/** Scrive molti record in una sola transazione: o passano tutti, o nessuno. */
export async function scriviMolti(nomeStore, valori) {
  const db = await apri();
  if (conMotoreLocale(db)) return db.scriviMolti(nomeStore, valori);
  const tx = db.transaction(nomeStore, 'readwrite');
  const store = tx.objectStore(nomeStore);
  for (const v of valori) store.put(v);
  await fineTransazione(tx);
  return valori.length;
}

export async function elimina(nomeStore, chiave) {
  const db = await apri();
  if (conMotoreLocale(db)) return db.elimina(nomeStore, chiave);
  const tx = db.transaction(nomeStore, 'readwrite');
  const p = promessa(tx.objectStore(nomeStore).delete(chiave));
  await fineTransazione(tx);
  return p;
}

export async function svuota(nomeStore) {
  const db = await apri();
  if (conMotoreLocale(db)) return db.svuota(nomeStore);
  const tx = db.transaction(nomeStore, 'readwrite');
  const p = promessa(tx.objectStore(nomeStore).clear());
  await fineTransazione(tx);
  return p;
}

/**
 * Transazione su più store. `lavoro` riceve un oggetto {nomeStore: store}
 * con metodi che restituiscono promesse. Se lancia, la transazione abortisce
 * e il database resta come prima: è così che l'import non può corromperlo.
 */
export async function transazione(nomiStore, modo, lavoro) {
  const db = await apri();
  if (conMotoreLocale(db)) return db.transazione(nomiStore, modo, lavoro);

  const tx = db.transaction(nomiStore, modo);
  const stores = {};
  for (const nome of [].concat(nomiStore)) {
    const s = tx.objectStore(nome);
    stores[nome] = {
      leggi: (k) => promessa(s.get(k)),
      leggiTutti: () => promessa(s.getAll()),
      scrivi: (v) => promessa(s.put(v)),
      elimina: (k) => promessa(s.delete(k)),
      svuota: () => promessa(s.clear())
    };
  }
  let risultato;
  try {
    risultato = await lavoro(stores);
  } catch (errore) {
    try { tx.abort(); } catch (e) { /* già chiusa */ }
    throw errore;
  }
  await fineTransazione(tx);
  return risultato;
}

function fineTransazione(tx) {
  return new Promise((risolvi, rifiuta) => {
    tx.oncomplete = () => risolvi();
    tx.onerror = () => rifiuta(tx.error);
    tx.onabort = () => rifiuta(tx.error || new Error('transazione annullata'));
  });
}

/* ------------------------------------------------ ripiego su localStorage -
   Stessa interfaccia, dati in un array per store. Nessuna magia: serve solo
   a non lasciare l'app inutilizzabile dove IndexedDB è spento.            */

function archivioLocale() {
  const PREFISSO = 'pranzo.db.';
  const carica = (nome) => {
    try { return JSON.parse(localStorage.getItem(PREFISSO + nome) || '[]'); }
    catch (e) { return []; }
  };
  const salva = (nome, righe) => localStorage.setItem(PREFISSO + nome, JSON.stringify(righe));
  const chiaveDi = (nome) => SCHEMA[nome].chiave;

  const api = {
    locale: true,
    leggi: (nome, k) => carica(nome).find((r) => r[chiaveDi(nome)] === k),
    leggiTutti: (nome) => carica(nome),
    leggiChiavi: (nome) => carica(nome).map((r) => r[chiaveDi(nome)]),
    leggiPerIndice: (nome, indice, valore) => {
      const campo = (SCHEMA[nome].indici.find(([n]) => n === indice) || [])[1] || indice;
      return carica(nome).filter((r) => r[campo] === valore);
    },
    conta: (nome) => carica(nome).length,
    scrivi: (nome, v) => {
      const righe = carica(nome), c = chiaveDi(nome);
      const i = righe.findIndex((r) => r[c] === v[c]);
      if (i >= 0) righe[i] = v; else righe.push(v);
      salva(nome, righe);
      return v[c];
    },
    scriviMolti: (nome, valori) => {
      const righe = carica(nome), c = chiaveDi(nome);
      for (const v of valori) {
        const i = righe.findIndex((r) => r[c] === v[c]);
        if (i >= 0) righe[i] = v; else righe.push(v);
      }
      salva(nome, righe);
      return valori.length;
    },
    elimina: (nome, k) => salva(nome, carica(nome).filter((r) => r[chiaveDi(nome)] !== k)),
    svuota: (nome) => salva(nome, []),
    transazione: async (nomi, modo, lavoro) => {
      // si simula l'atomicità: copia di sicurezza, e in caso di errore si ripristina
      const nomiArray = [].concat(nomi);
      const copia = {};
      for (const n of nomiArray) copia[n] = carica(n);
      const stores = {};
      for (const n of nomiArray) {
        stores[n] = {
          leggi: async (k) => api.leggi(n, k),
          leggiTutti: async () => api.leggiTutti(n),
          scrivi: async (v) => api.scrivi(n, v),
          elimina: async (k) => api.elimina(n, k),
          svuota: async () => api.svuota(n)
        };
      }
      try {
        return await lavoro(stores);
      } catch (errore) {
        for (const n of nomiArray) salva(n, copia[n]);
        throw errore;
      }
    }
  };
  return api;
}
