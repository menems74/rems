/* =========================================================================
   planner.js — vincoli, punteggi e generazione del menù.
   Non tocca il database: riceve tutto in un "contesto" e restituisce dati.
   Così si può provare in isolamento e non fallisce mai in silenzio: ogni
   rilassamento dei vincoli viene restituito e mostrato in interfaccia.
   ========================================================================= */

import * as M from './model.js';
import { votoMedio, tempoPercepito } from './tastes.js';

/* La media pesata dei voti vive con i gusti, ma serve qui per il punteggio:
   si ri-esporta perché planner resta l'unico punto d'ingresso del motore. */
export { votoMedio };

/* ------------------------------------------------------------ contesto ---
   { piatti, indiceIngredienti, preferenze, voti, ultimaVolta (Map
   piattoId -> 'AAAA-MM-GG'), dispensa (Set ingredienteId), mese, oggi }   */

export function settimaneDa(dataISO, oggi) {
  if (!dataISO) return null;
  const giorni = (oggi - new Date(dataISO + 'T00:00:00')) / 86400000;
  return giorni / 7;
}

/**
 * Punteggio di un piatto per uno slot, con i componenti in chiaro:
 * la schermata "perché questo piatto" mostra esattamente questa lista.
 */
export function punteggio(piatto, ctx, opzioni = {}) {
  const { preferenze: pref, indiceIngredienti: idx, oggi } = ctx;
  const componenti = [];
  let totale = 50;
  componenti.push({ etichetta: 'base', valore: 50 });

  const media = votoMedio((ctx.voti || {})[piatto.id]);
  if (media != null) {
    const delta = Math.round((media - 3) * 12);
    totale += delta;
    componenti.push({ etichetta: `votato ${media.toFixed(1)}`, valore: delta });
  }

  if ((pref.amoPiatti || []).includes(piatto.id)) {
    totale += 15; componenti.push({ etichetta: 'piatto che ami', valore: 15 });
    // le specifiche chiedono che un piatto amato torni almeno ogni 2 settimane:
    // non come vincolo rigido (romperebbe i macro), ma con una spinta forte
    const da = settimaneDa(ctx.ultimaVolta && ctx.ultimaVolta.get(piatto.id), oggi || new Date());
    if (da == null || da >= 2) {
      totale += 25; componenti.push({ etichetta: 'lo ami e manca da 2 settimane', valore: 25 });
    }
  }

  const amati = (piatto.ingredienti || [])
    .filter((v) => (pref.amoIngredienti || []).includes(v.ingredienteId)).length;
  if (amati) {
    totale += 6 * amati;
    componenti.push({ etichetta: `${amati} ingredienti che ami`, valore: 6 * amati });
  }

  const maiCucinato = !(ctx.ultimaVolta && ctx.ultimaVolta.get(piatto.id));
  if (maiCucinato && opzioni.slotNovitaLibero) {
    totale += 20; componenti.push({ etichetta: 'mai cucinato', valore: 20 });
  }

  const stagioni = piatto.stagioni || [];
  if (stagioni.length && stagioni.includes(ctx.mese)) {
    totale += 10; componenti.push({ etichetta: 'di stagione', valore: 10 });
  }

  if (ctx.dispensa && ctx.dispensa.size) {
    const voci = piatto.ingredienti || [];
    const inCasa = voci.filter((v) => ctx.dispensa.has(v.ingredienteId)).length;
    if (inCasa) {
      const bonus = Math.round(8 * inCasa / voci.length);
      totale += bonus;
      componenti.push({ etichetta: `${inCasa} ingredienti in dispensa`, valore: bonus });
    }
  }

  const cooldown = opzioni.cooldown != null ? opzioni.cooldown : pref.cooldownSettimane;
  const settimane = settimaneDa(ctx.ultimaVolta && ctx.ultimaVolta.get(piatto.id), oggi || new Date());
  if (settimane != null && cooldown > 0 && settimane < cooldown) {
    const penalita = -Math.round(30 * (1 - settimane / cooldown));
    totale += penalita;
    componenti.push({ etichetta: `fatto ${Math.max(0, Math.round(settimane))} settimane fa`, valore: penalita });
  }

  /* Quello che era l'obbligo (proteine, carboidrati e fibre a ogni pasto)
     dalla 2.0 è una preferenza: un piatto che porta quello che al pasto
     ancora manca vale qualche punto in più. L'app continua a proporre
     giornate equilibrate, ma non si rifiuta più di comporre il pasto. */
  const mancanti = opzioni.macroMancanti || [];
  if (mancanti.length) {
    const coperti = M.macroCoperti(piatto, idx);
    const utili = mancanti.filter((m) => coperti.includes(m));
    if (utili.length) {
      const bonus = 8 * utili.length;
      totale += bonus;
      componenti.push({
        etichetta: 'porta ' + utili.map((m) => M.NOME_MACRO[m]).join(' e '),
        valore: bonus
      });
    }
  }

  // il tempo che conta è quello percepito: se l'ho segnato "troppo lungo",
  // il piatto pesa come se durasse di più anche se la ricetta dice altro.
  // tempoMax a 0 vuol dire nessun limite: è il caso della cena.
  const tempoMax = opzioni.tempoMax != null ? opzioni.tempoMax : pref.tempoMaxMin;
  const tempo = tempoPercepito(piatto, (ctx.voti || {})[piatto.id]);
  if (tempoMax > 0 && tempo > tempoMax) {
    totale -= 15;
    componenti.push({
      etichetta: tempo > piatto.tempoMin
        ? `l'hai trovato lungo: conta ${tempo} min su ${tempoMax}`
        : `più lungo di ${tempoMax} min`,
      valore: -15
    });
  }

  if (piatto.difficolta === 3) {
    totale -= 10; componenti.push({ etichetta: 'difficile', valore: -10 });
  }

  const jitter = opzioni.senzaCaso ? 0 : Math.round((Math.random() * 10 - 5));
  if (jitter) { totale += jitter; componenti.push({ etichetta: 'caso', valore: jitter }); }

  return { totale, componenti, maiCucinato };
}

/* -------------------------------------------------------- vincoli rigidi - */

/** Estrazione pesata tra i primi N: non sempre il massimo, o il menù si ripete. */
function estraiPesato(candidati, quanti = 5) {
  const migliori = candidati.slice(0, quanti);
  if (!migliori.length) return null;
  const minimo = Math.min(...migliori.map((c) => c.punteggio));
  const pesi = migliori.map((c) => Math.max(1, c.punteggio - minimo + 5));
  const totale = pesi.reduce((a, b) => a + b, 0);
  let tiro = Math.random() * totale;
  for (let i = 0; i < migliori.length; i++) {
    tiro -= pesi[i];
    if (tiro <= 0) return migliori[i];
  }
  return migliori[migliori.length - 1];
}

/**
 * Candidati per uno slot: filtra i vincoli rigidi (la blacklist non si
 * rilassa mai), calcola il punteggio e ordina.
 */
function candidati(ctx, filtro, opzioni) {
  const { piatti, indiceIngredienti: idx, preferenze: pref } = ctx;
  const fuori = new Set(opzioni.giaUsati || []);
  const cooldown = opzioni.cooldown != null ? opzioni.cooldown : pref.cooldownSettimane;

  const out = [];
  for (const piatto of piatti) {
    if (fuori.has(piatto.id)) continue;
    if (M.motivoIndisponibilita(piatto, { indiceIngredienti: idx, preferenze: pref, mese: ctx.mese })) continue;
    if (filtro.tipi && !filtro.tipi.includes(piatto.tipo)) continue;

    // cooldown: dentro la finestra il piatto è escluso, non solo penalizzato
    if (cooldown > 0) {
      const s = settimaneDa(ctx.ultimaVolta && ctx.ultimaVolta.get(piatto.id), ctx.oggi || new Date());
      if (s != null && s < cooldown) continue;
    }

    // mai la stessa proteina del pasto precedente
    if (filtro.famigliaVietata) {
      const fam = M.famigliaProteinaPrincipale(piatto, idx);
      if (fam && fam === filtro.famigliaVietata) continue;
    }

    const p = punteggio(piatto, ctx, opzioni);
    out.push({ piatto, punteggio: p.totale, componenti: p.componenti, maiCucinato: p.maiCucinato });
  }
  out.sort((a, b) => b.punteggio - a.punteggio);
  return out;
}
/* --------------------------------------------------------- componi pasto -
   Un pasto ha una forma (piatto unico, primo + secondo, secondo + contorno)
   e la si riempie un posto alla volta, scegliendo ogni volta tra i primi
   cinque candidati. Dalla 2.0 non c'è più nessun obbligo nutrizionale: se
   per un posto non c'è niente, si va avanti con quello che si è trovato.  */

/**
 * Compone un pasto. Restituisce {piatti, modalita, perche} oppure null se
 * davvero non c'è niente da mettere in tavola.
 */
export function componiPasto(ctx, opzioni) {
  const idx = ctx.indiceIngredienti;
  const modalita = M.MODALITA.includes(opzioni.modalita) ? opzioni.modalita : 'unico';
  const scelti = [];
  const perche = {};

  for (const tipo of M.TIPI_MODALITA[modalita]) {
    aggiungi(tipo, tipo !== 'primo' && tipo !== 'contorno');
  }

  // un contorno in più se manca la fibra: non è un obbligo, è buona cucina
  if (modalita === 'primoSecondo' && M.macroMancanti(scelti, idx).includes('fibra')) {
    aggiungi('contorno', false);
  }

  if (!scelti.length) return null;
  return { piatti: scelti, modalita, perche };

  function aggiungi(tipo, guardaProteina) {
    const c = estraiPesato(candidati(ctx, {
      tipi: [tipo],
      famigliaVietata: guardaProteina ? opzioni.famigliaVietata : null
    }, Object.assign({}, opzioni, {
      giaUsati: (opzioni.giaUsati || []).concat(scelti.map((p) => p.id)),
      macroMancanti: M.macroMancanti(scelti, idx)
    })));
    if (!c) return;
    scelti.push(c.piatto);
    perche[c.piatto.id] = c.componenti;
  }
}

/* ------------------------------------------------------ genera settimana - */

const LIVELLI_RILASSAMENTO = [
  { chiave: 'nessuno', etichetta: null },
  { chiave: 'quotaNovita', etichetta: 'quota di piatti nuovi ridotta' },
  { chiave: 'varietaProteine', etichetta: 'varietà delle proteine non garantita' },
  { chiave: 'cooldownDimezzato', etichetta: 'cooldown dimezzato: qualche piatto torna prima' }
];

/**
 * Genera la settimana, pranzo e cena.
 * `giorniFissi` è una mappa giorno -> { pranzo: {...}, cena: {...} } con i
 * pasti bloccati, che non vengono toccati.
 * Restituisce { giorni, rilassamenti, avvisi, perche }.
 */
export function generaSettimana(ctx, opzioni = {}) {
  const pref = ctx.preferenze;
  const giorniRichiesti = opzioni.giorni || pref.giorni;
  const pastiRichiesti = (opzioni.pasti || pref.pasti || ['pranzo'])
    .filter((x) => M.PASTI.includes(x));
  const fissi = opzioni.giorniFissi || {};

  for (let livello = 0; livello < LIVELLI_RILASSAMENTO.length; livello++) {
    const rilassa = {
      quotaNovita: livello >= 1 ? 0 : pref.quotaNovita,
      varietaProteine: livello < 2,
      cooldown: livello >= 3 ? Math.floor(pref.cooldownSettimane / 2) : pref.cooldownSettimane
    };

    for (let tentativo = 0; tentativo < 60; tentativo++) {
      const esito = unTentativo(ctx, giorniRichiesti, pastiRichiesti, fissi, rilassa);
      if (!esito) continue;

      const avvisi = [];
      if (esito.novita < rilassa.quotaNovita) continue;      // riprova
      if (rilassa.varietaProteine && esito.proteine.size < 3) continue;

      const rilassamenti = LIVELLI_RILASSAMENTO.slice(1, livello + 1)
        .map((r) => r.etichetta).filter(Boolean);

      if (livello >= 1 && pref.quotaNovita > 0 && esito.novita < pref.quotaNovita) {
        avvisi.push(`Piatti mai cucinati disponibili: ${esito.novita} invece di ${pref.quotaNovita}. ` +
                    'Puoi importarne di nuovi da "Nuovi piatti".');
      }
      return { giorni: esito.giorni, perche: esito.perche, rilassamenti, avvisi };
    }
  }

  return {
    giorni: [], perche: {}, rilassamenti: [],
    avvisi: ['Non riesco a comporre la settimana: i vincoli sono troppo stretti. ' +
             'Controlla gli ingredienti esclusi e il catalogo.']
  };
}

/** Il tempo massimo di un pasto: 0 vuol dire che non ce n'è. */
export function tempoMassimo(pasto, giorno, pref) {
  if (pasto === 'cena') return pref.tempoMaxCena || 0;
  return (pref.tempoMaxPerGiorno || {})[giorno] || pref.tempoMaxMin;
}

function unTentativo(ctx, giorniRichiesti, pastiRichiesti, fissi, rilassa) {
  const idx = ctx.indiceIngredienti;
  const pref = ctx.preferenze;
  const giorni = [];
  const usati = [];
  const proteine = new Set(), fibre = new Set();
  let novita = 0;
  let primoSecondoUsati = 0;
  let famigliaPrecedente = null;      // la proteina del pasto appena messo
  let avanziRimasti = Math.max(0, Math.min(pref.avanziASettimana || 0, giorniRichiesti.length));
  let perche = {};

  giorniRichiesti.forEach((giorno, indiceGiorno) => {
    const pasti = {};

    for (const pasto of pastiRichiesti) {
      const fisso = (fissi[giorno] || {})[pasto];
      if (fisso) {
        pasti[pasto] = Object.assign({}, M.pastoPulito(fisso), { bloccato: true });
        for (const p of fisso.piattiOggetti || []) segnaUsato(p, false);
        famigliaPrecedente = ultimaFamiglia(fisso.piattiOggetti || []) || famigliaPrecedente;
        if (fisso.modalita === 'primoSecondo') primoSecondoUsati++;
        continue;
      }

      // la cena con gli avanzi non consuma catalogo: si ricucina il pranzo
      if (pasto === 'cena' && pasti.pranzo && (pasti.pranzo.piatti || []).length &&
          !pasti.pranzo.avanziDa && avanziRimasti > 0 &&
          Math.random() < avanziRimasti / Math.max(1, giorniRichiesti.length - indiceGiorno)) {
        pasti.cena = M.pastoPulito({ modalita: pasti.pranzo.modalita,
                                     piatti: pasti.pranzo.piatti, avanziDa: 'pranzo' });
        avanziRimasti--;
        continue;
      }

      const tempoMax = tempoMassimo(pasto, giorno, pref);
      const modalita = scegliModalita(pasto, pref, primoSecondoUsati, tempoMax);
      const esito = componiPasto(ctx, {
        modalita, tempoMax, cooldown: rilassa.cooldown, giaUsati: usati,
        famigliaVietata: rilassa.varietaProteine ? famigliaPrecedente : null,
        slotNovitaLibero: novita < rilassa.quotaNovita
      }) || componiPasto(ctx, {
        // ripiego: se quella forma non si riempie, si prova il piatto unico.
        // La proteina resta vietata anche qui: due pasti di fila con la stessa
        // si vedono, e se proprio non se ne esce ci pensa il rilassamento.
        modalita: 'unico', tempoMax, cooldown: rilassa.cooldown, giaUsati: usati,
        famigliaVietata: rilassa.varietaProteine ? famigliaPrecedente : null,
        slotNovitaLibero: false
      });
      if (!esito) return;                     // giorno impossibile: tentativo fallito

      if (esito.modalita === 'primoSecondo') primoSecondoUsati++;
      for (const p of esito.piatti) segnaUsato(p, true);
      famigliaPrecedente = ultimaFamiglia(esito.piatti) || famigliaPrecedente;
      perche = Object.assign(perche, esito.perche);
      pasti[pasto] = M.pastoPulito({ modalita: esito.modalita,
                                     piatti: esito.piatti.map((p) => p.id) });
    }

    if (!Object.keys(pasti).length) return;
    giorni.push({ giorno, pasti });
  });

  if (giorni.length !== giorniRichiesti.length) return null;
  return { giorni, novita, proteine, fibre, perche };

  function segnaUsato(piatto, contaNovita) {
    usati.push(piatto.id);
    const fam = M.famigliaProteinaPrincipale(piatto, idx);
    if (fam) proteine.add(fam);
    for (const f of M.fibrePrincipali(piatto, idx)) fibre.add(f);
    if (contaNovita && !(ctx.ultimaVolta && ctx.ultimaVolta.get(piatto.id))) novita++;
  }

  function ultimaFamiglia(piatti) {
    return piatti.map((p) => M.famigliaProteinaPrincipale(p, idx)).filter(Boolean)[0] || null;
  }
}

/**
 * La forma del pasto, §4.1 aggiornato: i giorni corti vanno al piatto unico,
 * c'è un tetto ai pranzi con primo e secondo, e la cena preferisce il piatto
 * unico o un secondo con il contorno. Poi il caso, per non avere settimane
 * tutte uguali.
 */
export function scegliModalita(pasto, pref, primoSecondoUsati, tempoMax) {
  if (pasto === 'cena') return Math.random() < 0.65 ? 'unico' : 'secondoContorno';
  if (tempoMax > 0 && tempoMax <= 25) return 'unico';
  if (primoSecondoUsati >= (pref.maxGiorniPrimoSecondo != null ? pref.maxGiorniPrimoSecondo : 3)) {
    return 'unico';
  }
  return Math.random() < 0.6 ? 'unico' : 'primoSecondo';
}

/* ------------------------------------------------------ rigenera un pasto - */

/** Rigenera un solo pasto, tenendo conto degli altri per non ripetere piatti. */
export function rigeneraPasto(ctx, menu, giorno, pasto, opzioni = {}) {
  const pref = ctx.preferenze;
  const idx = ctx.indiceIngredienti;
  const indice = menu.giorni.findIndex((g) => g.giorno === giorno);
  if (indice < 0) return null;
  const attuale = (menu.giorni[indice].pasti || {})[pasto];

  // tutti i piatti già in settimana, tranne quelli del pasto che si rifà
  const usati = [];
  menu.giorni.forEach((g, i) => {
    for (const [nome, p] of M.pastiDi(g)) {
      if (i === indice && nome === pasto) continue;
      if (p.avanziDa) continue;              // gli avanzi non occupano un piatto
      usati.push(...(p.piatti || []));
    }
  });

  const famigliaPrecedente = famigliaPrimaDi(menu, indice, pasto, idx);
  const tempoMax = tempoMassimo(pasto, giorno, pref);
  const modalita = opzioni.modalita || (attuale && attuale.modalita) ||
                   scegliModalita(pasto, pref, 0, tempoMax);

  // stessa scala di rilassamenti, ma su un solo pasto
  for (const cooldown of [pref.cooldownSettimane, Math.floor(pref.cooldownSettimane / 2), 0]) {
    for (const famiglia of [famigliaPrecedente, null]) {
      for (let t = 0; t < 30; t++) {
        const esito = componiPasto(ctx, {
          modalita, tempoMax, cooldown, giaUsati: usati,
          famigliaVietata: famiglia, slotNovitaLibero: true
        });
        if (esito) {
          return {
            pasto: M.pastoPulito({ modalita: esito.modalita,
                                   piatti: esito.piatti.map((p) => p.id) }),
            piattiOggetti: esito.piatti,
            perche: esito.perche,
            rilassamenti: [
              cooldown !== pref.cooldownSettimane ? 'cooldown ridotto per questo pasto' : null,
              famiglia === null && famigliaPrecedente ? 'ripetuta la proteina del pasto prima' : null
            ].filter(Boolean)
          };
        }
      }
    }
  }
  return null;
}

/** La proteina del pasto che viene subito prima di questo, nella settimana. */
function famigliaPrimaDi(menu, indiceGiorno, pasto, idx) {
  const sequenza = [];
  menu.giorni.forEach((g, i) => {
    for (const [nome, p] of M.pastiDi(g)) sequenza.push({ i, nome, p });
  });
  const posto = sequenza.findIndex((x) => x.i === indiceGiorno && x.nome === pasto);
  const prima = posto > 0 ? sequenza[posto - 1] : null;
  if (!prima) return null;
  const piatti = (prima.p.piattiOggetti || []);
  return piatti.map((p) => M.famigliaProteinaPrincipale(p, idx)).filter(Boolean)[0] || null;
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
  const ordine = M.GIORNI;
  return giorni.map((g) => {
    const data = new Date(lunedi);
    data.setDate(lunedi.getDate() + ordine.indexOf(g.giorno));
    return Object.assign({}, g, { data: iso(data) });
  });
}
