import {createGame,playPlace,ruleText} from './engine.js';
import {loadPlaces,searchPlaces} from './data.js';
import {createGameMap} from './map.js';
import {createOnlineController} from './online.js';

const $=id=>document.getElementById(id);
let mode='classic';
let state=null;
let ready=false;
let gameMap=null;
let playContext='local';

const modeName=value=>({classic:'Klassisk',solo:'Solo',duel:'Duell'})[value]||value;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusName=value=>({idle:'Inte ansluten',connecting:'Ansluter…',connected:'Ansluten',reconnecting:'Återansluter…',error:'Anslutningsfel'})[value]||value;

function setScreen(name){document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));$(name).classList.add('active');}

function ensureMap(){
  if(!gameMap)gameMap=createGameMap($('map'));
  gameMap.invalidate();
  return gameMap;
}

function rebuildNames(){
  const count=mode==='solo'?1:2;
  $('names').innerHTML=Array.from({length:count},(_,i)=>`<input id="name${i}" maxlength="24" value="${i===0?'Spelare 1':'Spelare 2'}" aria-label="Namn spelare ${i+1}">`).join('');
}

function networkActive(){return online.snapshot().role!=='offline'}

function renderState({forceMapFit=false}={}){
  if(!state)return;
  const onlineState=online.snapshot();
  const isOnline=onlineState.role!=='offline';
  const canMove=!isOnline||online.canMove();
  const current=state.players[state.turn];

  $('modeBadge').textContent=modeName(state.mode);
  $('networkBadge').classList.toggle('hidden',!isOnline);
  if(isOnline)$('networkBadge').textContent=`● ${onlineState.roomCode} · ${statusName(onlineState.status)}`;
  $('turnName').textContent=state.status==='finished'?'Match slut':current.name;
  $('score').innerHTML=state.players.map((p,i)=>`<div class="player-score ${state.status==='playing'&&state.turn===i?'active':''}"><span>${esc(p.name)}</span><b>${p.moves}</b></div>`).join('');
  $('route').innerHTML=state.places.map((p,index)=>`<button type="button" class="route-place p${p.playerIndex}" data-place-index="${index}">${esc(p.name)}</button>`).join('');
  if(gameMap)gameMap.render(state,{forceFit:forceMapFit});

  $('placeInput').disabled=state.status!=='playing'||!canMove;
  $('playButton').disabled=state.status!=='playing'||!canMove;

  if(state.status==='finished'){
    if(state.mode==='solo')$('message').textContent=`Korsning. Du nådde ${state.players[0].moves} orter.`;
    else $('message').textContent=`${state.players[state.crossing.playerIndex].name} skapade korsningen. ${state.players[state.winner].name} vinner.`;
    $('message').classList.add('cross');
  }else if(isOnline&&!canMove){
    $('message').textContent=onlineState.status==='connected'?`Väntar på ${current.name}.`:statusName(onlineState.status);
    $('message').classList.remove('cross');
  }else{
    $('message').textContent=ruleText(state.mode);
    $('message').classList.remove('cross');
  }
}

function clearSearch(){
  $('placeInput').value='';
  $('results').innerHTML='';
}

function choose(place){
  if(!state||state.status!=='playing')return;
  try{
    if(networkActive()){
      online.submitMove(place);
      clearSearch();
      renderState();
      return;
    }
    state=playPlace(state,place);
    clearSearch();
    renderState();
  }catch(error){
    $('message').textContent=error.message;
    $('message').classList.add('cross');
  }
}

function renderLobby(snapshot=online.snapshot()){
  if(snapshot.role==='offline')return;
  $('roomCode').textContent=snapshot.roomCode||'-----';
  $('lobbyConnection').textContent=`● ${statusName(snapshot.status)}`;
  $('lobbyConnection').className=`connection-badge ${snapshot.status}`;
  $('lobbyCount').textContent=`${snapshot.players.length} / 2`;
  $('lobbyPlayers').innerHTML=snapshot.players.map((player,index)=>`<div class="lobby-player"><span class="player-dot p${index}"></span><div><b>${esc(player.name)}</b><small>${player.id===snapshot.playerId?'Du':player.id==='host'?'Värd':'Ansluten'}</small></div><strong>${player.connected===false?'×':'✓'}</strong></div>`).join('');

  const host=snapshot.role==='host';
  $('hostSettings').classList.toggle('hidden',!host);
  $('guestWaiting').classList.toggle('hidden',host);
  document.querySelectorAll('[data-online-mode]').forEach(button=>button.classList.toggle('selected',button.dataset.onlineMode===snapshot.mode));
  const start=$('startOnline');
  start.disabled=!host||snapshot.players.length!==2||snapshot.status!=='connected'||snapshot.started;
  start.textContent=snapshot.started?'Matchen är startad':snapshot.players.length===2?'Starta match':'Väntar på spelare…';
  $('lobbyMessage').textContent=snapshot.status==='reconnecting'?'Försöker återansluta automatiskt…':snapshot.role==='guest'?'Du är inne i rummet. Värden väljer regler och startar.':'Dela rumskoden med den andra spelaren.';
}

function showOnlineChoice(){
  $('onlineChoice').classList.remove('hidden');
  $('createForm').classList.add('hidden');
  $('joinForm').classList.add('hidden');
  $('onlineStatus').textContent='';
}

const online=createOnlineController({
  onStatus:snapshot=>{
    if(snapshot.role!=='offline'){
      $('onlineStatus').textContent=statusName(snapshot.status);
      renderLobby(snapshot);
    }
    if(state&&snapshot.started)renderState();
  },
  onLobby:snapshot=>{
    if(snapshot.role!=='offline')renderLobby(snapshot);
  },
  onState:payload=>{
    playContext='online';
    state=payload.state;
    setScreen('game');
    ensureMap();
    renderState({forceMapFit:state.places.length<=1});
    if(online.canMove())$('placeInput').focus();
  },
  onError:error=>{
    const text=error?.message||'Ett onlinefel inträffade.';
    if(document.getElementById('game').classList.contains('active')){
      $('message').textContent=text;$('message').classList.add('cross');
    }else{
      $('onlineStatus').textContent=`⛔ ${text}`;$('lobbyMessage').textContent=text;
    }
  },
  onClosed:message=>{
    state=null;gameMap?.reset();playContext='local';setScreen('entry');
    $('dataStatus').textContent=`Onlinerummet stängdes: ${message}`;$('dataStatus').className='data-status warn';
  }
});

$('localEntry').addEventListener('click',()=>{if(ready){playContext='local';setScreen('home')}});
$('onlineEntry').addEventListener('click',()=>{if(ready){playContext='online';showOnlineChoice();setScreen('online')}});
$('homeBack').addEventListener('click',()=>setScreen('entry'));
$('onlineBack').addEventListener('click',()=>{online.leave();showOnlineChoice();setScreen('entry')});

$('modeGrid').addEventListener('click',event=>{
  const button=event.target.closest('[data-mode]');if(!button)return;
  mode=button.dataset.mode;document.querySelectorAll('#modeGrid [data-mode]').forEach(el=>el.classList.toggle('selected',el===button));rebuildNames();
});

$('placeInput').addEventListener('input',()=>{
  const hits=searchPlaces($('placeInput').value);
  $('results').innerHTML=hits.map((p,i)=>`<button class="result" type="button" data-index="${i}"><b>${esc(p.name)}</b><small>${esc(p.region?`${p.region} · ${p.countryCode}`:p.country||p.countryCode)}</small></button>`).join('');
  $('results').querySelectorAll('[data-index]').forEach((button,i)=>button.addEventListener('click',()=>choose(hits[i])));
});

$('placeForm').addEventListener('submit',event=>{event.preventDefault();const hit=searchPlaces($('placeInput').value,1)[0];if(hit)choose(hit)});

$('start').addEventListener('click',()=>{
  if(!ready)return;
  const count=mode==='solo'?1:2;
  const players=Array.from({length:count},(_,i)=>String($(`name${i}`)?.value||`Spelare ${i+1}`).trim()||`Spelare ${i+1}`);
  try{
    playContext='local';
    state=createGame({mode,players});
    setScreen('game');ensureMap();renderState({forceMapFit:true});$('placeInput').focus();
  }catch(error){
    setScreen('home');$('dataStatus').textContent=`⛔ Spelet kunde inte starta: ${error.message}`;$('dataStatus').className='data-status bad';
  }
});

$('showCreate').addEventListener('click',()=>{$('onlineChoice').classList.add('hidden');$('createForm').classList.remove('hidden');$('createCode').value=online.makeRoomCode();$('hostName').focus()});
$('showJoin').addEventListener('click',()=>{$('onlineChoice').classList.add('hidden');$('joinForm').classList.remove('hidden');$('joinCode').focus()});
document.querySelectorAll('[data-online-choice]').forEach(button=>button.addEventListener('click',showOnlineChoice));
$('newCode').addEventListener('click',()=>{$('createCode').value=online.makeRoomCode()});

$('createRoom').addEventListener('click',async()=>{
  if(!ready)return;
  $('onlineStatus').textContent='Skapar rum…';
  $('createRoom').disabled=true;
  try{
    await online.createRoom({name:$('hostName').value,code:$('createCode').value,mode:'classic'});
    setScreen('lobby');renderLobby();
  }catch(error){
    online.leave();$('onlineStatus').textContent=`⛔ ${error.message}`;
  }finally{$('createRoom').disabled=false}
});

$('joinRoom').addEventListener('click',async()=>{
  if(!ready)return;
  $('onlineStatus').textContent='Ansluter…';$('joinRoom').disabled=true;
  try{
    await online.joinRoom({name:$('guestName').value,code:$('joinCode').value});
    setScreen('lobby');renderLobby();
  }catch(error){
    online.leave();$('onlineStatus').textContent=`⛔ ${error.message}`;
  }finally{$('joinRoom').disabled=false}
});

$('onlineModeGrid').addEventListener('click',event=>{
  const button=event.target.closest('[data-online-mode]');if(!button)return;
  online.setMode(button.dataset.onlineMode);renderLobby();
});
$('startOnline').addEventListener('click',()=>{try{online.startGame()}catch(error){$('lobbyMessage').textContent=`⛔ ${error.message}`}});
$('leaveLobby').addEventListener('click',()=>{online.leave();showOnlineChoice();setScreen('online')});
$('copyCode').addEventListener('click',async()=>{
  const code=online.snapshot().roomCode;
  try{await navigator.clipboard.writeText(code);$('lobbyMessage').textContent='✓ Rumskoden kopierad.'}
  catch{$('lobbyMessage').textContent=`Rumskod: ${code}`}
});

$('back').addEventListener('click',()=>{
  const wasOnline=networkActive();
  if(wasOnline)online.leave();
  state=null;gameMap?.reset();clearSearch();
  if(wasOnline){playContext='local';setScreen('entry')}else setScreen('home');
});
$('fitMap').addEventListener('click',()=>{if(state&&gameMap)gameMap.fitState(state,true)});
$('route').addEventListener('click',event=>{
  const button=event.target.closest('[data-place-index]');const index=Number(button?.dataset.placeIndex);
  if(!button||!Number.isInteger(index)||!state?.places[index]||!gameMap)return;
  gameMap.focusPlace(state.places[index]);
});

rebuildNames();
$('createCode').value=online.makeRoomCode();
const params=new URLSearchParams(location.search);
const requestedRoom=String(params.get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
if(requestedRoom){$('joinCode').value=requestedRoom;showOnlineChoice();}

const demoMode=params.get('demo')==='1';
$('localEntry').disabled=true;$('onlineEntry').disabled=true;
loadPlaces({allowDemo:demoMode}).then(info=>{
  ready=true;$('start').disabled=false;$('localEntry').disabled=false;$('onlineEntry').disabled=false;
  if(info.source==='full'){
    $('dataStatus').textContent=`✓ ${info.count.toLocaleString('sv-SE')} verifierade orter`;$('dataStatus').className='data-status ok';
  }else{
    $('dataStatus').textContent=`⚠ Demo · ${info.count} testorter`;$('dataStatus').className='data-status warn';
  }
  if(requestedRoom){playContext='online';setScreen('online');$('onlineChoice').classList.add('hidden');$('joinForm').classList.remove('hidden')}
}).catch(error=>{
  ready=false;$('start').disabled=true;$('localEntry').disabled=true;$('onlineEntry').disabled=true;
  $('dataStatus').textContent=`⛔ Spelstart stoppad: ${error.message}`;$('dataStatus').className='data-status bad';
});
