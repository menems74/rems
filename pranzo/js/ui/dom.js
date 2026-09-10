/* dom.js — quattro aiuti per costruire l'interfaccia senza librerie. */

/** Testo sicuro dentro HTML: i piatti importati da AI non devono iniettare markup. */
export function esc(valore) {
  return String(valore == null ? '' : valore)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function el(tag, attributi = {}, figli = []) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi)) {
    if (k === 'class') nodo.className = v;
    else if (k === 'html') nodo.innerHTML = v;
    else if (k === 'testo') nodo.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') nodo.addEventListener(k.slice(2), v);
    else if (v !== null && v !== false && v !== undefined) nodo.setAttribute(k, v);
  }
  for (const f of [].concat(figli)) {
    if (f == null) continue;
    nodo.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
  }
  return nodo;
}

export function svuotaNodo(nodo) { while (nodo.firstChild) nodo.removeChild(nodo.firstChild); }

export function avviso(testo, tipo = 'info') {
  const barra = document.getElementById('avviso');
  if (!barra) return;
  barra.textContent = testo;
  barra.dataset.tipo = tipo;
  barra.hidden = false;
  clearTimeout(avviso._t);
  avviso._t = setTimeout(() => { barra.hidden = true; }, 3500);
}
