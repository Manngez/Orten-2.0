'use strict';

(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OrtenGlobalHighscore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const PROJECT_URL='https://mewauzsogkbcchnvsath.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_lWTB9F286pzThGxYp3Zj2w_uIco-VDU';
  const SDK_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
  const TABLE='orten_highscores';
  const REPLAY_PREFIX='replay|';
  const HS=root?.OrtenHighscore;

  let sdkPromise=null;
  let clientPromise=null;
  let sessionPromise=null;

  function cleanName(value=''){
    if(HS?.cleanName)return HS.cleanName(value);
    const name=String(value).replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
    return name||'Spelare';
  }

  function boardKey(settings={}){
    if(!HS?.boardKey)throw new Error('Den lokala highscore-motorn är inte laddad.');
    return HS.boardKey({...settings,mode:'solo'});
  }

  function normalizeRows(rows=[]){
    return (Array.isArray(rows)?rows:[])
      .filter(row=>row&&Number.isFinite(Number(row.score))&&Number(row.score)>0)
      .map(row=>({
        name:cleanName(row.player_name||row.name),
        score:Math.floor(Number(row.score)),
        date:row.updated_at?Date.parse(row.updated_at):(Number(row.date)||0),
        userId:row.user_id||row.userId||null,
        boardKey:row.board_key||row.boardKey||null,
        hasReplay:!!row.hasReplay,
        source:'global'
      }))
      .sort((a,b)=>b.score-a.score||a.date-b.date)
      .slice(0,10);
  }

  function isPersonalBest(previousScore,nextScore){
    const next=Math.floor(Number(nextScore));
    if(!Number.isFinite(next)||next<1)return false;
    if(previousScore==null)return true;
    const previous=Math.floor(Number(previousScore));
    return !Number.isFinite(previous)||next>previous;
  }

  function isEligibleSubmission(settings={},source=''){
    return settings?.mode==='solo'&&source==='solo-result';
  }

  function boardToken(value=''){
    const text=String(value);
    try{
      if(typeof Buffer!=='undefined')return Buffer.from(text,'utf8').toString('base64url');
    }catch{}
    try{
      const bytes=new TextEncoder().encode(text);let binary='';
      bytes.forEach(byte=>{binary+=String.fromCharCode(byte)});
      return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }catch{}
    return Array.from(text).map(ch=>ch.codePointAt(0).toString(16).padStart(4,'0')).join('');
  }

  function replayPrefix(key,stamp){
    return `${REPLAY_PREFIX}${boardToken(key)}|${Math.floor(Number(stamp)||0)}|`;
  }

  function normalizeReplayPoints(route=[]){
    return (Array.isArray(route)?route:[]).slice(0,500).map((point,index)=>({
      index:index+1,
      name:cleanName(point?.name||`Ort ${index+1}`),
      lat:Number(point?.lat),
      lon:Number(point?.lon),
      countryCode:String(point?.countryCode||'').toUpperCase().slice(0,2)
    })).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180);
  }

  function runtimeReplay(){
    try{
      if(typeof game!=='undefined'&&game?.settings?.mode==='solo'&&Array.isArray(game.route))return {route:game.route};
    }catch{}
    return null;
  }

  function parseReplayBoardKey(value=''){
    const parts=String(value).split('|');
    if(parts.length<7||parts[0]!=='replay')return null;
    const stamp=Number(parts[2]);const index=Number(parts[3]);const lat=Number(parts[4]);const lon=Number(parts[5]);
    if(!Number.isFinite(stamp)||!Number.isFinite(index)||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
    return {token:parts[1],stamp,index,lat,lon,countryCode:String(parts[6]||'').toUpperCase().slice(0,2)};
  }

  function loadSDK(){
    if(root?.supabase?.createClient)return Promise.resolve(root.supabase);
    if(sdkPromise)return sdkPromise;
    if(typeof document==='undefined')return Promise.reject(new Error('Supabase SDK kan bara laddas i webbläsaren.'));

    sdkPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-orten-supabase-sdk]');
      const finish=()=>root?.supabase?.createClient?resolve(root.supabase):reject(new Error('Supabase SDK laddades men kunde inte startas.'));
      if(existing){
        if(root?.supabase?.createClient)return finish();
        existing.addEventListener('load',finish,{once:true});
        existing.addEventListener('error',()=>reject(new Error('Supabase SDK kunde inte laddas.')),{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src=SDK_URL;
      script.async=true;
      script.crossOrigin='anonymous';
      script.dataset.ortenSupabaseSdk='true';
      script.addEventListener('load',finish,{once:true});
      script.addEventListener('error',()=>reject(new Error('Supabase SDK kunde inte laddas.')),{once:true});
      document.head.appendChild(script);
    });
    return sdkPromise;
  }

  async function getClient(){
    if(clientPromise)return clientPromise;
    clientPromise=loadSDK().then(sdk=>sdk.createClient(PROJECT_URL,PUBLISHABLE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    })).catch(error=>{clientPromise=null;throw error});
    return clientPromise;
  }

  async function ensureAnonymousUser(){
    if(sessionPromise)return sessionPromise;
    sessionPromise=(async()=>{
      const client=await getClient();
      const current=await client.auth.getSession();
      if(current.error)throw current.error;
      if(current.data?.session?.user)return current.data.session.user;
      const signedIn=await client.auth.signInAnonymously();
      if(signedIn.error)throw signedIn.error;
      if(!signedIn.data?.user)throw new Error('Supabase skapade ingen anonym spelaridentitet.');
      return signedIn.data.user;
    })().catch(error=>{sessionPromise=null;throw error});
    return sessionPromise;
  }

  async function replayAvailability(client,key,entries){
    const candidates=entries.filter(row=>row.userId&&row.date);
    if(!candidates.length)return entries;
    const userIds=[...new Set(candidates.map(row=>row.userId))];
    const token=boardToken(key);
    const result=await client
      .from(TABLE)
      .select('user_id,board_key')
      .in('user_id',userIds)
      .like('board_key',`${REPLAY_PREFIX}${token}|%`)
      .limit(1000);
    if(result.error)return entries;
    const available=new Set((result.data||[]).map(row=>{
      const parsed=parseReplayBoardKey(row.board_key);
      return parsed?`${row.user_id}|${parsed.stamp}`:null;
    }).filter(Boolean));
    return entries.map(row=>({...row,hasReplay:available.has(`${row.userId}|${row.date}`)}));
  }

  async function listByKey(key){
    const client=await getClient();
    let result=await client
      .from(TABLE)
      .select('user_id,player_name,score,updated_at,board_key')
      .eq('board_key',key)
      .order('score',{ascending:false})
      .order('updated_at',{ascending:true})
      .limit(10);

    if(result.error){
      result=await client
        .from(TABLE)
        .select('player_name,score,updated_at')
        .eq('board_key',key)
        .order('score',{ascending:false})
        .order('updated_at',{ascending:true})
        .limit(10);
    }
    if(result.error)throw result.error;
    const entries=normalizeRows((result.data||[]).map(row=>({...row,board_key:key})));
    let enriched=entries;
    try{enriched=await replayAvailability(client,key,entries)}catch{}
    return {online:true,boardKey:key,entries:enriched};
  }

  async function list(settings={}){
    return listByKey(boardKey(settings));
  }

  async function boards(){
    const client=await getClient();
    const result=await client
      .from(TABLE)
      .select('board_key')
      .like('board_key','solo|%')
      .limit(1000);
    if(result.error)throw result.error;
    const keys=[...new Set((result.data||[]).map(row=>String(row.board_key||'')).filter(key=>key.startsWith('solo|')))];
    return keys.sort();
  }

  async function saveReplay(client,user,key,stamp,replay){
    const points=normalizeReplayPoints(replay?.route||[]);
    if(!points.length)return false;
    const prefix=replayPrefix(key,stamp);
    const now=new Date(stamp).toISOString();
    const rows=points.map(point=>({
      user_id:user.id,
      player_name:point.name,
      board_key:`${prefix}${String(point.index).padStart(4,'0')}|${point.lat.toFixed(5)}|${point.lon.toFixed(5)}|${point.countryCode}`,
      score:point.index,
      updated_at:now
    }));
    const write=await client.from(TABLE).upsert(rows,{onConflict:'user_id,board_key'});
    if(write.error)throw write.error;
    return true;
  }

  async function loadReplay(key,userId,stamp){
    if(!key||!userId||!stamp)return null;
    const client=await getClient();
    const prefix=replayPrefix(key,stamp);
    const result=await client
      .from(TABLE)
      .select('player_name,score,board_key')
      .eq('user_id',userId)
      .like('board_key',`${prefix}%`)
      .order('score',{ascending:true})
      .limit(500);
    if(result.error)throw result.error;
    const points=(result.data||[]).map(row=>{
      const parsed=parseReplayBoardKey(row.board_key);
      if(!parsed)return null;
      return {index:parsed.index,name:cleanName(row.player_name),lat:parsed.lat,lon:parsed.lon,countryCode:parsed.countryCode};
    }).filter(Boolean).sort((a,b)=>a.index-b.index);
    if(!points.length)return null;
    return {boardKey:key,stamp:Number(stamp),points};
  }

  async function rankForScore(key,score){
    const client=await getClient();
    const result=await client
      .from(TABLE)
      .select('id',{count:'exact',head:true})
      .eq('board_key',key)
      .gt('score',score);
    if(result.error)throw result.error;
    return Number(result.count||0)+1;
  }

  async function record({settings,playerName,score,source,replay}={}){
    if(!isEligibleSubmission(settings,source))return {eligible:false,online:true,saved:false,personalBest:false,rank:null,entries:[]};
    const numeric=Math.floor(Number(score));
    if(!Number.isFinite(numeric)||numeric<1)return {eligible:true,online:true,saved:false,personalBest:false,rank:null,entries:(await list(settings)).entries};

    const client=await getClient();
    const user=await ensureAnonymousUser();
    const key=boardKey(settings);
    const existingResult=await client
      .from(TABLE)
      .select('score,player_name,updated_at')
      .eq('user_id',user.id)
      .eq('board_key',key)
      .maybeSingle();
    if(existingResult.error)throw existingResult.error;

    const previous=existingResult.data||null;
    const personalBest=isPersonalBest(previous?.score,numeric);
    let storedScore=previous?.score==null?numeric:Number(previous.score);
    let replaySaved=false;

    if(personalBest){
      const now=new Date();
      const nowIso=now.toISOString();
      const stamp=now.getTime();
      const write=await client
        .from(TABLE)
        .upsert({
          user_id:user.id,
          player_name:cleanName(playerName),
          board_key:key,
          score:numeric,
          updated_at:nowIso
        },{onConflict:'user_id,board_key'});
      if(write.error)throw write.error;
      storedScore=numeric;
      try{replaySaved=await saveReplay(client,user,key,stamp,replay||runtimeReplay())}
      catch(err){console.warn('Highscore sparades, men omgångens replay kunde inte sparas.',err)}
    }

    const [rank,board]=await Promise.all([rankForScore(key,storedScore),listByKey(key)]);
    return {
      eligible:true,
      online:true,
      saved:personalBest,
      personalBest,
      previousBest:previous?.score==null?null:Number(previous.score),
      score:storedScore,
      submittedScore:numeric,
      rank,
      entries:board.entries,
      boardKey:key,
      replaySaved
    };
  }

  async function ping(settings={}){
    const board=await list({...settings,mode:'solo'});
    return {online:true,count:board.entries.length};
  }

  return Object.freeze({PROJECT_URL,SDK_URL,TABLE,REPLAY_PREFIX,boardKey,boardToken,replayPrefix,parseReplayBoardKey,normalizeReplayPoints,normalizeRows,isPersonalBest,isEligibleSubmission,list,listByKey,boards,loadReplay,record,ping});
});
