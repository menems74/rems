/* =========================================================================
   photo.js — dalla foto del telefono a qualcosa che sta in un archivio.

   Una foto dell'iPhone pesa 2–4 MB: ottanta piatti così sarebbero centinaia
   di megabyte, e Safari farebbe pulizia. Qui si ridimensiona e si ricomprime
   prima di salvare, con il canvas del browser e nient'altro: lato lungo
   1000 px e JPEG, che portano una foto sotto i 200 kB senza che si veda.

   Nessun accesso al database: si entra con un File, si esce con un Blob.
   ========================================================================= */

export const LATO_MAX = 1000;          // pixel del lato lungo
export const BYTE_MAX = 220 * 1024;    // oltre, si riprova con meno qualità
export const QUALITA = [0.75, 0.6, 0.45, 0.35];
const BYTE_SORGENTE_MAX = 40 * 1024 * 1024;

export class ErroreFoto extends Error {}

/**
 * Prepara una foto per l'archivio.
 * @param file   quello che arriva da <input type="file">
 * @returns { blob, larghezza, altezza, byte, byteOriginali }
 */
export async function preparaFoto(file, opzioni = {}) {
  if (!file) throw new ErroreFoto('nessun file');
  if (file.type && !/^image\//.test(file.type)) {
    throw new ErroreFoto('questo non è una foto');
  }
  if (file.size > (opzioni.byteSorgenteMax || BYTE_SORGENTE_MAX)) {
    throw new ErroreFoto('foto troppo grande da aprire');
  }

  const latoMax = opzioni.latoMax || LATO_MAX;
  const byteMax = opzioni.byteMax || BYTE_MAX;

  const sorgente = await apriImmagine(file);
  const misura = misuraRidotta(sorgente.larghezza, sorgente.altezza, latoMax);

  const tela = document.createElement('canvas');
  tela.width = misura.larghezza;
  tela.height = misura.altezza;
  const pennello = tela.getContext('2d');
  pennello.imageSmoothingQuality = 'high';
  pennello.drawImage(sorgente.immagine, 0, 0, misura.larghezza, misura.altezza);
  if (sorgente.chiudi) sorgente.chiudi();

  // si scende di qualità finché non sta nel peso: meglio una foto un po'
  // meno nitida che un archivio che il telefono decide di buttare via
  let blob = null;
  for (const qualita of (opzioni.qualita || QUALITA)) {
    blob = await inBlob(tela, qualita);
    if (blob && blob.size <= byteMax) break;
  }
  if (!blob) throw new ErroreFoto('non riesco a convertire la foto');

  return {
    blob,
    larghezza: misura.larghezza,
    altezza: misura.altezza,
    byte: blob.size,
    byteOriginali: file.size
  };
}

/** Misura ridotta a parità di proporzioni. Non si ingrandisce mai. */
export function misuraRidotta(larghezza, altezza, latoMax) {
  if (!larghezza || !altezza) throw new ErroreFoto('foto senza dimensioni');
  const lungo = Math.max(larghezza, altezza);
  if (lungo <= latoMax) return { larghezza, altezza };
  const fattore = latoMax / lungo;
  return {
    larghezza: Math.max(1, Math.round(larghezza * fattore)),
    altezza: Math.max(1, Math.round(altezza * fattore))
  };
}

/**
 * Apre il file come immagine. Si preferisce createImageBitmap con
 * `imageOrientation: from-image`, perché le foto del telefono portano dentro
 * l'orientamento e altrimenti finiscono coricate.
 */
async function apriImmagine(file) {
  if (window.createImageBitmap) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        immagine: bitmap, larghezza: bitmap.width, altezza: bitmap.height,
        chiudi: () => bitmap.close && bitmap.close()
      };
    } catch (e) { /* qualche browser non accetta l'opzione: si ripiega */ }
  }
  return new Promise((risolvi, rifiuta) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => risolvi({
      immagine: img, larghezza: img.naturalWidth, altezza: img.naturalHeight,
      chiudi: () => URL.revokeObjectURL(url)
    });
    img.onerror = () => { URL.revokeObjectURL(url); rifiuta(new ErroreFoto('foto illeggibile')); };
    img.src = url;
  });
}

function inBlob(tela, qualita) {
  return new Promise((risolvi) => {
    if (tela.toBlob) tela.toBlob((b) => risolvi(b), 'image/jpeg', qualita);
    else risolvi(daDataURL(tela.toDataURL('image/jpeg', qualita)));
  });
}

function daDataURL(dataURL) {
  const [testa, corpo] = dataURL.split(',');
  const binario = atob(corpo);
  const byte = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) byte[i] = binario.charCodeAt(i);
  return new Blob([byte], { type: (testa.match(/:(.*?);/) || [])[1] || 'image/jpeg' });
}

/* --------------------------------------------------------- utilità ------- */

/** "180 kB", "1,2 MB". */
export function peso(byte) {
  if (!byte) return '0 kB';
  if (byte < 1024) return `${byte} byte`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Quanto spazio concede il telefono e quanto ne stiamo usando.
 * @returns { usati, disponibili } in byte, oppure null se il browser tace
 */
export async function spazio() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try {
    const stima = await navigator.storage.estimate();
    return { usati: stima.usage || 0, disponibili: stima.quota || 0 };
  } catch (e) { return null; }
}

/**
 * Chiede al browser di non buttare via i dati. Safari lo concede alle app
 * installate; Chrome decide da sé. Se dice di no non cambia niente: è solo
 * una protezione in più, non una garanzia.
 */
export async function chiediDiTenere() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try {
    if (navigator.storage.persisted && await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (e) { return false; }
}
