/* =========================================================================
   ui/home.js — la prima pagina: oggi, la settimana, e niente altro.
   Aprendo l'app si deve capire tutto subito: cosa si mangia oggi in cima,
   i giorni sotto, la spesa a un tocco nella barra in basso.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import { icona } from './icone.js';
import { fotoPiatto, bottoneIcona, segmenti, occhiello, datiPiatto, nomeDi, ghirigoro } from './comuni.js';
import { mostraGiorno } from './giorno.js';
import { mostraPiatto } from './piatto.js';
import { mostraRegole } from './regole.js';
import * as M from '../model.js';

/* Il numero mostrato in fondo alla pagina. Si cambia a mano, quando serve:
   non c'entra con la VERSIONE di sw.js, che è solo il nome della cache. */
export const VERSIONE_APP = 'V.3.0';

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
    for (const g of stato.menu.giorni) {
      if (!M.pastiDi(g).length) continue;
      elenco.appendChild(rigaGiorno(g, stato, oggi && oggi.giorno === g.giorno));
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
    el('span', { class: 'firma' }, `Pranzo ${VERSIONE_APP} · powered by Rems`)
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
    el('div', { class: 'barraTesta' }, [
      el('span', { class: 'marchio' }, ['Pranzo', el('i', {}, '.')]),
      el('a', { class: 'tondo chiaro', href: '#/impostazioni', 'aria-label': 'Impostazioni' }, [icona('ingranaggio')])
    ]),
    el('h1', {}, [
      nome ? `Ciao ${nome},` : 'Ciao,', el('br'),
      oggi ? 'oggi si mangia così' : (stato.scarto === 1 ? 'ecco la prossima settimana' : 'ecco la tua settimana')
    ]),
    stagione(stato),
    regole
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
    el('span', {}, `Oggi · ${M.NOME_GIORNO[giorno.giorno]}`),
    kcal ? el('span', {}, `${kcal} kcal`) : null
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
    onclick: () => piatto && mostraPiatto(piatto, stato)
  }, [
    fotoPiatto(piatto, stato, 'media'),
    el('div', { class: 'testoPasto' }, [
      occhiello([M.NOME_PASTO[nome], ...datiPiatto(piatto, stato)]),
      el('div', { class: 'nomePiatto' }, nomeDi(stato, pasto.piatto)),
      contorno ? el('div', { class: 'conContorno' }, `con ${contorno.nome.toLowerCase()}`) : null
    ])
  ]);
  return el('div', { class: 'rigaOggi' }, [
    apri,
    bottoneIcona('scambia', `Cambia ${M.NOME_PASTO[nome].toLowerCase()}`,
      () => stato.azioni.rigeneraPasto(giorno.giorno, nome), 'viola')
  ]);
}

/* ---------------------------------------------------------- la settimana - */

function rigaGiorno(giorno, stato, eOggi) {
  const pasti = M.pastiDi(giorno);
  const primo = pasti.length ? stato.indicePiatti.get(pasti[0][1].piatto) : null;
  const kcal = M.kcalGiorno(giorno, stato.indicePiatti, stato.indiceIngredienti);
  const data = giorno.data ? Number(giorno.data.slice(8, 10)) : '';

  const apri = el('button', { class: 'apriGiorno', type: 'button', onclick: () => mostraGiorno(giorno.giorno, stato) }, [
    fotoPiatto(primo, stato, 'mini'),
    el('div', { class: 'testoGiorno' }, [
      el('div', { class: 'nomeGiorno' }, [
        el('b', {}, cap(M.NOME_GIORNO[giorno.giorno])),
        el('span', {}, ` ${data}`),
        eOggi ? el('span', { class: 'bollino' }, 'oggi') : null
      ]),
      el('div', { class: 'piattiGiorno' }, pasti.map(([, p]) => nomeDi(stato, p.piatto)).join(' · ')),
      kcal ? el('div', { class: 'kcalGiorno' }, `${kcal} kcal`) : null
    ])
  ]);
  return el('div', { class: 'rigaGiorno' + (eOggi ? ' eOggi' : '') }, [
    apri,
    bottoneIcona('scambia', `Cambia i piatti di ${M.NOME_GIORNO[giorno.giorno]}`,
      () => stato.azioni.rigeneraGiorno(giorno.giorno), 'viola')
  ]);
}

/** I giorni del menù (o delle impostazioni) a cui manca un pasto. */
function giorniVuoti(stato) {
  const pref = stato.preferenze;
  const pasti = pref.pasti || M.PASTI;
  return (pref.giorni || M.GIORNI).filter((chiave) => {
    const g = stato.menu.giorni.find((x) => x.giorno === chiave);
    return !g || pasti.some((p) => !(g.pasti || {})[p]);
  });
}

function vuota(stato) {
  return el('section', { class: 'vuota' }, [
    el('div', { class: 'foto sf2 media' }, [icona('settimana')]),
    el('h2', {}, stato.scarto === 1 ? 'La prossima settimana è ancora da fare' : 'La settimana è ancora da fare'),
    el('p', {}, 'Un tocco e l\'app sceglie pranzi e cene. Poi cambi quello che non ti va.'),
    el('button', { class: 'grande', type: 'button', onclick: () => stato.azioni.generaSettimana() },
      [icona('scintilla'), 'Prepara la settimana'])
  ]);
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
