import {createGame} from './engine.js';
import {applyMoveMessage,acceptStateMessage,createMoveMessage,createStateMessage,ONLINE_PROTOCOL_VERSION} from './online-protocol.js';

const PEERJS_URL='https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
const HOST_ID='host';
const ROOM_PREFIX='orten3-';
const MAX_PLAYERS=2;
const RETRY_DELAYS=[1000,2000,4000,8000,15000];
const MAX_SEEN_MOVES=256;
const clone=value=>structuredClone(value);
const cleanName=value=>String(value||'').trim().slice(0,24);
const cleanRoom=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
const cleanPlayerId=value=>String(value||'').trim().slice(0,80);
const roomPeerId=code=>`${ROOM_PREFIX}${cleanRoom(code).toLowerCase()}`;

export function makeRoomCode(random=Math.random){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let out='';for(let i=0;i<5;i++)out+=chars[Math.floor(random()*chars.length)%chars.length];return out}
function freshId(prefix){return `${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`}`}
function freshPlayerId(){return freshId('p')}
function makePlayerId(roomCode){const key=`orten3:player:${cleanRoom(roomCode)}`;try{const existing=sessionStorage.getItem(key);if(existing)return existing;const id=freshPlayerId();sessionStorage.setItem(key,id);return id}catch{return freshPlayerId()}}
function peerOptions(){const iceServers=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];const turn=globalThis.ORTEN_TURN;if(turn?.urls)iceServers.push({urls:turn.urls,username:turn.username||undefined,credential:turn.credential||undefined});return {debug:1,config:{iceServers,iceCandidatePoolSize:4}}}
function browserOffline(){return typeof navigator!=='undefined'&&navigator.onLine===false}

let peerLoader=null;
async function loadPeer(){
  if(globalThis.Peer)return globalThis.Peer;if(peerLoader)return peerLoader;
  peerLoader=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=PEERJS_URL;script.async=true;script.dataset.orten3Peer='1';script.onload=()=>globalThis.Peer?resolve(globalThis.Peer):reject(new Error('PeerJS kunde inte starta.'));script.onerror=()=>reject(new Error('PeerJS kunde inte laddas.'));document.head.appendChild(script)}).catch(error=>{peerLoader=null;throw error});return peerLoader;
}

export function createOnlineController(callbacks={}){
  const cb={onStatus:callbacks.onStatus||(()=>{}),onLobby:callbacks.onLobby||(()=>{}),onState:callbacks.onState||(()=>{}),onError:callbacks.onError||(()=>{}),onClosed:callbacks.onClosed||(()=>{})};
  const resolvePlace=typeof callbacks.resolvePlace==='function'?callbacks.resolvePlace:null;
  const net={role:'offline',status:'idle',roomCode:'',playerId:'',name:'',mode:'classic',peer:null,hostConn:null,guestConnections:new Map(),players:[],state:null,revision:-1,serverRevision:-1,pendingMoveId:null,pendingMove:null,retries:0,reconnectAttempt:0,reconnectReason:'',reconnectTimer:null,sessionId:freshId('s'),connectionSeq:0,connectionId:'',started:false};
  const seenMoveIds=new Map();
  const snapshot=()=>({role:net.role,status:net.status,roomCode:net.roomCode,playerId:net.playerId,name:net.name,mode:net.mode,players:clone(net.players),started:net.started,revision:net.revision,serverRevision:net.serverRevision,pending:!!net.pendingMoveId,reconnectAttempt:net.reconnectAttempt,reconnectReason:net.reconnectReason,sessionId:net.sessionId,connectionId:net.connectionId,maxReconnectAttempts:RETRY_DELAYS.length});
  const emitStatus=()=>cb.onStatus(snapshot());const emitLobby=()=>cb.onLobby(snapshot());const setStatus=(status,{force=false}={})=>{if(net.status===status&&!force)return;net.status=status;emitStatus()};
  const send=(conn,message)=>{if(conn?.open)conn.send(message)};const broadcast=message=>{for(const conn of net.guestConnections.values())send(conn,message)};
  const lobbyMessage=()=>({protocol:ONLINE_PROTOCOL_VERSION,type:'LOBBY',roomCode:net.roomCode,mode:net.mode,started:net.started,players:clone(net.players)});const broadcastLobby=()=>{broadcast(lobbyMessage());emitLobby()};

  function clearReconnect(){if(net.reconnectTimer){clearTimeout(net.reconnectTimer);net.reconnectTimer=null}}
  function clearReconnectState(){clearReconnect();net.retries=0;net.reconnectAttempt=0;net.reconnectReason=''}
  function nextConnectionId(kind){net.connectionSeq+=1;net.connectionId=`${kind}-${net.connectionSeq}`}
  function markConnected(kind){clearReconnectState();nextConnectionId(kind);setStatus('connected',{force:true})}
  function clearPending(){net.pendingMoveId=null;net.pendingMove=null}
  function closePeer(){clearReconnect();try{net.hostConn?.close()}catch{}for(const conn of net.guestConnections.values())try{conn.close()}catch{}net.guestConnections.clear();net.hostConn=null;try{net.peer?.destroy()}catch{}net.peer=null}
  function reset(){closePeer();seenMoveIds.clear();Object.assign(net,{role:'offline',status:'idle',roomCode:'',playerId:'',name:'',mode:'classic',players:[],state:null,revision:-1,serverRevision:-1,pendingMoveId:null,pendingMove:null,retries:0,reconnectAttempt:0,reconnectReason:'',connectionId:'',started:false});emitStatus();emitLobby()}
  function networkError(type){if(browserOffline())return 'Ingen internetanslutning.';if(type==='peer-unavailable')return 'Rummet hittades inte. Kontrollera rumskoden.';if(type==='unavailable-id')return 'Rumskoden används redan. Försök med en ny.';return 'Onlineanslutningen bröts. Försök igen.'}
  function rememberMove(moveId){if(!moveId)return;seenMoveIds.set(moveId,net.revision);while(seenMoveIds.size>MAX_SEEN_MOVES)seenMoveIds.delete(seenMoveIds.keys().next().value)}

  function hostApplyMove(message,boundPlayerId=null,replyConn=null){
    const playerId=cleanPlayerId(boundPlayerId||message?.playerId);
    try{
      const moveId=cleanPlayerId(message?.clientMoveId);
      if(!playerId)throw new Error('Spelar-id saknas.');
      if(!moveId)throw new Error('Drag-id saknas.');
      if(seenMoveIds.has(moveId)){
        if(replyConn&&net.state)send(replyConn,createStateMessage(net.state,net.revision,{ackMoveId:moveId}));
        if(playerId===net.playerId)clearPending();
        return true;
      }
      let safeMessage={...message,playerId,clientMoveId:moveId};
      if(resolvePlace){const authoritative=resolvePlace(message?.place?.id);if(!authoritative)throw new Error('Orten finns inte i värdens verifierade register.');safeMessage={...safeMessage,place:authoritative}}
      const result=applyMoveMessage(net.state,safeMessage);net.state=result.state;net.revision+=1;net.serverRevision=net.revision;rememberMove(result.ackMoveId);
      const stateMessage=createStateMessage(net.state,net.revision,{ackMoveId:result.ackMoveId});broadcast(stateMessage);
      if(playerId===net.playerId)clearPending();
      cb.onState({state:clone(net.state),role:net.role,playerId:net.playerId,revision:net.revision,ackMoveId:result.ackMoveId});return true;
    }catch(error){if(playerId===net.playerId)clearPending();emitStatus();cb.onError(error);return false}
  }

  function handleGuestMessage(message){
    if(message?.protocol!==ONLINE_PROTOCOL_VERSION)return;
    if(message.type==='LOBBY'){net.players=Array.isArray(message.players)?clone(message.players):[];net.mode=message.mode==='duel'?'duel':'classic';net.started=!!message.started;emitLobby();return}
    if(message.type==='STATE'){
      try{
        const previousRevision=net.revision;
        const accepted=acceptStateMessage(previousRevision,message);
        if(!accepted.accepted)return;
        net.revision=accepted.revision;net.serverRevision=accepted.revision;net.state=accepted.state;net.started=true;
        if(net.pendingMoveId&&(accepted.ackMoveId===net.pendingMoveId||accepted.revision>previousRevision))clearPending();
        cb.onState({state:clone(net.state),role:net.role,playerId:net.playerId,revision:net.revision,ackMoveId:accepted.ackMoveId});emitLobby();
      }catch(error){cb.onError(error)}return;
    }
    if(message.type==='ERROR'){clearPending();cb.onError(new Error(String(message.message||'Draget nekades.')));emitStatus();return}
    if(message.type==='ROOM_CLOSED'){const text=String(message.message||'Rummet stängdes.');reset();cb.onClosed(text)}
  }

  function playerMayReconnect(playerId){return !!(net.started&&net.state?.players?.some(player=>player.onlineId===playerId))}
  function removeGuest(playerId,conn){if(conn&&net.guestConnections.get(playerId)!==conn)return;net.guestConnections.delete(playerId);if(net.started){const player=net.players.find(item=>item.id===playerId);if(player)player.connected=false}else net.players=net.players.filter(player=>player.id!==playerId);broadcastLobby()}

  function attachGuest(conn){
    const meta=conn.metadata||{};const playerId=cleanPlayerId(meta.playerId);const name=cleanName(meta.name);
    if(!playerId||!name||Number(meta.protocol)!==ONLINE_PROTOCOL_VERSION){conn.close();return}
    const known=net.players.find(player=>player.id===playerId);const reconnecting=playerMayReconnect(playerId);
    if((net.started&&!reconnecting)||(!known&&!reconnecting&&net.players.length>=MAX_PLAYERS)){conn.on('open',()=>{send(conn,{protocol:ONLINE_PROTOCOL_VERSION,type:'ERROR',message:net.started?'Matchen har redan startat.':'Rummet är fullt.'});setTimeout(()=>conn.close(),120)});return}
    conn.on('open',()=>{const previous=net.guestConnections.get(playerId);if(previous&&previous!==conn)try{previous.close()}catch{}net.guestConnections.set(playerId,conn);const player=net.players.find(item=>item.id===playerId);if(player){player.connected=true;if(!net.started)player.name=name}else net.players.push({id:playerId,name,connected:true});send(conn,lobbyMessage());if(net.started&&net.state)send(conn,createStateMessage(net.state,net.revision));broadcastLobby()});
    conn.on('data',message=>{if(message?.protocol!==ONLINE_PROTOCOL_VERSION)return;if(message.type==='MOVE'){if(!net.started||!net.state){send(conn,{protocol:ONLINE_PROTOCOL_VERSION,type:'ERROR',message:'Matchen har inte startat.'});return}const ok=hostApplyMove(message,playerId,conn);if(!ok)send(conn,{protocol:ONLINE_PROTOCOL_VERSION,type:'ERROR',message:'Draget kunde inte godkännas.'})}});
    conn.on('close',()=>removeGuest(playerId,conn));conn.on('error',()=>removeGuest(playerId,conn));
  }

  function connectGuest(){
    if(net.role!=='guest'||!net.peer?.open||net.hostConn?.open)return;try{net.hostConn?.close()}catch{}
    const conn=net.peer.connect(roomPeerId(net.roomCode),{reliable:true,metadata:{protocol:ONLINE_PROTOCOL_VERSION,playerId:net.playerId,name:net.name}});net.hostConn=conn;setStatus(net.retries?'reconnecting':'connecting');
    const timeout=setTimeout(()=>{if(!conn.open)scheduleReconnect('peer-unavailable')},8000);
    conn.on('open',()=>{clearTimeout(timeout);markConnected('guest-data');if(net.pendingMove)send(conn,net.pendingMove)});
    conn.on('data',handleGuestMessage);conn.on('close',()=>{clearTimeout(timeout);if(net.role==='guest')scheduleReconnect('network')});conn.on('error',error=>{clearTimeout(timeout);if(net.role==='guest')scheduleReconnect(error?.type||'network')});
  }

  function scheduleReconnect(type='network'){
    if(net.role==='offline'||net.reconnectTimer)return;
    net.reconnectReason=String(type||'network');
    if(browserOffline()){net.reconnectAttempt=0;setStatus('reconnecting');return}
    if(net.retries>=RETRY_DELAYS.length){setStatus('error');cb.onError(new Error(networkError(type)));return}
    const delay=RETRY_DELAYS[net.retries];net.retries+=1;net.reconnectAttempt=net.retries;setStatus('reconnecting',{force:true});
    net.reconnectTimer=setTimeout(()=>{
      net.reconnectTimer=null;
      if(net.role==='offline')return;
      if(!net.peer?.open){
        try{net.peer?.reconnect?.()}catch{}
        net.reconnectTimer=setTimeout(()=>{
          net.reconnectTimer=null;
          if(net.role==='offline')return;
          if(!net.peer?.open)scheduleReconnect(type);
          else if(net.role==='guest'&&!net.hostConn?.open)connectGuest();
          else if(net.role==='host')markConnected('host-peer');
        },1200);
        return;
      }
      if(net.role==='guest'&&!net.hostConn?.open)connectGuest();
      else if(net.role==='host')markConnected('host-peer');
    },delay);
  }

  function peerOpened(){
    if(net.role==='host'){markConnected('host-peer');return}
    if(net.role==='guest'){clearReconnect();connectGuest()}
  }

  async function createRoom({name,code=makeRoomCode(),mode='classic'}={}){
    reset();name=cleanName(name);code=cleanRoom(code);if(!name)throw new Error('Skriv ditt namn.');if(!code)throw new Error('Rumskod saknas.');
    const PeerCtor=await loadPeer();Object.assign(net,{role:'host',status:'connecting',roomCode:code,playerId:HOST_ID,name,mode:mode==='duel'?'duel':'classic',players:[{id:HOST_ID,name,connected:true}]});emitLobby();emitStatus();
    const peer=new PeerCtor(roomPeerId(code),peerOptions());net.peer=peer;
    await new Promise((resolve,reject)=>{let opened=false;const timeout=setTimeout(()=>reject(new Error('Nätverkstjänsten svarar inte.')),9000);peer.on('open',()=>{clearTimeout(timeout);peerOpened();if(!opened){opened=true;resolve()}});peer.on('connection',attachGuest);peer.on('error',error=>{if(!peer.open&&!opened){clearTimeout(timeout);reject(new Error(networkError(error?.type)))}else if(!peer.open&&net.role==='host')scheduleReconnect(error?.type||'network');else cb.onError(new Error(networkError(error?.type)))});peer.on('disconnected',()=>{if(!peer.destroyed)scheduleReconnect('peer-disconnected')})});broadcastLobby();return snapshot();
  }

  async function joinRoom({name,code}={}){
    reset();name=cleanName(name);code=cleanRoom(code);if(!name)throw new Error('Skriv ditt namn.');if(!code)throw new Error('Skriv rumskoden.');
    const PeerCtor=await loadPeer();Object.assign(net,{role:'guest',status:'connecting',roomCode:code,playerId:makePlayerId(code),name});emitLobby();emitStatus();
    const peer=new PeerCtor(undefined,peerOptions());net.peer=peer;
    await new Promise((resolve,reject)=>{let opened=false;const timeout=setTimeout(()=>reject(new Error('Nätverkstjänsten svarar inte.')),9000);peer.on('open',()=>{clearTimeout(timeout);peerOpened();if(!opened){opened=true;resolve()}});peer.on('error',error=>{if(!peer.open&&!opened){clearTimeout(timeout);reject(new Error(networkError(error?.type)))}else if(!peer.open&&net.role==='guest')scheduleReconnect(error?.type||'network');else cb.onError(new Error(networkError(error?.type)))});peer.on('disconnected',()=>{if(!peer.destroyed)scheduleReconnect('peer-disconnected')})});return snapshot();
  }

  const onBrowserOnline=()=>{if(net.role==='offline'||net.status==='connected')return;clearReconnect();net.retries=0;net.reconnectAttempt=0;scheduleReconnect('browser-online')};
  if(typeof globalThis.addEventListener==='function')globalThis.addEventListener('online',onBrowserOnline);

  function setMode(mode){if(net.role!=='host'||net.started)return false;net.mode=mode==='duel'?'duel':'classic';broadcastLobby();return true}
  function startGame(){if(net.role!=='host')throw new Error('Bara värden kan starta matchen.');if(net.players.length!==MAX_PLAYERS||net.players.some(player=>player.connected===false))throw new Error('Två anslutna spelare krävs.');seenMoveIds.clear();clearPending();const roster=clone(net.players);net.state=createGame({mode:net.mode,players:roster.map(player=>player.name),playerIds:roster.map(player=>player.id)});net.revision=0;net.serverRevision=0;net.started=true;const message=createStateMessage(net.state,net.revision);broadcast(message);broadcastLobby();cb.onState({state:clone(net.state),role:net.role,playerId:net.playerId,revision:net.revision,ackMoveId:null});return clone(net.state)}
  function submitMove(place){if(!net.started||!net.state)throw new Error('Matchen har inte startat.');const current=net.state.players[net.state.turn];if(current?.onlineId!==net.playerId)throw new Error('Det är inte din tur.');if(net.pendingMoveId)throw new Error('Väntar på föregående drag.');const message=createMoveMessage(net.playerId,place);net.pendingMoveId=message.clientMoveId;net.pendingMove=clone(message);emitStatus();if(net.role==='host')return hostApplyMove(message,HOST_ID);if(!net.hostConn?.open){clearPending();throw new Error('Ingen kontakt med värden.')}send(net.hostConn,message);return true}
  function canMove(){return !!(net.started&&net.state?.status==='playing'&&!net.pendingMoveId&&net.state.players[net.state.turn]?.onlineId===net.playerId&&net.status==='connected')}
  function leave(){if(net.role==='host')broadcast({protocol:ONLINE_PROTOCOL_VERSION,type:'ROOM_CLOSED',message:'Värden stängde rummet.'});reset()}
  return {createRoom,joinRoom,setMode,startGame,submitMove,canMove,leave,snapshot,makeRoomCode};
}
