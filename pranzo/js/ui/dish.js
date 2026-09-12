/* =========================================================================
   ui/dish.js — dettaglio del piatto: ingredienti, procedimento,
   "perché questo piatto", voto e "cucinato oggi".
   ========================================================================= */

import { el, svuotaNodo } from './dom.js';
import * as M from '../model.js';
import * as S from '../shopping.js';
import * as G from '../tastes.js';
import * as F from '../photo.js';

export function mostraDettaglio(piatto, stato, perche) {
  const pannello = document.getElementById('pannello');
  const corpo = document.getElementById('pannelloCorpo');
  svuotaNodo(corpo);

  const macro = M.macroCoperti(piatto, stato.indiceIngredienti);
  const blocco = M.motivoIndisponibilita(piatto, {
    indiceIngredienti: stato.indiceIngredienti,
    preferenze: stato.preferenze,
    mese: M.mesecorrente()
  });
  const riepilogo = G.riepilogoPiatto(piatto.id, stato);

  corpo.appendChild(el('h2', {}, piatto.nome));
  corpo.appendChild(el('p', { class: 'conteggio' }, [
    piatto.tipo, ' · ', M.formattaTempo(piatto.tempoMin), ' · difficoltà ', String(piatto.difficolta),
    macro.length ? ' · copre ' + macro.map((m) => M.NOME_MACRO[m]).join(', ') : ' · non copre nulla'
  ].join('')));

  corpo.appendChild(el('p', { class: 'conteggio' },
    (riepilogo.media != null
      ? `${G.stelle(riepilogo.media)} ${riepilogo.media.toFixed(1).replace('.', ',')} su ${riepilogo.quanti} vot${riepilogo.quanti === 1 ? 'o' : 'i'}`
      : 'mai votato') +
    ' · ' + G.quandoUltimaVolta(riepilogo.ultimaVolta)));

  if (blocco) corpo.appendChild(el('p', { class: 'motivo' }, 'Non disponibile: ' + blocco.motivo));

  if (piatto.stagioni && piatto.stagioni.length) {
    corpo.appendChild(el('p', { class: 'conteggio' }, 'stagione: mesi ' + piatto.stagioni.join(', ')));
  }

  if (stato.azioni && stato.azioni.salvaFoto) corpo.appendChild(bloccoFoto(piatto, stato));

  if (stato.azioni && stato.azioni.aggiungiGusto) corpo.appendChild(sceltaGusti(piatto, stato));

  const daEscludere = chiedeDiEscludere(piatto, stato, riepilogo);
  if (daEscludere) corpo.appendChild(bloccoNonProporre(piatto, stato, daEscludere));

  if (perche && perche.length) {
    corpo.appendChild(el('h3', {}, 'Perché questo piatto'));
    corpo.appendChild(el('ul', { class: 'perche' }, perche.map((c) => el('li', {}, [
      el('span', {}, c.etichetta),
      el('span', { class: 'num' + (c.valore < 0 ? ' meno' : ' piu') },
         (c.valore > 0 ? '+' : '') + c.valore)
    ]))));
  }

  corpo.appendChild(el('h3', {}, 'Ingredienti per 1 porzione'));
  const lista = el('ul', { class: 'ingredienti' });
  for (const voce of piatto.ingredienti) {
    const ing = stato.indiceIngredienti.get(voce.ingredienteId);
    const nome = ing ? ing.nome : voce.ingredienteId;
    let canonica = '';
    if (ing && voce.unita !== ing.unita) {
      try { canonica = ' (' + M.formattaQta(M.inCanonica(ing, voce.qta, voce.unita), ing.unita) + ')'; }
      catch (e) { canonica = ' (unità non convertibile)'; }
    }
    const escluso = (stato.preferenze.escludiIngredienti || []).includes(voce.ingredienteId);
    const amato = (stato.preferenze.amoIngredienti || []).includes(voce.ingredienteId);
    lista.appendChild(el('li', { class: escluso ? 'escluso' : (amato ? 'amato' : null) }, [
      el('span', {}, nome + (escluso ? ' — lo escludi' : (amato ? ' — ti piace' : ''))),
      el('span', { class: 'qta' }, M.formattaQta(voce.qta, voce.unita) + canonica)
    ]));
  }
  corpo.appendChild(lista);

  corpo.appendChild(el('h3', {}, 'Come si fa'));
  const passi = el('ol', { class: 'passi' });
  for (const passo of piatto.passi || []) passi.appendChild(el('li', {}, passo));
  corpo.appendChild(passi);

  if (piatto.tags && piatto.tags.length) {
    corpo.appendChild(el('p', { class: 'conteggio' }, 'tag: ' + piatto.tags.join(', ')));
  }

  if (stato.azioni && stato.azioni.salvaVoto) corpo.appendChild(zonaVoto(piatto, stato, riepilogo));

  // "cucinato": segna la data e propone di scalare la dispensa. Proposta,
  // non automatismo: le specifiche sono chiare su questo punto.
  if (stato.azioni && stato.azioni.cucinato) {
    const zona = el('div', { class: 'zonaCucinato' });
    zona.appendChild(el('button', {
      class: 'azione', type: 'button',
      onclick: () => chiediScarico(zona, piatto, stato)
    }, 'Cucinato oggi'));
    corpo.appendChild(zona);
  }

  pannello.hidden = false;
  pannello.scrollTop = 0;
  document.getElementById('pannelloChiudi').focus();
}

export function chiudiDettaglio() {
  const pannello = document.getElementById('pannello');
  if (!pannello || pannello.hidden) return;
  pannello.hidden = true;
  liberaFoto();
  // si svuota: un pannello chiuso non deve lasciare in giro il piatto di prima
  svuotaNodo(document.getElementById('pannelloCorpo'));
}

/* ------------------------------------------------------------- la foto ---
   Una foto del piatto, scattata o presa dalla libreria. Sta solo qui: le
   liste restano di testo, che si leggono da lontano e non fanno aspettare.
   L'indirizzo dell'immagine è temporaneo e va restituito, o la memoria del
   telefono se lo tiene fino alla chiusura della pagina.                   */

let urlFoto = null;

function liberaFoto() {
  if (urlFoto) { URL.revokeObjectURL(urlFoto); urlFoto = null; }
}

function bloccoFoto(piatto, stato) {
  const blocco = el('figure', { class: 'fotoPiatto' });
  const haFoto = stato.fotoDi && stato.fotoDi.has(piatto.id);

  const campo = el('input', {
    type: 'file', accept: 'image/*', class: 'nascosto', id: 'fotoDelPiatto',
    onchange: (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) stato.azioni.salvaFoto(piatto.id, file);
    }
  });

  // un bottone, non una scritta: la foto è una cosa che si fa, non si legge
  const azioni = el('div', { class: 'azioniFoto' }, [
    el('label', { class: 'bottone', for: 'fotoDelPiatto' },
       haFoto ? 'Cambia foto' : 'Foto'),
    haFoto ? el('button', {
      class: 'bottone', type: 'button',
      onclick: () => stato.azioni.togliFoto(piatto.id)
    }, 'Togli') : null
  ]);

  if (haFoto) {
    // il posto della foto si prende subito, così l'arrivo non fa saltare
    // quello che stai leggendo più in basso
    const posto = el('div', { class: 'postoFoto' });
    blocco.appendChild(posto);
    stato.azioni.leggiFoto(piatto.id).then((record) => {
      if (!record || !record.blob) { posto.remove(); return; }
      if (!document.body.contains(posto)) return;      // pannello già chiuso
      liberaFoto();
      urlFoto = URL.createObjectURL(record.blob);
      posto.appendChild(el('img', {
        src: urlFoto, alt: 'Foto di ' + piatto.nome,
        width: record.larghezza || null, height: record.altezza || null
      }));
      posto.classList.add('arrivata');
    }).catch(() => posto.remove());
  }

  blocco.appendChild(campo);
  blocco.appendChild(azioni);
  return blocco;
}

/* ---------------------------------------------------- amo / escludo ------ */

function sceltaGusti(piatto, stato) {
  const amato = (stato.preferenze.amoPiatti || []).includes(piatto.id);
  const escluso = (stato.preferenze.escludiPiatti || []).includes(piatto.id);

  return el('div', { class: 'sceltaGusti' }, [
    el('button', {
      class: 'testuale' + (amato ? ' acceso' : ''), type: 'button',
      onclick: () => amato
        ? stato.azioni.togliGusto('amoPiatti', piatto.id)
        : stato.azioni.aggiungiGusto('amoPiatti', piatto.id)
    }, amato ? 'lo ami ✓' : 'lo amo'),
    el('button', {
      class: 'testuale' + (escluso ? ' spentoAcceso' : ''), type: 'button',
      onclick: () => escluso
        ? stato.azioni.togliGusto('escludiPiatti', piatto.id)
        : stato.azioni.aggiungiGusto('escludiPiatti', piatto.id)
    }, escluso ? 'lo escludi ✓' : 'escludilo')
  ]);
}

/* --------------------------------------------------- non proporlo più ----
   Un voto basso abbassa il punteggio, ma non toglie il piatto dal giro: per
   quello serve la lista degli esclusi. Invece di lasciarlo dedurre, dopo un
   voto basso lo si chiede qui, con parole chiare.                          */

/* Chi ha detto "no, lascia" non se lo sente richiedere a ogni apertura. */
const nonChiedere = new Set();

function chiedeDiEscludere(piatto, stato, riepilogo) {
  if (!stato.azioni || !stato.azioni.aggiungiGusto) return null;
  if (nonChiedere.has(piatto.id)) return null;
  if ((stato.preferenze.escludiPiatti || []).includes(piatto.id)) return null;
  const ultimo = riepilogo.ultimo;
  if (!ultimo || ultimo.stelle > 2) return null;
  // "troppo lungo" parla del tempo, non del gusto: non c'entra con l'escluderlo
  if (ultimo.motivo === 'troppoLungo') return null;
  return ultimo;
}

function bloccoNonProporre(piatto, stato, voto) {
  return el('div', { class: 'proposta' }, [
    el('p', { class: 'testoProposta' },
      `L'hai votato ${voto.stelle} su 5: te lo propongo ancora?`),
    el('p', { class: 'spiega' },
      'Con un voto basso torna più raramente, ma torna. Se non lo vuoi più ' +
      'vedere finisce tra i piatti che escludi, e da lì lo puoi sempre ritirare.'),
    el('div', { class: 'azioniProposta' }, [
      el('button', {
        class: 'testuale acceso', type: 'button',
        onclick: () => stato.azioni.aggiungiGusto('escludiPiatti', piatto.id)
      }, 'non propormelo più'),
      el('button', {
        class: 'testuale', type: 'button',
        onclick: () => { nonChiedere.add(piatto.id); mostraDettaglio(piatto, stato, null); }
      }, 'va bene, riproponilo')
    ])
  ]);
}

/* ------------------------------------------------------------- il voto --- */

/**
 * Voto del piatto: stelle, motivo e nota. Il motivo conta davvero — "troppo
 * lungo" abbassa il piatto ma non insegna niente sugli ingredienti.
 */
function zonaVoto(piatto, stato, riepilogo) {
  const zona = el('div', { class: 'zonaVoto' });
  zona.appendChild(el('h3', {}, 'Com\'è andato?'));

  const bozza = { stelle: 0, motivo: 'buono', note: '' };

  zona.appendChild(el('p', { class: 'spiega' },
    'Tocca le stelle: una sola se non ti è piaciuto.'));

  const fila = el('div', { class: 'stelle', role: 'group', 'aria-label': 'Voto da 1 a 5 stelle' });
  const bottoni = [];
  for (let n = 1; n <= 5; n++) {
    const b = el('button', {
      class: 'stella', type: 'button', 'aria-label': `${n} stelle`, 'aria-pressed': 'false',
      onclick: () => {
        bozza.stelle = n;
        bottoni.forEach((x, i) => {
          x.classList.toggle('piena', i < n);
          x.setAttribute('aria-pressed', i < n ? 'true' : 'false');
        });
        salva.disabled = false;
        salva.textContent = `Salva il voto: ${n} stell${n === 1 ? 'a' : 'e'}`;
      }
    }, '★');
    bottoni.push(b);
    fila.appendChild(b);
  }
  zona.appendChild(fila);

  const selMotivo = el('select', {
    'aria-label': 'Perché questo voto',
    onchange: (e) => { bozza.motivo = e.target.value; }
  }, M.MOTIVI_VOTO.map((m) => el('option', { value: m }, G.ETICHETTA_MOTIVO[m] || m)));

  const nota = el('input', {
    type: 'text', placeholder: 'una nota, se vuoi', 'aria-label': 'Nota sul piatto',
    oninput: (e) => { bozza.note = e.target.value; }
  });

  zona.appendChild(el('div', { class: 'campiVoto' }, [selMotivo, nota]));

  // "Cucinato oggi" resta l'unica azione piena della schermata: il voto è
  // importante ma viene dopo, quindi ha il bottone contornato
  const salva = el('button', {
    class: 'azione secondaria', type: 'button', disabled: 'disabled',
    onclick: () => stato.azioni.salvaVoto(piatto.id, bozza)
  }, 'Tocca le stelle per votare');
  zona.appendChild(salva);

  if (riepilogo.voti.length) {
    const elenco = el('div', { class: 'elencoGusti' });
    for (const v of riepilogo.voti) {
      elenco.appendChild(el('div', { class: 'rigaVoto' }, [
        el('span', { class: 'stelleVoto num' }, G.stelle(v.stelle)),
        el('span', { class: 'conteggio datoVoto' },
          [G.dataBreve(v.data), G.ETICHETTA_MOTIVO[v.motivo] || v.motivo, v.note]
            .filter(Boolean).join(' · ')),
        el('button', {
          class: 'testuale', type: 'button',
          onclick: () => stato.azioni.eliminaVoto(v.id)
        }, 'toglie')
      ]));
    }
    zona.appendChild(elenco);
  }

  return zona;
}

/* --------------------------------------------------- cucinato e scarico -- */

/**
 * Mostra la proposta di scarico dalla dispensa. Nulla viene toccato finché
 * non si conferma, e si può sempre solo segnare il piatto come cucinato.
 */
function chiediScarico(zona, piatto, stato) {
  const righe = S.propostaScarico(piatto, {
    indiceIngredienti: stato.indiceIngredienti,
    dispensa: stato.dispensaMappa,
    porzioni: stato.preferenze.porzioni || 1
  });
  svuotaNodo(zona);

  if (!righe.length) {
    zona.appendChild(el('p', { class: 'conteggio' },
      'Nessuno di questi ingredienti è in dispensa: segno solo il piatto come cucinato.'));
    zona.appendChild(el('button', {
      class: 'azione', type: 'button',
      onclick: () => stato.azioni.cucinato(piatto.id, [])
    }, 'Segna come cucinato'));
    return;
  }

  zona.appendChild(el('h3', {}, 'Scalo dalla dispensa?'));
  const elenco = el('div', { class: 'scarico' });
  for (const riga of righe) {
    const spunta = el('input', {
      type: 'checkbox', checked: 'checked',
      'aria-label': 'scala ' + riga.nome,
      onchange: (e) => { riga.scarica = e.target.checked; }
    });
    elenco.appendChild(el('label', { class: 'rigaScarico' }, [
      spunta,
      el('span', { class: 'nomeScarico' }, riga.nome),
      el('span', { class: 'num' },
        `${M.formattaQta(riga.usata, riga.unita)} · restano ${M.formattaQta(riga.restante, riga.unita)}`)
    ]));
  }
  zona.appendChild(elenco);
  zona.appendChild(el('button', {
    class: 'azione', type: 'button',
    onclick: () => stato.azioni.cucinato(piatto.id, righe.filter((r) => r.scarica))
  }, 'Confermo, scala la dispensa'));
  zona.appendChild(el('button', {
    class: 'testuale', type: 'button',
    onclick: () => stato.azioni.cucinato(piatto.id, [])
  }, 'segna cucinato senza scalare'));
}
