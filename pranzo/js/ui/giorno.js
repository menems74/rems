/* =========================================================================
   ui/giorno.js — il foglio di un giorno: pranzo e cena, ognuno con il suo
   tempo, "cambia" e "scegli tu". Tutto quello che si fa su un giorno sta
   qui, a un tocco dalla prima pagina.
   ========================================================================= */

import { el } from './dom.js';
import { icona } from './icone.js';
import { apriFoglio, fotoPiatto, occhiello, datiPiatto, nomeDi } from './comuni.js';
import { mostraPiatto } from './piatto.js';
import { mostraScelta } from './scegli.js';
import * as M from '../model.js';
import { tempoDelPasto } from '../planner.js';

export function mostraGiorno(chiave, stato) {
  const giorno = (stato.menu && stato.menu.giorni || []).find((g) => g.giorno === chiave);
  if (!giorno) return;
  const data = giorno.data ? ` ${Number(giorno.data.slice(8, 10))}` : '';
  apriFoglio(cap(M.NOME_GIORNO[chiave]) + data, (corpo) => {
    const kcal = M.kcalGiorno(giorno, stato.indicePiatti, stato.indiceIngredienti);
    if (kcal) corpo.appendChild(el('p', { class: 'sottotitolo' }, `${kcal} kcal a persona, solo i piatti`));
    for (const nome of M.PASTI) {
      if (!(stato.preferenze.pasti || M.PASTI).includes(nome) && !(giorno.pasti || {})[nome]) continue;
      corpo.appendChild(sezionePasto(giorno, nome, stato));
    }
  });
}

function sezionePasto(giorno, nome, stato) {
  const pasto = (giorno.pasti || {})[nome];
  const sezione = el('section', { class: 'sezionePasto' });
  sezione.appendChild(el('h3', {}, [
    M.NOME_PASTO[nome],
    pasto && pasto.scelto ? el('span', { class: 'bollino viola' }, 'scelto da te') : null
  ]));

  if (!pasto) {
    sezione.appendChild(el('button', { class: 'secondario', type: 'button',
      onclick: () => stato.azioni.rigeneraPasto(giorno.giorno, nome) }, [icona('scintilla'), 'Proponi un piatto']));
    return sezione;
  }

  const piatto = stato.indicePiatti.get(pasto.piatto);
  sezione.appendChild(el('button', { class: 'schedaPiatto', type: 'button',
    onclick: () => piatto && mostraPiatto(piatto, stato) }, [
    fotoPiatto(piatto, stato, 'media'),
    el('div', { class: 'testoPasto' }, [
      occhiello(datiPiatto(piatto, stato).concat(piatto ? [M.NOME_TIPO[piatto.tipo]] : [])),
      el('div', { class: 'nomePiatto' }, nomeDi(stato, pasto.piatto))
    ])
  ]));

  if (pasto.contorno) {
    const contorno = stato.indicePiatti.get(pasto.contorno);
    sezione.appendChild(el('div', { class: 'rigaContorno' }, [
      el('button', { class: 'linkContorno', type: 'button',
        onclick: () => contorno && mostraPiatto(contorno, stato) }, [
        fotoPiatto(contorno, stato, 'micro'),
        el('span', {}, ['con ', el('b', {}, nomeDi(stato, pasto.contorno))])
      ]),
      el('button', { class: 'piccolo', type: 'button',
        onclick: () => stato.azioni.cambiaContorno(giorno.giorno, nome) }, [icona('scambia'), 'Altro contorno'])
    ]));
  }

  sezione.appendChild(el('div', { class: 'azioniPasto' }, [
    el('button', { class: 'secondario', type: 'button',
      onclick: () => stato.azioni.rigeneraPasto(giorno.giorno, nome) }, [icona('scambia'), 'Cambia']),
    el('button', { class: 'secondario', type: 'button',
      onclick: () => mostraScelta(giorno.giorno, nome, stato) }, [icona('mano'), 'Scegli tu'])
  ]));

  // il tempo: tocchi quanto ne hai e il piatto si adegua
  const attuale = tempoDelPasto(nome, stato.preferenze, pasto.tempoMax);
  sezione.appendChild(el('div', { class: 'tempi' }, [
    el('span', { class: 'etichettaTempi' }, [icona('orologio'), 'Tempo']),
    ...M.TEMPI.map((min) => el('button', {
      type: 'button',
      class: 'chip' + (attuale === min ? ' acceso' : ''),
      'aria-pressed': attuale === min ? 'true' : 'false',
      onclick: () => stato.azioni.impostaTempo(giorno.giorno, nome, min)
    }, min < 60 ? `${min}'` : M.formattaTempo(min)))
  ]));
  return sezione;
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
