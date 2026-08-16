'use strict';

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OrtenHighscore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const PREFIX='orten2:highscore:v1:';
  const LIMIT=10;
  const STORAGE_LIMIT=100;
  const NORDIC_CODES=['DK','FI','IS','NO','SE'];

  function norm(value=''){
    return String(value).trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  }

  function cleanName(value=''){
    const name=String(value).replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
    return name||'Spelare';
  }

  function scopeKey(settings={}){
    if(settings.scope==='country')return `country:${String(settings.country||'SE').toUpperCase()}`;
    if(settings.scope==='continent')return `continent:${settings.continent||'europe'}`;
    if(settings.scope==='custom'){
      const codes=[...(settings.countries||[])].map(code=>String(code).toUpperCase()).sort();
      if(codes.length===NORDIC_CODES.length&&NORDIC_CODES.every((code,i)=>code===codes[i]))return 'nordic';
      return `custom:${codes.join(',')||'none'}`;
    }
    return 'world';
  }

  function boardKey(settings={}){
    const placeType=settings.placeType||'any';
    const duplicatePolicy=settings.duplicatePolicy||'exact';
    return `solo|${scopeKey(settings)}|${placeType}|${duplicatePolicy}`;
  }

  function storageKey(settings){return `${PREFIX}${boardKey(settings)}`;}

  function safeStorage(storage){
    if(storage)return storage;
    try{return globalThis.localStorage||null}catch{return null}
  }

  function readAll(settings,storage){
    const target=safeStorage(storage);if(!target)return [];
    try{
      const parsed=JSON.parse(target.getItem(storageKey(settings))||'[]');
      if(!Array.isArray(parsed))return [];
      return parsed.filter(row=>row&&Number.isFinite(row.score)&&row.score>0&&row.name).map(row=>({
        name:cleanName(row.name),score:Math.floor(row.score),date:Number(row.date)||0
      })).sort((a,b)=>b.score-a.score||a.date-b.date).slice(0,STORAGE_LIMIT);
    }catch{return []}
  }

  function write(settings,rows,storage){
    const target=safeStorage(storage);if(!target)return false;
    try{target.setItem(storageKey(settings),JSON.stringify(rows.slice(0,STORAGE_LIMIT)));return true}catch{return false}
  }

  function record({settings,playerName,score,completedAt=Date.now()}={},storage){
    if(!settings||settings.mode!=='solo')return {eligible:false,saved:false,personalBest:false,rank:null,entries:[]};
    const numeric=Math.floor(Number(score));
    if(!Number.isFinite(numeric)||numeric<1)return {eligible:true,saved:false,personalBest:false,rank:null,entries:list(settings,storage)};

    const name=cleanName(playerName);
    const playerKey=norm(name);
    const entries=readAll(settings,storage);
    const previous=entries.find(row=>norm(row.name)===playerKey)||null;
    const personalBest=!previous||numeric>previous.score;

    let next=entries;
    if(personalBest){
      next=entries.filter(row=>norm(row.name)!==playerKey);
      next.push({name,score:numeric,date:Number(completedAt)||Date.now()});
      next.sort((a,b)=>b.score-a.score||a.date-b.date);
      next=next.slice(0,STORAGE_LIMIT);
      write(settings,next,storage);
    }

    const active=personalBest?next:entries;
    const rank=active.findIndex(row=>norm(row.name)===playerKey)+1;
    return {
      eligible:true,
      saved:personalBest,
      personalBest,
      previousBest:previous?.score??null,
      score:numeric,
      rank:rank||null,
      entries:active.slice(0,LIMIT),
      boardKey:boardKey(settings)
    };
  }

  function list(settings,storage){return readAll({...settings,mode:'solo'},storage).slice(0,LIMIT);}
  function best(settings,playerName,storage){
    const key=norm(cleanName(playerName));
    return readAll({...settings,mode:'solo'},storage).find(row=>norm(row.name)===key)||null;
  }
  function formatDate(timestamp,locale='sv-SE'){
    if(!timestamp)return '';
    try{return new Intl.DateTimeFormat(locale,{day:'numeric',month:'short'}).format(new Date(timestamp))}catch{return ''}
  }

  return Object.freeze({LIMIT,boardKey,storageKey,cleanName,list,best,record,formatDate});
});
