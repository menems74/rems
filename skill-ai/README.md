# skill.AI

PWA per salvare al volo link a repo, skill e guide visti sui social.

## Pubblicazione (GitHub Pages)
1. Copia la cartella nel repo del tuo sito (es. `/skill-ai/`).
2. Apri `https://TUO-SITO/skill-ai/` con Chrome su Pixel > menu > **Installa app**.
3. Da Instagram/TikTok/YouTube: Condividi > **skill.AI**.

## Descrizione automatica (facoltativa, gratis)
1. Cloudflare > Workers & Pages > Create Worker > incolla `worker.js` > Deploy.
2. Copia l'URL del worker in `WORKER_URL` dentro `index.html`.

## Sincronizzazione tra dispositivi (facoltativa)
Senza Firebase i dati restano nel telefono. Per sincronizzare:
1. Console Firebase > progetto > Firestore Database > crea.
2. Incolla l'oggetto di configurazione web in `FIREBASE_CONFIG`.
3. Regole Firestore: limita l'accesso a te (vedi nota nella chat).
