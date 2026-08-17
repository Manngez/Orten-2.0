'use strict';

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(typeof window!=='undefined'){
    window.OrtenStreetDuelDifficulty=api;
    if(window.OrtenStreetDuel) api.install(window,window.OrtenStreetDuel);
  }
})(typeof window!=='undefined'?window:globalThis,()=>{
  const LEVELS={
    hard:{key:'hard',label:'Hard',steps:1,icon:'🔴',help:'Direkt anslutande gata · 1 steg'},
    medium:{key:'medium',label:'Medium',steps:2,icon:'🟡',help:'Direkt eller via en gata · max 2 steg'},
    easy:{key:'easy',label:'Easy',steps:3,icon:'🟢',help:'Upp till två mellanliggande gator · max 3 steg'}
  };
  const STORAGE_KEY='orten2:street-duel-difficulty';

  function norm(value=''){
    return String(value).trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  }

  function getLevel(key='hard'){
    return LEVELS[String(key).toLowerCase()]||LEVELS.hard;
  }

  function resolve(graph,name=''){
    return graph?.get?.(name)?.name||null;
  }

  function shortestPath(graph,from,to,maxSteps=3){
    const start=resolve(graph,from),target=resolve(graph,to);
    if(!start||!target) return null;
    const limit=Math.max(0,Math.min(12,Number(maxSteps)||0));
    if(norm(start)===norm(target)) return [start];
    const queue=[[start]];
    const visited=new Set([norm(start)]);
    while(queue.length){
      const path=queue.shift();
      const steps=path.length-1;
      if(steps>=limit) continue;
      for(const next of graph.neighbors?.(path[path.length-1])||[]){
        const key=norm(next);
        if(visited.has(key)) continue;
        const nextPath=[...path,next];
        if(key===norm(target)) return nextPath;
        visited.add(key);
        queue.push(nextPath);
      }
    }
    return null;
  }

  function validateMove(graph,current,candidate,used=[],maxSteps=1){
    const currentName=resolve(graph,current);
    const candidateName=resolve(graph,candidate);
    if(!candidateName) return {ok:false,reason:'unknown'};
    const usedKeys=new Set((used||[]).map(norm));
    if(usedKeys.has(norm(candidateName))) return {ok:false,reason:'used',name:candidateName};
    if(!currentName) return {ok:false,reason:'not-crossing',name:candidateName};
    const path=shortestPath(graph,currentName,candidateName,maxSteps);
    if(!path) return {ok:false,reason:'not-crossing',name:candidateName,maxSteps:Number(maxSteps)||1};
    return {ok:true,name:candidateName,steps:path.length-1,path,maxSteps:Number(maxSteps)||1};
  }

  function reachableUnused(graph,current,used=[],maxSteps=1){
    const start=resolve(graph,current);
    if(!start) return [];
    const limit=Math.max(1,Math.min(12,Number(maxSteps)||1));
    const usedKeys=new Set((used||[]).map(norm));
    const visited=new Set([norm(start)]);
    const result=[];
    let frontier=[start];
    for(let depth=1;depth<=limit;depth++){
      const nextFrontier=[];
      for(const item of frontier){
        for(const next of graph.neighbors?.(item)||[]){
          const key=norm(next);
          if(visited.has(key)) continue;
          visited.add(key);
          nextFrontier.push(next);
          if(!usedKeys.has(key)) result.push(next);
        }
      }
      frontier=nextFrontier;
      if(!frontier.length) break;
    }
    return result.sort((a,b)=>a.localeCompare(b,'sv'));
  }

  function install(win,engine){
    if(!win||!engine||engine.__difficultyInstalled) return null;
    engine.__difficultyInstalled=true;

    let selectedKey='hard';
    try{
      const saved=win.localStorage.getItem(STORAGE_KEY);
      if(saved&&LEVELS[saved]) selectedKey=saved;
    }catch{}

    let lastResult=null;
    let syncing=false;
    const currentLevel=()=>getLevel(selectedKey);

    const originalValidate=engine.validateMove?.bind(engine);
    const originalUnused=engine.unusedNeighbors?.bind(engine);
    engine.validateMove=function(graph,current,candidate,used=[]){
      const level=currentLevel();
      const result=validateMove(graph,current,candidate,used,level.steps);
      lastResult=result.ok?result:null;
      win.queueMicrotask?.(()=>renderPath());
      return result;
    };
    engine.unusedNeighbors=function(graph,current,used=[]){
      return reachableUnused(graph,current,used,currentLevel().steps);
    };

    function save(key){
      selectedKey=LEVELS[key]?key:'hard';
      try{win.localStorage.setItem(STORAGE_KEY,selectedKey);}catch{}
      lastResult=null;
      syncAll();
    }

    function ensureChoice(){
      const card=win.document.getElementById('streetDuelOverlayCard');
      const start=win.document.getElementById('streetDuelStart');
      if(!card||!start||win.document.getElementById('streetDuelDifficultyChoice')) return;
      const wrap=win.document.createElement('label');
      wrap.id='streetDuelDifficultyChoice';
      wrap.style.cssText='display:grid;gap:6px;margin:0 0 14px;color:#bed3dc;font-size:11px;font-weight:800';
      wrap.innerHTML=`<span>Svårighetsgrad</span><select id="streetDuelDifficultySelect" aria-label="Svårighetsgrad" style="height:46px;border-radius:13px;border:1px solid rgba(132,181,201,.2);background:#081a27;color:#fff;padding:0 12px;font:inherit">${Object.values(LEVELS).map(level=>`<option value="${level.key}"${level.key===selectedKey?' selected':''}>${level.icon} ${level.label} · ${level.steps} steg</option>`).join('')}</select><small id="streetDuelDifficultyHelp" style="font-weight:600;color:#819aa6;line-height:1.4"></small>`;
      const timerChoice=win.document.getElementById('streetDuelTimerChoice');
      (timerChoice||start).insertAdjacentElement('beforebegin',wrap);
      win.document.getElementById('streetDuelDifficultySelect')?.addEventListener('change',event=>save(event.target.value));
    }

    function ensureGameStatus(){
      const prompt=win.document.getElementById('streetDuelPrompt');
      if(prompt&&!win.document.getElementById('streetDuelDifficultyStatus')){
        const status=win.document.createElement('div');
        status.id='streetDuelDifficultyStatus';
        status.style.cssText='margin:0 0 10px;padding:8px 10px;border:1px solid rgba(132,181,201,.14);border-radius:11px;background:rgba(255,255,255,.025);font-size:10px;font-weight:850;color:#b9d0da';
        prompt.insertAdjacentElement('beforebegin',status);
      }
      const message=win.document.getElementById('streetDuelMessage');
      if(message&&!win.document.getElementById('streetDuelPathHint')){
        const hint=win.document.createElement('div');
        hint.id='streetDuelPathHint';
        hint.style.cssText='display:none;margin-top:7px;padding:9px 10px;border-radius:11px;background:rgba(104,246,255,.055);border:1px solid rgba(104,246,255,.13);font-size:10px;line-height:1.45;color:#bdebf0;overflow-wrap:anywhere';
        message.insertAdjacentElement('afterend',hint);
      }
    }

    function syncText(){
      const level=currentLevel();
      const help=win.document.getElementById('streetDuelDifficultyHelp');
      if(help) help.textContent=level.help;
      const status=win.document.getElementById('streetDuelDifficultyStatus');
      if(status) status.textContent=`${level.icon} ${level.label} · ${level.steps===1?'direkt anslutning':'max '+level.steps+' steg'}`;
      const select=win.document.getElementById('streetDuelDifficultySelect');
      if(select&&select.value!==selectedKey) select.value=selectedKey;
    }

    function renderPath(){
      const hint=win.document.getElementById('streetDuelPathHint');
      if(!hint) return;
      const level=currentLevel();
      if(!lastResult?.ok||level.steps===1){
        hint.style.display='none';hint.textContent='';return;
      }
      hint.style.display='block';
      hint.textContent=`✓ ${lastResult.steps} ${lastResult.steps===1?'steg':'steg'}: ${lastResult.path.join(' → ')}`;
    }

    function clearPathOnNewRound(){
      const message=win.document.getElementById('streetDuelMessage');
      if(!message) return;
      const text=message.textContent.trim();
      if(text.startsWith('Skriv en gata')){
        lastResult=null;
        renderPath();
      }
    }

    function syncAll(){
      if(syncing) return;
      syncing=true;
      try{
        ensureChoice();
        ensureGameStatus();
        syncText();
        renderPath();
        clearPathOnNewRound();
      }finally{syncing=false;}
    }

    const observer=new win.MutationObserver(()=>win.queueMicrotask?.(syncAll));
    function bootstrap(){
      syncAll();
      observer.observe(win.document.body,{childList:true,subtree:true,characterData:true});
    }
    if(win.document.readyState==='loading') win.document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
    else bootstrap();

    const controls={
      levels:LEVELS,
      get key(){return selectedKey;},
      get level(){return currentLevel();},
      setLevel:save,
      shortestPath,
      validateMove,
      reachableUnused,
      uninstall(){
        observer.disconnect();
        if(originalValidate) engine.validateMove=originalValidate;
        if(originalUnused) engine.unusedNeighbors=originalUnused;
        delete engine.__difficultyInstalled;
      }
    };
    win.OrtenStreetDuelDifficultyOptions=controls;
    return controls;
  }

  return {LEVELS,STORAGE_KEY,norm,getLevel,shortestPath,validateMove,reachableUnused,install};
});
