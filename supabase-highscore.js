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

  async function list(settings={}){
    const key=boardKey(settings);
    const client=await getClient();
    const result=await client
      .from(TABLE)
      .select('player_name,score,updated_at')
      .eq('board_key',key)
      .order('score',{ascending:false})
      .order('updated_at',{ascending:true})
      .limit(10);
    if(result.error)throw result.error;
    return {online:true,boardKey:key,entries:normalizeRows(result.data)};
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

  async function record({settings,playerName,score,source}={}){
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

    if(personalBest){
      const now=new Date().toISOString();
      const write=await client
        .from(TABLE)
        .upsert({
          user_id:user.id,
          player_name:cleanName(playerName),
          board_key:key,
          score:numeric,
          updated_at:now
        },{onConflict:'user_id,board_key'});
      if(write.error)throw write.error;
      storedScore=numeric;
    }

    const [rank,board]=await Promise.all([rankForScore(key,storedScore),list(settings)]);
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
      boardKey:key
    };
  }

  async function ping(settings={}){
    const board=await list({...settings,mode:'solo'});
    return {online:true,count:board.entries.length};
  }

  return Object.freeze({PROJECT_URL,SDK_URL,TABLE,boardKey,normalizeRows,isPersonalBest,isEligibleSubmission,list,record,ping});
});
