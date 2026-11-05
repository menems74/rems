/* =========================================================================
   ui/spesa.js — la lista della spesa della settimana guardata.
   Si fa da sola dal menù: niente bottone "genera". Per ogni voce due gesti,
   "nel carrello" e "ce l'ho già"; quello che hai già scende in fondo.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import { icona } from './icone.js';
import { ghirigoro } from './comuni.js';
import * as M from '../model.js';
import * as S from '../shopping.js';

export function render(contenitore, stato) {
  svuotaNodo(contenitore);
  const lista = stato.lista;
  const conto = lista ? S.conteggio(lista) : { fatti: 0, totale: 0 };
  const percento = conto.totale ? Math.round(100 * conto.fatti / conto.totale) : 0;

  contenitore.appendChild(el('header', { class: 'testata viola' }, [
    ghirigoro(),
    el('div', { class: 'barraTesta' }, [
      el('span', { class: 'marchio' }, ['Spesa', el('i', {}, '.')]),
      lista ? el('div', { class: 'azioniSpesa' }, [
        el('button', { class: 'pillola whatsapp', type: 'button', onclick: () => stato.azioni.inviaLista() },
          [icona('whatsapp'), 'WhatsApp']),
        el('button', { class: 'pillola chiara', type: 'button', 'aria-label': 'Copia la lista',
          onclick: () => stato.azioni.copiaLista() }, [icona('copia')])
      ]) : null
    ]),
    el('h1', {}, ['La spesa', el('br'), stato.scarto === 1 ? 'della prossima settimana' : 'della settimana']),
    lista ? el('div', { class: 'avanzamento', role: 'progressbar', 'aria-valuemin': '0',
      'aria-valuemax': String(conto.totale), 'aria-valuenow': String(conto.fatti),
      'aria-label': 'Voci nel carrello' }, [el('div', { style: `width:${percento}%` })]) : null,
    lista ? el('p', { class: 'contoSpesa' }, conto.totale
      ? `${conto.fatti} di ${conto.totale} nel carrello`
      : 'Hai già tutto in casa') : null
  ]));

  const corpo = el('div', { class: 'corpo' });
  contenitore.appendChild(corpo);

  if (!lista) {
    corpo.appendChild(el('section', { class: 'vuota' }, [
      el('div', { class: 'foto cat-legumi media' }, [icona('spesa')]),
      el('h2', {}, 'Niente da comprare, per ora'),
      el('p', {}, 'La lista si fa da sola quando c\'è il menù della settimana.'),
      el('a', { class: 'grande', href: '#/' }, [icona('settimana'), 'Vai alla settimana'])
    ]));
    return;
  }

  const ordine = stato.preferenze.ordineReparti || M.REPARTI;
  const inCasa = [];
  for (const [reparto, voci] of S.perReparto(lista, ordine)) {
    const daPrendere = voci.filter((v) => !v.giaInCasa);
    inCasa.push(...voci.filter((v) => v.giaInCasa));
    if (!daPrendere.length) continue;
    corpo.appendChild(el('h2', { class: 'reparto' }, M.NOME_REPARTO[reparto] || reparto));
    corpo.appendChild(el('ul', { class: 'voci' }, daPrendere.map((v) => voce(v, stato))));
  }

  corpo.appendChild(aggiungi(stato));

  if (inCasa.length) {
    corpo.appendChild(el('details', { class: 'giaInCasa' }, [
      el('summary', {}, `Già in casa (${inCasa.length})`),
      el('ul', { class: 'voci' }, inCasa.map((v) => el('li', { class: 'voce spenta' }, [
        el('span', { class: 'nomeVoce' }, v.nome),
        el('button', { class: 'pillola', type: 'button', onclick: () => stato.azioni.segnaInCasa(v.ingredienteId) },
          'Rimetti')
      ])))
    ]));
  }
}

function voce(v, stato) {
  const chiave = v.libera ? v.id : v.ingredienteId;
  const dettaglio = v.libera ? null : M.formattaQta(v.qtaRichiesta, v.unita);
  return el('li', { class: 'voce' + (v.comprato ? ' presa' : '') }, [
    el('button', {
      class: 'spunta', type: 'button', role: 'checkbox',
      'aria-checked': v.comprato ? 'true' : 'false',
      'aria-label': `${v.nome}: nel carrello`,
      onclick: () => stato.azioni.segnaComprato(chiave)
    }, [icona('spunta')]),
    el('div', { class: 'testoVoce' }, [
      el('span', { class: 'nomeVoce' }, v.nome),
      dettaglio ? el('span', { class: 'qtaVoce', title: v.notaArrotondamento || '' }, dettaglio) : null
    ]),
    v.libera
      ? el('button', { class: 'tondo piccolo', type: 'button', 'aria-label': `Togli ${v.nome}`,
          onclick: () => stato.azioni.togliLibera(v.id) }, [icona('chiudi')])
      : (v.comprato ? null : el('button', { class: 'pillola viola', type: 'button',
          onclick: () => stato.azioni.segnaInCasa(v.ingredienteId) }, 'Ce l\'ho'))
  ]);
}

function aggiungi(stato) {
  const campo = el('input', { type: 'text', placeholder: 'Aggiungi a mano: detersivo, caffè…',
    'aria-label': 'Aggiungi una voce alla lista', enterkeyhint: 'done' });
  const invia = (e) => {
    e.preventDefault();
    const testo = campo.value.trim();
    if (testo) stato.azioni.aggiungiLibera(testo);
  };
  return el('form', { class: 'aggiungi', onsubmit: invia }, [
    campo,
    el('button', { class: 'tondo viola', type: 'submit', 'aria-label': 'Aggiungi' }, [icona('piu')])
  ]);
}
