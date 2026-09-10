/* =========================================================================
   tastes.js — i gusti: voti, medie pesate, punteggio implicito degli
   ingredienti e suggerimenti da confermare.
   Nessun accesso al database: solo funzioni pure, come model.js e planner.js.

   Regola di fondo delle specifiche: l'app non modifica mai da sola le liste
   dei gusti. Qui si calcolano solo *proposte*; a confermarle è l'utente.
   ========================================================================= */

import * as M from './model.js';

/** Soglie del §5.1: sotto/sopra queste medie l'app propone qualcosa. */
export const SOGLIA_ESCLUDI = 2.2;
export const SOGLIA_AMO = 4.3;
/** Con meno di tre piatti votati diversi il dato non vale: era il piatto. */
export const MIN_PIATTI_VOTATI = 3;

export const ETICHETTA_MOTIVO = {
  buono: 'buono',
  troppoLungo: 'troppo lungo da fare',
  noioso: 'noioso',
  nonMiPiace: 'non mi piace',
  daRifare: 'da rifare'
};

/** Le quattro liste dei gusti, con l'etichetta e la lista "opposta". */
export const LISTE = {
  amoPiatti:          { titolo: 'Piatti che amo',          cosa: 'piatti',      opposta: 'escludiPiatti' },
  escludiPiatti:      { titolo: 'Piatti che escludo',      cosa: 'piatti',      opposta: 'amoPiatti' },
  amoIngredienti:     { titolo: 'Ingredienti che amo',     cosa: 'ingredienti', opposta: 'escludiIngredienti' },
  escludiIngredienti: { titolo: 'Ingredienti che escludo', cosa: 'ingredienti', opposta: 'amoIngredienti' }
};

/* ------------------------------------------------------------- i voti ---- */

/** Media dei voti pesata sui più recenti: peso 0.7^n dal più recente. */
export function votoMedio(voti) {
  if (!voti || !voti.length) return null;
  const ordinati = voti.slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  let somma = 0, pesi = 0;
  ordinati.forEach((v, n) => {
    const peso = Math.pow(0.7, n);
    somma += v.stelle * peso;
    pesi += peso;
  });
  return somma / pesi;
}

/**
 * I voti che parlano di gusto. "Troppo lungo" non dice nulla sugli
 * ingredienti — dice sul tempo — quindi non entra nell'apprendimento:
 * è esattamente la distinzione che chiedono le specifiche al §3.4.
 */
export function votiDiGusto(voti) {
  return (voti || []).filter((v) => v.motivo !== 'troppoLungo');
}

/**
 * Tempo percepito: ogni "troppo lungo" fa pesare il piatto come se durasse
 * un quarto in più. Così il voto alza la soglia di tempo, invece di
 * limitarsi a togliere punti.
 */
export function tempoPercepito(piatto, voti) {
  const quanti = (voti || []).filter((v) => v.motivo === 'troppoLungo').length;
  if (!quanti) return piatto.tempoMin;
  return Math.round(piatto.tempoMin * (1 + Math.min(quanti, 3) * 0.25));
}

let contatoreVoti = 0;

/** Costruisce un voto valido (o lancia): la validazione è in model.js. */
export function nuovoVoto(dati) {
  const voto = {
    id: dati.id || `vot_${Date.now().toString(36)}_${(contatoreVoti++).toString(36)}`,
    piattoId: dati.piattoId,
    data: dati.data || isoOggi(),
    stelle: Number(dati.stelle),
    motivo: dati.motivo || 'buono',
    note: (dati.note || '').trim()
  };
  const esito = M.validaVoto(voto);
  if (!esito.ok) throw new Error('voto non valido: ' + esito.errori.join('; '));
  return voto;
}

function isoOggi(data = new Date()) {
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const g = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${m}-${g}`;
}

/* --------------------------------------------- punteggio degli ingredienti
   Media dei voti dei piatti che contengono l'ingrediente, valida solo con
   almeno MIN_PIATTI_VOTATI piatti diversi. Sale, olio e spezie restano fuori:
   stanno in tutto, quindi la loro media direbbe soltanto com'è andata la
   settimana.                                                               */

function ingredienteDaImparare(ing) {
  if (!ing) return false;
  if (ing.dispensaBase) return false;
  if (ing.macro === 'condimento') return false;
  return true;
}

/**
 * @returns Map ingredienteId -> { media, quantiPiatti, piattiIds, valido }
 */
export function punteggiIngredienti(ctx) {
  const { piatti, indiceIngredienti: idx, voti } = ctx;
  const raccolta = new Map();

  for (const piatto of piatti || []) {
    const suoi = votiDiGusto((voti || {})[piatto.id]);
    if (!suoi.length) continue;
    const media = votoMedio(suoi);

    const visti = new Set();
    for (const voce of piatto.ingredienti || []) {
      const ing = idx.get(voce.ingredienteId);
      if (!ingredienteDaImparare(ing)) continue;
      if (visti.has(ing.id)) continue;          // un ingrediente due volte nello stesso piatto conta una
      visti.add(ing.id);
      if (!raccolta.has(ing.id)) raccolta.set(ing.id, { medie: [], piattiIds: [] });
      const riga = raccolta.get(ing.id);
      riga.medie.push(media);
      riga.piattiIds.push(piatto.id);
    }
  }

  const out = new Map();
  for (const [id, riga] of raccolta) {
    const media = riga.medie.reduce((a, b) => a + b, 0) / riga.medie.length;
    out.set(id, {
      media,
      quantiPiatti: riga.piattiIds.length,
      piattiIds: riga.piattiIds,
      valido: riga.piattiIds.length >= MIN_PIATTI_VOTATI
    });
  }
  return out;
}

/* -------------------------------------------------------- suggerimenti ---
   Proposte, non decisioni. L'id è deterministico (sug_esc_<ingrediente>) così
   un suggerimento scartato non ritorna a chiedere la stessa cosa ogni volta. */

export function idSuggerimento(tipo, ingredienteId) {
  return `sug_${tipo === 'amo' ? 'amo' : 'esc'}_${ingredienteId}`;
}

/**
 * Suggerimenti nuovi da proporre, escludendo quelli già decisi e quelli
 * inutili (ingrediente già nella lista giusta).
 * @param esistenti suggerimenti già in archivio (qualunque stato)
 */
export function suggerimentiDaVoti(ctx, esistenti = []) {
  const pref = ctx.preferenze || M.preferenzePredefinite();
  const decisi = new Set(esistenti.map((s) => s.id));
  const punteggi = punteggiIngredienti(ctx);
  const oggi = isoOggi();
  const out = [];

  for (const [ingredienteId, dato] of punteggi) {
    if (!dato.valido) continue;
    const ing = ctx.indiceIngredienti.get(ingredienteId);
    if (!ing) continue;

    let tipo = null;
    if (dato.media < SOGLIA_ESCLUDI) tipo = 'escludi';
    else if (dato.media > SOGLIA_AMO) tipo = 'amo';
    if (!tipo) continue;

    const lista = tipo === 'escludi' ? 'escludiIngredienti' : 'amoIngredienti';
    if ((pref[lista] || []).includes(ingredienteId)) continue;

    const id = idSuggerimento(tipo, ingredienteId);
    if (decisi.has(id)) continue;

    // il nome resta un'etichetta e la domanda parla dell'"ingrediente":
    // così la frase è corretta con qualunque nome, singolare o plurale
    out.push({
      id, tipo, ingredienteId, lista,
      media: Math.round(dato.media * 10) / 10,
      quantiPiatti: dato.quantiPiatti,
      piattiIds: dato.piattiIds,
      testo: tipo === 'escludi'
        ? `${ing.nome}: questo ingrediente prende voti bassi. Lo metto tra gli esclusi?`
        : `${ing.nome}: questo ingrediente prende voti alti. Lo metto tra i preferiti?`,
      stato: 'pendente',
      data: oggi
    });
  }

  out.sort((a, b) => a.media - b.media);
  return out;
}

/* ---------------------------------------------------------- le liste ----- */

/**
 * Aggiunge un id a una lista dei gusti. Restituisce nuove preferenze: non
 * modifica l'oggetto in ingresso, così la schermata resta prevedibile.
 * Amare ed escludere la stessa cosa non ha senso: entrare in una lista
 * significa uscire dall'altra.
 */
export function aggiungiAllaLista(preferenze, lista, id) {
  if (!LISTE[lista]) throw new Error('lista sconosciuta: ' + lista);
  const nuove = Object.assign({}, preferenze);
  for (const nome of Object.keys(LISTE)) nuove[nome] = (preferenze[nome] || []).slice();
  if (!nuove[lista].includes(id)) nuove[lista].push(id);
  const opposta = LISTE[lista].opposta;
  nuove[opposta] = nuove[opposta].filter((x) => x !== id);
  return nuove;
}

export function togliDallaLista(preferenze, lista, id) {
  if (!LISTE[lista]) throw new Error('lista sconosciuta: ' + lista);
  const nuove = Object.assign({}, preferenze);
  for (const nome of Object.keys(LISTE)) nuove[nome] = (preferenze[nome] || []).slice();
  nuove[lista] = nuove[lista].filter((x) => x !== id);
  return nuove;
}

/** Conferma di un suggerimento: la lista cambia solo qui. */
export function applicaSuggerimento(preferenze, suggerimento) {
  return aggiungiAllaLista(preferenze, suggerimento.lista, suggerimento.ingredienteId);
}

/* ------------------------------------------------------------ riepiloghi - */

/** Riga di riepilogo per un piatto: media, quanti voti, ultimo voto. */
export function riepilogoPiatto(piattoId, ctx) {
  const voti = ((ctx.voti || {})[piattoId] || []).slice()
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  return {
    voti,
    quanti: voti.length,
    media: votoMedio(voti),
    ultimo: voti[0] || null,
    ultimaVolta: (ctx.ultimaVolta && ctx.ultimaVolta.get(piattoId)) || null
  };
}

/** "3 settimane fa", "mai": il catalogo e i gusti mostrano questo. */
export function quandoUltimaVolta(dataISO, oggi = new Date()) {
  if (!dataISO) return 'mai cucinato';
  const giorni = Math.floor((oggi - new Date(dataISO + 'T00:00:00')) / 86400000);
  if (giorni <= 0) return 'oggi';
  if (giorni === 1) return 'ieri';
  if (giorni < 7) return `${giorni} giorni fa`;
  const settimane = Math.round(giorni / 7);
  return settimane === 1 ? 'una settimana fa' : `${settimane} settimane fa`;
}

/** Stelle piene e vuote, per mostrare un voto senza immagini. */
export function stelle(quante) {
  const n = Math.max(0, Math.min(5, Math.round(quante || 0)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/** "14 set": data breve in italiano, senza librerie. */
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu',
                    'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export function dataBreve(dataISO) {
  if (!dataISO) return '';
  const [, m, g] = dataISO.split('-');
  return `${Number(g)} ${MESI_BREVI[Number(m) - 1] || ''}`.trim();
}
