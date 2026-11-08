# skill.AI

PWA per salvare al volo link a repo, skill e guide visti sui social.

## Pubblicazione (GitHub Pages)
1. Copia la cartella nel repo del tuo sito (es. `/skill-ai/`).
2. Apri `https://TUO-SITO/skill-ai/` con Chrome su Pixel > menu > **Installa app**.
3. Da Instagram/TikTok/YouTube: Condividi > **skill.AI**.

## Descrizione automatica (facoltativa, gratis)
1. Cloudflare > Workers & Pages > Create Worker > incolla `worker.js` > Deploy.
2. Copia l'URL del worker in `WORKER_URL` dentro `index.html`.

## Dati e accesso
I link sono su Firebase (progetto `albero-ceni`, lo stesso dell'Albero) in `utenti/{uid}/skill-ai`.
Si accede con lo stesso account email/password dell'Albero; l'accesso resta memorizzato sul dispositivo.
Le regole sono in `firestore.rules` alla radice del repo: vanno incollate e pubblicate in
Console Firebase > Firestore Database > Regole.
