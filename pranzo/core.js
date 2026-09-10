/* =========================================================================
   Pranzo 2.0 · nucleo condiviso
   Impalcatura pronta per il modello dati che arrivera' con le specifiche:
   archivio locale, impostazioni, backup, installazione e altezza schermo.
   Tutto sul dispositivo (localStorage), nessun servizio esterno.
   ========================================================================= */
window.PRANZO = (function(){
'use strict';

var PREFIX = 'pranzo.';

/* ------------------------------------------------------------- archivio */
function read(key, fallback){
  try { var raw = localStorage.getItem(PREFIX + key); return raw ? JSON.parse(raw) : fallback; }
  catch(e){ return fallback; }
}
function write(key, value){
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
  catch(e){ toast('Spazio esaurito: impossibile salvare', true); return false; }
}
function remove(key){ try { localStorage.removeItem(PREFIX + key); } catch(e){} }
function keys(){
  var out = [];
  try {
    for(var i=0;i<localStorage.length;i++){
      var k = localStorage.key(i);
      if(k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
    }
  } catch(e){}
  return out;
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* --------------------------------------------------------- impostazioni */
var DEFAULTS = {};                       // si popolera' con le specifiche
function getSettings(){
  var saved = read('settings', {}) || {}, out = {};
  Object.keys(DEFAULTS).forEach(function(k){
    out[k] = saved[k] !== undefined ? saved[k] : DEFAULTS[k];
  });
  Object.keys(saved).forEach(function(k){ if(out[k] === undefined) out[k] = saved[k]; });
  return out;
}
function setSettings(patch){
  var s = getSettings();
  Object.keys(patch).forEach(function(k){ s[k] = patch[k]; });
  write('settings', s);
  return s;
}

/* --------------------------------------------------------------- backup */
function exportAll(){
  var data = {app:'pranzo', version:1, exportedAt:new Date().toISOString(), data:{}};
  keys().forEach(function(k){ data.data[k] = read(k, null); });
  return data;
}
function importAll(payload){
  if(!payload || payload.app !== 'pranzo' || typeof payload.data !== 'object') throw new Error('formato');
  var n = 0;
  Object.keys(payload.data).forEach(function(k){ if(write(k, payload.data[k])) n++; });
  return n;
}
function wipeAll(){ keys().forEach(remove); }

function backupName(){ return 'pranzo-backup-' + new Date().toISOString().slice(0,10) + '.json'; }
function backupBlob(){ return new Blob([JSON.stringify(exportAll(), null, 2)], {type:'application/json'}); }
function download(blob, name){
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}
/* Salva passando dal sistema: condivisione (Drive, OneDrive, File...),
   poi finestra "salva con nome", infine download classico. */
function saveBackup(){
  var name = backupName(), blob = backupBlob();
  return Promise.resolve().then(function(){
    if(!navigator.canShare) return null;
    var file;
    try { file = new File([blob], name, {type:'application/json'}); } catch(e){ return null; }
    if(!navigator.canShare({files:[file]})) return null;
    return navigator.share({files:[file], title:'Backup Pranzo 2.0'})
      .then(function(){ return 'share'; })
      .catch(function(err){ return (err && err.name === 'AbortError') ? 'abort' : null; });
  }).then(function(res){
    if(res) return res;
    if(!window.showSaveFilePicker) return null;
    return window.showSaveFilePicker({suggestedName:name,
      types:[{description:'Backup Pranzo 2.0', accept:{'application/json':['.json']}}]})
      .then(function(h){
        return h.createWritable().then(function(w){
          return w.write(blob).then(function(){ return w.close(); });
        }).then(function(){ return 'picker'; });
      }).catch(function(err){ return (err && err.name === 'AbortError') ? 'abort' : null; });
  }).then(function(res){
    if(res) return res;
    download(blob, name);
    return 'download';
  });
}

/* ------------------------------------------------------------- utilita' */
function esc(s){
  return String(s).replace(/[&<>"]/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];
  });
}
function fmt(n){ return (Math.round(n*10)/10).toFixed(1); }
var toastTimer = null;
function toast(msg, bad){
  var el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.toggle('bad', !!bad);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2600);
}

/* Alcuni telefoni dichiarano una finestra piu' alta dell'area visibile:
   misuriamo quella vera, cosi' nulla finisce sotto la barra dei gesti. */
(function appHeight(){
  function set(){
    var h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    if(h) document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px');
  }
  set();
  window.addEventListener('resize', set);
  window.addEventListener('orientationchange', function(){ setTimeout(set, 250); });
  if(window.visualViewport) window.visualViewport.addEventListener('resize', set);
})();

/* Installazione e stato rete. Il bottone resta raggiungibile anche quando
   il browser non lancia l'invito: su iPhone non arriva mai. */
function pwa(opts){
  opts = opts || {};
  var btn  = document.getElementById(opts.installId || 'install');
  var txt  = document.getElementById(opts.stateId || 'stateText');
  var wrap = document.getElementById(opts.stateWrapId || 'state');
  var help = document.getElementById(opts.helpId || 'installHelp');
  var asApp = window.matchMedia('(display-mode: standalone)').matches ||
              window.matchMedia('(display-mode: fullscreen)').matches ||
              window.navigator.standalone === true;

  function paint(){
    if(txt){
      txt.textContent = !navigator.onLine ? 'Offline — la app funziona comunque'
                                          : (asApp ? 'Aperta come app' : 'Aperta nel browser');
    }
    if(wrap) wrap.classList.toggle('off', !navigator.onLine);
    if(btn) btn.hidden = asApp;
    if(help && asApp) help.hidden = true;
  }
  window.addEventListener('online', paint);
  window.addEventListener('offline', paint);

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferred = e; paint(); });
  if(btn) btn.addEventListener('click', function(){
    if(deferred){
      deferred.prompt();
      deferred.userChoice.then(function(){ deferred = null; paint(); });
      return;
    }
    if(help){
      var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      help.hidden = false;
      Array.prototype.forEach.call(help.querySelectorAll('[data-os]'), function(el){
        el.hidden = el.dataset.os !== (ios ? 'ios' : 'android');
      });
      help.scrollIntoView({block:'nearest', behavior:'smooth'});
    } else {
      toast('Usa il menu del browser: Installa app');
    }
  });
  window.addEventListener('appinstalled', function(){
    deferred = null; if(help) help.hidden = true; toast('App installata'); paint();
  });
  paint();

  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register(opts.sw || 'sw.js').catch(function(err){ console.warn('SW:', err); });
    });
  }
}

return {
  read: read, write: write, remove: remove, keys: keys, uid: uid,
  getSettings: getSettings, setSettings: setSettings,
  exportAll: exportAll, importAll: importAll, wipeAll: wipeAll,
  saveBackup: saveBackup, backupName: backupName, backupBlob: backupBlob, download: download,
  esc: esc, fmt: fmt, toast: toast, pwa: pwa
};
})();
