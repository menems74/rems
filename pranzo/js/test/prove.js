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
