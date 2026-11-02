# Frame — analisi video frame per frame

App web installabile (PWA) per scorrere un video un fotogramma alla volta e
condividere il frame trovato (PNG) tramite il menu **Condividi** di Android,
per esempio verso l'app del cloud. Il frame non viene salvato in galleria.

## Come si usa
1. Apri `frame/` dal portale (App → Frame). Da Chrome: menu ⋮ → *Aggiungi a schermata Home*.
2. **Apri video** e scegli il file dal telefono.
3. Scorri il video:
   - ◀ ▶ = un frame (tieni premuto per scorrere di continuo)
   - ◀◀ ▶▶ = dieci frame
   - trascina in orizzontale sul video per scorrere, due dita per lo zoom, doppio tocco per ingrandire o tornare alla vista intera
   - cursore: durante il trascinamento mostra i keyframe ("anteprima"), al rilascio il frame esatto
   - tocca il numero del frame per andare a un frame preciso
4. **Condividi questo frame** → scegli l'app del cloud.
   Nome del file: `video_f000123_00m04s120.png` (numero del frame e tempo).

## Come funziona
- **Modalità precisa** (MP4/MOV con H.264, H.265, VP9 o AV1): `js/mp4.js` legge solo
  l'indice del file (box `moov`), `js/motore.js` decodifica con WebCodecs un gruppo di
  frame alla volta (dal keyframe) e lo tiene in cache, con un limite di memoria.
  I frame sono numerati in base ai timestamp reali, quindi i numeri sono corretti anche
  con le registrazioni dello schermo, che hanno un frame rate variabile. La rotazione dei
  video girati in verticale viene applicata.
- **Modalità approssimata** (WebM, MP4 frammentati, codec non supportati): usa il lettore
  del browser. Il fotogramma mostrato è reale, il numero è stimato a 30 fps.
- Privacy: il video viene letto solo sul dispositivo, nessun upload. Nessuna libreria esterna.

## Aggiornamenti
Dopo una modifica ai file, alzare `VERSIONE` in `sw.js`, altrimenti il telefono continua
a usare la copia in cache.
