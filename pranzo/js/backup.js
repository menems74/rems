/* =========================================================================
   backup.js — export, import e istantanee di sicurezza.

   Un file .json porta via tutto: piatti, ingredienti, gusti, voti, menù,
   dispensa, cronologia. Serve per passare da un telefono all'altro e per
   non perdere anni di voti.

   Le istantanee sono la rete di sicurezza contro il gesto sbagliato: una al
   giorno, le ultime cinque, dentro IndexedDB. Non sostituiscono il file
   esportato — se il telefono si perde, si perdono anche loro.
   ========================================================================= */

import * as DB from './db.js';
import * as M from './model.js';

export const FORMATO = 1;
export const QUANTE_ISTANTANEE = 5;

/** Gli store che entrano nel backup: le istantanee non contengono sé stesse. */
const STORE_DA_SALVARE = [
  DB.STORE.ingredienti, DB.STORE.piatti, DB.STORE.preferenze, DB.STORE.voti,
  DB.STORE.menu, DB.STORE.listeSpesa, DB.STORE.dispensa, DB.STORE.cucinato,
  DB.STORE.suggerimenti
];

/* ------------------------------------------------------------- export ---- */

/** Legge tutto il database e restituisce l'oggetto da salvare. */
export async function esporta() {
  const dati = {};
  for (const nome of STORE_DA_SALVARE) {
    dati[nome] = await DB.leggiTutti(nome);
  }
  return {
    app: 'pranzo',
    formato: FORMATO,
    esportato: new Date().toISOString(),
    conteggi: conteggi(dati),
    dati
  };
}

export function conteggi(dati) {
  const out = {};
  for (const nome of STORE_DA_SALVARE) out[nome] = (dati[nome] || []).length;
  return out;
}

export function nomeFile(data = new Date()) {
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const g = String(data.getDate()).padStart(2, '0');
  const hh = String(data.getHours()).padStart(2, '0');
  const mm = String(data.getMinutes()).padStart(2, '0');
  return `pranzo-${data.getFullYear()}-${m}-${g}-${hh}${mm}.json`;
}

/**
 * Salva il file dove decide il telefono: prima il foglio di condivisione
 * (iPhone: File, Drive, WhatsApp...), poi il selettore di cartella dei
 * browser da scrivania, in ultimo il download classico.
 * @returns 'condiviso' | 'salvato' | 'scaricato'
 */
export async function salvaFuori(testo, nome) {
  const file = new File([testo], nome, { type: 'application/json' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nome });
      return 'condiviso';
    } catch (errore) {
      if (errore && errore.name === 'AbortError') throw errore;   // l'utente ha annullato
    }
  }

  if (window.showSaveFilePicker) {
    try {
      const maniglia = await window.showSaveFilePicker({
        suggestedName: nome,
        types: [{ description: 'Backup di Pranzo', accept: { 'application/json': ['.json'] } }]
      });
      const flusso = await maniglia.createWritable();
      await flusso.write(testo);
      await flusso.close();
      return 'salvato';
    } catch (errore) {
      if (errore && errore.name === 'AbortError') throw errore;
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'scaricato';
}

/* ------------------------------------------------------------- import ---- */

/**
 * Controlla un file prima di toccare il database: struttura, formato e
 * validazione di ingredienti e piatti. Nessuna sorpresa a metà scrittura.
 * @returns { ok, errori, avvisi, conteggi, dati }
 */
export function verifica(oggetto) {
  const errori = [], avvisi = [];

  if (!oggetto || typeof oggetto !== 'object') {
    return { ok: false, errori: ['il file non contiene un backup'], avvisi, conteggi: {} };
  }
  if (oggetto.app && oggetto.app !== 'pranzo') {
    errori.push(`il backup è di un\'altra app ("${oggetto.app}")`);
  }
  if (oggetto.formato && Number(oggetto.formato) > FORMATO) {
    errori.push(`il backup è di una versione più nuova (formato ${oggetto.formato})`);
  }

  const dati = oggetto.dati || oggetto;
  const ingredienti = Array.isArray(dati.ingredienti) ? dati.ingredienti : null;
  const piatti = Array.isArray(dati.piatti) ? dati.piatti : null;

  if (!ingredienti || !ingredienti.length) errori.push('nel backup non ci sono ingredienti');
  if (!piatti || !piatti.length) errori.push('nel backup non ci sono piatti');

  if (ingredienti && piatti) {
    const indice = M.indicizza(ingredienti);
    let ingRotti = 0, piattiRotti = 0;
    for (const x of ingredienti) if (!M.validaIngrediente(x).ok) ingRotti++;
    for (const x of piatti) if (!M.validaPiatto(x, indice).ok) piattiRotti++;
    if (ingRotti) errori.push(`${ingRotti} ingredienti non validi`);
    if (piattiRotti) errori.push(`${piattiRotti} piatti non validi`);
  }

  for (const nome of STORE_DA_SALVARE) {
    if (dati[nome] !== undefined && !Array.isArray(dati[nome])) {
      errori.push(`"${nome}" non è un elenco`);
    }
  }
  if (!dati.preferenze || !dati.preferenze.length) {
    avvisi.push('il backup non ha impostazioni: resteranno quelle attuali');
  }

  return { ok: errori.length === 0, errori, avvisi, conteggi: conteggi(dati), dati };
}

/**
 * Sostituisce il contenuto del database con quello del backup, in una sola
 * transazione: se qualcosa va storto non resta un archivio a metà.
 * Le istantanee non vengono toccate — sono la via di ritorno.
 */
export async function importa(dati) {
  const nomi = STORE_DA_SALVARE.slice();
  await DB.transazione(nomi, 'readwrite', async (stores) => {
    for (const nome of nomi) {
      if (dati[nome] === undefined) continue;          // store assente: si lascia com'è
      await stores[nome].svuota();
      for (const riga of dati[nome]) await stores[nome].scrivi(riga);
    }
  });
}

/* --------------------------------------------------------- istantanee ---- */

export function idIstantanea(data = new Date()) {
  return `sna_${data.toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`;
}

/** Scatta un'istantanea e tiene solo le ultime QUANTE_ISTANTANEE. */
export async function istantanea(motivo = 'automatica') {
  const backup = await esporta();
  const record = {
    id: idIstantanea(),
    data: backup.esportato,
    motivo,
    conteggi: backup.conteggi,
    dati: backup.dati
  };
  await DB.scrivi(DB.STORE.snapshot, record);

  const tutte = await istantanee();
  for (const vecchia of tutte.slice(QUANTE_ISTANTANEE)) {
    await DB.elimina(DB.STORE.snapshot, vecchia.id);
  }
  return record;
}

/** Dalla più recente alla più vecchia. */
export async function istantanee() {
  const righe = await DB.leggiTutti(DB.STORE.snapshot);
  return righe.sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

/** Serve un'istantanea? Sì se oggi non ne è ancora stata fatta nessuna. */
export function serveIstantanea(esistenti, adesso = new Date()) {
  if (!esistenti || !esistenti.length) return true;
  const oggi = adesso.toISOString().slice(0, 10);
  return !esistenti.some((s) => String(s.data).slice(0, 10) === oggi);
}

/** Una al giorno, all'avvio, senza disturbare. */
export async function istantaneaSeServe() {
  const esistenti = await istantanee();
  if (!serveIstantanea(esistenti)) return null;
  // la prima volta, con il solo catalogo di partenza, non serve a niente
  const quantiVoti = await DB.conta(DB.STORE.voti);
  const quantiMenu = await DB.conta(DB.STORE.menu);
  if (!quantiVoti && !quantiMenu && esistenti.length) return null;
  return istantanea('automatica');
}

/** Torna a un'istantanea. Prima ne scatta una del momento presente. */
export async function ripristina(id) {
  const record = await DB.leggi(DB.STORE.snapshot, id);
  if (!record || !record.dati) throw new Error('istantanea non trovata');
  const controllo = verifica({ app: 'pranzo', formato: FORMATO, dati: record.dati });
  if (!controllo.ok) throw new Error('istantanea illeggibile: ' + controllo.errori[0]);
  await istantanea('prima del ripristino');
  await importa(record.dati);
  return controllo.conteggi;
}

/* ------------------------------------------------------- lettura file ---- */

/** Legge un file scelto dall'utente e ne estrae l'oggetto JSON. */
export function leggiFile(file) {
  return new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onerror = () => rifiuta(new Error('non riesco a leggere il file'));
    lettore.onload = () => {
      try { risolvi(JSON.parse(String(lettore.result))); }
      catch (e) { rifiuta(new Error('il file non è un JSON valido')); }
    };
    lettore.readAsText(file);
  });
}

/** "10 set 2026, 14:32" */
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu',
              'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export function quando(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return String(iso || '');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/** "1,2 MB": quanto pesa il backup, per sapere cosa si sta spostando. */
export function peso(testo) {
  const byte = new Blob([testo]).size;
  if (byte < 1024) return `${byte} byte`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
