import {createGame,playPlace,ruleText} from './engine.js';
import {loadPlaces,searchPlaces} from './data.js';
import {createGameMap} from './map.js';

const $=id=>document.getElementById(id);
let mode='classic';
let state=null;
let ready=false;
let gameMap=null;

const modeName=value=>({classic:'Klassisk',solo:'Solo',duel:'Duell'})[value]||value;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setScreen(name){document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));$(name).classList.add('active');}

function ensureMap(){
  if(!gameMap)gameMap=createGameMap($('map'));
  gameMap.invalidate();
  return gameMap;
}

function rebuildNames(){
  const count=mode==='solo'?1:2;
  $('playerCount').value=String(count);$('playerCount').disabled=mode==='solo'||mode==='duel';
  $('names').innerHTML=Array.from({length:count},(_,i)=>`<input id="name${i}" maxlength="24" value="${i===0?'Spelare 1':'Spelare 2'}" aria-label="Namn spelare ${i+1}">`).join('');
}

function renderState({forceMapFit=false}={}){
  if(!state)return;
  $('modeBadge').textContent=modeName(state.mode);
  $('turnName').textContent=state.status==='finished'?'Match slut':state.players[state.turn].name;
  $('score').innerHTML=state.players.map((p,i)=>`<div class="player-score ${state.status==='playing'&&state.turn===i?'active':''}"><span>${esc(p.name)}</span><b>${p.moves}</b></div>`).join('');
  $('route').innerHTML=state.places.map((p,index)=>`<button type="button" class="route-place p${p.playerIndex}" data-place-index="${index}">${esc(p.name)}</button>`).join('');
  if(gameMap)gameMap.render(state,{forceFit:forceMapFit});

  if(state.status==='finished'){
    if(state.mode==='solo')$('message').textContent=`Korsning. Du nådde ${state.players[0].moves} orter.`;
    else $('message').textContent=`${state.players[state.crossing.playerIndex].name} skapade korsningen. ${state.players[state.winner].name} vinner.`;
    $('message').classList.add('cross');
  }else{$('message').textContent=ruleText(state.mode);$('message').classList.remove('cross')}
}

function choose(place){
  if(!state||state.status!=='playing')return;
  try{state=playPlace(state,place);$('placeInput').value='';$('results').innerHTML='';renderState();}
  catch(error){$('message').textContent=error.message;$('message').classList.add('cross')}
}

$('modeGrid').addEventListener('click',event=>{
  const button=event.target.closest('[data-mode]');if(!button)return;
  mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(el=>el.classList.toggle('selected',el===button));rebuildNames();
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
    state=createGame({mode,players});
    setScreen('game');
    ensureMap();
    renderState({forceMapFit:true});
    $('placeInput').focus();
  }catch(error){
    setScreen('home');
    $('dataStatus').textContent=`⛔ Spelet kunde inte starta: ${error.message}`;
    $('dataStatus').className='data-status bad';
  }
});

$('back').addEventListener('click',()=>{state=null;gameMap?.reset();setScreen('home')});
$('fitMap').addEventListener('click',()=>{if(state&&gameMap)gameMap.fitState(state,true)});
$('route').addEventListener('click',event=>{
  const button=event.target.closest('[data-place-index]');
  const index=Number(button?.dataset.placeIndex);
  if(!button||!Number.isInteger(index)||!state?.places[index]||!gameMap)return;
  gameMap.focusPlace(state.places[index]);
});

rebuildNames();
const demoMode=new URLSearchParams(location.search).get('demo')==='1';
loadPlaces({allowDemo:demoMode}).then(info=>{
  ready=true;
  $('start').disabled=false;
  if(info.source==='full'){
    $('dataStatus').textContent=`✓ Verifierat ortregister · ${info.count.toLocaleString('sv-SE')} orter · ${info.manifest.version}`;
    $('dataStatus').className='data-status ok';
  }else{
    $('dataStatus').textContent=`⚠ Explicit demo · ${info.count} testorter. Detta läge används bara för utveckling.`;
    $('dataStatus').className='data-status warn';
  }
}).catch(error=>{
  ready=false;
  $('start').disabled=true;
  $('dataStatus').textContent=`⛔ Spelstart stoppad: ${error.message}`;
  $('dataStatus').className='data-status bad';
});
