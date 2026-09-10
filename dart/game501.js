/* =========================================================================
   Dart · gioco 501
   Le regole e le statistiche del 501. Profili e preferenze arrivano dal
   nucleo condiviso (core.js): qui si sceglie solo chi gioca e la formula.
   ========================================================================= */
(function(){
'use strict';
var D = window.DART, GAME = '501';
var $  = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
var fmt = D.fmt, esc = D.esc;

var match = D.getMatch(GAME);
var input = '';
var releaseWake = null;
var cfg = null;

/* ------------------------------------------------- suggerimento di chiusura */
var DOUBLES = [], SETUPS = [];
(function buildDarts(){
  [20,16,8,4,2,12,10,18,14,6,11,9,7,5,3,1,13,15,17,19].forEach(function(n){
    DOUBLES.push({label:'D'+n, v:2*n});
  });
  DOUBLES.push({label:'BULL', v:50});
  var order = [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1];
  order.forEach(function(n){ SETUPS.push({label:'T'+n, v:3*n}); });
  SETUPS.push({label:'BULL', v:50}); SETUPS.push({label:'25', v:25});
  order.forEach(function(n){ SETUPS.push({label:''+n, v:n}); });
})();
function findDouble(v){
  for(var i=0;i<DOUBLES.length;i++) if(DOUBLES[i].v === v) return DOUBLES[i];
  return null;
}
/* Freccette consigliate, o null se non e' chiudibile in tre (169, 168, 166...). */
function checkout(rem){
  if(rem < 2 || rem > 170) return null;
  var d = findDouble(rem), i, j, rest;
  if(d) return [d.label];
  for(i=0;i<SETUPS.length;i++){
    rest = rem - SETUPS[i].v;
    if(rest < 2) continue;
    d = findDouble(rest);
    if(d) return [SETUPS[i].label, d.label];
  }
  for(i=0;i<SETUPS.length;i++){
    for(j=0;j<SETUPS.length;j++){
      rest = rem - SETUPS[i].v - SETUPS[j].v;
      if(rest < 2) continue;
      d = findDouble(rest);
      if(d) return [SETUPS[i].label, SETUPS[j].label, d.label];
    }
  }
  return null;
}

/* --------------------------------------------------------- regole di gioco */
var START = 501;
var IMPOSSIBLE = [163,166,169,172,173,175,176,178,179];

function bestOfToWin(n, solo){ return solo ? n : Math.ceil(n/2); }

function newMatch(c){
  var solo = c.players.length === 1;
  return {
    id: D.uid(), startedAt: Date.now(), game: GAME, solo: solo,
    players: c.players.slice(),
    bestOfSets: solo ? 1 : c.bestOfSets,
    bestOfLegs: c.bestOfLegs,
    setsToWin: solo ? 1 : bestOfToWin(c.bestOfSets, false),
    legsToWin: bestOfToWin(c.bestOfLegs, solo),
    sets: [0,0], legs: [0,0],
    setNo: 1, legNo: 1,
    starter: c.starter|0, cur: c.starter|0,
    rem: [START, START],
    turns: [], legTurns: [0,0],
    tot: {darts:[0,0], points:[0,0], bestTurn:[0,0], c180:[0,0],
          bestLeg:[null,null], f9p:[0,0], f9d:[0,0], legsWon:[0,0], busts:[0,0]},
    pending: null, over: false, winner: null
  };
}
function avg3(m, p){ return m.tot.darts[p] ? (m.tot.points[p] / m.tot.darts[p] * 3) : 0; }
function first9(m, p){ return m.tot.f9d[p] ? (m.tot.f9p[p] / m.tot.f9d[p] * 3) : 0; }
function lastTurnOf(m, p){
  for(var i=m.turns.length-1;i>=0;i--) if(m.turns[i].p === p) return m.turns[i];
  return null;
}
function validScore(n){
  return Number.isInteger(n) && n >= 0 && n <= 180 && IMPOSSIBLE.indexOf(n) < 0;
}

/* Applica il turno: 'ok' | 'bust' | 'checkout'. */
function applyTurn(m, score){
  var p = m.cur, rem = m.rem[p];
  var bust = score > rem || (rem - score) === 1;
  var isFirst9 = m.legTurns[p] < 3;
  var rec = {p:p, score:score, darts:3, bust:bust, remBefore:rem,
             f9p:0, f9d:0, prevBest:m.tot.bestTurn[p], prev180:m.tot.c180[p]};

  if(bust){
    m.tot.busts[p]++;
    m.tot.darts[p] += 3;
    if(isFirst9){ rec.f9d = 3; m.tot.f9d[p] += 3; }
  } else {
    m.rem[p] = rem - score;
    m.tot.points[p] += score;
    m.tot.darts[p] += 3;
    if(score > m.tot.bestTurn[p]) m.tot.bestTurn[p] = score;
    if(score === 180) m.tot.c180[p]++;
    if(isFirst9){ rec.f9p = score; rec.f9d = 3; m.tot.f9p[p] += score; m.tot.f9d[p] += 3; }
  }
  m.legTurns[p]++;
  m.turns.push(rec);

  if(!bust && m.rem[p] === 0){ m.pending = {p:p, rec:rec}; return 'checkout'; }
  if(m.players.length === 2) m.cur = 1 - m.cur;
  return bust ? 'bust' : 'ok';
}

/* Chiude il leg quando il giocatore dichiara le freccette usate (1-3). */
function closeLeg(m, dartsUsed){
  var pen = m.pending, p = pen.p, rec = pen.rec;
  var delta = dartsUsed - rec.darts;
  rec.darts = dartsUsed;
  m.tot.darts[p] += delta;
  if(rec.f9d){ rec.f9d += delta; m.tot.f9d[p] += delta; }

  var legDarts = 0;
  m.turns.forEach(function(t){ if(t.p === p) legDarts += t.darts; });
  if(m.tot.bestLeg[p] === null || legDarts < m.tot.bestLeg[p]) m.tot.bestLeg[p] = legDarts;

  m.tot.legsWon[p]++;
  m.legs[p]++;
  m.pending = null;

  var res = {p:p, legDarts:legDarts, checkoutDarts:dartsUsed, setWon:false, matchWon:false};
  if(m.legs[p] >= m.legsToWin){
    m.sets[p]++; res.setWon = true; m.legs = [0,0];
    if(m.sets[p] >= m.setsToWin){ m.over = true; m.winner = p; res.matchWon = true; }
    else { m.setNo++; m.legNo = 1; }
  } else {
    m.legNo++;
  }
  return res;
}
function nextLeg(m){
  m.rem = [START, START];
  m.turns = []; m.legTurns = [0,0];
  m.starter = m.players.length === 2 ? 1 - m.starter : 0;
  m.cur = m.starter;
}
function undo(m){
  if(m.pending){ var pen = m.pending; m.pending = null; m.cur = pen.p; }
  var rec = m.turns.pop();
  if(!rec) return false;
  var p = rec.p;
  m.rem[p] = rec.remBefore;
  m.tot.darts[p] -= rec.darts;
  if(!rec.bust) m.tot.points[p] -= rec.score; else m.tot.busts[p]--;
  m.tot.f9p[p] -= rec.f9p; m.tot.f9d[p] -= rec.f9d;
  m.tot.bestTurn[p] = rec.prevBest;
  m.tot.c180[p] = rec.prev180;
  m.legTurns[p]--;
  m.cur = p;
  return true;
}
function archive(m){
  D.addHistory({
    id: m.id, game: GAME, startedAt: m.startedAt, endedAt: Date.now(),
    solo: m.solo, bestOfSets: m.bestOfSets, bestOfLegs: m.bestOfLegs,
    sets: m.sets.slice(), winner: m.winner,
    players: m.players.map(function(pl, i){
      return {id: pl.id || null, name: pl.name,
        darts: m.tot.darts[i], points: m.tot.points[i],
        avg3: +avg3(m, i).toFixed(2), first9: +first9(m, i).toFixed(2),
        bestTurn: m.tot.bestTurn[i], bestLeg: m.tot.bestLeg[i],
        c180: m.tot.c180[i], legsWon: m.tot.legsWon[i], setsWon: m.sets[i],
        busts: m.tot.busts[i]};
    })
  });
}

/* ===================================================================== UI */
function show(view){
  $$('.view').forEach(function(v){ v.classList.toggle('on', v.id === 'v-' + view); });
  if(view === 'setup'){
    if(releaseWake){ releaseWake(); releaseWake = null; }
    renderSetup();
  }
  if(view === 'game'){
    releaseWake = D.keepAwake();
    renderGame();
  }
}

/* ------------------------------------------------ schermata di partenza */
function initCfg(){
  var s = D.getSettings(), list = D.listPlayers();
  var sel = s.players.slice();
  // se un profilo predefinito non esiste piu', ripiego sul primo disponibile
  sel = sel.map(function(id){ return D.playerById(id) ? id : null; });
  if(!sel[0] && list[0]) sel[0] = list[0].id;
  if(!sel[1] && list[1] && list[1].id !== sel[0]) sel[1] = list[1].id;
  cfg = {count: 2, sel: sel, bestOfSets: s.bestOfSets, bestOfLegs: s.bestOfLegs, starter: s.starter};
}

function renderSetup(){
  var list = D.listPlayers(), solo = cfg.count === 1;

  var r = $('#resume');
  if(match && !match.over){
    r.hidden = false;
    r.querySelector('small').textContent =
      match.players.map(function(p){ return p.name; }).join(' · ') +
      ' — set ' + match.sets.join('-') + ', leg ' + match.legs.join('-');
  } else { r.hidden = true; }

  $('#slot2').hidden = solo;
  $('#setsBox').hidden = solo;
  $('#starterBox').hidden = solo;
  $('#legsLabel').textContent = solo ? 'Leg da giocare' : 'Al meglio di (leg)';
  $('#noPlayers').hidden = list.length >= (solo ? 1 : 2);

  [0,1].forEach(function(i){
    var box = $('#pick' + i);
    box.innerHTML = list.map(function(pl){
      var taken = cfg.sel[1-i] === pl.id;
      return '<button type="button" data-id="' + pl.id + '"' + (taken ? ' disabled' : '') +
             ' aria-pressed="' + (cfg.sel[i] === pl.id) + '">' + esc(pl.name) + '</button>';
    }).join('');
    box.hidden = list.length === 0;
  });

  $$('#v-setup [data-cfg]').forEach(function(group){
    var key = group.dataset.cfg;
    Array.prototype.forEach.call(group.querySelectorAll('button'), function(b){
      b.setAttribute('aria-pressed', String(cfg[key] === +b.dataset.val));
    });
  });
  [0,1].forEach(function(i){
    var pl = D.playerById(cfg.sel[i]);
    $('#starter' + i).textContent = pl ? pl.name : 'Giocatore ' + (i+1);
  });
  $('#setupErr').textContent = '';
}

function startMatch(){
  var need = cfg.count === 1 ? 1 : 2, chosen = [];
  for(var i=0;i<need;i++){
    var pl = D.playerById(cfg.sel[i]);
    if(!pl){ $('#setupErr').textContent = 'Scegli il giocatore ' + (i+1) + '.'; return; }
    chosen.push({id: pl.id, name: pl.name});
  }
  match = newMatch({players: chosen, bestOfSets: cfg.bestOfSets,
                    bestOfLegs: cfg.bestOfLegs, starter: need === 2 ? cfg.starter : 0});
  D.setMatch(GAME, match);
  input = '';
  show('game');
}

/* ------------------------------------------------------------- partita */
function renderGame(){
  if(!match){ show('setup'); return; }
  var m = match, p = m.cur, opp = m.players.length === 2 ? 1 - p : null;

  $('#gSets').textContent = m.sets[0] + ' - ' + m.sets[1];
  $('#gLegs').textContent = m.legs[0] + ' - ' + m.legs[1];
  $('#gSetsBox').hidden = m.solo;

  var rival = $('#rival');
  if(opp === null){ rival.hidden = true; }
  else {
    rival.hidden = false;
    $('#rName').textContent = m.players[opp].name;
    $('#rRem').textContent = m.rem[opp];
    $('#rAvg').textContent = 'media ' + fmt(avg3(m, opp)) + ' · ' + m.tot.darts[opp] + ' frecce';
  }

  $('#pName').textContent = m.players[p].name;
  $('#pRem').textContent = m.rem[p];
  $('#pAvg').textContent = fmt(avg3(m, p));
  $('#pDarts').textContent = m.tot.darts[p];
  var lt = lastTurnOf(m, p);
  $('#pLast').textContent = lt ? (lt.bust ? 'sballo' : lt.score) : '—';

  var box = $('#co');
  if(!D.getSettings().checkout){
    box.classList.add('none'); box.innerHTML = '';
  } else if(m.rem[p] <= 170 && m.rem[p] >= 2){
    var co = checkout(m.rem[p]);
    box.classList.remove('none');
    box.innerHTML = '<span class="lbl">Chiusura</span>' + (co
      ? co.map(function(c){ return '<span class="c">' + c + '</span>'; }).join('')
      : '<span class="lbl" style="color:var(--muted)">non chiudibile in 3 freccette</span>');
  } else {
    box.classList.add('none');
    box.innerHTML = '<span class="lbl" style="color:var(--muted)">Chiusura consigliata sotto i 170</span>';
  }

  paintInput();
  $('#undoBtn').disabled = m.turns.length === 0;
}

function paintInput(){
  var m = match, val = $('#liveVal'), warn = $('#liveWarn');
  val.textContent = input === '' ? '0' : input;
  val.classList.toggle('empty', input === '');
  var n = input === '' ? -1 : parseInt(input, 10);
  var ok = validScore(n);
  $('#enterBtn').disabled = !ok;

  var msg = '';
  if(input !== ''){
    if(!ok) msg = n > 180 ? 'oltre 180' : 'punteggio impossibile';
    else {
      var rem = m.rem[m.cur];
      if(n > rem || (rem - n) === 1) msg = 'sballo';
      else if(rem - n === 0) msg = 'chiusura';
    }
  }
  warn.textContent = msg;
  warn.style.color = (msg === 'chiusura') ? 'var(--neon)' : 'var(--bust)';

  // il bottone spiega da solo perche' non accetta: prima taceva e basta
  var btn = $('#enterBtn'), label = $('#enterLabel'), icon = $('#enterIcon');
  var bad = input !== '' && !ok;
  btn.classList.toggle('bad', bad);
  icon.hidden = bad;
  label.textContent = bad
    ? (n > 180 ? 'Oltre 180 punti' : 'Punteggio impossibile')
    : 'Conferma turno';
}

function pressDigit(d){
  if(match.pending || input.length >= 3) return;
  input = (input === '0' ? '' : input) + d;
  paintInput(); D.buzz();
}
function pressDel(){ input = input.slice(0, -1); paintInput(); D.buzz(); }
function pressUndo(){
  if(!match || !undo(match)){ D.toast('Niente da annullare'); return; }
  input = ''; hideSheets(); D.setMatch(GAME, match); renderGame(); D.buzz(20);
}
function pressEnter(){
  var n = parseInt(input, 10);
  if(!validScore(n)) return;
  var hero = $('#hero');
  var res = applyTurn(match, n);
  input = '';
  D.setMatch(GAME, match);

  if(res === 'checkout'){
    renderGame();
    hero.classList.add('won');
    $('#pRem').textContent = '0';
    openSheet('#askSheet');
    D.buzz(30);
    return;
  }
  if(res === 'bust'){
    renderGame();
    hero.classList.add('bust');
    if(D.getSettings().vibrate && navigator.vibrate) navigator.vibrate([40,60,40]);
    setTimeout(function(){ hero.classList.remove('bust'); }, 1700);
    return;
  }
  renderGame();
  flash(hero);
  D.buzz();
}

/* segnale visivo che il turno e' entrato davvero */
function flash(el){
  el.classList.remove('ok');
  void el.offsetWidth;          // riavvia l'animazione
  el.classList.add('ok');
  setTimeout(function(){ el.classList.remove('ok'); }, 600);
}

function openSheet(sel){ $('#backdrop').classList.add('show'); $(sel).classList.add('show'); }
function hideSheets(){
  $('#backdrop').classList.remove('show');
  $$('.sheet').forEach(function(s){ s.classList.remove('show'); });
  $('#hero').classList.remove('won','bust');
}

function answerDarts(nDarts){
  if(!match || !match.pending) return;
  var res = closeLeg(match, nDarts);
  if(res.matchWon){ archive(match); D.clearMatch(GAME); }
  else { D.setMatch(GAME, match); }
  hideSheets();
  buildResultSheet(res);
  openSheet('#legSheet');
  D.buzz(30);
}

function buildResultSheet(res){
  var m = match, w = res.p, two = m.players.length === 2;
  var title = res.matchWon ? 'Match vinto da' : (res.setWon ? 'Set vinto da' : 'Leg vinto da');
  $('#legTitle').innerHTML = title + ' <em>' + esc(m.players[w].name) + '</em>';
  $('#legMeta').textContent = 'SET ' + m.sets.join('-') + (res.matchWon ? '' : ' · LEG ' + m.legs.join('-'));

  var rows = [
    ['Freccette leg', res.legDarts, two ? dartsInLeg(m, 1-w) : null, 'low'],
    ['Media 3', fmt(avg3(m, w)), two ? fmt(avg3(m, 1-w)) : null, 'high'],
    ['First 9', fmt(first9(m, w)), two ? fmt(first9(m, 1-w)) : null, 'high'],
    ['Miglior turno', m.tot.bestTurn[w], two ? m.tot.bestTurn[1-w] : null, 'high'],
    ['180', m.tot.c180[w], two ? m.tot.c180[1-w] : null, 'high'],
    ['Sballi', m.tot.busts[w], two ? m.tot.busts[1-w] : null, 'low']
  ];
  var html = '<span class="h">' + esc(m.players[w].name) + '</span><span class="lbl"></span>' +
             '<span class="h r">' + (two ? esc(m.players[1-w].name) : '') + '</span>';
  rows.forEach(function(r){
    var a = r[1], b = r[2], better = false;
    if(b !== null){
      var na = parseFloat(a), nb = parseFloat(b);
      better = r[3] === 'high' ? na > nb : na < nb;
    }
    html += '<span class="v' + (better ? ' best' : '') + '">' + a + '</span>' +
            '<span class="lbl">' + r[0] + '</span>' +
            '<span class="v r">' + (b === null ? '—' : b) + '</span>';
  });
  $('#cmp').innerHTML = html;

  $('#legNext').textContent = res.matchWon ? 'Nuova partita' : 'Prossimo leg';
  $('#legNext').dataset.end = res.matchWon ? '1' : '';
}
function dartsInLeg(m, p){
  var n = 0; m.turns.forEach(function(t){ if(t.p === p) n += t.darts; });
  return n;
}

/* -------------------------------------------------------------- eventi */
$('#resumeBtn').addEventListener('click', function(){ input = ''; show('game'); });
$('#resumeDel').addEventListener('click', function(){
  if(!match) return;
  var who = match.players.map(function(p){ return p.name; }).join(' · ');
  if(!confirm('Eliminare la partita in corso di ' + who + '?\nI punteggi di questo match vanno persi.')) return;
  D.clearMatch(GAME);
  match = null;
  renderSetup();
  D.toast('Partita eliminata');
});

$$('#v-setup [data-cfg]').forEach(function(group){
  group.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    cfg[group.dataset.cfg] = +b.dataset.val;
    renderSetup(); D.buzz();
  });
});
[0,1].forEach(function(i){
  $('#pick' + i).addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b || b.disabled) return;
    cfg.sel[i] = b.dataset.id;
    renderSetup(); D.buzz();
  });
});
$('#startBtn').addEventListener('click', startMatch);

$$('#pad .k[data-d]').forEach(function(k){
  k.addEventListener('click', function(){ pressDigit(k.dataset.d); });
});
$('#delBtn').addEventListener('click', pressDel);
$('#undoBtn').addEventListener('click', pressUndo);
$('#undoBtn2').addEventListener('click', pressUndo);
$('#enterBtn').addEventListener('click', pressEnter);
document.addEventListener('keydown', function(e){
  if(!$('#v-game').classList.contains('on')) return;
  if(e.key >= '0' && e.key <= '9') pressDigit(e.key);
  else if(e.key === 'Backspace') pressDel();
  else if(e.key === 'Enter' && !$('#enterBtn').disabled) pressEnter();
});

$$('#askSheet .asks button').forEach(function(b){
  b.addEventListener('click', function(){ answerDarts(+b.dataset.n); });
});
$('#askUndo').addEventListener('click', pressUndo);
$('#legNext').addEventListener('click', function(){
  if($('#legNext').dataset.end){
    match = null; hideSheets(); initCfg(); show('setup');
  } else {
    nextLeg(match); D.setMatch(GAME, match); input = ''; hideSheets(); renderGame();
  }
});
$('#legStats').addEventListener('click', function(){ location.href = 'index.html#stats'; });
$('#gExit').addEventListener('click', function(){
  if(match && !match.over){ D.setMatch(GAME, match); D.toast('Partita salvata, la riprendi da qui'); }
  show('setup');
});
$('#backdrop').addEventListener('click', function(){
  if($('#askSheet').classList.contains('show')) return;   // serve una risposta
  hideSheets();
});

/* -------------------------------------------------------------- avvio */
D.pwa({sw:'sw.js', installId:'__none', stateId:'__none'});
initCfg();
show('setup');

window.D501 = {checkout: checkout, validScore: validScore, state: function(){ return match; }};
})();
