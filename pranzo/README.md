# Pranzo

Il menù della settimana, pranzo e cena, e la lista della spesa che si fa da
sola. Aprendo l'app si deve capire tutto subito: cosa si mangia oggi, i
giorni della settimana, la spesa a un tocco.

HTML, CSS e JavaScript e nulla più: nessun framework, nessun passaggio di
compilazione, nessuna dipendenza da npm. I dati stanno nel telefono
(IndexedDB, con ripiego su localStorage) e l'app funziona senza rete; i
caratteri arrivano da Google Fonts e, senza rete, si ripiega su quelli del
telefono.

Si apre da <https://menems74.github.io/rems/pranzo/>.

## Com'è fatta (3.0)

```
pranzo/
  index.html              guscio: vista, barra in basso, foglio che sale
  manifest.webmanifest    per installarla come app
  sw.js                   service worker: tutto in cache, funziona offline
  test.html               le prove automatiche, si aprono nel browser
  css/app.css             un solo foglio, colori come token (chiaro e scuro)
  js/
    db.js                 IndexedDB a mano: apri, leggi, scrivi, transazioni
    model.js              schemi, unità, calorie, forma del menù   (pure)
    planner.js            come si sceglie un piatto, la settimana   (pure)
    shopping.js           dal menù alla lista della spesa           (pure)
    ai-import.js          prompt per un'AI e lettura della risposta (pure)
    photo.js              la foto del piatto, ridotta prima di salvarla
    backup.js             export e import su file
    app.js                avvio, catalogo, router a hash, azioni
    ui/                   le pagine e i fogli; non parlano col database
      home.js             la settimana: oggi in cima, i giorni sotto
      giorno.js           il foglio di un giorno: cambia, scegli tu, tempo
      piatto.js           il foglio di un piatto: foto, cuore, escludi
      scegli.js           "scegli tu" dal catalogo
      regole.js           persone, leggeri/sostanziosi, pasti
      spesa.js            la lista, con "ce l'ho" e "copia"
      piatti.js           il catalogo
      impostazioni.js     nome, giorni, tempi, tema, backup
      import.js           piatti nuovi con un'AI
  data/
    seed-*.json           catalogo di partenza (116 ingredienti, 141 piatti)
    generatori/           gli script Python che hanno prodotto i seed e le icone
```

Le regole che tengono in piedi il resto:

- un pasto è **un piatto**: a pranzo un primo o un piatto unico, a cena un
  secondo (che si porta dietro un contorno) o un piatto unico, con una
  preferenza per secondi e zuppe; si salva come
  `{ piatto, contorno, tempoMax, scelto }`;
- i menù della 2.x e della 1.x si leggono passando da `M.normalizzaMenu`: il
  primo piatto che non è un contorno diventa il piatto, le cene "avanzi"
  tornano cene normali;
- le **calorie** stanno sull'ingrediente (per 100 g, 100 ml o per pezzo) e
  si sommano sul piatto: non si salvano mai sul piatto. Sono stime, e l'app
  lo dice;
- **leggeri / sostanziosi** non è un'etichetta scritta a mano: un piatto è
  leggero se sta sotto la mediana delle calorie del suo tipo;
- il planner ha regole che non si piegano mai (tipo del pasto, piatti e
  ingredienti esclusi, stagione) e regole che si piegano solo se non c'è
  altro, in quest'ordine: proteina diversa dal pasto prima, filtro
  leggeri/sostanziosi, tempo, nessun piatto ripetuto. Se ne piega una,
  lo dice;
- tra i candidati vince il punteggio con un po' di caso: più punti ai piatti
  col cuore e di stagione, meno a quelli mangiati da poco;
- "rifai la settimana" non tocca i pasti scelti a mano né i tempi scelti;
- la lista della spesa **si rifà da sola** a ogni cambio del menù e delle
  persone, conservando spunte e voci aggiunte a mano; sale, olio e spezie
  partono come "ce l'ho già";
- le quantità si salvano per **una** porzione e si moltiplicano per le
  persone; la conversione all'unità canonica avviene prima di sommare;
- il catalogo di partenza si aggiorna da solo all'avvio, ma solo in aggiunta
  (e aggiungendo le calorie agli ingredienti che non le hanno): un piatto
  già in archivio non si riscrive mai;
- le foto stanno in uno store a parte e **non** entrano nei backup.

## Il passaggio dalla 2.x

Al primo avvio della 3.0 (`versioneDati` nelle preferenze): i piatti con una
media dei voti da 4 in su prendono il cuore; impostazioni, esclusi, piatti
importati e foto restano dove sono. Voti, dispensa e suggerimenti restano
nell'archivio e nei backup, ma la 3.0 non li usa più.

## Le prove

Si aprono in un browser, senza installare niente:

```
python3 -m http.server 8000     # dalla cartella pranzo/
# poi http://localhost:8000/test.html
```

## La versione mostrata nell'app

In fondo alla prima pagina c'è il numero di versione: sta in `VERSIONE_APP`,
in cima a `js/ui/home.js`. Si cambia **a mano**; non c'entra con la
`VERSIONE` di `sw.js`, che è solo il numero di serie della cache.

## Quando si modifica un file dell'app

Il service worker serve prima dalla cache, quindi **va alzata `VERSIONE` in
`sw.js`** a ogni modifica di HTML, CSS o JS, altrimenti i telefoni continuano
a mostrare la versione vecchia. Se si aggiunge un file, va aggiunto anche
all'elenco `GUSCIO` nello stesso file.
