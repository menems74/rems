/* ui/dish.js — dettaglio del piatto (M1: sola lettura).
   Voti, "perché questo piatto" e "cucinato" arrivano nelle milestone dopo. */

import { el, svuotaNodo } from './dom.js';
import * as M from '../model.js';
import * as S from '../shopping.js';

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

  corpo.appendChild(el('h2', {}, piatto.nome));
  corpo.appendChild(el('p', { class: 'conteggio' }, [
    piatto.tipo, ' · ', M.formattaTempo(piatto.tempoMin), ' · difficoltà ', String(piatto.difficolta),
    macro.length ? ' · copre ' + macro.map((m) => M.NOME_MACRO[m]).join(', ') : ' · non copre nulla'
  ].join('')));

  if (blocco) corpo.appendChild(el('p', { class: 'motivo' }, 'Non disponibile: ' + blocco.motivo));

  if (piatto.stagioni && piatto.stagioni.length) {
    corpo.appendChild(el('p', { class: 'conteggio' }, 'stagione: mesi ' + piatto.stagioni.join(', ')));
  }

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
    lista.appendChild(el('li', {}, [
      el('span', {}, nome),
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
  document.getElementById('pannelloChiudi').focus();
}

export function chiudiDettaglio() {
  document.getElementById('pannello').hidden = true;
}


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
