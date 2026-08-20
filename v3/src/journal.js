import {isGameState} from './engine.js';

export const MATCH_JOURNAL_VERSION=1;
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
    endedAt:null,
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

export function serializeMatchJournal(journal){assertJournal(journal);return JSON.stringify(journal)}
export function parseMatchJournal(raw){
  let journal;
  try{journal=typeof raw==='string'?JSON.parse(raw):clone(raw)}catch{throw new Error('Matchjournalen innehåller ogiltig JSON.');}
  assertJournal(journal);
  for(const item of journal.entries){if(!item||!Number.isInteger(item.seq)||!isGameState(item.state))throw new Error('Matchjournalen innehåller en ogiltig replay-post.');}
  return journal;
}

export function saveMatchJournal(journal,{storage=globalThis.localStorage,key=MATCH_HISTORY_KEY,limit=20}={}){
  assertJournal(journal);
  if(!storage?.getItem||!storage?.setItem)return false;
  let history=[];
  try{const parsed=JSON.parse(storage.getItem(key)||'[]');if(Array.isArray(parsed))history=parsed}catch{}
  const clean=history.filter(item=>item?.id!==journal.id);
  clean.unshift(clone(journal));
  storage.setItem(key,JSON.stringify(clean.slice(0,Math.max(1,Number(limit)||20))));
  return true;
}

export function loadMatchHistory({storage=globalThis.localStorage,key=MATCH_HISTORY_KEY}={}){
  if(!storage?.getItem)return [];
  try{
    const parsed=JSON.parse(storage.getItem(key)||'[]');
    if(!Array.isArray(parsed))return [];
    return parsed.map(item=>{try{return parseMatchJournal(item)}catch{return null}}).filter(Boolean);
  }catch{return []}
}
