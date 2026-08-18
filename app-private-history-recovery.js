'use strict';

(() => {
  const STYLE_ID='orten-simple-flow-style';
  let refreshQueued=false;

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* START: huvudvalen plus diskreta hjälpgenvägar. */
      .orten-entry-gate #soundButton,
      .orten-entry-gate .simple-step-guide{display:none!important}

      /* Highscore och Så spelar du ska alltid gå att nå utan att bli huvudval. */
      #setupScreen #highscoreButton,
      #setupScreen #howToButton{min-height:36px!important;padding:0 11px!important;border-radius:11px!important;font-size:11px!important;font-weight:850!important;opacity:.82!important}
      #setupScreen #highscoreButton:hover,#setupScreen #highscoreButton:focus-visible,
      #setupScreen #howToButton:hover,#setupScreen #howToButton:focus-visible{opacity:1!important}

      /* INSTÄLLNINGAR: ta bort allt som inte hjälper nästa beslut. */
      #setupScreen:not(.orten-entry-gate) > .hero,
      #setupScreen:not(.orten-entry-gate) > .footer,
      #setupScreen:not(.orten-entry-gate) #onlineButton,
      #setupScreen:not(.orten-entry-gate) #soundButton{display:none!important}
      #setupScreen:not(.orten-entry-gate) .setup-grid{grid-template-columns:minmax(0,760px)!important;justify-content:center;gap:8px!important}
      #setupScreen:not(.orten-entry-gate) .setup-main{min-width:0}
      #setupScreen:not(.orten-entry-gate) .setup-main > .panel{border-radius:18px!important;padding:18px!important}

      /* Bara EN navigationsrad: tillbaka + Steg X av 3. */
      #setupWizardNav{max-width:760px!important;margin:8px auto 2px!important;min-height:42px!important}
      #setupWizardNav .wizard-progress{display:none!important}
      #setupWizardNav #setupStepText{margin-left:auto!important;font-size:11px!important;font-weight:850!important;color:#8ea7b4!important;text-transform:uppercase!important;letter-spacing:.08em!important}
      #setupWizardNav .wizard-back{min-height:38px!important}
      #setupScreen[data-setup-step="1"] #setupBackButton{visibility:hidden!important;pointer-events:none!important}

      /* En enda tydlig instruktion för aktuellt steg. */
      .simple-step-guide{width:min(760px,calc(100% - 24px));margin:4px auto 10px;padding:15px 16px;border:1px solid rgba(104,246,255,.22);border-radius:15px;background:rgba(104,246,255,.045);display:flex;gap:12px;align-items:flex-start}
      .simple-step-guide b{width:30px;height:30px;flex:0 0 30px;border-radius:50%;display:grid;place-items:center;background:rgba(104,246,255,.12);border:1px solid rgba(104,246,255,.24);color:#d9fbff;font-size:12px}
      .simple-step-guide strong{display:block;color:#eefcff;font-size:17px;margin-bottom:4px}
      .simple-step-guide small{display:block;color:#9bb1bc;font-size:12px;line-height:1.45}
      .online-host-mode .simple-step-guide{border-color:rgba(115,245,167,.24);background:rgba(115,245,167,.045)}
      .online-host-mode .simple-step-guide b{background:rgba(115,245,167,.11);border-color:rgba(115,245,167,.25);color:#c9f9d9}

      /* Panelrubrikerna upprepade bara samma sak som instruktionen. */
      #setupScreen:not(.orten-entry-gate) .setup-main > .panel > .panel-heading{display:none!important}
      #scopeCount{display:none!important}

      /* En tydlig väg tillbaka från första inställningssteget. */
      #setupScreen:not(.online-host-mode)[data-setup-step="1"] #setupEntryBack{display:flex!important}
      #setupScreen.online-host-mode #setupEntryBack,
      #setupScreen:not([data-setup-step="1"]) #setupEntryBack{display:none!important}
      #setupScreen.online-host-mode[data-setup-step="1"] #onlineHostContext{display:flex!important}
      #setupScreen:not(.online-host-mode) #onlineHostContext,
      #setupScreen:not([data-setup-step="1"]) #onlineHostContext{display:none!important}

      /* Online: Solo är inte ett möjligt beslut och ska därför inte synas. */
      #setupScreen.online-host-mode #modeGrid [data-mode="solo"]{display:none!important}
      #setupScreen.online-host-mode #modeGrid.mode-grid{grid-template-columns:1fr 1fr!important}

      /* Spelläge: korta, tydliga kort. */
      #modeGrid.mode-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}
      #modeGrid .mode-card{min-height:138px!important;padding:16px!important}
      #modeGrid .mode-card strong{font-size:17px!important}
      #modeGrid .mode-card small{font-size:11px!important;line-height:1.35!important}

      /* Område: fyra enkla knappar utan extra sammanfattning. */
      #scopeTabs.segmented{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      #scopeTabs.segmented button{min-height:58px;padding:9px 7px!important;font-weight:850!important}

      /* Sista steget: bara namn + relevant regel + start. */
      #setupScreen .rules-grid{gap:10px!important}
      #setupScreen .field-card{padding:14px!important}
      #setupScreen .panel-hint{display:none!important}
      #setupScreen[data-simple-mode="solo"] #playerCountSelect{display:none!important}
      #setupScreen[data-simple-mode="solo"] #playersCard .field-card-head{grid-template-columns:1fr!important}

      /* Avancerade val är frivilliga och dolda tills spelaren efterfrågar dem. */
      .setup-advanced-option{display:none!important}
      .setup-main .panel.show-simple-advanced .setup-advanced-option{display:block!important}
      .simple-advanced-toggle{width:100%;margin:10px 0 0;min-height:42px;border:1px dashed rgba(151,180,194,.30);border-radius:12px;background:rgba(255,255,255,.012);color:#a9c0cb;font:800 12px/1 system-ui;cursor:pointer}
      .simple-advanced-toggle:hover{border-color:rgba(104,246,255,.45);color:#e4f8ff}

      /* Sammanfattningskortet var ett extra beslutslager. Behåll bara startknappen. */
      #setupScreen .setup-summary{max-width:760px!important;width:100%!important;margin:0 auto!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
      #setupScreen .setup-summary .step-kicker,
      #setupScreen .setup-summary .summary-visual,
      #setupScreen .setup-summary #summaryRows,
      #setupScreen .setup-summary h2{display:none!important}
      #setupScreen .setup-summary .start-button{min-height:58px!important;font-size:16px!important;border-radius:15px!important}

      /* Online-menyn: visa bara det som behövs för nästa handling. */
      #onlineModalBody .online-tabs{gap:8px!important}
      #onlineModalBody .online-tabs button{min-height:48px!important;font-weight:850!important}
      #onlineModalBody .online-form{gap:12px!important}
      #onlineModalBody .online-form .online-settings-preview{display:none!important}
      #onlineModalBody .online-network-note{font-size:11px!important;opacity:.68}
      #onlineModalBody #onlineRefreshSettings{display:none!important}

      @media(max-width:720px){
        #setupScreen:not(.orten-entry-gate) .topbar{min-height:48px!important;padding-top:6px!important;padding-bottom:4px!important}
        #setupScreen:not(.orten-entry-gate) .brand-logo{max-height:30px!important}
        #setupScreen #highscoreButton,
        #setupScreen #howToButton{min-height:34px!important;padding:0 9px!important;font-size:10px!important}
        #modeGrid.mode-grid,#setupScreen.online-host-mode #modeGrid.mode-grid{grid-template-columns:1fr!important}
        #modeGrid .mode-card{min-height:88px!important;display:grid!important;grid-template-columns:42px 1fr!important;grid-template-rows:auto auto!important;column-gap:12px!important;align-items:center!important;text-align:left!important}
        #modeGrid .mode-icon{grid-row:1/3!important;margin:0!important}
        #scopeTabs.segmented{grid-template-columns:1fr 1fr!important}
        .simple-step-guide{margin-top:3px;padding:13px 14px}
        .simple-step-guide strong{font-size:15px}
      }
    `;
    document.head.appendChild(style);
  }

  function setupPanel(step){
    return [...document.querySelectorAll('#setupScreen .setup-main > section.panel')][step-1]||null;
  }

  function ensureGuide(){
    if(document.getElementById('simpleStepGuide'))return;
    const nav=document.getElementById('setupWizardNav');
    if(!nav)return;
    const guide=document.createElement('div');
    guide.id='simpleStepGuide';guide.className='simple-step-guide';
    nav.insertAdjacentElement('afterend',guide);
  }

  function ensureAdvancedToggle(){
    const panel=setupPanel(3);if(!panel)return;
    const duplicate=document.getElementById('duplicateSelect')?.closest('.field-card');
    const theme=document.getElementById('themeGrid')?.closest('.field-card');
    duplicate?.classList.add('setup-advanced-option');
    theme?.classList.add('setup-advanced-option');
    if(document.getElementById('simpleAdvancedToggle'))return;
    const button=document.createElement('button');
    button.id='simpleAdvancedToggle';button.type='button';button.className='simple-advanced-toggle';
    button.textContent='＋ Fler inställningar';
    const anchor=theme||panel.lastElementChild;
    if(anchor)panel.insertBefore(button,anchor);else panel.appendChild(button);
    button.addEventListener('click',()=>{
      const open=panel.classList.toggle('show-simple-advanced');
      button.textContent=open?'− Dölj fler inställningar':'＋ Fler inställningar';
    });
  }

  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}

  function simplifyModeCopy(){
    const copy={
      classic:['Klassisk','En korsning avslutar matchen.'],
      endurance:['Tålighet','Ni får flera chanser innan matchen är slut.'],
      solo:['Solo','Spela själv och försök slå rekordet.']
    };
    document.querySelectorAll('#modeGrid [data-mode]').forEach(card=>{
      const values=copy[card.dataset.mode];if(!values)return;
      setText(card.querySelector('strong'),values[0]);setText(card.querySelector('small'),values[1]);
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
          1:['Välj spelläge','Klassisk avslutas vid första korsningen. Tålighet ger flera chanser.'],
          2:['Välj område','Tryck på Sverige, Norden, Europa eller Världen.'],
          3:['Skapa rummet','Välj eventuell turtid och tryck sedan på Skapa onlinerum.']
        }
      : {
          1:['Välj spelläge','Välj ett av de tre alternativen. Du går vidare automatiskt.'],
          2:['Välj område','Tryck på området där ni vill spela. Du går vidare automatiskt.'],
          3:[mode==='solo'?'Skriv ditt namn':'Skriv spelarnas namn',mode==='solo'?'Skriv ditt namn och starta när du är klar.':'Välj antal spelare, skriv namnen och starta.']
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

    const timer=document.getElementById('timerSelect')?.closest('.field-card');
    if(timer)timer.classList.toggle('hidden',!host&&mode==='solo');
    const playerHeading=document.querySelector('#playersCard .field-card-head > span');
    if(playerHeading)setText(playerHeading,mode==='solo'?'Ditt namn':'Spelare');
  }

  function simplifyOnlineModal(){
    const body=document.getElementById('onlineModalBody');if(!body)return;
    const title=body.querySelector('h2');
    const intro=body.querySelector('.online-intro');
    if(title&&title.textContent.includes('Spela Orten tillsammans'))setText(title,'Online');
    if(intro)setText(intro,'Välj om du vill skapa ett rum eller ansluta med en kod.');
    setText(body.querySelector('[data-online-tab="create"]'),'Skapa rum');
    setText(body.querySelector('[data-online-tab="join"]'),'Anslut med kod');
    const create=body.querySelector('#onlineCreateButton');
    const join=body.querySelector('#onlineJoinButton');
    if(create)setText(create,'Fortsätt till spelinställningar →');
    if(join)setText(join,'Anslut →');
    const note=body.querySelector('.online-network-note');
    if(note&&body.querySelector('#onlineCreateButton,#onlineJoinButton'))setText(note,'Värden väljer spelreglerna. Övriga behöver bara namn och rumskod.');
  }

  function refresh(){
    refreshQueued=false;
    ensureGuide();ensureAdvancedToggle();simplifyModeCopy();updateInstruction();simplifyOnlineModal();
  }

  function scheduleRefresh(){
    if(refreshQueued)return;
    refreshQueued=true;requestAnimationFrame(refresh);
  }

  function init(){
    installStyles();refresh();
    const setup=document.getElementById('setupScreen');
    if(setup)new MutationObserver(scheduleRefresh).observe(setup,{attributes:true,attributeFilter:['class','data-setup-step'],childList:true,subtree:true});
    const modal=document.getElementById('onlineModal');
    if(modal)new MutationObserver(scheduleRefresh).observe(modal,{childList:true,subtree:true});
    document.addEventListener('click',()=>setTimeout(scheduleRefresh,0),true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
