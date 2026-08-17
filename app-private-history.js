'use strict';

(() => {
  const CORE=window.OrtenPrivateHistoryCore;
  if(!CORE){console.warn('Privat spelhistorik kunde inte starta: krypteringsmotorn saknas.');return}

  const GLOBAL=window.OrtenGlobalHighscore;
  const PROJECT_URL=GLOBAL?.PROJECT_URL||'https://mewauzsogkbcchnvsath.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_lWTB9F286pzThGxYp3Zj2w_uIco-VDU';
  const SDK_URL=GLOBAL?.SDK_URL||'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
  const TABLE=GLOBAL?.TABLE||'orten_highscores';
  const ADMIN_KEY_STORAGE='orten2:private-history-admin-key:v1';
  const PENDING_STORAGE='orten2:private-history-pending:v1';
  const HISTORY_HOURS=48;
  const PLAYER_COLORS_LOCAL=['#68f6ff','#ff8f70','#ffd86a','#73f5a7','#c69cff','#75a7ff'];

  const byId=id=>document.getElementById(id);
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>{try{return JSON.parse(JSON.stringify(value))}catch{return null}};
  const storageGet=key=>{try{return localStorage.getItem(key)}catch{return null}};
  const storageSet=(key,value)=>{try{localStorage.setItem(key,value);return true}catch{return false}};
  const storageRemove=key=>{try{localStorage.removeItem(key)}catch{}};

  let sdkPromise=null;
  let clientPromise=null;
  let sessionPromise=null;
  let saveQueue=Promise.resolve();
  let mainTrack=null;
  let streetTrack=null;
  let currentAdminKey='';
  let adminSessions=[];
  let adminMap=null;
  let adminLayer=null;

  function injectStyles(){
    if(document.querySelector('link[data-private-history-css]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.dataset.privateHistoryCss='true';
    try{
      const src=new URL(document.currentScript?.src||location.href,location.href),url=new URL('styles-private-history.css',src),version=src.searchParams.get('v');
      if(version)url.searchParams.set('v',version);link.href=url.href;
    }catch{link.href='styles-private-history.css'}
    document.head.appendChild(link);
  }

  function loadSDK(){
    if(window.supabase?.createClient)return Promise.resolve(window.supabase);
    if(sdkPromise)return sdkPromise;
    sdkPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-orten-supabase-sdk]');
      const finish=()=>window.supabase?.createClient?resolve(window.supabase):reject(new Error('Supabase SDK kunde inte startas.'));
      if(existing){existing.addEventListener('load',finish,{once:true});existing.addEventListener('error',()=>reject(new Error('Supabase SDK kunde inte laddas.')),{once:true});if(window.supabase?.createClient)finish();return}
      const script=document.createElement('script');script.src=SDK_URL;script.async=true;script.crossOrigin='anonymous';script.dataset.ortenSupabaseSdk='true';script.addEventListener('load',finish,{once:true});script.addEventListener('error',()=>reject(new Error('Supabase SDK kunde inte laddas.')),{once:true});document.head.appendChild(script);
    }).catch(error=>{sdkPromise=null;throw error});
    return sdkPromise;
  }

  async function getClient(){
    if(clientPromise)return clientPromise;
    clientPromise=loadSDK().then(sdk=>sdk.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'orten2-private-history-auth'}})).catch(error=>{clientPromise=null;throw error});
    return clientPromise;
  }

  async function ensureAnonymousUser(){
    if(sessionPromise)return sessionPromise;
    sessionPromise=(async()=>{
      const client=await getClient(),current=await client.auth.getSession();
      if(current.error)throw current.error;
      if(current.data?.session?.user)return current.data.session.user;
      const signed=await client.auth.signInAnonymously();
      if(signed.error)throw signed.error;
      if(!signed.data?.user)throw new Error('Ingen anonym spelaridentitet skapades.');
      return signed.data.user;
    })().catch(error=>{sessionPromise=null;throw error});
    return sessionPromise;
  }

  function cleanSettings(value={}){
    return {
      mode:String(value.mode||''),scope:String(value.scope||''),continent:String(value.continent||''),country:String(value.country||''),countries:[...(value.countries||[])].map(String).slice(0,260),
      placeType:String(value.placeType||''),duplicatePolicy:String(value.duplicatePolicy||''),strikeLimit:Number(value.strikeLimit)||0,timer:Number(value.timer)||0,mapTheme:String(value.mapTheme||'')
    };
  }

  function cleanRoute(route=[]){
    return (Array.isArray(route)?route:[]).slice(0,800).map((p,index)=>({
      index:index+1,name:String(p?.name||`Ort ${index+1}`).slice(0,120),lat:Number(p?.lat),lon:Number(p?.lon),countryCode:String(p?.countryCode||'').slice(0,3),country:String(p?.country||'').slice(0,80),region:String(p?.region||'').slice(0,100),
      playerIndex:Number.isFinite(Number(p?.playerIndex))?Number(p.playerIndex):0,moveNumber:Number(p?.moveNumber)||index+1,playerMoveNumber:Number(p?.playerMoveNumber)||null
    })).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180);
  }

  function cleanCrossings(value=[]){
    return (Array.isArray(value)?value:[]).slice(0,30).map(c=>({lat:Number(c?.lat),lon:Number(c?.lon),crossedSegmentIndex:Number.isFinite(Number(c?.crossedSegmentIndex))?Number(c.crossedSegmentIndex):null,crossedStartIndex:Number.isFinite(Number(c?.crossedStartIndex))?Number(c.crossedStartIndex):null,crossedEndIndex:Number.isFinite(Number(c?.crossedEndIndex))?Number(c.crossedEndIndex):null})).filter(c=>Number.isFinite(c.lat)&&Number.isFinite(c.lon));
  }

  function currentRoundSnapshot(){
    try{return {round:Number(game?.round)||1,route:cleanRoute(game?.route||[]),crossings:cleanCrossings(game?.lastCrossings||[])}}catch{return {round:1,route:[],crossings:[]}}
  }

  function onlineRoomCode(){
    const badge=byId('onlineGameBadge');
    if(!badge||badge.classList.contains('hidden'))return '';
    const match=String(badge.textContent||'').match(/\b([A-Z2-9]{4,8})\b/);return match?.[1]||'';
  }

  function startMainTracking(){
    const round=currentRoundSnapshot();
    mainTrack={startedAt:Date.now(),done:false,rounds:[],lastRound:round,lastRouteLength:round.route.length,lastRoundNumber:round.round};
  }

  function pushTrackedRound(track,round){
    if(!track||!round||!round.route?.length)return;
    const existing=track.rounds.findIndex(item=>Number(item.round)===Number(round.round));
    if(existing>=0)track.rounds[existing]=round;else track.rounds.push(round);
  }

  function mainSnapshot(status){
    const current=currentRoundSnapshot();
    if(mainTrack?.lastRound&&mainTrack.lastRound.route?.length)pushTrackedRound(mainTrack,mainTrack.lastRound);
    if(current.route?.length)pushTrackedRound(mainTrack,current);
    const players=(()=>{try{return (game.players||[]).map(p=>({name:String(p?.name||'Spelare').slice(0,80),strikes:Number(p?.strikes)||0,active:p?.active!==false}))}catch{return []}})();
    const title=byId('resultTitle')?.textContent||'';const text=byId('resultText')?.textContent||'';
    const completedAt=Date.now();
    return {
      v:1,kind:'orten',status,startedAt:Number(mainTrack?.startedAt)||completedAt,completedAt,roomCode:onlineRoomCode(),settings:cleanSettings(game?.settings||{}),players,
      totalMoves:Number(game?.totalMoves)||0,totalCrossings:Number(game?.totalCrossings)||0,bestRound:Number(game?.bestRound)||0,round:Number(game?.round)||1,
      rounds:(mainTrack?.rounds||[]).sort((a,b)=>a.round-b.round),result:{title:String(title).slice(0,160),text:String(text).slice(0,500)}
    };
  }

  function finalizeMain(status){
    if(!mainTrack||mainTrack.done)return;
    mainTrack.done=true;const snapshot=mainSnapshot(status);queueSnapshot(snapshot);
  }

  function tickMain(){
    try{
      if(game?.active&&!game.finished){
        if(!mainTrack||mainTrack.done)startMainTracking();
        const now=currentRoundSnapshot();
        if(mainTrack.lastRound&&((now.round>mainTrack.lastRoundNumber)||(now.route.length<mainTrack.lastRouteLength&&mainTrack.lastRouteLength>0)))pushTrackedRound(mainTrack,mainTrack.lastRound);
        mainTrack.lastRound=now;mainTrack.lastRouteLength=now.route.length;mainTrack.lastRoundNumber=now.round;return;
      }
      if(mainTrack&&!mainTrack.done){
        if(game?.finished)finalizeMain('completed');
        else if(!game?.active)finalizeMain('aborted');
      }
    }catch{}
  }

  function streetDom(){
    const screen=byId('streetDuelScreen');if(!screen)return {active:false};
    const active=screen.classList.contains('active');
    const roundText=byId('streetDuelRound')?.textContent||'';const round=Number(roundText.match(/RUNDA\s+(\d+)/i)?.[1])||1;
    const current=(byId('streetDuelCurrent')?.textContent||'').trim();
    const used=[...(byId('streetDuelChain')?.querySelectorAll('span')||[])].map(el=>String(el.textContent||'').replace(/^\d+\.\s*/,'').trim()).filter(Boolean);
    const names=[0,1].map(i=>(byId(`streetDuelP${i}`)?.querySelector('strong')?.textContent||`Spelare ${i+1}`).trim());
    const scores=[0,1].map(i=>Number(byId(`streetDuelP${i}`)?.querySelector('b')?.textContent)||0);
    const overlay=byId('streetDuelOverlay');const overlayVisible=!!overlay&&!overlay.classList.contains('hidden');const overlayText=(byId('streetDuelOverlayCard')?.textContent||'').replace(/\s+/g,' ').trim();
    return {active,round,current,used,names,scores,overlayVisible,overlayText};
  }

  function streetRoundFromDom(dom){return {round:dom.round,current:dom.current,used:[...dom.used],scores:[...dom.scores]}}
  function pushStreetRound(track,round){if(!round?.used?.length)return;const index=track.rounds.findIndex(r=>r.round===round.round);if(index>=0)track.rounds[index]=round;else track.rounds.push(round)}
  function startStreetTracking(dom){streetTrack={startedAt:Date.now(),done:false,rounds:[],last:streetRoundFromDom(dom),lastRound:dom.round,lastUsed:dom.used.length}}
  function finalizeStreet(status,dom=streetDom()){
    if(!streetTrack||streetTrack.done)return;
    if(streetTrack.last)pushStreetRound(streetTrack,streetTrack.last);if(dom.used?.length)pushStreetRound(streetTrack,streetRoundFromDom(dom));streetTrack.done=true;
    const completedAt=Date.now(),totalMoves=streetTrack.rounds.reduce((sum,r)=>sum+(r.used?.length||0),0);
    queueSnapshot({v:1,kind:'street-duel',status,startedAt:streetTrack.startedAt,completedAt,settings:{mode:'street-duel',scope:'country',country:'SE',area:'Umeå'},players:dom.names.map((name,i)=>({name,score:dom.scores[i]||0,active:true})),totalMoves,totalCrossings:0,round:dom.round,rounds:streetTrack.rounds.sort((a,b)=>a.round-b.round),result:{title:dom.overlayText.slice(0,180),text:dom.overlayText.slice(0,600)}});
  }

  function tickStreet(){
    const dom=streetDom();
    if(dom.active&&dom.current&&dom.current!=='–'){
      if(!streetTrack||streetTrack.done)startStreetTracking(dom);
      if(streetTrack.last&&((dom.round>streetTrack.lastRound)||(dom.used.length<streetTrack.lastUsed&&streetTrack.lastUsed>0)))pushStreetRound(streetTrack,streetTrack.last);
      streetTrack.last=streetRoundFromDom(dom);streetTrack.lastRound=dom.round;streetTrack.lastUsed=dom.used.length;
      if(Math.max(...dom.scores)>=3&&dom.overlayVisible)finalizeStreet('completed',dom);
      return;
    }
    if(streetTrack&&!streetTrack.done&&!dom.active)finalizeStreet('aborted',dom);
  }

  function pendingItems(){try{const value=JSON.parse(storageGet(PENDING_STORAGE)||'[]');return Array.isArray(value)?value:[]}catch{return []}}
  function savePending(item){const list=pendingItems().filter(x=>!(x.matchId===item.matchId&&x.stamp===item.stamp));list.push(item);storageSet(PENDING_STORAGE,JSON.stringify(list.slice(-25)))}
  function removePending(item){const list=pendingItems().filter(x=>!(x.matchId===item.matchId&&x.stamp===item.stamp));if(list.length)storageSet(PENDING_STORAGE,JSON.stringify(list));else storageRemove(PENDING_STORAGE)}

  async function uploadPending(item){
    const client=await getClient(),user=await ensureAnonymousUser(),parts=CORE.chunkPayload(item.encoded,{stamp:item.stamp,matchId:item.matchId});
    const rows=parts.map(part=>({user_id:user.id,player_name:'Privat historik',board_key:part.boardKey,score:part.index+1,updated_at:new Date(item.stamp).toISOString()}));
    for(let i=0;i<rows.length;i+=40){const result=await client.from(TABLE).upsert(rows.slice(i,i+40),{onConflict:'user_id,board_key'});if(result.error)throw result.error}
  }

  async function storeSnapshot(snapshot){
    if(!window.crypto?.subtle)return;
    const envelope=await CORE.encryptObject(snapshot),encoded=CORE.encodeEnvelope(envelope),matchId=await CORE.matchId(snapshot),stamp=Math.floor(Number(snapshot.completedAt)||Date.now()),item={stamp,matchId,encoded};
    savePending(item);
    try{await uploadPending(item);removePending(item);window.dispatchEvent(new CustomEvent('orten:private-history-saved',{detail:{matchId,stamp}}))}catch(err){console.warn('Privat spelhistorik väntar på ny synkning.',err)}
  }

  function queueSnapshot(snapshot){saveQueue=saveQueue.then(()=>storeSnapshot(snapshot)).catch(err=>console.warn('Privat spelhistorik kunde inte sparas.',err))}
  async function flushPending(){for(const item of pendingItems()){try{await uploadPending(item);removePending(item)}catch(err){console.warn('Kunde inte synka väntande privat historik.',err);break}}}

  function adminRequested(){try{return new URL(location.href).searchParams.get('admin')==='1'}catch{return false}}
  function storedAdminKey(){return CORE.normalizeAdminSecret(storageGet(ADMIN_KEY_STORAGE)||'')}

  function ensureAdminButton(){
    if(byId('privateHistoryButton')||(!adminRequested()&&!storedAdminKey()))return;
    const actions=document.querySelector('#setupScreen .topbar-actions');if(!actions)return;
    const button=document.createElement('button');button.id='privateHistoryButton';button.type='button';button.className='ghost-button private-history-button';button.textContent='🔐 48 h';button.addEventListener('click',openAdmin);actions.insertBefore(button,actions.firstChild||null);
  }

  function ensureAdminModal(){
    if(byId('privateHistoryModal'))return;
    const modal=document.createElement('div');modal.id='privateHistoryModal';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    modal.innerHTML=`<div class="modal-backdrop" data-private-history-close></div><section class="modal-card private-history-card"><button class="modal-close" id="privateHistoryClose" type="button" aria-label="Stäng">×</button><div id="privateHistoryBody"></div></section>`;
    document.body.appendChild(modal);byId('privateHistoryClose').addEventListener('click',closeAdmin);modal.querySelector('[data-private-history-close]').addEventListener('click',closeAdmin);
  }

  function renderGate(error=''){
    const body=byId('privateHistoryBody');if(!body)return;
    body.innerHTML=`<span class="step-kicker">🔐 PRIVAT ADMINVY</span><h2>Spelomgångar · senaste 48 h</h2><p class="private-history-intro">Historiken är end-to-end-krypterad. Bara den privata adminnyckeln kan läsa spelare, rutter och resultat.</p><div class="private-history-keybox"><label for="privateHistoryKey">Adminnyckel</label><input id="privateHistoryKey" type="password" autocomplete="off" spellcheck="false" placeholder="Klistra in din privata adminnyckel"><label class="private-history-remember"><input id="privateHistoryRemember" type="checkbox" checked> Spara nyckeln på den här enheten</label><button id="privateHistoryUnlock" class="primary-button" type="button">Öppna historiken</button><p id="privateHistoryGateError" class="private-history-error${error?'':' hidden'}">${safe(error)}</p></div><p class="private-history-security">Den privata nyckeln skickas aldrig till GitHub eller Supabase.</p>`;
    byId('privateHistoryUnlock')?.addEventListener('click',unlockAdmin);byId('privateHistoryKey')?.addEventListener('keydown',event=>{if(event.key==='Enter')unlockAdmin()});
  }

  async function unlockAdmin(){
    const input=byId('privateHistoryKey'),button=byId('privateHistoryUnlock');const key=CORE.normalizeAdminSecret(input?.value||'');
    if(button){button.disabled=true;button.textContent='Kontrollerar…'}
    try{await CORE.validateAdminSecret(key);currentAdminKey=key;if(byId('privateHistoryRemember')?.checked)storageSet(ADMIN_KEY_STORAGE,key);await loadDashboard()}
    catch(err){renderGate('Adminnyckeln är inte giltig. Kontrollera att hela nyckeln är med.')}
  }

  function closeAdmin(){byId('privateHistoryModal')?.classList.add('hidden');destroyAdminMap()}
  async function openAdmin(){
    ensureAdminModal();byId('privateHistoryModal').classList.remove('hidden');currentAdminKey=storedAdminKey();
    if(!currentAdminKey){renderGate();return}
    try{await CORE.validateAdminSecret(currentAdminKey);await loadDashboard()}catch{currentAdminKey='';storageRemove(ADMIN_KEY_STORAGE);renderGate('Den sparade adminnyckeln kunde inte användas längre.')}
  }

  function dateTime(value){try{return new Intl.DateTimeFormat('sv-SE',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value))}catch{return ''}}
  function durationText(session){const ms=Math.max(0,(Number(session.completedAt)||0)-(Number(session.startedAt)||0));if(!ms)return '–';const min=Math.floor(ms/60000),sec=Math.floor(ms%60000/1000);return min?`${min} min ${sec} s`:`${sec} s`}
  function modeText(session){const mode=session?.settings?.mode;return {classic:'⚡ Klassisk',endurance:'🛡️ Tålighet',elimination:'🏆 Utslagning',duel:'⚔️ Duell',solo:'🧭 Solo','street-duel':'🏙️ Gatduell Umeå'}[mode]||mode||'Orten'}
  function areaText(session){const s=session?.settings||{};if(s.mode==='street-duel')return 'Umeå';try{if(typeof scopeLabel==='function')return scopeLabel(s)}catch{}if(s.scope==='world')return 'Världen';if(s.scope==='country')return s.country||'Land';if(s.scope==='continent')return s.continent||'Världsdel';return 'Eget område'}
  function playerText(session){return (session.players||[]).map(p=>p.name).filter(Boolean).join(' · ')||'Okänd spelare'}
  function completeness(session){return (session.rounds||[]).reduce((sum,r)=>sum+(r.route?.length||r.used?.length||0),0)+(session.status==='completed'?10000:0)}

  async function fetchHistoryGroups(){
    const client=await getClient(),cutoff=new Date(Date.now()-HISTORY_HOURS*3600000).toISOString();
    const result=await client.from(TABLE).select('board_key,updated_at').like('board_key',`${CORE.PREFIX}%`).gte('updated_at',cutoff).order('updated_at',{ascending:false}).limit(10000);
    if(result.error)throw result.error;return CORE.groupRows(result.data||[]);
  }

  async function decryptGroups(groups,key){
    const settled=await Promise.allSettled(groups.slice(0,350).map(async group=>({group,session:await CORE.decryptObject(CORE.decodeEnvelope(group.encoded),key)})));
    const good=settled.filter(item=>item.status==='fulfilled').map(item=>item.value),map=new Map();
    for(const item of good){const session=item.session;if(!session||!session.completedAt)continue;const existing=map.get(item.group.matchId);if(!existing||completeness(session)>completeness(existing.session))map.set(item.group.matchId,{...item,matchId:item.group.matchId})}
    return [...map.values()].map(item=>({...item.session,__matchId:item.matchId})).filter(session=>Number(session.completedAt)>=Date.now()-HISTORY_HOURS*3600000).sort((a,b)=>b.completedAt-a.completedAt);
  }

  async function loadDashboard(){
    const body=byId('privateHistoryBody');if(!body)return;
    body.innerHTML='<span class="step-kicker">🔐 PRIVAT ADMINVY</span><h2>Spelomgångar · senaste 48 h</h2><div class="private-history-loading"><span></span>Hämtar och dekrypterar spelhistorik…</div>';
    try{
      const groups=await fetchHistoryGroups();adminSessions=await decryptGroups(groups,currentAdminKey);
      if(groups.length&&!adminSessions.length){currentAdminKey='';storageRemove(ADMIN_KEY_STORAGE);renderGate('Ingen historik kunde dekrypteras. Kontrollera adminnyckeln.');return}
      renderDashboard();
    }catch(err){console.warn('Privat historik kunde inte hämtas.',err);body.innerHTML=`<span class="step-kicker">🔐 PRIVAT ADMINVY</span><h2>Spelomgångar · senaste 48 h</h2><div class="private-history-empty"><strong>Kunde inte hämta historiken.</strong><br>Kontrollera anslutningen och försök igen.</div><div class="private-history-toolbar"><button id="privateHistoryRetry" class="ghost-button" type="button">↻ Försök igen</button></div>`;byId('privateHistoryRetry')?.addEventListener('click',loadDashboard)}
  }

  function renderDashboard(){
    const body=byId('privateHistoryBody');if(!body)return;
    const rows=adminSessions.map((session,index)=>`<article class="private-history-row"><div class="private-history-row-main"><div><span class="private-history-time">${safe(dateTime(session.completedAt))}</span><strong>${safe(modeText(session))} · ${safe(areaText(session))}</strong><small>${safe(playerText(session))}</small></div><div class="private-history-stats"><b>${Number(session.totalMoves)||0}</b><span>${session.kind==='street-duel'?'gatval':'drag'}</span></div></div><div class="private-history-row-foot"><span class="private-history-status ${session.status==='completed'?'complete':'aborted'}">${session.status==='completed'?'Avslutad':'Avbruten'}</span>${session.roomCode?`<span>Online · ${safe(session.roomCode)}</span>`:''}<span>${safe(durationText(session))}</span><button type="button" data-private-session="${index}">Se omgång →</button></div></article>`).join('');
    body.innerHTML=`<div id="privateHistoryDashboard"><div class="private-history-heading"><div><span class="step-kicker">🔐 PRIVAT ADMINVY</span><h2>Spelomgångar · senaste 48 h</h2><p>${adminSessions.length} unik${adminSessions.length===1?'':'a'} spelomgång${adminSessions.length===1?'':'ar'} hittades.</p></div><div class="private-history-toolbar"><button id="privateHistoryRefresh" class="ghost-button" type="button">↻ Uppdatera</button><button id="privateHistoryForget" class="ghost-button danger" type="button">Glöm nyckel</button></div></div><div class="private-history-list">${rows||'<div class="private-history-empty"><strong>Inga spelomgångar ännu.</strong><br>Nya avslutade eller avbrutna matcher dyker upp här automatiskt.</div>'}</div></div><div id="privateHistoryDetail" class="hidden"></div>`;
    body.querySelectorAll('[data-private-session]').forEach(button=>button.addEventListener('click',()=>openDetail(Number(button.dataset.privateSession))));
    byId('privateHistoryRefresh')?.addEventListener('click',loadDashboard);byId('privateHistoryForget')?.addEventListener('click',()=>{storageRemove(ADMIN_KEY_STORAGE);currentAdminKey='';renderGate()});
  }

  function destroyAdminMap(){if(adminMap){try{adminMap.remove()}catch{}adminMap=null;adminLayer=null}}
  function routeParts(a,b){try{if(window.OrtenGeometry?.segmentParts)return window.OrtenGeometry.segmentParts(a,b)}catch{}return [[[a.lat,a.lon],[b.lat,b.lon]]]}

  function renderMapRound(session,roundIndex){
    destroyAdminMap();const host=byId('privateHistoryMap');const routeList=byId('privateHistoryRouteList');if(!host||!window.L)return;
    const round=session.rounds?.[roundIndex]||session.rounds?.[0];const route=round?.route||[];
    if(routeList)routeList.innerHTML=route.map((p,i)=>`<li><b>${String(i+1).padStart(2,'0')}</b><span>${safe(p.name)}<small>${safe([p.region,p.country].filter(Boolean).join(' · '))}</small></span></li>`).join('');
    if(!route.length){host.innerHTML='<div class="private-history-map-empty">Ingen kartdata sparades för den här rundan.</div>';return}
    adminMap=L.map(host,{zoomControl:true,minZoom:2,maxZoom:18,worldCopyJump:true,zoomSnap:.25,preferCanvas:true}).setView([20,0],2.3);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(adminMap);adminLayer=L.layerGroup().addTo(adminMap);
    const mode=session.settings?.mode;
    if(mode==='duel'){
      const groups=new Map();route.forEach(p=>{const key=Number(p.playerIndex)||0;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)});for(const [playerIndex,points] of groups){for(let i=1;i<points.length;i++)routeParts(points[i-1],points[i]).forEach(part=>L.polyline(part,{color:PLAYER_COLORS_LOCAL[playerIndex%PLAYER_COLORS_LOCAL.length],weight:5,opacity:.9}).addTo(adminLayer))}
    }else for(let i=1;i<route.length;i++)routeParts(route[i-1],route[i]).forEach(part=>L.polyline(part,{color:'#68f6ff',weight:5,opacity:.88}).addTo(adminLayer));
    route.forEach((p,i)=>{const color=mode==='duel'?PLAYER_COLORS_LOCAL[(Number(p.playerIndex)||0)%PLAYER_COLORS_LOCAL.length]:'#68f6ff',icon=L.divIcon({className:'private-history-marker-wrap',html:`<div class="private-history-marker" style="--history-marker:${color}">${i+1}</div>`,iconSize:[26,26],iconAnchor:[13,13]});L.marker([p.lat,p.lon],{icon,keyboard:false}).addTo(adminLayer).bindTooltip(safe(p.name),{direction:'top'})});
    (round.crossings||[]).forEach(c=>{const icon=L.divIcon({className:'private-history-marker-wrap',html:'<div class="private-history-cross">×</div>',iconSize:[30,30],iconAnchor:[15,15]});L.marker([c.lat,c.lon],{icon,interactive:false}).addTo(adminLayer)});
    const bounds=L.latLngBounds(route.map(p=>[p.lat,p.lon]));if(bounds.isValid())adminMap.fitBounds(bounds,{padding:[35,35],maxZoom:7});setTimeout(()=>adminMap?.invalidateSize(),80);
  }

  function renderStreetDetail(session){
    const rounds=(session.rounds||[]).map(round=>`<article class="private-history-street-round"><strong>Runda ${round.round}</strong><span>Ställning ${safe((round.scores||[]).join('–'))}</span><div>${(round.used||[]).map((name,i)=>`<b>${i+1}. ${safe(name)}</b>`).join('<i>→</i>')}</div></article>`).join('');
    return `<div class="private-history-street-list">${rounds||'<div class="private-history-empty">Ingen gatkedja sparades.</div>'}</div>`;
  }

  function openDetail(index){
    const session=adminSessions[index];if(!session)return;destroyAdminMap();
    const dashboard=byId('privateHistoryDashboard'),detail=byId('privateHistoryDetail');dashboard?.classList.add('hidden');detail?.classList.remove('hidden');
    const roundOptions=(session.rounds||[]).map((round,i)=>`<option value="${i}">Runda ${round.round||i+1} · ${round.route?.length||round.used?.length||0} val</option>`).join('');
    detail.innerHTML=`<button id="privateHistoryBack" class="private-history-back" type="button">← Alla spelomgångar</button><div class="private-history-detail-head"><div><span class="step-kicker">${safe(dateTime(session.completedAt))}</span><h2>${safe(modeText(session))} · ${safe(areaText(session))}</h2><p>${safe(playerText(session))}</p></div><div class="private-history-detail-score"><strong>${Number(session.totalMoves)||0}</strong><span>${session.kind==='street-duel'?'GATVAL':'DRAG'}</span></div></div><div class="private-history-meta"><span>${session.status==='completed'?'✓ Avslutad':'↩ Avbruten'}</span><span>⏱ ${safe(durationText(session))}</span>${session.roomCode?`<span>🌐 Rum ${safe(session.roomCode)}</span>`:''}<span>${session.rounds?.length||0} runda${session.rounds?.length===1?'':'or'}</span></div>${session.result?.title?`<div class="private-history-result"><strong>${safe(session.result.title)}</strong><p>${safe(session.result.text||'')}</p></div>`:''}${session.kind==='street-duel'?renderStreetDetail(session):`<div class="private-history-round-select${(session.rounds?.length||0)<=1?' hidden':''}"><label for="privateHistoryRoundSelect">Visa runda</label><select id="privateHistoryRoundSelect" class="select">${roundOptions}</select></div><div id="privateHistoryMap" class="private-history-map"></div><ol id="privateHistoryRouteList" class="private-history-route-list"></ol>`}`;
    byId('privateHistoryBack')?.addEventListener('click',()=>{destroyAdminMap();detail.classList.add('hidden');dashboard?.classList.remove('hidden')});
    if(session.kind!=='street-duel'){byId('privateHistoryRoundSelect')?.addEventListener('change',event=>renderMapRound(session,Number(event.target.value)));setTimeout(()=>renderMapRound(session,0),0)}
  }

  function init(){
    injectStyles();ensureAdminButton();
    setInterval(()=>{tickMain();tickStreet()},250);
    window.addEventListener('online',()=>flushPending());window.addEventListener('orten:private-history-saved',()=>{if(!byId('privateHistoryModal')?.classList.contains('hidden')&&currentAdminKey)loadDashboard()});
    setTimeout(flushPending,2400);
    if(adminRequested())setTimeout(()=>{ensureAdminButton();openAdmin()},500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
