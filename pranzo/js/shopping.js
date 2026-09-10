/* =========================================================================
   shopping.js — dal menù alla lista della spesa.
   Tutta l'aggregazione avviene in unità canonica: si converte prima di
   sommare, mai dopo. Funzioni pure: il database sta fuori da qui.
   ========================================================================= */

import * as M from './model.js';

/**
 * Somma gli ingredienti del menù, sottrae la dispensa, arrotonda al formato
 * d'acquisto e raggruppa per reparto.
 *
 * @param menu        record del menù (giorni con id piatto)
 * @param ctx         { indicePiatti, indiceIngredienti, dispensa (Map id->qta),
 *                      porzioni, ordineReparti }
 * @param precedente  lista già esistente: le spunte vengono conservate
 */
export function generaLista(menu, ctx, precedente) {
  const { indicePiatti: piatti, indiceIngredienti: ingredienti } = ctx;
  const porzioni = ctx.porzioni || 1;
  const dispensa = ctx.dispensa || new Map();

  const somme = new Map();     // ingredienteId -> { qta, usatoIn:Set }
  const problemi = [];

  for (const giorno of menu.giorni || []) {
    for (const piattoId of giorno.piatti || []) {
      const piatto = piatti.get(piattoId);
      if (!piatto) { problemi.push(`piatto sconosciuto nel menù: ${piattoId}`); continue; }
      for (const voce of piatto.ingredienti || []) {
        const ing = ingredienti.get(voce.ingredienteId);
        if (!ing) { problemi.push(`ingrediente sconosciuto: ${voce.ingredienteId}`); continue; }
        let qta;
        try {
          qta = M.qtaCanonicaVoce(voce, ing, porzioni);
        } catch (e) {
          problemi.push(`${piatto.nome}: ${e.message}`);
          continue;
        }
        const riga = somme.get(ing.id) || { qta: 0, usatoIn: new Set() };
        riga.qta += qta;
        riga.usatoIn.add(piatto.nome);
        somme.set(ing.id, riga);
      }
    }
  }

  const spunte = mappaSpunte(precedente);

  const voci = [];
  for (const [ingredienteId, riga] of somme) {
    const ing = ingredienti.get(ingredienteId);
    const inDispensa = Math.max(0, dispensa.get(ingredienteId) || 0);
    const daComprare = Math.max(0, arrotondaSensato(riga.qta) - inDispensa);
    const arrotondamento = arrotondaAlFormato(daComprare, ing);
    const vecchia = spunte.get(ingredienteId);

    voci.push({
      ingredienteId,
      nome: ing.nome,
      reparto: ing.reparto,
      unita: ing.unita,
      qtaRichiesta: arrotondaSensato(riga.qta),
      qtaInDispensa: inDispensa,
      qtaDaComprare: arrotondamento.qta,
      pacchi: arrotondamento.pacchi,
      notaArrotondamento: arrotondamento.nota,
      giaInCasa: vecchia ? !!vecchia.giaInCasa : false,
      comprato: vecchia ? !!vecchia.comprato : false,
      usatoIn: [...riga.usatoIn].sort((a, b) => a.localeCompare(b, 'it'))
    });
  }

  ordinaPerReparto(voci, ctx.ordineReparti || M.REPARTI);

  return {
    menuId: menu.id,
    generata: new Date().toISOString(),
    voci,
    libere: (precedente && precedente.libere) ? precedente.libere.slice() : [],
    problemi
  };
}

/** Le quantità restano leggibili: niente 149.99999 per colpa dei decimali. */
export function arrotondaSensato(qta) {
  return Math.round(qta * 100) / 100;
}

/**
 * Arrotonda a quanto si compra davvero e spiega cosa avanzerà.
 * Se il formato non è noto si resta sulla quantità richiesta.
 */
export function arrotondaAlFormato(qta, ingrediente) {
  if (qta <= 0) return { qta: 0, pacchi: 0, nota: '' };
  const formato = ingrediente.formatoAcquisto || {};
  const passo = formato.qta;
  if (!passo || passo <= 0) return { qta: arrotondaSensato(qta), pacchi: 0, nota: '' };

  const pacchi = Math.ceil(arrotondaSensato(qta) / passo - 0.0001);
  const totale = arrotondaSensato(pacchi * passo);
  const avanzo = arrotondaSensato(totale - qta);
  const etichetta = formato.label || `confezione da ${passo} ${ingrediente.unita}`;

  let nota;
  if (pacchi === 1) {
    nota = avanzo > 0
      ? `${etichetta}, avanzano ~${M.formattaQta(avanzo, ingrediente.unita)}`
      : `${etichetta}, giusta`;
  } else {
    nota = avanzo > 0
      ? `${etichetta}, prendine ${pacchi}: avanzano ~${M.formattaQta(avanzo, ingrediente.unita)}`
      : `${etichetta}, prendine ${pacchi}`;
  }
  return { qta: totale, pacchi, nota };
}

/** Le spunte sopravvivono alla rigenerazione: si ritrovano per ingrediente. */
function mappaSpunte(lista) {
  const m = new Map();
  for (const v of (lista && lista.voci) || []) {
    m.set(v.ingredienteId, { giaInCasa: v.giaInCasa, comprato: v.comprato });
  }
  return m;
}

export function ordinaPerReparto(voci, ordineReparti) {
  const peso = new Map(ordineReparti.map((r, i) => [r, i]));
  voci.sort((a, b) => {
    const pa = peso.has(a.reparto) ? peso.get(a.reparto) : 99;
    const pb = peso.has(b.reparto) ? peso.get(b.reparto) : 99;
    if (pa !== pb) return pa - pb;
    return a.nome.localeCompare(b.nome, 'it');
  });
  return voci;
}

/** Raggruppa per reparto conservando l'ordine del giro al supermercato. */
export function perReparto(lista, ordineReparti) {
  const gruppi = new Map();
  for (const reparto of ordineReparti) gruppi.set(reparto, []);
  for (const voce of lista.voci || []) {
    if (!gruppi.has(voce.reparto)) gruppi.set(voce.reparto, []);
    gruppi.get(voce.reparto).push(voce);
  }
  for (const voce of lista.libere || []) {
    const reparto = voce.reparto || 'altro';
    if (!gruppi.has(reparto)) gruppi.set(reparto, []);
    gruppi.get(reparto).push(voce);
  }
  return [...gruppi.entries()].filter(([, voci]) => voci.length);
}

/** Conteggio in testa alla lista: "comprati 12 di 18". */
export function conteggio(lista) {
  const daComprare = (lista.voci || []).filter((v) => !v.giaInCasa);
  const libere = lista.libere || [];
  const totale = daComprare.length + libere.length;
  const fatti = daComprare.filter((v) => v.comprato).length + libere.filter((v) => v.comprato).length;
  return { fatti, totale };
}

/* --------------------------------------------------------------- azioni --- */

export function segnaComprato(lista, chiave, valore) {
  const voce = trova(lista, chiave);
  if (voce) voce.comprato = valore != null ? !!valore : !voce.comprato;
  return lista;
}

/**
 * "Ce l'ho già": la voce esce dalla lista da comprare ed entra in dispensa
 * con la quantità che serviva. Restituisce l'aggiornamento per la dispensa.
 */
export function segnaInCasa(lista, ingredienteId, valore) {
  const voce = (lista.voci || []).find((v) => v.ingredienteId === ingredienteId);
  if (!voce) return null;
  voce.giaInCasa = valore != null ? !!valore : !voce.giaInCasa;
  if (voce.giaInCasa) {
    voce.comprato = false;
    return { ingredienteId, qta: voce.qtaRichiesta, unita: voce.unita };
  }
  return { ingredienteId, qta: 0, unita: voce.unita };
}

export function aggiungiVoceLibera(lista, testo, reparto = 'altro') {
  const nome = String(testo || '').trim();
  if (!nome) return null;
  const voce = { id: 'lib_' + Date.now().toString(36), nome, reparto, libera: true, comprato: false };
  lista.libere = (lista.libere || []).concat([voce]);
  return voce;
}

export function togliVoceLibera(lista, id) {
  lista.libere = (lista.libere || []).filter((v) => v.id !== id);
  return lista;
}

function trova(lista, chiave) {
  return (lista.voci || []).find((v) => v.ingredienteId === chiave)
      || (lista.libere || []).find((v) => v.id === chiave);
}

/* ------------------------------------------------------------- dispensa -- */

/**
 * Quanto scalare dalla dispensa dopo aver cucinato un piatto: proposta, non
 * automatismo. L'interfaccia la mostra e l'utente conferma.
 */
export function propostaScarico(piatto, ctx) {
  const porzioni = ctx.porzioni || 1;
  const dispensa = ctx.dispensa || new Map();
  const righe = [];
  for (const voce of piatto.ingredienti || []) {
    const ing = ctx.indiceIngredienti.get(voce.ingredienteId);
    if (!ing) continue;
    let usata;
    try { usata = M.qtaCanonicaVoce(voce, ing, porzioni); } catch (e) { continue; }
    const inCasa = dispensa.get(ing.id) || 0;
    if (inCasa <= 0) continue;                       // non c'era: niente da scalare
    righe.push({
      ingredienteId: ing.id, nome: ing.nome, unita: ing.unita,
      usata: arrotondaSensato(usata),
      inCasa: arrotondaSensato(inCasa),
      restante: arrotondaSensato(Math.max(0, inCasa - usata)),
      scarica: true
    });
  }
  return righe;
}
