/* =========================================================================
   ai-import.js — farsi aiutare da un'AI qualunque, senza account e senza
   chiavi: l'app scrive il prompt, tu lo incolli dove vuoi (ChatGPT, Gemini,
   Claude, anche gratis), poi riporti la risposta e l'app la controlla.

   Due sole regole:
   - si è generosi nel *leggere* (le AI gratuite mettono i blocchi ```, un
     saluto prima e una spiegazione dopo: si perdona tutto);
   - si è severi nel *salvare* (niente entra in archivio senza passare la
     validazione, e la blacklist non si rilassa mai).

   Funzioni pure: nessun accesso al database, nessuna rete.
   ========================================================================= */

import * as M from './model.js';
import * as G from './tastes.js';

/* ============================================================== il prompt */

/** Come chiediamo gli ingredienti: nomi comuni e unità semplici. */
const UNITA_CHIESTE = 'g, ml, pz';

/**
 * Il prompt da incollare nell'AI. Corto di proposito: le liste lunghe
 * (80 piatti, 107 ingredienti) non servono — i doppioni li riconosce l'app
 * al momento dell'importazione, e per gli ingredienti basta il nome comune.
 *
 * @param ctx { piatti, indiceIngredienti, preferenze, voti, ultimaVolta, mese }
 * @param opzioni { quanti, richiesta }
 */
export function creaPrompt(ctx, opzioni = {}) {
  const pref = ctx.preferenze || M.preferenzePredefinite();
  const quanti = opzioni.quanti || 5;
  const mese = ctx.mese || M.mesecorrente();
  const righe = [];

  righe.push(`Propongimi ${quanti} idee per il pranzo, una persona, una porzione a testa.`);
  righe.push('');
  righe.push('Come sono fatti i miei pranzi:');
  righe.push('- ogni pranzo deve avere proteine, carboidrati e fibre;');
  righe.push(`- "tipo" può essere: unico (piatto completo da solo), primo, secondo, contorno;`);
  righe.push(`- tempo massimo di preparazione ${pref.tempoMaxMin} minuti;`);
  righe.push(`- siamo nel mese ${mese}: usa ingredienti di stagione;`);
  righe.push('- cucina italiana di casa, ingredienti che si trovano al supermercato.');

  const amati = nomi(pref.amoIngredienti, ctx.indiceIngredienti);
  const esclusi = nomi(pref.escludiIngredienti, ctx.indiceIngredienti);
  const piaciuti = piattiPiuVotati(ctx, 4, 4);
  const bocciati = piattiPiuVotati(ctx, 1, 2.4);

  if (amati.length || esclusi.length || piaciuti.length || bocciati.length) {
    righe.push('');
    righe.push('I miei gusti:');
    if (amati.length) righe.push(`- mi piacciono molto: ${amati.join(', ')};`);
    if (esclusi.length) righe.push(`- NON usare, per nessun motivo: ${esclusi.join(', ')};`);
    if (piaciuti.length) righe.push(`- piatti che ho apprezzato: ${piaciuti.join(', ')};`);
    if (bocciati.length) righe.push(`- piatti che non mi sono piaciuti: ${bocciati.join(', ')};`);
  }

  if (opzioni.richiesta && opzioni.richiesta.trim()) {
    righe.push('');
    righe.push('In più, oggi: ' + opzioni.richiesta.trim());
  }

  righe.push('');
  righe.push('Rispondi SOLO con un array JSON, senza testo prima o dopo, in questa forma:');
  righe.push('');
  righe.push(esempioJson());
  righe.push('');
  righe.push(`Regole del JSON: quantità per UNA porzione; "unita" solo tra ${UNITA_CHIESTE}; ` +
             '"tempoMin" in minuti; "difficolta" da 1 a 3; "stagioni" i numeri dei mesi ' +
             'in cui ha senso (array vuoto se va tutto l\'anno); "passi" brevi, ' +
             'in italiano, uno per riga; per gli ingredienti usa i nomi comuni del ' +
             'supermercato ("Petto di pollo", "Pasta corta", "Pomodorini"), non marche ' +
             'né descrizioni.');

  return righe.join('\n');
}

/* L'esempio è scritto a mano e compatto: quaranta righe indentate in una
   chat si leggono male. Una prova controlla che sia JSON valido e che l'app
   sappia importarlo, così l'esempio non può marcire. */
function esempioJson() {
  return [
    '[',
    ' {',
    '  "nome": "Farro con zucchine e feta",',
    '  "tipo": "unico",',
    '  "tempoMin": 25,',
    '  "difficolta": 1,',
    '  "stagioni": [6, 7, 8],',
    '  "tags": ["estate"],',
    '  "ingredienti": [',
    '   {"nome": "Farro perlato", "qta": 80, "unita": "g"},',
    '   {"nome": "Zucchine", "qta": 150, "unita": "g"},',
    '   {"nome": "Feta", "qta": 90, "unita": "g"}',
    '  ],',
    '  "passi": ["Lessa il farro.", "Salta le zucchine.", "Unisci la feta a cubetti."]',
    ' }',
    ']'
  ].join('\n');
}

function nomi(ids, indice) {
  return (ids || []).map((id) => (indice.get(id) || {}).nome).filter(Boolean);
}

/** I piatti con media sopra/sotto una soglia: servono come esempio di gusto. */
function piattiPiuVotati(ctx, quanti, soglia) {
  const righe = [];
  for (const piatto of ctx.piatti || []) {
    const media = G.votoMedio((ctx.voti || {})[piatto.id]);
    if (media == null) continue;
    if (soglia >= 3 ? media >= soglia : media <= soglia) righe.push({ nome: piatto.nome, media });
  }
  righe.sort((a, b) => (soglia >= 3 ? b.media - a.media : a.media - b.media));
  return righe.slice(0, quanti).map((r) => r.nome);
}

/* =========================================================== la risposta */

/**
 * Estrae il JSON da quello che l'AI ha risposto: blocchi ```json, saluti,
 * spiegazioni finali, un solo piatto invece di un array, una chiave
 * "piatti" che avvolge tutto. Lancia con un messaggio leggibile.
 */
export function estraiJson(testo) {
  if (!testo || !testo.trim()) throw new Error('Non c\'è niente da leggere.');
  let grezzo = testo.trim();

  // blocco markdown: si tiene solo il contenuto
  const blocco = grezzo.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (blocco) grezzo = blocco[1].trim();

  // altrimenti si taglia dal primo [ o { all'ultimo ] o }
  if (!/^[[{]/.test(grezzo)) {
    const primo = grezzo.search(/[[{]/);
    if (primo < 0) throw new Error('Non trovo il JSON nella risposta.');
    grezzo = grezzo.slice(primo);
  }
  const ultimo = Math.max(grezzo.lastIndexOf(']'), grezzo.lastIndexOf('}'));
  if (ultimo > 0) grezzo = grezzo.slice(0, ultimo + 1);

  let dati;
  try {
    dati = JSON.parse(grezzo);
  } catch (e) {
    throw new Error('Il JSON non è valido: ' + e.message);
  }

  if (Array.isArray(dati)) return dati;
  if (dati && typeof dati === 'object') {
    for (const chiave of ['piatti', 'dishes', 'ricette', 'proposte', 'data']) {
      if (Array.isArray(dati[chiave])) return dati[chiave];
    }
    return [dati];                       // un piatto solo, senza array
  }
  throw new Error('La risposta non contiene piatti.');
}

/* ------------------------------------------------- nomi degli ingredienti */

/** Chiave di confronto: senza accenti, minuscola, spazi normalizzati. */
export function chiaveNome(testo) {
  return String(testo || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Radice grezza per accettare singolare e plurale ("zucchina"/"zucchine"). */
function radice(chiave) {
  return chiave.split(' ').map((p) => p.replace(/[aeio]$/, '')).join(' ');
}

/**
 * Cerca l'ingrediente per nome. Prima uguaglianza, poi radice, poi il nome
 * contenuto: "pasta" trova "Pasta corta" solo se non c'è niente di meglio.
 */
export function cercaIngrediente(nome, ingredienti) {
  const chiave = chiaveNome(nome);
  if (!chiave) return null;

  let trovato = ingredienti.find((i) => chiaveNome(i.nome) === chiave);
  if (trovato) return trovato;

  const r = radice(chiave);
  trovato = ingredienti.find((i) => radice(chiaveNome(i.nome)) === r);
  if (trovato) return trovato;

  const contenuti = ingredienti.filter((i) => {
    const k = chiaveNome(i.nome);
    return k.includes(chiave) || chiave.includes(k);
  });
  if (contenuti.length === 1) return contenuti[0];
  if (contenuti.length > 1) {
    // il più corto è il più generico: "Pasta corta" batte "Pasta all'uovo"
    return contenuti.slice().sort((a, b) => a.nome.length - b.nome.length)[0];
  }
  return null;
}

/** Id per un piatto o un ingrediente nuovo, leggibile e senza collisioni. */
export function idDa(prefisso, nome, giaPresi = new Set()) {
  const base = chiaveNome(nome).replace(/ /g, '_').slice(0, 40) || 'nuovo';
  let id = `${prefisso}_${base}`;
  let n = 2;
  while (giaPresi.has(id)) id = `${prefisso}_${base}_${n++}`;
  return id;
}

/* ============================================================ l'esame ==== */

/**
 * Trasforma una proposta grezza in qualcosa che si può guardare e decidere:
 *
 *   { nome, piatto, ingredientiNuovi[], problemi[], avvisi[], blacklist[],
 *     duplicato, accettabile }
 *
 * `piatto` è già nella forma dell'archivio, ma con gli id degli ingredienti
 * nuovi ancora "provvisori": si scrivono solo se accetti.
 */
export function esamina(grezzo, ctx) {
  const pref = ctx.preferenze || M.preferenzePredefinite();
  const problemi = [], avvisi = [], blacklist = [];
  const ingredientiNuovi = [];

  const nome = testoDi(grezzo, ['nome', 'name', 'titolo', 'title']);
  if (!nome) return { nome: '(senza nome)', problemi: ['manca il nome del piatto'], accettabile: false };

  const tipo = tipoValido(testoDi(grezzo, ['tipo', 'type', 'categoria']));
  if (!tipo) problemi.push(`tipo non riconosciuto: "${testoDi(grezzo, ['tipo', 'type', 'categoria'])}"`);

  const tempoMin = numeroDi(grezzo, ['tempoMin', 'tempo', 'tempoMinuti', 'minuti', 'time']);
  if (!tempoMin) problemi.push('manca il tempo di preparazione');

  const passi = listaTesti(grezzo, ['passi', 'procedimento', 'steps', 'preparazione', 'istruzioni']);
  if (!passi.length) problemi.push('manca il procedimento');

  const vociGrezze = listaOggetti(grezzo, ['ingredienti', 'ingredients']);
  if (!vociGrezze.length) problemi.push('manca l\'elenco degli ingredienti');

  // ingredienti: si cerca per nome, il resto diventa "da completare"
  const voci = [];
  const idsPresi = new Set(ctx.ingredienti.map((i) => i.id));
  for (const voce of vociGrezze) {
    const nomeIng = testoDi(voce, ['nome', 'name', 'ingrediente', 'ingredient']) ||
                    (typeof voce === 'string' ? voce : '');
    if (!nomeIng) { problemi.push('un ingrediente senza nome'); continue; }

    const qta = numeroDi(voce, ['qta', 'quantita', 'quantità', 'quantity', 'q']) ||
                numeroInTesto(testoDi(voce, ['qta', 'quantita', 'quantità', 'quantity']));
    const unitaChiesta = normalizzaUnita(testoDi(voce, ['unita', 'unità', 'unit', 'um']));

    const trovato = cercaIngrediente(nomeIng, ctx.ingredienti);
    if (trovato) {
      const risolta = risolviQuantita(trovato, qta, unitaChiesta);
      if (!qta) problemi.push(`${trovato.nome}: quantità mancante`);
      else if (!risolta) problemi.push(`${trovato.nome}: unità "${unitaChiesta}" non convertibile`);
      else voci.push({ ingredienteId: trovato.id, qta: risolta.qta, unita: risolta.unita });

      if ((pref.escludiIngredienti || []).includes(trovato.id)) blacklist.push(trovato.nome);
      continue;
    }

    // ingrediente nuovo: l'app non inventa macro e reparto, li chiede
    const id = idDa('ing', nomeIng, idsPresi);
    idsPresi.add(id);
    const inMl = IN_ML[chiaveNome(unitaChiesta)];
    const unita = M.UNITA.includes(unitaChiesta) ? unitaChiesta : (inMl ? 'ml' : 'g');
    const qtaFinale = inMl ? qta * inMl : qta;
    ingredientiNuovi.push({
      id, nome: ripulisciNome(nomeIng), macro: '', unita,
      reparto: '', formatoAcquisto: { qta: qta && qta > 0 ? arrotondaFormato(qta, unita) : 500 },
      conversioni: [], stagioni: [], origine: 'ai'
    });
    if (!qtaFinale) problemi.push(`${nomeIng}: quantità mancante`);
    else voci.push({ ingredienteId: id, qta: qtaFinale, unita });
  }

  const piatto = {
    id: idDa('pia', nome, new Set(ctx.piatti.map((p) => p.id))),
    nome: ripulisciNome(nome),
    tipo: tipo || 'unico',
    tempoMin: tempoMin || 30,
    difficolta: difficoltaValida(numeroDi(grezzo, ['difficolta', 'difficoltà', 'difficulty'])),
    stagioni: mesiValidi(grezzo),
    tags: listaTesti(grezzo, ['tags', 'tag', 'etichette']).slice(0, 4),
    ingredienti: voci,
    passi,
    origine: 'ai',
    attivo: true
  };

  // doppione: si guarda il nome, non l'id
  const chiave = chiaveNome(piatto.nome);
  const duplicato = (ctx.piatti || []).find((p) => chiaveNome(p.nome) === chiave) || null;
  if (duplicato) problemi.push(`"${duplicato.nome}" è già in catalogo`);

  // la blacklist non si rilassa mai: il piatto non è accettabile, punto
  for (const nomeEscluso of blacklist) {
    problemi.push(`contiene ${nomeEscluso.toLowerCase()}, che escludi`);
  }

  // copertura dei macro: solo un avviso, si può accettare comunque
  if (!ingredientiNuovi.length && voci.length) {
    const mancanti = M.macroMancanti([piatto], ctx.indiceIngredienti);
    if (piatto.tipo === 'unico' && mancanti.length) {
      avvisi.push('come piatto unico non copre ' + mancanti.map((m) => M.NOME_MACRO[m]).join(' e '));
    }
  }
  if (ingredientiNuovi.length) {
    avvisi.push(ingredientiNuovi.length === 1
      ? 'un ingrediente è nuovo: dimmi cos\'è'
      : `${ingredientiNuovi.length} ingredienti sono nuovi: dimmi cosa sono`);
  }
  if (tempoMin && tempoMin > (pref.tempoMaxMin || 40)) {
    avvisi.push(`più lungo dei tuoi ${pref.tempoMaxMin} minuti`);
  }

  return {
    nome: piatto.nome, piatto, ingredientiNuovi, problemi, avvisi, blacklist,
    duplicato: duplicato ? duplicato.id : null,
    accettabile: problemi.length === 0
  };
}

/** Esamina tutta la risposta in un colpo. */
export function esaminaTutti(grezzi, ctx) {
  const visti = new Set();
  const out = [];
  for (const g of grezzi) {
    const esito = esamina(g, ctx);
    const chiave = chiaveNome(esito.nome);
    if (visti.has(chiave)) continue;          // l'AI a volte ripete lo stesso piatto
    visti.add(chiave);
    out.push(esito);
  }
  return out;
}

/**
 * Controllo finale prima di scrivere: qui non si perdona più niente.
 * @returns { ok, errori, piatto, ingredienti }
 */
export function preparaSalvataggio(esito, ctx) {
  const errori = [];
  if (!esito || !esito.piatto) return { ok: false, errori: ['niente da salvare'] };

  const nuovi = esito.ingredientiNuovi || [];
  for (const ing of nuovi) {
    const v = M.validaIngrediente(ing);
    if (!v.ok) errori.push(`${ing.nome}: ${v.errori.join('; ')}`);
  }

  const indice = new Map(ctx.indiceIngredienti);
  for (const ing of nuovi) indice.set(ing.id, ing);

  const v = M.validaPiatto(esito.piatto, indice);
  if (!v.ok) errori.push(...v.errori);

  // la blacklist si ricontrolla anche qui: è l'ultimo cancello
  const pref = ctx.preferenze || M.preferenzePredefinite();
  for (const voce of esito.piatto.ingredienti || []) {
    if ((pref.escludiIngredienti || []).includes(voce.ingredienteId)) {
      const ing = indice.get(voce.ingredienteId);
      errori.push(`contiene ${ing ? ing.nome.toLowerCase() : voce.ingredienteId}, che escludi`);
    }
  }

  return { ok: errori.length === 0, errori, piatto: esito.piatto, ingredienti: nuovi };
}

/* ------------------------------------------------------- letture generose */

function testoDi(oggetto, chiavi) {
  if (typeof oggetto === 'string') return oggetto.trim();
  if (!oggetto || typeof oggetto !== 'object') return '';
  for (const k of chiavi) {
    const v = oggetto[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

function numeroDi(oggetto, chiavi) {
  if (!oggetto || typeof oggetto !== 'object') return 0;
  for (const k of chiavi) {
    const v = oggetto[k];
    if (typeof v === 'number' && isFinite(v) && v > 0) return v;
    if (typeof v === 'string') {
      const n = numeroInTesto(v);
      if (n) return n;
    }
  }
  return 0;
}

/** "200 g", "1,5", "circa 80": si prende il primo numero. */
function numeroInTesto(testo) {
  const m = String(testo || '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  const n = m ? Number(m[0]) : 0;
  return isFinite(n) && n > 0 ? n : 0;
}

function listaTesti(oggetto, chiavi) {
  if (!oggetto || typeof oggetto !== 'object') return [];
  for (const k of chiavi) {
    const v = oggetto[k];
    if (Array.isArray(v)) {
      return v.map((x) => (typeof x === 'string' ? x : testoDi(x, ['testo', 'passo', 'step', 'text'])))
        .map((x) => String(x || '').trim()).filter(Boolean);
    }
    if (typeof v === 'string' && v.trim()) {
      return v.split(/\n+|(?:^|\s)\d+[.)]\s+/).map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

function listaOggetti(oggetto, chiavi) {
  if (!oggetto || typeof oggetto !== 'object') return [];
  for (const k of chiavi) {
    if (Array.isArray(oggetto[k])) return oggetto[k].filter((x) => x != null);
  }
  return [];
}

function tipoValido(testo) {
  const k = chiaveNome(testo);
  if (!k) return null;
  if (M.TIPI_PIATTO.includes(k)) return k;
  if (/unico|completo|piatto unico|main|one dish/.test(k)) return 'unico';
  if (/primo|pasta|zuppa|risotto/.test(k)) return 'primo';
  if (/secondo|proteina|main course/.test(k)) return 'secondo';
  if (/contorno|verdur|insalat|side/.test(k)) return 'contorno';
  return null;
}

function difficoltaValida(n) {
  const v = Math.round(n || 0);
  return v >= 1 && v <= 3 ? v : 1;
}

function mesiValidi(grezzo) {
  const v = grezzo && (grezzo.stagioni || grezzo.mesi || grezzo.seasons);
  if (!Array.isArray(v)) return [];
  const mesi = v.map((x) => Math.round(numeroInTesto(x) || Number(x)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
  return [...new Set(mesi)].sort((a, b) => a - b);
}

/** Le AI scrivono "grammi", "gr", "pezzi": si riporta a g / ml / pz. */
export function normalizzaUnita(testo) {
  const k = chiaveNome(testo);
  if (!k) return '';
  if (/^(g|gr|grammi|grammo)$/.test(k)) return 'g';
  if (/^(ml|millilitri|millilitro)$/.test(k)) return 'ml';
  if (/^(pz|pezzi|pezzo|numero|pc|piece|pieces)$/.test(k)) return 'pz';
  return k;                                  // "l", "cucchiaio", "spicchio": si vede dopo
}

/* Multipli del millilitro: capitano, e non sono conversioni dell'ingrediente. */
const IN_ML = { l: 1000, litro: 1000, litri: 1000, dl: 100, cl: 10 };

/**
 * Porta quantità e unità a qualcosa che l'archivio sa leggere: l'unità
 * canonica dell'ingrediente o una sua conversione dichiarata.
 * @returns { qta, unita } oppure null se non c'è modo di convertire
 */
function risolviQuantita(ingrediente, qta, unita) {
  if (!qta || qta <= 0) return null;
  if (!unita || unita === ingrediente.unita) return { qta, unita: ingrediente.unita };

  // litri e centilitri su un ingrediente in ml: si converte il numero
  const fattore = IN_ML[chiaveNome(unita)];
  if (fattore && ingrediente.unita === 'ml') return { qta: qta * fattore, unita: 'ml' };

  try { M.inCanonica(ingrediente, qta, unita); return { qta, unita }; } catch (e) { /* si prova ancora */ }

  // singolare/plurale delle etichette: "cucchiai" -> "cucchiaio"
  for (const c of ingrediente.conversioni || []) {
    if (radice(chiaveNome(c.label)) === radice(chiaveNome(unita))) return { qta, unita: c.label };
  }
  return null;
}

function ripulisciNome(testo) {
  const pulito = String(testo).replace(/\s+/g, ' ').trim().slice(0, 60);
  return pulito.charAt(0).toUpperCase() + pulito.slice(1);
}

/** Un formato d'acquisto plausibile: serve solo a non partire da zero. */
function arrotondaFormato(qta, unita) {
  if (unita === 'pz') return Math.max(1, Math.ceil(qta));
  if (qta <= 100) return 250;
  if (qta <= 250) return 500;
  return 1000;
}
