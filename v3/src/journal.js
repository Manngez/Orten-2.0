import {isGameState,playPlace} from './engine.js';

export const MATCH_JOURNAL_VERSION=1;
export const MATCH_STORAGE_VERSION=1;
export const MATCH_HISTORY_KEY='orten3:match-history:v1';
const clone=value=>structuredClone(value);

function makeId(){
  return `m-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`}`;
}

function stateKey(state){
  return JSON.stringify({
    status:state.status,
    turn:state.turn,
    winner:state.winner,
    crossing:state.crossing?{playerIndex:state.crossing.playerIndex,segmentIndex:state.crossing.segmentIndex}:null,
    places:state.places.map(place=>[place.id,place.playerIndex])
  });
}

function assertJournal(journal){
  if(!journal||journal.version!==MATCH_JOURNAL_VERSION||typeof journal.id!=='string'||!Array.isArray(journal.entries))throw new Error('Ogiltig matchjournal.');
  if(!['playing','finished','abandoned'].includes(journal.status))throw new Error('Matchjournalen har ogiltig status.');
  return true;
}

function entry(state,{event='state',revision=null,at=Date.now()}={}){
  if(!isGameState(state))throw new Error('Kan inte journalföra ogiltigt spelstate.');
  if(revision!==null&&(!Number.isInteger(revision)||revision<0))throw new Error('Ogiltig journalrevision.');
  return {seq:0,event:String(event||'state'),revision,at:Number(at)||Date.now(),key:stateKey(state),state:clone(state)};
}

function cleanReplayPlace(place){
  return {
    id:String(place.id),name:String(place.name),country:String(place.country||''),countryCode:String(place.countryCode||''),region:String(place.region||''),lat:Number(place.lat),lon:Number(place.lon)
  };
}

function resolveStorage(storage){
  if(storage!==undefined)return storage;
  try{return globalThis.localStorage||null}catch{return null}
}

export function createMatchJournal(state,{id=makeId(),source='local',roomCode='',revision=null,at=Date.now()}={}){
  const first=entry(state,{event:'start',revision,at});
  return {
    version:MATCH_JOURNAL_VERSION,
    id:String(id),
    source:source==='online'?'online':'local',
    roomCode:String(roomCode||''),
    mode:state.mode,
    players:state.players.map(player=>({id:player.id,onlineId:player.onlineId||null,name:player.name})),
    startedAt:first.at,
    endedAt:state.status==='finished'?first.at:null,
    status:state.status==='finished'?'finished':'playing',
    winner:state.winner,
    entries:[first]
  };
}

export function appendMatchState(inputJournal,state,{event='move',revision=null,at=Date.now()}={}){
  assertJournal(inputJournal);
  if(!isGameState(state))throw new Error('Kan inte journalföra ogiltigt spelstate.');
  const journal=clone(inputJournal);
  const next=entry(state,{event,revision,at});
  const last=journal.entries.at(-1);
  if(last?.key===next.key&&last?.revision===next.revision)return journal;
  next.seq=journal.entries.length;
  journal.entries.push(next);
  journal.winner=state.winner;
  if(state.status==='finished'){
    journal.status='finished';
    journal.endedAt=next.at;
  }
  return journal;
}

export function abandonMatchJournal(inputJournal,{at=Date.now()}={}){
  assertJournal(inputJournal);
  const journal=clone(inputJournal);
  if(journal.status==='playing'){
    journal.status='abandoned';
    journal.endedAt=Number(at)||Date.now();
  }
  return journal;
}

export function replayMatchState(journal,seq){
  assertJournal(journal);
  if(!Number.isInteger(seq)||seq<0||seq>=journal.entries.length)throw new Error('Replay-steget finns inte.');
  return clone(journal.entries[seq].state);
}

export function compactMatchJournal(journal){
  assertJournal(journal);
  const first=journal.entries[0];
  if(!first||!isGameState(first.state))throw new Error('Matchjournalen saknar giltigt start-state.');
  const steps=[];
  for(let i=1;i<journal.entries.length;i++){
    const previous=journal.entries[i-1];
    const current=journal.entries[i];
    if(!isGameState(current.state)||current.state.places.length!==previous.state.places.length+1)throw new Error('Matchjournalen innehåller ett state som inte kan kompakteras.');
    steps.push({event:current.event,revision:current.revision,at:current.at,place:cleanReplayPlace(current.state.places.at(-1))});
  }
  return {
    storageVersion:MATCH_STORAGE_VERSION,
    journalVersion:MATCH_JOURNAL_VERSION,
    id:journal.id,source:journal.source,roomCode:journal.roomCode,mode:journal.mode,players:clone(journal.players),startedAt:journal.startedAt,endedAt:journal.endedAt,status:journal.status,winner:journal.winner,
    start:{revision:first.revision,at:first.at,state:clone(first.state)},
    steps
  };
}

export function expandMatchJournal(stored){
  if(!stored||stored.storageVersion!==MATCH_STORAGE_VERSION||stored.journalVersion!==MATCH_JOURNAL_VERSION||!stored.start?.state||!Array.isArray(stored.steps))throw new Error('Ogiltigt kompakt journalformat.');
  let state=clone(stored.start.state);
  let journal=createMatchJournal(state,{id:stored.id,source:stored.source,roomCode:stored.roomCode,revision:stored.start.revision,at:stored.start.at});
  for(const step of stored.steps){
    state=playPlace(state,step.place);
    journal=appendMatchState(journal,state,{event:step.event,revision:step.revision,at:step.at});
  }
  if(stored.status==='abandoned')journal=abandonMatchJournal(journal,{at:stored.endedAt||Date.now()});
  if(journal.status!==stored.status)throw new Error('Den kompakta journalens slutstatus stämmer inte med replay.');
  if(journal.winner!==stored.winner)throw new Error('Den kompakta journalens vinnare stämmer inte med replay.');
  journal.startedAt=stored.startedAt;
  journal.endedAt=stored.endedAt;
  return journal;
}

export function serializeMatchJournal(journal){assertJournal(journal);return JSON.stringify(journal)}
export function parseMatchJournal(raw){
  let journal;
  try{journal=typeof raw==='string'?JSON.parse(raw):clone(raw)}catch{throw new Error('Matchjournalen innehåller ogiltig JSON.');}
  if(journal?.storageVersion!==undefined)return expandMatchJournal(journal);
  assertJournal(journal);
  for(const item of journal.entries){if(!item||!Number.isInteger(item.seq)||!isGameState(item.state))throw new Error('Matchjournalen innehåller en ogiltig replay-post.');}
  return journal;
}

export function saveMatchJournal(journal,{storage,key=MATCH_HISTORY_KEY,limit=20}={}){
  assertJournal(journal);
  storage=resolveStorage(storage);
  if(!storage?.getItem||!storage?.setItem)return false;
  try{
    let history=[];
    try{const parsed=JSON.parse(storage.getItem(key)||'[]');if(Array.isArray(parsed))history=parsed}catch{}
    const clean=history.filter(item=>item?.id!==journal.id);
    clean.unshift(compactMatchJournal(journal));
    storage.setItem(key,JSON.stringify(clean.slice(0,Math.max(1,Number(limit)||20))));
    return true;
  }catch{return false}
}

export function loadMatchHistory({storage,key=MATCH_HISTORY_KEY}={}){
  storage=resolveStorage(storage);
  if(!storage?.getItem)return [];
  try{
    const parsed=JSON.parse(storage.getItem(key)||'[]');
    if(!Array.isArray(parsed))return [];
    return parsed.map(item=>{try{return parseMatchJournal(item)}catch{return null}}).filter(Boolean);
  }catch{return []}
}
