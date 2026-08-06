# Albero Genealogico — Guida a pubblicazione e sincronizzazione

Obiettivo: usare il sito da questo PC, dal PC di casa e dal cellulare, con i dati
sincronizzati su **Firebase (Cloud Firestore)** e il sito ospitato su **GitHub Pages**.

- **Home** (`index.html`): libera, senza login, con il pulsante *Apri Albero Genealogico*.
- **App** (`albero.html`): tutti possono **vedere** l'albero; per **salvare** serve l'accesso
  (email/password che crei tu). Se Firebase non è configurato, l'app continua a funzionare in
  modalità solo-file locale (come prima).

File del progetto: `index.html`, `albero.html`, `firestore.rules`, questa guida.

---

## Parte 1 — Firebase (i dati)

1. Vai su https://console.firebase.google.com e **Aggiungi progetto** (es. `albero-ceni`).
   Il piano gratuito **Spark** è più che sufficiente.
2. Nel menu a sinistra apri **Build > Firestore Database > Crea database**.
   Scegli **Production mode** e una region europea (es. `europe-west`).
3. Apri **Build > Authentication > Inizia**, scheda **Sign-in method**, abilita
   **Email/Password**.
4. Sempre in Authentication, scheda **Users > Aggiungi utente**: crea il TUO account
   (email + password). Sarà l'unico che potrà modificare l'albero.
5. Prendi la configurazione: icona **⚙️ Impostazioni progetto > Le tue app >** (se non c'è)
   aggiungi un'app **Web </>**. Copia l'oggetto `firebaseConfig`, sono valori tipo:
   ```js
   apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
   ```
   (Questi valori NON sono segreti: possono stare in una pagina pubblica. La protezione
   dei dati viene dalle Regole del punto 7.)
6. Apri **`albero.html`** con un editor di testo e incolla i tuoi valori nel blocco
   `const FIREBASE_CONFIG = { ... }` (in alto nello `<script>`), sostituendo i `___`.
   Copia i valori **esattamente** come li dà la console (occhio a `storageBucket`, che nei
   progetti nuovi finisce con `.firebasestorage.app` invece di `.appspot.com`).
7. In **Firestore Database > scheda Regole**, incolla il contenuto di **`firestore.rules`**
   e premi **Pubblica**. (Lettura libera, scrittura solo se autenticato.)

Fatto: da questo momento l'app legge e scrive su Firestore. La prima volta accedi con il tuo
account e premi **Salva**: verrà creato il documento `alberi/ceni` con l'albero attuale.

---

## Parte 2 — GitHub Pages (il sito)

1. Su https://github.com crea un **nuovo repository** (es. `albero-ceni`).
   Può essere **privato**: la parte pubblicata (l'app) non contiene dati né password.
2. Carica i file `index.html`, `albero.html` (già compilato con la config), `firestore.rules`
   e questa guida (pulsante **Add file > Upload files**).
3. Vai in **Settings > Pages**: in *Build and deployment* scegli **Deploy from a branch**,
   branch `main`, cartella `/root`, **Save**.
4. Dopo 1–2 minuti avrai un indirizzo tipo `https://TUONOME.github.io/albero-ceni/`.
   Aprilo: vedi la home. Il pulsante porta all'albero.

> Nota: sul piano gratuito, se attivi Pages anche da un repo privato il **sito** risulta
> comunque raggiungibile da chiunque abbia il link (il controllo accessi di Pages è solo
> Enterprise). Va bene: i **dati** restano protetti dalle Regole di Firestore e dal tuo login.
> Se in futuro vorrai una vera schermata di login davanti a tutto il sito, si può aggiungere
> **Cloudflare Access** (piano gratuito) senza toccare il codice.

---

## Uso quotidiano

- **Vedere l'albero**: apri il link da PC o cellulare. Nessun accesso richiesto.
- **Modificare**: premi **Accedi** (in alto), inserisci email/password, poi modifica e premi
  **Salva**. Le modifiche si sincronizzano sugli altri dispositivi in tempo reale.
- **Aggiorna dal cloud** (icona nuvola): ricarica l'ultima versione salvata, scartando le
  modifiche locali non salvate.
- **Esporta** (icona download): scarica una copia `.json` di backup quando vuoi.

## Note

- I dati sono un unico documento Firestore (`alberi/ceni`), leggero e con cronologia di
  salvataggio (campo `updatedAt` / `updatedBy`).
- Conflitti: se modifichi su due dispositivi insieme, l'app avvisa quando c'è una versione più
  recente sul cloud (usa *Aggiorna dal cloud* prima di continuare).
- Costo: per un albero di famiglia si resta ampiamente dentro il piano gratuito di Firebase.
- Sicurezza: per limitare la scrittura al solo tuo account, usa la riga con `request.auth.uid`
  indicata dentro `firestore.rules` (ci metti il tuo UID preso da Authentication).
