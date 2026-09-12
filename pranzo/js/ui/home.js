/* =========================================================================
   ui/home.js — la prima pagina.

   Non è un menu di bottoni: è la prima pagina del quaderno. In alto la data
   e i pasti di oggi (pranzo e cena), sotto le sezioni, ognuna col dato vero
   ("12 da prendere", "1 suggerimento"). Così aprendo l'app si sa già
   qualcosa, invece di dover scegliere dove andare a guardare.
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import * as M from '../model.js';
import * as P from '../planner.js';
import * as S from '../shopping.js';
import { mostraDettaglio } from './dish.js';

const GIORNO_LUNGO = {
  lun: 'lunedì', mar: 'martedì', mer: 'mercoledì', gio: 'giovedì',
  ven: 'venerdì', sab: 'sabato', dom: 'domenica'
};
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
              'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/* La versione dell'app, in fondo alla prima pagina. Si cambia qui a mano,
   quando lo dice Rems: non si alza da sola e non c'entra niente con la
   VERSIONE di sw.js, che è solo il numero di serie della cache. */
const VERSIONE_APP = 'V.1.02';

export function render(contenitore, stato) {
  svuotaNodo(contenitore);
  contenitore.appendChild(copertina(stato));
  contenitore.appendChild(scorciatoie(stato));
  contenitore.appendChild(el('div', { class: 'firma' }, [
    el('p', {}, 'powered by Rems'),
    el('p', { class: 'versione num' }, VERSIONE_APP)
  ]));
}

/* ---------------------------------------------------------- la copertina -
   Data grande nel margine, e accanto il pranzo di oggi: è la cosa che si
   viene a sapere aprendo l'app.                                          */

function copertina(stato) {
  const oggi = new Date();
  const iso = P.iso(oggi);
  const sigla = M.GIORNI[(oggi.getDay() + 6) % 7];

  const margine = el('div', { class: 'margine' }, [
    el('span', { class: 'gg' }, sigla),
    el('span', { class: 'dd' }, String(oggi.getDate()))
  ]);

  const corpo = el('div', { class: 'corpoCopertina' });
  corpo.appendChild(el('p', { class: 'meseOggi' },
    `${GIORNO_LUNGO[sigla]} ${oggi.getDate()} ${MESI[oggi.getMonth()]}`));

  const giorno = (stato.menu && (stato.menu.giorni || []).find((g) => g.data === iso)) || null;
  const pasti = giorno ? M.pastiDi(giorno) : [];
  const conPiatti = pasti.filter(([, pasto]) => (pasto.piatti || []).length);

  if (conPiatti.length) {
    for (const [nome, pasto] of conPiatti) {
      corpo.appendChild(bloccoPastoOggi(nome, pasto, stato));
    }
    corpo.appendChild(rigaGiornata(giorno, stato));
  } else {
    corpo.appendChild(el('p', { class: 'nienteOggi' },
      stato.menu ? 'Oggi non è in programma.' : 'Ancora nessun menù.'));
    const dopo = prossimoGiorno(stato, iso);
    if (dopo) {
      corpo.appendChild(el('button', {
        class: 'piattoOggi prossimo', type: 'button',
        onclick: () => { location.hash = '#/settimana'; }
      }, `${GIORNO_LUNGO[dopo.giorno]}: ${dopo.nomi.join(', ')}`));
    }
  }

  // l'azione sta dentro la colonna del testo, così la riga del margine
  // scende senza interruzioni fino all'indice
  if (!stato.menu || !(stato.menu.giorni || []).length) {
    corpo.appendChild(el('button', {
      class: 'azione', type: 'button',
      onclick: () => stato.azioni.generaSettimana()
    }, 'Genera la settimana'));
  }

  return el('section', { class: 'copertina' }, [margine, corpo]);
}

/** Un pasto di oggi: l'etichetta piccola e sotto i nomi, grandi. */
function bloccoPastoOggi(nome, pasto, stato) {
  const piatti = (pasto.piatti || [])
    .map((id) => stato.indicePiatti.get(id)).filter(Boolean);
  const blocco = el('div', { class: 'pastoOggi' });

  blocco.appendChild(el('p', { class: 'etichettaOggi' }, [
    el('span', {}, M.NOME_PASTO[nome]),
    pasto.avanziDa ? el('span', { class: 'segnoAvanzi' }, 'avanzi del pranzo') : null
  ]));

  // un piatto solo si legge da lontano; due o tre stanno più stretti
  const stretto = piatti.length > 1 ? ' stretto' : '';
  for (const piatto of piatti) {
    blocco.appendChild(el('button', {
      class: 'piattoOggi' + stretto, type: 'button',
      onclick: () => mostraDettaglio(piatto, stato, ((stato.menu || {}).perche || {})[piatto.id])
    }, piatto.nome));
  }
  return blocco;
}

/**
 * La riga sotto i pasti: quanto tempo ai fornelli oggi e cosa coprono i due
 * pasti messi insieme. Dalla 2.0 le macro sono un'informazione, non un
 * obbligo: se ne manca una si vede, e basta.
 */
function rigaGiornata(giorno, stato) {
  let minuti = 0;
  for (const [, pasto] of M.pastiDi(giorno)) {
    if (pasto.avanziDa) continue;
    for (const id of pasto.piatti || []) {
      const p = stato.indicePiatti.get(id);
      if (p) minuti += p.tempoMin;
    }
  }
  const { coperti } = M.macroDellaGiornata(giorno, stato.indicePiatti, stato.indiceIngredienti);

  return el('div', { class: 'datiOggi' }, [
    el('span', { class: 'num' }, M.formattaTempo(minuti)),
    el('div', { class: 'pastiglie' }, M.MACRO_NUTRIENTI.map((m) => el('span', {
      class: 'macro ' + (coperti.includes(m) ? 'si' : 'no'),
      title: (coperti.includes(m) ? 'copre ' : 'manca ') + M.NOME_MACRO[m]
    }, M.ETICHETTA_MACRO[m])))
  ]);
}

/** Il primo giorno pianificato dopo oggi: serve quando oggi è vuoto. */
function prossimoGiorno(stato, iso) {
  if (!stato.menu) return null;
  for (const g of stato.menu.giorni || []) {
    if (!g.data || g.data <= iso) continue;
    const nomi = M.piattiDelGiorno(g)
      .map((id) => (stato.indicePiatti.get(id) || {}).nome).filter(Boolean);
    if (nomi.length) return { giorno: g.giorno, nomi };
  }
  return null;
}

/* --------------------------------------------------------- le sezioni ---
   Una riga per sezione, con il dato che conta a destra. Il dato è blu
   quando c'è qualcosa da fare, grigio quando è solo informazione.        */

function scorciatoie(stato) {
  const elenco = el('nav', { class: 'scorciatoie', 'aria-label': 'Sezioni' });
  for (const voce of voci(stato)) {
    elenco.appendChild(el('a', { class: 'scorciatoia', href: voce.href }, [
      el('span', { class: 'nomeScorciatoia' }, voce.nome),
      el('span', { class: 'datoScorciatoia' + (voce.dafare ? ' dafare' : '') }, voce.dato)
    ]));
  }
  return elenco;
}

function voci(stato) {
  const menu = stato.menu;
  const giorniMenu = (menu && menu.giorni) || [];

  // settimana
  let quantiPasti = 0;
  for (const g of giorniMenu) quantiPasti += M.pastiDi(g).length;
  const settimana = giorniMenu.length
    ? `${giorniMenu.length} giorni · ${quantiPasti} pasti`
    : 'da generare';

  // spesa
  let spesa = 'lista da fare', spesaDaFare = true;
  if (!giorniMenu.length) {
    spesa = 'serve il menù'; spesaDaFare = false;
  } else if (stato.lista) {
    const { fatti, totale } = S.conteggio(stato.lista);
    const restano = totale - fatti;
    spesa = restano ? `${restano} da prendere` : `${totale} voci, tutte prese`;
    spesaDaFare = restano > 0;
  }

  // catalogo
  const mese = M.mesecorrente();
  const disponibili = stato.piatti.filter((p) => !M.motivoIndisponibilita(p, {
    indiceIngredienti: stato.indiceIngredienti, preferenze: stato.preferenze, mese
  })).length;

  // gusti
  const pendenti = (stato.suggerimenti || []).filter((s) => s.stato === 'pendente').length;
  const quantiVoti = Object.values(stato.voti || {}).reduce((n, v) => n + v.length, 0);
  const gusti = pendenti
    ? `${pendenti} ${pendenti > 1 ? 'suggerimenti' : 'suggerimento'}`
    : (quantiVoti ? `${quantiVoti} vot${quantiVoti === 1 ? 'o' : 'i'}` : 'niente ancora');

  return [
    { nome: 'Settimana', href: '#/settimana', dato: settimana, dafare: !giorniMenu.length },
    { nome: 'Lista della spesa', href: '#/spesa', dato: spesa, dafare: spesaDaFare },
    { nome: 'Catalogo', href: '#/catalogo', dato: `${disponibili} disponibili` },
    { nome: 'Gusti', href: '#/gusti', dato: gusti, dafare: pendenti > 0 },
    { nome: 'Dispensa', href: '#/dispensa',
      dato: stato.dispensaRighe.length ? `${stato.dispensaRighe.length} voci` : 'vuota' },
    { nome: 'Nuovi piatti', href: '#/nuovi', dato: 'chiedi a un\'AI' },
    { nome: 'Impostazioni', href: '#/impostazioni', dato: 'porzioni, backup' }
  ];
}
