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

/* -------------------------------------------------------- macro --------- */

prova('soglia proteina: 80 g bastano, 79 no', () => {
  const si = piatto('p1', 'secondo', [{ ingredienteId: 'ing_pollo', qta: 80, unita: 'g' }]);
  const no = piatto('p2', 'secondo', [{ ingredienteId: 'ing_pollo', qta: 79, unita: 'g' }]);
  uguale(['proteina'], M.macroCoperti(si, ING));
  uguale([], M.macroCoperti(no, ING));
});
prova('soglia in pezzi: 1 uovo copre, mezzo no', () => {
  const si = piatto('p3', 'secondo', [{ ingredienteId: 'ing_uova', qta: 1, unita: 'pz' }]);
  const no = piatto('p4', 'secondo', [{ ingredienteId: 'ing_uova', qta: 0.5, unita: 'pz' }]);
  uguale(['proteina'], M.macroCoperti(si, ING));
  uguale([], M.macroCoperti(no, ING));
});
prova('la conversione conta per la soglia: 1 fetta di pollo = 120 g', () => {
  const p = piatto('p5', 'secondo', [{ ingredienteId: 'ing_pollo', qta: 1, unita: 'fetta' }]);
  uguale(['proteina'], M.macroCoperti(p, ING));
});
prova('grassi e condimenti non coprono nulla', () => {
  const p = piatto('p6', 'contorno', [
    { ingredienteId: 'ing_olio', qta: 5, unita: 'cucchiaio' },
    { ingredienteId: 'ing_cipolla', qta: 2, unita: 'pz' }
  ]);
  uguale([], M.macroCoperti(p, ING));
});
prova('macro in ordine fisso: proteina, carboidrato, fibra', () => {
  const p = piatto('p7', 'unico', [
    { ingredienteId: 'ing_pomodorini', qta: 150, unita: 'g' },
    { ingredienteId: 'ing_pasta', qta: 100, unita: 'g' },
    { ingredienteId: 'ing_tonno', qta: 1, unita: 'scatoletta' }
  ]);
  uguale(['proteina', 'carboidrato', 'fibra'], M.macroCoperti(p, ING));
});
prova('la copertura è del pranzo: primo + secondo insieme', () => {
  const primo = piatto('p8', 'primo', [
    { ingredienteId: 'ing_pasta', qta: 100, unita: 'g' },
    { ingredienteId: 'ing_pomodorini', qta: 150, unita: 'g' }
  ]);
  const secondo = piatto('p9', 'secondo', [{ ingredienteId: 'ing_pollo', qta: 150, unita: 'g' }]);
  uguale([], M.macroMancanti([primo, secondo], ING));
  uguale(true, M.giornoCompleto([primo, secondo], ING));
  uguale(['proteina'], M.macroMancanti([primo], ING));
  uguale(false, M.giornoCompleto([primo], ING));
});
prova('ingrediente sconosciuto: ignorato, non esplode', () => {
  const p = piatto('p10', 'primo', [
    { ingredienteId: 'ing_inesistente', qta: 100, unita: 'g' },
    { ingredienteId: 'ing_pasta', qta: 100, unita: 'g' }
  ]);
  uguale(['carboidrato'], M.macroCoperti(p, ING));
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
prova('voto: stelle 1-5 e data nel formato giusto', () => {
  uguale(true, M.validaVoto({ piattoId: 'p1', stelle: 4, motivo: 'buono', data: '2026-09-14' }).ok);
  uguale(false, M.validaVoto({ piattoId: 'p1', stelle: 9, data: '2026-09-14' }).ok);
  uguale(false, M.validaVoto({ piattoId: 'p1', stelle: 3, data: '14/09/2026' }).ok);
  uguale(false, M.validaVoto({ piattoId: 'p1', stelle: 3, motivo: 'boh', data: '2026-09-14' }).ok);
});

/* ------------------------------------------------- pranzo e cena (2.0) --- */

prova('un menù della 1.x si legge come un giorno col solo pranzo', () => {
  const vecchio = { id: 'm', giorni: [
    { giorno: 'lun', data: '2026-09-14', modalita: 'unico', piatti: ['p_uno'], bloccato: true }
  ] };
  const nuovo = M.normalizzaMenu(vecchio);
  uguale(2, nuovo.formato);
  uguale(['pranzo'], M.pastiDi(nuovo.giorni[0]).map(([nome]) => nome));
  uguale(['p_uno'], nuovo.giorni[0].pasti.pranzo.piatti);
  uguale(true, nuovo.giorni[0].pasti.pranzo.bloccato);
  uguale('2026-09-14', nuovo.giorni[0].data);
});
prova('normalizzare due volte non cambia niente', () => {
  const vecchio = { id: 'm', giorni: [{ giorno: 'lun', modalita: 'unico', piatti: ['p_uno'] }] };
  const una = M.normalizzaMenu(vecchio);
  const due = M.normalizzaMenu(una);
  uguale(JSON.stringify(una), JSON.stringify(due));
});
prova('i pasti escono nell\'ordine in cui si mangiano', () => {
  const giorno = { giorno: 'lun', pasti: { cena: { piatti: ['b'] }, pranzo: { piatti: ['a'] } } };
  uguale(['pranzo', 'cena'], M.pastiDi(giorno).map(([nome]) => nome));
  uguale(['a', 'b'], M.piattiDelGiorno(giorno));
});
prova('la giornata dice cosa coprono i due pasti messi insieme', () => {
  const soloProteina = { id: 'x', ingredienti: [{ ingredienteId: 'ing_pollo', qta: 150, unita: 'g' }] };
  const soloFibra = { id: 'y', ingredienti: [{ ingredienteId: 'ing_asparagi', qta: 200, unita: 'g' }] };
  const giorno = { giorno: 'lun', pasti: {
    pranzo: { piatti: ['x'] }, cena: { piatti: ['y'] }
  } };
  const dati = M.macroDellaGiornata(giorno, M.indicizza([soloProteina, soloFibra]), ING);
  uguale(['proteina', 'fibra'], dati.coperti);
  uguale(['carboidrato'], dati.mancanti);
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
  uguale('1 h 15 min', M.formattaTempo(75));
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
const CATALOGO = [
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

function ctxProva(extra = {}) {
  return Object.assign({
    piatti: CATALOGO, indiceIngredienti: ING2, preferenze: M.preferenzePredefinite(),
    voti: {}, ultimaVolta: new Map(), dispensa: new Set(), mese: 6, oggi: new Date('2026-06-15')
  }, extra);
}

/* Dalla 2.0 il motore restituisce solo gli id: gli oggetti si ripescano qui. */
const IDX_CAT = M.indicizza(CATALOGO);
function oggetti(ids, indice = IDX_CAT) {
  return (ids || []).map((id) => indice.get(id)).filter(Boolean);
}
/** Tutti i pasti generati, in fila: [{giorno, nome, pasto, piatti}]. */
function inFila(esito, indice = IDX_CAT) {
  const fila = [];
  for (const g of esito.giorni) {
    for (const [nome, pasto] of M.pastiDi(g)) {
      fila.push({ giorno: g.giorno, nome, pasto, piatti: oggetti(pasto.piatti, indice) });
    }
  }
  return fila;
}

prova('la settimana ha cinque giorni, ognuno con pranzo e cena', () => {
  const e = P.generaSettimana(ctxProva());
  uguale(5, e.giorni.length);
  for (const g of e.giorni) {
    uguale(['pranzo', 'cena'], M.pastiDi(g).map(([nome]) => nome), g.giorno);
    for (const [nome, pasto] of M.pastiDi(g)) {
      if (!(pasto.piatti || []).length) throw new Error(`${g.giorno}: ${nome} vuoto`);
    }
  }
});
prova('un solo pasto se le preferenze dicono così', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { pasti: ['pranzo'] });
  const e = P.generaSettimana(ctxProva({ preferenze: pref }));
  for (const g of e.giorni) uguale(['pranzo'], M.pastiDi(g).map(([nome]) => nome), g.giorno);
});
prova('nessun piatto ripetuto nella settimana, a parte gli avanzi', () => {
  const usati = [];
  for (const x of inFila(P.generaSettimana(ctxProva()))) {
    if (x.pasto.avanziDa) continue;          // gli avanzi sono lo stesso piatto, apposta
    usati.push(...x.pasto.piatti);
  }
  uguale(usati.length, new Set(usati).size);
});
prova('mai la stessa proteina in due pasti consecutivi', () => {
  for (let giro = 0; giro < 20; giro++) {
    let precedente = null;
    for (const x of inFila(P.generaSettimana(ctxProva()))) {
      const fam = x.piatti.map((p) => M.famigliaProteinaPrincipale(p, ING2)).filter(Boolean)[0];
      if (fam && fam === precedente && !x.pasto.avanziDa) {
        throw new Error(`proteina ${fam} ripetuta: ${x.giorno} ${x.nome}`);
      }
      precedente = fam;
    }
  }
});
prova('un pasto che non copre tutte le macro è ammesso: non è più un obbligo', () => {
  // un catalogo dove la fibra non c'è proprio: nella 1.x non usciva niente
  const senzaFibra = ['i_pollo', 'i_uova', 'i_tonno', 'i_ceci'].map((proteina, i) => ({
    id: 'sf_' + i, nome: 'senza fibra ' + i, tipo: 'unico', tempoMin: 15, difficolta: 1,
    stagioni: [], passi: ['x'], origine: 'base', tags: [], attivo: true,
    ingredienti: [
      { ingredienteId: 'i_pasta', qta: 100, unita: 'g' },
      { ingredienteId: proteina, qta: proteina === 'i_uova' ? 3 : 150,
        unita: proteina === 'i_uova' ? 'pz' : 'g' }
    ]
  }));
  const pref = Object.assign(M.preferenzePredefinite(), { giorni: ['lun', 'mar'], quotaNovita: 0 });
  const e = P.generaSettimana(ctxProva({ piatti: senzaFibra, preferenze: pref }));
  uguale(2, e.giorni.length);
  for (const x of inFila(e, M.indicizza(senzaFibra))) {
    uguale(['fibra'], M.macroMancanti(x.piatti, ING2), x.giorno + ' ' + x.nome);
  }
});
prova('le macro mancanti restano un punteggio, non un divieto', () => {
  const soloProteina = CATALOGO.find((p) => p.id === 'se_pollo');
  const con = P.punteggio(soloProteina, ctxProva(), { senzaCaso: true, macroMancanti: ['proteina'] });
  const senza = P.punteggio(soloProteina, ctxProva(), { senzaCaso: true, macroMancanti: [] });
  if (!(con.totale > senza.totale)) throw new Error('portare una macro mancante deve valere di più');
});
prova('almeno tre proteine e tre fibre diverse nella settimana', () => {
  for (let giro = 0; giro < 20; giro++) {
    const prot = new Set(), fib = new Set();
    for (const x of inFila(P.generaSettimana(ctxProva()))) for (const p of x.piatti) {
      const f = M.famigliaProteinaPrincipale(p, ING2); if (f) prot.add(f);
      for (const y of M.fibrePrincipali(p, ING2)) fib.add(y);
    }
    if (prot.size < 3) throw new Error('solo ' + prot.size + ' proteine');
    if (fib.size < 3) throw new Error('solo ' + fib.size + ' fibre');
  }
});
prova('un ingrediente escluso non entra mai, e la blacklist non si rilassa', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { escludiIngredienti: ['i_pollo', 'i_tonno'] });
  for (let giro = 0; giro < 10; giro++) {
    for (const x of inFila(P.generaSettimana(ctxProva({ preferenze: pref })))) {
      for (const p of x.piatti) for (const v of p.ingredienti) {
        if (v.ingredienteId === 'i_pollo' || v.ingredienteId === 'i_tonno') {
          throw new Error(`${p.id} contiene un ingrediente escluso`);
        }
      }
    }
  }
});
prova('i pasti bloccati non vengono toccati', () => {
  const fisso = {
    modalita: 'unico', piatti: ['u_ceci_spinaci'],
    piattiOggetti: [CATALOGO.find((p) => p.id === 'u_ceci_spinaci')]
  };
  const e = P.generaSettimana(ctxProva(), { giorniFissi: { mer: { pranzo: fisso } } });
  const mercoledi = e.giorni.find((g) => g.giorno === 'mer');
  uguale(['u_ceci_spinaci'], mercoledi.pasti.pranzo.piatti);
  uguale(true, mercoledi.pasti.pranzo.bloccato);
  uguale(false, mercoledi.pasti.cena.bloccato);
});
prova('giorno con poco tempo: il pranzo è un piatto unico, come da §4.1', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { tempoMaxPerGiorno: { mer: 20 } });
  const e = P.generaSettimana(ctxProva({ preferenze: pref }));
  uguale('unico', e.giorni.find((g) => g.giorno === 'mer').pasti.pranzo.modalita);
});
prova('il tempo massimo: il pranzo ce l\'ha, la cena no', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { tempoMaxPerGiorno: { mer: 20 } });
  uguale(20, P.tempoMassimo('pranzo', 'mer', pref));
  uguale(40, P.tempoMassimo('pranzo', 'gio', pref));
  uguale(0, P.tempoMassimo('cena', 'mer', pref));
  uguale(30, P.tempoMassimo('cena', 'mer', Object.assign({}, pref, { tempoMaxCena: 30 })));
});
prova('tetto ai pranzi con primo + secondo', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { maxGiorniPrimoSecondo: 1 });
  for (let giro = 0; giro < 15; giro++) {
    const e = P.generaSettimana(ctxProva({ preferenze: pref }));
    const quanti = e.giorni.filter((g) => (g.pasti.pranzo || {}).modalita === 'primoSecondo').length;
    if (quanti > 1) throw new Error('pranzi primo+secondo: ' + quanti);
  }
});
prova('avanzi: la cena ripete il pranzo dello stesso giorno', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { avanziASettimana: 5, quotaNovita: 0 });
  let trovati = 0;
  for (let giro = 0; giro < 20 && !trovati; giro++) {
    for (const g of P.generaSettimana(ctxProva({ preferenze: pref })).giorni) {
      const cena = g.pasti.cena;
      if (!cena || !cena.avanziDa) continue;
      trovati++;
      uguale('pranzo', cena.avanziDa);
      uguale(g.pasti.pranzo.piatti, cena.piatti, g.giorno);
    }
  }
  if (!trovati) throw new Error('con avanziASettimana a 5 doveva uscirne almeno uno');
});
prova('senza avanzi richiesti nessuna cena è di avanzi', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { avanziASettimana: 0 });
  for (let giro = 0; giro < 10; giro++) {
    for (const x of inFila(P.generaSettimana(ctxProva({ preferenze: pref })))) {
      if (x.pasto.avanziDa) throw new Error('avanzi non richiesti');
    }
  }
});
prova('rigenera un pasto solo: cambia quello e lascia stare gli altri', () => {
  const menu = P.generaSettimana(ctxProva());
  const conOggetti = Object.assign({}, menu, {
    giorni: menu.giorni.map((g) => {
      const pasti = {};
      for (const [nome, pasto] of M.pastiDi(g)) {
        pasti[nome] = Object.assign({}, pasto, { piattiOggetti: oggetti(pasto.piatti) });
      }
      return Object.assign({}, g, { pasti });
    })
  });
  const primaPranzo = menu.giorni[0].pasti.pranzo.piatti.slice();
  const esito = P.rigeneraPasto(ctxProva(), conOggetti, menu.giorni[0].giorno, 'cena');
  if (!esito) throw new Error('doveva rigenerare');
  uguale(primaPranzo, menu.giorni[0].pasti.pranzo.piatti);
  uguale(null, esito.pasto.avanziDa);
});
prova('vincoli impossibili: nessun giorno e un avviso, non un silenzio', () => {
  const pref = Object.assign(M.preferenzePredefinite(), {
    escludiIngredienti: ['i_pollo', 'i_tonno', 'i_ceci', 'i_uova']   // via tutte le proteine
  });
  const e = P.generaSettimana(ctxProva({ preferenze: pref }));
  uguale(0, e.giorni.length);
  if (!e.avvisi.length) throw new Error('doveva avvisare');
});
prova('catalogo appena sufficiente: rilassa e lo dichiara', () => {
  // pochi piatti per dieci pasti: il cooldown va rilassato
  const pochi = CATALOGO.filter((p) => ['u_pollo_zucchine', 'u_ceci_spinaci', 'u_uova_broccoli',
    'pr_pasta_pomodorini', 'se_pollo', 'se_uova', 'co_broccoli'].includes(p.id));
  const ultima = new Map([['u_pollo_zucchine', '2026-06-08'], ['u_ceci_spinaci', '2026-06-08']]);
  const e = P.generaSettimana(ctxProva({ piatti: pochi, ultimaVolta: ultima }));
  if (e.giorni.length && !e.rilassamenti.length && !e.avvisi.length) {
    throw new Error('ha riempito la settimana senza dichiarare nulla');
  }
});
prova('media dei voti pesata sui più recenti', () => {
  // pesi 0.7^n: (5*1 + 1*0.7)/1.7 = 3.35, sopra la media semplice 3
  const salito = P.votoMedio([{ stelle: 5, data: '2026-09-01' }, { stelle: 1, data: '2026-08-01' }]);
  const scesa = P.votoMedio([{ stelle: 1, data: '2026-09-01' }, { stelle: 5, data: '2026-08-01' }]);
  if (!(salito > 3)) throw new Error('un 5 recente deve alzare la media: ' + salito);
  if (!(scesa < 3)) throw new Error('un 1 recente deve abbassarla: ' + scesa);
  if (!(salito > scesa)) throw new Error('l ordine dei voti deve contare');
  uguale(4, Math.round(P.votoMedio([{ stelle: 4, data: '2026-09-01' }])));
});
prova('punteggio: i componenti spiegano il totale', () => {
  const p = CATALOGO[0];
  const pref = Object.assign(M.preferenzePredefinite(), { amoPiatti: [p.id] });
  const r = P.punteggio(p, ctxProva({ preferenze: pref }), { senzaCaso: true, slotNovitaLibero: true });
  const somma = r.componenti.reduce((a, c) => a + c.valore, 0);
  uguale(r.totale, somma);
  if (!r.componenti.some((c) => c.etichetta === 'piatto che ami')) throw new Error('manca il bonus');
});
prova('id e date della settimana', () => {
  const lunedi = P.lunediDi(new Date('2026-09-16T12:00:00'));   // mercoledì
  uguale('2026-09-14', P.iso(lunedi));
  uguale('men_2026_w38', P.idMenu(lunedi));
  const giorni = P.conDate([{ giorno: 'lun' }, { giorno: 'ven' }], lunedi);
  uguale('2026-09-14', giorni[0].data);
  uguale('2026-09-18', giorni[1].data);
});

/* ==========================================================================
   PROVE DELLA LISTA SPESA (M3)
   L'aggregazione in unità canonica è il punto dove è più facile sbagliare.
   ========================================================================== */

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
      pranzo: M.pastoPulito({ modalita: 'unico', piatti: ['p_uno'] }),
      cena: M.pastoPulito({ modalita: 'unico', piatti: ['p_due'] })
    } }
  ] };
  const lista = S.generaLista(due, ctxSpesa());
  const tonno = lista.voci.find((v) => v.ingredienteId === 'i_tonno');
  uguale(200, tonno.qtaRichiesta);          // le stesse quantità del menù su due giorni
});
prova('avanzi: il piatto conta doppio, perché va cucinato doppio', () => {
  const conAvanzi = { id: 'men_av', dataInizio: '2026-09-14', stato: 'attivo', formato: 2, giorni: [
    { giorno: 'lun', data: '2026-09-14', pasti: {
      pranzo: M.pastoPulito({ modalita: 'unico', piatti: ['p_uno'] }),
      cena: M.pastoPulito({ modalita: 'unico', piatti: ['p_uno'], avanziDa: 'pranzo' })
    } }
  ] };
  const solo = { id: 'men_solo', dataInizio: '2026-09-14', stato: 'attivo', formato: 2, giorni: [
    { giorno: 'lun', data: '2026-09-14', pasti: {
      pranzo: M.pastoPulito({ modalita: 'unico', piatti: ['p_uno'] })
    } }
  ] };
  const q = (menu, id) => (S.generaLista(menu, ctxSpesa()).voci
    .find((v) => v.ingredienteId === id) || {}).qtaRichiesta;
  uguale(q(solo, 'i_pasta') * 2, q(conAvanzi, 'i_pasta'));
  // e il piatto compare una volta sola nell'elenco di dove serve
  const voce = S.generaLista(conAvanzi, ctxSpesa()).voci.find((v) => v.ingredienteId === 'i_pasta');
  uguale(['Pasta col tonno'], voce.usatoIn);
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
prova('la dispensa si sottrae prima di arrotondare', () => {
  const conScorta = S.generaLista(MENU_PROVA, ctxSpesa({ dispensa: new Map([['i_pasta', 100]]) }));
  const pasta = conScorta.voci.find((v) => v.ingredienteId === 'i_pasta');
  uguale(100, pasta.qtaRichiesta);
  uguale(100, pasta.qtaInDispensa);
  uguale(0, pasta.qtaDaComprare);              // ne serviva 100 e ce n'è 100
  uguale('', pasta.notaArrotondamento);
});
prova('dispensa parziale: si compra solo il resto, arrotondato', () => {
  const lista = S.generaLista(MENU_PROVA, ctxSpesa({ dispensa: new Map([['i_tonno', 100]]) }));
  const tonno = lista.voci.find((v) => v.ingredienteId === 'i_tonno');
  uguale(100, tonno.qtaInDispensa);
  uguale(160, tonno.qtaDaComprare);            // servono 100 g -> 1 confezione
  uguale(1, tonno.pacchi);
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
prova('"ce l\'ho già" restituisce la quantità da mettere in dispensa', () => {
  const lista = S.generaLista(MENU_PROVA, ctxSpesa());
  const agg = S.segnaInCasa(lista, 'i_pomodorini', true);
  uguale('i_pomodorini', agg.ingredienteId);
  uguale(250, agg.qta);                        // 150 + 100 dai due piatti
  uguale(true, lista.voci.find((v) => v.ingredienteId === 'i_pomodorini').giaInCasa);
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
prova('proposta di scarico dalla dispensa: solo ciò che c\'è', () => {
  const righe = S.propostaScarico(P1, {
    indiceIngredienti: ING3,
    dispensa: new Map([['i_pasta', 500], ['i_olio', 900]]),
    porzioni: 1
  });
  uguale(2, righe.length);
  const pasta = righe.find((r) => r.ingredienteId === 'i_pasta');
  uguale(100, pasta.usata);
  uguale(400, pasta.restante);
  const olio = righe.find((r) => r.ingredienteId === 'i_olio');
  uguale(10, olio.usata);                      // 1 cucchiaio = 10 ml
  uguale(890, olio.restante);
});
prova('scarico: non va sotto zero', () => {
  const righe = S.propostaScarico(P1, {
    indiceIngredienti: ING3, dispensa: new Map([['i_pasta', 40]]), porzioni: 1
  });
  uguale(0, righe[0].restante);
});

/* ==========================================================================
   PROVE DEI GUSTI (M4)
   Apprendimento sugli ingredienti, suggerimenti da confermare e l'effetto
   di un voto basso sul menù. Le liste dei gusti non devono mai cambiare
   da sole: qui si verifica anche questo.
   ========================================================================== */

import * as G from '../tastes.js';

const voto = (piattoId, stelle, data, motivo = 'buono') => ({
  id: `v_${piattoId}_${data}`, piattoId, stelle, data, motivo, note: ''
});

function ctxGusti(voti, extra = {}) {
  return Object.assign(ctxProva({ voti }), extra);
}

prova('un voto "troppo lungo" non parla di gusto', () => {
  const voti = [voto('u_pollo_zucchine', 2, '2026-06-01', 'troppoLungo'),
                voto('u_pollo_zucchine', 4, '2026-06-02', 'buono')];
  uguale(1, G.votiDiGusto(voti).length);
  uguale('buono', G.votiDiGusto(voti)[0].motivo);
});

prova('tempo percepito: ogni "troppo lungo" fa pesare un quarto in più', () => {
  const piatto = { tempoMin: 40 };
  uguale(40, G.tempoPercepito(piatto, []));
  uguale(50, G.tempoPercepito(piatto, [voto('x', 3, '2026-06-01', 'troppoLungo')]));
  uguale(60, G.tempoPercepito(piatto, [voto('x', 3, '2026-06-01', 'troppoLungo'),
                                       voto('x', 3, '2026-06-02', 'troppoLungo')]));
  // il tetto è tre volte: oltre non ha senso gonfiare
  const molti = [1, 2, 3, 4, 5].map((n) => voto('x', 3, '2026-06-0' + n, 'troppoLungo'));
  uguale(70, G.tempoPercepito(piatto, molti));
});

prova('punteggio implicito dell\'ingrediente: vale solo da tre piatti', () => {
  const due = G.punteggiIngredienti(ctxGusti({
    u_tonno_broccoli: [voto('u_tonno_broccoli', 1, '2026-06-01')],
    u_uova_broccoli: [voto('u_uova_broccoli', 2, '2026-06-02')]
  }));
  uguale(2, due.get('i_broccoli').quantiPiatti);
  uguale(false, due.get('i_broccoli').valido);

  const tre = G.punteggiIngredienti(ctxGusti({
    u_tonno_broccoli: [voto('u_tonno_broccoli', 1, '2026-06-01')],
    u_uova_broccoli: [voto('u_uova_broccoli', 2, '2026-06-02')],
    co_broccoli: [voto('co_broccoli', 1, '2026-06-03')]
  }));
  const b = tre.get('i_broccoli');
  uguale(3, b.quantiPiatti);
  uguale(true, b.valido);
  uguale(1.33, Math.round(b.media * 100) / 100);      // (1 + 2 + 1) / 3
});

prova('sale, olio e spezie non entrano nell\'apprendimento', () => {
  const idx = M.indicizza([
    { id: 'i_sale', nome: 'Sale', macro: 'condimento', unita: 'g', reparto: 'dispensa',
      formatoAcquisto: { qta: 1000, label: 'conf' }, conversioni: [], stagioni: [], dispensaBase: true },
    { id: 'i_riso', nome: 'Riso', macro: 'carboidrato', unita: 'g', reparto: 'dispensa',
      formatoAcquisto: { qta: 1000, label: 'conf' }, conversioni: [], stagioni: [] }
  ]);
  const piatti = ['a', 'b', 'c'].map((n) => ({
    id: 'p_' + n, nome: n, tipo: 'unico', tempoMin: 10, difficolta: 1, passi: ['x'],
    ingredienti: [{ ingredienteId: 'i_sale', qta: 3, unita: 'g' },
                  { ingredienteId: 'i_riso', qta: 100, unita: 'g' }]
  }));
  const voti = {};
  for (const p of piatti) voti[p.id] = [voto(p.id, 1, '2026-06-01')];
  const punteggi = G.punteggiIngredienti({ piatti, indiceIngredienti: idx, voti });
  uguale(undefined, punteggi.get('i_sale'));
  uguale(true, punteggi.get('i_riso').valido);
});

prova('sotto 2,2 su tre piatti l\'app propone di escludere l\'ingrediente', () => {
  const ctx = ctxGusti({
    u_tonno_broccoli: [voto('u_tonno_broccoli', 1, '2026-06-01')],
    u_uova_broccoli: [voto('u_uova_broccoli', 2, '2026-06-02')],
    co_broccoli: [voto('co_broccoli', 1, '2026-06-03')]
  });
  const proposte = G.suggerimentiDaVoti(ctx).filter((s) => s.ingredienteId === 'i_broccoli');
  uguale(1, proposte.length);
  uguale('escludi', proposte[0].tipo);
  uguale('escludiIngredienti', proposte[0].lista);
  uguale('pendente', proposte[0].stato);
  uguale(3, proposte[0].quantiPiatti);
  if (!/broccoli/i.test(proposte[0].testo)) throw new Error('il testo non nomina l\'ingrediente');
});

prova('sopra 4,3 su tre piatti propone il preferito', () => {
  const ctx = ctxGusti({
    u_tonno_broccoli: [voto('u_tonno_broccoli', 5, '2026-06-01')],
    u_uova_broccoli: [voto('u_uova_broccoli', 5, '2026-06-02')],
    co_broccoli: [voto('co_broccoli', 5, '2026-06-03')]
  });
  const proposte = G.suggerimentiDaVoti(ctx).filter((s) => s.ingredienteId === 'i_broccoli');
  uguale('amo', proposte[0].tipo);
  uguale('amoIngredienti', proposte[0].lista);
});

prova('due soli piatti votati: nessuna proposta', () => {
  const ctx = ctxGusti({
    u_tonno_broccoli: [voto('u_tonno_broccoli', 1, '2026-06-01')],
    co_broccoli: [voto('co_broccoli', 1, '2026-06-03')]
  });
  uguale(0, G.suggerimentiDaVoti(ctx).filter((s) => s.ingredienteId === 'i_broccoli').length);
});

prova('tre volte "troppo lungo" non fa proporre di escludere l\'ingrediente', () => {
  const ctx = ctxGusti({
    u_tonno_broccoli: [voto('u_tonno_broccoli', 1, '2026-06-01', 'troppoLungo')],
    u_uova_broccoli: [voto('u_uova_broccoli', 1, '2026-06-02', 'troppoLungo')],
    co_broccoli: [voto('co_broccoli', 1, '2026-06-03', 'troppoLungo')]
  });
  uguale(0, G.suggerimentiDaVoti(ctx).length);
});

prova('un suggerimento scartato non torna a chiedere', () => {
  const ctx = ctxGusti({
    u_tonno_broccoli: [voto('u_tonno_broccoli', 1, '2026-06-01')],
    u_uova_broccoli: [voto('u_uova_broccoli', 2, '2026-06-02')],
    co_broccoli: [voto('co_broccoli', 1, '2026-06-03')]
  });
  const primo = G.suggerimentiDaVoti(ctx)[0];
  const dopo = G.suggerimentiDaVoti(ctx, [Object.assign({}, primo, { stato: 'scartato' })]);
  uguale(0, dopo.filter((s) => s.id === primo.id).length);
});

prova('niente proposte per ciò che è già nella lista giusta', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { escludiIngredienti: ['i_broccoli'] });
  const ctx = ctxGusti({
    u_tonno_broccoli: [voto('u_tonno_broccoli', 1, '2026-06-01')],
    u_uova_broccoli: [voto('u_uova_broccoli', 2, '2026-06-02')],
    co_broccoli: [voto('co_broccoli', 1, '2026-06-03')]
  }, { preferenze: pref });
  uguale(0, G.suggerimentiDaVoti(ctx).filter((s) => s.ingredienteId === 'i_broccoli').length);
});

prova('le liste non si mordono: amare toglie da escludere', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { escludiIngredienti: ['i_broccoli'] });
  const dopo = G.aggiungiAllaLista(pref, 'amoIngredienti', 'i_broccoli');
  uguale(['i_broccoli'], dopo.amoIngredienti);
  uguale([], dopo.escludiIngredienti);
  uguale(['i_broccoli'], pref.escludiIngredienti);      // l'originale non si tocca
});

prova('togliere dalla lista non tocca le altre', () => {
  let pref = M.preferenzePredefinite();
  pref = G.aggiungiAllaLista(pref, 'amoPiatti', 'u_pollo_zucchine');
  pref = G.aggiungiAllaLista(pref, 'escludiPiatti', 'u_tonno_broccoli');
  pref = G.togliDallaLista(pref, 'amoPiatti', 'u_pollo_zucchine');
  uguale([], pref.amoPiatti);
  uguale(['u_tonno_broccoli'], pref.escludiPiatti);
});

prova('confermare un suggerimento è l\'unico modo di cambiare la lista', () => {
  const ctx = ctxGusti({
    u_tonno_broccoli: [voto('u_tonno_broccoli', 1, '2026-06-01')],
    u_uova_broccoli: [voto('u_uova_broccoli', 2, '2026-06-02')],
    co_broccoli: [voto('co_broccoli', 1, '2026-06-03')]
  });
  const sugg = G.suggerimentiDaVoti(ctx)[0];
  uguale([], ctx.preferenze.escludiIngredienti);        // il calcolo non ha cambiato nulla
  const dopo = G.applicaSuggerimento(ctx.preferenze, sugg);
  uguale(['i_broccoli'], dopo.escludiIngredienti);
});

prova('voto valido o niente', () => {
  const buono = G.nuovoVoto({ piattoId: 'u_pollo_zucchine', stelle: 4, motivo: 'buono' });
  uguale(4, buono.stelle);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(buono.data)) throw new Error('data non impostata');
  lancia(() => G.nuovoVoto({ piattoId: 'x', stelle: 9 }), 'stelle fuori scala');
  lancia(() => G.nuovoVoto({ piattoId: 'x', stelle: 3, motivo: 'perché' }), 'motivo inventato');
  lancia(() => G.nuovoVoto({ stelle: 3 }), 'senza piatto');
});

prova('un voto basso abbassa il punteggio del piatto', () => {
  const senza = P.punteggio(CATALOGO[0], ctxProva(), { senzaCaso: true }).totale;
  const basso = P.punteggio(CATALOGO[0], ctxGusti({
    u_pollo_zucchine: [voto('u_pollo_zucchine', 1, '2026-06-01')]
  }), { senzaCaso: true }).totale;
  const alto = P.punteggio(CATALOGO[0], ctxGusti({
    u_pollo_zucchine: [voto('u_pollo_zucchine', 5, '2026-06-01')]
  }), { senzaCaso: true }).totale;
  uguale(senza - 24, basso);                            // (1 - 3) * 12
  uguale(senza + 24, alto);
});

prova('"troppo lungo" penalizza il tempo anche se la ricetta è corta', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { tempoMaxMin: 25 });
  const piatto = CATALOGO[0];                           // tempoMin 20, sotto la soglia
  const prima = P.punteggio(piatto, ctxProva({ preferenze: pref }), { senzaCaso: true });
  const dopo = P.punteggio(piatto, ctxGusti({
    u_pollo_zucchine: [voto('u_pollo_zucchine', 3, '2026-06-01', 'troppoLungo'),
                       voto('u_pollo_zucchine', 3, '2026-06-02', 'troppoLungo')]
  }, { preferenze: pref }), { senzaCaso: true });
  uguale(0, prima.componenti.filter((c) => c.valore === -15).length);
  uguale(1, dopo.componenti.filter((c) => c.valore === -15).length);
});

prova('un piatto amato che manca da due settimane ha la spinta in più', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { amoPiatti: ['u_pollo_zucchine'] });
  const recente = P.punteggio(CATALOGO[0], ctxProva({
    preferenze: pref, ultimaVolta: new Map([['u_pollo_zucchine', '2026-06-12']])
  }), { senzaCaso: true }).componenti.map((c) => c.etichetta);
  const vecchio = P.punteggio(CATALOGO[0], ctxProva({
    preferenze: pref, ultimaVolta: new Map([['u_pollo_zucchine', '2026-05-01']])
  }), { senzaCaso: true }).componenti.map((c) => c.etichetta);
  uguale(false, recente.includes('lo ami e manca da 2 settimane'));
  uguale(true, vecchio.includes('lo ami e manca da 2 settimane'));
});

prova('escludere un ingrediente svuota il menù di tutti i piatti che lo usano', () => {
  const pref = Object.assign(M.preferenzePredefinite(), { escludiIngredienti: ['i_broccoli'] });
  const esito = P.generaSettimana(ctxProva({ preferenze: pref }));
  uguale(5, esito.giorni.length);
  for (const x of inFila(esito)) {
    for (const p of x.piatti) {
      if ((p.ingredienti || []).some((v) => v.ingredienteId === 'i_broccoli')) {
        throw new Error(`${p.id} contiene un ingrediente escluso`);
      }
    }
  }
});

prova('un voto basso cambia il menù: il piatto bocciato perde il posto', () => {
  // due soli piatti unici possibili, uno bocciato: vince l'altro
  const soli = CATALOGO.filter((p) => p.id === 'u_pollo_zucchine' || p.id === 'u_ceci_spinaci');
  const pref = Object.assign(M.preferenzePredefinite(),
                             { giorni: ['lun'], pasti: ['pranzo'], quotaNovita: 0 });
  const ctx = ctxProva({
    piatti: soli, preferenze: pref,
    voti: { u_pollo_zucchine: [voto('u_pollo_zucchine', 1, '2026-06-01')] }
  });
  let bocciato = 0;
  for (let i = 0; i < 40; i++) {
    const esito = P.generaSettimana(ctx);
    if (M.piattiDelGiorno(esito.giorni[0]).includes('u_pollo_zucchine')) bocciato++;
  }
  // con -24 contro +0 l'estrazione pesata lo sceglie molto di rado
  if (bocciato > 15) throw new Error(`scelto ${bocciato} volte su 40 nonostante il voto 1`);
});

prova('quando ultima volta, in italiano', () => {
  const oggi = new Date('2026-06-15T12:00:00');
  uguale('mai cucinato', G.quandoUltimaVolta(null, oggi));
  uguale('oggi', G.quandoUltimaVolta('2026-06-15', oggi));
  uguale('ieri', G.quandoUltimaVolta('2026-06-14', oggi));
  uguale('3 giorni fa', G.quandoUltimaVolta('2026-06-12', oggi));
  uguale('una settimana fa', G.quandoUltimaVolta('2026-06-08', oggi));
  uguale('3 settimane fa', G.quandoUltimaVolta('2026-05-25', oggi));
});

prova('stelle e date brevi', () => {
  uguale('★★★★☆', G.stelle(4));
  uguale('★★★☆☆', G.stelle(3.4));
  uguale('☆☆☆☆☆', G.stelle(0));
  uguale('14 set', G.dataBreve('2026-09-14'));
  uguale('1 gen', G.dataBreve('2026-01-01'));
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

prova('un piatto unico che non copre tutto: avviso, non divieto', () => {
  const e = IA.esamina({
    nome: 'Riso in bianco', tipo: 'unico', tempoMin: 15, passi: ['x'],
    ingredienti: [{ nome: 'riso', qta: 90, unita: 'g' }]
  }, ctxIA());
  uguale(true, e.accettabile);
  if (!e.avvisi.some((x) => /non copre/.test(x))) throw new Error('doveva avvisare sui macro');
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
    escludiIngredienti: ['i_broccoli'], amoIngredienti: ['i_pollo'], tempoMaxMin: 30
  });
  const testo = IA.creaPrompt(ctxIA({ preferenze: pref, mese: 7, voti: {} }), { quanti: 3 });
  if (!/3 idee/.test(testo)) throw new Error('non chiede il numero giusto');
  if (!/NON usare, per nessun motivo: Broccoli/.test(testo)) throw new Error('non passa la blacklist');
  if (!/mi piacciono molto: Pollo/.test(testo)) throw new Error('non passa i preferiti');
  if (!/mese 7/.test(testo)) throw new Error('non dice la stagione');
  if (!/30 minuti/.test(testo)) throw new Error('non dice il tempo');
  if (!/"ingredienti"/.test(testo)) throw new Error('non mostra lo schema');
  // corto: si incolla anche in una chat gratuita
  if (testo.length > 2000) throw new Error('prompt troppo lungo: ' + testo.length);
});

prova('il prompt riporta i voti come esempio di gusto', () => {
  const testo = IA.creaPrompt(ctxIA({
    voti: {
      u_pollo_zucchine: [{ stelle: 5, data: '2026-06-01', motivo: 'buono' }],
      u_ceci_spinaci: [{ stelle: 1, data: '2026-06-02', motivo: 'nonMiPiace' }]
    }
  }), {});
  if (!/ho apprezzato: u_pollo_zucchine/.test(testo)) throw new Error('manca il piatto piaciuto');
  if (!/non mi sono piaciuti: u_ceci_spinaci/.test(testo)) throw new Error('manca il piatto bocciato');
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
  if (!/un'idea per il pranzo/.test(uno)) throw new Error('doveva essere singolare: ' + uno.split('\n')[0]);
  const tre = IA.creaPrompt(ctxIA(), { quanti: 3 });
  if (!/3 idee per il pranzo/.test(tre)) throw new Error('e plurale con più di uno');
});

prova('l\'ultimo voto è l\'ultimo anche a pari giornata', () => {
  const ctx = { voti: { p1: [
    { id: 'vot_a_0', piattoId: 'p1', stelle: 5, data: '2026-09-10', motivo: 'buono' },
    { id: 'vot_b_0', piattoId: 'p1', stelle: 1, data: '2026-09-10', motivo: 'nonMiPiace' }
  ] } };
  uguale('vot_b_0', G.riepilogoPiatto('p1', ctx).ultimo.id);
  uguale(2, G.riepilogoPiatto('p1', ctx).quanti);
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
