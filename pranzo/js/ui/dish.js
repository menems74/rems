/* ui/dish.js — dettaglio del piatto (M1: sola lettura).
   Voti, "perché questo piatto" e "cucinato" arrivano nelle milestone dopo. */

import { el, svuotaNodo } from './dom.js';
import * as M from '../model.js';

export function mostraDettaglio(piatto, stato) {
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

  pannello.hidden = false;
  document.getElementById('pannelloChiudi').focus();
}

export function chiudiDettaglio() {
  document.getElementById('pannello').hidden = true;
}
