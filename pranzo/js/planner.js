/* =========================================================================
   planner.js — come si sceglie il piatto di un pasto, e la settimana.
   Non tocca il database: riceve tutto in un "contesto" e restituisce dati,
   così si può provare in isolamento.

   La 3.0 è volutamente semplice. Per ogni pasto:
   - regole che non si piegano mai: il tipo giusto per il pasto, niente
     piatti o ingredienti esclusi, niente fuori stagione;
   - regole che si piegano solo se non c'è altro, in quest'ordine: la
     proteina diversa dal pasto prima, il filtro leggeri/sostanziosi, il
     tempo, e infine il divieto di ripetere un piatto nella settimana;
   - tra i candidati vince il punteggio, con un po' di caso: più punti ai
     piatti col cuore e a quelli di stagione, meno a quelli mangiati da poco.
   ========================================================================= */

import * as M from './model.js';

/* ------------------------------------------------------------ contesto ---
   { piatti, indiceIngredienti, preferenze, ultimaVolta (Map piattoId ->
     'AAAA-MM-GG'), mese, oggi, mediane (facoltativo) }                    */

function conMediane(ctx) {
  if (!ctx.mediane) ctx.mediane = M.medianeKcal(ctx.piatti, ctx.indiceIngredienti);
  return ctx;
}

export function settimaneDa(dataISO, oggi) {
  if (!dataISO) return null;
  const giorni = (oggi - new Date(dataISO + 'T00:00:00')) / 86400000;
  return giorni / 7;
}

/** Il punteggio di un piatto: più alto, più probabile. */
export function punteggio(piatto, ctx, opzioni = {}) {
  const pref = ctx.preferenze;
  let totale = 50;
  if ((pref.amoPiatti || []).includes(piatto.id)) totale += 25;
  if (M.diStagione(piatto, ctx.indiceIngredienti, ctx.mese)) totale += 12;
  // la sera, come in casa: un secondo col contorno o una zuppa, più che un piatto unico
  if (opzioni.pasto === 'cena' && (piatto.tipo === 'secondo' || (piatto.tags || []).includes('zuppa'))) totale += 14;

  // mangiato da poco: pesa meno, e il peso sparisce dopo tre settimane
  const settimane = settimaneDa(ctx.ultimaVolta && ctx.ultimaVolta.get(piatto.id), ctx.oggi || new Date());
  if (settimane != null && settimane >= 0 && settimane < 3) {
    totale -= Math.round(35 * (1 - settimane / 3));
  }
  if (!opzioni.senzaCaso) totale += Math.round(Math.random() * 16);
  return totale;
}

/** Estrazione pesata tra i primi cinque: non sempre il massimo, o il menù si ripete. */
function estraiPesato(candidati) {
  const migliori = candidati.slice(0, 5);
  if (!migliori.length) return null;
  const minimo = Math.min(...migliori.map((c) => c.punteggio));
  const pesi = migliori.map((c) => c.punteggio - minimo + 5);
  let tiro = Math.random() * pesi.reduce((a, b) => a + b, 0);
  for (let i = 0; i < migliori.length; i++) {
    tiro -= pesi[i];
    if (tiro <= 0) return migliori[i];
  }
  return migliori[migliori.length - 1];
}

/** Il piatto va bene per sempre in questo contesto? (esclusi, stagione) */
function disponibile(piatto, ctx) {
  return !M.motivoIndisponibilita(piatto, {
    indiceIngredienti: ctx.indiceIngredienti, preferenze: ctx.preferenze, mese: ctx.mese
  });
}

/**
 * I candidati per un pasto, ordinati per punteggio.
 * filtro: { tipi, pasto, giaUsati, famigliaVietata, peso, tempoMax }
 */
export function candidati(ctx, filtro) {
  conMediane(ctx);
  const usati = new Set(filtro.giaUsati || []);
  const out = [];
  for (const piatto of ctx.piatti) {
    if (!filtro.tipi.includes(piatto.tipo)) continue;
    if (usati.has(piatto.id)) continue;
    if (!disponibile(piatto, ctx)) continue;
    if (filtro.tempoMax && piatto.tempoMin > filtro.tempoMax) continue;
    if (filtro.peso && !M.passaPeso(piatto, filtro.peso, ctx.mediane, ctx.indiceIngredienti)) continue;
    if (filtro.famigliaVietata &&
        M.famigliaProteinaPrincipale(piatto, ctx.indiceIngredienti) === filtro.famigliaVietata) continue;
    out.push({ piatto, punteggio: punteggio(piatto, ctx, { pasto: filtro.pasto }) });
  }
  out.sort((a, b) => b.punteggio - a.punteggio);
  return out;
}

/* I passi con cui si allentano le regole, dal più stretto al più largo. */
const ALLENTAMENTI = [
  { famiglia: true, peso: true, tempo: true, ripetuti: false, nota: null },
  { famiglia: false, peso: true, tempo: true, ripetuti: false, nota: null },
  { famiglia: false, peso: false, tempo: true, ripetuti: false, nota: 'fuori dal filtro leggeri/sostanziosi' },
  { famiglia: false, peso: false, tempo: false, ripetuti: false, nota: 'più lungo del tempo che hai' },
  { famiglia: false, peso: false, tempo: false, ripetuti: true, nota: 'già in settimana' }
];

/**
 * Sceglie il piatto per un pasto, e il contorno se è un secondo.
 * opzioni: { pasto, tempoMax, giaUsati, famigliaVietata, contorniUsati }
 * @returns { pasto: {piatto, contorno, tempoMax, scelto}, nota } oppure null
 */
export function componiPasto(ctx, opzioni) {
  const pref = ctx.preferenze;
  const tipi = M.TIPI_PASTO[opzioni.pasto] || M.TIPI_PASTO.pranzo;

  for (const regola of ALLENTAMENTI) {
    const lista = candidati(ctx, {
      tipi,
      pasto: opzioni.pasto,
      giaUsati: regola.ripetuti ? [] : opzioni.giaUsati,
      famigliaVietata: regola.famiglia ? opzioni.famigliaVietata : null,
      peso: regola.peso ? pref.peso : 'tutti',
      tempoMax: regola.tempo ? opzioni.tempoMax : 0
    });
    const scelto = estraiPesato(lista);
    if (!scelto) continue;

    const piatto = scelto.piatto;
    const contorno = piatto.tipo === 'secondo'
      ? scegliContorno(ctx, opzioni.contorniUsati || [], opzioni.tempoMax, piatto)
      : null;
    return {
      pasto: {
        piatto: piatto.id,
        contorno: contorno ? contorno.id : null,
        tempoMax: opzioni.tempoMaxScelto || null,
        scelto: false
      },
      nota: regola.nota
    };
  }
  return null;
}

/**
 * Il contorno di un secondo. Meglio uno non ancora usato in settimana e
 * che ci stia nel tempo che resta; se no, uno qualunque purché permesso.
 */
export function scegliContorno(ctx, contorniUsati, tempoMax, piatto) {
  const resto = tempoMax ? Math.max(15, tempoMax - (piatto ? piatto.tempoMin : 0)) : 0;
  const tentativi = [
    { giaUsati: contorniUsati, tempoMax: resto },
    { giaUsati: contorniUsati, tempoMax: 0 },
    { giaUsati: [], tempoMax: 0 }
  ];
  for (const t of tentativi) {
    const c = estraiPesato(candidati(ctx, { tipi: ['contorno'], giaUsati: t.giaUsati, tempoMax: t.tempoMax }));
    if (c) return c.piatto;
  }
  return null;
}

/* ------------------------------------------------------ genera settimana - */

/** Il tempo di un pasto: quello scelto per quel giorno, o quello di sempre. */
export function tempoDelPasto(pasto, pref, scelto) {
  if (scelto) return scelto;
  if (pasto === 'cena') return pref.tempoMaxCena || 0;
  return pref.tempoMaxMin || 0;
}

/**
 * Genera la settimana.
 * opzioni.fissi: mappa giorno -> { pranzo, cena } con i pasti scelti a mano
 * (o con un tempo scelto), che restano dove sono. Un pasto con `tieni`
 * resta com'è anche se non l'ha scelto l'utente: serve a completare i
 * giorni vuoti senza toccare gli altri.
 * @returns { giorni, note }
 */
export function generaSettimana(ctx, opzioni = {}) {
  const pref = ctx.preferenze;
  const giorniRichiesti = M.GIORNI.filter((g) => (opzioni.giorni || pref.giorni || M.GIORNI).includes(g));
  const pastiRichiesti = M.PASTI.filter((p) => (opzioni.pasti || pref.pasti || M.PASTI).includes(p));
  const fissi = opzioni.fissi || {};
  const idx = ctx.indiceIngredienti;

  // i piatti scelti a mano occupano il loro posto fin dall'inizio
  const usati = [], contorniUsati = [];
  for (const g of Object.values(fissi)) {
    for (const p of Object.values(g)) {
      const resta = p && (p.scelto || p.tieni);
      if (resta && p.piatto) usati.push(p.piatto);
      if (resta && p.contorno) contorniUsati.push(p.contorno);
    }
  }

  const giorni = [];
  const note = new Set();
  let famigliaPrima = null;

  for (const giorno of giorniRichiesti) {
    const pasti = {};
    for (const nome of pastiRichiesti) {
      const fisso = (fissi[giorno] || {})[nome];
      if (fisso && (fisso.scelto || fisso.tieni) && fisso.piatto) {
        pasti[nome] = M.pastoPulito(fisso);
        famigliaPrima = M.famigliaProteinaPrincipale(ctx.piatti.find((x) => x.id === fisso.piatto), idx) || famigliaPrima;
        continue;
      }
      const tempoScelto = fisso && fisso.tempoMax ? fisso.tempoMax : null;
      const esito = componiPasto(ctx, {
        pasto: nome,
        tempoMax: tempoDelPasto(nome, pref, tempoScelto),
        tempoMaxScelto: tempoScelto,
        giaUsati: usati,
        contorniUsati,
        famigliaVietata: famigliaPrima
      });
      if (!esito) continue;
      pasti[nome] = esito.pasto;
      if (esito.nota) note.add(esito.nota);
      usati.push(esito.pasto.piatto);
      if (esito.pasto.contorno) contorniUsati.push(esito.pasto.contorno);
      famigliaPrima = M.famigliaProteinaPrincipale(
        ctx.piatti.find((x) => x.id === esito.pasto.piatto), idx) || famigliaPrima;
    }
    giorni.push({ giorno, pasti });
  }

  const vuoti = giorni.every((g) => !Object.keys(g.pasti).length);
  return {
    giorni: vuoti ? [] : giorni,
    note: vuoti
      ? ['Non trovo piatti adatti: controlla gli esclusi e il catalogo.']
      : [...note].map((n) => `Qualche piatto è ${n}: non c'era di meglio.`)
  };
}

/* ------------------------------------------------------ rigenera un pasto - */

/**
 * Rifà un solo pasto, tenendo conto degli altri per non ripetere piatti.
 * opzioni.tempoMax: il tempo scelto per quel pasto (resta salvato).
 * @returns { pasto, nota } oppure null
 */
export function rigeneraPasto(ctx, menu, giorno, pasto, opzioni = {}) {
  const idx = ctx.indiceIngredienti;
  const indice = menu.giorni.findIndex((g) => g.giorno === giorno);
  if (indice < 0) return null;
  const attuale = (menu.giorni[indice].pasti || {})[pasto] || null;

  const usati = [], contorniUsati = [];
  menu.giorni.forEach((g) => {
    for (const [, p] of M.pastiDi(g)) {
      if (p.piatto) usati.push(p.piatto);       // anche quello di adesso: si cambia davvero
      if (p.contorno) contorniUsati.push(p.contorno);
    }
  });

  const tempoScelto = opzioni.tempoMax !== undefined
    ? opzioni.tempoMax
    : (attuale && attuale.tempoMax) || null;

  const prima = pastoPrima(menu, indice, pasto);
  const esito = componiPasto(ctx, {
    pasto,
    tempoMax: tempoDelPasto(pasto, ctx.preferenze, tempoScelto),
    tempoMaxScelto: tempoScelto,
    giaUsati: usati,
    contorniUsati,
    famigliaVietata: prima
      ? M.famigliaProteinaPrincipale(ctx.piatti.find((x) => x.id === prima.piatto), idx)
      : null
  });
  return esito;
}

/** Cambia solo il contorno di un pasto. */
export function rigeneraContorno(ctx, menu, giorno, pasto) {
  const riga = menu.giorni.find((g) => g.giorno === giorno);
  const attuale = riga && (riga.pasti || {})[pasto];
  if (!attuale || !attuale.piatto) return null;
  const piatto = ctx.piatti.find((x) => x.id === attuale.piatto);
  const usati = [];
  for (const g of menu.giorni) for (const [, p] of M.pastiDi(g)) if (p.contorno) usati.push(p.contorno);
  const c = scegliContorno(ctx, usati, tempoDelPasto(pasto, ctx.preferenze, attuale.tempoMax), piatto);
  return c ? Object.assign({}, attuale, { contorno: c.id }) : null;
}

/** Il pasto che viene subito prima di questo, nella settimana. */
function pastoPrima(menu, indiceGiorno, pasto) {
  const sequenza = [];
  menu.giorni.forEach((g, i) => {
    for (const [nome, p] of M.pastiDi(g)) sequenza.push({ i, nome, p });
  });
  const posto = sequenza.findIndex((x) => x.i === indiceGiorno && x.nome === pasto);
  if (posto > 0) return sequenza[posto - 1].p;
  if (posto < 0) {
    // il pasto non c'è ancora: il precedente è l'ultimo prima di quel giorno
    const prima = sequenza.filter((x) => x.i < indiceGiorno ||
      (x.i === indiceGiorno && M.PASTI.indexOf(x.nome) < M.PASTI.indexOf(pasto)));
    return prima.length ? prima[prima.length - 1].p : null;
  }
  return null;
}

/* ----------------------------------------------------------- date e id --- */

/** Lunedì della settimana di `data`. */
export function lunediDi(data) {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const scarto = (d.getDay() + 6) % 7;      // 0 = lunedì
  d.setDate(d.getDate() - scarto);
  return d;
}

export function iso(data) {
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const g = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${m}-${g}`;
}

/** Il giorno della settimana di una data, come chiave: 'lun', 'mar'... */
export function chiaveGiorno(data) {
  return M.GIORNI[(data.getDay() + 6) % 7];
}

/** Numero di settimana ISO, per dare un id leggibile al menù. */
export function settimanaIso(data) {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const giorno = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - giorno);
  const inizioAnno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { anno: d.getUTCFullYear(), settimana: Math.ceil(((d - inizioAnno) / 86400000 + 1) / 7) };
}

export function idMenu(dataInizio) {
  const { anno, settimana } = settimanaIso(dataInizio);
  return `men_${anno}_w${String(settimana).padStart(2, '0')}`;
}

/** Assegna le date ai giorni a partire dal lunedì. */
export function conDate(giorni, lunedi) {
  return giorni.map((g) => {
    const data = new Date(lunedi);
    data.setDate(lunedi.getDate() + M.GIORNI.indexOf(g.giorno));
    return Object.assign({}, g, { data: iso(data) });
  });
}
