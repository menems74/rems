# UI/UX Pro Max — copia nel repository

Questa cartella non è roba nostra: è una copia della skill **UI/UX Pro Max**,
tenuta dentro il repository così è disponibile in ogni sessione di lavoro su
`rems` senza doverla installare ogni volta.

| | |
|---|---|
| Origine | <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill> |
| Versione | 2.15.0 |
| Commit copiato | `3a13158ff1f32156cbe144108de48eda2ecaed9a` |
| Copiata il | 2 novembre 2026 |
| Licenza | MIT (vedi `LICENSE`) |

## Cosa c'è dentro

- `SKILL.md` — le istruzioni che l'assistente legge quando serve.
- `data/` — il database vero e proprio, in CSV: 88 schede di stile, 192 palette,
  74 abbinamenti di font, 119 linee guida UX, icone, grafici, stack.
- `references/` — l'elenco completo delle regole, da leggere su richiesta.
- `scripts/` — `search.py` e `core.py`, che cercano dentro i CSV.

## Cosa è stato lasciato fuori, apposta

- Le altre skill del pacchetto originale (brand, design-system, ui-styling,
  slides, banner-design, loghi): alcune chiamano servizi AI a pagamento e qui
  non servono a nessuno.
- `scripts/tests/`: servono a chi sviluppa la skill, non a chi la usa.

## Come si usa

Lo script legge solo file locali, non apre connessioni:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<domanda>" --domain style
```

I domini sono `style`, `color`, `typography`, `ux`, `icons`, `chart`, `product`,
`gsap`; in alternativa `--stack <nome>` per le indicazioni legate a una
tecnologia, o `--design-system` quando si parte da zero con una pagina intera.

Se l'esecuzione dello script è bloccata (capita nelle sessioni in cloud, che
non eseguono volentieri codice scaricato), i CSV in `data/` si leggono
comunque a mano: sono file di testo normali.

## Come si aggiorna

Si riscarica il repository originale e si ricopiano `SKILL.md`, `data/`,
`references/` e `scripts/` (senza `tests/`), poi si aggiornano versione e
commit qui sopra. Dopo la copia va rifatta **l'unica modifica locale** che serve: in `SKILL.md`
i comandi dell'originale puntano a `${CLAUDE_PLUGIN_ROOT}/...`, che vale solo
se la skill è installata come plugin. Qui sta nel repository, quindi gli undici
comandi sono stati riscritti con il percorso relativo alla radice del progetto
(`python3 ".claude/skills/ui-ux-pro-max/scripts/search.py" ...`). A parte
questo, nessun file copiato è stato toccato: altre modifiche meglio scriverle
nel `CLAUDE.md` del progetto, così l'aggiornamento successivo non le cancella.
