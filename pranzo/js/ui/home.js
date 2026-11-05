/* =========================================================================
   ui/home.js — la prima pagina: oggi, la settimana, e niente altro.
   Aprendo l'app si deve capire tutto subito: cosa si mangia oggi in cima,
   i giorni sotto, la spesa a un tocco nella barra in basso.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import { icona } from './icone.js';
import { fotoPiatto, segmenti, occhiello, datiPiatto, nomeDi, ghirigoro } from './comuni.js';
import { mostraGiorno } from './giorno.js';
import { mostraRegole } from './regole.js';
import * as M from '../model.js';

/* Il numero mostrato in fondo alla pagina. Si cambia a mano, quando serve:
   non c'entra con la VERSIONE di sw.js, che è solo il nome della cache. */
export const VERSIONE_APP = 'V.3.0';

/* I giorni già passati di questa settimana si nascondono: si rivedono con
   la fascia "mostra". La scelta dura finché l'app resta aperta. */
const vista = { passati: false };

/** Firma in fondo alle pagine: la versione e Cleopatra, in oro. */
export function firma(prima = '') {
  return el('span', { class: 'firma' }, [`${prima}${VERSIONE_APP}`, el('br'), 'Powered by ', el('span', { class: 'oro' }, 'Cleopatra')]);
}

export function render(contenitore, stato) {
  svuotaNodo(contenitore);
  contenitore.appendChild(testata(stato));

  const corpo = el('div', { class: 'corpo sovrapposto' });
  const oggi = giornoDiOggi(stato);
  if (oggi) corpo.appendChild(schedaOggi(oggi, stato));

  corpo.appendChild(segmenti(
    [{ valore: 0, testo: 'Questa settimana' }, { valore: 1, testo: 'Prossima' }],
    stato.scarto === 1 ? 1 : 0,
    (v) => stato.azioni.cambiaSettimana(v),
    'Quale settimana'
  ));

  if (!stato.menu || !stato.menu.giorni.some((g) => M.pastiDi(g).length)) {
    corpo.appendChild(vuota(stato));
  } else {
    const elenco = el('div', { class: 'elencoGiorni' });
    const passati = stato.menu.giorni.filter((g) => passato(g.giorno, stato) && M.pastiDi(g).length);
    if (passati.length) {
      elenco.appendChild(el('button', { class: 'fasciaPassati', type: 'button', 'aria-expanded': vista.passati ? 'true' : 'false',
        onclick: () => { vista.passati = !vista.passati; render(contenitore, stato); } },
        [vista.passati ? 'Nascondi i giorni passati' : `Mostra tutto (${passati.length} ${passati.length === 1 ? 'giorno passato' : 'giorni passati'})`,
         icona(vista.passati ? 'su' : 'giu')]));
    }
    for (const g of stato.menu.giorni) {
      if (!M.pastiDi(g).length) continue;
      if (!vista.passati && passato(g.giorno, stato)) continue;
      elenco.appendChild(rigaGiorno(g, stato, oggi && oggi.giorno === g.giorno, passato(g.giorno, stato)));
    }
    corpo.appendChild(elenco);
    const vuoti = giorniVuoti(stato);
    if (vuoti.length) {
      corpo.appendChild(el('button', { class: 'secondario completa', type: 'button',
        onclick: () => stato.azioni.generaSettimana({ soloVuoti: true }) },
        [icona('scintilla'), `Completa ${vuoti.map((g) => M.GIORNO_BREVE[g]).join(', ')}`]));
    }
    for (const nota of stato.menu.note || []) corpo.appendChild(el('p', { class: 'nota' }, nota));
  }

  corpo.appendChild(el('p', { class: 'piede' }, [
    'Le calorie sono stime per persona, solo dei piatti: non sono un consiglio nutrizionale.',
    el('br'),
    firma('Pranzo 2.0 · ')
  ]));
  contenitore.appendChild(corpo);
}

/* ------------------------------------------------------------ testata ---- */

function testata(stato) {
  const pref = stato.preferenze;
  const nome = (pref.nome || '').trim();
  const oggi = giornoDiOggi(stato);

  const regole = el('button', { class: 'regole', type: 'button', onclick: () => mostraRegole(stato) }, [
    el('span', {}, [icona('persone'), `${pref.porzioni || 1}`]),
    el('span', {}, M.NOME_PESO[pref.peso] || 'Tutti'),
    el('span', {}, (pref.pasti || []).includes('pranzo') ? 'Pranzo e cena' : 'Solo cena'),
    icona('regola')
  ]);
  regole.setAttribute('aria-label', 'Come mangiate: persone, piatti, pasti. Tocca per cambiare');

  return el('header', { class: 'testata gialla' }, [
    ghirigoro(),
    el('div', { class: 'barraTesta' }, [el('span', { class: 'marchio' }, ['Pranzo 2.0'])]),
    el('h1', {}, [
      nome ? `Ciao ${nome},` : 'Ciao,', el('br'),
      el('span', { class: 'sottoSaluto' },
        oggi ? 'oggi si mangia così' : (stato.scarto === 1 ? 'ecco la prossima settimana' : 'ecco la tua settimana'))
    ]),
    stagione(stato),
    // le regole della settimana e, accanto, le impostazioni
    el('div', { class: 'rigaRegole' }, [
      regole,
      el('a', { class: 'tondo regoleImpostazioni', href: '#/impostazioni', 'aria-label': 'Impostazioni' }, [icona('ingranaggio')])
    ])
  ]);
}

function stagione(stato) {
  const verdure = M.verdureDiStagione(stato.ingredienti, M.mesecorrente());
  if (!verdure.length) return null;
  return el('div', { class: 'stagione', 'aria-label': 'Di stagione questo mese' },
    verdure.map((v) => el('span', { class: 'etichetta' }, v.nome)));
}

/* ------------------------------------------------------------ oggi ------- */

function giornoDiOggi(stato) {
  if (stato.scarto !== 0 || !stato.menu) return null;
  const g = stato.menu.giorni.find((x) => x.giorno === stato.oggiChiave);
  return g && M.pastiDi(g).length ? g : null;
}

function schedaOggi(giorno, stato) {
  const scheda = el('section', { class: 'oggi', 'aria-label': 'Oggi' });
  const kcal = M.kcalGiorno(giorno, stato.indicePiatti, stato.indiceIngredienti);
  scheda.appendChild(el('div', { class: 'oggiTesta' }, [
    el('span', { class: 'quandoOggi' }, [
      el('span', { class: 'bollinoOggi' }, 'Oggi'),
      el('span', { class: 'giornoOggi' }, cap(M.NOME_GIORNO[giorno.giorno]) +
        (giorno.data ? ' ' + Number(giorno.data.slice(8, 10)) : ''))
    ]),
    kcal ? el('span', { class: 'kcalOggi' }, `${kcal} kcal`) : null
  ]));
  for (const [nome, pasto] of M.pastiDi(giorno)) {
    scheda.appendChild(rigaPastoOggi(giorno, nome, pasto, stato));
  }
  return scheda;
}

function rigaPastoOggi(giorno, nome, pasto, stato) {
  const piatto = stato.indicePiatti.get(pasto.piatto);
  const contorno = pasto.contorno ? stato.indicePiatti.get(pasto.contorno) : null;
  const apri = el('button', {
    class: 'pastoOggi', type: 'button',
    onclick: () => mostraGiorno(giorno.giorno, stato)
  }, [
    fotoPiatto(piatto, stato, 'media'),
    el('div', { class: 'testoPasto' }, [
      occhiello([M.NOME_PASTO[nome], ...datiPiatto(piatto, stato)]),
      el('div', { class: 'nomePiatto' }, nomeDi(stato, pasto.piatto)),
      contorno ? el('div', { class: 'conContorno' }, `con ${contorno.nome.toLowerCase()}`) : null
    ])
  ]);
  return el('div', { class: 'rigaOggi' }, [apri, el('span', { class: 'freccia' }, [icona('avanti')])]);
}

/* ---------------------------------------------------------- la settimana - */

/** Un giorno di questa settimana che è già passato. */
function passato(chiave, stato) {
  return stato.scarto === 0 && M.GIORNI.indexOf(chiave) < M.GIORNI.indexOf(stato.oggiChiave);
}

function rigaGiorno(giorno, stato, eOggi, giaPassato) {
  const pasti = M.pastiDi(giorno);
  const kcal = M.kcalGiorno(giorno, stato.indicePiatti, stato.indiceIngredienti);
  const data = giorno.data ? Number(giorno.data.slice(8, 10)) : '';

  // a sinistra il foglio di calendario, a destra pranzo (sole) e cena (luna)
  const apri = el('button', { class: 'apriGiorno', type: 'button',
    'aria-label': `${cap(M.NOME_GIORNO[giorno.giorno])} ${data}${eOggi ? ', oggi' : ''}`,
    onclick: () => mostraGiorno(giorno.giorno, stato) }, [
    el('div', { class: 'calendario' + (eOggi ? ' diOggi' : '') }, [
      el('span', { class: 'sigla' }, M.GIORNO_BREVE[giorno.giorno].toUpperCase()),
      el('span', { class: 'numero' }, String(data))
    ]),
    el('div', { class: 'testoGiorno' }, [
      ...pasti.map(([nome, p]) => el('div', { class: 'pastoRiga' }, [
        icona(nome === 'pranzo' ? 'sole' : 'luna', M.NOME_PASTO[nome]),
        el('span', {}, nomeDi(stato, p.piatto))
      ])),
      kcal ? el('div', { class: 'kcalGiorno' }, `${kcal} kcal`) : null
    ])
  ]);
  return el('div', { class: 'rigaGiorno' + (eOggi ? ' eOggi' : '') + (giaPassato ? ' passato' : '') }, [
    apri, el('span', { class: 'freccia' }, [icona('avanti')])
  ]);
}

/** I giorni del menù (o delle impostazioni) a cui manca un pasto. */
function giorniVuoti(stato) {
  const pref = stato.preferenze;
  const pasti = pref.pasti || M.PASTI;
  return (pref.giorni || M.GIORNI).filter((chiave) => {
    if (passato(chiave, stato)) return false;           // il passato non si completa
    const g = stato.menu.giorni.find((x) => x.giorno === chiave);
    return !g || pasti.some((p) => !(g.pasti || {})[p]);
  });
}

function vuota(stato) {
  return el('section', { class: 'vuota' }, [
    el('div', { class: 'foto cat-pasta media' }, [icona('settimana')]),
    el('h2', {}, stato.scarto === 1 ? 'La prossima settimana è ancora da fare' : 'La settimana è ancora da fare'),
    el('p', {}, 'Un tocco e l\'app sceglie pranzi e cene. Poi cambi quello che non ti va.'),
    el('button', { class: 'grande', type: 'button', onclick: () => stato.azioni.generaSettimana() },
      [icona('scintilla'), 'Prepara la settimana'])
  ]);
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
