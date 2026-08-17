'use strict';

(() => {
  const GLOBAL=window.OrtenGlobalHighscore;
  if(!GLOBAL)return;

  const PROJECT_URL=GLOBAL.PROJECT_URL||'https://mewauzsogkbcchnvsath.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_lWTB9F286pzThGxYp3Zj2w_uIco-VDU';
  const SDK_URL=GLOBAL.SDK_URL||'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
  const TABLE=GLOBAL.TABLE||'orten_highscores';
  const PLAYER_LIMIT=24;
  const ROUTE_LIMIT=600;

  let sdkPromise=null;
  let clientPromise=null;
  let sessionPromise=null;
  let regularTrack=null;
  let streetTrack=null;

  const byId=id=>document.getElementById(id);
  const clean=(value,limit=PLAYER_LIMIT)=>String(value??'').replace(/[<>|]/g,'').replace(/\s+/g,' ').trim().slice(0,limit);
  const token=(value,limit=24)=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,limit)||'-';

  function loadSDK(){
    if(window.supabase?.createClient)return Promise.resolve(window.supabase);
    if(sdkPromise)return sdkPromise;
    sdkPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-orten-supabase-sdk]');
      const finish=()=>window.supabase?.createClient?resolve(window.supabase):reject(new Error('Supabase SDK kunde inte startas.'));
      if(existing){
        if(window.supabase?.createClient)return finish();
        existing.addEventListener('load',finish,{once:true});
        existing.addEventListener('error',()=>reject(new Error('Supabase SDK kunde inte laddas.')),{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src=SDK_URL;script.async=true;script.crossOrigin='anonymous';script.dataset.ortenSupabaseSdk='true';
      script.addEventListener('load',finish,{once:true});
      script.addEventListener('error',()=>reject(new Error('Supabase SDK kunde inte laddas.')),{once:true});
      document.head.appendChild(script);
    }).catch(error=>{sdkPromise=null;throw error});
    return sdkPromise;
  }

  async function getClient(){
    if(clientPromise)return clientPromise;
    clientPromise=loadSDK().then(sdk=>sdk.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(error=>{clientPromise=null;throw error});
    return clientPromise;
  }

  async function ensureUser(){
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

  function roomCode(){
    const badge=byId('onlineGameBadge');
    if(!badge||badge.classList.contains('hidden'))return '';
    return String(badge.textContent||'').match(/\b([A-Z2-9]{4,8})\b/)?.[1]||'';
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

  function cleanRoute(route=[]){
    return (Array.isArray(route)?route:[]).map((point,index)=>({
      index:index+1,
      name:clean(point?.name||`Ort ${index+1}`),
      lat:Number(point?.lat),
      lon:Number(point?.lon),
      countryCode:token(String(point?.countryCode||'').toUpperCase(),3),
      playerIndex:Number.isFinite(Number(point?.playerIndex))?Number(point.playerIndex):0
    })).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180);
  }

  function cleanCrossings(crossings=[]){
    return (Array.isArray(crossings)?crossings:[]).map((crossing,index)=>({index:index+1,lat:Number(crossing?.lat),lon:Number(crossing?.lon)})).filter(crossing=>Number.isFinite(crossing.lat)&&Number.isFinite(crossing.lon));
  }

  function currentRound(){
    try{return {round:Number(game?.round)||1,route:cleanRoute(game?.route||[]),crossings:cleanCrossings(game?.lastCrossings||[])}}
    catch{return {round:1,route:[],crossings:[]}}
  }

  function putRound(track,round){
    if(!track||!round||!round.route?.length)return;
    const index=track.rounds.findIndex(item=>Number(item.round)===Number(round.round));
    if(index>=0)track.rounds[index]=round;else track.rounds.push(round);
  }

  function startRegular(){
    const round=currentRound();
    regularTrack={startedAt:Date.now(),rounds:[],last:round,lastRound:round.round,lastLength:round.route.length,saving:false,saved:false,nextTry:0};
  }

  function regularSnapshot(){
    const round=currentRound();
    if(regularTrack?.last?.route?.length)putRound(regularTrack,regularTrack.last);
    if(round.route.length)putRound(regularTrack,round);
    const players=(()=>{try{return (game.players||[]).map(player=>({name:clean(player?.name||'Spelare'),strikes:Number(player?.strikes)||0,score:Number(player?.score)||0}))}catch{return []}})();
    return {
      kind:'orten',completedAt:Date.now(),startedAt:Number(regularTrack?.startedAt)||Date.now(),roomCode:roomCode(),
      settings:{mode:String(game?.settings?.mode||''),scope:String(game?.settings?.scope||''),continent:String(game?.settings?.continent||''),country:String(game?.settings?.country||''),countries:[...(game?.settings?.countries||[])].map(String)},
      players,totalMoves:Number(game?.totalMoves)||regularTrack?.rounds?.reduce((sum,r)=>sum+(r.route?.length||0),0)||0,
      rounds:[...(regularTrack?.rounds||[])].sort((a,b)=>a.round-b.round)
    };
  }

  function streetDom(){
    const screen=byId('streetDuelScreen');if(!screen)return {active:false};
    const active=screen.classList.contains('active');
    const round=Number((byId('streetDuelRound')?.textContent||'').match(/RUNDA\s+(\d+)/i)?.[1])||1;
    const current=(byId('streetDuelCurrent')?.textContent||'').trim();
    const used=[...(byId('streetDuelChain')?.querySelectorAll('span')||[])].map(el=>clean(String(el.textContent||'').replace(/^\d+\.\s*/,''),PLAYER_LIMIT)).filter(Boolean);
    const names=[0,1].map(i=>clean(byId(`streetDuelP${i}`)?.querySelector('strong')?.textContent||`Spelare ${i+1}`));
    const scores=[0,1].map(i=>Number(byId(`streetDuelP${i}`)?.querySelector('b')?.textContent)||0);
    const overlay=byId('streetDuelOverlay');
    return {active,round,current,used,names,scores,overlayVisible:!!overlay&&!overlay.classList.contains('hidden')};
  }

  function streetRound(dom){return {round:dom.round,used:[...dom.used],scores:[...dom.scores]}}
  function putStreetRound(track,round){
    if(!track||!round?.used?.length)return;
    const index=track.rounds.findIndex(item=>Number(item.round)===Number(round.round));
    if(index>=0)track.rounds[index]=round;else track.rounds.push(round);
  }

  function startStreet(dom){streetTrack={startedAt:Date.now(),rounds:[],last:streetRound(dom),lastRound:dom.round,lastLength:dom.used.length,saving:false,saved:false,nextTry:0}}

  function streetSnapshot(dom){
    if(streetTrack?.last)putStreetRound(streetTrack,streetTrack.last);
    if(dom.used?.length)putStreetRound(streetTrack,streetRound(dom));
    const rounds=[...(streetTrack?.rounds||[])].sort((a,b)=>a.round-b.round);
    return {kind:'street',completedAt:Date.now(),startedAt:Number(streetTrack?.startedAt)||Date.now(),roomCode:'',settings:{mode:'street-duel',scope:'country',country:'SE'},players:dom.names.map((name,index)=>({name,score:dom.scores[index]||0,strikes:0})),totalMoves:rounds.reduce((sum,round)=>sum+(round.used?.length||0),0),rounds};
  }

  function fingerprint(snapshot){
    const players=(snapshot.players||[]).map(player=>clean(player.name)).join('~');
    const rounds=(snapshot.rounds||[]).map(round=>snapshot.kind==='street'?`${round.round}:${(round.used||[]).join('>')}`:`${round.round}:${(round.route||[]).map(point=>point.name).join('>')}`).join('/');
    const bucket=Math.floor(Number(snapshot.completedAt||Date.now())/600000);
    return [snapshot.kind,modeCode(snapshot.settings?.mode),areaCode(snapshot.settings),snapshot.roomCode||'-',players,Number(snapshot.totalMoves)||0,rounds,bucket].join('|');
  }

  async function gameId(snapshot){
    const text=fingerprint(snapshot);
    try{
      const bytes=new TextEncoder().encode(text),hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
      let binary='';hash.slice(0,12).forEach(byte=>{binary+=String.fromCharCode(byte)});
      return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'').slice(0,16);
    }catch{
      let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}
      return `g${(hash>>>0).toString(36)}${Math.abs(text.length).toString(36)}`.slice(0,16);
    }
  }

  function gameRows(snapshot,id,userId){
    const stamp=Math.floor(Number(snapshot.completedAt)||Date.now());
    const iso=new Date(stamp).toISOString();
    const mode=modeCode(snapshot.settings?.mode);
    const area=areaCode(snapshot.settings);
    const room=token(snapshot.roomCode||'-',8);
    const players=Array.isArray(snapshot.players)?snapshot.players:[];
    const rows=[{
      user_id:userId,
      player_name:clean(players[0]?.name||'Spelare'),
      board_key:`replay|game|1|${stamp}|${id}|${mode}|${area}|${room}`,
      score:Math.max(1,Math.floor(Number(snapshot.totalMoves)||0)),
      updated_at:iso
    }];

    players.slice(0,8).forEach((player,index)=>{
      const stat=Number.isFinite(Number(player.score))&&Number(player.score)>0?`s${Math.floor(Number(player.score))}`:`k${Math.floor(Number(player.strikes)||0)}`;
      rows.push({user_id:userId,player_name:clean(player.name||`Spelare ${index+1}`),board_key:`replay|player|1|${id}|${String(index).padStart(2,'0')}|${stat}`,score:index+1,updated_at:iso});
    });

    if(snapshot.kind==='street'){
      for(const round of snapshot.rounds||[]){
        const scoreToken=`${Math.floor(Number(round.scores?.[0])||0)}-${Math.floor(Number(round.scores?.[1])||0)}`;
        (round.used||[]).slice(0,200).forEach((name,index)=>rows.push({user_id:userId,player_name:clean(name),board_key:`replay|street|1|${id}|${Math.floor(Number(round.round)||1)}|${String(index+1).padStart(3,'0')}|${scoreToken}`,score:index+1,updated_at:iso}));
      }
      return rows;
    }

    let pointCount=0;
    for(const round of snapshot.rounds||[]){
      for(const point of round.route||[]){
        if(pointCount>=ROUTE_LIMIT)break;
        pointCount++;
        rows.push({user_id:userId,player_name:clean(point.name),board_key:`replay|pt|1|${id}|${Math.floor(Number(round.round)||1)}|${String(point.index||pointCount).padStart(3,'0')}|${Number(point.lat).toFixed(5)}|${Number(point.lon).toFixed(5)}|${Math.max(0,Math.floor(Number(point.playerIndex)||0))}|${token(point.countryCode||'-',3)}`,score:point.index||pointCount,updated_at:iso});
      }
      (round.crossings||[]).slice(0,20).forEach((crossing,index)=>rows.push({user_id:userId,player_name:'Korsning',board_key:`replay|x|1|${id}|${Math.floor(Number(round.round)||1)}|${String(index+1).padStart(2,'0')}|${Number(crossing.lat).toFixed(5)}|${Number(crossing.lon).toFixed(5)}`,score:index+1,updated_at:iso}));
      if(pointCount>=ROUTE_LIMIT)break;
    }
    return rows;
  }

  async function saveSnapshot(snapshot){
    const client=await getClient(),user=await ensureUser(),id=await gameId(snapshot),rows=gameRows(snapshot,id,user.id);
    for(let i=0;i<rows.length;i+=400){
      const result=await client.from(TABLE).upsert(rows.slice(i,i+400),{onConflict:'user_id,board_key'});
      if(result.error)throw result.error;
    }
    return id;
  }

  function tickRegular(){
    let g;try{g=game}catch{return}
    if(g?.active&&!g.finished){
      if(!regularTrack||regularTrack.saved)startRegular();
      const round=currentRound();
      if(regularTrack.last&&((round.round>regularTrack.lastRound)||(round.route.length<regularTrack.lastLength&&regularTrack.lastLength>0)))putRound(regularTrack,regularTrack.last);
      regularTrack.last=round;regularTrack.lastRound=round.round;regularTrack.lastLength=round.route.length;
      return;
    }
    if(g?.finished){
      if(!regularTrack)startRegular();
      if(regularTrack.saved||regularTrack.saving||Date.now()<regularTrack.nextTry)return;
      regularTrack.saving=true;
      saveSnapshot(regularSnapshot()).then(()=>{regularTrack.saved=true}).catch(error=>{regularTrack.nextTry=Date.now()+10000;console.warn('Spelomgången kunde inte sparas.',error)}).finally(()=>{regularTrack.saving=false});
      return;
    }
    if(regularTrack&&!regularTrack.saved)regularTrack=null;
  }

  function tickStreet(){
    const dom=streetDom();
    if(dom.active&&dom.current&&dom.current!=='–'){
      if(!streetTrack||streetTrack.saved)startStreet(dom);
      if(streetTrack.last&&((dom.round>streetTrack.lastRound)||(dom.used.length<streetTrack.lastLength&&streetTrack.lastLength>0)))putStreetRound(streetTrack,streetTrack.last);
      streetTrack.last=streetRound(dom);streetTrack.lastRound=dom.round;streetTrack.lastLength=dom.used.length;
      if(dom.overlayVisible&&Math.max(...dom.scores)>=3&&!streetTrack.saved&&!streetTrack.saving&&Date.now()>=streetTrack.nextTry){
        streetTrack.saving=true;
        saveSnapshot(streetSnapshot(dom)).then(()=>{streetTrack.saved=true}).catch(error=>{streetTrack.nextTry=Date.now()+10000;console.warn('Gatduellen kunde inte sparas.',error)}).finally(()=>{streetTrack.saving=false});
      }
      return;
    }
    if(streetTrack&&!streetTrack.saved&&!dom.active)streetTrack=null;
  }

  setInterval(()=>{tickRegular();tickStreet()},450);
})();
