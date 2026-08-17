'use strict';

(() => {
  const CORE=window.OrtenPrivateHistoryCore;
  if(!CORE)return;
  const GLOBAL=window.OrtenGlobalHighscore;
  const PROJECT_URL=GLOBAL?.PROJECT_URL||'https://mewauzsogkbcchnvsath.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_lWTB9F286pzThGxYp3Zj2w_uIco-VDU';
  const SDK_URL=GLOBAL?.SDK_URL||'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
  const TABLE=GLOBAL?.TABLE||'orten_highscores';
  const PENDING_STORAGE='orten2:private-history-pending:v1';
  const STATUS_STORAGE='orten2:private-history-sync-status:v2';
  const CAPTURE_STORAGE='orten2:private-history-recovery-capture:v1';

  let clientPromise=null;
  let sessionPromise=null;
  let busy=false;
  let observedStart=0;

  const readJson=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'');return v??fallback}catch{return fallback}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const pendingItems=()=>{const value=readJson(PENDING_STORAGE,[]);return Array.isArray(value)?value:[]};
  const status=()=>readJson(STATUS_STORAGE,{state:'idle',at:0});
  const setStatus=(state,extra={})=>{writeJson(STATUS_STORAGE,{state,at:Date.now(),pending:pendingItems().length,...extra});renderStatus()};
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function savePending(item){
    const list=pendingItems().filter(x=>!(x.matchId===item.matchId&&x.stamp===item.stamp));
    list.push(item);writeJson(PENDING_STORAGE,list.slice(-25));
  }
  function removePending(item){
    const list=pendingItems().filter(x=>!(x.matchId===item.matchId&&x.stamp===item.stamp));
    try{if(list.length)localStorage.setItem(PENDING_STORAGE,JSON.stringify(list));else localStorage.removeItem(PENDING_STORAGE)}catch{}
  }

  async function sdk(){
    if(window.supabase?.createClient)return window.supabase;
    await new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-orten-supabase-sdk]');
      if(existing){if(window.supabase?.createClient)return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}
      const script=document.createElement('script');script.src=SDK_URL;script.async=true;script.crossOrigin='anonymous';script.dataset.ortenSupabaseSdk='true';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);
    });
    if(!window.supabase?.createClient)throw new Error('Supabase SDK kunde inte startas.');
    return window.supabase;
  }
  async function client(){
    if(clientPromise)return clientPromise;
    clientPromise=sdk().then(s=>s.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'orten2-private-history-auth'}})).catch(err=>{clientPromise=null;throw err});
    return clientPromise;
  }
  async function user(){
    if(sessionPromise)return sessionPromise;
    sessionPromise=(async()=>{
      const c=await client(),current=await c.auth.getSession();if(current.error)throw current.error;
      if(current.data?.session?.user)return current.data.session.user;
      const signed=await c.auth.signInAnonymously();if(signed.error)throw signed.error;if(!signed.data?.user)throw new Error('Ingen anonym spelaridentitet kunde skapas.');return signed.data.user;
    })().catch(err=>{sessionPromise=null;throw err});
    return sessionPromise;
  }

  function errorText(err){
    const pieces=[err?.message,err?.details,err?.hint,err?.code].filter(Boolean).map(String);
    return pieces.join(' · ').slice(0,360)||'Okänt databasfel';
  }

  async function upload(item){
    const c=await client(),u=await user(),parts=CORE.chunkPayload(item.encoded,{stamp:item.stamp,matchId:item.matchId});
    const rows=parts.map(part=>({user_id:u.id,player_name:'Privat historik',board_key:part.boardKey,score:part.index+1,updated_at:new Date(item.stamp).toISOString()}));
    for(let i=0;i<rows.length;i+=35){
      const result=await c.from(TABLE).upsert(rows.slice(i,i+35),{onConflict:'user_id,board_key'});
      if(result.error)throw result.error;
    }
    const prefix=`${CORE.PREFIX}${item.stamp}|${item.matchId}|`;
    const verify=await c.from(TABLE).select('board_key').eq('user_id',u.id).like('board_key',`${prefix}%`).limit(1);
    if(verify.error)throw verify.error;
    if(!(verify.data||[]).length){
      setStatus('hidden',{matchId:item.matchId,parts:parts.length,message:'Uppladdningen accepterades men historikraden går inte att läsa tillbaka.'});
      return false;
    }
    removePending(item);setStatus('saved',{matchId:item.matchId,parts:parts.length});
    window.dispatchEvent(new CustomEvent('orten:private-history-saved',{detail:{matchId:item.matchId,stamp:item.stamp,recovery:true}}));
    return true;
  }

  async function flush(){
    if(busy)return;
    busy=true;
    try{
      const list=pendingItems();
      if(!list.length){setStatus(status().state==='saved'?'saved':'idle');return}
      setStatus('syncing',{pending:list.length});
      for(const item of list){
        try{const ok=await upload(item);if(!ok)break}
        catch(err){setStatus('error',{message:errorText(err),matchId:item.matchId});break}
      }
    }finally{busy=false;setTimeout(renderStatus,50)}
  }

  function cleanRoute(route=[]){
    return (Array.isArray(route)?route:[]).slice(0,800).map((p,index)=>({index:index+1,name:String(p?.name||`Ort ${index+1}`).slice(0,120),lat:Number(p?.lat),lon:Number(p?.lon),countryCode:String(p?.countryCode||'').slice(0,3),country:String(p?.country||'').slice(0,80),region:String(p?.region||'').slice(0,100),playerIndex:Number(p?.playerIndex)||0,moveNumber:Number(p?.moveNumber)||index+1,playerMoveNumber:Number(p?.playerMoveNumber)||null})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  }

  async function recoverFinishedGame(){
    let g;
    try{g=game}catch{return}
    if(!g?.active||!g.finished||!Array.isArray(g.route)||!g.route.length)return;
    const route=cleanRoute(g.route),players=(g.players||[]).map(p=>({name:String(p?.name||'').slice(0,80),strikes:Number(p?.strikes)||0,active:p?.active!==false}));
    const signature=[g.settings?.mode||'',players.map(p=>p.name).join('|'),route.length,route.at(-1)?.name||'',g.totalMoves||0].join('::');
    const previous=readJson(CAPTURE_STORAGE,{});
    if(previous.signature===signature&&Date.now()-Number(previous.at||0)<6*3600000)return;
    const completedAt=Date.now(),snapshot={v:1,kind:'orten',status:'completed',startedAt:observedStart||Math.max(completedAt-1000,completedAt-(Number(g.totalMoves)||route.length)*15000),completedAt,roomCode:'',settings:{mode:String(g.settings?.mode||''),scope:String(g.settings?.scope||''),continent:String(g.settings?.continent||''),country:String(g.settings?.country||''),countries:[...(g.settings?.countries||[])].map(String),placeType:String(g.settings?.placeType||''),duplicatePolicy:String(g.settings?.duplicatePolicy||''),strikeLimit:Number(g.settings?.strikeLimit)||0,timer:Number(g.settings?.timer)||0,mapTheme:String(g.settings?.mapTheme||'')},players,totalMoves:Number(g.totalMoves)||route.length,totalCrossings:Number(g.totalCrossings)||0,bestRound:Number(g.bestRound)||0,round:Number(g.round)||1,rounds:[{round:Number(g.round)||1,route,crossings:(g.lastCrossings||[]).map(c=>({lat:Number(c?.lat),lon:Number(c?.lon),crossedSegmentIndex:Number(c?.crossedSegmentIndex)})).filter(c=>Number.isFinite(c.lat)&&Number.isFinite(c.lon))}],result:{title:document.getElementById('resultTitle')?.textContent||'',text:document.getElementById('resultText')?.textContent||''}};
    try{
      const envelope=await CORE.encryptObject(snapshot),encoded=CORE.encodeEnvelope(envelope),matchId=await CORE.matchId(snapshot),item={stamp:completedAt,matchId,encoded};
      savePending(item);writeJson(CAPTURE_STORAGE,{signature,at:Date.now(),matchId});setStatus('captured',{matchId});await flush();
    }catch(err){setStatus('error',{message:errorText(err)})}
  }

  function statusText(){
    const s=status(),pending=pendingItems().length;
    if(s.state==='saved')return {kind:'ok',text:`✓ Senaste synk lyckades${s.parts?` · ${s.parts} krypterade delar`:''}. ${pending?`${pending} väntar lokalt.`:'Inget väntar lokalt.'}`};
    if(s.state==='syncing')return {kind:'wait',text:`↻ Synkar privat historik… ${pending} omgång${pending===1?'':'ar'} väntar lokalt.`};
    if(s.state==='captured')return {kind:'wait',text:`✓ Matchen fångades lokalt. ${pending} väntar på uppladdning.`};
    if(s.state==='hidden')return {kind:'bad',text:`⚠ Supabase tog emot data men läskontrollen misslyckades. ${s.message||''}`};
    if(s.state==='error')return {kind:'bad',text:`⚠ Synkfel: ${s.message||'okänt fel'} · ${pending} väntar lokalt.`};
    return {kind:pending?'wait':'ok',text:pending?`${pending} omgång${pending===1?'':'ar'} väntar lokalt på synk.`:'Inga lokalt väntande omgångar.'};
  }

  function renderStatus(){
    const dashboard=document.getElementById('privateHistoryDashboard');if(!dashboard)return;
    let box=document.getElementById('privateHistorySyncDiagnostic');
    if(!box){box=document.createElement('div');box.id='privateHistorySyncDiagnostic';box.style.cssText='margin:12px 0 16px;padding:12px 14px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(255,255,255,.055);font:600 13px/1.45 system-ui';dashboard.insertBefore(box,dashboard.querySelector('.private-history-list')||dashboard.firstChild)}
    const info=statusText();box.dataset.kind=info.kind;box.innerHTML=`<div>${safe(info.text)}</div><button id="privateHistoryForceSync" type="button" class="ghost-button" style="margin-top:8px">↻ Synka nu</button>`;
    document.getElementById('privateHistoryForceSync')?.addEventListener('click',async()=>{await flush();setTimeout(()=>document.getElementById('privateHistoryRefresh')?.click(),500)});
  }

  function tick(){
    try{if(game?.active&&!game.finished&&!observedStart)observedStart=Date.now()}catch{}
    recoverFinishedGame();renderStatus();
  }

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#privateHistoryButton,#privateHistoryRefresh,#privateHistoryUnlock'))setTimeout(()=>{flush();renderStatus()},120);
  },true);
  window.addEventListener('online',flush);
  new MutationObserver(()=>renderStatus()).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(tick,650);
  setTimeout(()=>{flush();tick()},1200);
})();
