import {isGameState,playPlace} from './engine.js';

export const ONLINE_PROTOCOL_VERSION=1;
const clone=value=>structuredClone(value);
const cleanId=value=>String(value||'').trim().slice(0,80);

function cleanPlace(raw){
  const place={
    id:String(raw?.id??raw?.geonameId??''),
    name:String(raw?.name||'').trim(),
    country:String(raw?.country||''),
    countryCode:String(raw?.countryCode||''),
    region:String(raw?.region||''),
    lat:Number(raw?.lat),
    lon:Number(raw?.lon)
  };
  if(!place.id||!place.name||!Number.isFinite(place.lat)||!Number.isFinite(place.lon)||place.lat< -90||place.lat>90||place.lon< -180||place.lon>180)throw new Error('Ogiltigt onlinedrag.');
  return place;
}

export function createMoveMessage(playerId,place,clientMoveId=null){
  const id=cleanId(playerId);
  if(!id)throw new Error('Spelar-id saknas.');
  const moveId=cleanId(clientMoveId)||cleanId(globalThis.crypto?.randomUUID?.())||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {protocol:ONLINE_PROTOCOL_VERSION,type:'MOVE',playerId:id,clientMoveId:moveId,place:cleanPlace(place)};
}

export function createStateMessage(state,revision,{ackMoveId=null}={}){
  if(!isGameState(state))throw new Error('Kan inte skicka ogiltigt spelstate.');
  if(!Number.isInteger(revision)||revision<0)throw new Error('Ogiltig state-revision.');
  return {protocol:ONLINE_PROTOCOL_VERSION,type:'STATE',revision,ackMoveId:cleanId(ackMoveId)||null,state:clone(state)};
}

export function applyMoveMessage(state,message){
  if(!isGameState(state))throw new Error('Värdens spelstate är ogiltigt.');
  if(message?.protocol!==ONLINE_PROTOCOL_VERSION||message?.type!=='MOVE')throw new Error('Fel onlineprotokoll för draget.');
  const playerId=cleanId(message.playerId);
  const expected=cleanId(state.players[state.turn]?.onlineId);
  if(!expected)throw new Error('Aktuell spelare saknar online-id.');
  if(playerId!==expected)throw new Error('Det är inte den spelarens tur.');
  const next=playPlace(state,cleanPlace(message.place));
  return {state:next,ackMoveId:cleanId(message.clientMoveId)||null};
}

export function acceptStateMessage(currentRevision,message){
  if(!Number.isInteger(currentRevision)||currentRevision< -1)throw new Error('Ogiltig lokal revision.');
  if(message?.protocol!==ONLINE_PROTOCOL_VERSION||message?.type!=='STATE')throw new Error('Fel onlineprotokoll för state.');
  if(!Number.isInteger(message.revision)||message.revision<0)throw new Error('Ogiltig inkommande revision.');
  if(message.revision<=currentRevision)return {accepted:false,revision:currentRevision,state:null,ackMoveId:null};
  if(!isGameState(message.state))throw new Error('Inkommande spelstate är ogiltigt.');
  return {accepted:true,revision:message.revision,state:clone(message.state),ackMoveId:cleanId(message.ackMoveId)||null};
}
