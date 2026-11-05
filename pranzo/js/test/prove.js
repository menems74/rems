/* =========================================================================
   prove.js — prove automatiche delle parti dove è facile sbagliare:
   conversioni di unità, copertura dei macro (di pranzo, non di piatto),
   famiglia della proteina, blacklist e validazione.
   Si aprono da test.html, senza strumenti esterni.
   ========================================================================= */

import * as M from '../model.js';

const risultati = [];
function prova(nome, fn) {
  try { fn(); risultati.push({ nome, ok: true }); }
  catch (e) { risultati.push({ nome, ok: false, errore: e.message }); }
}

/* Alcune cose si possono provare solo davvero: ridimensionare una foto vuole
   il canvas del browser, che risponde quando gli pare. Queste prove si
   aspettano in fondo, con eseguiTutto(). */
const attese = [];
function provaAsync(nome, fn) {
  attese.push(Promise.resolve()
    .then(fn)
    .then(() => risultati.push({ nome, ok: true }))
    .catch((e) => risultati.push({ nome, ok: false, errore: e.message })));
}
function uguale(atteso, ottenuto, cosa = '') {
  const a = JSON.stringify(atteso), o = JSON.stringify(ottenuto);
  if (a !== o) throw new Error(`${cosa} atteso ${a}, ottenuto ${o}`);
}
function lancia(fn, cosa = '') {
  try { fn(); } catch (e) { return; }
  throw new Error(`${cosa}: doveva lanciare un errore`);
}

/* ---------------------------------------------------- dati di prova ------ */
const ING = M.indicizza([
  { id: 'ing_tonno', nome: 'Tonno', macro: 'proteina', unita: 'g', reparto: 'dispensa',
    formatoAcquisto: { qta: 160, label: '2 scatolette' },
    conversioni: [{ label: 'scatoletta', fattore: 80 }], stagioni: [], famiglia: 'pesce' },
  { id: 'ing_pasta', nome: 'Pasta', macro: 'carboidrato', unita: 'g', reparto: 'dispensa',
    formatoAcquisto: { qta: 500, label: 'confezione' }, conversioni: [], stagioni: [] },
  { id: 'ing_pomodorini', nome: 'Pomodorini', macro: 'fibra', unita: 'g', reparto: 'ortofrutta',
    formatoAcquisto: { qta: 500, label: 'vassoio' }, conversioni: [], stagioni: [] },
  { id: 'ing_uova', nome: 'Uova', macro: 'proteina', unita: 'pz', reparto: 'latticini',
    formatoAcquisto: { qta: 6, label: 'confezione' }, conversioni: [], stagioni: [], famiglia: 'uova' },
  { id: 'ing_pollo', nome: 'Pollo', macro: 'proteina', unita: 'g', reparto: 'macelleria',
    formatoAcquisto: { qta: 300, label: 'confezione' },
    conversioni: [{ label: 'fetta', fattore: 120 }], stagioni: [], famiglia: 'pollame' },
  { id: 'ing_asparagi', nome: 'Asparagi', macro: 'fibra', unita: 'g', reparto: 'ortofrutta',
    formatoAcquisto: { qta: 500, label: 'mazzo' }, conversioni: [], stagioni: [3, 4, 5] },
  { id: 'ing_olio', nome: 'Olio', macro: 'grasso', unita: 'ml', reparto: 'dispensa',
    formatoAcquisto: { qta: 1000, label: 'bottiglia' },
    conversioni: [{ label: 'cucchiaio', fattore: 10 }], stagioni: [] },
  { id: 'ing_cipolla', nome: 'Cipolla', macro: 'condimento', unita: 'pz', reparto: 'ortofrutta',
    formatoAcquisto: { qta: 3, label: 'retina' }, conversioni: [], stagioni: [] }
]);

const piatto = (id, tipo, ingredienti, extra = {}) => Object.assign({
  id, nome: id, tipo, ingredienti, tempoMin: 20, difficolta: 1, stagioni: [],
  passi: ['passo'], origine: 'base', tags: [], attivo: true
}, extra);

/* ------------------------------------------------- conversioni unità ---- */

prova('unità canonica: resta com\'è', () => {
  uguale(180, M.inCanonica(ING.get('ing_pollo'), 180, 'g'));
});
prova('unità mancante: si assume la canonica', () => {
  uguale(180, M.inCanonica(ING.get('ing_pollo'), 180, undefined));
});
prova('conversione con etichetta: 1 scatoletta = 80 g', () => {
  uguale(80, M.inCanonica(ING.get('ing_tonno'), 1, 'scatoletta'));
});
prova('conversione moltiplicata: 2,5 scatolette = 200 g', () => {
  uguale(200, M.inCanonica(ING.get('ing_tonno'), 2.5, 'scatoletta'));
});
prova('conversione su volume: 3 cucchiai = 30 ml', () => {
  uguale(30, M.inCanonica(ING.get('ing_olio'), 3, 'cucchiaio'));
});
prova('etichetta sconosciuta: errore, non silenzio', () => {
  lancia(() => M.inCanonica(ING.get('ing_tonno'), 1, 'barattolo'), 'barattolo su tonno');
});
prova('quantità negativa: errore', () => {
  lancia(() => M.inCanonica(ING.get('ing_pasta'), -10, 'g'), 'quantità negativa');
});
prova('quantità non numerica: errore', () => {
  lancia(() => M.inCanonica(ING.get('ing_pasta'), '100', 'g'), 'stringa al posto di numero');
});
prova('porzioni: la quantità si moltiplica dopo la conversione', () => {
  const voce = { ingredienteId: 'ing_tonno', qta: 1, unita: 'scatoletta' };
  uguale(160, M.qtaCanonicaVoce(voce, ING.get('ing_tonno'), 2));
});

/* -------------------------------------------- proteina principale ------- */

prova('la proteina principale è quella con più peso relativo', () => {
  const p = piatto('p11', 'unico', [
    { ingredienteId: 'ing_pollo', qta: 150, unita: 'g' },
    { ingredienteId: 'ing_uova', qta: 1, unita: 'pz' }
  ]);
  uguale('pollame', M.famigliaProteinaPrincipale(p, ING));
});
prova('senza proteine la famiglia è nulla', () => {
  const p = piatto('p12', 'contorno', [{ ingredienteId: 'ing_pomodorini', qta: 200, unita: 'g' }]);
  uguale(null, M.famigliaProteinaPrincipale(p, ING));
});

/* ------------------------------------------------------ blacklist ------- */

prova('escludere un ingrediente esclude il piatto che lo contiene', () => {
  const p = piatto('p13', 'unico', [
    { ingredienteId: 'ing_pasta', qta: 100, unita: 'g' },
    { ingredienteId: 'ing_tonno', qta: 1, unita: 'scatoletta' }
  ]);
  const pref = Object.assign(M.preferenzePredefinite(), { escludiIngredienti: ['ing_tonno'] });
  const blocco = M.motivoIndisponibilita(p, { indiceIngredienti: ING, preferenze: pref, mese: 6 });
  if (!blocco || blocco.codice !== 'ingredienteEscluso') throw new Error('doveva essere escluso');
  if (!/tonno/.test(blocco.motivo)) throw new Error('il motivo deve dire quale ingrediente: ' + blocco.motivo);
});
prova('escludere un piatto esclude solo quello', () => {
  const p = piatto('p14', 'primo', [{ ingredienteId: 'ing_pasta', qta: 100, unita: 'g' }]);
  const pref = Object.assign(M.preferenzePredefinite(), { escludiPiatti: ['p14'] });
  uguale('piattoEscluso', M.motivoIndisponibilita(p, { indiceIngredienti: ING, preferenze: pref }).codice);
});
prova('fuori stagione: bloccato nel mese sbagliato, libero nel giusto', () => {
  const p = piatto('p15', 'contorno', [{ ingredienteId: 'ing_asparagi', qta: 200, unita: 'g' }]);
  const pref = M.preferenzePredefinite();
  uguale('fuoriStagione', M.motivoIndisponibilita(p, { indiceIngredienti: ING, preferenze: pref, mese: 11 }).codice);
  uguale(null, M.motivoIndisponibilita(p, { indiceIngredienti: ING, preferenze: pref, mese: 4 }));
});
prova('piatto archiviato: fuori dalla generazione', () => {
  const p = piatto('p16', 'primo', [{ ingredienteId: 'ing_pasta', qta: 100, unita: 'g' }], { attivo: false });
  uguale('archiviato', M.motivoIndisponibilita(p, { indiceIngredienti: ING }).codice);
});

/* ----------------------------------------------------- validazione ------ */

prova('ingrediente valido passa, invalido no', () => {
  uguale(true, M.validaIngrediente(ING.get('ing_pollo')).ok);
  const rotto = { id: 'x', nome: 'X', macro: 'vitamina', unita: 'kg', reparto: 'reparto8', formatoAcquisto: {} };
  const v = M.validaIngrediente(rotto);
  uguale(false, v.ok);
  if (v.errori.length < 4) throw new Error('doveva trovare più errori: ' + v.errori.join('; '));
});
prova('proteina senza famiglia: segnalata', () => {
  const senza = Object.assign({}, ING.get('ing_pollo'), { famiglia: undefined });
  uguale(false, M.validaIngrediente(senza).ok);
});
prova('piatto con unità non convertibile: bocciato', () => {
  const p = piatto('p17', 'primo', [{ ingredienteId: 'ing_pasta', qta: 1, unita: 'barattolo' }]);
  const v = M.validaPiatto(p, ING);
  uguale(false, v.ok);
  if (!/barattolo/.test(v.errori.join(' '))) throw new Error('l\'errore deve nominare l\'unità');
});
prova('piatto con ingrediente sconosciuto: bocciato', () => {
  const p = piatto('p18', 'primo', [{ ingredienteId: 'ing_fantasma', qta: 100, unita: 'g' }]);
  uguale(false, M.validaPiatto(p, ING).ok);
});
/* --------------------------------------------------- formattazione ------ */

prova('quantità formattate all\'italiana', () => {
  uguale('400 g', M.formattaQta(400, 'g'));
  uguale('1,5 pz', M.formattaQta(1.5, 'pz'));
  uguale('2 pz', M.formattaQta(2.0, 'pz'));
});
prova('tempi leggibili', () => {
  uguale('35 min', M.formattaTempo(35));
  uguale('1 h', M.formattaTempo(60));
  uguale('1 h 15', M.formattaTempo(75));
});

export function esegui() { return risultati; }

/** Tutte, comprese quelle che devono aspettare il browser. */
export async function eseguiTutto() {
  await Promise.all(attese);
  return risultati;
}

/* ==========================================================================
   PROVE DEL PLANNER (M2)
   Un catalogo finto ma completo, per verificare i vincoli senza il database.
   ========================================================================== */

import * as P from '../planner.js';

const ING2 = M.indicizza([
  { id: 'i_pasta', nome: 'Pasta', macro: 'carboidrato', unita: 'g', reparto: 'dispensa',
    formatoAcquisto: { qta: 500, label: 'conf' }, conversioni: [], stagioni: [] },
  { id: 'i_riso', nome: 'Riso', macro: 'carboidrato', unita: 'g', reparto: 'dispensa',
    formatoAcquisto: { qta: 1000, label: 'conf' }, conversioni: [], stagioni: [] },
  { id: 'i_pollo', nome: 'Pollo', macro: 'proteina', unita: 'g', reparto: 'macelleria',
    formatoAcquisto: { qta: 300, label: 'conf' }, conversioni: [], stagioni: [], famiglia: 'pollame' },
  { id: 'i_tonno', nome: 'Tonno', macro: 'proteina', unita: 'g', reparto: 'dispensa',
    formatoAcquisto: { qta: 160, label: 'conf' }, conversioni: [], stagioni: [], famiglia: 'pesce' },
  { id: 'i_ceci', nome: 'Ceci', macro: 'proteina', unita: 'g', reparto: 'dispensa',
    formatoAcquisto: { qta: 240, label: 'barattolo' }, conversioni: [], stagioni: [], famiglia: 'legumi' },
  { id: 'i_uova', nome: 'Uova', macro: 'proteina', unita: 'pz', reparto: 'latticini',
    formatoAcquisto: { qta: 6, label: 'conf' }, conversioni: [], stagioni: [], famiglia: 'uova' },
  { id: 'i_zucchine', nome: 'Zucchine', macro: 'fibra', unita: 'g', reparto: 'ortofrutta',
    formatoAcquisto: { qta: 500, label: 'conf' }, conversioni: [], stagioni: [] },
  { id: 'i_spinaci', nome: 'Spinaci', macro: 'fibra', unita: 'g', reparto: 'ortofrutta',
    formatoAcquisto: { qta: 300, label: 'busta' }, conversioni: [], stagioni: [] },
  { id: 'i_pomodorini', nome: 'Pomodorini', macro: 'fibra', unita: 'g', reparto: 'ortofrutta',
    formatoAcquisto: { qta: 500, label: 'vassoio' }, conversioni: [], stagioni: [] },
  { id: 'i_broccoli', nome: 'Broccoli', macro: 'fibra', unita: 'g', reparto: 'ortofrutta',
    formatoAcquisto: { qta: 500, label: 'conf' }, conversioni: [], stagioni: [] }
]);

function unico(id, proteina, fibra, tempo = 20) {
  return { id, nome: id, tipo: 'unico', tempoMin: tempo, difficolta: 1, stagioni: [],
    passi: ['x'], origine: 'base', tags: [], attivo: true,
    ingredienti: [
      { ingredienteId: 'i_pasta', qta: 100, unita: 'g' },
      { ingredienteId: proteina, qta: proteina === 'i_uova' ? 3 : 150, unita: proteina === 'i_uova' ? 'pz' : 'g' },
      { ingredienteId: fibra, qta: 150, unita: 'g' }
    ] };
}
const CATALOGO_BASE = [
  unico('u_pollo_zucchine', 'i_pollo', 'i_zucchine'),
  unico('u_pollo_spinaci', 'i_pollo', 'i_spinaci'),
  unico('u_tonno_pomodorini', 'i_tonno', 'i_pomodorini'),
  unico('u_tonno_broccoli', 'i_tonno', 'i_broccoli'),
  unico('u_ceci_spinaci', 'i_ceci', 'i_spinaci'),
  unico('u_ceci_zucchine', 'i_ceci', 'i_zucchine'),
  unico('u_uova_pomodorini', 'i_uova', 'i_pomodorini'),
  unico('u_uova_broccoli', 'i_uova', 'i_broccoli'),
  { id: 'pr_pasta_pomodorini', nome: 'primo', tipo: 'primo', tempoMin: 15, difficolta: 1, stagioni: [],
    passi: ['x'], origine: 'base', tags: [], attivo: true,
    ingredienti: [{ ingredienteId: 'i_pasta', qta: 100, unita: 'g' },
                  { ingredienteId: 'i_pomodorini', qta: 150, unita: 'g' }] },
  { id: 'se_pollo', nome: 'secondo pollo', tipo: 'secondo', tempoMin: 20, difficolta: 1, stagioni: [],
    passi: ['x'], origine: 'base', tags: [], attivo: true,
    ingredienti: [{ ingredienteId: 'i_pollo', qta: 150, unita: 'g' }] },
  { id: 'se_uova', nome: 'secondo uova', tipo: 'secondo', tempoMin: 12, difficolta: 1, stagioni: [],
    passi: ['x'], origine: 'base', tags: [], attivo: true,
    ingredienti: [{ ingredienteId: 'i_uova', qta: 3, unita: 'pz' }] },
  { id: 'co_broccoli', nome: 'contorno', tipo: 'contorno', tempoMin: 15, difficolta: 1, stagioni: [],
    passi: ['x'], origine: 'base', tags: [], attivo: true,
    ingredienti: [{ ingredienteId: 'i_broccoli', qta: 200, unita: 'g' }] }
];

const CATALOGO = CATALOGO_BASE.concat([
  { id: 'pr_riso_zucchine', nome: 'primo riso', tipo: 'primo', tempoMin: 25, difficolta: 1, stagioni: [],
    passi: ['x'], origine: 'base', tags: [], attivo: true,
    ingredienti: [{ ingredienteId: 'i_riso', qta: 90, unita: 'g' },
                  { ingredienteId: 'i_zucchine', qta: 150, unita: 'g' }] },
  { id: 'se_tonno', nome: 'secondo tonno', tipo: 'secondo', tempoMin: 50, difficolta: 1, stagioni: [],
    passi: ['x'], origine: 'base', tags: [], attivo: true,
    ingredienti: [{ ingredienteId: 'i_tonno', qta: 150, unita: 'g' }] },
  { id: 'co_spinaci', nome: 'contorno spinaci', tipo: 'contorno', tempoMin: 10, difficolta: 1, stagioni: [],
    passi: ['x'], origine: 'base', tags: [], attivo: true,
    ingredienti: [{ ingredienteId: 'i_spinaci', qta: 200, unita: 'g' }] }
]);

function ctxProva(extra = {}) {
  return Object.assign({
    piatti: CATALOGO, indiceIngredienti: ING2, preferenze: M.preferenzePredefinite(),
    voti: {}, ultimaVolta: new Map(), dispensa: new Set(), mese: 6, oggi: new Date('2026-06-15')
  }, extra);
}

import * as S from '../shopping.js';

const ING3 = M.indicizza([
  { id: 'i_tonno', nome: 'Tonno', macro: 'proteina', unita: 'g', reparto: 'dispensa',
    formatoAcquisto: { qta: 160, label: '2 scatolette da 80 g' },
    conversioni: [{ label: 'scatoletta', fattore: 80 }], stagioni: [], famiglia: 'pesce' },
  { id: 'i_pasta', nome: 'Pasta', macro: 'carboidrato', unita: 'g', reparto: 'dispensa',
    formatoAcquisto: { qta: 500, label: 'confezione da 500 g' }, conversioni: [], stagioni: [] },
  { id: 'i_pomodorini', nome: 'Pomodorini', macro: 'fibra', unita: 'g', reparto: 'ortofrutta',
    formatoAcquisto: { qta: 500, label: 'vassoio da 500 g' }, conversioni: [], stagioni: [] },
  { id: 'i_uova', nome: 'Uova', macro: 'proteina', unita: 'pz', reparto: 'latticini',
    formatoAcquisto: { qta: 6, label: 'confezione da 6' }, conversioni: [], stagioni: [], famiglia: 'uova' },
  { id: 'i_olio', nome: 'Olio', macro: 'grasso', unita: 'ml', reparto: 'dispensa',
    formatoAcquisto: { qta: 1000, label: 'bottiglia da 1 l' },
    conversioni: [{ label: 'cucchiaio', fattore: 10 }], stagioni: [] }
]);

const P1 = { id: 'p_uno', nome: 'Pasta col tonno', tipo: 'unico', tempoMin: 15, difficolta: 1,
  stagioni: [], passi: ['x'], origine: 'base', tags: [], attivo: true,
  ingredienti: [
    { ingredienteId: 'i_pasta', qta: 100, unita: 'g' },
    { ingredienteId: 'i_tonno', qta: 1, unita: 'scatoletta' },
    { ingredienteId: 'i_pomodorini', qta: 150, unita: 'g' },
    { ingredienteId: 'i_olio', qta: 1, unita: 'cucchiaio' }
  ] };
const P2 = { id: 'p_due', nome: 'Insalata di tonno', tipo: 'unico', tempoMin: 10, difficolta: 1,
  stagioni: [], passi: ['x'], origine: 'base', tags: [], attivo: true,
  ingredienti: [
    { ingredienteId: 'i_tonno', qta: 1.5, unita: 'scatoletta' },
    { ingredienteId: 'i_pomodorini', qta: 100, unita: 'g' },
    { ingredienteId: 'i_uova', qta: 2, unita: 'pz' }
  ] };

const MENU_PROVA = {
  id: 'men_prova', dataInizio: '2026-09-14', stato: 'attivo',
  giorni: [
    { giorno: 'lun', data: '2026-09-14', modalita: 'unico', piatti: ['p_uno'], bloccato: false },
    { giorno: 'mar', data: '2026-09-15', modalita: 'unico', piatti: ['p_due'], bloccato: false }
  ]
};

function ctxSpesa(extra = {}) {
  return Object.assign({
    indicePiatti: M.indicizza([P1, P2]),
    indiceIngredienti: ING3,
    dispensa: new Map(),
    porzioni: 1,
    ordineReparti: M.REPARTI
  }, extra);
}

prova('un menù con pranzo e cena: la spesa somma tutti e due i pasti', () => {
  const due = { id: 'men_due', dataInizio: '2026-09-14', stato: 'attivo', formato: 2, giorni: [
    { giorno: 'lun', data: '2026-09-14', pasti: {
      pranzo: { piatto: 'p_uno' },
      cena: { piatto: 'p_due' }
    } }
  ] };
  const lista = S.generaLista(due, ctxSpesa());
  const tonno = lista.voci.find((v) => v.ingredienteId === 'i_tonno');
  uguale(200, tonno.qtaRichiesta);          // le stesse quantità del menù su due giorni
});
prova('somma in unità canonica: 1 + 1,5 scatolette = 200 g di tonno', () => {
  const lista = S.generaLista(MENU_PROVA, ctxSpesa());
  const tonno = lista.voci.find((v) => v.ingredienteId === 'i_tonno');
  uguale(200, tonno.qtaRichiesta);
  uguale('g', tonno.unita);
});
prova('la voce dice in quali piatti serve', () => {
  const lista = S.generaLista(MENU_PROVA, ctxSpesa());
  const tonno = lista.voci.find((v) => v.ingredienteId === 'i_tonno');
  uguale(['Insalata di tonno', 'Pasta col tonno'], tonno.usatoIn);
});
prova('porzioni: raddoppiando raddoppiano le quantità', () => {
  const uno = S.generaLista(MENU_PROVA, ctxSpesa());
  const due = S.generaLista(MENU_PROVA, ctxSpesa({ porzioni: 2 }));
  const q = (l, id) => l.voci.find((v) => v.ingredienteId === id).qtaRichiesta;
  uguale(q(uno, 'i_pasta') * 2, q(due, 'i_pasta'));
  uguale(q(uno, 'i_tonno') * 2, q(due, 'i_tonno'));
});
prova('arrotondamento al formato con nota di cosa avanza', () => {
  const lista = S.generaLista(MENU_PROVA, ctxSpesa());
  const tonno = lista.voci.find((v) => v.ingredienteId === 'i_tonno');
  // 200 g richiesti, confezioni da 160 g: due confezioni, 320 g, 120 g avanzati
  uguale(320, tonno.qtaDaComprare);
  uguale(2, tonno.pacchi);
  if (!/prendine 2/.test(tonno.notaArrotondamento)) throw new Error(tonno.notaArrotondamento);
  if (!/120 g/.test(tonno.notaArrotondamento)) throw new Error('deve dire quanto avanza: ' + tonno.notaArrotondamento);
});
prova('un pacco solo: nota senza "prendine"', () => {
  const r = S.arrotondaAlFormato(90, ING3.get('i_pasta'));
  uguale(500, r.qta); uguale(1, r.pacchi);
  if (!/avanzano/.test(r.nota)) throw new Error('la nota deve dire cosa avanza: ' + r.nota);
  if (/prendine/.test(r.nota)) throw new Error('con un pacco non serve "prendine": ' + r.nota);
});
prova('più pacchi: la nota dice quanti prenderne', () => {
  const r = S.arrotondaAlFormato(1100, ING3.get('i_pasta'));
  uguale(1500, r.qta); uguale(3, r.pacchi);
  if (!/prendine 3/.test(r.nota)) throw new Error(r.nota);
});
prova('quantità esatta: nessun avanzo da segnalare', () => {
  const r = S.arrotondaAlFormato(1000, ING3.get('i_pasta'));
  uguale(1000, r.qta); uguale(2, r.pacchi);
  if (/avanzano/.test(r.nota)) throw new Error('non deve inventare avanzi: ' + r.nota);
});
prova('pezzi: 2 uova diventano una confezione da 6', () => {
  const lista = S.generaLista(MENU_PROVA, ctxSpesa());
  const uova = lista.voci.find((v) => v.ingredienteId === 'i_uova');
  uguale(2, uova.qtaRichiesta);
  uguale(6, uova.qtaDaComprare);
  uguale('pz', uova.unita);
});
prova('le voci sono ordinate secondo il giro al supermercato', () => {
  const ordine = ['latticini', 'ortofrutta', 'dispensa', 'macelleria', 'pescheria', 'panetteria', 'surgelati', 'altro'];
  const lista = S.generaLista(MENU_PROVA, ctxSpesa({ ordineReparti: ordine }));
  const reparti = lista.voci.map((v) => v.reparto);
  const atteso = reparti.slice().sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b));
  uguale(atteso, reparti);
});
prova('le spunte sopravvivono al ricalcolo', () => {
  const prima = S.generaLista(MENU_PROVA, ctxSpesa());
  S.segnaComprato(prima, 'i_pasta', true);
  S.segnaInCasa(prima, 'i_pomodorini', true);
  S.aggiungiVoceLibera(prima, 'detersivo');

  const dopo = S.generaLista(MENU_PROVA, ctxSpesa(), prima);
  uguale(true, dopo.voci.find((v) => v.ingredienteId === 'i_pasta').comprato);
  uguale(true, dopo.voci.find((v) => v.ingredienteId === 'i_pomodorini').giaInCasa);
  uguale(1, dopo.libere.length);
  uguale('detersivo', dopo.libere[0].nome);
});
prova('togliendo "ce l\'ho già" la voce torna da comprare', () => {
  const lista = S.generaLista(MENU_PROVA, ctxSpesa());
  S.segnaInCasa(lista, 'i_pomodorini', true);
  const agg = S.segnaInCasa(lista, 'i_pomodorini', false);
  uguale(0, agg.qta);
  uguale(false, lista.voci.find((v) => v.ingredienteId === 'i_pomodorini').giaInCasa);
});
prova('il conteggio ignora ciò che è già in casa', () => {
  const lista = S.generaLista(MENU_PROVA, ctxSpesa());
  const totaleIniziale = S.conteggio(lista).totale;
  S.segnaInCasa(lista, 'i_pasta', true);
  uguale(totaleIniziale - 1, S.conteggio(lista).totale);
  S.segnaComprato(lista, 'i_tonno', true);
  uguale(1, S.conteggio(lista).fatti);
});
prova('voci libere: si aggiungono, si spuntano, si togliono', () => {
  const lista = S.generaLista(MENU_PROVA, ctxSpesa());
  const voce = S.aggiungiVoceLibera(lista, '  caffè  ');
  uguale('caffè', voce.nome);
  S.segnaComprato(lista, voce.id, true);
  uguale(true, lista.libere[0].comprato);
  S.togliVoceLibera(lista, voce.id);
  uguale(0, lista.libere.length);
  uguale(null, S.aggiungiVoceLibera(lista, '   '));
});
prova('unità non convertibile: la lista lo segnala e va avanti', () => {
  const rotto = Object.assign({}, P1, { id: 'p_rotto',
    ingredienti: [{ ingredienteId: 'i_pasta', qta: 1, unita: 'barattolo' },
                  { ingredienteId: 'i_pomodorini', qta: 100, unita: 'g' }] });
  const menu = { id: 'm_rotto', giorni: [{ giorno: 'lun', piatti: ['p_rotto'] }] };
  const lista = S.generaLista(menu, ctxSpesa({ indicePiatti: M.indicizza([rotto]) }));
  if (!lista.problemi.length) throw new Error('doveva segnalare il problema');
  uguale(1, lista.voci.length);                // i pomodorini ci sono comunque
});
/* ==========================================================================
   PROVE DELL'IMPORTAZIONE DA AI (M5)
   Le AI gratuite rispondono in modo sciatto: blocchi markdown, saluti,
   "gr" invece di "g", un piatto invece di un array. Si legge con generosità
   e si salva con severità: queste prove tengono in piedi le due regole.
   ========================================================================== */

import * as IA from '../ai-import.js';

const INGREDIENTI2 = [...ING2.values()];

function ctxIA(extra = {}) {
  return Object.assign({
    piatti: CATALOGO,
    ingredienti: INGREDIENTI2,
    indiceIngredienti: ING2,
    preferenze: M.preferenzePredefinite()
  }, extra);
}

const PIATTO_AI = {
  nome: 'Riso con pollo e spinaci',
  tipo: 'unico', tempoMin: 25, difficolta: 1, stagioni: [1, 2],
  tags: ['veloce'],
  ingredienti: [
    { nome: 'riso', qta: 90, unita: 'g' },
    { nome: 'Pollo', qta: 150, unita: 'g' },
    { nome: 'spinaci', qta: 150, unita: 'g' }
  ],
  passi: ['Lessa il riso.', 'Salta il pollo.', 'Unisci gli spinaci.']
};

/* ---------------------------------------------------- leggere la risposta */

prova('JSON dentro un blocco markdown con saluti attorno', () => {
  const risposta = 'Certo! Ecco tre idee:\n\n```json\n' + JSON.stringify([PIATTO_AI]) +
                   '\n```\n\nFammi sapere se vuoi altro!';
  const letti = IA.estraiJson(risposta);
  uguale(1, letti.length);
  uguale('Riso con pollo e spinaci', letti[0].nome);
});
prova('JSON senza blocco, con testo prima e dopo', () => {
  const risposta = 'Ecco: ' + JSON.stringify([PIATTO_AI]) + ' Buon appetito.';
  uguale(1, IA.estraiJson(risposta).length);
});
prova('un piatto solo, senza array', () => {
  uguale(1, IA.estraiJson(JSON.stringify(PIATTO_AI)).length);
});
prova('array avvolto in una chiave', () => {
  uguale(1, IA.estraiJson(JSON.stringify({ piatti: [PIATTO_AI] })).length);
  uguale(1, IA.estraiJson(JSON.stringify({ ricette: [PIATTO_AI] })).length);
});
prova('risposta illeggibile: errore chiaro, non un crash', () => {
  lancia(() => IA.estraiJson(''), 'vuoto');
  lancia(() => IA.estraiJson('Mi dispiace, non posso aiutarti.'), 'nessun JSON');
  lancia(() => IA.estraiJson('[{"nome": "rotto",}]'), 'JSON malformato');
});

/* -------------------------------------------------- trovare l'ingrediente */

prova('ingredienti trovati per nome, anche storto', () => {
  const cerca = (n) => (IA.cercaIngrediente(n, INGREDIENTI2) || {}).id;
  uguale('i_pollo', cerca('Pollo'));
  uguale('i_pollo', cerca('  pollo  '));
  uguale('i_zucchine', cerca('zucchina'));          // singolare
  uguale('i_pomodorini', cerca('Pomodorini'));
  uguale('i_uova', cerca('uova'));
  uguale(undefined, cerca('cous cous'));            // davvero nuovo
  uguale(undefined, cerca(''));
});
prova('unità scritte all\'italiana o all\'inglese', () => {
  uguale('g', IA.normalizzaUnita('grammi'));
  uguale('g', IA.normalizzaUnita('gr'));
  uguale('ml', IA.normalizzaUnita('millilitri'));
  uguale('pz', IA.normalizzaUnita('pezzi'));
  uguale('cucchiaio', IA.normalizzaUnita('cucchiaio'));
});

/* ------------------------------------------------------------- l'esame --- */

prova('un piatto ben fatto passa e si aggancia agli ingredienti giusti', () => {
  const e = IA.esamina(PIATTO_AI, ctxIA());
  uguale(true, e.accettabile);
  uguale([], e.problemi);
  uguale(0, e.ingredientiNuovi.length);
  uguale(['i_riso', 'i_pollo', 'i_spinaci'], e.piatto.ingredienti.map((v) => v.ingredienteId));
  uguale('unico', e.piatto.tipo);
  uguale('ai', e.piatto.origine);
  uguale('pia_riso_con_pollo_e_spinaci', e.piatto.id);
});

prova('quantità e unità sciatte: si perdonano', () => {
  const grezzo = Object.assign({}, PIATTO_AI, {
    tipo: 'Piatto unico', difficolta: 'facile',
    ingredienti: [
      { ingrediente: 'riso', quantita: '90 g' },
      { nome: 'pollo', qta: 150, unita: 'gr' },
      { nome: 'spinaci', qta: 0.15, unita: 'kg' }
    ]
  });
  const e = IA.esamina(grezzo, ctxIA());
  uguale('unico', e.piatto.tipo);
  uguale(1, e.piatto.difficolta);                   // "facile" non è un numero: 1
  uguale(90, e.piatto.ingredienti[0].qta);
  uguale('g', e.piatto.ingredienti[1].unita);
  // "kg" non è convertibile: l'app lo dice invece di inventare
  if (!e.problemi.some((x) => /kg/.test(x))) throw new Error('doveva segnalare il kg');
});

prova('litri su un ingrediente in ml: si converte il numero', () => {
  const idx = M.indicizza([{ id: 'i_brodo', nome: 'Brodo', macro: 'condimento', unita: 'ml',
    reparto: 'dispensa', formatoAcquisto: { qta: 1000 }, conversioni: [], stagioni: [] }]);
  const e = IA.esamina({
    nome: 'Zuppa', tipo: 'primo', tempoMin: 20, passi: ['x'],
    ingredienti: [{ nome: 'brodo', qta: 0.5, unita: 'l' }]
  }, ctxIA({ ingredienti: [...idx.values()], indiceIngredienti: idx, piatti: [] }));
  uguale(500, e.piatto.ingredienti[0].qta);
  uguale('ml', e.piatto.ingredienti[0].unita);
});

prova('ingrediente mai visto: si chiede cos\'è, non si indovina', () => {
  const grezzo = Object.assign({}, PIATTO_AI, {
    nome: 'Cous cous con pollo',
    ingredienti: [
      { nome: 'Cous cous', qta: 80, unita: 'g' },
      { nome: 'pollo', qta: 150, unita: 'g' }
    ]
  });
  const e = IA.esamina(grezzo, ctxIA());
  uguale(1, e.ingredientiNuovi.length);
  const nuovo = e.ingredientiNuovi[0];
  uguale('Cous cous', nuovo.nome);
  uguale('', nuovo.macro);                          // niente indovinelli
  uguale('', nuovo.reparto);
  uguale('g', nuovo.unita);
  uguale('ing_cous_cous', nuovo.id);
  if (!e.avvisi.some((x) => /nuovo/.test(x))) throw new Error('doveva avvisare');
});

prova('senza macro e reparto non si salva; completati sì', () => {
  const e = IA.esamina(Object.assign({}, PIATTO_AI, {
    nome: 'Cous cous con pollo',
    ingredienti: [{ nome: 'Cous cous', qta: 80, unita: 'g' },
                  { nome: 'pollo', qta: 150, unita: 'g' },
                  { nome: 'spinaci', qta: 150, unita: 'g' }]
  }), ctxIA());
  let esito = IA.preparaSalvataggio(e, ctxIA());
  uguale(false, esito.ok);

  e.ingredientiNuovi[0].macro = 'carboidrato';
  e.ingredientiNuovi[0].reparto = 'dispensa';
  esito = IA.preparaSalvataggio(e, ctxIA());
  uguale([], esito.errori);
  uguale(true, esito.ok);
  uguale(1, esito.ingredienti.length);
});

prova('una proteina nuova senza famiglia non passa', () => {
  const e = IA.esamina({
    nome: 'Tempeh con broccoli', tipo: 'unico', tempoMin: 20, passi: ['x'],
    ingredienti: [{ nome: 'Tempeh', qta: 150, unita: 'g' },
                  { nome: 'broccoli', qta: 150, unita: 'g' },
                  { nome: 'riso', qta: 90, unita: 'g' }]
  }, ctxIA());
  const nuovo = e.ingredientiNuovi[0];
  nuovo.macro = 'proteina'; nuovo.reparto = 'latticini';
  uguale(false, IA.preparaSalvataggio(e, ctxIA()).ok);
  nuovo.famiglia = 'vegetale';
  uguale(true, IA.preparaSalvataggio(e, ctxIA()).ok);
});

prova('la blacklist non si rilassa nemmeno qui', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { escludiIngredienti: ['i_spinaci'] });
  const e = IA.esamina(PIATTO_AI, ctxIA({ preferenze: pref }));
  uguale(false, e.accettabile);
  uguale(['Spinaci'], e.blacklist);
  if (!e.problemi.some((x) => /spinaci/.test(x))) throw new Error('doveva dire perché');
  // e anche forzando la mano, il salvataggio rifiuta
  const esito = IA.preparaSalvataggio(e, ctxIA({ preferenze: pref }));
  uguale(false, esito.ok);
});

prova('piatto già in catalogo: si riconosce dal nome', () => {
  const e = IA.esamina({
    nome: 'Secondo Pollo', tipo: 'secondo', tempoMin: 20, passi: ['x'],
    ingredienti: [{ nome: 'pollo', qta: 150, unita: 'g' }]
  }, ctxIA());
  uguale('se_pollo', e.duplicato);
  uguale(false, e.accettabile);
});

prova('quello che manca davvero blocca il piatto', () => {
  uguale(false, IA.esamina({ tipo: 'unico' }, ctxIA()).accettabile);
  const senzaPassi = IA.esamina(Object.assign({}, PIATTO_AI, { passi: [] }), ctxIA());
  uguale(false, senzaPassi.accettabile);
  const senzaTempo = IA.esamina(Object.assign({}, PIATTO_AI, { tempoMin: null }), ctxIA());
  uguale(false, senzaTempo.accettabile);
});

prova('il procedimento in un testo unico si spezza in passi', () => {
  const e = IA.esamina(Object.assign({}, PIATTO_AI, {
    passi: '1. Lessa il riso.\n2. Salta il pollo.\n3. Unisci gli spinaci.'
  }), ctxIA());
  uguale(3, e.piatto.passi.length);
  uguale('Lessa il riso.', e.piatto.passi[0]);
});

prova('l\'AI che ripete lo stesso piatto lo dice una volta sola', () => {
  const tutti = IA.esaminaTutti([PIATTO_AI, PIATTO_AI, Object.assign({}, PIATTO_AI, { nome: 'RISO con POLLO e spinaci' })], ctxIA());
  uguale(1, tutti.length);
});

/* ------------------------------------------------------------ il prompt -- */

prova('il prompt dice i gusti, la stagione e il formato', () => {
  const pref = Object.assign(M.preferenzePredefinite(), {
    escludiIngredienti: ['i_broccoli'], amoPiatti: ['u_pollo_zucchine'], tempoMaxMin: 30
  });
  const testo = IA.creaPrompt(ctxIA({ preferenze: pref, mese: 7, voti: {} }), { quanti: 3 });
  if (!/3 idee/.test(testo)) throw new Error('non chiede il numero giusto');
  if (!/NON usare, per nessun motivo: Broccoli/.test(testo)) throw new Error('non passa la blacklist');
  if (!/piatti che mi piacciono: u_pollo_zucchine/.test(testo)) throw new Error('non passa i piatti col cuore');
  if (!/mese 7/.test(testo)) throw new Error('non dice la stagione');
  if (!/30 minuti/.test(testo)) throw new Error('non dice il tempo');
  if (!/"ingredienti"/.test(testo)) throw new Error('non mostra lo schema');
  // corto: si incolla anche in una chat gratuita
  if (testo.length > 2000) throw new Error('prompt troppo lungo: ' + testo.length);
});

prova('la richiesta libera finisce nel prompt', () => {
  const testo = IA.creaPrompt(ctxIA(), { richiesta: '  qualcosa con il forno  ' });
  if (!/oggi: qualcosa con il forno/.test(testo)) throw new Error('richiesta non passata');
});

prova('l\'esempio dentro il prompt è importabile dall\'app stessa', () => {
  const testo = IA.creaPrompt(ctxIA(), {});
  const esempio = IA.estraiJson(testo);           // il prompt contiene solo quel JSON
  uguale(1, esempio.length);
  uguale('Farro con zucchine e feta', esempio[0].nome);
  // e passa l'esame come un piatto qualunque, con gli ingredienti veri
  const catalogo = [
    { id: 'i_farro', nome: 'Farro perlato', macro: 'carboidrato', unita: 'g', reparto: 'dispensa',
      formatoAcquisto: { qta: 500 }, conversioni: [], stagioni: [] },
    { id: 'i_feta', nome: 'Feta', macro: 'proteina', unita: 'g', reparto: 'latticini',
      formatoAcquisto: { qta: 200 }, conversioni: [], stagioni: [], famiglia: 'formaggi' },
    ING2.get('i_zucchine')
  ];
  const e = IA.esamina(esempio[0], ctxIA({
    piatti: [], ingredienti: catalogo, indiceIngredienti: M.indicizza(catalogo)
  }));
  uguale([], e.problemi);
  uguale(true, e.accettabile);
  uguale(0, e.ingredientiNuovi.length);
});

/* ==========================================================================
   PROVE DI M6: plurali delle unità, backup e istantanee.
   Il backup è l'unica rete di sicurezza contro il gesto sbagliato: la
   verifica deve rifiutare un file rotto prima di toccare l'archivio.
   ========================================================================== */

import * as B from '../backup.js';

prova('le unità parlate vanno al plurale', () => {
  uguale('2 cucchiai', M.formattaQta(2, 'cucchiaio'));
  uguale('1 cucchiaio', M.formattaQta(1, 'cucchiaio'));
  uguale('3 fette', M.formattaQta(3, 'fetta'));
  uguale('2 spicchi', M.formattaQta(2, 'spicchio'));
  uguale('4 foglie', M.formattaQta(4, 'foglie'));
  uguale('2 scatolette', M.formattaQta(2, 'scatoletta'));
  // le unità canoniche non si toccano
  uguale('400 g', M.formattaQta(400, 'g'));
  uguale('2 pz', M.formattaQta(2, 'pz'));
  uguale('250 ml', M.formattaQta(250, 'ml'));
  // un'etichetta che non conosco resta com'è, invece di essere storpiata
  uguale('2 vaschetta', M.formattaQta(2, 'vaschetta'));
});

const BACKUP_BUONO = {
  app: 'pranzo', formato: 1, esportato: '2026-09-10T12:00:00.000Z',
  dati: {
    ingredienti: [
      { id: 'i_riso', nome: 'Riso', macro: 'carboidrato', unita: 'g', reparto: 'dispensa',
        formatoAcquisto: { qta: 1000 }, conversioni: [], stagioni: [] },
      { id: 'i_pollo', nome: 'Pollo', macro: 'proteina', unita: 'g', reparto: 'macelleria',
        formatoAcquisto: { qta: 300 }, conversioni: [], stagioni: [], famiglia: 'pollame' },
      { id: 'i_spinaci', nome: 'Spinaci', macro: 'fibra', unita: 'g', reparto: 'ortofrutta',
        formatoAcquisto: { qta: 300 }, conversioni: [], stagioni: [] }
    ],
    piatti: [{
      id: 'p_uno', nome: 'Riso con pollo', tipo: 'unico', tempoMin: 25, difficolta: 1,
      passi: ['x'], stagioni: [], tags: [], attivo: true, origine: 'base',
      ingredienti: [{ ingredienteId: 'i_riso', qta: 90, unita: 'g' },
                    { ingredienteId: 'i_pollo', qta: 150, unita: 'g' },
                    { ingredienteId: 'i_spinaci', qta: 150, unita: 'g' }]
    }],
    preferenze: [M.preferenzePredefinite()],
    voti: [{ id: 'v1', piattoId: 'p_uno', stelle: 4, motivo: 'buono', data: '2026-09-01' }],
    menu: [], listeSpesa: [], dispensa: [], cucinato: [], suggerimenti: []
  }
};

prova('un backup buono passa la verifica, coi conteggi giusti', () => {
  const v = B.verifica(BACKUP_BUONO);
  uguale([], v.errori);
  uguale(true, v.ok);
  uguale(1, v.conteggi.piatti);
  uguale(3, v.conteggi.ingredienti);
  uguale(1, v.conteggi.voti);
});

prova('un file di un\'altra app non entra', () => {
  const v = B.verifica(Object.assign({}, BACKUP_BUONO, { app: 'dart' }));
  uguale(false, v.ok);
  if (!v.errori.some((x) => /altra app/.test(x))) throw new Error('doveva dirlo');
});

prova('un backup di una versione futura non entra', () => {
  uguale(false, B.verifica(Object.assign({}, BACKUP_BUONO, { formato: 99 })).ok);
});

prova('un backup con dati rotti non entra', () => {
  const rotto = JSON.parse(JSON.stringify(BACKUP_BUONO));
  rotto.dati.piatti[0].tipo = 'contornino';
  const v = B.verifica(rotto);
  uguale(false, v.ok);
  if (!v.errori.some((x) => /piatti non validi/.test(x))) throw new Error('doveva contarli');

  const senzaIngredienti = JSON.parse(JSON.stringify(BACKUP_BUONO));
  senzaIngredienti.dati.ingredienti = [];
  uguale(false, B.verifica(senzaIngredienti).ok);

  uguale(false, B.verifica(null).ok);
  uguale(false, B.verifica({ dati: { ingredienti: 'no', piatti: [] } }).ok);
});

prova('un piatto che punta a un ingrediente assente non entra', () => {
  const rotto = JSON.parse(JSON.stringify(BACKUP_BUONO));
  rotto.dati.ingredienti = rotto.dati.ingredienti.filter((i) => i.id !== 'i_pollo');
  uguale(false, B.verifica(rotto).ok);
});

prova('senza impostazioni si avvisa, ma si carica', () => {
  const senza = JSON.parse(JSON.stringify(BACKUP_BUONO));
  senza.dati.preferenze = [];
  const v = B.verifica(senza);
  uguale(true, v.ok);
  if (!v.avvisi.length) throw new Error('doveva avvisare');
});

prova('istantanea: una al giorno, non una per apertura', () => {
  const oggi = new Date('2026-09-10T18:00:00');
  uguale(true, B.serveIstantanea([], oggi));
  uguale(false, B.serveIstantanea([{ data: '2026-09-10T08:00:00.000Z' }], oggi));
  uguale(true, B.serveIstantanea([{ data: '2026-09-09T08:00:00.000Z' }], oggi));
});

prova('nomi di file e date leggibili', () => {
  uguale('pranzo-2026-09-10-1432.json', B.nomeFile(new Date(2026, 8, 10, 14, 32)));
  uguale('10 set 2026, 14:32', B.quando(new Date(2026, 8, 10, 14, 32).toISOString()));
  uguale('3 kB', B.peso('x'.repeat(3000)));
});

prova('un piatto solo: il prompt lo chiede al singolare', () => {
  const uno = IA.creaPrompt(ctxIA(), { quanti: 1 });
  if (!/un'idea per pranzo o per cena/.test(uno)) throw new Error('doveva essere singolare: ' + uno.split('\n')[0]);
  const tre = IA.creaPrompt(ctxIA(), { quanti: 3 });
  if (!/3 idee per pranzo o per cena/.test(tre)) throw new Error('e plurale con più di uno');
});

/* ==========================================================================
   PROVE DELLE FOTO
   Il punto delicato è il peso: una foto del telefono deve entrare in
   archivio ridotta, o dopo trenta piatti il telefono fa pulizia.
   ========================================================================== */

import * as FOTO from '../photo.js';

prova('misura ridotta: proporzioni tenute, mai ingrandita', () => {
  uguale({ larghezza: 1000, altezza: 750 }, FOTO.misuraRidotta(4000, 3000, 1000));
  uguale({ larghezza: 750, altezza: 1000 }, FOTO.misuraRidotta(3000, 4000, 1000));
  uguale({ larghezza: 1000, altezza: 1000 }, FOTO.misuraRidotta(2000, 2000, 1000));
  // più piccola del massimo: si lascia com'è
  uguale({ larghezza: 640, altezza: 480 }, FOTO.misuraRidotta(640, 480, 1000));
  lancia(() => FOTO.misuraRidotta(0, 100, 1000), 'senza dimensioni');
});

prova('pesi leggibili', () => {
  uguale('180 kB', FOTO.peso(184320));
  uguale('1,2 MB', FOTO.peso(1258291));
  uguale('900 byte', FOTO.peso(900));
  uguale('0 kB', FOTO.peso(0));
});

/** Una finta foto: rumore colorato, perché una tinta piatta si comprime a nulla. */
function fotoFinta(larghezza, altezza) {
  const tela = document.createElement('canvas');
  tela.width = larghezza; tela.height = altezza;
  const p = tela.getContext('2d');
  const dati = p.createImageData(larghezza, altezza);
  let seme = 7;
  for (let i = 0; i < dati.data.length; i += 4) {
    seme = (seme * 1103515245 + 12345) & 0x7fffffff;
    dati.data[i] = seme & 255;
    dati.data[i + 1] = (seme >> 8) & 255;
    dati.data[i + 2] = (seme >> 16) & 255;
    dati.data[i + 3] = 255;
  }
  p.putImageData(dati, 0, 0);
  return new Promise((risolvi) => tela.toBlob((b) =>
    risolvi(new File([b], 'prova.jpg', { type: 'image/jpeg' })), 'image/jpeg', 1));
}

provaAsync('una foto grande entra in archivio piccola', async () => {
  const file = await fotoFinta(2400, 1800);
  const pronta = await FOTO.preparaFoto(file);
  uguale(1000, pronta.larghezza);
  uguale(750, pronta.altezza);
  uguale('image/jpeg', pronta.blob.type);
  if (pronta.byte > FOTO.BYTE_MAX) {
    throw new Error(`troppo pesante: ${pronta.byte} byte`);
  }
  if (pronta.byte >= pronta.byteOriginali) {
    throw new Error(`non l'ha alleggerita: ${pronta.byteOriginali} -> ${pronta.byte}`);
  }
});

provaAsync('una foto già piccola non viene ingrandita', async () => {
  const pronta = await FOTO.preparaFoto(await fotoFinta(400, 300));
  uguale(400, pronta.larghezza);
  uguale(300, pronta.altezza);
});

provaAsync('una foto verticale resta verticale', async () => {
  const pronta = await FOTO.preparaFoto(await fotoFinta(1500, 2000));
  uguale(750, pronta.larghezza);
  uguale(1000, pronta.altezza);
});

provaAsync('quello che non è una foto viene rifiutato', async () => {
  const finto = new File(['non sono una foto'], 'x.txt', { type: 'text/plain' });
  try {
    await FOTO.preparaFoto(finto);
  } catch (e) {
    if (!(e instanceof FOTO.ErroreFoto)) throw new Error('errore di tipo sbagliato: ' + e.message);
    return;
  }
  throw new Error('doveva rifiutarla');
});

provaAsync('senza file non si inventa niente', async () => {
  try { await FOTO.preparaFoto(null); } catch (e) { return; }
  throw new Error('doveva lanciare');
});

/* ==========================================================================
   PROVE DELLA 3.0
   Calorie, leggeri e sostanziosi, la forma nuova del menù (un piatto per
   pasto, il contorno col secondo) e le regole del planner semplificato.
   ========================================================================== */

const ING_K = M.indicizza([
  { id: 'k_pasta', nome: 'Pasta', macro: 'carboidrato', unita: 'g', reparto: 'dispensa', kcal: 350,
    formatoAcquisto: { qta: 500 }, conversioni: [], stagioni: [] },
  { id: 'k_olio', nome: 'Olio', macro: 'grasso', unita: 'ml', reparto: 'dispensa', kcal: 900,
    formatoAcquisto: { qta: 1000 }, conversioni: [{ label: 'cucchiaio', fattore: 10 }], stagioni: [] },
  { id: 'k_uova', nome: 'Uova', macro: 'proteina', unita: 'pz', reparto: 'latticini', kcal: 75,
    formatoAcquisto: { qta: 6 }, conversioni: [], stagioni: [], famiglia: 'uova' },
  { id: 'k_zucca', nome: 'Zucca', macro: 'fibra', unita: 'g', reparto: 'ortofrutta', kcal: 20,
    formatoAcquisto: { qta: 1000 }, conversioni: [], stagioni: [9, 10, 11, 12] },
  { id: 'k_misterioso', nome: 'Senza calorie', macro: 'condimento', unita: 'g', reparto: 'dispensa',
    formatoAcquisto: { qta: 100 }, conversioni: [], stagioni: [] }
]);
const piattoK = (id, tipo, voci) => ({ id, nome: id, tipo, tempoMin: 20, difficolta: 1, stagioni: [],
  passi: ['x'], origine: 'base', tags: [], attivo: true, ingredienti: voci });

prova('calorie: grammi, millilitri con conversione e pezzi', () => {
  const p = piattoK('k1', 'primo', [
    { ingredienteId: 'k_pasta', qta: 100, unita: 'g' },          // 350
    { ingredienteId: 'k_olio', qta: 1, unita: 'cucchiaio' },     // 10 ml = 90
    { ingredienteId: 'k_uova', qta: 2, unita: 'pz' }             // 150
  ]);
  uguale(590, M.kcalPiatto(p, ING_K));
});

prova('calorie: un ingrediente senza dato non conta e non esplode', () => {
  const p = piattoK('k2', 'primo', [
    { ingredienteId: 'k_pasta', qta: 80, unita: 'g' },
    { ingredienteId: 'k_misterioso', qta: 50, unita: 'g' },
    { ingredienteId: 'sconosciuto', qta: 50, unita: 'g' }
  ]);
  uguale(280, M.kcalPiatto(p, ING_K));
});

prova('calorie del pasto e del giorno: piatto più contorno', () => {
  const ip = M.indicizza([
    piattoK('a', 'secondo', [{ ingredienteId: 'k_uova', qta: 2, unita: 'pz' }]),
    piattoK('b', 'contorno', [{ ingredienteId: 'k_zucca', qta: 200, unita: 'g' }]),
    piattoK('c', 'primo', [{ ingredienteId: 'k_pasta', qta: 100, unita: 'g' }])
  ]);
  const giorno = { giorno: 'lun', pasti: { pranzo: { piatto: 'c' }, cena: { piatto: 'a', contorno: 'b' } } };
  uguale(190, M.kcalPasto(giorno.pasti.cena, ip, ING_K));
  uguale(540, M.kcalGiorno(giorno, ip, ING_K));
});

prova('leggeri e sostanziosi: si confronta con la mediana del suo tipo', () => {
  const piatti = [40, 60, 80].map((g, i) => piattoK('p' + i, 'primo', [{ ingredienteId: 'k_pasta', qta: g, unita: 'g' }]));
  const mediane = M.medianeKcal(piatti, ING_K);
  uguale(210, mediane.get('primo'));
  uguale(true, M.passaPeso(piatti[0], 'leggeri', mediane, ING_K));
  uguale(false, M.passaPeso(piatti[2], 'leggeri', mediane, ING_K));
  uguale(true, M.passaPeso(piatti[2], 'sostanziosi', mediane, ING_K));
  uguale(true, M.passaPeso(piatti[2], 'tutti', mediane, ING_K));
});

prova('le verdure del mese: solo ortofrutta con una stagione vera', () => {
  uguale(['k_zucca'], M.verdureDiStagione([...ING_K.values()], 11).map((i) => i.id));
  uguale([], M.verdureDiStagione([...ING_K.values()], 6).map((i) => i.id));
});

prova('chili e litri dal mille in su', () => {
  uguale('1 kg', M.formattaQta(1000, 'g'));
  uguale('1,2 kg', M.formattaQta(1200, 'g'));
  uguale('1,5 l', M.formattaQta(1500, 'ml'));
  uguale('999 g', M.formattaQta(999, 'g'));
});

prova('un menù della 2.x: il primo non contorno è il piatto, il contorno resta', () => {
  const vecchio = { id: 'v', giorni: [{ giorno: 'lun', pasti: {
    pranzo: { modalita: 'primoSecondo', piatti: ['co_broccoli', 'pr_pasta_pomodorini', 'se_pollo'], bloccato: true },
    cena: { modalita: 'unico', piatti: ['u_ceci_spinaci'], avanziDa: 'pranzo' }
  } }] };
  const g = M.normalizzaMenu(vecchio, M.indicizza(CATALOGO)).giorni[0];
  uguale({ piatto: 'pr_pasta_pomodorini', contorno: 'co_broccoli', tempoMax: null, scelto: true }, g.pasti.pranzo);
  uguale(undefined, g.pasti.cena, 'la cena di avanzi');
});

prova('un menù della 1.x si legge come un giorno col solo pranzo', () => {
  const vecchio = { id: 'v', giorni: [{ giorno: 'mar', modalita: 'unico', piatti: ['u_uova_broccoli'] }] };
  const g = M.normalizzaMenu(vecchio, M.indicizza(CATALOGO)).giorni[0];
  uguale('u_uova_broccoli', g.pasti.pranzo.piatto);
  uguale(['pranzo'], Object.keys(g.pasti));
});

prova('normalizzare due volte non cambia niente', () => {
  const m = { id: 'v', giorni: [{ giorno: 'lun', pasti: { cena: { piatto: 'se_pollo', contorno: 'co_broccoli', tempoMax: 30 } } }] };
  const una = M.normalizzaMenu(m);
  uguale(JSON.stringify(una), JSON.stringify(M.normalizzaMenu(una)));
});

/* ---------------------------------------------------------- planner 3.0 -- */

const IDX_CAT = M.indicizza(CATALOGO);
function tutti(esito) {
  return esito.giorni.flatMap((g) => M.pastiDi(g).map(([nome, p]) => ({ giorno: g.giorno, nome, p })));
}

prova('ogni giorno pranzo e cena, coi tipi giusti', () => {
  const esito = P.generaSettimana(ctxProva(), { giorni: ['lun', 'mar', 'mer'] });
  uguale(3, esito.giorni.length);
  for (const x of tutti(esito)) {
    const tipo = IDX_CAT.get(x.p.piatto).tipo;
    if (!M.TIPI_PASTO[x.nome].includes(tipo)) throw new Error(`${x.nome} di ${x.giorno}: ${tipo}`);
  }
  uguale(6, tutti(esito).length);
});

prova('il secondo si porta dietro un contorno, il resto no', () => {
  for (let i = 0; i < 20; i++) {
    for (const x of tutti(P.generaSettimana(ctxProva(), {}))) {
      const tipo = IDX_CAT.get(x.p.piatto).tipo;
      if (tipo === 'secondo' && !x.p.contorno) throw new Error('secondo senza contorno');
      if (tipo !== 'secondo' && x.p.contorno) throw new Error(`${tipo} con contorno`);
      if (x.p.contorno && IDX_CAT.get(x.p.contorno).tipo !== 'contorno') throw new Error('contorno sbagliato');
    }
  }
});

prova('solo cena: nessun pranzo', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { pasti: ['cena'] });
  const esito = P.generaSettimana(ctxProva({ preferenze: pref }), {});
  uguale(true, tutti(esito).every((x) => x.nome === 'cena'));
});

prova('nessun piatto ripetuto nella settimana finché ce ne sono', () => {
  for (let i = 0; i < 10; i++) {
    const ids = tutti(P.generaSettimana(ctxProva(), { giorni: ['lun', 'mar', 'mer', 'gio'] })).map((x) => x.p.piatto);
    uguale(ids.length, new Set(ids).size, 'piatti diversi');
  }
});

prova('mai la stessa proteina in due pasti di fila, quando si può', () => {
  for (let i = 0; i < 10; i++) {
    const fila = tutti(P.generaSettimana(ctxProva(), { giorni: ['lun', 'mar', 'mer'] }));
    for (let k = 1; k < fila.length; k++) {
      const a = M.famigliaProteinaPrincipale(IDX_CAT.get(fila[k - 1].p.piatto), ING2);
      const b = M.famigliaProteinaPrincipale(IDX_CAT.get(fila[k].p.piatto), ING2);
      if (a && a === b) throw new Error(`${a} due volte di fila`);
    }
  }
});

prova('gli esclusi non entrano mai, nemmeno quando il catalogo finisce', () => {
  const pref = Object.assign(M.preferenzePredefinite(), {
    escludiPiatti: ['u_pollo_zucchine', 'se_uova'], escludiIngredienti: ['i_tonno']
  });
  for (let i = 0; i < 10; i++) {
    const esito = P.generaSettimana(ctxProva({ preferenze: pref }), {});
    for (const x of tutti(esito)) {
      const p = IDX_CAT.get(x.p.piatto);
      if (pref.escludiPiatti.includes(p.id)) throw new Error('piatto escluso: ' + p.id);
      if (p.ingredienti.some((v) => v.ingredienteId === 'i_tonno')) throw new Error('tonno escluso: ' + p.id);
    }
  }
});

prova('il tempo: dentro se si può, e se si sfora lo dice', () => {
  const esito = P.componiPasto(ctxProva(), { pasto: 'cena', tempoMax: 15, giaUsati: [] });
  uguale('se_uova', esito.pasto.piatto);
  const stretto = P.componiPasto(ctxProva(), { pasto: 'pranzo', tempoMax: 5, giaUsati: [] });
  uguale('più lungo del tempo che hai', stretto.nota);
});

prova('rifare la settimana tiene i piatti scelti a mano', () => {
  const fissi = { mar: { cena: { piatto: 'se_pollo', contorno: 'co_spinaci', scelto: true } } };
  for (let i = 0; i < 5; i++) {
    const esito = P.generaSettimana(ctxProva(), { giorni: ['lun', 'mar', 'mer'], fissi });
    const mar = esito.giorni.find((g) => g.giorno === 'mar');
    uguale('se_pollo', mar.pasti.cena.piatto);
    uguale(true, mar.pasti.cena.scelto);
    const altri = tutti(esito).filter((x) => !(x.giorno === 'mar' && x.nome === 'cena')).map((x) => x.p.piatto);
    uguale(false, altri.includes('se_pollo'), 'il piatto scelto non si ripete');
  }
});

prova('cambiare un pasto dà davvero un altro piatto e tiene il tempo scelto', () => {
  const esito = P.generaSettimana(ctxProva(), { giorni: ['lun', 'mar'] });
  const menu = { id: 'm', giorni: esito.giorni };
  const prima = menu.giorni[0].pasti.pranzo.piatto;
  for (let i = 0; i < 10; i++) {
    const nuovo = P.rigeneraPasto(ctxProva(), menu, 'lun', 'pranzo', { tempoMax: 30 });
    if (nuovo.pasto.piatto === prima) throw new Error('stesso piatto di prima');
    uguale(30, nuovo.pasto.tempoMax);
  }
});

prova('cambiare il contorno lascia il secondo', () => {
  const menu = { id: 'm', giorni: [{ giorno: 'lun', pasti: { cena: { piatto: 'se_pollo', contorno: 'co_broccoli' } } }] };
  const nuovo = P.rigeneraContorno(ctxProva(), menu, 'lun', 'cena');
  uguale('se_pollo', nuovo.piatto);
  uguale('co_spinaci', nuovo.contorno);
});

prova('un piatto col cuore vale di più', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { amoPiatti: ['u_ceci_spinaci'] });
  const conCuore = P.punteggio(IDX_CAT.get('u_ceci_spinaci'), ctxProva({ preferenze: pref }), { senzaCaso: true });
  const senza = P.punteggio(IDX_CAT.get('u_ceci_spinaci'), ctxProva(), { senzaCaso: true });
  uguale(25, conCuore - senza);
});

prova('mangiato da poco: pesa meno', () => {
  const ultima = new Map([['u_ceci_spinaci', '2026-06-08']]);
  const recente = P.punteggio(IDX_CAT.get('u_ceci_spinaci'), ctxProva({ ultimaVolta: ultima }), { senzaCaso: true });
  const mai = P.punteggio(IDX_CAT.get('u_ceci_spinaci'), ctxProva(), { senzaCaso: true });
  if (!(recente < mai)) throw new Error(`${recente} non è meno di ${mai}`);
});

prova('id e date della settimana', () => {
  const lunedi = P.lunediDi(new Date(2026, 8, 17));        // giovedì 17 settembre 2026
  uguale('2026-09-14', P.iso(lunedi));
  uguale('men_2026_w38', P.idMenu(lunedi));
  uguale('gio', P.chiaveGiorno(new Date(2026, 8, 17)));
  uguale('2026-09-16', P.conDate([{ giorno: 'mer', pasti: {} }], lunedi)[0].data);
});

/* ---------------------------------------------------------- spesa 3.0 ---- */

prova('la spesa conta anche i contorni', () => {
  const contorno = { id: 'p_cont', nome: 'Pomodorini', tipo: 'contorno', tempoMin: 5, difficolta: 1,
    stagioni: [], passi: ['x'], origine: 'base', tags: [], attivo: true,
    ingredienti: [{ ingredienteId: 'i_pomodorini', qta: 100, unita: 'g' }] };
  const menu = { id: 'm', giorni: [{ giorno: 'lun', pasti: { cena: { piatto: 'p_due', contorno: 'p_cont' } } }] };
  const lista = S.generaLista(menu, ctxSpesa({ indicePiatti: M.indicizza([P1, P2, contorno]) }));
  uguale(200, lista.voci.find((v) => v.ingredienteId === 'i_pomodorini').qtaRichiesta);
});

prova('sale, olio e spezie partono come "ce l\'ho già"', () => {
  const ing = new Map(ING3);
  ing.set('i_olio', Object.assign({}, ING3.get('i_olio'), { dispensaBase: true }));
  const lista = S.generaLista(MENU_PROVA, ctxSpesa({ indiceIngredienti: ing }));
  uguale(true, lista.voci.find((v) => v.ingredienteId === 'i_olio').giaInCasa);
  uguale(false, lista.voci.find((v) => v.ingredienteId === 'i_tonno').giaInCasa);
});

prova('la lista da copiare: solo quello che manca, per reparto', () => {
  const lista = S.generaLista(MENU_PROVA, ctxSpesa());
  S.segnaComprato(lista, 'i_pasta');
  S.segnaInCasa(lista, 'i_olio');
  S.aggiungiVoceLibera(lista, 'caffè');
  const testo = S.testoDaCopiare(lista, M.REPARTI, M.NOME_REPARTO);
  if (/Pasta|Olio/.test(testo)) throw new Error('ci sono voci già prese: ' + testo);
  if (!/FRUTTA E VERDURA\n- Pomodorini, 250 g/.test(testo)) throw new Error('reparto o quantità sbagliati: ' + testo);
  if (!/- caffè/.test(testo)) throw new Error('manca la voce libera');
});
