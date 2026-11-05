/* =========================================================================
   ui/impostazioni.js — le poche cose da decidere una volta sola.
   Ogni cambiamento si salva subito: niente bottone "salva" da ricordare.
   ========================================================================= */

import { el, svuotaNodo, avviso } from './dom.js';
import { icona } from './icone.js';
import { segmenti, ghirigoro } from './comuni.js';
import { VERSIONE_APP } from './home.js';
import * as M from '../model.js';
import * as B from '../backup.js';
import * as DB from '../db.js';

/* ---- installazione: l'invito del browser arriva una volta e va tenuto --- */
let invitoInstalla = null;
let installata = false;
window.addEventListener('beforeinstallprompt', (evento) => { evento.preventDefault(); invitoInstalla = evento; });
window.addEventListener('appinstalled', () => { invitoInstalla = null; installata = true; });

function comeApp() {
  return installata ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true;
}

function suApple() {
  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/* Il backup letto da file resta qui finché non si conferma o si annulla. */
const vista = { anteprima: null };

export function render(contenitore, stato) {
  svuotaNodo(contenitore);
  contenitore.appendChild(el('header', { class: 'testata scura' }, [
    ghirigoro(),
    el('div', { class: 'barraTesta' }, [
      el('a', { class: 'tondo chiaro', href: '#/', 'aria-label': 'Torna alla settimana' }, [icona('indietro')]),
      el('span', { class: 'marchio' }, ['Impostazioni', el('i', {}, '.')])
    ]),
    el('h1', {}, ['Le cose da', el('br'), 'decidere una volta'])
  ]));

  const corpo = el('div', { class: 'corpo sovrapposto' });
  contenitore.appendChild(corpo);
  const pref = stato.preferenze;
  const cambia = (campo, valore) => stato.azioni.salvaPreferenze(Object.assign({}, pref, { [campo]: valore }));

  // il nome, per il saluto in prima pagina
  const nome = el('input', { type: 'text', value: pref.nome || '', placeholder: 'Il tuo nome',
    'aria-label': 'Il tuo nome', autocomplete: 'given-name', maxlength: '30',
    onchange: (e) => cambia('nome', e.target.value.trim()) });
  corpo.appendChild(blocco('Come ti chiami', 'Serve solo al saluto in prima pagina.', [nome]));

  // i giorni del menù
  const giorni = pref.giorni || M.GIORNI;
  corpo.appendChild(blocco('Giorni del menù', 'I giorni spenti restano liberi: niente piatti e niente spesa.', [
    el('div', { class: 'chipGiorni' }, M.GIORNI.map((g) => {
      const acceso = giorni.includes(g);
      return el('button', {
        type: 'button', class: 'chip' + (acceso ? ' acceso' : ''), 'aria-pressed': acceso ? 'true' : 'false',
        onclick: () => {
          const nuovi = acceso ? giorni.filter((x) => x !== g) : M.GIORNI.filter((x) => giorni.includes(x) || x === g);
          if (!nuovi.length) { avviso('Almeno un giorno serve.', 'errore'); return; }
          cambia('giorni', nuovi);
        }
      }, M.GIORNO_BREVE[g]);
    }))
  ]));

  // il tempo di sempre
  corpo.appendChild(blocco('Tempo di solito', 'Il tempo di ogni giorno lo cambi toccando il giorno.', [
    el('p', { class: 'etichettaDomanda' }, 'Pranzo'),
    sceltaTempo(pref.tempoMaxMin, (v) => cambia('tempoMaxMin', v), false),
    el('p', { class: 'etichettaDomanda' }, 'Cena'),
    sceltaTempo(pref.tempoMaxCena, (v) => cambia('tempoMaxCena', v), true)
  ]));

  // l'aspetto
  corpo.appendChild(blocco('Aspetto', null, [
    segmenti([{ valore: 'chiaro', testo: 'Chiaro' }, { valore: 'scuro', testo: 'Scuro' }, { valore: 'auto', testo: 'Come il telefono' }],
      pref.tema || 'auto', (v) => cambia('tema', v), 'Aspetto')
  ]));

  // gli ingredienti esclusi (dalla 2.x): si rispettano, qui si tolgono
  if ((pref.escludiIngredienti || []).length) {
    corpo.appendChild(blocco('Ingredienti esclusi', 'I piatti che li contengono non vengono proposti.', [
      el('ul', { class: 'voci' }, pref.escludiIngredienti.map((id) => el('li', { class: 'voce' }, [
        el('span', { class: 'nomeVoce' }, (stato.indiceIngredienti.get(id) || {}).nome || id),
        el('button', { class: 'pillola', type: 'button',
          onclick: () => cambia('escludiIngredienti', pref.escludiIngredienti.filter((x) => x !== id)) }, 'Rimetti')
      ])))
    ]));
  }

  corpo.appendChild(bloccoBackup(stato));
  if (!comeApp()) corpo.appendChild(bloccoInstalla(stato));

  corpo.appendChild(el('p', { class: 'piede' }, [
    `Pranzo ${VERSIONE_APP} · dati nel telefono (${DB.motoreInUso() === 'indexeddb' ? 'IndexedDB' : 'localStorage'})`,
    el('br'), el('span', { class: 'firma' }, 'powered by Rems')
  ]));
}

function blocco(titolo, nota, figli) {
  return el('section', { class: 'blocco' }, [
    el('h2', {}, titolo),
    nota ? el('p', { class: 'nota' }, nota) : null,
    ...figli
  ]);
}

function sceltaTempo(attuale, cambia, senzaLimite) {
  const voci = M.TEMPI.map((m) => ({ valore: m, testo: m < 60 ? `${m}'` : M.formattaTempo(m) }));
  if (senzaLimite) voci.push({ valore: 0, testo: 'libero' });
  return el('div', { class: 'chipGiorni' }, voci.map((v) => el('button', {
    type: 'button', class: 'chip' + (attuale === v.valore ? ' acceso' : ''),
    'aria-pressed': attuale === v.valore ? 'true' : 'false',
    onclick: () => cambia(v.valore)
  }, v.testo)));
}

/* ------------------------------------------------------------- backup ---- */

function bloccoBackup(stato) {
  const scegli = el('input', { type: 'file', accept: 'application/json,.json', class: 'nascosto',
    onchange: (e) => { const f = e.target.files && e.target.files[0]; if (f) leggi(f, stato); } });

  const figli = [
    el('div', { class: 'azioniPiatto' }, [
      el('button', { class: 'secondario', type: 'button', onclick: () => salva() }, [icona('copia'), 'Salva backup']),
      el('button', { class: 'secondario', type: 'button', onclick: () => scegli.click() }, [icona('rigenera'), 'Carica backup'])
    ]),
    scegli
  ];

  const a = vista.anteprima;
  if (a) {
    figli.push(el('div', { class: 'anteprima' }, [
      el('p', {}, [el('b', {}, a.nome), a.esportato ? ` del ${B.quando(a.esportato)}` : '']),
      el('p', { class: 'nota' }, `${a.conteggi.piatti || 0} piatti, ${a.conteggi.menu || 0} menù. ` +
        'Caricandolo, quello che c\'è ora nel telefono viene sostituito. Le foto restano.'),
      el('div', { class: 'azioniPiatto' }, [
        el('button', { class: 'grande', type: 'button', onclick: () => conferma(stato) }, 'Carica e sostituisci'),
        el('button', { class: 'secondario', type: 'button', onclick: () => { vista.anteprima = null; stato.azioni.ridisegna(); } }, 'Annulla')
      ])
    ]));
  }
  return blocco('Backup', 'Un file con piatti, gusti e menù, da tenere al sicuro o portare su un altro telefono. Le foto restano solo qui.', figli);
}

async function salva() {
  try {
    const backup = await B.esporta();
    const testo = JSON.stringify(backup);
    const nome = B.nomeFile();
    await B.salvaFuori(testo, nome);
    avviso(`Backup pronto: ${nome} (${B.peso(testo)}).`);
  } catch (errore) {
    if (errore && errore.name === 'AbortError') return;      // hai annullato tu
    avviso('Non riesco a fare il backup: ' + errore.message, 'errore');
  }
}

async function leggi(file, stato) {
  try {
    const oggetto = await B.leggiFile(file);
    const controllo = B.verifica(oggetto);
    if (!controllo.ok) { avviso('Questo backup non va: ' + controllo.errori[0], 'errore'); return; }
    vista.anteprima = { nome: file.name, esportato: oggetto.esportato, conteggi: controllo.conteggi, dati: controllo.dati };
    stato.azioni.ridisegna();
  } catch (errore) {
    avviso(errore.message, 'errore');
  }
}

async function conferma(stato) {
  const a = vista.anteprima;
  if (!a) return;
  try {
    await B.importa(a.dati);
  } catch (errore) {
    avviso('Non riesco a caricare il backup: ' + errore.message, 'errore');
    return;
  }
  vista.anteprima = null;
  await stato.azioni.ricarica();
  avviso(`Backup caricato: ${a.conteggi.piatti || 0} piatti.`);
}

/* -------------------------------------------------------- installazione - */

function bloccoInstalla(stato) {
  if (invitoInstalla) {
    return blocco('Installa sul telefono', 'Diventa un\'icona tra le app e funziona anche senza rete.', [
      el('button', { class: 'grande', type: 'button', onclick: async () => {
        invitoInstalla.prompt();
        const esito = await invitoInstalla.userChoice;
        invitoInstalla = null;
        avviso(esito && esito.outcome === 'accepted' ? 'Installata: la trovi tra le app.' : 'Va bene, resta nel browser.');
        stato.azioni.ridisegna();
      } }, 'Installa l\'app')
    ]);
  }
  const passi = suApple()
    ? ['In Safari tocca Condividi (il quadrato con la freccia).', 'Scegli "Aggiungi alla schermata Home".', 'Conferma con Aggiungi.']
    : ['Apri il menu del browser (i tre puntini).', 'Scegli "Installa app" o "Aggiungi a schermata Home".'];
  return blocco('Installa sul telefono', 'Diventa un\'icona tra le app e funziona anche senza rete.', [
    el('ol', { class: 'passi' }, passi.map((p) => el('li', {}, p)))
  ]);
}
