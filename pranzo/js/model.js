/* =========================================================================
   model.js — schemi, validazione, conversioni di unità e calcolo dei macro.
   Nessun accesso al database: qui dentro sono solo funzioni pure, così si
   possono provare in isolamento (vedi test.html).
   ========================================================================= */

export const MACRO = ['proteina', 'carboidrato', 'fibra', 'grasso', 'condimento'];
/** Solo questi tre contano per la copertura nutrizionale del pranzo. */
export const MACRO_NUTRIENTI = ['proteina', 'carboidrato', 'fibra'];
export const UNITA = ['g', 'ml', 'pz'];
export const TIPI_PIATTO = ['primo', 'secondo', 'contorno', 'unico'];
export const ORIGINI = ['base', 'ai', 'utente'];
export const MOTIVI_VOTO = ['buono', 'troppoLungo', 'noioso', 'nonMiPiace', 'daRifare'];
export const GIORNI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

/* Dalla 2.0 un giorno ha due pasti. L'ordine di questo elenco è l'ordine in
   cui si mangia, e quindi anche quello in cui si mostra. */
export const PASTI = ['pranzo', 'cena'];
export const NOME_PASTO = { pranzo: 'Pranzo', cena: 'Cena' };

/* La forma di un pasto. "secondoContorno" è nata per la cena, ma nessuno
   vieta di usarla a pranzo. */
export const MODALITA = ['unico', 'primoSecondo', 'secondoContorno'];
export const NOME_MODALITA = {
  unico: 'piatto unico',
  primoSecondo: 'primo + secondo',
  secondoContorno: 'secondo + contorno'
};
/* Quali tipi di piatto compongono ogni forma, nell'ordine in cui si servono. */
export const TIPI_MODALITA = {
  unico: ['unico'],
  primoSecondo: ['primo', 'secondo'],
  secondoContorno: ['secondo', 'contorno']
};
export const REPARTI = ['ortofrutta', 'macelleria', 'pescheria', 'latticini',
                        'panetteria', 'dispensa', 'surgelati', 'altro'];

/**
 * Quanto ci vuole di un ingrediente perché il piatto "copra" quel macro.
 * Le specifiche danno le soglie in grammi; per i millilitri valgono le stesse
 * e per i pezzi basta un pezzo intero (2 uova = proteina, mezza cipolla no —
 * ma la cipolla è condimento, quindi non entra comunque nel conto).
 */
export const SOGLIE_MACRO = {
  proteina:    { g: 80, ml: 80, pz: 1 },
  carboidrato: { g: 30, ml: 30, pz: 1 },
  fibra:       { g: 30, ml: 30, pz: 1 }
};

export function preferenzePredefinite() {
  return {
    chiave: 'preferenze',
    porzioni: 1,
    giorni: ['lun', 'mar', 'mer', 'gio', 'ven'],
    pasti: ['pranzo', 'cena'],
    tempoMaxMin: 40,            // il pranzo
    tempoMaxCena: 0,            // 0 = la cena non ha limite di tempo
    tempoMaxPerGiorno: {},      // eccezioni al tempo del pranzo, giorno per giorno
    avanziASettimana: 1,        // cene fatte con gli avanzi del pranzo
    quotaNovita: 2,
    cooldownSettimane: 4,
    maxGiorniPrimoSecondo: 3,
    escludiPiatti: [],
    escludiIngredienti: [],
    amoPiatti: [],
    amoIngredienti: [],
    ordineReparti: REPARTI.slice(),
    tema: 'chiaro'         // 'scuro' e 'auto' si scelgono dalle impostazioni
  };
}

/* ------------------------------------------------------------ indici ----- */

/** Da array a mappa per id: serve a tutte le funzioni che seguono. */
export function indicizza(righe, campo = 'id') {
  const m = new Map();
  for (const r of righe) m.set(r[campo], r);
  return m;
}

/* -------------------------------------------------- conversioni unità ----
   Ogni ingrediente ha un'unità canonica. Le ricette possono usare misure
   alternative ("1 barattolo", "1 fetta"): qui si torna sempre alla canonica,
   perché la lista della spesa somma solo unità omogenee.                  */

export class ErroreUnita extends Error {}

export function inCanonica(ingrediente, qta, unita) {
  if (!ingrediente) throw new ErroreUnita('ingrediente sconosciuto');
  if (typeof qta !== 'number' || !isFinite(qta) || qta < 0) {
    throw new ErroreUnita(`quantità non valida: ${qta}`);
  }
  if (!unita || unita === ingrediente.unita) return qta;

  const conversioni = ingrediente.conversioni || [];
  const trovata = conversioni.find((c) => c.label === unita);
  if (trovata) return qta * trovata.fattore;

  throw new ErroreUnita(
    `unità "${unita}" non convertibile per ${ingrediente.id}: ` +
    `canonica "${ingrediente.unita}", alternative ${conversioni.map((c) => c.label).join(', ') || 'nessuna'}`
  );
}

/** Quantità di un ingrediente in un piatto, in unità canonica e per N porzioni. */
export function qtaCanonicaVoce(voce, ingrediente, porzioni = 1) {
  return inCanonica(ingrediente, voce.qta, voce.unita) * porzioni;
}

/* ----------------------------------------------------------- macro ------- */

/**
 * Macro coperti da un piatto, calcolati dagli ingredienti: non si salva mai
 * sul piatto, così se cambio un ingrediente il piatto si aggiorna da sé.
 */
export function macroCoperti(piatto, indiceIngredienti) {
  const coperti = new Set();
  for (const voce of piatto.ingredienti || []) {
    const ing = indiceIngredienti.get(voce.ingredienteId);
    if (!ing) continue;
    const soglia = SOGLIE_MACRO[ing.macro];
    if (!soglia) continue;                       // grasso e condimento non contano
    let qta;
    try { qta = inCanonica(ing, voce.qta, voce.unita); } catch (e) { continue; }
    if (qta >= soglia[ing.unita]) coperti.add(ing.macro);
  }
  return MACRO_NUTRIENTI.filter((m) => coperti.has(m));
}

/** La copertura è del pranzo, non del piatto: si guarda l'unione. */
export function macroCopertiGiorno(piatti, indiceIngredienti) {
  const unione = new Set();
  for (const p of piatti) for (const m of macroCoperti(p, indiceIngredienti)) unione.add(m);
  return MACRO_NUTRIENTI.filter((m) => unione.has(m));
}

export function macroMancanti(piatti, indiceIngredienti) {
  const coperti = new Set(macroCopertiGiorno(piatti, indiceIngredienti));
  return MACRO_NUTRIENTI.filter((m) => !coperti.has(m));
}

export function giornoCompleto(piatti, indiceIngredienti) {
  return macroMancanti(piatti, indiceIngredienti).length === 0;
}

/* ------------------------------------------------- proteina principale ---
   Serve al vincolo "mai la stessa proteina in due giorni consecutivi".
   Si confronta la famiglia (pollame, manzo, pesce, uova, legumi...), non
   l'ingrediente: altrimenti petto e cosce di pollo sarebbero "diversi".   */

export function famigliaProteinaPrincipale(piatto, indiceIngredienti) {
  let migliore = null, maxQta = 0;
  for (const voce of piatto.ingredienti || []) {
    const ing = indiceIngredienti.get(voce.ingredienteId);
    if (!ing || ing.macro !== 'proteina') continue;
    let qta;
    try { qta = inCanonica(ing, voce.qta, voce.unita); } catch (e) { continue; }
    // i pezzi non sono confrontabili con i grammi: si normalizza a "porzioni di soglia"
    const peso = qta / SOGLIE_MACRO.proteina[ing.unita];
    if (peso > maxQta) { maxQta = peso; migliore = ing.famiglia || ing.id; }
  }
  return migliore;
}

export function famiglieProteine(piatto, indiceIngredienti) {
  const out = new Set();
  for (const voce of piatto.ingredienti || []) {
    const ing = indiceIngredienti.get(voce.ingredienteId);
    if (ing && ing.macro === 'proteina' && ing.famiglia) out.add(ing.famiglia);
  }
  return [...out];
}

export function fibrePrincipali(piatto, indiceIngredienti) {
  const out = new Set();
  for (const voce of piatto.ingredienti || []) {
    const ing = indiceIngredienti.get(voce.ingredienteId);
    if (ing && ing.macro === 'fibra') out.add(ing.id);
  }
  return [...out];
}

/* ------------------------------------------------------------- pasti -----
   Il menù della 1.x aveva un solo pasto per giorno, scritto direttamente
   dentro il giorno. Dalla 2.0 i pasti stanno in `pasti`, uno per chiave.
   Si legge sempre passando da qui, così i menù vecchi continuano ad aprirsi
   senza toccare l'archivio.                                              */

export const FORMATO_MENU = 2;

/** Un pasto pulito, con i campi che servono e niente altro. */
export function pastoPulito(grezzo) {
  const x = grezzo || {};
  return {
    modalita: MODALITA.includes(x.modalita) ? x.modalita : 'unico',
    piatti: (x.piatti || []).slice(),
    bloccato: !!x.bloccato,
    // 'pranzo' significa: questa è la cena fatta con gli avanzi del pranzo
    avanziDa: x.avanziDa || null
  };
}

/** Porta un menù di qualunque versione alla forma di adesso. */
export function normalizzaMenu(menu) {
  if (!menu) return menu;
  const giorni = (menu.giorni || []).map((g) => {
    const pasti = {};
    if (g.pasti) {
      for (const nome of PASTI) if (g.pasti[nome]) pasti[nome] = pastoPulito(g.pasti[nome]);
    } else {
      // formato 1: il giorno *era* il pranzo
      pasti.pranzo = pastoPulito(g);
    }
    return { giorno: g.giorno, data: g.data || null, pasti };
  });
  return Object.assign({}, menu, { formato: FORMATO_MENU, giorni });
}

/** I pasti di un giorno, nell'ordine in cui si mangiano: [[nome, pasto]]. */
export function pastiDi(giorno) {
  const pasti = (giorno && giorno.pasti) || {};
  return PASTI.filter((nome) => pasti[nome]).map((nome) => [nome, pasti[nome]]);
}

/** Tutti gli id dei piatti di un giorno, pasti compresi. */
export function piattiDelGiorno(giorno) {
  return pastiDi(giorno).flatMap(([, pasto]) => pasto.piatti || []);
}

/**
 * Com'è messa la giornata: cosa coprono i due pasti messi insieme e cosa
 * manca. Dalla 2.0 non è più un obbligo, è un'informazione da mostrare.
 */
export function macroDellaGiornata(giorno, indicePiatti, indiceIngredienti) {
  const piatti = piattiDelGiorno(giorno)
    .map((id) => indicePiatti.get(id)).filter(Boolean);
  return {
    coperti: macroCopertiGiorno(piatti, indiceIngredienti),
    mancanti: macroMancanti(piatti, indiceIngredienti)
  };
}

/* ------------------------------------------------------ disponibilità ---- */

export function mesecorrente(data = new Date()) { return data.getMonth() + 1; }

/**
 * Perché un piatto non può entrare nel menù. Restituisce null se va bene,
 * altrimenti {codice, motivo}: il catalogo mostra il motivo all'utente.
 * La blacklist non si rilassa mai, in nessun ramo del codice.
 */
export function motivoIndisponibilita(piatto, contesto) {
  const { indiceIngredienti, preferenze, mese } = contesto;
  const pref = preferenze || preferenzePredefinite();

  if (piatto.attivo === false) return { codice: 'archiviato', motivo: 'piatto archiviato' };

  if ((pref.escludiPiatti || []).includes(piatto.id)) {
    return { codice: 'piattoEscluso', motivo: 'è nella lista dei piatti che escludi' };
  }

  for (const voce of piatto.ingredienti || []) {
    if ((pref.escludiIngredienti || []).includes(voce.ingredienteId)) {
      const ing = indiceIngredienti.get(voce.ingredienteId);
      return {
        codice: 'ingredienteEscluso',
        motivo: `contiene ${ing ? ing.nome.toLowerCase() : voce.ingredienteId}, che escludi`
      };
    }
  }

  if (mese) {
    for (const voce of piatto.ingredienti || []) {
      const ing = indiceIngredienti.get(voce.ingredienteId);
      if (!ing) continue;
      const stagioni = ing.stagioni || [];
      if (stagioni.length && !stagioni.includes(mese)) {
        return { codice: 'fuoriStagione', motivo: `${ing.nome.toLowerCase()} è fuori stagione` };
      }
    }
  }
  return null;
}

/* -------------------------------------------------------- validazione ---- */

const numeroPositivo = (v) => typeof v === 'number' && isFinite(v) && v > 0;

export function validaIngrediente(x) {
  const errori = [];
  if (!x || typeof x !== 'object') return { ok: false, errori: ['non è un oggetto'] };
  if (!x.id || typeof x.id !== 'string') errori.push('id mancante');
  if (!x.nome || typeof x.nome !== 'string') errori.push('nome mancante');
  if (!MACRO.includes(x.macro)) errori.push(`macro non valido: ${x.macro}`);
  if (!UNITA.includes(x.unita)) errori.push(`unità non valida: ${x.unita}`);
  if (!REPARTI.includes(x.reparto)) errori.push(`reparto non valido: ${x.reparto}`);
  if (!x.formatoAcquisto || !numeroPositivo(x.formatoAcquisto.qta)) {
    errori.push('formatoAcquisto mancante o non positivo');
  }
  for (const c of x.conversioni || []) {
    if (!c.label || !numeroPositivo(c.fattore)) errori.push(`conversione non valida: ${JSON.stringify(c)}`);
  }
  for (const m of x.stagioni || []) {
    if (!Number.isInteger(m) || m < 1 || m > 12) errori.push(`mese non valido: ${m}`);
  }
  if (x.macro === 'proteina' && !x.famiglia) errori.push('proteina senza famiglia');
  return { ok: errori.length === 0, errori };
}

export function validaPiatto(x, indiceIngredienti) {
  const errori = [];
  if (!x || typeof x !== 'object') return { ok: false, errori: ['non è un oggetto'] };
  if (!x.id || typeof x.id !== 'string') errori.push('id mancante');
  if (!x.nome || typeof x.nome !== 'string') errori.push('nome mancante');
  if (!TIPI_PIATTO.includes(x.tipo)) errori.push(`tipo non valido: ${x.tipo}`);
  if (!Array.isArray(x.ingredienti) || x.ingredienti.length === 0) errori.push('senza ingredienti');
  if (!numeroPositivo(x.tempoMin)) errori.push('tempoMin non valido');
  if (![1, 2, 3].includes(x.difficolta)) errori.push(`difficoltà non valida: ${x.difficolta}`);
  if (!Array.isArray(x.passi) || x.passi.length === 0) errori.push('senza passi');
  if (x.origine && !ORIGINI.includes(x.origine)) errori.push(`origine non valida: ${x.origine}`);

  for (const voce of x.ingredienti || []) {
    if (!voce.ingredienteId) { errori.push('voce senza ingredienteId'); continue; }
    if (!numeroPositivo(voce.qta)) errori.push(`quantità non valida per ${voce.ingredienteId}`);
    if (indiceIngredienti) {
      const ing = indiceIngredienti.get(voce.ingredienteId);
      if (!ing) { errori.push(`ingrediente sconosciuto: ${voce.ingredienteId}`); continue; }
      try { inCanonica(ing, voce.qta, voce.unita); }
      catch (e) { errori.push(e.message); }
    }
  }
  return { ok: errori.length === 0, errori };
}

export function validaVoto(x) {
  const errori = [];
  if (!x || typeof x !== 'object') return { ok: false, errori: ['non è un oggetto'] };
  if (!x.piattoId) errori.push('piattoId mancante');
  if (!Number.isInteger(x.stelle) || x.stelle < 1 || x.stelle > 5) errori.push('stelle fuori da 1-5');
  if (x.motivo && !MOTIVI_VOTO.includes(x.motivo)) errori.push(`motivo non valido: ${x.motivo}`);
  if (!x.data || !/^\d{4}-\d{2}-\d{2}$/.test(x.data)) errori.push('data non valida (atteso AAAA-MM-GG)');
  return { ok: errori.length === 0, errori };
}

/* ---------------------------------------------------------- formattazione */

/**
 * Plurale delle unità "parlate": "2 cucchiai", non "2 cucchiaio".
 * Solo le etichette che compaiono davvero nelle ricette — niente
 * grammatica generale, che sbaglierebbe più di quanto aggiusti.
 */
const PLURALE_UNITA = {
  fetta: 'fette', fettina: 'fettine', filetto: 'filetti', coscia: 'cosce',
  salsiccia: 'salsicce', scatoletta: 'scatolette', barattolo: 'barattoli',
  vasetto: 'vasetti', bicchiere: 'bicchieri', panetto: 'panetti',
  mozzarella: 'mozzarelle', patata: 'patate', zucchina: 'zucchine',
  melanzana: 'melanzane', peperone: 'peperoni', pomodoro: 'pomodori',
  carota: 'carote', finocchio: 'finocchi', costa: 'coste', noce: 'noci',
  mazzetto: 'mazzetti', rametto: 'rametti', foglia: 'foglie', foglie: 'foglie',
  cucchiaio: 'cucchiai', cucchiaino: 'cucchiaini', presa: 'prese',
  pizzico: 'pizzichi', grattata: 'grattate', spicchio: 'spicchi',
  testa: 'teste', confezione: 'confezioni', busta: 'buste', mazzo: 'mazzi'
};

/** L'unità come va scritta accanto a quel numero. */
export function etichettaUnita(unita, qta) {
  if (qta === 1 || !PLURALE_UNITA[unita]) return unita;
  return PLURALE_UNITA[unita];
}

/** "400 g", "2 pz", "1,5 pz", "2 cucchiai": virgola decimale e plurali. */
export function formattaQta(qta, unita) {
  const arrotondato = Math.round(qta * 100) / 100;
  const testo = Number.isInteger(arrotondato)
    ? String(arrotondato)
    : String(arrotondato).replace('.', ',');
  return `${testo} ${etichettaUnita(unita, arrotondato)}`;
}

export function formattaTempo(minuti) {
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.floor(minuti / 60), resto = minuti % 60;
  return resto ? `${ore} h ${resto} min` : `${ore} h`;
}

export const ETICHETTA_MACRO = { proteina: 'P', carboidrato: 'C', fibra: 'F' };
export const NOME_MACRO = { proteina: 'proteine', carboidrato: 'carboidrati', fibra: 'fibre' };
