  let setupStep = 1;

  function updateSummary(){
    const timer=settings.timer?`${settings.timer} sek`:'Ingen';
    const playerText=settings.mode==='solo'?'1 spelare':`${settings.playerCount} spelare`;
    const extra=settings.mode==='endurance'?`${settings.strikeLimit} korsningar`:settings.mode==='duel'?`${settings.strikeLimit} egen${settings.strikeLimit===1?'':'a'} korsning${settings.strikeLimit===1?'':'ar'} innan förlust`:settings.mode==='elimination'?'Sista kvar vinner':'1 korsning';
    els.summaryRows.innerHTML=[
      ['Spelläge',`${modeIcon()} ${modeLabel()}`],['Område',scopeLabel()],['Spelare',playerText],['Regel',extra],['Turtid',timer],['Karta',themeLabel()]
    ].map(([a,b])=>`<div class="summary-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('');
  }

  function setupPanels(){
    return [...document.querySelectorAll('#setupScreen .setup-main > section.panel')].slice(0,3);
  }

  function ensureSetupWizard(){
    const grid=document.querySelector('#setupScreen .setup-grid');
    if(!grid || $('setupWizardNav')) return;
    const nav=document.createElement('div');
    nav.id='setupWizardNav';
    nav.className='setup-wizard-nav wrap';
    nav.innerHTML=`
      <button id="setupBackButton" class="wizard-back" type="button" aria-label="Gå tillbaka">← Tillbaka</button>
      <div class="wizard-progress" aria-label="Inställningssteg">
        <span data-wizard-dot="1"><b>1</b><small>Spelläge</small></span>
        <i></i>
        <span data-wizard-dot="2"><b>2</b><small>Område</small></span>
        <i></i>
        <span data-wizard-dot="3"><b>3</b><small>Regler</small></span>
      </div>
      <span id="setupStepText" class="wizard-step-text">Steg 1 av 3</span>`;
    grid.parentNode.insertBefore(nav,grid);
    $('setupBackButton').addEventListener('click',()=>showSetupStep(setupStep-1));
    renderSetupStep(false);
  }

  function renderSetupStep(animate=true){
    const screen=$('setupScreen');
    if(!screen)return;
    setupStep=clamp(setupStep,1,3);
    screen.dataset.setupStep=String(setupStep);
    const panels=setupPanels();
    panels.forEach((panel,index)=>panel.classList.toggle('wizard-current',index===setupStep-1));
    document.querySelector('#setupScreen .setup-summary')?.classList.toggle('wizard-visible',setupStep===3);
    document.querySelectorAll('[data-wizard-dot]').forEach(dot=>{
      const step=Number(dot.dataset.wizardDot);
      dot.classList.toggle('active',step===setupStep);
      dot.classList.toggle('done',step<setupStep);
    });
    const back=$('setupBackButton');
    if(back) back.classList.toggle('invisible',setupStep===1);
    const text=$('setupStepText');
    if(text) text.textContent=`Steg ${setupStep} av 3`;
    if(animate){
      const heading=panels[setupStep-1]?.querySelector('h2');
      requestAnimationFrame(()=>heading?.focus?.({preventScroll:true}));
      window.scrollTo({top:0,behavior:'smooth'});
    }
  }

  function showSetupStep(step){
    setupStep=clamp(step,1,3);
    renderSetupStep(true);
  }

  function selectSimpleArea(area){
    settings.preset=null;
    if(area==='sweden'){
      settings.scope='country'; settings.country='SE'; settings.continent='europe'; settings.countries=[];
    }else if(area==='nordic'){
      settings.scope='custom'; settings.countries=[...NORDIC_CODES]; settings.continent='europe';
    }else if(area==='europe'){
      settings.scope='continent'; settings.continent='europe'; settings.countries=[];
    }else{
      settings.scope='world'; settings.countries=[];
    }
    updateSetupUI(false);
  }

  function bindSetupEvents(){
    ensureDuelModeControls();ensureSetupWizard();
    els.modeGrid.addEventListener('click',e=>{
      const b=e.target.closest('[data-mode]');if(!b)return;
      const previous=settings.mode;settings.mode=b.dataset.mode;settings.preset=null;
      if(settings.mode==='duel'&&previous!=='duel')settings.strikeLimit=1;
      normalizePlayerCount();updateSetupUI(false);
      setTimeout(()=>showSetupStep(2),120);
    });
    els.scopeTabs.addEventListener('click',e=>{
      const b=e.target.closest('[data-area]');if(!b)return;
      selectSimpleArea(b.dataset.area);
      setTimeout(()=>showSetupStep(3),120);
    });
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
    els.startButton.addEventListener('click',()=>startGame());
    els.soundButton.addEventListener('click',()=>{const off=storageGet('orten2:sound')==='off';storageSet('orten2:sound',off?'on':'off');updateSound();if(off)tone('move')});
    els.howToButton.addEventListener('click',()=>els.howToModal.classList.remove('hidden'));
    els.howToClose.addEventListener('click',()=>els.howToModal.classList.add('hidden'));
    els.howToModal.querySelector('.modal-backdrop')?.addEventListener('click',()=>els.howToModal.classList.add('hidden'));
  }

  function initialViewForSettings(s){
    if(s.preset && D.PRESETS[s.preset]?.center) return {center:D.PRESETS[s.preset].center,zoom:D.PRESETS[s.preset].zoom};
    if(s.scope==='continent'){const m=D.CONTINENT_META[s.continent];return {center:m?.center||[20,0],zoom:m?.zoom||2.5};}
    if(s.scope==='country' && s.country==='SE') return {center:[62,15],zoom:4.2};
    if(isNordicScope(s)) return {center:[64,14],zoom:3.5};
    return {center:[20,0],zoom:2.3};
  }

  function deepSettings(){ return JSON.parse(JSON.stringify(settings)); }
  function startGame(){
    game.settings=deepSettings();
    if(game.settings.mode==='duel'){game.settings.playerCount=2;game.settings.strikeLimit=Math.max(1,Number(game.settings.strikeLimit)||1)}
    game.active=true; game.paused=false; game.finished=false; game.currentIndex=0; game.route=[]; game.lastCrossings=[]; game.totalCrossings=0; game.totalMoves=0; game.roundMoves=0; game.bestRound=0; game.round=1; game.pendingNextRound=false; game.followEnabled=!!game.settings.autoFollow;
    game.players=Array.from({length:game.settings.playerCount},(_,i)=>({name:(game.settings.playerNames[i]||`Spelare ${i+1}`).trim()||`Spelare ${i+1}`,strikes:0,active:true,color:PLAYER_COLORS[i]}));
    game.initialView=initialViewForSettings(game.settings);
    showScreen('game'); closeAllGameModals(); initMap(); resetMapToInitial(); tone('start'); updateGameUI(); resetTurnTimer(); warmPlaceIndex(); setTimeout(()=>els.placeInput.focus(),120);
  }
