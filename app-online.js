'use strict';

(() => {
  const MAX_PLAYERS = 6;
  const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
  const ONLINE_CSS_ID = 'orten-online-css';
  const HOST_ID = 'host';
  const online = {
    role:'offline', status:'idle', roomCode:'', playerId:'', name:'', peer:null, hostConn:null,
    guestConnections:new Map(), lobby:[], lobbySettings:null, view:'menu', tab:'create', roomStarted:false,
    ready:false, pendingMove:false, applyingRemoteMove:false, generation:0, reconnectTimer:null, reconnectAttempts:0,
    lastError:'', peerLoadPromise:null
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const safeRoomCode = value => String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  const roomPeerId = code => `orten2-${safeRoomCode(code).toLowerCase()}`;
  const makePlayerId = code => {
    const key=`orten2:online-player:${safeRoomCode(code)}`;
    let id=storageGet(key);
    if(!id){id=`p-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`}`;storageSet(key,id)}
    return id;
  };
  const makeRoomCode = () => {
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out='';
    for(let i=0;i<5;i++) out+=chars[Math.floor(Math.random()*chars.length)];
    return out;
  };
  const peerOptions = () => {
    const iceServers=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
    const turn=globalThis.ORTEN_TURN;
    if(turn?.urls) iceServers.push({urls:turn.urls,username:turn.username||undefined,credential:turn.credential||undefined});
    return {debug:1,config:{iceServers,iceCandidatePoolSize:4}};
  };
  const networkError = type => {
    if(!navigator.onLine) return 'Ingen internetanslutning. Kontrollera wifi eller mobildata.';
    if(type==='peer-unavailable') return 'Rummet hittades inte. Kontrollera rumskoden och att spelledaren är ansluten.';
    if(type==='unavailable-id') return 'Rumskoden används redan. Välj en annan kod.';
    if(type==='network'||type==='server-error'||type==='socket-error') return 'Nätverksanslutningen misslyckades. Försök igen.';
    if(type==='webrtc') return 'Direktanslutningen kunde inte skapas. Prova ett annat nätverk.';
    return 'Anslutningen misslyckades. Försök igen.';
  };

  function ensureOnlineCss(){
    if(document.getElementById(ONLINE_CSS_ID))return;
    const currentSrc=document.currentScript?.src||'';let build='dev';
    try{build=new URL(currentSrc,location.href).searchParams.get('v')||'dev'}catch{}
    const link=document.createElement('link');link.id=ONLINE_CSS_ID;link.rel='stylesheet';link.href=`styles-online.css?v=${encodeURIComponent(build)}`;document.head.appendChild(link);
  }

  function ensurePeerJs(){
    if(globalThis.Peer)return Promise.resolve(globalThis.Peer);
    if(online.peerLoadPromise)return online.peerLoadPromise;
    online.peerLoadPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-orten-peerjs]');
      if(existing){existing.addEventListener('load',()=>globalThis.Peer?resolve(globalThis.Peer):reject(new Error('PeerJS kunde inte starta.')),{once:true});existing.addEventListener('error',()=>reject(new Error('PeerJS kunde inte laddas.')),{once:true});return}
      const s=document.createElement('script');s.src=PEERJS_URL;s.async=true;s.dataset.ortenPeerjs='1';
      s.onload=()=>globalThis.Peer?resolve(globalThis.Peer):reject(new Error('PeerJS kunde inte starta.'));
      s.onerror=()=>reject(new Error('PeerJS kunde inte laddas. Kontrollera nätet.'));
      document.head.appendChild(s);
    }).catch(err=>{online.peerLoadPromise=null;throw err});
    return online.peerLoadPromise;
  }

  function createOnlineUi(){
    if($('onlineButton'))return;
    ensureOnlineCss();
    const button=document.createElement('button');button.id='onlineButton';button.type='button';button.className='online-top-button';button.innerHTML='<span>●</span> Online';
    button.addEventListener('click',openOnlineModal);
    els.howToButton?.parentNode?.insertBefore(button,els.howToButton);

    const modal=document.createElement('div');modal.id='onlineModal';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.innerHTML=`
      <div class="modal-backdrop" data-online-close></div>
      <section class="modal-card online-modal-card">
        <button class="modal-close" id="onlineCloseButton" type="button" aria-label="Stäng">×</button>
        <div id="onlineModalBody"></div>
      </section>`;
    document.body.appendChild(modal);
    $('onlineCloseButton').addEventListener('click',closeOnlineModal);
    modal.querySelector('[data-online-close]').addEventListener('click',closeOnlineModal);

    const badge=document.createElement('button');badge.id='onlineGameBadge';badge.type='button';badge.className='status-badge online-game-badge hidden';badge.addEventListener('click',openOnlineModal);
    document.querySelector('.game-status-row')?.appendChild(badge);
    renderOnline();
  }

  function openOnlineModal(){
    if(online.role==='offline') online.view='menu'; else online.view='lobby';
    renderOnline();$('onlineModal')?.classList.remove('hidden');
  }
  function closeOnlineModal(){ $('onlineModal')?.classList.add('hidden'); }

  function statusText(){
    return {idle:'Inte ansluten',connecting:'Ansluter…',reconnecting:'Återansluter…',connected:'Ansluten',error:'Anslutningsfel'}[online.status]||online.status;
  }
  function settingsText(s=online.lobbySettings){
    if(!s)return 'Inställningar hämtas…';
    return `${modeIcon(s.mode)} ${modeLabel(s.mode)} · ${scopeLabel(s)} · ${themeLabel(s.mapTheme)}`;
  }
  function lobbyCanStart(){
    const connected=online.lobby.filter(p=>p.connected);
    const minPlayers=online.lobbySettings?.mode==='elimination'?3:2;
    return online.role==='host' && !online.roomStarted && connected.length>=minPlayers && connected.length<=MAX_PLAYERS && connected.every(p=>p.id===HOST_ID||p.ready) && online.lobbySettings?.mode!=='solo';
  }
  function lobbyPlayersHtml(){
    if(!online.lobby.length)return '<div class="online-empty">Väntar på spelare…</div>';
    return online.lobby.map((p,i)=>`<div class="online-player${p.connected?'':' disconnected'}">
      <i style="--p:${PLAYER_COLORS[i%PLAYER_COLORS.length]}"></i>
      <span><strong>${esc(p.name)}</strong><small>${p.id===HOST_ID?'Spelledare':p.connected?(p.ready?'Redo':'Inte redo'):'Frånkopplad'}</small></span>
      <b>${p.connected?(p.id===HOST_ID?'★':p.ready?'✓':'…'):'×'}</b>
    </div>`).join('');
  }

  function renderOnline(){
    const body=$('onlineModalBody');if(!body)return;
    const badge=$('onlineGameBadge');
    if(badge){
      const active=online.role!=='offline'&&game.active;
      badge.classList.toggle('hidden',!active);
      if(active)badge.textContent=`● ${safeRoomCode(online.roomCode)} · ${online.status==='connected'?'Online':statusText()}`;
    }
    if(online.view==='menu'&&online.role==='offline'){
      body.innerHTML=`
        <span class="step-kicker">ONLINE</span><h2>Spela Orten tillsammans</h2>
        <p class="online-intro">Skapa ett rum på en enhet och låt de andra ansluta med rumskoden. Spelledaren styr reglerna och spelet synkas mellan alla enheter.</p>
        <div class="online-tabs"><button type="button" data-online-tab="create" class="${online.tab==='create'?'active':''}">Skapa rum</button><button type="button" data-online-tab="join" class="${online.tab==='join'?'active':''}">Anslut</button></div>
        ${online.tab==='create'?`
          <div class="online-form">
            <label>Ditt namn<input id="onlineHostName" maxlength="24" value="${esc(storageGet('orten2:online-name')||'Spelledare')}"></label>
            <label>Rumskod<div class="online-code-input"><input id="onlineCreateCode" maxlength="8" value="${esc(makeRoomCode())}"><button id="onlineNewCode" type="button">Ny kod</button></div></label>
            <div class="online-settings-preview"><span>Inställningar från startsidan</span><strong>${esc(settingsText(deepSettings()))}</strong></div>
            <button id="onlineCreateButton" class="primary-button" type="button">Skapa rum</button>
          </div>`:`
          <div class="online-form">
            <label>Ditt namn<input id="onlineGuestName" maxlength="24" value="${esc(storageGet('orten2:online-name')||'Spelare')}"></label>
            <label>Rumskod<input id="onlineJoinCode" maxlength="8" inputmode="text" autocapitalize="characters" value="${esc(new URLSearchParams(location.search).get('room')||'')}"></label>
            <button id="onlineJoinButton" class="primary-button" type="button">Anslut till rum</button>
          </div>`}
        <div id="onlineMenuError" class="online-error${online.lastError?'':' hidden'}">${esc(online.lastError)}</div>
        <div class="online-network-note">Direktanslutning via WebRTC/PeerJS · återanslutning sker automatiskt om nätet bryts.</div>`;
      body.querySelectorAll('[data-online-tab]').forEach(b=>b.addEventListener('click',()=>{online.tab=b.dataset.onlineTab;online.lastError='';renderOnline()}));
      $('onlineNewCode')?.addEventListener('click',()=>{$('onlineCreateCode').value=makeRoomCode()});
      $('onlineCreateButton')?.addEventListener('click',()=>createRoom($('onlineHostName').value,$('onlineCreateCode').value));
      $('onlineJoinButton')?.addEventListener('click',()=>joinRoom($('onlineGuestName').value,$('onlineJoinCode').value));
      return;
    }

    const isHost=online.role==='host';
    const own=online.lobby.find(p=>p.id===online.playerId);
    body.innerHTML=`
      <div class="online-lobby-head"><div><span class="step-kicker">${isHost?'SPELRUM':'ANSLUTEN TILL RUM'}</span><h2>${esc(safeRoomCode(online.roomCode))}</h2></div><span class="online-status ${online.status}">● ${esc(statusText())}</span></div>
      <div class="online-room-code"><span>Rumskod</span><strong>${esc(safeRoomCode(online.roomCode))}</strong><button id="onlineCopyCode" type="button">Kopiera</button></div>
      <div class="online-settings-preview"><span>Match</span><strong>${esc(settingsText())}</strong></div>
      ${online.lobbySettings?.mode==='solo'?'<div class="online-error">Solo kan inte startas online. Spelledaren måste välja Klassisk, Tålighet eller Utslagning.</div>':''}
      <div class="online-lobby-section"><div class="online-section-head"><strong>Spelare</strong><span>${online.lobby.filter(p=>p.connected).length}/${MAX_PLAYERS}</span></div><div class="online-player-list">${lobbyPlayersHtml()}</div></div>
      ${online.lastError?`<div class="online-error">${esc(online.lastError)}</div>`:''}
      <div class="online-actions">
        ${isHost?`<button id="onlineRefreshSettings" class="ghost-button" type="button">Hämta aktuella inställningar</button><button id="onlineStartGame" class="primary-button" type="button" ${lobbyCanStart()?'':'disabled'}>${online.roomStarted?'Spelet pågår':'Starta onlinespelet'}</button>`:`<button id="onlineReadyButton" class="primary-button" type="button" ${online.roomStarted?'disabled':''}>${own?.ready?'✓ Redo':'Jag är redo'}</button>`}
        <button id="onlineLeaveButton" class="ghost-button" type="button">${isHost?'Stäng rummet':'Lämna rummet'}</button>
      </div>
      <p class="online-network-note">${isHost?'Minst två anslutna spelare krävs. Alla deltagare måste markera Redo innan start.':'Vänta på att spelledaren startar matchen. Du kan stänga denna ruta under tiden.'}</p>`;
    $('onlineCopyCode')?.addEventListener('click',copyRoomCode);
    $('onlineRefreshSettings')?.addEventListener('click',()=>{online.lobbySettings=deepSettings();broadcastLobby();renderOnline()});
    $('onlineStartGame')?.addEventListener('click',startHostGame);
    $('onlineReadyButton')?.addEventListener('click',toggleReady);
    $('onlineLeaveButton')?.addEventListener('click',()=>leaveOnline(true));
  }

  async function copyRoomCode(){
    try{await navigator.clipboard.writeText(safeRoomCode(online.roomCode));toast('Rumskoden kopierad.')}catch{toast(`Rumskod: ${safeRoomCode(online.roomCode)}`)}
  }

  function clearReconnect(){if(online.reconnectTimer){clearTimeout(online.reconnectTimer);online.reconnectTimer=null}}
  function closePeerObjects(){
    clearReconnect();online.generation++;
    try{online.hostConn?.close()}catch{} online.hostConn=null;
    for(const conn of online.guestConnections.values()){try{conn.close()}catch{}}
    online.guestConnections.clear();
    try{online.peer?.destroy()}catch{} online.peer=null;
    online.reconnectAttempts=0;
  }
  function resetOnlineState(){
    closePeerObjects();online.role='offline';online.status='idle';online.roomCode='';online.playerId='';online.name='';online.lobby=[];online.lobbySettings=null;online.view='menu';online.roomStarted=false;online.ready=false;online.pendingMove=false;online.lastError='';renderOnline();
  }

  async function createRoom(name,code){
    name=String(name||'').trim();code=safeRoomCode(code);
    if(!name||!code){online.lastError='Skriv namn och rumskod.';renderOnline();return}
    if(settings.mode==='solo'){online.lastError='Solo kan inte användas online. Välj ett flerspelarläge först.';renderOnline();return}
    storageSet('orten2:online-name',name);closePeerObjects();
    online.role='host';online.status='connecting';online.roomCode=code;online.playerId=HOST_ID;online.name=name;online.view='lobby';online.roomStarted=false;online.lastError='';online.lobbySettings=deepSettings();online.lobby=[{id:HOST_ID,name,connected:true,ready:true}];renderOnline();
    try{
      const PeerCtor=await ensurePeerJs();const generation=online.generation;const peer=new PeerCtor(roomPeerId(code),peerOptions());online.peer=peer;
      const timeout=setTimeout(()=>{if(generation!==online.generation||peer.open)return;online.status='error';online.lastError='Nätverkstjänsten svarar inte. Försök igen.';renderOnline()},9000);
      peer.on('open',()=>{clearTimeout(timeout);if(generation!==online.generation)return;online.status='connected';online.lastError='';renderOnline()});
      peer.on('connection',attachGuestConnection);
      peer.on('disconnected',()=>{if(generation!==online.generation||peer.destroyed)return;online.status='reconnecting';online.lastError='Kontakten med nätverkstjänsten bröts. Återansluter…';renderOnline();online.reconnectTimer=setTimeout(()=>{try{if(peer.disconnected&&!peer.destroyed)peer.reconnect()}catch{}},1200)});
      peer.on('error',err=>{clearTimeout(timeout);if(generation!==online.generation)return;online.status='error';online.lastError=networkError(err?.type);renderOnline()});
    }catch(err){online.status='error';online.lastError=err?.message||'Kunde inte starta onlinefunktionen.';renderOnline()}
  }

  function attachGuestConnection(conn){
    let playerId='';
    conn.on('open',()=>{conn.send({type:'LOBBY',players:clone(online.lobby),settings:clone(online.lobbySettings),roomStarted:online.roomStarted})});
    conn.on('data',raw=>{
      const msg=raw||{};
      if(msg.type==='HELLO'){
        const id=String(msg.playerId||'');const name=String(msg.name||'').trim().slice(0,24);if(!id||!name)return;
        const existing=online.lobby.find(p=>p.id===id);
        if(!existing&&online.lobby.filter(p=>p.connected).length>=MAX_PLAYERS){conn.send({type:'ERROR',message:'Rummet är fullt.'});conn.close();return}
        playerId=id;conn._ortenPlayerId=id;
        const old=online.guestConnections.get(id);if(old&&old!==conn){try{old.close()}catch{}}
        online.guestConnections.set(id,conn);
        if(existing){existing.name=name;existing.connected=true}else online.lobby.push({id,name,connected:true,ready:false});
        const gp=game.players.find(p=>p.onlineId===id);if(gp)gp.onlineConnected=true;
        broadcastLobby();if(online.roomStarted&&game.active)sendState(conn);renderOnline();return;
      }
      if(msg.type==='READY'&&playerId){const p=online.lobby.find(x=>x.id===playerId);if(p){p.ready=!!msg.ready;broadcastLobby();renderOnline()}return}
      if(msg.type==='MOVE'&&playerId){handleGuestMove(playerId,msg.place,conn);return}
      if(msg.type==='LEAVE'&&playerId){const p=online.lobby.find(x=>x.id===playerId);if(p){p.connected=false;p.ready=false}online.guestConnections.delete(playerId);broadcastLobby();renderOnline();return}
    });
    const disconnected=()=>{
      if(!playerId)return;const current=online.guestConnections.get(playerId);if(current===conn)online.guestConnections.delete(playerId);
      const p=online.lobby.find(x=>x.id===playerId);if(p){p.connected=false;p.ready=false}
      const gp=game.players.find(p=>p.onlineId===playerId);if(gp)gp.onlineConnected=false;
      broadcastLobby();if(online.roomStarted)broadcastStateSoon();renderOnline();
    };
    conn.on('close',disconnected);conn.on('error',disconnected);
  }

  function broadcast(message){for(const conn of online.guestConnections.values()){if(conn?.open){try{conn.send(message)}catch{}}}}
  function broadcastLobby(){
    if(online.role!=='host')return;
    const msg={type:'LOBBY',players:clone(online.lobby),settings:clone(online.lobbySettings),roomStarted:online.roomStarted};broadcast(msg);
  }

  async function joinRoom(name,code){
    name=String(name||'').trim();code=safeRoomCode(code);
    if(!name||!code){online.lastError='Skriv namn och rumskod.';renderOnline();return}
    storageSet('orten2:online-name',name);closePeerObjects();
    online.role='guest';online.status='connecting';online.roomCode=code;online.playerId=makePlayerId(code);online.name=name;online.view='lobby';online.lobby=[];online.lobbySettings=null;online.roomStarted=false;online.ready=false;online.lastError='';renderOnline();
    try{
      const PeerCtor=await ensurePeerJs();const generation=online.generation;const peer=new PeerCtor(peerOptions());online.peer=peer;
      const timeout=setTimeout(()=>{if(generation!==online.generation||peer.open)return;online.status='error';online.lastError='Nätverkstjänsten svarar inte. Försök igen.';renderOnline()},9000);
      peer.on('open',()=>{clearTimeout(timeout);if(generation!==online.generation)return;connectGuestToHost()});
      peer.on('disconnected',()=>{if(generation!==online.generation||peer.destroyed)return;online.status='reconnecting';renderOnline();try{peer.reconnect()}catch{}});
      peer.on('error',err=>{if(generation!==online.generation)return;if(err?.type==='peer-unavailable')scheduleGuestReconnect(err.type);else{online.status='error';online.lastError=networkError(err?.type);renderOnline()}});
    }catch(err){online.status='error';online.lastError=err?.message||'Kunde inte starta onlinefunktionen.';renderOnline()}
  }

  function connectGuestToHost(){
    const peer=online.peer;if(online.role!=='guest'||!peer||peer.destroyed)return;
    clearReconnect();online.status=online.reconnectAttempts?'reconnecting':'connecting';renderOnline();
    const conn=peer.connect(roomPeerId(online.roomCode),{reliable:true,serialization:'json'});online.hostConn=conn;let opened=false;
    const timeout=setTimeout(()=>{if(opened||conn.open)return;try{conn.close()}catch{}scheduleGuestReconnect('peer-unavailable')},8000);
    conn.on('open',()=>{opened=true;clearTimeout(timeout);online.status='connected';online.lastError='';online.reconnectAttempts=0;conn.send({type:'HELLO',playerId:online.playerId,name:online.name});renderOnline()});
    conn.on('data',handleHostMessage);
    conn.on('close',()=>{clearTimeout(timeout);if(online.role==='guest')scheduleGuestReconnect('network')});
    conn.on('error',()=>{clearTimeout(timeout);if(online.role==='guest')scheduleGuestReconnect('webrtc')});
  }
  function scheduleGuestReconnect(type){
    if(online.role!=='guest')return;clearReconnect();
    if(online.reconnectAttempts>=4){online.status='error';online.lastError=networkError(type);online.pendingMove=false;renderOnline();updateGameUI?.();return}
    const delay=Math.min(1000*2**online.reconnectAttempts,8000);online.reconnectAttempts++;online.status='reconnecting';online.lastError=`Anslutningen bröts. Nytt försök om ${Math.ceil(delay/1000)} s…`;renderOnline();
    online.reconnectTimer=setTimeout(()=>{if(online.peer?.open)connectGuestToHost();else{try{online.peer?.reconnect()}catch{}online.reconnectTimer=setTimeout(connectGuestToHost,1200)}},delay);
  }

  function handleHostMessage(raw){
    const msg=raw||{};
    if(msg.type==='LOBBY'){
      online.lobby=Array.isArray(msg.players)?msg.players:[];online.lobbySettings=msg.settings||online.lobbySettings;online.roomStarted=!!msg.roomStarted;
      const own=online.lobby.find(p=>p.id===online.playerId);if(own)online.ready=!!own.ready;renderOnline();return;
    }
    if(msg.type==='START'||msg.type==='STATE'){online.roomStarted=true;applyRemoteState(msg.payload);closeOnlineModal();return}
    if(msg.type==='MOVE_RESULT'){
      online.pendingMove=false;if(msg.success){els.placeInput.value='';setSearchState('Drag godkänt av spelledaren.')}else{setSearchState(msg.message||'Draget nekades av spelledaren.','error');toast(msg.message||'Draget kunde inte spelas.','error',4200)}updateGameUI();return;
    }
    if(msg.type==='ROOM_CLOSED'){toast(msg.message||'Spelledaren stängde rummet.','error',4200);resetOnlineState();game.active=false;closeAllGameModals();showScreen('setup');updateSetupUI(false);return}
    if(msg.type==='ERROR'){online.lastError=String(msg.message||'Ett nätverksfel inträffade.');online.status='error';renderOnline();toast(online.lastError,'error',4200)}
  }

  function toggleReady(){
    if(online.role!=='guest'||!online.hostConn?.open)return;
    online.ready=!online.ready;online.hostConn.send({type:'READY',ready:online.ready});
    const own=online.lobby.find(p=>p.id===online.playerId);if(own)own.ready=online.ready;renderOnline();
  }

  const baseCommitPlace = commitPlace;
  function validateRemotePlace(place){
    if(!place||typeof place.name!=='string'||!Number.isFinite(Number(place.lat))||!Number.isFinite(Number(place.lon))||!/^[A-Z]{2}$/.test(String(place.countryCode||'')))return 'Ogiltig ortdata.';
    const codes=scopeCodes(game.settings);if(codes&&!codes.includes(place.countryCode))return `${place.name} ligger utanför valt spelområde.`;
    if(isDuplicate(place))return `${place.name} har redan använts enligt dubblettregeln.`;
    if(game.settings?.placeType==='urban' && place.type==='settlement')return `${place.name} är för liten för valt ortfilter.`;
    if(game.settings?.placeType==='city' && (place.type==='settlement'||place.type==='urban'))return `${place.name} matchar inte valt stadsfilter.`;
    return '';
  }
  function handleGuestMove(playerId,place,conn){
    if(online.role!=='host'||!online.roomStarted||!game.active)return;
    const current=game.players[game.currentIndex];
    if(!current||current.onlineId!==playerId){conn.send({type:'MOVE_RESULT',success:false,message:'Det är inte din tur.'});return}
    if(game.finished||game.paused||game.pendingNextRound){conn.send({type:'MOVE_RESULT',success:false,message:'Spelet tar inte emot drag just nu.'});return}
    const error=validateRemotePlace(place);if(error){conn.send({type:'MOVE_RESULT',success:false,message:error});return}
    online.applyingRemoteMove=true;const before=game.totalMoves;
    try{baseCommitPlace(clone(place))}finally{online.applyingRemoteMove=false}
    const success=game.totalMoves>before;conn.send({type:'MOVE_RESULT',success,message:success?'':'Draget kunde inte registreras.'});
    if(success)broadcastStateSoon();
  }

  function uiResultSnapshot(){
    if(!els.resultModal||els.resultModal.classList.contains('hidden'))return null;
    return {icon:els.resultIcon.textContent,title:els.resultTitle.textContent,text:els.resultText.textContent,stats:els.resultStats.innerHTML};
  }
  function statePayload(){return {game:clone(game),result:uiResultSnapshot(),paused:!!game.paused};}
  function sendState(conn){if(conn?.open)conn.send({type:'STATE',payload:statePayload()})}
  let stateTimer=null;
  function broadcastStateSoon(){
    if(online.role!=='host'||!online.roomStarted)return;clearTimeout(stateTimer);stateTimer=setTimeout(()=>{broadcast({type:'STATE',payload:statePayload()});renderOnline()},20);
  }

  function applyRemoteState(payload){
    if(online.role!=='guest'||!payload?.game)return;
    const incoming=clone(payload.game);Object.assign(game,incoming);if(game.settings)Object.assign(settings,clone(game.settings));
    showScreen('game');closeAllGameModals();initMap();renderMap();updateRecentChoices();updateGameUI();warmPlaceIndex();
    if(game.route.length)fitRoute(false);else resetMapToInitial();
    if(payload.result){
      els.resultIcon.textContent=payload.result.icon||'🌐';els.resultTitle.textContent=payload.result.title||'Resultat';els.resultText.textContent=payload.result.text||'';els.resultStats.innerHTML=payload.result.stats||'';
      els.continueButton.classList.remove('hidden');els.continueButton.disabled=true;els.continueButton.textContent='Väntar på spelledaren…';els.playAgainButton.classList.add('hidden');els.changeSettingsButton.classList.add('hidden');els.resultModal.classList.remove('hidden');
    }
    if(payload.paused&&!game.finished)els.pauseModal.classList.remove('hidden');
    renderOnline();
  }

  function startHostGame(){
    if(online.role!=='host'||online.roomStarted)return;
    const roster=online.lobby.filter(p=>p.connected);
    const minPlayers=online.lobbySettings?.mode==='elimination'?3:2;
    if(roster.length<minPlayers)return toast(`Minst ${minPlayers} spelare måste vara anslutna för detta spelläge.`,'error');
    if(roster.some(p=>p.id!==HOST_ID&&!p.ready))return toast('Alla deltagare måste vara redo.','error');
    if(online.lobbySettings?.mode==='solo')return toast('Solo kan inte startas online.','error');
    Object.assign(settings,clone(online.lobbySettings||deepSettings()));settings.playerCount=roster.length;settings.playerNames=[...roster.map(p=>p.name),...settings.playerNames.slice(roster.length)];
    startGame();
    game.players.forEach((p,i)=>{p.onlineId=roster[i]?.id||`p-${i}`;p.onlineConnected=true});
    online.roomStarted=true;broadcastLobby();broadcast({type:'START',payload:statePayload()});renderOnline();closeOnlineModal();updateGameUI();toast(`Online-rum ${online.roomCode} startat.`);
  }

  function onlineRestartHost(){
    if(online.role!=='host')return;
    const roster=game.players.map(p=>({id:p.onlineId,name:p.name}));
    const saved=clone(game.settings||online.lobbySettings||deepSettings());Object.assign(settings,saved);settings.playerCount=roster.length;settings.playerNames=[...roster.map(p=>p.name),...settings.playerNames.slice(roster.length)];startGame();
    game.players.forEach((p,i)=>{p.onlineId=roster[i]?.id;p.onlineConnected=online.lobby.find(x=>x.id===p.onlineId)?.connected!==false});broadcastStateSoon();
  }

  function onlineCanMove(){
    if(online.role==='offline')return true;if(!game.active||game.finished||game.paused||game.pendingNextRound||online.pendingMove)return false;
    const current=game.players[game.currentIndex];return !!current&&current.onlineId===online.playerId;
  }

  commitPlace = function(place){
    if(online.role==='offline')return baseCommitPlace(place);
    if(online.role==='guest'){
      if(!onlineCanMove())return toast('Det är inte din tur.','error');if(!online.hostConn?.open)return toast('Ingen kontakt med spelledaren.','error');
      if(isDuplicate(place))return toast(`${place.name} har redan använts enligt dubblettregeln.`,'error',3900);
      online.pendingMove=true;online.hostConn.send({type:'MOVE',playerId:online.playerId,place:clone(place)});setSearchState('Skickar draget till spelledaren…','loading');updateGameUI();return;
    }
    if(online.role==='host'&&!online.applyingRemoteMove&&!onlineCanMove())return toast('Det är en annan spelares tur.','error');
    const before=game.totalMoves;baseCommitPlace(place);if(online.role==='host'&&game.totalMoves>before)broadcastStateSoon();
  };

  const baseUpdateGameUI=updateGameUI;
  updateGameUI=function(){
    baseUpdateGameUI();if(online.role==='offline'||!game.active)return;
    const canMove=onlineCanMove();els.placeInput.disabled=els.placeInput.disabled||!canMove;els.playButton.disabled=els.placeInput.disabled;
    const current=game.players[game.currentIndex];
    if(!game.finished&&!game.paused){
      if(canMove)els.turnSubtext.textContent=`Din tur · ${online.role==='host'?'spelledare':'online'}`;
      else if(current)els.turnSubtext.textContent=`Väntar på ${current.name}${current.onlineConnected===false?' · frånkopplad':''}`;
    }
    els.pauseButton.disabled=online.role==='guest';els.restartButton.disabled=online.role==='guest';renderOnline();
  };

  const baseTickTimer=tickTimer;
  tickTimer=function(){
    if(online.role==='guest')return;
    const beforeTimer=game.timerRemaining,beforeIndex=game.currentIndex;baseTickTimer();
    if(online.role==='host'&&online.roomStarted&&(game.timerRemaining!==beforeTimer||game.currentIndex!==beforeIndex))broadcastStateSoon();
  };
  if(gameTimer){clearInterval(gameTimer);gameTimer=setInterval(tickTimer,1000)}

  const basePauseGame=pauseGame,baseResumeGame=resumeGame,baseContinueElimination=continueElimination,baseExitToSetup=exitToSetup;
  pauseGame=function(){if(online.role==='guest')return;const before=game.paused;basePauseGame();if(online.role==='host'&&game.paused!==before)broadcastStateSoon()};
  resumeGame=function(){if(online.role==='guest')return;baseResumeGame();if(online.role==='host')broadcastStateSoon()};
  continueElimination=function(){if(online.role==='guest')return;baseContinueElimination();if(online.role==='host')broadcastStateSoon()};

  function leaveOnline(toSetup=false){
    if(online.role==='host')broadcast({type:'ROOM_CLOSED',message:'Spelledaren stängde rummet.'});
    else if(online.role==='guest'&&online.hostConn?.open){try{online.hostConn.send({type:'LEAVE',playerId:online.playerId})}catch{}}
    resetOnlineState();closeOnlineModal();if(toSetup&&game.active){baseExitToSetup()}
  }

  function guardOnlineButtons(){
    const intercept=(id,handler)=>$(id)?.addEventListener('click',e=>{if(online.role==='offline')return;e.preventDefault();e.stopImmediatePropagation();handler()},true);
    intercept('exitGameButton',()=>leaveOnline(true));intercept('changeSettingsButton',()=>leaveOnline(true));
    intercept('restartButton',()=>online.role==='host'?onlineRestartHost():toast('Spelledaren styr omstarten.','error'));
    intercept('playAgainButton',()=>online.role==='host'?onlineRestartHost():toast('Spelledaren styr omstarten.','error'));
    ['pauseButton','resumeButton','continueButton'].forEach(id=>$(id)?.addEventListener('click',e=>{
      if(online.role==='guest'){e.preventDefault();e.stopImmediatePropagation();toast('Spelledaren styr detta.','error');return}
      if(online.role==='host')setTimeout(broadcastStateSoon,0);
    },true));
  }

  function bootstrap(){
    createOnlineUi();guardOnlineButtons();
    const requested=safeRoomCode(new URLSearchParams(location.search).get('room')||'');
    if(requested){online.tab='join';setTimeout(()=>{openOnlineModal();const input=$('onlineJoinCode');if(input)input.value=requested},80)}
    addEventListener('online',()=>{if(online.role==='guest'&&online.status!=='connected')scheduleGuestReconnect('network')});
    addEventListener('beforeunload',()=>{if(online.role==='guest'&&online.hostConn?.open){try{online.hostConn.send({type:'LEAVE',playerId:online.playerId})}catch{}}});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();
})();
