# Pranzo 2.0

Pianifica i pranzi della settimana e ne ricava la lista della spesa.
HTML, CSS e JavaScript e nulla più: nessun framework, nessun passaggio di
compilazione, nessuna dipendenza da CDN o da npm. I dati stanno nel telefono
(IndexedDB, con ripiego su localStorage) e l'app funziona senza rete.

Si apre da <https://menems74.github.io/rems/pranzo/>.

## Com'è fatta

```
pranzo/
  index.html              guscio: intestazione, vista, navigazione, pannello
  manifest.webmanifest    per installarla come app
  sw.js                   service worker: tutto in cache, funziona offline
  test.html               le prove automatiche, si aprono nel browser
  css/app.css             un solo foglio, con i token del tema
  js/
    db.js                 IndexedDB a mano: apri, leggi, scrivi, transazioni
    model.js              schemi, validazione, unità, macro   (funzioni pure)
    planner.js            vincoli, punteggi, generazione del menù (pure)
    shopping.js           dal menù alla lista della spesa      (pure)
    tastes.js             voti, medie, suggerimenti sui gusti  (pure)
    ai-import.js          prompt per un'AI e lettura della risposta (pure)
    backup.js             export, import, istantanee
    app.js                avvio, seed, router a hash, azioni
    ui/                   una schermata per file; non parlano col database
      home.js             la prima pagina: oggi e l'indice delle sezioni
  data/
    seed-*.json           catalogo di partenza (107 ingredienti, 80 piatti)
    generatori/           gli script Python che hanno prodotto i seed e le icone
  icons/                  icone dell'app, generate da data/generatori/icone.py
```

Le regole che tengono in piedi il resto:

- i moduli in `js/*.js` (tranne `db.js`, `backup.js` e `app.js`) sono funzioni
  pure: non toccano il database, quindi si possono provare in isolamento;
- le schermate in `js/ui/` non leggono e non scrivono: chiedono a
  `stato.azioni`, che sta in `app.js`;
- la prima pagina non è un menu di bottoni: ogni riga porta il suo dato vero
  ("24 da prendere", "1 suggerimento"), in blu quando c'è qualcosa da fare;
- le quantità si salvano sempre per **una** porzione e si moltiplicano quando
  serve; la conversione all'unità canonica avviene prima di sommare, mai dopo;
- i macro coperti non si salvano sul piatto: si calcolano dagli ingredienti,
  e la copertura è del **pranzo**, non del piatto;
- la lista dei piatti e degli ingredienti esclusi non si rilassa mai, in
  nessun ramo del codice; l'app non la modifica da sola, propone e aspetta.

## Le prove

Si aprono in un browser, senza installare niente:

```
python3 -m http.server 8000     # dalla cartella pranzo/
# poi http://localhost:8000/test.html
```

Coprono i punti dove è facile sbagliare: conversioni di unità, soglie dei
macro, famiglia della proteina, vincoli del planner e rilassamenti,
aggregazione della spesa, apprendimento sui gusti, lettura di una risposta
sporca di un'AI, verifica di un backup.

## Quando si modifica un file dell'app

Il service worker serve prima dalla cache, quindi **va alzata `VERSIONE` in
`sw.js`** a ogni modifica di HTML, CSS o JS, altrimenti i telefoni continuano
a mostrare la versione vecchia. Se si aggiunge un file, va aggiunto anche
all'elenco `GUSCIO` nello stesso file.

## I dati

Un backup è un file `.json` con tutto: piatti, ingredienti, gusti, voti,
menù, dispensa, cronologia. Si fa da *Altro → Impostazioni → Backup*.
Dentro il telefono restano anche le ultime cinque istantanee giornaliere:
servono contro il gesto sbagliato, non contro il telefono perso.
