/* =========================================================================
   501 · motore di gioco e interfaccia
   Modalita' di inserimento: somma delle 3 freccette (punteggio totale).
   Tutti i dati restano sul dispositivo (localStorage).
   ========================================================================= */
(function(){
'use strict';

/* ---------------------------------------------------------------- archivio */
var K = {players:'d501.players', match:'d501.match', history:'d501.history'};

function load(key, fallback){
  try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch(e){ return fallback; }
}
function save(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch(e){ toast('Spazio esaurito: impossibile salvare', true); return false; }
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

var players = load(K.players, []);
var history = load(K.history, []);
var match   = load(K.match, null);

/* ------------------------------------------------- suggerimento di chiusura */
var DOUBLES = [], SETUPS = [];
(function buildDarts(){
  var dOrder = [20,16,8,4,2,12,10,18,14,6,11,9,7,5,3,1,13,15,17,19];
  dOrder.forEach(function(n){ DOUBLES.push({label:'D'+n, v:2*n}); });
  DOUBLES.push({label:'BULL', v:50});
  // freccette di preparazione, dalle piu' usate alle meno usate
  [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1].forEach(function(n){ SETUPS.push({label:'T'+n, v:3*n}); });
  SETUPS.push({label:'BULL', v:50}); SETUPS.push({label:'25', v:25});
  [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1].forEach(function(n){ SETUPS.push({label:''+n, v:n}); });
})();
function findDouble(v){
  for(var i=0;i<DOUBLES.length;i++) if(DOUBLES[i].v === v) return DOUBLES[i];
  return null;
}
/* Restituisce l'elenco delle freccette consigliate, oppure null se il
   punteggio non e' chiudibile in 3 freccette (169, 168, 166, 165, 163, 162, 159). */
function checkout(rem){
  if(rem < 2 || rem > 170) return null;
  var d = findDouble(rem);
  if(d) return [d.label];
  var i, j, rest;
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

function newMatch(cfg){
  var solo = cfg.players.length === 1;
  return {
    id: uid(), startedAt: Date.now(), solo: solo,
    players: cfg.players.slice(),
    bestOfSets: solo ? 1 : cfg.bestOfSets,
    bestOfLegs: cfg.bestOfLegs,
    setsToWin: solo ? 1 : bestOfToWin(cfg.bestOfSets, false),
    legsToWin: bestOfToWin(cfg.bestOfLegs, solo),
    sets: [0,0], legs: [0,0],
    setNo: 1, legNo: 1,
    starter: cfg.starter|0, cur: cfg.starter|0,
    rem: [START, START],
    turns: [],                       // turni del leg in corso (per l'undo)
    legTurns: [0,0],                 // turni giocati nel leg, per la First 9
    tot: {
      darts:[0,0], points:[0,0], bestTurn:[0,0], c180:[0,0],
      bestLeg:[null,null], f9p:[0,0], f9d:[0,0], legsWon:[0,0], busts:[0,0]
    },
    pending: null,                   // chiusura in attesa del numero di freccette
    over: false, winner: null
  };
}

function avg3(m, p){
  return m.tot.darts[p] ? (m.tot.points[p] / m.tot.darts[p] * 3) : 0;
}
function first9(m, p){
  return m.tot.f9d[p] ? (m.tot.f9p[p] / m.tot.f9d[p] * 3) : 0;
}
function lastTurnOf(m, p){
  for(var i=m.turns.length-1;i>=0;i--) if(m.turns[i].p === p) return m.turns[i];
  return null;
}
function validScore(n){
  return Number.isInteger(n) && n >= 0 && n <= 180 && IMPOSSIBLE.indexOf(n) < 0;
}

/* Applica il turno. Ritorna 'ok' | 'bust' | 'checkout'. */
function applyTurn(m, score){
  var p = m.cur, rem = m.rem[p];
  var bust = score > rem || (rem - score) === 1;
  var isFirst9 = m.legTurns[p] < 3;
  var darts = 3;
  var rec = {
    p: p, score: score, darts: darts, bust: bust, remBefore: rem,
    f9p: 0, f9d: 0, prevBest: m.tot.bestTurn[p], prev180: m.tot.c180[p]
  };

  if(bust){
    m.tot.busts[p]++;
    m.tot.darts[p] += darts;
    if(isFirst9){ rec.f9d = darts; m.tot.f9d[p] += darts; }
  } else {
    m.rem[p] = rem - score;
    m.tot.points[p] += score;
    m.tot.darts[p] += darts;
    if(score > m.tot.bestTurn[p]) m.tot.bestTurn[p] = score;
    if(score === 180) m.tot.c180[p]++;
    if(isFirst9){ rec.f9p = score; rec.f9d = darts; m.tot.f9p[p] += score; m.tot.f9d[p] += darts; }
  }

  m.legTurns[p]++;
  m.turns.push(rec);

  if(!bust && m.rem[p] === 0){
    // il numero di freccette del turno di chiusura lo dichiara il giocatore
    m.pending = {p: p, rec: rec};
    return 'checkout';
  }
  nextPlayer(m);
  return bust ? 'bust' : 'ok';
}

function nextPlayer(m){
  if(m.players.length === 2) m.cur = 1 - m.cur;
}

/* Chiude il leg dopo che l'utente ha dichiarato le freccette usate (1-3). */
function closeLeg(m, dartsUsed){
  var pen = m.pending, p = pen.p, rec = pen.rec;
  var delta = dartsUsed - rec.darts;          // rettifica: erano stati contati 3
  rec.darts = dartsUsed;
  m.tot.darts[p] += delta;
  if(rec.f9d){ rec.f9d += delta; m.tot.f9d[p] += delta; }

  var legDarts = 0;
  m.turns.forEach(function(t){ if(t.p === p) legDarts += t.darts; });
  if(m.tot.bestLeg[p] === null || legDarts < m.tot.bestLeg[p]) m.tot.bestLeg[p] = legDarts;

  m.tot.legsWon[p]++;
  m.legs[p]++;
  m.pending = null;

  var res = {p: p, legDarts: legDarts, checkoutDarts: dartsUsed, setWon: false, matchWon: false};
  if(m.legs[p] >= m.legsToWin){
    m.sets[p]++; res.setWon = true;
    m.legs = [0,0];
    if(m.sets[p] >= m.setsToWin){ m.over = true; m.winner = p; res.matchWon = true; }
    else { m.setNo++; m.legNo = 1; }
  } else {
    m.legNo++;
  }
  return res;
}

/* Prepara il leg successivo: punteggi a 501 e partenza alternata. */
function nextLeg(m){
  m.rem = [START, START];
  m.turns = []; m.legTurns = [0,0];
  m.starter = m.players.length === 2 ? 1 - m.starter : 0;
  m.cur = m.starter;
}

/* Annulla l'ultimo turno del leg in corso. */
function undo(m){
  if(m.pending){                              // annulla la domanda sulle freccette
    var pen = m.pending; m.pending = null;
    m.cur = pen.p;
  }
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

/* --------------------------------------------------------- fine partita */
function archive(m){
  var entry = {
    id: m.id, startedAt: m.startedAt, endedAt: Date.now(),
    solo: m.solo, bestOfSets: m.bestOfSets, bestOfLegs: m.bestOfLegs,
    sets: m.sets.slice(), winner: m.winner,
    players: m.players.map(function(pl, i){
      return {
        id: pl.id || null, name: pl.name,
        darts: m.tot.darts[i], points: m.tot.points[i],
        avg3: +avg3(m, i).toFixed(2), first9: +first9(m, i).toFixed(2),
        bestTurn: m.tot.bestTurn[i], bestLeg: m.tot.bestLeg[i],
        c180: m.tot.c180[i], legsWon: m.tot.legsWon[i], setsWon: m.sets[i],
        busts: m.tot.busts[i]
      };
    })
  };
  history.unshift(entry);
  if(history.length > 200) history.length = 200;
  save(K.history, history);
}

/* ===================================================================== UI */
var $ = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
var input = '';           // cifre digitate
var cfg = {players:[], bestOfSets:1, bestOfLegs:3, starter:0, picked:[null,null], names:['','']};

function show(view){
  $$('.view').forEach(function(v){ v.classList.toggle('on', v.id === 'v-' + view); });
  if(view === 'menu') renderMenu();
  if(view === 'setup') renderSetup();
  if(view === 'game') renderGame();
  if(view === 'players') renderPlayers();
  if(view === 'stats') renderStats();
  window.scrollTo(0,0);
}
function tap(ms){ if(navigator.vibrate) navigator.vibrate(ms || 12); }
var toastTimer = null;
function toast(msg, bad){
  var el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('bad', !!bad);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2600);
}
function fmt(n){ return (Math.round(n*10)/10).toFixed(1); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

/* --------------------------------------------------------------- menu */
function renderMenu(){
  var r = $('#resume');
  if(match && !match.over){
    var names = match.players.map(function(p){ return p.name; }).join(' · ');
    r.hidden = false;
    r.querySelector('small').textContent = names + ' — set ' + match.sets.join('-') + ', leg ' + match.legs.join('-');
  } else {
    r.hidden = true;
  }
}

/* ------------------------------------------------- configurazione partita */
function renderSetup(){
  $$('#v-setup [data-seg]').forEach(function(group){
    var key = group.dataset.seg;
    $$('#v-setup [data-seg="'+key+'"] button').forEach(function(b){
      b.setAttribute('aria-pressed', String(cfg[key] === (isNaN(+b.dataset.val) ? b.dataset.val : +b.dataset.val)));
    });
  });
  var solo = cfg.count === 1;
  $('#slot2').hidden = solo;
  $('#setsBox').hidden = solo;
  $('#starterBox').hidden = solo;
  $('#legsLabel').textContent = solo ? 'Leg da giocare' : 'Al meglio di (leg)';

  // scelta rapida dai profili salvati
  [0,1].forEach(function(i){
    var box = $('#chips'+i);
    box.innerHTML = '';
    players.forEach(function(pl){
      var b = document.createElement('button');
      b.className = 'chip'; b.type = 'button'; b.textContent = pl.name;
      b.addEventListener('click', function(){
        cfg.picked[i] = pl.id; cfg.names[i] = pl.name;
        $('#name'+i).value = pl.name; tap();
      });
      box.appendChild(b);
    });
    box.hidden = players.length === 0;
  });

  [0,1].forEach(function(i){
    $('#starter'+i).textContent = cfg.names[i] || ('Giocatore ' + (i+1));
  });
  $$('#starterBox button').forEach(function(b){
    b.setAttribute('aria-pressed', String(cfg.starter === +b.dataset.val));
  });
  $('#setupErr').textContent = '';
}

function startMatch(){
  var count = cfg.count === 1 ? 1 : 2;
  var list = [];
  for(var i=0;i<count;i++){
    var name = ($('#name'+i).value || '').trim();
    if(!name){ $('#setupErr').textContent = 'Serve il nome del giocatore ' + (i+1) + '.'; return; }
    list.push({id: cfg.picked[i], name: name});
  }
  if(count === 2 && list[0].name.toLowerCase() === list[1].name.toLowerCase()){
    $('#setupErr').textContent = 'I due giocatori hanno lo stesso nome.'; return;
  }
  // i nomi nuovi diventano profili salvati
  list.forEach(function(pl){
    if(!pl.id){
      var found = players.filter(function(p){ return p.name.toLowerCase() === pl.name.toLowerCase(); })[0];
      if(found){ pl.id = found.id; }
      else { var np = {id: uid(), name: pl.name}; players.push(np); pl.id = np.id; }
    }
  });
  save(K.players, players);

  match = newMatch({players:list, bestOfSets:cfg.bestOfSets, bestOfLegs:cfg.bestOfLegs, starter: count===2 ? cfg.starter : 0});
  save(K.match, match);
  input = '';
  show('game');
}

/* ------------------------------------------------------------- partita */
function renderGame(){
  if(!match){ show('menu'); return; }
  var m = match, p = m.cur, opp = m.players.length === 2 ? 1 - p : null;

  $('#gSets').textContent = m.sets[0] + ' - ' + m.sets[1];
  $('#gLegs').textContent = m.legs[0] + ' - ' + m.legs[1];
  $('#gSetsBox').hidden = m.solo;
  $('#gLegsLabel').textContent = m.solo ? 'LEG' : 'LEG';

  // avversario
  var rival = $('#rival');
  if(opp === null){ rival.hidden = true; }
  else {
    rival.hidden = false;
    $('#rName').textContent = m.players[opp].name;
    $('#rRem').textContent = m.rem[opp];
    $('#rAvg').textContent = 'media ' + fmt(avg3(m, opp)) + ' · ' + m.tot.darts[opp] + ' frecce';
  }

  // giocatore di turno
  $('#pName').textContent = m.players[p].name;
  $('#pRem').textContent = m.rem[p];
  $('#pAvg').textContent = fmt(avg3(m, p));
  $('#pDarts').textContent = m.tot.darts[p];
  var lt = lastTurnOf(m, p);
  $('#pLast').textContent = lt ? (lt.bust ? 'sballo' : lt.score) : '—';

  // suggerimento di chiusura
  var co = checkout(m.rem[p]), box = $('#co');
  if(m.rem[p] <= 170 && m.rem[p] >= 2){
    box.classList.remove('none');
    box.innerHTML = '<span class="lbl">Chiusura</span>' +
      (co ? co.map(function(c){ return '<span class="c">'+c+'</span>'; }).join('')
          : '<span class="lbl" style="color:var(--muted)">non chiudibile in 3 freccette</span>');
  } else {
    box.classList.add('none');
    box.innerHTML = '<span class="lbl" style="color:var(--muted)">Chiusura consigliata sotto i 170</span>';
  }

  // freccette del turno (indicatore)
  $('#dots').innerHTML = '<i></i><i></i><i></i>';

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
}

function pressDigit(d){
  if(match.pending) return;
  if(input.length >= 3) return;
  input = (input === '0' ? '' : input) + d;
  paintInput(); tap();
}
function pressDel(){ input = input.slice(0, -1); paintInput(); tap(); }
function pressUndo(){
  if(!undo(match)){ toast('Niente da annullare'); return; }
  input = ''; hideSheets(); save(K.match, match); renderGame(); tap(20);
}
function pressEnter(){
  var n = parseInt(input, 10);
  if(!validScore(n)) return;
  var hero = $('#hero');
  var res = applyTurn(match, n);
  input = '';
  save(K.match, match);

  if(res === 'checkout'){
    renderGame();
    hero.classList.add('won');
    $('#pRem').textContent = '0';
    openSheet('#askSheet');
    tap(30);
    return;
  }
  if(res === 'bust'){
    // il punteggio mostrato torna a quello di inizio turno: lo rende evidente
    renderGame();
    hero.classList.add('bust');
    if(navigator.vibrate) navigator.vibrate([40,60,40]);
    setTimeout(function(){ hero.classList.remove('bust'); }, 1700);
    return;
  }
  renderGame(); tap();
}

/* pannelli */
function openSheet(sel){ $('#backdrop').classList.add('show'); $(sel).classList.add('show'); }
function hideSheets(){
  $('#backdrop').classList.remove('show');
  $$('.sheet').forEach(function(s){ s.classList.remove('show'); });
  $('#hero').classList.remove('won','bust');
}

function answerDarts(nDarts){
  var m = match;
  if(!m.pending) return;
  var res = closeLeg(m, nDarts);
  save(K.match, m);
  hideSheets();
  buildResultSheet(res);
  openSheet('#legSheet');
  tap(30);
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
  if(res.matchWon){ archive(match); localStorage.removeItem(K.match); }
}
function dartsInLeg(m, p){
  var n = 0; m.turns.forEach(function(t){ if(t.p === p) n += t.darts; });
  return n;
}

/* ------------------------------------------------------------ giocatori */
function renderPlayers(){
  var box = $('#playerRows');
  if(players.length === 0){
    box.innerHTML = '<p class="empty">Nessun giocatore salvato.<br>I nomi che usi in partita vengono memorizzati qui.</p>';
    return;
  }
  box.innerHTML = players.map(function(pl){
    var agg = aggregate(pl.id);
    return '<div class="row" data-id="'+pl.id+'">' +
      '<div><div class="nm">' + esc(pl.name) + '</div>' +
      '<div class="meta">' + agg.matches + ' partite · media ' + fmt(agg.avg3) + ' · ' + agg.c180 + ' × 180</div></div>' +
      '<div class="sp">' +
        '<button class="ghost sm" data-act="rename">Rinomina</button>' +
        '<button class="ghost sm danger" data-act="del">Elimina</button>' +
      '</div></div>';
  }).join('');
}

function aggregate(id){
  var out = {matches:0, legsWon:0, setsWon:0, points:0, darts:0, avg3:0, bestTurn:0, bestLeg:null, c180:0, wins:0};
  history.forEach(function(h){
    h.players.forEach(function(p, i){
      if(p.id !== id) return;
      out.matches++;
      out.legsWon += p.legsWon; out.setsWon += p.setsWon;
      out.points += p.points; out.darts += p.darts;
      out.c180 += p.c180;
      if(p.bestTurn > out.bestTurn) out.bestTurn = p.bestTurn;
      if(p.bestLeg !== null && (out.bestLeg === null || p.bestLeg < out.bestLeg)) out.bestLeg = p.bestLeg;
      if(h.winner === i) out.wins++;
    });
  });
  out.avg3 = out.darts ? out.points / out.darts * 3 : 0;
  return out;
}

/* ------------------------------------------------------------ statistiche */
function renderStats(){
  var box = $('#statsBody');
  if(history.length === 0){
    box.innerHTML = '<p class="empty">Ancora nessuna partita conclusa.<br>Le statistiche compaiono qui a fine match.</p>';
    return;
  }
  var html = '';
  players.forEach(function(pl){
    var a = aggregate(pl.id);
    if(!a.matches) return;
    html += '<p class="lbl" style="margin:14px 0 8px">' + esc(pl.name) + '</p><div class="statgrid">' +
      tile('Partite', a.matches + (a.wins ? ' · ' + a.wins + ' vinte' : '')) +
      tile('Media 3 freccette', fmt(a.avg3)) +
      tile('Miglior turno', a.bestTurn || '—') +
      tile('Miglior leg', a.bestLeg === null ? '—' : a.bestLeg + ' frecce') +
      tile('Leg vinti', a.legsWon) +
      tile('180', a.c180) +
      '</div>';
  });

  html += '<p class="lbl" style="margin:18px 0 8px">Ultime partite</p><div class="rows">';
  history.slice(0, 12).forEach(function(h){
    var d = new Date(h.endedAt);
    var names = h.players.map(function(p, i){ return (h.winner === i ? '★ ' : '') + p.name; }).join(' – ');
    html += '<div class="row"><div><div class="nm">' + esc(names) + '</div>' +
      '<div class="meta">' + d.toLocaleDateString('it-IT') + ' · set ' + h.sets.join('-') +
      ' · media ' + h.players.map(function(p){ return fmt(p.avg3); }).join(' / ') + '</div></div></div>';
  });
  html += '</div>';
  box.innerHTML = html;
}
function tile(label, value){
  return '<div class="tile"><span class="lbl">' + label + '</span><b>' + value + '</b></div>';
}

/* ------------------------------------------------------------------ dati */
function exportData(){
  var blob = new Blob([JSON.stringify({
    app:'501', version:1, exportedAt:new Date().toISOString(),
    players:players, history:history, match:match
  }, null, 2)], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '501-dati-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  toast('File JSON scaricato');
}
function importData(file){
  var fr = new FileReader();
  fr.onload = function(){
    try {
      var data = JSON.parse(fr.result);
      if(!data || !Array.isArray(data.players) || !Array.isArray(data.history)) throw new Error('formato');
      var byId = {};
      players.forEach(function(p){ byId[p.id] = true; });
      data.players.forEach(function(p){ if(p && p.id && p.name && !byId[p.id]) players.push({id:p.id, name:p.name}); });
      var seen = {};
      history.forEach(function(h){ seen[h.id] = true; });
      data.history.forEach(function(h){ if(h && h.id && !seen[h.id]) history.push(h); });
      history.sort(function(a,b){ return b.endedAt - a.endedAt; });
      save(K.players, players); save(K.history, history);
      toast('Dati importati e uniti ai tuoi');
      renderPlayers(); renderStats();
    } catch(e){
      toast('File non valido', true);
    }
  };
  fr.readAsText(file);
}

/* ------------------------------------------------------------- eventi */
function bind(){
  // navigazione
  $$('[data-go]').forEach(function(b){
    b.addEventListener('click', function(){ show(b.dataset.go); tap(); });
  });
  $('#resume').addEventListener('click', function(){ input=''; show('game'); });
  $('#newMatch').addEventListener('click', function(){
    cfg.count = cfg.count || 2; renderSetup(); show('setup');
  });

  // configurazione
  $$('#v-setup [data-seg]').forEach(function(group){
    group.addEventListener('click', function(e){
      var b = e.target.closest('button'); if(!b) return;
      var key = group.dataset.seg;
      var raw = b.dataset.val;
      cfg[key] = isNaN(+raw) ? raw : +raw;
      renderSetup(); tap();
    });
  });
  [0,1].forEach(function(i){
    $('#name'+i).addEventListener('input', function(){
      cfg.names[i] = $('#name'+i).value; cfg.picked[i] = null;
      $('#starter'+i).textContent = cfg.names[i] || ('Giocatore ' + (i+1));
    });
  });
  $('#startBtn').addEventListener('click', startMatch);

  // tastiera
  $$('#pad .k[data-d]').forEach(function(k){
    k.addEventListener('click', function(){ pressDigit(k.dataset.d); });
  });
  $('#delBtn').addEventListener('click', pressDel);
  $('#undoBtn2').addEventListener('click', pressUndo);
  $('#undoBtn').addEventListener('click', pressUndo);
  $('#enterBtn').addEventListener('click', pressEnter);
  document.addEventListener('keydown', function(e){
    if(!$('#v-game').classList.contains('on')) return;
    if(e.key >= '0' && e.key <= '9') pressDigit(e.key);
    else if(e.key === 'Backspace') pressDel();
    else if(e.key === 'Enter' && !$('#enterBtn').disabled) pressEnter();
  });

  // chiusura leg
  $$('#askSheet .asks button').forEach(function(b){
    b.addEventListener('click', function(){ answerDarts(+b.dataset.n); });
  });
  $('#askUndo').addEventListener('click', pressUndo);
  $('#legNext').addEventListener('click', function(){
    if($('#legNext').dataset.end){
      match = null; hideSheets(); show('menu');
    } else {
      nextLeg(match); save(K.match, match); input=''; hideSheets(); renderGame();
    }
  });
  $('#legStats').addEventListener('click', function(){ hideSheets(); show('stats'); });

  // uscita dalla partita
  $('#gExit').addEventListener('click', function(){
    save(K.match, match);
    toast('Partita salvata, la riprendi dal menu');
    show('menu');
  });

  // giocatori
  $('#playerRows').addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    var id = e.target.closest('.row').dataset.id;
    var pl = players.filter(function(p){ return p.id === id; })[0];
    if(!pl) return;
    if(b.dataset.act === 'rename'){
      var name = prompt('Nuovo nome per ' + pl.name, pl.name);
      if(name && name.trim()){ pl.name = name.trim(); save(K.players, players); renderPlayers(); }
    } else {
      if(confirm('Eliminare il profilo di ' + pl.name + '?\nLo storico delle partite resta.')){
        players = players.filter(function(p){ return p.id !== id; });
        save(K.players, players); renderPlayers();
      }
    }
  });
  $('#addPlayer').addEventListener('click', function(){
    var name = prompt('Nome del giocatore');
    if(!name || !name.trim()) return;
    players.push({id: uid(), name: name.trim()});
    save(K.players, players); renderPlayers();
  });

  // dati
  $('#expBtn').addEventListener('click', exportData);
  $('#impFile').addEventListener('change', function(e){
    if(e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  $('#wipeBtn').addEventListener('click', function(){
    if(!confirm('Cancellare giocatori, storico e partita in corso?\nEsporta prima un backup se ti servono.')) return;
    localStorage.removeItem(K.players); localStorage.removeItem(K.history); localStorage.removeItem(K.match);
    players = []; history = []; match = null;
    toast('Dati cancellati'); show('menu');
  });

  $('#backdrop').addEventListener('click', function(){
    // il pannello della chiusura non si chiude a vuoto: serve una risposta
    if($('#askSheet').classList.contains('show')) return;
    hideSheets();
  });
}

/* ------------------------------------------------------------ avvio PWA */
function pwa(){
  var btn = $('#install'), stateText = $('#stateText'), state = $('#state');
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  function paint(){
    var on = navigator.onLine;
    state.classList.toggle('offline', !on);
    stateText.textContent = on ? (standalone ? 'App installata' : 'Online') : 'Offline — la app funziona comunque';
  }
  window.addEventListener('online', paint); window.addEventListener('offline', paint); paint();

  var prompt2 = null;
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); prompt2 = e; if(!standalone) btn.classList.add('show');
  });
  btn.addEventListener('click', function(){
    if(!prompt2) return;
    prompt2.prompt();
    prompt2.userChoice.then(function(){ prompt2 = null; btn.classList.remove('show'); });
  });
  window.addEventListener('appinstalled', function(){ standalone = true; btn.classList.remove('show'); paint(); });

  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').catch(function(err){ console.warn('SW:', err); });
    });
  }
}

/* -------------------------------------------------------------- partenza */
bind();
pwa();
cfg.count = 2;
show('menu');

// esposto per i test automatici
window.D501 = {
  checkout: checkout, validScore: validScore,
  state: function(){ return match; },
  reset: function(){ match = null; localStorage.removeItem(K.match); }
};
})();
