# skill.AI

PWA per salvare al volo link a repo, skill e guide visti sui social.

## Pubblicazione (GitHub Pages)
1. Copia la cartella nel repo del tuo sito (es. `/skill-ai/`).
2. Apri `https://TUO-SITO/skill-ai/` con Chrome su Pixel > menu > **Installa app**.
3. Da Instagram/TikTok/YouTube: Condividi > **skill.AI**.

## Descrizione automatica (facoltativa, gratis)
1. Cloudflare > Workers & Pages > Create Worker > incolla `worker.js` > Deploy.
2. Copia l'URL del worker in `WORKER_URL` dentro `index.html`.

## Come e' fatto l'elenco
I link sono raccolti per quando li hai salvati (Questa settimana / Questo mese / Prima).
Ogni riga mostra titolo, stato, dominio, quanto tempo fa e la tua nota, se c'e'.
Gli stati sono tre: Da vedere, Provata, Installata. Si scelgono toccando la riga.
"Scartata" non si puo' piu' scegliere: resta solo sui link scartati prima del novembre 2026,
cosi' si vedono ancora nell'elenco e si possono eliminare a mano.

## Dati e accesso
I link sono su Firebase (progetto `albero-ceni`, lo stesso dell'Albero) in `utenti/{uid}/skill-ai`.
Si accede con lo stesso account email/password dell'Albero; l'accesso resta memorizzato sul dispositivo.
Le regole sono in `firestore.rules` alla radice del repo: vanno incollate e pubblicate in
Console Firebase > Firestore Database > Regole.
