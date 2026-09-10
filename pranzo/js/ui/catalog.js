/* =========================================================================
   ui/catalog.js — Catalogo in sola lettura (M1).
   Sfoglia tutti i piatti con filtri per tipo, macro, tempo e origine.
   I piatti non disponibili restano visibili con il motivo, come chiedono
   le specifiche: sapere *perché* un piatto non compare è metà del valore.
   ========================================================================= */

import { esc, el, svuotaNodo } from './dom.js';
import * as M from '../model.js';
import { mostraDettaglio } from './dish.js';

const filtri = { testo: '', tipo: '', macro: '', tempo: 0, origine: '', soloDisponibili: false };

export function render(contenitore, stato) {
  svuotaNodo(contenitore);
  contenitore.appendChild(barraFiltri(contenitore, stato));
  const elenco = el('div', { class: 'elenco', id: 'elencoPiatti' });
  contenitore.appendChild(elenco);
  disegnaElenco(elenco, stato);
}

function barraFiltri(contenitore, stato) {
  const aggiorna = () => disegnaElenco(document.getElementById('elencoPiatti'), stato);

  const cerca = el('input', {
    type: 'search', placeholder: 'Cerca un piatto', value: filtri.testo,
    'aria-label': 'Cerca un piatto',
    oninput: (e) => { filtri.testo = e.target.value.trim().toLowerCase(); aggiorna(); }
  });

  const selTipo = el('select', {
    'aria-label': 'Tipo di piatto',
    onchange: (e) => { filtri.tipo = e.target.value; aggiorna(); }
  }, [el('option', { value: '' }, 'tutti i tipi'),
      ...M.TIPI_PIATTO.map((t) => el('option', { value: t, selected: filtri.tipo === t || null }, t))]);

  const selMacro = el('select', {
    'aria-label': 'Macro coperto',
    onchange: (e) => { filtri.macro = e.target.value; aggiorna(); }
  }, [el('option', { value: '' }, 'tutti i macro'),
      ...M.MACRO_NUTRIENTI.map((m) => el('option', { value: m }, M.NOME_MACRO[m]))]);

  const selTempo = el('select', {
    'aria-label': 'Tempo massimo',
    onchange: (e) => { filtri.tempo = Number(e.target.value); aggiorna(); }
  }, [el('option', { value: '0' }, 'qualsiasi tempo'),
      el('option', { value: '15' }, 'entro 15 min'),
      el('option', { value: '25' }, 'entro 25 min'),
      el('option', { value: '40' }, 'entro 40 min')]);

  const selOrigine = el('select', {
    'aria-label': 'Origine',
    onchange: (e) => { filtri.origine = e.target.value; aggiorna(); }
  }, [el('option', { value: '' }, 'tutte le origini'),
      el('option', { value: 'base' }, 'catalogo base'),
      el('option', { value: 'ai' }, 'da suggerimento'),
      el('option', { value: 'utente' }, 'inseriti da me')]);

  const soloDisp = el('label', { class: 'inline' }, [
    el('input', {
      type: 'checkbox', checked: filtri.soloDisponibili || null,
      onchange: (e) => { filtri.soloDisponibili = e.target.checked; aggiorna(); }
    }),
    ' solo disponibili'
  ]);

  return el('div', { class: 'filtri' }, [cerca, selTipo, selMacro, selTempo, selOrigine, soloDisp]);
}

function disegnaElenco(elenco, stato) {
  if (!elenco) return;
  svuotaNodo(elenco);
  const { piatti, indiceIngredienti, preferenze } = stato;
  const mese = M.mesecorrente();

  const righe = piatti
    .map((p) => ({ piatto: p, blocco: M.motivoIndisponibilita(p, { indiceIngredienti, preferenze, mese }) }))
    .filter(({ piatto, blocco }) => {
      if (filtri.testo && !piatto.nome.toLowerCase().includes(filtri.testo)) return false;
      if (filtri.tipo && piatto.tipo !== filtri.tipo) return false;
      if (filtri.origine && (piatto.origine || 'base') !== filtri.origine) return false;
      if (filtri.tempo && piatto.tempoMin > filtri.tempo) return false;
      if (filtri.macro && !M.macroCoperti(piatto, indiceIngredienti).includes(filtri.macro)) return false;
      if (filtri.soloDisponibili && blocco) return false;
      return true;
    })
    .sort((a, b) => a.piatto.nome.localeCompare(b.piatto.nome, 'it'));

  const nDisp = righe.filter((r) => !r.blocco).length;
  elenco.appendChild(el('p', { class: 'conteggio' },
    `${righe.length} piatti · ${nDisp} disponibili adesso`));

  if (!righe.length) {
    elenco.appendChild(el('p', { class: 'vuoto' }, 'Nessun piatto con questi filtri.'));
    return;
  }

  for (const { piatto, blocco } of righe) {
    elenco.appendChild(riga(piatto, blocco, stato));
  }
}

function riga(piatto, blocco, stato) {
  const macro = M.macroCoperti(piatto, stato.indiceIngredienti);
  const pastiglie = M.MACRO_NUTRIENTI.map((m) => el('span', {
    class: 'macro' + (macro.includes(m) ? ' si' : ''),
    title: (macro.includes(m) ? 'copre ' : 'non copre ') + M.NOME_MACRO[m]
  }, M.ETICHETTA_MACRO[m]));

  const nodo = el('button', {
    class: 'piatto' + (blocco ? ' bloccato' : ''),
    type: 'button',
    onclick: () => mostraDettaglio(piatto, stato)
  }, [
    el('span', { class: 'nome' }, piatto.nome),
    el('span', { class: 'meta' }, [
      el('span', { class: 'tipo' }, piatto.tipo),
      el('span', {}, M.formattaTempo(piatto.tempoMin)),
      el('span', {}, 'difficoltà ' + piatto.difficolta),
      el('span', { class: 'pastiglie' }, pastiglie)
    ]),
    blocco ? el('span', { class: 'motivo' }, 'non disponibile: ' + blocco.motivo) : null
  ]);
  return nodo;
}
