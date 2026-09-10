/* =========================================================================
   ui/settings.js — Impostazioni, installazione e backup.
   Ogni cambiamento si salva subito: niente bottone "salva" da ricordare.
   ========================================================================= */

import { el, svuotaNodo, avviso } from './dom.js';
import * as M from '../model.js';
import * as B from '../backup.js';
import * as DB from '../db.js';

/* ---- installazione: l'invito del browser arriva una volta e va tenuto --- */
let invitoInstalla = null;
let installata = false;

window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault();
  invitoInstalla = evento;
});
window.addEventListener('appinstalled', () => { invitoInstalla = null; installata = true; });

/** L'app è già aperta come app? Allora non si propone di installarla. */
export function comeApp() {
  return installata ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true;
}

export function siPuoInstallare() { return !comeApp(); }

export async function installa() {
  if (!invitoInstalla) return false;
  invitoInstalla.prompt();
  const esito = await invitoInstalla.userChoice;
  invitoInstalla = null;
  return esito && esito.outcome === 'accepted';
}

/* ------------------------------------------------------------ schermata -- */

const vista = { istantanee: null, anteprima: null };

export function render(contenitore, stato) {
  svuotaNodo(contenitore);
  if (siPuoInstallare()) contenitore.appendChild(bloccoInstalla(stato));
  contenitore.appendChild(bloccoPranzi(stato));
  contenitore.appendChild(bloccoMenu(stato));
  contenitore.appendChild(bloccoReparti(stato));
  contenitore.appendChild(bloccoAspetto(stato));
  contenitore.appendChild(bloccoBackup(stato));
  contenitore.appendChild(bloccoArchivio(stato));
  if (vista.istantanee === null) caricaIstantanee(stato);
}

function ridisegna(stato) {
  if (document.getElementById('titolo').textContent === 'Impostazioni') {
    render(document.getElementById('vista'), stato);
  }
}

async function caricaIstantanee(stato) {
  vista.istantanee = await B.istantanee();
  ridisegna(stato);
}

/* Un solo avviso anche dopo dieci ritocchi di fila. */
let attesa = null;
function salvato(stato) {
  clearTimeout(attesa);
  attesa = setTimeout(() => avviso('Impostazioni salvate.'), 500);
}

async function cambia(stato, campo, valore) {
  const nuove = Object.assign({}, stato.preferenze, { [campo]: valore });
  await stato.azioni.salvaPreferenze(nuove);
  salvato(stato);
}

/* ------------------------------------------------------------ i blocchi -- */

function gruppo(titolo, nota) {
  const sezione = el('section', { class: 'gruppoGusti' });
  sezione.appendChild(el('h2', { class: 'titoloGusti' }, [el('span', {}, titolo)]));
  if (nota) sezione.appendChild(el('p', { class: 'spiega' }, nota));
  return sezione;
}

function bloccoInstalla(stato) {
  const sezione = gruppo('Installa sul telefono',
    'Diventa un\'icona nella schermata Home e si apre senza barra del browser. ' +
    'Funziona anche in aereo.');

  if (invitoInstalla) {
    sezione.appendChild(el('button', {
      class: 'azione', type: 'button',
      onclick: async () => {
        const ok = await installa();
        avviso(ok ? 'Installata: la trovi tra le app.' : 'Va bene, resta nel browser.');
        ridisegna(stato);
      }
    }, 'Installa l\'app'));
  } else {
    sezione.appendChild(el('ol', { class: 'passiInstalla' }, [
      el('li', {}, 'tocca il pulsante Condividi del browser'),
      el('li', {}, 'scorri e scegli "Aggiungi alla schermata Home"'),
      el('li', {}, 'confermi, e l\'icona compare tra le app')
    ]));
  }
  return sezione;
}

function bloccoPranzi(stato) {
  const pref = stato.preferenze;
  const sezione = gruppo('I pranzi');

  sezione.appendChild(rigaNumero('Porzioni', pref.porzioni || 1, 1, 8, 1,
    (v) => cambia(stato, 'porzioni', v),
    'le ricette sono per una porzione: qui si moltiplica tutto, anche la spesa'));

  // i giorni: almeno uno, o non c'è niente da pianificare
  const scelti = new Set(pref.giorni || []);
  const giorni = el('div', { class: 'giorniScelta' }, M.GIORNI.map((g) =>
    el('button', {
      class: 'giornoTasto' + (scelti.has(g) ? ' scelto' : ''), type: 'button',
      'aria-pressed': scelti.has(g) ? 'true' : 'false',
      onclick: () => {
        const nuovi = M.GIORNI.filter((x) => (x === g ? !scelti.has(x) : scelti.has(x)));
        if (!nuovi.length) { avviso('Serve almeno un giorno.', 'errore'); return; }
        cambia(stato, 'giorni', nuovi);
      }
    }, g)));
  sezione.appendChild(el('div', { class: 'campoImpostazione' }, [
    el('p', { class: 'etichettaImpostazione' }, 'Giorni da pianificare'),
    giorni,
    el('p', { class: 'spiega' }, `${scelti.size} giorni a settimana`)
  ]));

  sezione.appendChild(rigaNumero('Tempo massimo', pref.tempoMaxMin || 40, 10, 120, 5,
    (v) => cambia(stato, 'tempoMaxMin', v),
    'minuti, per un pranzo intero', 'min'));

  // tempo per giorno: si apre solo se serve
  const perGiorno = pref.tempoMaxPerGiorno || {};
  const righe = el('div', {});
  for (const g of pref.giorni || []) {
    righe.appendChild(el('div', { class: 'rigaGiornoTempo' }, [
      el('span', { class: 'nomeGusto' }, g),
      el('span', { class: 'campoQta' }, [
        el('input', {
          type: 'number', min: '0', max: '120', step: '5', inputmode: 'numeric',
          value: perGiorno[g] ? String(perGiorno[g]) : '',
          placeholder: String(pref.tempoMaxMin || 40),
          'aria-label': 'Tempo massimo di ' + g,
          onchange: (e) => {
            const nuovo = Object.assign({}, perGiorno);
            const v = Number(e.target.value);
            if (v > 0) nuovo[g] = v; else delete nuovo[g];
            cambia(stato, 'tempoMaxPerGiorno', nuovo);
          }
        }),
        el('span', { class: 'unita num' }, 'min')
      ])
    ]));
  }
  sezione.appendChild(el('details', { class: 'vediPrompt' }, [
    el('summary', {}, 'tempo diverso per qualche giorno'),
    el('p', { class: 'spiega' }, 'vuoto = vale il tempo massimo generale'),
    righe
  ]));

  return sezione;
}

function bloccoMenu(stato) {
  const pref = stato.preferenze;
  const sezione = gruppo('Come compongo il menù');

  sezione.appendChild(rigaNumero('Piatti nuovi a settimana', pref.quotaNovita || 0, 0, 5, 1,
    (v) => cambia(stato, 'quotaNovita', v),
    'quanti piatti mai cucinati provare, se ce ne sono'));

  sezione.appendChild(rigaNumero('Non ripetere per', pref.cooldownSettimane || 0, 0, 12, 1,
    (v) => cambia(stato, 'cooldownSettimane', v),
    'un piatto fatto torna solo dopo queste settimane', 'sett.'));

  sezione.appendChild(rigaNumero('Giorni con primo + secondo', pref.maxGiorniPrimoSecondo || 0, 0, 7, 1,
    (v) => cambia(stato, 'maxGiorniPrimoSecondo', v),
    'al massimo; gli altri giorni sono a piatto unico'));

  return sezione;
}

function bloccoReparti(stato) {
  const ordine = (stato.preferenze.ordineReparti || M.REPARTI).slice();
  const sezione = gruppo('Ordine del supermercato',
    'La lista della spesa segue quest\'ordine: mettilo come giri tu tra le corsie.');

  const elenco = el('div', { class: 'elencoGusti' });
  ordine.forEach((reparto, i) => {
    elenco.appendChild(el('div', { class: 'rigaGusto' }, [
      el('span', { class: 'numeroReparto num' }, String(i + 1)),
      el('span', { class: 'nomeGusto' }, reparto),
      el('button', {
        class: 'testuale', type: 'button', disabled: i === 0 ? 'disabled' : null,
        'aria-label': `sposta ${reparto} più in alto`,
        onclick: () => sposta(stato, ordine, i, -1)
      }, 'su'),
      el('button', {
        class: 'testuale', type: 'button', disabled: i === ordine.length - 1 ? 'disabled' : null,
        'aria-label': `sposta ${reparto} più in basso`,
        onclick: () => sposta(stato, ordine, i, 1)
      }, 'giù')
    ]));
  });
  sezione.appendChild(elenco);
  return sezione;
}

async function sposta(stato, ordine, da, verso) {
  const a = da + verso;
  if (a < 0 || a >= ordine.length) return;
  const nuovo = ordine.slice();
  [nuovo[da], nuovo[a]] = [nuovo[a], nuovo[da]];
  await cambia(stato, 'ordineReparti', nuovo);
}

function bloccoAspetto(stato) {
  const tema = stato.preferenze.tema || 'chiaro';
  const sezione = gruppo('Aspetto');
  const scelte = [['chiaro', 'chiaro'], ['scuro', 'scuro'], ['auto', 'come il telefono']];
  sezione.appendChild(el('div', { class: 'quantiPiatti' }, scelte.map(([valore, testo]) =>
    el('button', {
      class: 'testuale' + (tema === valore ? ' acceso' : ''), type: 'button',
      onclick: () => cambia(stato, 'tema', valore)
    }, testo))));
  return sezione;
}

/* -------------------------------------------------------------- backup --- */

function bloccoBackup(stato) {
  const sezione = gruppo('Backup',
    'Un file .json con tutto: piatti, gusti, voti, menù, dispensa. ' +
    'Serve per passare a un altro telefono e per non perdere anni di voti.');

  sezione.appendChild(el('button', {
    class: 'azione', type: 'button',
    onclick: () => esporta(stato)
  }, 'Salva un backup'));

  // il file si sceglie con l'input di sistema: nessuna finta interfaccia
  const scelta = el('input', {
    type: 'file', accept: 'application/json,.json', class: 'nascosto',
    id: 'fileBackup',
    onchange: (e) => { if (e.target.files[0]) apriBackup(e.target.files[0], stato); }
  });
  sezione.appendChild(scelta);
  sezione.appendChild(el('div', { class: 'sottoAzioni' }, [
    el('label', { class: 'testuale comeBottone', for: 'fileBackup' }, 'carica un backup')
  ]));

  if (vista.anteprima) sezione.appendChild(anteprimaImport(stato));

  // le istantanee
  const righe = vista.istantanee || [];
  sezione.appendChild(el('p', { class: 'etichettaImpostazione' }, 'Istantanee automatiche'));
  sezione.appendChild(el('p', { class: 'spiega' },
    `Una al giorno, le ultime ${B.QUANTE_ISTANTANEE}, dentro il telefono. ` +
    'Servono se cancelli qualcosa per sbaglio; se perdi il telefono servono i file.'));

  if (!righe.length) {
    sezione.appendChild(el('p', { class: 'conteggio' }, 'nessuna istantanea, per ora'));
  } else {
    const elenco = el('div', { class: 'elencoGusti' });
    for (const s of righe) {
      elenco.appendChild(el('div', { class: 'rigaGusto' }, [
        el('span', { class: 'nomeGusto' }, [
          el('span', {}, B.quando(s.data)),
          el('span', { class: 'conteggio dentroRiga' },
            `${(s.conteggi || {}).piatti || 0} piatti · ${(s.conteggi || {}).voti || 0} voti` +
            (s.motivo && s.motivo !== 'automatica' ? ` · ${s.motivo}` : ''))
        ]),
        el('button', {
          class: 'testuale', type: 'button',
          onclick: () => ripristina(s, stato)
        }, 'ripristina')
      ]));
    }
    sezione.appendChild(elenco);
  }
  sezione.appendChild(el('div', { class: 'sottoAzioni' }, [
    el('button', {
      class: 'testuale', type: 'button',
      onclick: async () => {
        await B.istantanea('a mano');
        vista.istantanee = await B.istantanee();
        avviso('Istantanea scattata.');
        ridisegna(stato);
      }
    }, 'scatta un\'istantanea adesso')
  ]));

  return sezione;
}

async function esporta(stato) {
  try {
    const backup = await B.esporta();
    const testo = JSON.stringify(backup);
    const nome = B.nomeFile();
    const esito = await B.salvaFuori(testo, nome);
    avviso({
      condiviso: `Backup condiviso (${B.peso(testo)}).`,
      salvato: `Backup salvato in ${nome} (${B.peso(testo)}).`,
      scaricato: `Backup scaricato: ${nome} (${B.peso(testo)}).`
    }[esito] || 'Backup pronto.');
  } catch (errore) {
    if (errore && errore.name === 'AbortError') return;      // annullato: nessun rumore
    avviso('Non riesco a salvare il backup: ' + errore.message, 'errore');
  }
}

async function apriBackup(file, stato) {
  try {
    const oggetto = await B.leggiFile(file);
    const controllo = B.verifica(oggetto);
    vista.anteprima = Object.assign({ nome: file.name, esportato: oggetto.esportato }, controllo);
  } catch (errore) {
    vista.anteprima = { nome: file.name, ok: false, errori: [errore.message], avvisi: [], conteggi: {} };
  }
  ridisegna(stato);
}

/** Prima di sostituire tutto si mostra cosa c'è dentro e si chiede conferma. */
function anteprimaImport(stato) {
  const a = vista.anteprima;
  const blocco = el('div', { class: 'proposta' + (a.ok ? '' : ' storta') });
  blocco.appendChild(el('p', { class: 'testoProposta' }, a.nome));
  if (a.esportato) blocco.appendChild(el('p', { class: 'conteggio' }, 'del ' + B.quando(a.esportato)));

  for (const errore of a.errori) blocco.appendChild(el('p', { class: 'motivo piccolo' }, errore));
  for (const nota of a.avvisi) blocco.appendChild(el('p', { class: 'conteggio' }, nota));

  if (a.ok) {
    const c = a.conteggi;
    blocco.appendChild(el('p', { class: 'conteggio' },
      `${c.piatti} piatti · ${c.ingredienti} ingredienti · ${c.voti} voti · ` +
      `${c.menu} menù · ${c.dispensa} voci in dispensa`));
    blocco.appendChild(el('p', { class: 'spiega' },
      'Caricandolo, quello che c\'è adesso viene sostituito. ' +
      'Prima faccio un\'istantanea, così si può tornare indietro.'));
  }

  const azioni = el('div', { class: 'azioniProposta' });
  if (a.ok) {
    azioni.appendChild(el('button', {
      class: 'testuale acceso', type: 'button',
      onclick: () => confermaImport(stato)
    }, 'sostituisci tutto'));
  } else {
    azioni.appendChild(el('span', { class: 'spentoTesto' }, 'non si può caricare'));
  }
  azioni.appendChild(el('button', {
    class: 'testuale', type: 'button',
    onclick: () => { vista.anteprima = null; ridisegna(stato); }
  }, 'annulla'));
  blocco.appendChild(azioni);

  return blocco;
}

async function confermaImport(stato) {
  const a = vista.anteprima;
  if (!a || !a.ok) return;
  try {
    await B.istantanea('prima di caricare ' + a.nome);
    await B.importa(a.dati);
  } catch (errore) {
    avviso('Import non riuscito, non ho toccato niente: ' + errore.message, 'errore');
    return;
  }
  vista.anteprima = null;
  vista.istantanee = await B.istantanee();
  await stato.azioni.ricarica();
  avviso(`Caricato: ${a.conteggi.piatti} piatti, ${a.conteggi.voti} voti.`);
}

async function ripristina(istantanea, stato) {
  try {
    const conteggi = await B.ripristina(istantanea.id);
    vista.istantanee = await B.istantanee();
    await stato.azioni.ricarica();
    avviso(`Tornata al ${B.quando(istantanea.data)}: ${conteggi.piatti} piatti, ${conteggi.voti} voti.`);
  } catch (errore) {
    avviso('Ripristino non riuscito: ' + errore.message, 'errore');
  }
}

/* ------------------------------------------------------------ archivio --- */

function bloccoArchivio(stato) {
  const sezione = gruppo('Archivio');
  sezione.appendChild(el('p', { class: 'conteggio' },
    `${DB.motoreInUso() === 'indexeddb' ? 'IndexedDB' : 'localStorage'} · ` +
    `${stato.piatti.length} piatti · ${stato.ingredienti.length} ingredienti · ` +
    `${Object.values(stato.voti).reduce((n, v) => n + v.length, 0)} voti`));

  if ('serviceWorker' in navigator) {
    sezione.appendChild(el('div', { class: 'sottoAzioni' }, [
      el('button', {
        class: 'testuale', type: 'button',
        onclick: () => svuotaCache()
      }, 'ricarica l\'app dalla rete')
    ]));
    sezione.appendChild(el('p', { class: 'spiega' },
      'Serve solo se qualcosa sembra rotto dopo un aggiornamento: ' +
      'i tuoi dati non si toccano.'));
  }
  return sezione;
}

function svuotaCache() {
  const reg = navigator.serviceWorker.controller;
  if (!reg) { location.reload(); return; }
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.tipo === 'cacheSvuotata') location.reload();
  }, { once: true });
  reg.postMessage({ tipo: 'svuotaCache' });
  setTimeout(() => location.reload(), 1500);
}

/* -------------------------------------------------------------- aiutini -- */

function rigaNumero(etichetta, valore, min, max, passo, alCambio, spiegazione, unita) {
  const campo = el('input', {
    type: 'number', min: String(min), max: String(max), step: String(passo),
    value: String(valore), inputmode: 'numeric', 'aria-label': etichetta,
    onchange: (e) => {
      let v = Number(e.target.value);
      if (!isFinite(v)) v = min;
      v = Math.max(min, Math.min(max, Math.round(v / passo) * passo));
      e.target.value = String(v);
      alCambio(v);
    }
  });

  const meno = el('button', {
    class: 'passoNumero', type: 'button', 'aria-label': 'diminuisci ' + etichetta,
    onclick: () => { campo.stepDown(); campo.dispatchEvent(new Event('change')); }
  }, '−');
  const piu = el('button', {
    class: 'passoNumero', type: 'button', 'aria-label': 'aumenta ' + etichetta,
    onclick: () => { campo.stepUp(); campo.dispatchEvent(new Event('change')); }
  }, '+');

  return el('div', { class: 'campoImpostazione' }, [
    el('p', { class: 'etichettaImpostazione' }, etichetta),
    el('div', { class: 'controlloNumero' }, [
      meno, campo, unita ? el('span', { class: 'unita num' }, unita) : null, piu
    ]),
    spiegazione ? el('p', { class: 'spiega' }, spiegazione) : null
  ]);
}
