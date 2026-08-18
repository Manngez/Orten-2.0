'use strict';

(() => {
  const STYLE_ID='orten-simple-flow-style';
  let refreshQueued=false;

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* Hem: två tydliga vägar in, inget kontrollbord. */
      #setupScreen #soundButton{display:none!important}
      .orten-entry-gate{min-height:100dvh!important}
      .orten-entry-gate .hero,.orten-entry-gate .setup-grid,.orten-entry-gate .footer,.orten-entry-gate #setupWizardNav,.orten-entry-gate .simple-step-guide,.orten-entry-gate .simple-progress{display:none!important}
      .orten-entry-gate .topbar{width:min(720px,calc(100% - 28px))!important;min-height:58px!important;margin:0 auto!important;padding:14px 0!important}
      .orten-entry-gate .brand-logo{max-height:42px!important}
      .orten-entry-gate .topbar-actions{display:flex!important;gap:8px!important}
      #setupScreen #highscoreButton,#setupScreen #howToButton{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:36px!important;padding:0 12px!important;border-radius:11px!important;font-size:11px!important;font-weight:850!important;opacity:.9!important}
      #setupScreen #highscoreButton:hover,#setupScreen #highscoreButton:focus-visible,#setupScreen #howToButton:hover,#setupScreen #howToButton:focus-visible{opacity:1!important}
      .orten-entry-gate .play-entry-gate{width:min(620px,calc(100% - 28px))!important;margin:clamp(28px,7vh,72px) auto 40px!important;gap:20px!important}
      .orten-entry-gate .play-entry-head{max-width:560px!important}
      .orten-entry-gate .play-entry-head .eyebrow{font-size:10px!important;letter-spacing:.15em!important}
      .orten-entry-gate .play-entry-head h1{font-size:clamp(38px,7vw,58px)!important;line-height:1!important}
      .orten-entry-gate .play-entry-head p{margin-top:12px!important;font-size:14px!important}
      .orten-entry-gate .play-entry-grid{grid-template-columns:1fr!important;gap:12px!important}
      .orten-entry-gate .play-entry-card{min-height:104px!important;padding:18px 58px 18px 18px!important;border-radius:18px!important;display:grid!important;grid-template-columns:48px 1fr!important;grid-template-rows:auto auto!important;column-gap:15px!important;align-items:center!important;box-shadow:0 12px 34px rgba(0,0,0,.18)!important}
      .orten-entry-gate .play-entry-icon{grid-row:1/3!important;width:48px!important;height:48px!important;border-radius:14px!important;font-size:24px!important;margin:0!important}
      .orten-entry-gate .play-entry-card strong{font-size:21px!important;margin:0!important}
      .orten-entry-gate .play-entry-card small{font-size:12px!important;line-height:1.35!important}
      .orten-entry-gate .play-entry-arrow{right:16px!important;top:50%!important;transform:translateY(-50%)!important;width:32px!important;height:32px!important;font-size:16px!important}

      /* Inställningar: en riktig trestegsguide. */
      #setupScreen:not(.orten-entry-gate){min-height:100dvh!important;padding-bottom:28px!important}
      #setupScreen:not(.orten-entry-gate) > .hero,#setupScreen:not(.orten-entry-gate) > .footer,#setupScreen:not(.orten-entry-gate) #onlineButton{display:none!important}
      #setupScreen:not(.orten-entry-gate) .topbar{width:min(720px,calc(100% - 28px))!important;min-height:54px!important;margin:0 auto!important;padding:9px 0!important;border-bottom:1px solid rgba(151,180,194,.12)!important}
      #setupScreen:not(.orten-entry-gate) .brand-logo{max-height:34px!important}
      #setupScreen:not(.orten-entry-gate) .topbar-actions{display:flex!important;gap:7px!important}
      #setupScreen:not(.orten-entry-gate) .setup-grid{width:min(680px,calc(100% - 28px))!important;grid-template-columns:1fr!important;justify-content:center!important;gap:12px!important;margin:0 auto!important}
      #setupScreen:not(.orten-entry-gate) .setup-main{min-width:0!important}
      #setupScreen:not(.orten-entry-gate) .setup-main > .panel{padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important}
      #setupScreen:not(.orten-entry-gate) .setup-main > .panel > .panel-heading{display:none!important}
      #scopeCount,#setupScreen .panel-hint{display:none!important}

      #setupWizardNav{width:min(680px,calc(100% - 28px))!important;margin:14px auto 0!important;min-height:38px!important}
      #setupWizardNav .wizard-progress{display:none!important}
      #setupWizardNav #setupStepText{margin-left:auto!important;font-size:10px!important;font-weight:900!important;color:#8da6b3!important;text-transform:uppercase!important;letter-spacing:.11em!important}
      #setupWizardNav .wizard-back{min-height:36px!important;border-radius:10px!important}
      #setupScreen[data-setup-step="1"] #setupBackButton{visibility:hidden!important;pointer-events:none!important}
      #setupScreen:not(.online-host-mode)[data-setup-step="1"] #setupEntryBack{display:flex!important}
      #setupScreen.online-host-mode #setupEntryBack,#setupScreen:not([data-setup-step="1"]) #setupEntryBack{display:none!important}
      #setupScreen.online-host-mode[data-setup-step="1"] #onlineHostContext{display:flex!important}
      #setupScreen:not(.online-host-mode) #onlineHostContext,#setupScreen:not([data-setup-step="1"]) #onlineHostContext{display:none!important}
      #setupEntryBack,#onlineHostContext{width:min(680px,calc(100% - 28px))!important}

      .simple-progress{width:min(680px,calc(100% - 28px));margin:10px auto 8px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
      .simple-progress span{position:relative;min-height:34px;border-radius:10px;border:1px solid rgba(151,180,194,.14);background:rgba(255,255,255,.018);display:flex;align-items:center;justify-content:center;gap:6px;color:#738c99;font-size:10px;font-weight:850}
      .simple-progress span b{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.04);font-size:9px}
      .simple-progress span.active{color:#eaffff;border-color:rgba(104,246,255,.38);background:rgba(104,246,255,.075)}
      .simple-progress span.active b{background:rgba(104,246,255,.18);color:#fff}
      .simple-progress span.done{color:#9bd9df;border-color:rgba(104,246,255,.18)}
      .online-host-mode .simple-progress span.active{border-color:rgba(115,245,167,.4);background:rgba(115,245,167,.07)}

      .simple-step-guide{width:min(680px,calc(100% - 28px));margin:0 auto 14px;padding:18px;border:1px solid rgba(104,246,255,.22);border-radius:17px;background:linear-gradient(145deg,rgba(104,246,255,.065),rgba(8,23,36,.76));display:flex;gap:13px;align-items:flex-start}
      .simple-step-guide b{width:34px;height:34px;flex:0 0 34px;border-radius:11px;display:grid;place-items:center;background:rgba(104,246,255,.14);border:1px solid rgba(104,246,255,.24);color:#e6fdff;font-size:12px}
      .simple-step-guide strong{display:block;color:#f3fcff;font-size:20px;letter-spacing:-.02em;margin-bottom:4px}
      .simple-step-guide small{display:block;color:#9db3bd;font-size:12px;line-height:1.45}
      .online-host-mode .simple-step-guide{border-color:rgba(115,245,167,.25);background:linear-gradient(145deg,rgba(115,245,167,.06),rgba(8,23,36,.76))}

      /* Spelläge: tre stora rader, inte en instrumentpanel. */
      #modeGrid.mode-grid,#setupScreen.online-host-mode #modeGrid.mode-grid{grid-template-columns:1fr!important;gap:9px!important}
      #modeGrid .mode-card{position:relative;min-height:86px!important;padding:14px 46px 14px 14px!important;border-radius:15px!important;display:grid!important;grid-template-columns:44px 1fr!important;grid-template-rows:auto auto!important;column-gap:13px!important;align-items:center!important;text-align:left!important}
      #modeGrid .mode-card::after{content:"›";position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:25px;color:#71909d}
      #modeGrid .mode-icon{grid-row:1/3!important;width:44px!important;height:44px!important;margin:0!important;display:grid!important;place-items:center!important;border-radius:13px!important;background:rgba(104,246,255,.07)}
      #modeGrid .mode-card strong{font-size:16px!important;margin:0!important}
      #modeGrid .mode-card small{font-size:11px!important;line-height:1.35!important}
      #setupScreen.online-host-mode #modeGrid [data-mode="solo"]{display:none!important}

      /* Område: fyra tydliga destinationer. */
      #scopeTabs.segmented{grid-template-columns:1fr 1fr!important;gap:9px!important;background:transparent!important;padding:0!important}
      #scopeTabs.segmented button{min-height:76px!important;padding:12px!important;border:1px solid rgba(151,180,194,.18)!important;border-radius:15px!important;background:rgba(9,25,39,.72)!important;font-size:14px!important;font-weight:850!important}
      #scopeTabs.segmented button.active{border-color:rgba(104,246,255,.5)!important;background:rgba(104,246,255,.09)!important;box-shadow:0 0 0 1px rgba(104,246,255,.08) inset!important}

      /* Sista steget: namn först. Resten är valfritt förutom Tålighet-regeln. */
      #setupScreen .rules-grid{grid-template-columns:1fr!important;gap:9px!important}
      #setupScreen .field-card{padding:15px!important;border-radius:15px!important;background:rgba(8,23,36,.76)!important;border:1px solid rgba(151,180,194,.15)!important}
      #playersCard{order:1}
      #strikeCard{order:2}
      .setup-advanced-option{display:none!important}
      .setup-main .panel.show-simple-advanced .setup-advanced-option{display:block!important}
      #setupScreen[data-simple-mode="solo"] #playerCountSelect,#setupScreen[data-simple-mode="solo"] #strikeCard{display:none!important}
      .simple-advanced-toggle{order:20;width:100%;margin:2px 0 0;min-height:46px;border:1px dashed rgba(151,180,194,.28);border-radius:13px;background:rgba(255,255,255,.012);color:#9eb6c1;font:850 12px/1 system-ui;cursor:pointer}
      .simple-advanced-toggle:hover{border-color:rgba(104,246,255,.45);color:#e4f8ff}

      #setupScreen .setup-summary{width:min(680px,calc(100% - 28px))!important;max-width:none!important;margin:0 auto!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
      #setupScreen .setup-summary .step-kicker,#setupScreen .setup-summary .summary-visual,#setupScreen .setup-summary #summaryRows,#setupScreen .setup-summary h2{display:none!important}
      #setupScreen .setup-summary .start-button{width:100%!important;min-height:62px!important;margin:2px 0 0!important;border-radius:16px!important;font-size:16px!important;font-weight:900!important;box-shadow:0 14px 35px rgba(34,178,195,.18)!important}

      /* Online-menyn: bara skapa eller anslut. */
      #onlineModalBody .online-tabs{gap:8px!important}
      #onlineModalBody .online-tabs button{min-height:48px!important;font-weight:850!important}
      #onlineModalBody .online-form{gap:11px!important}
      #onlineModalBody .online-form .online-settings-preview{display:none!important}
      #onlineModalBody .online-network-note{font-size:11px!important;opacity:.68}
      #onlineModalBody #onlineRefreshSettings{display:none!important}

      /* Själva spelet: kartan är huvudytan. Kontrollerna flyter ovanpå. */
      #gameScreen .game-topbar{height:56px!important;min-height:56px!important;padding:0 10px!important}
      #gameScreen .game-logo{max-height:28px!important}
      #gameScreen .game-layout{position:relative!important;display:block!important;height:calc(100dvh - 56px)!important;min-height:0!important;overflow:hidden!important}
      #gameScreen .map-stage{position:absolute!important;inset:0!important;min-width:0!important;border:0!important;border-radius:0!important}
      #gameScreen .game-sidebar{position:absolute!important;z-index:620!important;border:0!important;background:transparent!important;padding:0!important;overflow:visible!important}
      #gameScreen .left-panel{left:12px!important;top:12px!important;width:270px!important;max-height:calc(100% - 24px)!important}
      #gameScreen .input-panel{right:12px!important;top:12px!important;width:340px!important;max-width:calc(100% - 24px)!important}
      #gameScreen .turn-card,#gameScreen .input-card,#gameScreen .route-panel,#gameScreen .scoreboard{backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:rgba(6,19,30,.86)!important;border:1px solid rgba(151,180,194,.18)!important;box-shadow:0 14px 36px rgba(0,0,0,.24)!important;border-radius:15px!important}
      #gameScreen .turn-card{padding:13px!important}
      #gameScreen .scoreboard{margin-top:8px!important;padding:8px!important}
      #gameScreen .input-card{padding:15px!important}
      #gameScreen .input-card .step-kicker{display:none!important}
      #gameScreen .input-card h2{font-size:18px!important;margin-bottom:4px!important}
      #gameScreen .input-card p{font-size:11px!important;margin-bottom:10px!important}
      #gameScreen .rule-reminder,#gameScreen #restartButton,#gameScreen #mapInteractionHint{display:none!important}
      #gameScreen .route-panel{display:none!important;margin-top:8px!important;max-height:44vh!important;overflow:auto!important}
      #gameScreen.route-open .route-panel{display:block!important}
      .simple-route-toggle{width:100%;min-height:38px;margin-top:8px;border:1px solid rgba(151,180,194,.18);border-radius:12px;background:rgba(6,19,30,.84);color:#cfe3ea;font:850 11px/1 system-ui;cursor:pointer;backdrop-filter:blur(12px)}
      #gameScreen .map-controls{left:12px!important;right:auto!important;top:auto!important;bottom:12px!important}
      #gameScreen .cross-banner{top:14px!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;max-width:min(420px,calc(100% - 28px))!important}

      @media(max-width:760px){
        .orten-entry-gate .topbar,#setupScreen:not(.orten-entry-gate) .topbar{width:calc(100% - 22px)!important}
        #setupScreen #highscoreButton,#setupScreen #howToButton{min-height:34px!important;padding:0 9px!important;font-size:10px!important}
        .orten-entry-gate .play-entry-gate{width:calc(100% - 22px)!important;margin-top:22px!important}
        .orten-entry-gate .play-entry-head h1{font-size:40px!important}
        #setupWizardNav,.simple-progress,.simple-step-guide,#setupScreen:not(.orten-entry-gate) .setup-grid,#setupScreen .setup-summary,#setupEntryBack,#onlineHostContext{width:calc(100% - 22px)!important}
        .simple-step-guide{padding:15px!important}
        .simple-step-guide strong{font-size:18px!important}
        .simple-progress span{font-size:9px!important}
        #scopeTabs.segmented button{min-height:68px!important;font-size:13px!important}

        #gameScreen .game-topbar{height:50px!important;min-height:50px!important}
        #gameScreen .game-layout{height:calc(100dvh - 50px)!important}
        #gameScreen .left-panel{left:8px!important;top:8px!important;width:min(250px,calc(100% - 70px))!important}
        #gameScreen .left-panel .scoreboard{display:none!important}
        #gameScreen .turn-card{padding:10px 11px!important}
        #gameScreen .turn-card .step-kicker{font-size:8px!important}
        #gameScreen .turn-player strong{font-size:13px!important}
        #gameScreen .input-panel{left:8px!important;right:8px!important;top:auto!important;bottom:8px!important;width:auto!important;max-width:none!important}
        #gameScreen .input-card{padding:11px!important;border-radius:14px!important}
        #gameScreen .input-card h2,#gameScreen .input-card p{display:none!important}
        #gameScreen .game-search{min-height:48px!important}
        #gameScreen .search-state{font-size:10px!important;min-height:0!important;margin-top:6px!important}
        #gameScreen .recent-choices{max-height:126px!important;overflow:auto!important}
        #gameScreen .route-panel{position:absolute!important;left:0!important;top:calc(100% + 6px)!important;width:min(300px,calc(100vw - 16px))!important;max-height:42vh!important}
        .simple-route-toggle{min-height:34px!important;margin-top:6px!important}
        #gameScreen .map-controls{left:auto!important;right:8px!important;bottom:auto!important;top:8px!important}
        #gameScreen .map-controls button{width:36px!important;height:36px!important}
        #gameScreen .cross-banner{top:8px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function setupPanel(step){
    return [...document.querySelectorAll('#setupScreen .setup-main > section.panel')][step-1]||null;
  }

  function ensureGuide(){
    const nav=document.getElementById('setupWizardNav');
    if(!nav)return;
    if(!document.getElementById('simpleProgress')){
      const progress=document.createElement('div');
      progress.id='simpleProgress';
      progress.className='simple-progress';
      progress.innerHTML='<span data-simple-step="1"><b>1</b>Spelläge</span><span data-simple-step="2"><b>2</b>Område</span><span data-simple-step="3"><b>3</b>Start</span>';
      nav.insertAdjacentElement('afterend',progress);
    }
    if(!document.getElementById('simpleStepGuide')){
      const guide=document.createElement('div');
      guide.id='simpleStepGuide';
      guide.className='simple-step-guide';
      document.getElementById('simpleProgress').insertAdjacentElement('afterend',guide);
    }
  }

  function ensureAdvancedToggle(){
    const panel=setupPanel(3);if(!panel)return;
    const duplicate=document.getElementById('duplicateSelect')?.closest('.field-card');
    const theme=document.getElementById('themeGrid')?.closest('.field-card');
    const timer=document.getElementById('timerSelect')?.closest('.field-card');
    duplicate?.classList.add('setup-advanced-option');
    theme?.classList.add('setup-advanced-option');
    timer?.classList.add('setup-advanced-option');
    if(document.getElementById('simpleAdvancedToggle'))return;
    const button=document.createElement('button');
    button.id='simpleAdvancedToggle';button.type='button';button.className='simple-advanced-toggle';
    button.textContent='＋ Fler inställningar';
    const rules=panel.querySelector('.rules-grid');
    if(rules)rules.insertAdjacentElement('afterend',button);else panel.appendChild(button);
    button.addEventListener('click',()=>{
      const open=panel.classList.toggle('show-simple-advanced');
      button.textContent=open?'− Dölj fler inställningar':'＋ Fler inställningar';
    });
  }

  function ensureRouteToggle(){
    const left=document.querySelector('#gameScreen .left-panel');
    const route=document.querySelector('#gameScreen .route-panel');
    if(!left||!route||document.getElementById('simpleRouteToggle'))return;
    const button=document.createElement('button');
    button.id='simpleRouteToggle';
    button.type='button';
    button.className='simple-route-toggle';
    button.textContent='Valda orter · 0';
    route.insertAdjacentElement('beforebegin',button);
    button.addEventListener('click',()=>{
      const screen=document.getElementById('gameScreen');
      const open=screen?.classList.toggle('route-open');
      button.setAttribute('aria-expanded',open?'true':'false');
    });
  }

  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}

  function simplifyModeCopy(){
    const copy={
      classic:['Klassisk','Första korsningen avslutar matchen.'],
      endurance:['Tålighet','Ni får flera korsningar innan matchen är slut.'],
      solo:['Solo','Spela själv och försök slå ditt rekord.']
    };
    document.querySelectorAll('#modeGrid [data-mode]').forEach(card=>{
      const values=copy[card.dataset.mode];if(!values)return;
      setText(card.querySelector('strong'),values[0]);
      setText(card.querySelector('small'),values[1]);
    });
  }

  function updateInstruction(){
    const screen=document.getElementById('setupScreen');
    const guide=document.getElementById('simpleStepGuide');
    if(!screen||!guide)return;
    const step=Number(screen.dataset.setupStep)||1;
    const host=screen.classList.contains('online-host-mode');
    const mode=(typeof settings!=='undefined'&&settings?.mode)||'classic';
    screen.dataset.simpleMode=mode;

    const copy=host
      ? {
          1:['Hur ska matchen avgöras?','Välj Klassisk eller Tålighet.'],
          2:['Var ska ni spela?','Välj ett område. Det räcker med ett tryck.'],
          3:['Skapa onlinerummet','Standardinställningarna är klara. Öppna Fler inställningar bara om du vill ändra något.']
        }
      : {
          1:['Hur vill du spela?','Välj ett spelläge. Du går vidare direkt.'],
          2:['Var ska ni spela?','Välj Sverige, Norden, Europa eller Världen.'],
          3:[mode==='solo'?'Skriv ditt namn och starta':'Skriv namnen och starta',mode==='solo'?'Det här är allt som krävs.':'Välj antal spelare och skriv deras namn. Resten kan lämnas på standard.']
        };
    const [title,text]=copy[step]||copy[1];
    const key=`${host?'host':'local'}:${step}:${mode}:${title}:${text}`;
    if(guide.dataset.copyKey!==key){
      guide.dataset.copyKey=key;
      guide.innerHTML=`<b>${step}</b><div><strong>${title}</strong><small>${text}</small></div>`;
    }

    setText(document.getElementById('setupStepText'),`Steg ${step} av 3`);
    setText(document.querySelector('#setupEntryBack button'),'← Start');
    setText(document.getElementById('onlineHostBack'),'← Online');
    document.querySelectorAll('#simpleProgress [data-simple-step]').forEach(item=>{
      const n=Number(item.dataset.simpleStep);
      item.classList.toggle('active',n===step);
      item.classList.toggle('done',n<step);
    });

    const playerHeading=document.querySelector('#playersCard .field-card-head > span');
    if(playerHeading)setText(playerHeading,mode==='solo'?'Ditt namn':'Spelare');
  }

  function updateGameChrome(){
    const routeCount=document.getElementById('routeCount')?.textContent?.trim()||'0';
    const button=document.getElementById('simpleRouteToggle');
    if(button)setText(button,`Valda orter · ${routeCount}`);
    const inputTitle=document.querySelector('#gameScreen .input-card h2');
    if(inputTitle)setText(inputTitle,'Nästa ort');
  }

  function simplifyOnlineModal(){
    const body=document.getElementById('onlineModalBody');if(!body)return;
    const title=body.querySelector('h2');
    const intro=body.querySelector('.online-intro');
    if(title&&title.textContent.includes('Spela Orten tillsammans'))setText(title,'Online');
    if(intro)setText(intro,'Skapa ett rum eller anslut med en rumskod.');
    setText(body.querySelector('[data-online-tab="create"]'),'Skapa rum');
    setText(body.querySelector('[data-online-tab="join"]'),'Anslut med kod');
    const create=body.querySelector('#onlineCreateButton');
    const join=body.querySelector('#onlineJoinButton');
    if(create)setText(create,'Välj spelinställningar →');
    if(join)setText(join,'Anslut →');
    const note=body.querySelector('.online-network-note');
    if(note&&body.querySelector('#onlineCreateButton,#onlineJoinButton'))setText(note,'Värden väljer reglerna. Övriga behöver bara namn och rumskod.');
  }

  function refresh(){
    refreshQueued=false;
    ensureGuide();
    ensureAdvancedToggle();
    ensureRouteToggle();
    simplifyModeCopy();
    updateInstruction();
    updateGameChrome();
    simplifyOnlineModal();
  }

  function scheduleRefresh(){
    if(refreshQueued)return;
    refreshQueued=true;
    requestAnimationFrame(refresh);
  }

  function init(){
    installStyles();
    refresh();
    const setup=document.getElementById('setupScreen');
    if(setup)new MutationObserver(scheduleRefresh).observe(setup,{attributes:true,attributeFilter:['class','data-setup-step'],childList:true,subtree:true});
    const gameScreen=document.getElementById('gameScreen');
    if(gameScreen)new MutationObserver(scheduleRefresh).observe(gameScreen,{attributes:true,attributeFilter:['class'],childList:true,subtree:true,characterData:true});
    const modal=document.getElementById('onlineModal');
    if(modal)new MutationObserver(scheduleRefresh).observe(modal,{childList:true,subtree:true});
    document.addEventListener('click',()=>setTimeout(scheduleRefresh,0),true);
    document.addEventListener('change',()=>setTimeout(scheduleRefresh,0),true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
