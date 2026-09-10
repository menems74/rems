/* =========================================================================
   Dart · home: elenco giochi, giocatori, preferenze, statistiche, backup
   ========================================================================= */
(function(){
'use strict';
var D = window.DART;
var $  = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };

function show(view){
  $$('.view').forEach(function(v){ v.classList.toggle('on', v.id === 'v-' + view); });
  if(view === 'home')    renderHome();
  if(view === 'players') renderPlayers();
  if(view === 'prefs')   renderPrefs();
  if(view === 'stats')   renderStats();
  document.querySelector('.view.on').scrollTop = 0;
}

/* ------------------------------------------------------ elenco dei giochi */
function renderHome(){
  var list = $('#gameList');
  list.innerHTML = D.GAMES.map(function(g){
    var m = g.ready ? D.getMatch(g.id) : null;
    var running = m && !m.over;
    var sub = running
      ? 'Partita in corso: ' + D.esc(m.players.map(function(p){ return p.name; }).join(' · '))
      : D.esc(g.desc);
    return '<button class="mbtn game' + (g.ready ? '' : ' soon') + '"' +
      (g.ready ? ' data-game="' + g.id + '"' : ' disabled aria-disabled="true"') + '>' +
      '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round">' + g.icon + '</svg></span>' +
      '<span><b>' + D.esc(g.name) + '</b><small>' + sub + '</small></span>' +
      (g.ready
        ? '<span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>'
        : '<span class="soonlbl">Presto</span>') +
      '</button>';
  }).join('');

  var n = D.listPlayers().length;
  $('#playersSum').textContent = n === 0 ? 'Nessun profilo, aggiungine uno'
    : n + (n === 1 ? ' profilo salvato' : ' profili salvati');

  var s = D.getSettings();
  $('#prefsSum').textContent = 'Al meglio di ' + s.bestOfSets + ' set · ' + s.bestOfLegs + ' leg';

  var h = D.listHistory();
  $('#statsSum').textContent = h.length ? h.length + (h.length === 1 ? ' partita giocata' : ' partite giocate')
                                        : 'Nessuna partita conclusa';
}

/* ------------------------------------------------------------ giocatori */
function renderPlayers(){
  var box = $('#playerRows');
  var list = D.listPlayers();
  if(!list.length){
    box.innerHTML = '<p class="empty">Nessun giocatore salvato.<br>Aggiungi chi gioca abitualmente: i giochi te lo proporranno già pronto.</p>';
    return;
  }
  box.innerHTML = list.map(function(pl){
    var a = D.aggregate(pl.id);
    var meta = a.matches
      ? a.matches + ' partite · media ' + D.fmt(a.avg3) + ' · ' + a.c180 + ' × 180'
      : 'nessuna partita giocata';
    return '<div class="row" data-id="' + pl.id + '">' +
      '<div><div class="nm">' + D.esc(pl.name) + '</div><div class="meta">' + meta + '</div></div>' +
      '<div class="sp">' +
        '<button class="ghost sm" data-act="rename">Rinomina</button>' +
        '<button class="ghost sm danger" data-act="del">Elimina</button>' +
      '</div></div>';
  }).join('');
}

/* ----------------------------------------------------------- preferenze */
function renderPrefs(){
  var s = D.getSettings(), list = D.listPlayers();

  [0,1].forEach(function(i){
    var box = $('#pick' + i);
    if(!list.length){
      box.innerHTML = '<p class="hint" style="margin:0">Aggiungi prima un giocatore.</p>';
      return;
    }
    box.innerHTML = '<button type="button" data-id="" aria-pressed="' + (!s.players[i]) + '">Nessuno</button>' +
      list.map(function(pl){
        return '<button type="button" data-id="' + pl.id + '" aria-pressed="' +
               (s.players[i] === pl.id) + '">' + D.esc(pl.name) + '</button>';
      }).join('');
  });

  $$('#v-prefs [data-pref]').forEach(function(group){
    var key = group.dataset.pref;
    $$('[data-val]', group).forEach(function(){});
    Array.prototype.forEach.call(group.querySelectorAll('button'), function(b){
      b.setAttribute('aria-pressed', String(s[key] === +b.dataset.val));
    });
  });
  $$('#v-prefs [data-pref-toggle]').forEach(function(t){
    t.setAttribute('aria-checked', String(!!s[t.dataset.prefToggle]));
  });
}

/* ---------------------------------------------------------- statistiche */
function renderStats(){
  var box = $('#statsBody'), hist = D.listHistory();
  if(!hist.length){
    box.innerHTML = '<p class="empty">Ancora nessuna partita conclusa.<br>Le statistiche compaiono qui a fine match.</p>';
    return;
  }
  var html = '';
  D.listPlayers().forEach(function(pl){
    var a = D.aggregate(pl.id);
    if(!a.matches) return;
    html += '<p class="lbl" style="margin:16px 0 8px">' + D.esc(pl.name) + '</p><div class="statgrid">' +
      tile('Partite', a.matches + (a.wins ? ' · ' + a.wins + ' vinte' : '')) +
      tile('Media 3 freccette', D.fmt(a.avg3)) +
      tile('Miglior turno', a.bestTurn || '—') +
      tile('Miglior leg', a.bestLeg === null ? '—' : a.bestLeg + ' frecce') +
      tile('Leg vinti', a.legsWon) +
      tile('180', a.c180) +
      '</div>';
  });

  html += '<p class="lbl" style="margin:20px 0 8px">Ultime partite</p><div class="rows">';
  hist.slice(0, 15).forEach(function(h){
    var d = new Date(h.endedAt);
    var names = h.players.map(function(p, i){ return (h.winner === i ? '★ ' : '') + p.name; }).join(' – ');
    var game = (D.GAMES.filter(function(g){ return g.id === h.game; })[0] || {name: h.game || '—'}).name;
    html += '<div class="row"><div><div class="nm">' + D.esc(names) + '</div>' +
      '<div class="meta">' + D.esc(game) + ' · ' + d.toLocaleDateString('it-IT') +
      ' · media ' + h.players.map(function(p){ return D.fmt(p.avg3 || 0); }).join(' / ') +
      '</div></div></div>';
  });
  html += '</div>';
  box.innerHTML = html;
}
function tile(label, value){
  return '<div class="tile"><span class="lbl">' + label + '</span><b>' + value + '</b></div>';
}

/* ---------------------------------------------------------------- dati */
function exportData(){
  var blob = new Blob([JSON.stringify(D.exportAll(), null, 2)], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'dart-dati-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  D.toast('File JSON scaricato');
}
function importData(file){
  var fr = new FileReader();
  fr.onload = function(){
    try {
      var res = D.importAll(JSON.parse(fr.result));
      D.toast('Importati: ' + res.players + ' giocatori, ' + res.history + ' partite');
      renderPlayers(); renderStats();
    } catch(e){ D.toast('File non valido', true); }
  };
  fr.readAsText(file);
}

/* -------------------------------------------------------------- eventi */
$$('[data-go]').forEach(function(b){
  b.addEventListener('click', function(){ show(b.dataset.go); D.buzz(); });
});

$('#gameList').addEventListener('click', function(e){
  var b = e.target.closest('[data-game]');
  if(!b) return;
  var g = D.GAMES.filter(function(x){ return x.id === b.dataset.game; })[0];
  if(g && g.href) location.href = g.href;
});

$('#playerRows').addEventListener('click', function(e){
  var b = e.target.closest('button'); if(!b) return;
  var id = e.target.closest('.row').dataset.id;
  var pl = D.playerById(id); if(!pl) return;
  if(b.dataset.act === 'rename'){
    var name = prompt('Nuovo nome per ' + pl.name, pl.name);
    if(name && name.trim()){ D.renamePlayer(id, name); renderPlayers(); }
  } else if(confirm('Eliminare il profilo di ' + pl.name + '?\nLo storico delle partite resta.')){
    D.removePlayer(id); renderPlayers();
  }
});
$('#addPlayer').addEventListener('click', function(){
  var name = prompt('Nome del giocatore');
  if(!name || !name.trim()) return;
  D.addPlayer(name); renderPlayers(); D.buzz();
});

$$('#v-prefs [data-pref]').forEach(function(group){
  group.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    var patch = {}; patch[group.dataset.pref] = +b.dataset.val;
    D.setSettings(patch); renderPrefs(); D.buzz();
  });
});
$$('#v-prefs [data-pref-toggle]').forEach(function(t){
  t.addEventListener('click', function(){
    var key = t.dataset.prefToggle, patch = {};
    patch[key] = t.getAttribute('aria-checked') !== 'true';
    D.setSettings(patch); renderPrefs();
    if(key !== 'vibrate' || patch[key]) D.buzz();
  });
});
[0,1].forEach(function(i){
  $('#pick' + i).addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    var s = D.getSettings(), sel = s.players.slice();
    sel[i] = b.dataset.id || null;
    if(sel[i] && sel[1-i] === sel[i]) sel[1-i] = null;   // niente stesso profilo due volte
    D.setSettings({players: sel}); renderPrefs(); D.buzz();
  });
});

$('#expBtn').addEventListener('click', exportData);
$('#impFile').addEventListener('change', function(e){
  if(e.target.files[0]) importData(e.target.files[0]);
  e.target.value = '';
});
$('#wipeBtn').addEventListener('click', function(){
  if(!confirm('Cancellare giocatori, impostazioni, storico e partite in corso?\nEsporta prima un backup se ti servono.')) return;
  D.wipeAll(); D.toast('Dati cancellati'); show('home');
});

D.pwa({installId:'install', stateId:'stateText', sw:'sw.js'});

/* i giochi possono aprire direttamente una sezione, es. index.html#stats */
function fromHash(){
  var v = (location.hash || '').replace('#','');
  return document.getElementById('v-' + v) ? v : 'home';
}
window.addEventListener('hashchange', function(){ show(fromHash()); });
show(fromHash());
})();
