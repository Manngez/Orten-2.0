  const SCORE = window.OrtenHighscore;
  const GLOBAL_SCORE = window.OrtenGlobalHighscore;

  function ensureSearchWorker(){
    if(searchWorker) return searchWorker;
    if(!('Worker' in window)) throw new Error('Den här webbläsaren saknar stöd för Web Workers.');
    searchWorker=new Worker('place-worker.js');
    searchWorker.addEventListener('message',event=>{
      const msg=event.data||{};
      if(msg.type==='ready'){
        placeDataReady=true; placeDataCount=Number(msg.count)||0;
        if(game.active && !els.placeInput.value.trim()) setSearchState(`${placeDataCount.toLocaleString('sv-SE')} spelbara orter är redo.`);
        return;
      }
      if(msg.type==='result'){
        const pending=searchPending.get(msg.requestId); if(!pending)return;
        searchPending.delete(msg.requestId); pending.resolve({results:msg.results||[],total:Number(msg.total)||0});
        return;
      }
      if(msg.type==='error'){
        if(msg.requestId){const pending=searchPending.get(msg.requestId);if(pending){searchPending.delete(msg.requestId);pending.reject(new Error(msg.message||'Kunde inte läsa ortregistret.'));}}
      }
    });
    searchWorker.addEventListener('error',event=>{
      const err=new Error(event.message||'Ortsökningen kunde inte starta.');
      for(const pending of searchPending.values()) pending.reject(err);
      searchPending.clear(); searchWorker?.terminate(); searchWorker=null; placeDataReady=false;
    });
    searchWorker.postMessage({type:'warm',countryNames:countryNameMap()});
    return searchWorker;
  }

  function warmPlaceIndex(){
    try{ensureSearchWorker(); if(!placeDataReady) setSearchState('Laddar världens ortregister i bakgrunden…','loading');}
    catch(err){console.error(err);setSearchState('Din webbläsare kunde inte starta ortregistret.','error');}
  }

  function findPlaces(query){
    const key=searchCacheKey(query); const cached=searchCache.get(key); if(cached)return Promise.resolve(cached);
    const worker=ensureSearchWorker(); const requestId=++searchRequestId; const allowedCodes=scopeCodes(game.settings);
    return new Promise((resolve,reject)=>{
      searchPending.set(requestId,{resolve:payload=>{rememberSearch(key,payload);resolve(payload)},reject});
      worker.postMessage({type:'search',requestId,query,allowedCodes,placeType:game.settings.placeType,countryNames:countryNameMap()});
    });
  }

  function typeLabel(type){return {capital:'huvudstad',admin:'administrativ huvudort',city:'stad',urban:'större ort',settlement:'ort'}[type]||'ort';}

  function setSearchState(text,kind=''){els.searchState.textContent=text;els.searchState.classList.remove('error','loading');if(kind)els.searchState.classList.add(kind)}
  function placeSecondary(p){return [p.region,p.country].filter(Boolean).join(' · ')}

  function openPlaceChooser(results,query,total=results.length){
    placeChooserOpen=true; els.placeChoices.innerHTML=''; els.placeModalTitle.textContent=results.every(p=>norm(p.name)===norm(results[0].name))?`Vilken ${results[0].name} menar du?`:'Vilken plats menar du?';
    els.placeModalText.textContent=total>results.length?`Visar de ${results.length} mest relevanta av ${total} träffar för “${query}”. Lägg till region eller land efter ett kommatecken för att begränsa.`:`${results.length} möjliga träffar för “${query}”. Välj rätt land och region innan draget registreras.`;
    results.forEach(p=>{
      const b=document.createElement('button');b.type='button';b.className='place-choice';b.innerHTML=`<span class="place-flag">${D.flag(p.countryCode)}</span><span><strong>${esc(p.name)}</strong><small>${esc(placeSecondary(p))} · ${esc(typeLabel(p.type))}</small></span><span class="place-coords">${p.lat.toFixed(3)}<br>${p.lon.toFixed(3)}</span>`;
      b.addEventListener('click',()=>{closePlaceChooser();commitPlace(p)});els.placeChoices.appendChild(b);
    });
    els.placeModal.classList.remove('hidden');
  }
  function closePlaceChooser(){placeChooserOpen=false;els.placeModal.classList.add('hidden');updateGameUI()}

  async function onPlaceSubmit(e){
    e.preventDefault(); if(!game.active||game.finished||game.paused)return;
    const q=els.placeInput.value.trim(); if(!q)return; const codes=scopeCodes(game.settings); if(game.settings.scope==='custom'&&!codes.length)return toast('Inga länder är valda.','error');
    els.playButton.disabled=true;els.playButton.textContent='Söker…';setSearchState('Söker plats och kontrollerar land/region…','loading');
    try{
      const payload=await findPlaces(q); const results=payload.results; if(!results.length){setSearchState(`Ingen tillåten ort hittades för “${q}”. Kontrollera stavningen eller lägg till region/land.`,'error');return toast('Ingen matchande ort hittades.','error')}
      if(results.length===1 && payload.total===1){els.placeInput.value='';commitPlace(results[0]);}
      else openPlaceChooser(results,q,payload.total);
    }catch(err){console.error(err);setSearchState('Ortsregistret kunde inte laddas. Kontrollera nätet och försök igen.','error');toast('Kunde inte läsa världens ortregister just nu.','error',4300)}finally{els.playButton.disabled=false;els.playButton.textContent='Spela'}
  }

  function nextActiveIndex(from){
    if(!game.players.length)return 0; for(let step=1;step<=game.players.length;step++){const i=(from+step)%game.players.length;if(game.players[i].active)return i;}return from;
  }

  function commitPlace(place){
    if(game.finished||game.paused)return; if(isDuplicate(place))return toast(`${place.name} har redan använts enligt den valda dubblettregeln.`,'error',3900);
    const playerIndex=game.currentIndex; const crossings=crossingsForNewPlace(place);
    const ownPrev=game.settings.mode==='duel'?DUEL.playerLast(game.route,playerIndex):game.route.at(-1);
    const playerMoveNumber=game.settings.mode==='duel'?DUEL.playerMoveCount(game.route,playerIndex)+1:null;
    const stored={...place,playerIndex,ux:unwrapLon(place.lon,ownPrev?.ux),moveNumber:game.totalMoves+1,...(playerMoveNumber?{playerMoveNumber}:{})};
    game.route.push(stored);game.totalMoves++;game.roundMoves++;game.lastCrossings=crossings; if(crossings.length)game.totalCrossings++;
    els.placeInput.value='';setSearchState(`${D.flag(place.countryCode)} ${place.name} registrerad · ${placeSecondary(place)}`);tone(crossings.length?'cross':'move');renderMap();updateRecentChoices();
    if(crossings.length){showCrossBanner(crossings,stored);handleCrossing(playerIndex,crossings);}else{if(game.settings.mode!=='solo')game.currentIndex=nextActiveIndex(playerIndex);updateGameUI();resetTurnTimer();fitRoute(false)}
  }

  function showCrossBanner(crossings,place){
    clearTimeout(crossBannerTimer);const first=crossings[0];const endIndex=first.crossedEndIndex??(first.crossedSegmentIndex+1);const seg=game.route[endIndex];
    const prefix=game.settings.mode==='duel'?'Din egen linje: ':'';
    els.crossBannerText.textContent=`${prefix}${place.name} skär sträckan mot ${seg?.name||'en tidigare ort'}${crossings.length>1?` · ${crossings.length} korsningar i samma drag`:''}`;els.crossBanner.classList.remove('hidden');
    crossBannerTimer=setTimeout(()=>els.crossBanner.classList.add('hidden'),5200);
    if(map&&first)withProgrammaticMap(()=>map.flyTo([first.lat,first.lon],Math.max(map.getZoom(),5),{duration:.6}));
  }

  function handleCrossing(playerIndex,crossings){
    const player=game.players[playerIndex];game.bestRound=Math.max(game.bestRound,game.roundMoves);
    if(game.settings.mode==='solo'){game.finished=true;updateGameUI();showFinalResult({kind:'solo',loser:player});return}
    if(game.settings.mode==='duel'){
      const limit=Math.max(1,Number(game.settings.strikeLimit)||1);player.strikes++;
      if(player.strikes>=limit){const winner=game.players.find((p,i)=>i!==playerIndex&&p.active);game.finished=true;updateGameUI();showFinalResult({kind:'duel',loser:player,winner});return}
      game.currentIndex=nextActiveIndex(playerIndex);updateGameUI();resetTurnTimer();toast(`${player.name} korsade sin egen linje (${player.strikes}/${limit}). Duellen fortsätter.`,'error',3900);return;
    }
    if(game.settings.mode==='classic'){game.finished=true;updateGameUI();showFinalResult({kind:'loss',loser:player});return}
    if(game.settings.mode==='endurance'){
      player.strikes++; if(player.strikes>=game.settings.strikeLimit){game.finished=true;updateGameUI();showFinalResult({kind:'loss',loser:player});return}
      game.currentIndex=nextActiveIndex(playerIndex);updateGameUI();resetTurnTimer();toast(`${player.name} får en korsning (${player.strikes}/${game.settings.strikeLimit}). Spelet fortsätter.`,'error',3900);return;
    }
    if(game.settings.mode==='elimination'){
      player.active=false; const active=game.players.filter(p=>p.active); if(active.length<=1){game.finished=true;updateGameUI();showFinalResult({kind:'winner',winner:active[0],loser:player});return}
      game.pendingNextRound=true;game.currentIndex=nextActiveIndex(playerIndex);updateGameUI();showEliminationRoundResult(player);return;
    }
  }

  function statCards(){
    if(game.settings?.mode==='duel'){
      const a=DUEL.playerMoveCount(game.route,0),b=DUEL.playerMoveCount(game.route,1);
      return `<div class="result-stat"><strong>${a}</strong><span>${esc(game.players[0]?.name||'SPELARE 1')} · ORTER</span></div><div class="result-stat"><strong>${b}</strong><span>${esc(game.players[1]?.name||'SPELARE 2')} · ORTER</span></div><div class="result-stat"><strong>${game.totalCrossings}</strong><span>KORSNINGSDRAG</span></div>`;
    }
    return `<div class="result-stat"><strong>${game.totalMoves}</strong><span>DRAG TOTALT</span></div><div class="result-stat"><strong>${game.bestRound||game.roundMoves}</strong><span>BÄSTA RUTT</span></div><div class="result-stat"><strong>${game.totalCrossings}</strong><span>KORSNINGAR</span></div>`;
  }
  function recordSoloHighscore(){
    if(!SCORE||game.settings?.mode!=='solo')return null;
    return SCORE.record({settings:game.settings,playerName:game.players[0]?.name,score:game.route.length,completedAt:Date.now()});
  }
  function highscoreStat(result){
    if(!result?.eligible)return '';
    if(result.personalBest)return `<div class="result-stat highscore-best"><strong>#${result.rank||'–'}</strong><span>NYTT LOKALT PB · ${result.score} ORTER</span></div>`;
    if(result.previousBest!=null)return `<div class="result-stat"><strong>${result.previousBest}</strong><span>LOKALT PERSONBÄSTA · PLATS #${result.rank||'–'}</span></div>`;
    return '';
  }
  function globalHighscorePlaceholder(){
    return `<div class="result-stat global-highscore-stat syncing" id="globalHighscoreResult"><strong>…</strong><span>SYNKAR GLOBAL HIGHSCORE</span></div>`;
  }
  async function syncGlobalHighscore(){
    const host=$('globalHighscoreResult');
    if(!host)return;
    if(!GLOBAL_SCORE){host.classList.remove('syncing');host.innerHTML='<strong>⌁</strong><span>LOKALT SPARAT · GLOBAL TJÄNST EJ LADDAD</span>';return}
    const snapshot={settings:JSON.parse(JSON.stringify(game.settings)),playerName:game.players[0]?.name,score:game.route.length,source:'solo-result'};
    try{
      const result=await GLOBAL_SCORE.record(snapshot);
      if(!host.isConnected)return;
      host.classList.remove('syncing','sync-error');host.classList.add('synced');
      if(result.personalBest)host.innerHTML=`<strong>#${result.rank||'–'}</strong><span>NYTT GLOBALT PB · ${result.score} ORTER</span>`;
      else host.innerHTML=`<strong>#${result.rank||'–'}</strong><span>GLOBALT PB · ${result.score} ORTER</span>`;
      window.dispatchEvent(new CustomEvent('orten:global-highscore-updated',{detail:result}));
    }catch(err){
      console.warn('Global highscore kunde inte synkas.',err);
      if(!host.isConnected)return;
      host.classList.remove('syncing');host.classList.add('sync-error');host.innerHTML='<strong>⌁</strong><span>LOKALT SPARAT · GLOBAL SYNK MISSLYCKADES</span>';
    }
  }
  function showFinalResult({kind,loser,winner}){
    els.continueButton.classList.add('hidden');els.playAgainButton.classList.remove('hidden');els.changeSettingsButton.classList.remove('hidden');
    $('resultHighscoreButton')?.classList.toggle('hidden',kind!=='solo');
    if(kind==='winner'){els.resultIcon.textContent='🏆';els.resultTitle.textContent=`${winner?.name||'Vinnaren'} vinner!`;els.resultText.textContent=`Alla andra spelare har slagits ut efter ${game.round} rundor.`;}
    else if(kind==='duel'){
      const loserIndex=game.players.indexOf(loser),winnerIndex=game.players.indexOf(winner);const loserMoves=DUEL.playerMoveCount(game.route,loserIndex),winnerMoves=DUEL.playerMoveCount(game.route,winnerIndex);
      els.resultIcon.textContent='⚔️';els.resultTitle.textContent=`${winner?.name||'Vinnaren'} vinner duellen!`;els.resultText.textContent=`${loser?.name||'Motståndaren'} korsade sin egen linje efter ${loserMoves} orter. ${winner?.name||'Vinnaren'} hade ${winnerMoves} orter på sin linje.`;
    }
    else if(kind==='solo'){els.resultIcon.textContent='🧭';els.resultTitle.textContent='Rutten korsades';els.resultText.textContent=`Din rutt nådde ${game.route.length} orter innan en ny sträcka skar en tidigare linje.`;}
    else{els.resultIcon.textContent='⚡';els.resultTitle.textContent=`${loser?.name||'Spelaren'} korsade linjen`;els.resultText.textContent=`Rutten höll i ${game.roundMoves} orter. Den korsade sträckan är markerad på kartan.`;}
    const highscore=kind==='solo'?recordSoloHighscore():null;
    els.resultStats.innerHTML=statCards()+highscoreStat(highscore)+(kind==='solo'?globalHighscorePlaceholder():'');els.resultModal.classList.remove('hidden');
    if(kind==='solo')syncGlobalHighscore();
  }

  function showEliminationRoundResult(loser){
    $('resultHighscoreButton')?.classList.add('hidden');
    els.resultIcon.textContent='💥';els.resultTitle.textContent=`${loser.name} är utslagen`;els.resultText.textContent=`Runda ${game.round} slutade efter ${game.roundMoves} orter. En ny tom rutt startar med ${game.players.filter(p=>p.active).length} spelare kvar.`;els.resultStats.innerHTML=statCards();
    els.continueButton.classList.remove('hidden');els.playAgainButton.classList.add('hidden');els.changeSettingsButton.classList.add('hidden');els.resultModal.classList.remove('hidden');
  }

  function continueElimination(){
    if(!game.pendingNextRound)return; game.pendingNextRound=false;game.round++;game.route=[];game.lastCrossings=[];game.roundMoves=0;els.resultModal.classList.add('hidden');renderMap();resetMapToInitial();updateGameUI();resetTurnTimer();toast(`Runda ${game.round} – ny rutt.`);setTimeout(()=>els.placeInput.focus(),100);
  }
