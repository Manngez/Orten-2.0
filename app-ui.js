  function updateScoreboard(){
    els.scoreboard.innerHTML=game.players.map((p,i)=>{
      const meta=game.settings.mode==='endurance'?`${p.strikes}/${game.settings.strikeLimit} korsningar`:(game.settings.mode==='elimination'?(p.active?'kvar':'utslagen'):'');
      return `<div class="score-row${i===game.currentIndex&&!game.finished?' current':''}${!p.active?' eliminated':''}"><i class="score-dot" style="background:${p.color};box-shadow:0 0 10px ${p.color}"></i><span>${esc(p.name)}</span><span class="score-meta">${esc(meta)}</span></div>`;
    }).join('');
  }

  function updateRouteList(){
    els.routeCount.textContent=String(game.route.length);els.routeList.innerHTML=game.route.map((p,i)=>`<li data-index="${i}"><b>${String(i+1).padStart(2,'0')}</b><span>${D.flag(p.countryCode)} ${esc(p.name)}<small>${esc(placeSecondary(p))}</small></span></li>`).join('');
    requestAnimationFrame(()=>{els.routeList.scrollTop=els.routeList.scrollHeight});
  }

  function updateGameUI(){
    if(!game.settings)return; const p=game.players[game.currentIndex]||game.players[0];
    els.scopeBadge.textContent=`🌍 ${scopeLabel(game.settings)}`;els.modeBadge.textContent=`${modeIcon(game.settings.mode)} ${modeLabel(game.settings.mode)}`;
    els.currentPlayerName.textContent=p?.name||'Spelare';els.turnDot.style.background=p?.color||PLAYER_COLORS[0];els.turnDot.style.boxShadow=`0 0 15px ${p?.color||PLAYER_COLORS[0]}`;
    els.turnSubtext.textContent=game.finished?'Spelet är avslutat':game.paused?'Pausat':(game.settings.mode==='solo'?'Bygg vidare på rutten':`Runda ${game.round} · välj nästa ort`);
    els.inputScopeText.textContent=`Sökningen gäller ${scopeLabel(game.settings).toLowerCase()} · ${placeTypeLabel(game.settings.placeType).toLowerCase()}.`;
    els.placeInput.disabled=game.finished||game.paused||game.pendingNextRound;els.playButton.disabled=els.placeInput.disabled;
    els.followButton.classList.toggle('active',game.followEnabled);els.followButton.title=game.followEnabled?'Smart kartföljning på':'Smart kartföljning av';
    updateScoreboard();updateRouteList();updateTimerUI();
  }

  function updateRecentChoices(){
    const recent=game.route.slice(-3).reverse();els.recentChoices.innerHTML=recent.map((p,i)=>`<button type="button" class="recent-choice" data-index="${game.route.length-1-i}">${D.flag(p.countryCode)} ${esc(p.name)}</button>`).join('');
  }

  function resetTurnTimer(){
    if(!game.settings?.timer||game.settings.mode==='solo'){game.timerRemaining=0;updateTimerUI();return} game.timerRemaining=game.settings.timer;updateTimerUI();
  }
  function updateTimerUI(){
    const enabled=!!game.settings?.timer&&game.settings.mode!=='solo';els.timerWrap.classList.toggle('hidden',!enabled);if(!enabled)return;
    const max=game.settings.timer;els.timerText.textContent=String(game.timerRemaining);els.timerBar.style.transform=`scaleX(${clamp(game.timerRemaining/max,0,1)})`;
  }
  function tickTimer(){
    if(!game.active||game.finished||game.paused||placeChooserOpen||game.pendingNextRound||!game.settings?.timer||game.settings.mode==='solo')return;
    game.timerRemaining=Math.max(0,game.timerRemaining-1);updateTimerUI();if(game.timerRemaining===0){const skipped=game.players[game.currentIndex]?.name;game.currentIndex=nextActiveIndex(game.currentIndex);resetTurnTimer();updateGameUI();toast(`Tiden tog slut för ${skipped}. Turen går vidare.`,'error')}
  }

  function pauseGame(){if(game.finished)return;game.paused=true;els.pauseModal.classList.remove('hidden');updateGameUI()}
  function resumeGame(){game.paused=false;els.pauseModal.classList.add('hidden');updateGameUI();setTimeout(()=>els.placeInput.focus(),80)}
  function exitToSetup(){game.active=false;game.paused=false;game.finished=false;closeAllGameModals();showScreen('setup');updateSetupUI(false)}
  function restartSame(){if(!game.settings)return;Object.assign(settings,JSON.parse(JSON.stringify(game.settings)));updateSetupUI(true);startGame()}

  function bindGameEvents(){
    els.placeForm.addEventListener('submit',onPlaceSubmit);els.placeModalClose.addEventListener('click',closePlaceChooser);els.placeModal.querySelector('.modal-backdrop')?.addEventListener('click',closePlaceChooser);
    els.routeList.addEventListener('click',e=>{const li=e.target.closest('[data-index]');if(li)focusPlace(Number(li.dataset.index))});
    els.recentChoices.addEventListener('click',e=>{const b=e.target.closest('[data-index]');if(b)focusPlace(Number(b.dataset.index))});
    els.zoomInButton.addEventListener('click',()=>map?.zoomIn(.75));els.zoomOutButton.addEventListener('click',()=>map?.zoomOut(.75));els.latestButton.addEventListener('click',focusLatest);els.fitButton.addEventListener('click',()=>fitRoute(true));
    els.followButton.addEventListener('click',()=>{game.followEnabled=!game.followEnabled;userNavigatingUntil=0;updateGameUI();toast(game.followEnabled?'Smart kartföljning på.':'Smart kartföljning av.')});
    els.fullscreenButton.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{toast('Helskärmsläge stöds inte i den här webbläsaren.','error')}});
    els.pauseButton.addEventListener('click',pauseGame);els.resumeButton.addEventListener('click',resumeGame);els.exitGameButton.addEventListener('click',exitToSetup);els.restartButton.addEventListener('click',restartSame);
    els.continueButton.addEventListener('click',continueElimination);els.playAgainButton.addEventListener('click',restartSame);els.changeSettingsButton.addEventListener('click',exitToSetup);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!els.placeModal.classList.contains('hidden'))closePlaceChooser();else if(!els.howToModal.classList.contains('hidden'))els.howToModal.classList.add('hidden');else if(game.active&&!game.finished&&!game.paused)pauseGame();}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.active&&!game.finished&&!game.paused)pauseGame()});
    gameTimer=setInterval(tickTimer,1000);
  }

  function addMobileRouteDrawer(){
    const stage=document.querySelector('.map-stage'); if(!stage||$('routeDrawerButton'))return;
    const b=document.createElement('button');b.id='routeDrawerButton';b.type='button';b.className='route-drawer-button';b.textContent='☰ Rutt';stage.appendChild(b);
    b.addEventListener('click',()=>document.querySelector('.left-panel')?.classList.toggle('open'));
    map?.on('click',()=>document.querySelector('.left-panel')?.classList.remove('open'));
  }

  function init(){
    initEls();setupCountryControls();renderPresets();bindSetupEvents();bindGameEvents();updateSound();updateSetupUI(true);addMobileRouteDrawer();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
