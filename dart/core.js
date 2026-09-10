/* =========================================================================
   Dart · nucleo condiviso
   Giocatori, impostazioni, storico e partite in corso vivono qui: la home
   li gestisce, ogni gioco li legge. Tutto sul dispositivo (localStorage).
   ========================================================================= */
window.DART = (function(){
'use strict';

var K = {
  players:  'dart.players',
  settings: 'dart.settings',
  history:  'dart.history',
  match:    'dart.match.'          // + identificativo del gioco
};
/* chiavi della prima versione, quando l'app era solo il 501 */
var OLD = {players:'d501.players', history:'d501.history', match:'d501.match'};

function read(key, fallback){
  try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch(e){ return fallback; }
}
function write(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch(e){ toast('Spazio esaurito: impossibile salvare', true); return false; }
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* --------------------------------------------------- catalogo dei giochi */
var GAMES = [
  {id:'501', name:'501', href:'501.html', ready:true,
   desc:'Match a set e leg, chiusura in doppio',
   icon:'<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>'},
  {id:'clock', name:'Around the Clock', href:'clock.html', ready:true,
   desc:'Dal numero 1 al 20, poi il bull',
   icon:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>'},
  {id:'cricket', name:'Cricket', ready:false,
   desc:'Chiudi 20-15 e il centro prima dell’avversario',
   icon:'<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3l3 18M16 3l-3 18"/>'},
  {id:'doubles', name:'Allenamento doppi', ready:false,
   desc:'Serie di doppi con percentuale di riuscita',
   icon:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>'},
  {id:'highscore', name:'High Score', ready:false,
   desc:'Il massimo dei punti in dieci turni',
   icon:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'}
];

/* -------------------------------------------------- impostazioni globali */
var DEFAULTS = {
  players: [null, null],      // profili proposti a inizio partita
  bestOfSets: 1,
  bestOfLegs: 3,
  starter: 0,
  vibrate: true,
  checkout: true,             // mostra il suggerimento di chiusura
  wakeLock: true              // tiene acceso lo schermo mentre si gioca
};

var players  = read(K.players, null);
var settings = read(K.settings, null);
var history  = read(K.history, null);

/* migrazione dalla versione "solo 501": i dati esistenti non si perdono */
(function migrate(){
  var moved = false;
  if(players === null){
    players = read(OLD.players, []);
    if(players.length) moved = true;
    write(K.players, players);
  }
  if(history === null){
    history = read(OLD.history, []);
    history.forEach(function(h){ if(!h.game) h.game = '501'; });
    if(history.length) moved = true;
    write(K.history, history);
  }
  if(settings === null){ settings = {}; write(K.settings, settings); }
  var oldMatch = read(OLD.match, null);
  if(oldMatch && !localStorage.getItem(K.match + '501')){
    write(K.match + '501', oldMatch);
    moved = true;
  }
  if(moved){
    // le vecchie chiavi restano come copia di sicurezza fino al primo salvataggio nuovo
    try { localStorage.setItem('dart.migrated', new Date().toISOString()); } catch(e){}
  }
})();

function getSettings(){
  var s = {};
  Object.keys(DEFAULTS).forEach(function(k){
    s[k] = (settings && settings[k] !== undefined) ? settings[k] : DEFAULTS[k];
  });
  if(!Array.isArray(s.players) || s.players.length !== 2) s.players = [null, null];
  return s;
}
function setSettings(patch){
  settings = getSettings();
  Object.keys(patch).forEach(function(k){ settings[k] = patch[k]; });
  write(K.settings, settings);
  return getSettings();
}

/* Bersagli di Around the Clock: dall'1 al 20, poi il bull. */
var CLOCK_TARGETS = (function(){
  var t = [];
  for(var n=1;n<=20;n++) t.push({key:String(n), n:n});
  t.push({key:'bull', n:25});
  return t;
})();
function clockLabel(key, mode){
  if(key === 'bull') return 'BULL';
  return (mode === 'doppi' ? 'D' : '') + key;
}
/* Minimo, media e massimo di freccette per ogni bersaglio, su tutte le
   partite di un giocatore in una modalita'. */
function clockStats(playerId, mode){
  var rows = {}, totals = [], games = 0;
  CLOCK_TARGETS.forEach(function(t){ rows[t.key] = []; });
  history.forEach(function(h){
    if(h.game !== 'clock' || h.mode !== mode) return;
    var p = h.players && h.players[0];
    if(!p || p.id !== playerId || !p.perTarget) return;
    games++;
    if(typeof p.total === 'number') totals.push(p.total);
    Object.keys(p.perTarget).forEach(function(k){
      if(rows[k]) rows[k].push(p.perTarget[k]);
    });
  });
  function agg(list){
    if(!list.length) return null;
    var min = Math.min.apply(null, list), max = Math.max.apply(null, list);
    var sum = list.reduce(function(a,b){ return a+b; }, 0);
    return {min:min, max:max, avg:sum/list.length, n:list.length};
  }
  return {
    games: games,
    targets: CLOCK_TARGETS.map(function(t){ return {key:t.key, stats:agg(rows[t.key])}; }),
    total: agg(totals)
  };
}

/* ------------------------------------------------------------ giocatori */
function listPlayers(){ return players.slice(); }
function playerById(id){
  for(var i=0;i<players.length;i++) if(players[i].id === id) return players[i];
  return null;
}
function playerByName(name){
  var n = String(name).trim().toLowerCase();
  for(var i=0;i<players.length;i++) if(players[i].name.toLowerCase() === n) return players[i];
  return null;
}
function addPlayer(name){
  name = String(name || '').trim();
  if(!name) return null;
  var found = playerByName(name);
  if(found) return found;
  var p = {id: uid(), name: name, createdAt: Date.now()};
  players.push(p); write(K.players, players);
  return p;
}
function renamePlayer(id, name){
  var p = playerById(id); if(!p) return false;
  name = String(name || '').trim(); if(!name) return false;
  p.name = name; write(K.players, players); return true;
}
function removePlayer(id){
  players = players.filter(function(p){ return p.id !== id; });
  write(K.players, players);
  var s = getSettings();
  setSettings({players: s.players.map(function(x){ return x === id ? null : x; })});
}

/* -------------------------------------------------------------- storico */
function listHistory(game){
  return game ? history.filter(function(h){ return h.game === game; }) : history.slice();
}
function addHistory(entry){
  history.unshift(entry);
  if(history.length > 300) history.length = 300;
  write(K.history, history);
}
/* Somma le statistiche di un giocatore su tutte le partite (o su un gioco). */
function aggregate(id, game){
  var out = {matches:0, wins:0, legsWon:0, setsWon:0, points:0, darts:0,
             avg3:0, bestTurn:0, bestLeg:null, c180:0};
  history.forEach(function(h){
    if(game && h.game !== game) return;
    h.players.forEach(function(p, i){
      if(p.id !== id) return;
      out.matches++;
      out.legsWon += p.legsWon || 0; out.setsWon += p.setsWon || 0;
      out.points += p.points || 0; out.darts += p.darts || 0;
      out.c180 += p.c180 || 0;
      if((p.bestTurn||0) > out.bestTurn) out.bestTurn = p.bestTurn;
      if(p.bestLeg != null && (out.bestLeg === null || p.bestLeg < out.bestLeg)) out.bestLeg = p.bestLeg;
      if(h.winner === i) out.wins++;
    });
  });
  out.avg3 = out.darts ? out.points / out.darts * 3 : 0;
  return out;
}

/* ----------------------------------------------------- partita in corso */
function getMatch(game){ return read(K.match + game, null); }
function setMatch(game, m){ return write(K.match + game, m); }
function clearMatch(game){ try { localStorage.removeItem(K.match + game); } catch(e){} }

/* ------------------------------------------------------- dati e backup */
function exportAll(){
  var data = {app:'dart', version:2, exportedAt:new Date().toISOString(),
              players:players, settings:getSettings(), history:history, matches:{}};
  GAMES.forEach(function(g){
    var m = getMatch(g.id); if(m) data.matches[g.id] = m;
  });
  return data;
}
function importAll(data){
  if(!data || !Array.isArray(data.players) || !Array.isArray(data.history)) throw new Error('formato');
  var known = {}; players.forEach(function(p){ known[p.id] = true; });
  data.players.forEach(function(p){
    if(p && p.id && p.name && !known[p.id]) players.push({id:p.id, name:p.name, createdAt:p.createdAt || Date.now()});
  });
  var seen = {}; history.forEach(function(h){ seen[h.id] = true; });
  data.history.forEach(function(h){
    if(h && h.id && !seen[h.id]){ if(!h.game) h.game = '501'; history.push(h); }
  });
  history.sort(function(a,b){ return (b.endedAt||0) - (a.endedAt||0); });
  write(K.players, players); write(K.history, history);
  if(data.settings) setSettings(data.settings);
  return {players: players.length, history: history.length};
}
/* Salva il backup passando dal sistema operativo:
   1. foglio di condivisione (Android/iOS) -> Drive, OneDrive, Box, File...
   2. finestra "salva con nome" (desktop) -> qualsiasi cartella, anche sincronizzata
   3. download classico, se il dispositivo non offre nessuno dei due.
   Nessun servizio esterno: sono funzioni del browser. */
function backupName(){
  return 'dart-backup-' + new Date().toISOString().slice(0,10) + '.json';
}
function backupBlob(){
  return new Blob([JSON.stringify(exportAll(), null, 2)], {type:'application/json'});
}
function download(blob, name){
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}
function saveBackup(){
  var name = backupName(), blob = backupBlob();

  return Promise.resolve().then(function(){
    if(!navigator.canShare) return null;
    var file;
    try { file = new File([blob], name, {type:'application/json'}); }
    catch(e){ return null; }                       // File non costruibile: si prosegue
    if(!navigator.canShare({files:[file]})) return null;
    return navigator.share({files:[file], title:'Backup Dart'})
      .then(function(){ return 'share'; })
      .catch(function(err){ return (err && err.name === 'AbortError') ? 'abort' : null; });
  }).then(function(res){
    if(res) return res;
    if(!window.showSaveFilePicker) return null;
    return window.showSaveFilePicker({
      suggestedName: name,
      types: [{description:'Backup Dart', accept:{'application/json':['.json']}}]
    }).then(function(handle){
      return handle.createWritable().then(function(w){
        return w.write(blob).then(function(){ return w.close(); });
      }).then(function(){ return 'picker'; });
    }).catch(function(err){ return (err && err.name === 'AbortError') ? 'abort' : null; });
  }).then(function(res){
    if(res) return res;
    download(blob, name);
    return 'download';
  });
}

function wipeAll(){
  Object.keys(K).forEach(function(k){ if(k !== 'match') localStorage.removeItem(K[k]); });
  GAMES.forEach(function(g){ clearMatch(g.id); });
  Object.keys(OLD).forEach(function(k){ localStorage.removeItem(OLD[k]); });
  players = []; history = []; settings = {};
  write(K.players, players); write(K.history, history); write(K.settings, settings);
}

/* -------------------------------------------------------------- utilita' */
function esc(s){
  return String(s).replace(/[&<>"]/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];
  });
}
function fmt(n){ return (Math.round(n*10)/10).toFixed(1); }
function buzz(ms){
  if(getSettings().vibrate && navigator.vibrate) navigator.vibrate(ms || 12);
}
var toastTimer = null;
function toast(msg, bad){
  var el = document.getElementById('toast');
  if(!el){ return; }
  el.textContent = msg;
  el.classList.toggle('bad', !!bad);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2600);
}

/* Alcuni telefoni, con la app installata, dichiarano una finestra piu' alta
   dell'area davvero visibile: l'ultimo bottone finisce sotto la barra dei
   gesti e i tocchi li mangia il sistema. Misuriamo l'altezza vera. */
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

/* Barra di installazione e stato rete, uguale su tutte le pagine.
   Il bottone resta visibile anche quando il browser non offre l'evento di
   installazione: in quel caso spiega come farlo a mano, perche' su iOS non
   esiste alcun invito automatico e su Android a volte non arriva. */
function pwa(opts){
  opts = opts || {};
  var btn  = document.getElementById(opts.installId || 'install');
  var txt  = document.getElementById(opts.stateId || 'stateText');
  var help = document.getElementById(opts.helpId || 'installHelp');
  var asApp = window.matchMedia('(display-mode: standalone)').matches ||
              window.matchMedia('(display-mode: fullscreen)').matches ||
              window.navigator.standalone === true;

  function paint(){
    if(txt){
      txt.textContent = !navigator.onLine
        ? 'Offline — la app funziona comunque'
        : (asApp ? 'Aperta come app' : 'Aperta nel browser');
    }
    if(btn) btn.hidden = asApp;      // dentro la app non c'e' nulla da installare
    if(help && asApp) help.hidden = true;
  }
  window.addEventListener('online', paint);
  window.addEventListener('offline', paint);

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); deferred = e;
    paint();
  });
  if(btn) btn.addEventListener('click', function(){
    if(deferred){
      deferred.prompt();
      deferred.userChoice.then(function(){ deferred = null; paint(); });
      return;
    }
    // nessun invito dal browser: mostro le istruzioni per il dispositivo
    if(help){
      var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      help.hidden = false;
      help.querySelectorAll('[data-os]').forEach(function(el){
        el.hidden = el.dataset.os !== (ios ? 'ios' : 'android');
      });
      help.scrollIntoView({block:'nearest', behavior:'smooth'});
    } else {
      toast('Usa il menu del browser: Installa app', false);
    }
  });
  window.addEventListener('appinstalled', function(){
    deferred = null;
    if(help) help.hidden = true;
    toast('App installata');
    paint();
  });
  paint();

  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register(opts.sw || 'sw.js').catch(function(err){ console.warn('SW:', err); });
    });
  }
}

/* Tiene acceso lo schermo durante una partita, se l'impostazione lo chiede. */
function keepAwake(){
  var lock = null;
  if(!('wakeLock' in navigator) || !getSettings().wakeLock) return function(){};
  function request(){
    navigator.wakeLock.request('screen').then(function(l){
      lock = l; l.addEventListener('release', function(){ lock = null; });
    }).catch(function(){});
  }
  request();
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible' && !lock) request();
  });
  return function(){ if(lock){ lock.release(); lock = null; } };
}

return {
  GAMES: GAMES, DEFAULTS: DEFAULTS, CLOCK_TARGETS: CLOCK_TARGETS,
  clockLabel: clockLabel, clockStats: clockStats,
  getSettings: getSettings, setSettings: setSettings,
  listPlayers: listPlayers, playerById: playerById, playerByName: playerByName,
  addPlayer: addPlayer, renamePlayer: renamePlayer, removePlayer: removePlayer,
  listHistory: listHistory, addHistory: addHistory, aggregate: aggregate,
  getMatch: getMatch, setMatch: setMatch, clearMatch: clearMatch,
  exportAll: exportAll, importAll: importAll, wipeAll: wipeAll,
  saveBackup: saveBackup, backupName: backupName, backupBlob: backupBlob, download: download,
  uid: uid, esc: esc, fmt: fmt, buzz: buzz, toast: toast, pwa: pwa, keepAwake: keepAwake
};
})();
