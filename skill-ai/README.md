# skill.AI

PWA per salvare al volo link a repo, skill e guide visti sui social.

## Pubblicazione (GitHub Pages)
1. Copia la cartella nel repo del tuo sito (es. `/skill-ai/`).
2. Apri `https://TUO-SITO/skill-ai/` con Chrome su Pixel > menu > **Installa app**.
3. Da Instagram/TikTok/YouTube: Condividi > **skill.AI**.

## Descrizione automatica (facoltativa, gratis)
1. Cloudflare > Workers & Pages > Create Worker > incolla `worker.js` > Deploy.
2. Copia l'URL del worker in `WORKER_URL` dentro `index.html`.

## Condivisione dai social
Condividi il link verso skill.AI: viene salvato subito e si apre la scheda gia' pronta
per la nota, col cursore nella casella delle considerazioni. Titolo e descrizione
arrivano dal Worker qualche istante dopo e si infilano da soli nelle caselle, senza
toccare quello che stai scrivendo. Condividendo un link gia' salvato non si crea un
doppione: si riapre quello di prima, per aggiungere una nota.

## Come e' fatto l'elenco
I link sono raccolti per quando li hai salvati (Questa settimana / Questo mese / Prima).
Ogni riga mostra titolo, stato, dominio, quanto tempo fa e la tua nota, se c'e'.
Ogni link ha un livello di interesse, che si sceglie toccando la riga:
Subito (arancio), Appena ho tempo (azzurro, e' quello di partenza), Un giorno (grigio),
Fatto (verde, per quello che hai gia' provato o installato).
Nell'elenco la parola compare solo quando dice qualcosa: "Appena ho tempo" e' il livello
normale e resta muto, lo riconosci dal filetto azzurro.
Nella fila dei filtri compaiono solo i livelli che hanno almeno un link.

I link salvati prima avevano altri nomi: Da vedere diventa Appena ho tempo, Provata e
Installata diventano Fatto, Scartata resta ma non si puo' piu' scegliere. E' solo una
traduzione a schermo: nel database il valore vecchio resta scritto (vedi VECCHI in
index.html), quindi si puo' tornare indietro in qualsiasi momento.

## Dati e accesso
I link sono su Firebase (progetto `albero-ceni`, lo stesso dell'Albero) in `utenti/{uid}/skill-ai`.
Si accede con lo stesso account email/password dell'Albero; l'accesso resta memorizzato sul dispositivo.
Le regole sono in `firestore.rules` alla radice del repo: vanno incollate e pubblicate in
Console Firebase > Firestore Database > Regole.
