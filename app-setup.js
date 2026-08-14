  function updateSummary(){
    const timer=settings.timer?`${settings.timer} sek`:'Ingen';
    const playerText=settings.mode==='solo'?'1 spelare':`${settings.playerCount} spelare`;
    const extra=settings.mode==='endurance'?`${settings.strikeLimit} korsningar`:settings.mode==='elimination'?'Sista kvar vinner':'1 korsning';
    els.summaryRows.innerHTML=[
      ['Spelsätt',`${modeIcon()} ${modeLabel()}`],['Område',scopeLabel()],['Orter',placeTypeLabel()],['Spelare',playerText],['Korsningsregel',extra],['Turtid',timer],['Karta',themeLabel()]
    ].map(([a,b])=>`<div class="summary-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('');
  }

  function bindSetupEvents(){
    els.modeGrid.addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b)return;settings.mode=b.dataset.mode;settings.preset=null;normalizePlayerCount();updateSetupUI(false)});
    els.scopeTabs.addEventListener('click',e=>{const b=e.target.closest('[data-scope]');if(!b)return;settings.scope=b.dataset.scope;settings.preset=null;updateSetupUI(false)});
    els.continentSelect.addEventListener('change',()=>{settings.continent=els.continentSelect.value;settings.preset=null;updateSetupUI(false)});
    els.countrySelect.addEventListener('change',()=>{settings.country=els.countrySelect.value;settings.preset=null;updateSetupUI(false)});
    els.countrySearch.addEventListener('input',()=>renderCountryChips(els.countrySearch.value));
    els.clearCountriesButton.addEventListener('click',()=>{settings.countries=[];settings.preset=null;renderCountryChips(els.countrySearch.value);updateSetupUI(false)});
    els.placeTypeOptions.addEventListener('change',e=>{if(e.target.name!=='placeType')return;settings.placeType=e.target.value;settings.preset=null;updateSetupUI(false)});
    els.themeGrid.addEventListener('click',e=>{const b=e.target.closest('[data-theme]');if(!b)return;settings.mapTheme=b.dataset.theme;settings.preset=null;updateSetupUI(false)});
    els.autoFollowToggle.addEventListener('change',()=>{settings.autoFollow=els.autoFollowToggle.checked;settings.preset=null;updateSummary()});
    els.labelsToggle.addEventListener('change',()=>{settings.labels=els.labelsToggle.checked;settings.preset=null;updateSummary()});
    els.playerCountSelect.addEventListener('change',()=>{settings.playerCount=Number(els.playerCountSelect.value);settings.preset=null;updateSetupUI(false)});
    els.strikeLimitSelect.addEventListener('change',()=>{settings.strikeLimit=Number(els.strikeLimitSelect.value);settings.preset=null;updateSummary()});
    els.timerSelect.addEventListener('change',()=>{settings.timer=Number(els.timerSelect.value);settings.preset=null;updateSummary()});
    els.duplicateSelect.addEventListener('change',()=>{settings.duplicatePolicy=els.duplicateSelect.value;settings.preset=null;updateSummary()});
    els.startButton.addEventListener('click',()=>{
      if(settings.scope==='custom' && !settings.countries.length) return toast('Välj minst ett land för området Egna länder.','error');
      startGame();
    });
    els.soundButton.addEventListener('click',()=>{const off=storageGet('orten2:sound')==='off';storageSet('orten2:sound',off?'on':'off');updateSound();if(off)tone('move')});
    els.howToButton.addEventListener('click',()=>els.howToModal.classList.remove('hidden'));
    els.howToClose.addEventListener('click',()=>els.howToModal.classList.add('hidden'));
    els.howToModal.querySelector('.modal-backdrop')?.addEventListener('click',()=>els.howToModal.classList.add('hidden'));
  }

  function initialViewForSettings(s){
    if(s.preset && D.PRESETS[s.preset]?.center) return {center:D.PRESETS[s.preset].center,zoom:D.PRESETS[s.preset].zoom};
    if(s.scope==='continent'){const m=D.CONTINENT_META[s.continent];return {center:m?.center||[20,0],zoom:m?.zoom||2.5};}
    if(s.scope==='country' && s.country==='SE') return {center:[62,15],zoom:4.2};
    if(s.scope==='custom' && ['SE','NO','FI','DK','IS'].every(c=>s.countries.includes(c)) && s.countries.length===5) return {center:[64,14],zoom:3.5};
    return {center:[20,0],zoom:2.3};
  }

  function deepSettings(){ return JSON.parse(JSON.stringify(settings)); }
  function startGame(){
    game.settings=deepSettings(); game.active=true; game.paused=false; game.finished=false; game.currentIndex=0; game.route=[]; game.lastCrossings=[]; game.totalCrossings=0; game.totalMoves=0; game.roundMoves=0; game.bestRound=0; game.round=1; game.pendingNextRound=false; game.followEnabled=!!game.settings.autoFollow;
    game.players=Array.from({length:game.settings.playerCount},(_,i)=>({name:(game.settings.playerNames[i]||`Spelare ${i+1}`).trim()||`Spelare ${i+1}`,strikes:0,active:true,color:PLAYER_COLORS[i]}));
    game.initialView=initialViewForSettings(game.settings);
    showScreen('game'); closeAllGameModals(); initMap(); resetMapToInitial(); tone('start'); updateGameUI(); resetTurnTimer(); warmPlaceIndex(); setTimeout(()=>els.placeInput.focus(),120);
  }
