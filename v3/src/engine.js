import {intersection,project} from './geometry.js';

const clone=value=>structuredClone(value);

export function createGame({mode='classic',players=[]}={}){
  const cleanPlayers=players.map((name,index)=>({id:index,name:String(name||`Spelare ${index+1}`).trim()||`Spelare ${index+1}`,moves:0}));
  if(mode==='solo'&&cleanPlayers.length!==1)throw new Error('Solo kräver exakt en spelare.');
  if(mode==='duel'&&cleanPlayers.length!==2)throw new Error('Duell kräver exakt två spelare.');
  if(!cleanPlayers.length)throw new Error('Minst en spelare krävs.');
  return {version:1,mode,status:'playing',turn:0,players:cleanPlayers,places:[],segments:[],crossing:null,winner:null};
}

function playerLastPlace(state,playerIndex){
  for(let i=state.places.length-1;i>=0;i--)if(state.places[i].playerIndex===playerIndex)return state.places[i];
  return null;
}

function startForMove(state){
  if(state.mode==='duel')return playerLastPlace(state,state.turn);
  return state.places.at(-1)||null;
}

function candidateSegment(state,place){
  const start=startForMove(state);
  if(!start)return null;
  return {a:start,b:place,playerIndex:state.turn};
}

export function crossingsForMove(state,place){
  const segment=candidateSegment(state,place);
  if(!segment)return [];
  const a=project(segment.a.lat,segment.a.lon),b=project(segment.b.lat,segment.b.lon);
  const hits=[];
  for(let i=0;i<state.segments.length;i++){
    const old=state.segments[i];
    const hit=intersection(a,b,project(old.a.lat,old.a.lon),project(old.b.lat,old.b.lon));
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
  const place={id:String(rawPlace.id??rawPlace.geonameId??`${rawPlace.name}-${rawPlace.lat}-${rawPlace.lon}`),name:String(rawPlace.name),country:String(rawPlace.country||''),countryCode:String(rawPlace.countryCode||''),lat:Number(rawPlace.lat),lon:Number(rawPlace.lon),playerIndex:state.turn};
  if(!place.name||!Number.isFinite(place.lat)||!Number.isFinite(place.lon))throw new Error('Ogiltig ort.');
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
