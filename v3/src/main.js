import {createGame,playPlace,ruleText} from './engine.js';
import {loadPlaces,searchPlaces,placeById} from './data.js';
import {createGameMap} from './map.js';
import {createOnlineController} from './online.js';
import {createOnlineDiagnostics} from './debug.js';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const debugMode=params.get('debug')==='1';
const demoMode=params.get('demo')==='1';
const requestedRoom=String(params.get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
let mode='classic';
let state=null;
let ready=false;
let gameMap=null;
let playContext='local';
let diagnostics=null;

const modeName=value=>({classic:'Klassisk',solo:'Solo',duel:'Duell'})[value]||value;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusName=value=>({idle:'Inte ansluten',connecting:'Ansluter…',connected:'Ansluten',reconnecting:'Återansluter…',error:'Anslutningsfel'})[value]||value;

function setScreen(name){document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));$(name).classList.add('active')}
function ensureMap(){if(!gameMap)gameMap=createGameMap($('map'));gameMap.invalidate();return gameMap}
function rebuildNames(){const count=mode==='solo'?1:2;$('names').innerHTML=Array.from({length:count},(_,i)=>`<input id="name${i}" maxlength="24" value="${i===0?'Spelare 1':'Spelare 2'}" aria-label="Namn spelare ${i+1}">`).join('')}
function networkActive(){return online.snapshot().role!=='offline'}

function renderState({forceMapFit=false}={}){
  if(!state)return;
  const onlineState=online.snapshot();const isOnline=onlineState.role!=='offline';const canMove=!isOnline||online.canMove();const current=state.players[state.turn];
  $('modeBadge').textContent=modeName(state.mode);$('networkBadge').classList.toggle('hidden',!isOnline);if(isOnline)$('networkBadge').textContent=`● ${onlineState.roomCode} · ${statusName(onlineState.status)}`;
  $('turnName').textContent=state.status==='finished'?'Match slut':current.name;
  $('score').innerHTML=state.players.map((p,i)=>`<div class="player-score ${state.status==='playing'&&state.turn===i?'active':''}"><span>${esc(p.name)}</span><b>${p.moves}</b></div>`).join('');
  $('route').innerHTML=state.places.map((p,index)=>`<button type="button" class="route-place p${p.playerIndex}" data-place-index="${index}">${esc(p.name)}</button>`).join('');
  if(gameMap)gameMap.render(state,{forceFit:forceMapFit});
  $('placeInput').disabled=state.status!=='playing'||!canMove;$('playButton').disabled=state.status!=='playing'||!canMove;

  if(state.status==='finished'){
    if(state.mode==='solo')$('message').textContent=`Korsning. Du nådde ${state.players[0].moves} orter.`;else $('message').textContent=`${state.players[state.crossing.playerIndex].name} skapade korsningen. ${state.players[state.winner].name} vinner.`;$('message').classList.add('cross');
  }else if(isOnline&&!canMove){$('message').textContent=onlineState.status==='connected'?`Väntar på ${current.name}.`:statusName(onlineState.status);$('message').classList.remove('cross')}
  else{$('message').textContent=ruleText(state.mode);$('message').classList.remove('cross')}
  diagnostics?.refresh();
}

function clearSearch(){$('placeInput').value='';$('results').innerHTML=''}
function choose(place){
  if(!state||state.status!=='playing')return;
  try{
    if(networkActive()){diagnostics?.record('move:submit',`${place.name} · ${place.id}`);online.submitMove(place);clearSearch();renderState();return}
    state=playPlace(state,place);clearSearch();renderState();
  }catch(error){diagnostics?.record('move:error',error.message);$('message').textContent=error.message;$('message').classList.add('cross')}
}

function renderLobby(snapshot=online.snapshot()){
  if(snapshot.role==='offline')return;
  const connectedCount=snapshot.players.filter(player=>player.connected!==false).length;
  const roomReady=snapshot.players.length===2&&connectedCount===2;
  $('roomCode').textContent=snapshot.roomCode||'-----';$('lobbyConnection').textContent=`● ${statusName(snapshot.status)}`;$('lobbyConnection').className=`connection-badge ${snapshot.status}`;
  $('lobbyCount').textContent=`${connectedCount} / 2`;
  $('lobbyPlayers').innerHTML=snapshot.players.map((player,index)=>`<div class="lobby-player"><span class="player-dot p${index}"></span><div><b>${esc(player.name)}</b><small>${player.id===snapshot.playerId?'Du':player.id==='host'?'Värd':'Ansluten'}</small></div><strong>${player.connected===false?'×':'✓'}</strong></div>`).join('');
  const host=snapshot.role==='host';$('hostSettings').classList.toggle('hidden',!host);$('guestWaiting').classList.toggle('hidden',host);
  document.querySelectorAll('[data-online-mode]').forEach(button=>button.classList.toggle('selected',button.dataset.onlineMode===snapshot.mode));
  const start=$('startOnline');start.disabled=!host||!roomReady||snapshot.status!=='connected'||snapshot.started;
  start.textContent=snapshot.started?'Matchen är startad':roomReady?'Starta match':snapshot.players.length===2?'Väntar på återanslutning…':'Väntar på spelare…';
  $('lobbyMessage').textContent=snapshot.status==='reconnecting'?'Försöker återansluta automatiskt…':snapshot.role==='guest'?'Du är inne i rummet. Värden väljer regler och startar.':'Dela rumskoden eller länken med den andra spelaren.';
  diagnostics?.refresh();
}

function showOnlineChoice(){$('onlineChoice').classList.remove('hidden');$('createForm').classList.add('hidden');$('joinForm').classList.add('hidden');$('onlineStatus').textContent=''}

const online=createOnlineController({
  resolvePlace:placeById,
  onStatus:snapshot=>{diagnostics?.record('status',`${snapshot.role} · ${snapshot.status}`);if(snapshot.role!=='offline'){$('onlineStatus').textContent=statusName(snapshot.status);renderLobby(snapshot)}if(state&&snapshot.started)renderState()},
  onLobby:snapshot=>{diagnostics?.record('lobby',`${snapshot.players.filter(p=>p.connected!==false).length}/${snapshot.players.length} anslutna`);if(snapshot.role!=='offline')renderLobby(snapshot)},
  onState:payload=>{diagnostics?.record('state',`r${payload.revision}${payload.ackMoveId?' · ack':''}`);playContext='online';state=payload.state;setScreen('game');ensureMap();renderState({forceMapFit:state.places.length<=1});if(online.canMove())$('placeInput').focus()},
  onError:error=>{const text=error?.message||'Ett onlinefel inträffade.';diagnostics?.record('online:error',text);if(document.getElementById('game').classList.contains('active')){$('message').textContent=text;$('message').classList.add('cross')}else{$('onlineStatus').textContent=`⛔ ${text}`;$('lobbyMessage').textContent=text}},
  onClosed:message=>{diagnostics?.record('room:closed',message);state=null;gameMap?.reset();playContext='local';setScreen('entry');$('dataStatus').textContent=`Onlinerummet stängdes: ${message}`;$('dataStatus').className='data-status warn'}
});

diagnostics=createOnlineDiagnostics({enabled:debugMode,getSnapshot:()=>online.snapshot(),getState:()=>state,getCanMove:()=>online.canMove()});
if(debugMode){
  diagnostics.record('page','debug=1');
  addEventListener('online',()=>diagnostics.record('browser','online'));
  addEventListener('offline',()=>diagnostics.record('browser','offline'));
  addEventListener('error',event=>diagnostics.record('window:error',event.message||'okänt fel'));
  addEventListener('unhandledrejection',event=>diagnostics.record('promise:error',event.reason?.message||String(event.reason||'okänt fel')));
  document.addEventListener('visibilitychange',()=>diagnostics.record('visibility',document.visibilityState));
}

$('localEntry').addEventListener('click',()=>{if(ready){playContext='local';setScreen('home')}});$('onlineEntry').addEventListener('click',()=>{if(ready){playContext='online';showOnlineChoice();setScreen('online')}});
$('homeBack').addEventListener('click',()=>setScreen('entry'));$('onlineBack').addEventListener('click',()=>{online.leave();showOnlineChoice();setScreen('entry')});

$('modeGrid').addEventListener('click',event=>{const button=event.target.closest('[data-mode]');if(!button)return;mode=button.dataset.mode;document.querySelectorAll('#modeGrid [data-mode]').forEach(el=>el.classList.toggle('selected',el===button));rebuildNames()});
$('placeInput').addEventListener('input',()=>{const hits=searchPlaces($('placeInput').value);$('results').innerHTML=hits.map((p,i)=>`<button class="result" type="button" data-index="${i}"><b>${esc(p.name)}</b><small>${esc(p.region?`${p.region} · ${p.countryCode}`:p.country||p.countryCode)}</small></button>`).join('');$('results').querySelectorAll('[data-index]').forEach((button,i)=>button.addEventListener('click',()=>choose(hits[i])))});
$('placeForm').addEventListener('submit',event=>{event.preventDefault();const hit=searchPlaces($('placeInput').value,1)[0];if(hit)choose(hit)});

$('start').addEventListener('click',()=>{
  if(!ready)return;const count=mode==='solo'?1:2;const players=Array.from({length:count},(_,i)=>String($(`name${i}`)?.value||`Spelare ${i+1}`).trim()||`Spelare ${i+1}`);
  try{playContext='local';state=createGame({mode,players});setScreen('game');ensureMap();renderState({forceMapFit:true});$('placeInput').focus()}
  catch(error){setScreen('home');$('dataStatus').textContent=`⛔ Spelet kunde inte starta: ${error.message}`;$('dataStatus').className='data-status bad'}
});

$('showCreate').addEventListener('click',()=>{$('onlineChoice').classList.add('hidden');$('createForm').classList.remove('hidden');$('createCode').value=online.makeRoomCode();$('hostName').focus()});
$('showJoin').addEventListener('click',()=>{$('onlineChoice').classList.add('hidden');$('joinForm').classList.remove('hidden');$('joinCode').focus()});
document.querySelectorAll('[data-online-choice]').forEach(button=>button.addEventListener('click',showOnlineChoice));$('newCode').addEventListener('click',()=>{$('createCode').value=online.makeRoomCode()});

$('createRoom').addEventListener('click',async()=>{if(!ready)return;diagnostics?.record('room:create',$('createCode').value);$('onlineStatus').textContent='Skapar rum…';$('createRoom').disabled=true;try{await online.createRoom({name:$('hostName').value,code:$('createCode').value,mode:'classic'});setScreen('lobby');renderLobby()}catch(error){online.leave();diagnostics?.record('room:create:error',error.message);$('onlineStatus').textContent=`⛔ ${error.message}`}finally{$('createRoom').disabled=false}});
$('joinRoom').addEventListener('click',async()=>{if(!ready)return;diagnostics?.record('room:join',$('joinCode').value);$('onlineStatus').textContent='Ansluter…';$('joinRoom').disabled=true;try{await online.joinRoom({name:$('guestName').value,code:$('joinCode').value});setScreen('lobby');renderLobby()}catch(error){online.leave();diagnostics?.record('room:join:error',error.message);$('onlineStatus').textContent=`⛔ ${error.message}`}finally{$('joinRoom').disabled=false}});

$('onlineModeGrid').addEventListener('click',event=>{const button=event.target.closest('[data-online-mode]');if(!button)return;online.setMode(button.dataset.onlineMode);diagnostics?.record('mode',button.dataset.onlineMode);renderLobby()});
$('startOnline').addEventListener('click',()=>{try{diagnostics?.record('match','start');online.startGame()}catch(error){diagnostics?.record('match:error',error.message);$('lobbyMessage').textContent=`⛔ ${error.message}`}});
$('leaveLobby').addEventListener('click',()=>{diagnostics?.record('room','leave');online.leave();showOnlineChoice();setScreen('online')});
$('copyCode').textContent='Dela rum';
$('copyCode').addEventListener('click',async()=>{
  const code=online.snapshot().roomCode;
  const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('room',code);if(demoMode)url.searchParams.set('demo','1');if(debugMode)url.searchParams.set('debug','1');
  const share={title:'Orten 3.0',text:`Anslut till mitt Orten-rum ${code}`,url:url.toString()};
  try{
    if(navigator.share){await navigator.share(share);$('lobbyMessage').textContent='✓ Delningslänken är klar.'}
    else{await navigator.clipboard.writeText(url.toString());$('lobbyMessage').textContent='✓ Länken kopierad.'}
    diagnostics?.record('room:share',url.toString());
  }catch(error){if(error?.name!=='AbortError'){$('lobbyMessage').textContent=`Rumskod: ${code}`;diagnostics?.record('room:share:error',error?.message||'kunde inte dela')}}
});

$('back').addEventListener('click',()=>{const wasOnline=networkActive();if(wasOnline){diagnostics?.record('match','exit');online.leave()}state=null;gameMap?.reset();clearSearch();if(wasOnline){playContext='local';setScreen('entry')}else setScreen('home')});
$('fitMap').addEventListener('click',()=>{if(state&&gameMap)gameMap.fitState(state,true)});
$('route').addEventListener('click',event=>{const button=event.target.closest('[data-place-index]');const index=Number(button?.dataset.placeIndex);if(!button||!Number.isInteger(index)||!state?.places[index]||!gameMap)return;gameMap.focusPlace(state.places[index])});

rebuildNames();$('createCode').value=online.makeRoomCode();if(requestedRoom){$('joinCode').value=requestedRoom;showOnlineChoice()}
$('localEntry').disabled=true;$('onlineEntry').disabled=true;
loadPlaces({allowDemo:demoMode}).then(info=>{
  ready=true;$('start').disabled=false;$('localEntry').disabled=false;$('onlineEntry').disabled=false;diagnostics?.record('data',`${info.source} · ${info.count}`);
  if(info.source==='full'){$('dataStatus').textContent=`✓ ${info.count.toLocaleString('sv-SE')} verifierade orter`;$('dataStatus').className='data-status ok'}else{$('dataStatus').textContent=`⚠ Demo · ${info.count} testorter`;$('dataStatus').className='data-status warn'}
  if(requestedRoom){playContext='online';setScreen('online');$('onlineChoice').classList.add('hidden');$('joinForm').classList.remove('hidden');diagnostics?.record('deep-link',requestedRoom)}
}).catch(error=>{ready=false;$('start').disabled=true;$('localEntry').disabled=true;$('onlineEntry').disabled=true;diagnostics?.record('data:error',error.message);$('dataStatus').textContent=`⛔ Spelstart stoppad: ${error.message}`;$('dataStatus').className='data-status bad'});
