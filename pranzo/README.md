# Pranzo 2.0

Pianifica i pasti della settimana — pranzo e cena — e ne ricava la lista
della spesa.
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
    photo.js              la foto del piatto, ridotta prima di salvarla
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
- un giorno ha due pasti, `pasti.pranzo` e `pasti.cena`; i menù della 1.x si
  leggono come un giorno col solo pranzo, e si normalizzano in `model.js`
  (`normalizzaMenu`), non nelle schermate;
- la cena può essere "avanzi del pranzo": porta gli stessi id del pranzo, così
  la spesa conta quel piatto due volte — che è appunto cucinarne il doppio;
- i macro coperti non si salvano sul piatto: si calcolano dagli ingredienti, e
  la copertura è della **giornata**, non del piatto. Dalla 2.0 coprirle tutte
  non è un obbligo: conta nel punteggio e si mostra, ma un pasto incompleto
  resta un pasto valido;
- la lista dei piatti e degli ingredienti esclusi non si rilassa mai, in
  nessun ramo del codice; l'app non la modifica da sola, propone e aspetta;
- le foto dei piatti stanno in uno store a parte, ridotte a 1000 px e sotto
  i 200 kB, e **non** entrano nei backup: un backup deve restare un file che
  si manda in chat.

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

## La versione mostrata nell'app

In fondo alla prima pagina, sotto "powered by Rems", c'è il numero di
versione: sta in `VERSIONE_APP`, in cima a `js/ui/home.js`. Si cambia **a
mano**, quando serve; non si alza da sola e non c'entra con la `VERSIONE`
di `sw.js`, che è solo il numero di serie della cache.

## Quando si modifica un file dell'app

Il service worker serve prima dalla cache, quindi **va alzata `VERSIONE` in
`sw.js`** a ogni modifica di HTML, CSS o JS, altrimenti i telefoni continuano
a mostrare la versione vecchia. Se si aggiunge un file, va aggiunto anche
all'elenco `GUSCIO` nello stesso file.

## I dati

Un backup è un file `.json` con tutto: piatti, ingredienti, gusti, voti,
menù, dispensa, cronologia — tranne le foto, che restano sul telefono. Si fa da *Altro → Impostazioni → Backup*.
Dentro il telefono restano anche le ultime cinque istantanee giornaliere:
servono contro il gesto sbagliato, non contro il telefono perso.
