/* =========================================================================
   Dart · Around the Clock
   Dall'1 al 20 e poi il bull, a bersagli singoli o doppi. Si gioca uno
   alla volta: per ogni bersaglio si dichiara con quante freccette lo si e'
   colpito. Profili e preferenze arrivano dal nucleo condiviso.
   ========================================================================= */
(function(){
'use strict';
var D = window.DART, GAME = 'clock';
var $  = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
var TARGETS = D.CLOCK_TARGETS;

var match = D.getMatch(GAME);
var cfg = null;
var moreBuf = '';
var releaseWake = null;

/* -------------------------------------------------------------- partita */
function newMatch(c){
  return {
    id: D.uid(), game: GAME, startedAt: Date.now(),
    mode: c.mode,                       // 'singoli' | 'doppi'
    player: {id: c.player.id, name: c.player.name},
    idx: 0,                             // bersaglio corrente
    perTarget: {},                      // chiave bersaglio -> freccette usate
    order: [],                          // ordine di inserimento, per l'undo
    over: false
  };
}
function total(m){
  return m.order.reduce(function(sum, k){ return sum + m.perTarget[k]; }, 0);
}
function currentKey(m){ return m.idx < TARGETS.length ? TARGETS[m.idx].key : null; }

function hit(m, darts){
  var key = currentKey(m);
  if(key === null) return false;
  m.perTarget[key] = darts;
  m.order.push(key);
  m.idx++;
  if(m.idx >= TARGETS.length) m.over = true;
  return true;
}
function undo(m){
  var key = m.order.pop();
  if(key === undefined) return false;
  delete m.perTarget[key];
  m.idx = TARGETS.map(function(t){ return t.key; }).indexOf(key);
  m.over = false;
  return true;
}
function archive(m){
  var t = total(m);
  D.addHistory({
    id: m.id, game: GAME, mode: m.mode,
    startedAt: m.startedAt, endedAt: Date.now(), winner: 0,
    players: [{
      id: m.player.id, name: m.player.name,
      total: t, darts: t, perTarget: JSON.parse(JSON.stringify(m.perTarget))
    }]
  });
}

/* ===================================================================== UI */
function show(view){
  $$('.view').forEach(function(v){ v.classList.toggle('on', v.id === 'v-' + view); });
  if(view === 'setup'){
    if(releaseWake){ releaseWake(); releaseWake = null; }
    renderSetup();
  } else {
    releaseWake = D.keepAwake();
    renderGame();
  }
}

/* --------------------------------------------------- schermata iniziale */
function initCfg(){
  var s = D.getSettings(), list = D.listPlayers();
  var id = D.playerById(s.players[0]) ? s.players[0] : (list[0] ? list[0].id : null);
  cfg = {player: id, mode: s.clockMode === 'doppi' ? 'doppi' : 'singoli'};
}
function renderSetup(){
  var list = D.listPlayers();

  var r = $('#resume');
  if(match && !match.over){
    r.hidden = false;
    r.querySelector('small').textContent = match.player.name + ' · ' + match.mode +
      ' — arrivato a ' + D.clockLabel(currentKey(match), match.mode) +
      ', ' + total(match) + ' freccette';
  } else { r.hidden = true; }

  $('#noPlayers').hidden = list.length > 0;
  var box = $('#pick0');
  box.innerHTML = list.map(function(pl){
    return '<button type="button" data-id="' + pl.id + '" aria-pressed="' +
           (cfg.player === pl.id) + '">' + D.esc(pl.name) + '</button>';
  }).join('');
  box.hidden = list.length === 0;

  Array.prototype.forEach.call($('[data-cfg="mode"]').querySelectorAll('button'), function(b){
    b.setAttribute('aria-pressed', String(cfg.mode === b.dataset.val));
  });
  $('#modeHint').textContent = cfg.mode === 'doppi'
    ? 'Vale solo il doppio del numero; sul bull vale il centro rosso.'
    : 'Vale qualsiasi settore del numero: singolo, doppio o triplo.';
  $('#setupErr').textContent = '';
}
function startMatch(){
  var pl = D.playerById(cfg.player);
  if(!pl){ $('#setupErr').textContent = 'Scegli il giocatore.'; return; }
  D.setSettings({clockMode: cfg.mode});
  match = newMatch({player: pl, mode: cfg.mode});
  D.setMatch(GAME, match);
  show('game');
}

/* ------------------------------------------------------------- partita */
function renderGame(){
  if(!match){ show('setup'); return; }
  var m = match;

  $('#gWho').textContent = m.player.name;
  $('#gMode').textContent = m.mode === 'doppi' ? 'Doppi' : 'Singoli';

  $('#track').innerHTML = TARGETS.map(function(t, i){
    var cls = m.perTarget[t.key] !== undefined ? 'done' : (i === m.idx ? 'now' : '');
    return '<i class="' + cls + '"></i>';
  }).join('');

  var key = currentKey(m);
  if(key === null) return;                     // giro finito, resta il pannello
  $('#gPos').textContent = (m.idx + 1) + ' di ' + TARGETS.length;
  $('#target').textContent = D.clockLabel(key, m.mode);
  $('#tsub').textContent = key === 'bull'
    ? (m.mode === 'doppi' ? 'Colpisci il centro rosso' : 'Colpisci il bull, verde o rosso')
    : (m.mode === 'doppi' ? 'Colpisci il doppio ' + key : 'Colpisci un ' + key + ' qualsiasi');

  $('#sTot').textContent = total(m);

  var st = D.clockStats(m.player.id, m.mode);
  var rec = st.targets.filter(function(x){ return x.key === key; })[0];
  $('#sRec').textContent = (rec && rec.stats) ? rec.stats.min : '—';
  $('#sBest').textContent = st.total ? st.total.min : '—';

  $('#undoBtn').disabled = m.order.length === 0;
}

function count(n){
  if(!match || match.over) return;
  if(!(n >= 1 && n <= 99)) return;
  hit(match, n);
  D.buzz();
  if(match.over){
    archive(match);
    D.clearMatch(GAME);
    renderGame();
    buildEnd();
    openSheet('#endSheet');
    D.buzz(30);
  } else {
    D.setMatch(GAME, match);
    renderGame();
  }
}

/* pannello "di piu'" con la tastiera numerica */
function paintMore(){
  var v = $('#moreVal');
  v.textContent = moreBuf === '' ? '0' : moreBuf;
  v.classList.toggle('empty', moreBuf === '');
  var n = parseInt(moreBuf || '0', 10);
  $('#moreOk').disabled = !(n >= 1 && n <= 99);
}
function openMore(){ moreBuf = ''; paintMore(); openSheet('#moreSheet'); }

function openSheet(sel){ $('#backdrop').classList.add('show'); $(sel).classList.add('show'); }
function hideSheets(){
  $('#backdrop').classList.remove('show');
  $$('.sheet').forEach(function(s){ s.classList.remove('show'); });
}

/* ---------------------------------------------------- fine del giro */
function buildEnd(){
  var m = match, t = total(m);
  var st = D.clockStats(m.player.id, m.mode);   // include la partita appena archiviata

  var worst = null, best = null;
  Object.keys(m.perTarget).forEach(function(k){
    var v = m.perTarget[k];
    if(best === null || v < m.perTarget[best]) best = k;
    if(worst === null || v > m.perTarget[worst]) worst = k;
  });

  $('#endTitle').innerHTML = 'Giro completato in <em>' + t + '</em> freccette';
  $('#endMeta').textContent = m.player.name + ' · bersagli ' +
    (m.mode === 'doppi' ? 'doppi' : 'singoli') + ' · ' + st.games +
    (st.games === 1 ? ' partita giocata' : ' partite giocate');

  var media = t / TARGETS.length;
  var rows = [
    ['Media per bersaglio', D.fmt(media)],
    ['Miglior bersaglio', D.clockLabel(best, m.mode) + ' · ' + m.perTarget[best]],
    ['Più difficile', D.clockLabel(worst, m.mode) + ' · ' + m.perTarget[worst]],
    ['Tuo record', st.total ? st.total.min + ' freccette' : '—'],
    ['Media dei giri', st.total ? D.fmt(st.total.avg) : '—'],
    ['Giro peggiore', st.total ? st.total.max + ' freccette' : '—']
  ];
  $('#endCmp').className = 'statgrid';
  $('#endCmp').innerHTML = rows.map(function(r){
    return '<div class="tile"><span class="lbl">' + r[0] + '</span><b>' + r[1] + '</b></div>';
  }).join('');
}

/* -------------------------------------------------------------- eventi */
$('#resumeBtn').addEventListener('click', function(){ show('game'); });
$('#resumeDel').addEventListener('click', function(){
  if(!match) return;
  if(!confirm('Eliminare il giro in corso di ' + match.player.name + '?')) return;
  D.clearMatch(GAME); match = null; renderSetup(); D.toast('Partita eliminata');
});
$('#pick0').addEventListener('click', function(e){
  var b = e.target.closest('button'); if(!b) return;
  cfg.player = b.dataset.id; renderSetup(); D.buzz();
});
$('[data-cfg="mode"]').addEventListener('click', function(e){
  var b = e.target.closest('button'); if(!b) return;
  cfg.mode = b.dataset.val; renderSetup(); D.buzz();
});
$('#startBtn').addEventListener('click', startMatch);

$$('#quick .k').forEach(function(b){
  b.addEventListener('click', function(){ count(+b.dataset.n); });
});
$('#moreBtn').addEventListener('click', openMore);
$$('#morePad .k[data-d]').forEach(function(b){
  b.addEventListener('click', function(){
    if(moreBuf.length >= 2) return;
    moreBuf = (moreBuf === '0' ? '' : moreBuf) + b.dataset.d;
    paintMore(); D.buzz();
  });
});
$('#moreDel').addEventListener('click', function(){ moreBuf = moreBuf.slice(0,-1); paintMore(); D.buzz(); });
$('#moreCancel').addEventListener('click', function(){ hideSheets(); });
$('#moreOk').addEventListener('click', function(){
  var n = parseInt(moreBuf, 10);
  hideSheets();
  count(n);
});

$('#undoBtn').addEventListener('click', function(){
  if(!match || !undo(match)){ D.toast('Niente da annullare'); return; }
  D.setMatch(GAME, match); hideSheets(); renderGame(); D.buzz(20);
});
$('#gExit').addEventListener('click', function(){
  if(match && !match.over){ D.setMatch(GAME, match); D.toast('Giro salvato, lo riprendi da qui'); }
  show('setup');
});
$('#endStats').addEventListener('click', function(){ location.href = 'index.html#stats'; });
$('#endAgain').addEventListener('click', function(){
  match = null; hideSheets(); initCfg(); show('setup');
});
$('#backdrop').addEventListener('click', function(){
  if($('#endSheet').classList.contains('show')) return;   // si chiude dai bottoni
  hideSheets();
});
document.addEventListener('keydown', function(e){
  if(!$('#v-game').classList.contains('on')) return;
  if(e.key >= '1' && e.key <= '9' && !$('#moreSheet').classList.contains('show')) count(+e.key);
});

/* -------------------------------------------------------------- avvio */
initCfg();
D.pwa({sw:'sw.js', installId:'__none', stateId:'__none'});
show(match && !match.over ? 'setup' : 'setup');
window.DCLOCK = {state: function(){ return match; }, total: total};
})();
