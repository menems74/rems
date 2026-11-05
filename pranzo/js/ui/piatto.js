/* =========================================================================
   ui/piatto.js — la scheda di un piatto: foto, cuore, "non lo voglio più",
   ingredienti per le persone di casa e il procedimento.
   ========================================================================= */

import { el } from './dom.js';
import { icona } from './icone.js';
import { apriFoglio, fotoPiatto } from './comuni.js';
import * as M from '../model.js';

export function mostraPiatto(piatto, stato) {
  apriFoglio(M.NOME_TIPO[piatto.tipo] ? cap(M.NOME_TIPO[piatto.tipo]) : 'Piatto', (corpo) => {
    const pref = stato.preferenze;
    const amato = (pref.amoPiatti || []).includes(piatto.id);
    const escluso = (pref.escludiPiatti || []).includes(piatto.id);
    const kcal = M.kcalPiatto(piatto, stato.indiceIngredienti);
    const persone = pref.porzioni || 1;

    // la foto, con i comandi sopra
    const foto = fotoPiatto(piatto, stato, 'grande');
    if (stato.azioni.salvaFoto) {
      const scegli = el('input', { type: 'file', accept: 'image/*', class: 'nascosto',
        onchange: (e) => { const f = e.target.files && e.target.files[0]; if (f) stato.azioni.salvaFoto(piatto.id, f); } });
      foto.appendChild(scegli);
      foto.appendChild(el('div', { class: 'comandiFoto' }, [
        el('button', { class: 'pillola', type: 'button', onclick: () => scegli.click() },
          [icona('foto'), stato.fotoDi.has(piatto.id) ? 'Cambia foto' : 'Aggiungi foto']),
        stato.fotoDi.has(piatto.id)
          ? el('button', { class: 'pillola', type: 'button', 'aria-label': 'Togli la foto',
              onclick: () => stato.azioni.togliFoto(piatto.id) }, [icona('cestino')])
          : null
      ]));
    }
    corpo.appendChild(foto);

    corpo.appendChild(el('h2', { class: 'titoloPiatto' }, piatto.nome));
    corpo.appendChild(el('div', { class: 'datiPiatto' }, [
      el('span', { class: 'chip' }, [icona('orologio'), M.formattaTempo(piatto.tempoMin)]),
      kcal ? el('span', { class: 'chip' }, [icona('fiamma'), `${kcal} kcal a persona`]) : null,
      M.diStagione(piatto, stato.indiceIngredienti, M.mesecorrente())
        ? el('span', { class: 'chip verde' }, [icona('foglia'), 'di stagione']) : null
    ]));

    corpo.appendChild(el('div', { class: 'azioniPiatto' }, [
      el('button', {
        type: 'button', class: 'secondario' + (amato ? ' cuoreAcceso' : ''),
        'aria-pressed': amato ? 'true' : 'false',
        onclick: () => stato.azioni.cuore(piatto.id)
      }, [icona('cuore'), amato ? 'Ti piace' : 'Mi piace']),
      el('button', {
        type: 'button', class: 'secondario' + (escluso ? ' esclusoAcceso' : ''),
        'aria-pressed': escluso ? 'true' : 'false',
        onclick: () => stato.azioni.escludi(piatto.id)
      }, [icona('vieta'), escluso ? 'Escluso' : 'Non lo voglio più'])
    ]));
    if (escluso) {
      corpo.appendChild(el('p', { class: 'nota' }, 'Non te lo propongo più. Tocca "Escluso" per rimetterlo in giro.'));
    }

    corpo.appendChild(el('h3', { class: 'titoletto' }, `Ingredienti per ${persone} ${persone === 1 ? 'persona' : 'persone'}`));
    corpo.appendChild(el('ul', { class: 'ingredienti' }, (piatto.ingredienti || []).map((voce) => {
      const ing = stato.indiceIngredienti.get(voce.ingredienteId);
      return el('li', {}, [
        el('span', {}, ing ? ing.nome : voce.ingredienteId),
        el('span', { class: 'qta' }, M.formattaQta(voce.qta * persone, voce.unita || (ing && ing.unita) || ''))
      ]);
    })));

    corpo.appendChild(el('h3', { class: 'titoletto' }, 'Come si fa'));
    corpo.appendChild(el('ol', { class: 'passi' }, (piatto.passi || []).map((p) => el('li', {}, p))));
  });
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
