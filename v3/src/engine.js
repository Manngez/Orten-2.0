import {intersectionOf,unwrapLon} from './geometry.js';

const clone=value=>structuredClone(value);

export function createGame({mode='classic',players=[]}={}){
  const cleanPlayers=players.map((name,index)=>({id:index,name:String(name||`Spelare ${index+1}`).trim()||`Spelare ${index+1}`,moves:0}));
  if(mode==='solo'&&cleanPlayers.length!==1)throw new Error('Solo kräver exakt en spelare.');
  if(mode==='duel'&&cleanPlayers.length!==2)throw new Error('Duell kräver exakt två spelare.');
  if(!cleanPlayers.length)throw new Error('Minst en spelare krävs.');
  return {version:2,mode,status:'playing',turn:0,players:cleanPlayers,places:[],segments:[],crossing:null,winner:null};
}

function playerLastPlace(state,playerIndex){
  for(let i=state.places.length-1;i>=0;i--)if(state.places[i].playerIndex===playerIndex)return state.places[i];
  return null;
}

function startForMove(state){
  if(state.mode==='duel')return playerLastPlace(state,state.turn);
  return state.places.at(-1)||null;
}

function preparePlace(state,rawPlace){
  const start=startForMove(state);
  const lon=Number(rawPlace.lon);
  const startUx=start?(Number.isFinite(Number(start.ux))?Number(start.ux):Number(start.lon)):null;
  return {
    id:String(rawPlace.id??rawPlace.geonameId??`${rawPlace.name}-${rawPlace.lat}-${rawPlace.lon}`),
    name:String(rawPlace.name),
    country:String(rawPlace.country||''),
    countryCode:String(rawPlace.countryCode||''),
    region:String(rawPlace.region||''),
    lat:Number(rawPlace.lat),
    lon,
    ux:start?unwrapLon(lon,startUx):lon,
    playerIndex:state.turn
  };
}

function candidateSegment(state,place){
  const start=startForMove(state);
  if(!start)return null;
  const startUx=Number.isFinite(Number(start.ux))?Number(start.ux):Number(start.lon);
  return {a:{...start,ux:startUx},b:{...place,ux:unwrapLon(place.lon,startUx)},playerIndex:state.turn};
}

export function crossingsForMove(state,rawPlace){
  const place=Number.isFinite(Number(rawPlace?.ux))?rawPlace:preparePlace(state,rawPlace);
  const segment=candidateSegment(state,place);
  if(!segment)return [];
  const hits=[];
  const referenceUx=segment.a.ux;

  for(let i=0;i<state.segments.length;i++){
    const old=state.segments[i];
    const a={...old.a,ux:unwrapLon(old.a.lon,referenceUx)};
    const b={...old.b,ux:unwrapLon(old.b.lon,a.ux)};
    const hit=intersectionOf(segment.a,segment.b,a,b);
    if(hit)hits.push({...hit,segmentIndex:i,crossedPlayerIndex:old.playerIndex});
  }
  return hits.sort((x,y)=>x.t-y.t);
}

function nextTurn(state){
  if(state.mode==='solo')return 0;
  return (state.turn+1)%state.players.length;
}

export function playPlace(inputState,rawPlace){
  if(inputState.status!=='playing')throw new Error('Spelet är avslutat.');
  const state=clone(inputState);
  const place=preparePlace(state,rawPlace);
  if(!place.name||!Number.isFinite(place.lat)||!Number.isFinite(place.lon)||place.lat< -90||place.lat>90||place.lon< -180||place.lon>180)throw new Error('Ogiltig ort.');
  if(state.places.some(p=>p.id===place.id&&p.playerIndex===state.turn))throw new Error('Du har redan spelat den orten.');

  const segment=candidateSegment(state,place);
  const hits=crossingsForMove(state,place);
  state.places.push(place);
  state.players[state.turn].moves+=1;
  if(segment)state.segments.push({...segment,b:place});

  if(hits.length){
    const first=hits[0];
    state.status='finished';
    state.crossing={...first,playerIndex:state.turn};
    if(state.mode==='solo')state.winner=null;
    else state.winner=(state.turn+1)%state.players.length;
    return state;
  }
  state.turn=nextTurn(state);
  return state;
}

export function ruleText(mode){
  if(mode==='duel')return 'Din nya linje får inte korsa någon tidigare linje — varken din egen eller motspelarens.';
  if(mode==='solo')return 'Bygg en så lång rutt som möjligt utan att en ny linje korsar rutten.';
  return 'Första spelaren som skapar en linjekorsning förlorar.';
}
