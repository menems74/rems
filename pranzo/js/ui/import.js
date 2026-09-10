/* =========================================================================
   ui/import.js — "Nuovi piatti": tre passi e basta.
   1. copia il prompt (o condividilo direttamente all'app dell'AI)
   2. incolla la risposta
   3. accetta o scarta, uno per uno
   Niente chiavi, niente account, nessuna chiamata di rete: l'AI la scegli tu.
   ========================================================================= */

import { el, svuotaNodo, avviso } from './dom.js';
import * as M from '../model.js';
import * as IA from '../ai-import.js';

/* Lo stato del passaggio resta in memoria: cambiare scheda e tornare non
   deve far perdere quello che hai incollato. */
const bozza = { quanti: 5, richiesta: '', risposta: '', proposte: null, copiato: false };

export function render(contenitore, stato) {
  svuotaNodo(contenitore);
  contenitore.appendChild(passoChiedi(stato));
  contenitore.appendChild(passoIncolla(stato));
  if (bozza.proposte) contenitore.appendChild(passoScegli(stato));
}

function ridisegna(stato) {
  render(document.getElementById('vista'), stato);
}

/* ---------------------------------------------------------- 1. chiedere -- */

function passoChiedi(stato) {
  const blocco = el('section', { class: 'passo' });
  blocco.appendChild(titolo('1', 'Chiedi a un\'AI'));
  blocco.appendChild(el('p', { class: 'spiega' },
    'Il prompt sa già i tuoi gusti, la stagione e il tempo che hai. ' +
    'Va bene qualunque AI, anche gratuita.'));

  const richiesta = el('input', {
    type: 'text', value: bozza.richiesta, placeholder: 'cosa ti va oggi? (facoltativo)',
    'aria-label': 'Una richiesta in più per l\'AI',
    oninput: (e) => { bozza.richiesta = e.target.value; }
  });
  blocco.appendChild(richiesta);

  const scelte = el('div', { class: 'quantiPiatti' }, [3, 5, 8].map((n) =>
    el('button', {
      class: 'testuale' + (bozza.quanti === n ? ' acceso' : ''), type: 'button',
      onclick: () => { bozza.quanti = n; ridisegna(stato); }
    }, `${n} piatti`)));
  blocco.appendChild(scelte);

  const testoPrompt = () => IA.creaPrompt(contestoPrompt(stato),
    { quanti: bozza.quanti, richiesta: bozza.richiesta });

  const copia = el('button', {
    class: 'azione', type: 'button',
    onclick: async () => {
      const ok = await negliAppunti(testoPrompt());
      bozza.copiato = ok;
      avviso(ok ? 'Prompt copiato: incollalo nell\'AI e torna qui con la risposta.'
                : 'Non riesco a copiare: apri "vedi il prompt" e copialo a mano.',
             ok ? 'info' : 'errore');
      if (ok) ridisegna(stato);
    }
  }, bozza.copiato ? 'Copia di nuovo il prompt' : 'Copia il prompt');
  blocco.appendChild(copia);

  const sotto = el('div', { class: 'sottoAzioni' });
  if (navigator.share) {
    sotto.appendChild(el('button', {
      class: 'testuale', type: 'button',
      onclick: () => navigator.share({ text: testoPrompt() }).catch(() => {})
    }, 'condividi con un\'app'));
  }
  blocco.appendChild(sotto);

  const dettagli = el('details', { class: 'vediPrompt' }, [
    el('summary', {}, 'vedi il prompt'),
    el('textarea', { rows: '10', readonly: 'readonly', 'aria-label': 'Prompt' }, testoPrompt())
  ]);
  blocco.appendChild(dettagli);

  return blocco;
}

function contestoPrompt(stato) {
  return {
    piatti: stato.piatti,
    ingredienti: stato.ingredienti,
    indiceIngredienti: stato.indiceIngredienti,
    preferenze: stato.preferenze,
    voti: stato.voti,
    ultimaVolta: stato.ultimaVolta,
    mese: M.mesecorrente()
  };
}

/** Appunti: prima l'API moderna, poi il vecchio trucco della selezione. */
async function negliAppunti(testo) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(testo);
      return true;
    }
  } catch (e) { /* si prova il ripiego */ }
  try {
    const area = document.createElement('textarea');
    area.value = testo;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch (e) { return false; }
}

/* --------------------------------------------------------- 2. incollare -- */

function passoIncolla(stato) {
  const blocco = el('section', { class: 'passo' });
  blocco.appendChild(titolo('2', 'Incolla la risposta'));

  const area = el('textarea', {
    rows: '6', placeholder: 'incolla qui tutta la risposta dell\'AI',
    'aria-label': 'Risposta dell\'AI',
    oninput: (e) => { bozza.risposta = e.target.value; }
  }, bozza.risposta);
  blocco.appendChild(area);

  const sotto = el('div', { class: 'sottoAzioni' });
  if (navigator.clipboard && navigator.clipboard.readText) {
    sotto.appendChild(el('button', {
      class: 'testuale', type: 'button',
      onclick: async () => {
        try {
          const testo = await navigator.clipboard.readText();
          if (!testo) { avviso('Gli appunti sono vuoti.', 'errore'); return; }
          bozza.risposta = testo;
          area.value = testo;
          controlla(stato);
        } catch (e) {
          avviso('Non riesco a leggere gli appunti: incolla a mano nel riquadro.', 'errore');
        }
      }
    }, 'incolla dagli appunti'));
  }
  if (bozza.risposta) {
    sotto.appendChild(el('button', {
      class: 'testuale', type: 'button',
      onclick: () => { bozza.risposta = ''; bozza.proposte = null; ridisegna(stato); }
    }, 'svuota'));
  }
  blocco.appendChild(sotto);

  blocco.appendChild(el('button', {
    class: 'azione secondaria', type: 'button',
    onclick: () => controlla(stato)
  }, 'Controlla la risposta'));

  return blocco;
}

function controlla(stato) {
  let grezzi;
  try {
    grezzi = IA.estraiJson(bozza.risposta);
  } catch (errore) {
    bozza.proposte = null;
    avviso(errore.message + ' Copia tutta la risposta, anche il testo intorno.', 'errore');
    ridisegna(stato);
    return;
  }
  bozza.proposte = IA.esaminaTutti(grezzi, contestoEsame(stato));
  const buoni = bozza.proposte.filter((p) => p.accettabile).length;
  avviso(bozza.proposte.length
    ? `${bozza.proposte.length} piatti letti, ${buoni} pronti da accettare.`
    : 'Non ho trovato piatti nella risposta.', bozza.proposte.length ? 'info' : 'errore');
  ridisegna(stato);
}

function contestoEsame(stato) {
  return {
    piatti: stato.piatti,
    ingredienti: stato.ingredienti,
    indiceIngredienti: stato.indiceIngredienti,
    preferenze: stato.preferenze
  };
}

/* ----------------------------------------------------------- 3. scegli --- */

function passoScegli(stato) {
  const blocco = el('section', { class: 'passo' });
  blocco.appendChild(titolo('3', 'Accetta o scarta'));

  if (!bozza.proposte.length) {
    blocco.appendChild(el('p', { class: 'vuoto' }, 'Niente da guardare.'));
    return blocco;
  }

  for (const proposta of bozza.proposte) {
    blocco.appendChild(schedaProposta(proposta, stato));
  }
  return blocco;
}

function schedaProposta(proposta, stato) {
  const scheda = el('article', { class: 'proposta' + (proposta.accettabile ? '' : ' storta') });
  scheda.appendChild(el('p', { class: 'testoProposta' }, proposta.nome));

  const p = proposta.piatto;
  if (p) {
    scheda.appendChild(el('p', { class: 'conteggio' },
      `${p.tipo} · ${M.formattaTempo(p.tempoMin)} · difficoltà ${p.difficolta} · ` +
      `${p.ingredienti.length} ingredienti · ${p.passi.length} passi`));
  }

  for (const problema of proposta.problemi) {
    scheda.appendChild(el('p', { class: 'motivo piccolo' }, problema));
  }
  for (const nota of proposta.avvisi) {
    scheda.appendChild(el('p', { class: 'conteggio' }, nota));
  }

  // gli ingredienti nuovi: l'app non indovina macro e reparto, li chiede
  for (const ing of proposta.ingredientiNuovi || []) {
    scheda.appendChild(domandeIngrediente(ing, proposta, stato));
  }

  if (p) {
    scheda.appendChild(el('details', { class: 'vediPrompt' }, [
      el('summary', {}, 'com\'è fatto'),
      el('ul', { class: 'ingredienti' }, p.ingredienti.map((voce) => {
        const ing = stato.indiceIngredienti.get(voce.ingredienteId) ||
                    (proposta.ingredientiNuovi || []).find((x) => x.id === voce.ingredienteId);
        return el('li', {}, [
          el('span', {}, (ing ? ing.nome : voce.ingredienteId) +
            (ing && ing.origine === 'ai' && !stato.indiceIngredienti.has(voce.ingredienteId) ? ' (nuovo)' : '')),
          el('span', { class: 'qta' }, M.formattaQta(voce.qta, voce.unita))
        ]);
      })),
      el('ol', { class: 'passi' }, p.passi.map((x) => el('li', {}, x)))
    ]));
  }

  // il bottone dice la verità prima del tocco: se il piatto non si può
  // tenere non lo si offre, se manca una risposta lo si dice
  const daCompletare = (proposta.ingredientiNuovi || []).filter(incompleto);
  const azioni = el('div', { class: 'azioniProposta' });
  if (!proposta.accettabile) {
    azioni.appendChild(el('span', { class: 'spentoTesto' }, 'non si può tenere'));
  } else if (daCompletare.length) {
    azioni.appendChild(el('button', { class: 'testuale', type: 'button', disabled: 'disabled' },
      daCompletare.length === 1 ? 'prima dimmi cos\'è' : 'prima dimmi cosa sono'));
  } else {
    azioni.appendChild(el('button', {
      class: 'testuale acceso', type: 'button',
      onclick: () => accetta(proposta, stato)
    }, 'tienilo'));
  }
  azioni.appendChild(el('button', {
    class: 'testuale', type: 'button',
    onclick: () => {
      bozza.proposte = bozza.proposte.filter((x) => x !== proposta);
      ridisegna(stato);
    }
  }, 'scarta'));
  scheda.appendChild(azioni);

  return scheda;
}

/** Un ingrediente mai visto: cos'è, in che unità si misura, dove si compra. */
function domandeIngrediente(ing, proposta, stato) {
  const riga = el('div', { class: 'ingredienteNuovo' });
  riga.appendChild(el('p', { class: 'nomeNuovo' }, ing.nome));

  const campi = el('div', { class: 'campiNuovo' });

  campi.appendChild(el('select', {
    'aria-label': `Cos'è ${ing.nome}`,
    onchange: (e) => {
      ing.macro = e.target.value;
      if (ing.macro !== 'proteina') delete ing.famiglia;
      ridisegna(stato);
    }
  }, [el('option', { value: '' }, 'cos\'è?'),
      ...M.MACRO.map((m) => el('option', { value: m, selected: ing.macro === m || null },
        M.NOME_MACRO[m] || m))]));

  campi.appendChild(el('select', {
    'aria-label': `Unità di ${ing.nome}`,
    onchange: (e) => { ing.unita = e.target.value; ridisegna(stato); }
  }, M.UNITA.map((u) => el('option', { value: u, selected: ing.unita === u || null }, u))));

  campi.appendChild(el('select', {
    'aria-label': `Reparto di ${ing.nome}`,
    onchange: (e) => { ing.reparto = e.target.value; ridisegna(stato); }
  }, [el('option', { value: '' }, 'reparto?'),
      ...(stato.preferenze.ordineReparti || M.REPARTI).map((r) =>
        el('option', { value: r, selected: ing.reparto === r || null }, r))]));

  // le proteine hanno una famiglia: serve alla regola "mai due giorni di fila"
  if (ing.macro === 'proteina') {
    const famiglie = famiglieNote(stato);
    campi.appendChild(el('select', {
      'aria-label': `Famiglia di ${ing.nome}`,
      onchange: (e) => { ing.famiglia = e.target.value; ridisegna(stato); }
    }, [el('option', { value: '' }, 'famiglia?'),
        ...famiglie.map((f) => el('option', { value: f, selected: ing.famiglia === f || null }, f))]));
  }

  riga.appendChild(campi);
  return riga;
}

/** A un ingrediente nuovo manca ancora qualcosa? */
function incompleto(ing) {
  if (!M.MACRO.includes(ing.macro)) return true;
  if (!M.REPARTI.includes(ing.reparto)) return true;
  if (ing.macro === 'proteina' && !ing.famiglia) return true;
  return false;
}

function famiglieNote(stato) {
  const out = new Set();
  for (const i of stato.ingredienti) if (i.famiglia) out.add(i.famiglia);
  return [...out].sort((a, b) => a.localeCompare(b, 'it'));
}

async function accetta(proposta, stato) {
  const esito = IA.preparaSalvataggio(proposta, contestoEsame(stato));
  if (!esito.ok) {
    avviso('Non posso salvarlo: ' + esito.errori[0], 'errore');
    return;
  }
  const salvato = await stato.azioni.importaPiatto(esito.piatto, esito.ingredienti);
  if (!salvato) return;
  // l'azione ha già ridisegnato la schermata: la scheda va via adesso
  bozza.proposte = bozza.proposte.filter((x) => x !== proposta);
  ridisegna(stato);
}

/* ------------------------------------------------------------- aiutini --- */

function titolo(numero, testo) {
  return el('h2', { class: 'titoloPasso' }, [
    el('span', { class: 'numeroPasso num' }, numero),
    el('span', {}, testo)
  ]);
}
