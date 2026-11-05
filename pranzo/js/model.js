/* =========================================================================
   model.js — schemi, validazione, unità, calorie e forma del menù.
   Nessun accesso al database: qui dentro sono solo funzioni pure, così si
   possono provare in isolamento (vedi test.html).
   ========================================================================= */

export const MACRO = ['proteina', 'carboidrato', 'fibra', 'grasso', 'condimento'];
/* Che cos'è un ingrediente: serve a riconoscere la proteina di un piatto
   e a chiedere le cose giuste quando un'AI ne porta uno nuovo. */
export const NOME_MACRO = {
  proteina: 'proteina', carboidrato: 'carboidrato', fibra: 'verdura o legume',
  grasso: 'grasso', condimento: 'condimento'
};
export const UNITA = ['g', 'ml', 'pz'];
export const TIPI_PIATTO = ['primo', 'secondo', 'contorno', 'unico'];
export const NOME_TIPO = {
  primo: 'primo', secondo: 'secondo', contorno: 'contorno', unico: 'piatto unico'
};
export const ORIGINI = ['base', 'ai', 'utente'];
export const GIORNI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
export const NOME_GIORNO = {
  lun: 'lunedì', mar: 'martedì', mer: 'mercoledì', gio: 'giovedì',
  ven: 'venerdì', sab: 'sabato', dom: 'domenica'
};
export const GIORNO_BREVE = {
  lun: 'Lun', mar: 'Mar', mer: 'Mer', gio: 'Gio', ven: 'Ven', sab: 'Sab', dom: 'Dom'
};

/* Due pasti al giorno, nell'ordine in cui si mangiano. */
export const PASTI = ['pranzo', 'cena'];
export const NOME_PASTO = { pranzo: 'Pranzo', cena: 'Cena' };

/* La regola della 3.0: a pranzo un primo o un piatto unico, a cena un
   secondo (che si porta dietro un contorno) o un piatto unico. Le zuppe
   sono piatti unici con l'etichetta "zuppa", e vanno bene la sera. */
export const TIPI_PASTO = {
  pranzo: ['primo', 'unico'],
  cena: ['secondo', 'unico']
};

/* Leggeri o sostanziosi: si confronta un piatto con gli altri del suo tipo. */
export const PESI = ['tutti', 'leggeri', 'sostanziosi'];
export const NOME_PESO = { tutti: 'Tutti', leggeri: 'Leggeri', sostanziosi: 'Sostanziosi' };

/* I minuti che si possono scegliere per un pasto. */
export const TEMPI = [15, 30, 45, 60, 90];

export const REPARTI = ['ortofrutta', 'macelleria', 'pescheria', 'latticini',
                        'panetteria', 'dispensa', 'surgelati', 'altro'];
export const NOME_REPARTO = {
  ortofrutta: 'Frutta e verdura', macelleria: 'Carne e salumi', pescheria: 'Pesce',
  latticini: 'Latticini e uova', panetteria: 'Pane', dispensa: 'Dispensa',
  surgelati: 'Surgelati', altro: 'Altro'
};

/* Quanto ci vuole di una proteina perché conti come "la" proteina del
   piatto: serve solo al vincolo "mai la stessa due pasti di fila". */
const SOGLIA_PROTEINA = { g: 80, ml: 80, pz: 1 };

export function preferenzePredefinite() {
  return {
    chiave: 'preferenze',
    nome: '',
    porzioni: 2,
    peso: 'tutti',
    giorni: GIORNI.slice(),
    pasti: ['pranzo', 'cena'],
    tempoMaxMin: 30,            // il pranzo, di solito
    tempoMaxCena: 45,           // la cena, di solito; 0 = nessun limite
    escludiPiatti: [],
    escludiIngredienti: [],
    amoPiatti: [],
    ordineReparti: REPARTI.slice(),
    tema: 'auto'
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

/* ----------------------------------------------------------- calorie -----
   Le calorie stanno sull'ingrediente (per 100 g o 100 ml, o per pezzo) e
   si sommano sul piatto: non si salvano mai sul piatto, così se cambio un
   ingrediente il piatto si aggiorna da sé. Un ingrediente senza calorie
   (importato senza il dato) semplicemente non conta.                     */

/** Calorie di una porzione del piatto, arrotondate. 0 se non si sa niente. */
export function kcalPiatto(piatto, indiceIngredienti) {
  if (!piatto) return 0;
  let totale = 0;
  for (const voce of piatto.ingredienti || []) {
    const ing = indiceIngredienti.get(voce.ingredienteId);
    if (!ing || typeof ing.kcal !== 'number') continue;
    let qta;
    try { qta = inCanonica(ing, voce.qta, voce.unita); } catch (e) { continue; }
    totale += ing.unita === 'pz' ? qta * ing.kcal : qta * ing.kcal / 100;
  }
  return Math.round(totale);
}

/** Calorie di un pasto (piatto più l'eventuale contorno), a persona. */
export function kcalPasto(pasto, indicePiatti, indiceIngredienti) {
  if (!pasto) return 0;
  return idsDelPasto(pasto)
    .reduce((s, id) => s + kcalPiatto(indicePiatti.get(id), indiceIngredienti), 0);
}

export function kcalGiorno(giorno, indicePiatti, indiceIngredienti) {
  return pastiDi(giorno)
    .reduce((s, [, pasto]) => s + kcalPasto(pasto, indicePiatti, indiceIngredienti), 0);
}

/**
 * La mediana delle calorie per tipo di piatto: è la riga che divide i
 * leggeri dai sostanziosi. Si calcola sul catalogo, così vale anche per i
 * piatti importati.
 * @returns Map tipo -> kcal
 */
export function medianeKcal(piatti, indiceIngredienti) {
  const perTipo = new Map();
  for (const p of piatti) {
    const k = kcalPiatto(p, indiceIngredienti);
    if (!k) continue;
    if (!perTipo.has(p.tipo)) perTipo.set(p.tipo, []);
    perTipo.get(p.tipo).push(k);
  }
  const out = new Map();
  for (const [tipo, valori] of perTipo) {
    valori.sort((a, b) => a - b);
    const m = Math.floor(valori.length / 2);
    out.set(tipo, valori.length % 2 ? valori[m] : (valori[m - 1] + valori[m]) / 2);
  }
  return out;
}

/** Il piatto passa il filtro "leggeri / sostanziosi"? */
export function passaPeso(piatto, peso, mediane, indiceIngredienti) {
  if (!peso || peso === 'tutti') return true;
  const soglia = mediane.get(piatto.tipo);
  const k = kcalPiatto(piatto, indiceIngredienti);
  if (!soglia || !k) return true;                // senza dati non si esclude
  return peso === 'leggeri' ? k <= soglia : k >= soglia;
}

/* ------------------------------------------------- proteina principale ---
   Serve al vincolo "mai la stessa proteina in due pasti di fila". Si
   confronta la famiglia (pollame, manzo, pesce, uova, legumi...), non
   l'ingrediente: altrimenti petto e cosce di pollo sarebbero "diversi".   */

export function famigliaProteinaPrincipale(piatto, indiceIngredienti) {
  if (!piatto) return null;
  let migliore = null, maxQta = 0;
  for (const voce of piatto.ingredienti || []) {
    const ing = indiceIngredienti.get(voce.ingredienteId);
    if (!ing || ing.macro !== 'proteina') continue;
    let qta;
    try { qta = inCanonica(ing, voce.qta, voce.unita); } catch (e) { continue; }
    // i pezzi non sono confrontabili con i grammi: si normalizza alla soglia
    const peso = qta / SOGLIA_PROTEINA[ing.unita];
    if (peso > maxQta) { maxQta = peso; migliore = ing.famiglia || ing.id; }
  }
  return migliore;
}

/* ------------------------------------------------- che cibo è ----------
   Quando un piatto non ha la foto, al suo posto c'è un disegno di che cosa
   c'è nel piatto: lo si capisce dal nome, dal tipo e dagli ingredienti.  */

export const CATEGORIE = ['pasta', 'cereali', 'pizza', 'zuppa', 'carne', 'pesce',
                          'uova', 'legumi', 'formaggio', 'verdura'];

const PASTA = new Set(['ing_pasta_corta', 'ing_spaghetti', 'ing_gnocchi', 'ing_tortellini']);
const CEREALI = new Set(['ing_riso', 'ing_riso_venere', 'ing_farro', 'ing_orzo', 'ing_bulgur',
                         'ing_cous_cous', 'ing_quinoa', 'ing_polenta']);
const PANE = new Set(['ing_base_pizza', 'ing_piadina', 'ing_focaccia', 'ing_tortilla', 'ing_pane_toast']);
const DA_FAMIGLIA = { pesce: 'pesce', pollame: 'carne', manzo: 'carne', maiale: 'carne', salumi: 'carne',
                      uova: 'uova', legumi: 'legumi', formaggio: 'formaggio', latticini: 'formaggio' };

export function categoriaPiatto(piatto, indiceIngredienti) {
  if (!piatto) return 'verdura';
  const nome = (piatto.nome || '').toLowerCase();
  const ids = (piatto.ingredienti || []).map((v) => v.ingredienteId);
  if ((piatto.tags || []).includes('zuppa') || /zupp|minestr|vellut|crema di/.test(nome)) return 'zuppa';
  if (ids.some((id) => PANE.has(id)) || /pizz|piadin|focacc|toast|panin|bruschett|wrap/.test(nome)) return 'pizza';
  if (piatto.tipo === 'contorno') return 'verdura';
  if (piatto.tipo !== 'secondo') {
    if (ids.some((id) => PASTA.has(id)) || /pasta|spaghett|penne|gnocch|tortell|lasagn/.test(nome)) return 'pasta';
    if (ids.some((id) => CEREALI.has(id)) || /riso|risott|farro|orzo|cous|quinoa|polent/.test(nome)) return 'cereali';
  }
  if (/pollo|tacchino|manzo|maiale|lonza|vitello|salsicc|polpett|hamburger|arrost|spezzatin|brasat/.test(nome)) return 'carne';
  if (/salmone|merluzzo|tonno|platessa|gamber|sgombro|alici|pesce/.test(nome)) return 'pesce';
  const famiglia = famigliaProteinaPrincipale(piatto, indiceIngredienti);
  return DA_FAMIGLIA[famiglia] || 'verdura';
}

/* --------------------------------------------------------- stagione ----- */

export function mesecorrente(data = new Date()) { return data.getMonth() + 1; }

/** Le verdure e la frutta del mese, per le etichette in prima pagina. */
export function verdureDiStagione(ingredienti, mese, quante = 6) {
  return ingredienti
    .filter((i) => i.reparto === 'ortofrutta' && (i.stagioni || []).length &&
                   i.stagioni.length < 12 && i.stagioni.includes(mese))
    .sort((a, b) => a.stagioni.length - b.stagioni.length)
    .slice(0, quante);
}

/** Un piatto è "di stagione" se lo dice lui o se usa una verdura del mese. */
export function diStagione(piatto, indiceIngredienti, mese) {
  if ((piatto.stagioni || []).includes(mese)) return true;
  return (piatto.ingredienti || []).some((v) => {
    const ing = indiceIngredienti.get(v.ingredienteId);
    return ing && (ing.stagioni || []).length && ing.stagioni.length < 12 && ing.stagioni.includes(mese);
  });
}

/* ------------------------------------------------------------- pasti -----
   Dalla 3.0 un pasto è un piatto, più un contorno quando il piatto è un
   secondo:
     { piatto: id, contorno: id|null, tempoMax: minuti|null, scelto: bool }
   "scelto" vuol dire che l'ha deciso l'utente: rigenerare la settimana non
   lo tocca. I menù della 2.x avevano un elenco di piatti per pasto e quelli
   della 1.x un solo pasto per giorno: si leggono sempre passando da qui.  */

export const FORMATO_MENU = 3;

/** Gli id di un pasto, piatto e contorno, nell'ordine in cui si servono. */
export function idsDelPasto(pasto) {
  if (!pasto) return [];
  return [pasto.piatto, pasto.contorno].filter(Boolean);
}

/** Un pasto pulito, con i campi che servono e niente altro. */
export function pastoPulito(grezzo, indicePiatti) {
  const x = grezzo || {};
  let piatto = x.piatto || null;
  let contorno = x.contorno || null;

  // formato 2: un elenco di piatti. Il primo che non è un contorno è il
  // piatto, il primo contorno resta contorno; il resto si lascia andare.
  if (!piatto && Array.isArray(x.piatti)) {
    const tipoDi = (id) => (indicePiatti && indicePiatti.get(id) || {}).tipo;
    const ids = x.piatti.filter(Boolean);
    piatto = ids.find((id) => tipoDi(id) !== 'contorno') || ids[0] || null;
    contorno = ids.find((id) => id !== piatto && tipoDi(id) === 'contorno') || null;
  }
  return {
    piatto,
    contorno,
    tempoMax: typeof x.tempoMax === 'number' && x.tempoMax > 0 ? x.tempoMax : null,
    scelto: !!(x.scelto || x.bloccato)
  };
}

/** Porta un menù di qualunque versione alla forma di adesso. */
export function normalizzaMenu(menu, indicePiatti) {
  if (!menu) return menu;
  const giorni = (menu.giorni || []).map((g) => {
    const pasti = {};
    if (g.pasti) {
      for (const nome of PASTI) {
        const p = g.pasti[nome];
        if (!p) continue;
        // una cena "avanzi del pranzo" della 2.x torna una cena normale
        const pulito = pastoPulito(p.avanziDa ? null : p, indicePiatti);
        if (pulito.piatto) pasti[nome] = pulito;
      }
    } else {
      // formato 1: il giorno *era* il pranzo
      const pulito = pastoPulito(g, indicePiatti);
      if (pulito.piatto) pasti.pranzo = pulito;
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

/** Tutti gli id dei piatti di un giorno, contorni compresi. */
export function piattiDelGiorno(giorno) {
  return pastiDi(giorno).flatMap(([, pasto]) => idsDelPasto(pasto));
}

/* ------------------------------------------------------ disponibilità ---- */

/**
 * Perché un piatto non può entrare nel menù. Restituisce null se va bene,
 * altrimenti {codice, motivo}: il catalogo mostra il motivo all'utente.
 * Gli esclusi non si rilassano mai, in nessun ramo del codice.
 */
export function motivoIndisponibilita(piatto, contesto) {
  const { indiceIngredienti, preferenze, mese } = contesto;
  const pref = preferenze || preferenzePredefinite();

  if (piatto.attivo === false) return { codice: 'archiviato', motivo: 'piatto archiviato' };

  if ((pref.escludiPiatti || []).includes(piatto.id)) {
    return { codice: 'piattoEscluso', motivo: 'l\'hai escluso' };
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
  if (x.kcal !== undefined && x.kcal !== null &&
      !(typeof x.kcal === 'number' && isFinite(x.kcal) && x.kcal >= 0)) {
    errori.push(`calorie non valide: ${x.kcal}`);
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
  // dal chilo in su si legge meglio in kg e in litri
  if ((unita === 'g' || unita === 'ml') && qta >= 1000) {
    const grande = Math.round(qta / 100) / 10;
    return `${String(grande).replace('.', ',')} ${unita === 'g' ? 'kg' : 'l'}`;
  }
  const arrotondato = Math.round(qta * 100) / 100;
  const testo = Number.isInteger(arrotondato)
    ? String(arrotondato)
    : String(arrotondato).replace('.', ',');
  return `${testo} ${etichettaUnita(unita, arrotondato)}`;
}

export function formattaTempo(minuti) {
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.floor(minuti / 60), resto = minuti % 60;
  return resto ? `${ore} h ${resto}` : `${ore} h`;
}
