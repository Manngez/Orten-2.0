'use strict';

(() => {
  const PROJECT_URL='https://mewauzsogkbcchnvsath.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_lWTB9F286pzThGxYp3Zj2w_uIco-VDU';
  const SDK_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
  const TABLE='orten_highscores';
  const STATUS_KEY='orten2:start-log-last-status:v1';
  let clientPromise=null;
  let sessionPromise=null;
  let wrapped=false;
  let streetOpen=false;

  const clean=(value,limit=24)=>String(value??'').replace(/[<>|]/g,'').replace(/\s+/g,' ').trim().slice(0,limit)||'Spelare';
  const token=(value,limit=20)=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,limit)||'-';
  const setStatus=(status,extra={})=>{const value={status,at:Date.now(),...extra};try{localStorage.setItem(STATUS_KEY,JSON.stringify(value))}catch{};try{window.dispatchEvent(new CustomEvent('orten:start-log-status',{detail:value}))}catch{}};

  function loadSdk(){
    if(window.supabase?.createClient)return Promise.resolve(window.supabase);
    return new Promise((resolve,reject)=>{
      const old=document.querySelector('script[data-orten-start-log-sdk]');
      if(old){old.addEventListener('load',()=>resolve(window.supabase),{once:true});old.addEventListener('error',()=>reject(new Error('Supabase SDK kunde inte laddas.')),{once:true});return}
      const script=document.createElement('script');script.src=SDK_URL;script.async=true;script.dataset.ortenStartLogSdk='1';
      script.onload=()=>window.supabase?.createClient?resolve(window.supabase):reject(new Error('Supabase SDK startade inte.'));
      script.onerror=()=>reject(new Error('Supabase SDK kunde inte laddas.'));
      document.head.appendChild(script);
    });
  }

  function getClient(){
    if(!clientPromise)clientPromise=loadSdk().then(sdk=>sdk.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(error=>{clientPromise=null;throw error});
    return clientPromise;
  }

  async function getUser(){
    if(sessionPromise)return sessionPromise;
    sessionPromise=(async()=>{
      const client=await getClient();
      const current=await client.auth.getSession();
      if(current.error)throw current.error;
      if(current.data?.session?.user)return current.data.session.user;
      const signed=await client.auth.signInAnonymously();
      if(signed.error)throw signed.error;
      if(!signed.data?.user)throw new Error('Ingen anonym spelaridentitet kunde skapas.');
      return signed.data.user;
    })().catch(error=>{sessionPromise=null;throw error});
    return sessionPromise;
  }

  function modeCode(mode=''){
    return ({classic:'classic',endurance:'endurance',elimination:'elimination',duel:'duel',solo:'solo','street-duel':'street'})[mode]||token(mode||'orten',16).toLowerCase();
  }

  function areaCode(settings={}){
    if(settings.mode==='street-duel')return 'UMEA';
    if(settings.scope==='world')return 'WORLD';
    if(settings.scope==='country')return token(String(settings.country||'LAND').toUpperCase(),16);
    if(settings.scope==='continent')return token(String(settings.continent||'CONTINENT').toUpperCase(),18);
    if(settings.scope==='custom'){
      const countries=[...(settings.countries||[])].map(code=>String(code).toUpperCase()).sort();
      if(countries.join(',')==='DK,FI,IS,NO,SE')return 'NORDIC';
      return 'CUSTOM';
    }
    return token(String(settings.scope||'AREA').toUpperCase(),18);
  }

  function regularRoom(){
    const modal=document.querySelector('#onlineModalBody .online-room-code strong');
    const modalCode=String(modal?.textContent||'').toUpperCase().match(/[A-Z2-9]{4,8}/)?.[0];
    if(modalCode)return modalCode;
    const badge=document.getElementById('onlineGameBadge');
    return String(badge?.textContent||'').toUpperCase().match(/[A-Z2-9]{4,8}/)?.[0]||'';
  }

  function makeId(kind,room,stamp){
    const random=crypto?.randomUUID?.().replace(/-/g,'').slice(0,8)||Math.random().toString(36).slice(2,10);
    return token(`${kind[0]}${room||'local'}${stamp.toString(36).slice(-6)}${random}`,20);
  }

  async function saveStart({kind='orten',settings={},players=[],room=''}){
    const stamp=Date.now();
    const id=makeId(kind,room,stamp);
    const mode=modeCode(settings.mode||kind);
    const area=areaCode(settings);
    const roomToken=token(room||'-',8);
    const iso=new Date(stamp).toISOString();
    const names=(Array.isArray(players)?players:[]).map(player=>clean(player?.name||player)).filter(Boolean).slice(0,8);
    if(!names.length)names.push('Spelare');
    const client=await getClient();
    const user=await getUser();
    const rows=[{
      user_id:user.id,
      player_name:names[0],
      board_key:`replay|start|1|${stamp}|${id}|${mode}|${area}|${roomToken}`,
      score:1,
      updated_at:iso
    }];
    names.forEach((name,index)=>rows.push({
      user_id:user.id,
      player_name:name,
      board_key:`replay|startp|1|${id}|${String(index).padStart(2,'0')}`,
      score:index+1,
      updated_at:iso
    }));
    setStatus('saving',{id,mode,area,room:room||'',players:names});
    const result=await client.from(TABLE).upsert(rows,{onConflict:'user_id,board_key'});
    if(result.error)throw result.error;
    setStatus('saved',{id,mode,area,room:room||'',players:names});
    return id;
  }

  function recordRegular(){
    try{
      if(typeof game==='undefined'||!game?.active)return;
      const s=game.settings||{};
      const players=(game.players||[]).map(player=>({name:player?.name||'Spelare'}));
      void saveStart({kind:'orten',settings:s,players,room:regularRoom()}).catch(error=>{setStatus('error',{message:String(error?.message||error)});console.warn('Startloggen kunde inte spara spelet.',error)});
    }catch(error){setStatus('error',{message:String(error?.message||error)})}
  }

  function installRegularHook(){
    if(wrapped)return;
    try{
      if(typeof window.startGame!=='function')return;
      const original=window.startGame;
      if(original.__startLogWrapped){wrapped=true;return}
      const replacement=function(...args){
        const result=original.apply(this,args);
        queueMicrotask(recordRegular);
        return result;
      };
      replacement.__startLogWrapped=true;
      window.startGame=replacement;
      try{startGame=replacement}catch{}
      wrapped=true;
    }catch{}
  }

  function streetInfo(){
    const screen=document.getElementById('streetDuelScreen');
    const active=!!screen?.classList.contains('active');
    const current=String(document.getElementById('streetDuelCurrent')?.textContent||'').trim();
    const round=Number((document.getElementById('streetDuelRound')?.textContent||'').match(/(\d+)/)?.[1])||0;
    const names=[0,1].map(i=>clean(document.getElementById(`streetDuelP${i}`)?.querySelector('strong')?.textContent||`Spelare ${i+1}`));
    const chain=[...(document.getElementById('streetDuelChain')?.querySelectorAll('span')||[])];
    const online=window.OrtenStreetDuelApp?.online||{};
    const overlay=document.getElementById('streetDuelOverlay');
    const overlayVisible=!!overlay&&!overlay.classList.contains('hidden');
    return {active,current,round,names,chainLength:chain.length,role:online.role||'offline',room:String(online.code||'').toUpperCase(),overlayVisible};
  }

  function watchStreet(){
    const info=streetInfo();
    if(!info.active||info.overlayVisible){streetOpen=false;return}
    if(info.role==='guest')return;
    if(!streetOpen&&info.round===1&&info.chainLength>=1&&info.current&&info.current!=='–'){
      streetOpen=true;
      void saveStart({kind:'street',settings:{mode:'street-duel',scope:'country',country:'SE'},players:info.names.map(name=>({name})),room:info.room}).catch(error=>{setStatus('error',{message:String(error?.message||error)});console.warn('Startloggen kunde inte spara Gatduellen.',error)});
    }
  }

  setInterval(()=>{installRegularHook();watchStreet()},200);
  window.OrtenStartLog=Object.freeze({recordRegular,saveStart,getLastStatus:()=>{try{return JSON.parse(localStorage.getItem(STATUS_KEY)||'null')}catch{return null}}});
})();