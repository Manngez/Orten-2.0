'use strict';

(() => {
  const STYLE_ID='orten-simple-flow-style';

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* Förstasidan: bara två tydliga vägval. */
      .orten-entry-gate #highscoreButton,
      .orten-entry-gate #soundButton,
      .orten-entry-gate #howToButton{display:none!important}

      /* Efter första valet försvinner marknadsföringsytor och extra brus. */
      #setupScreen:not(.orten-entry-gate) > .hero,
      #setupScreen:not(.orten-entry-gate) > .footer,
      #setupScreen:not(.orten-entry-gate) #onlineButton{display:none!important}
      #setupScreen:not(.orten-entry-gate) .setup-grid{grid-template-columns:minmax(0,780px)!important;justify-content:center;gap:14px!important}
      #setupScreen:not(.orten-entry-gate) .setup-main{min-width:0}
      #setupScreen:not(.orten-entry-gate) .setup-main > .panel{border-radius:18px!important;padding:18px!important}

      /* En enda tydlig instruktion för aktuellt steg. */
      .simple-step-guide{width:min(780px,calc(100% - 24px));margin:10px auto 12px;padding:14px 16px;border:1px solid rgba(104,246,255,.22);border-radius:15px;background:rgba(104,246,255,.045);display:flex;gap:12px;align-items:flex-start}
      .simple-step-guide b{width:28px;height:28px;flex:0 0 28px;border-radius:50%;display:grid;place-items:center;background:rgba(104,246,255,.12);border:1px solid rgba(104,246,255,.24);color:#d9fbff;font-size:12px}
      .simple-step-guide strong{display:block;color:#eefcff;font-size:14px;margin-bottom:3px}
      .simple-step-guide small{display:block;color:#8ea9b6;font-size:12px;line-height:1.45}
      .online-host-mode .simple-step-guide{border-color:rgba(115,245,167,.24);background:rgba(115,245,167,.045)}
      .online-host-mode .simple-step-guide b{background:rgba(115,245,167,.11);border-color:rgba(115,245,167,.25);color:#c9f9d9}

      /* Wizard: tydlig men kompakt. */
      #setupWizardNav{max-width:780px!important;margin-top:8px!important;margin-bottom:4px!important}
      #setupWizardNav .wizard-progress small{font-size:10px!important}
      #setupScreen[data-setup-step="1"] #setupEntryBack{display:flex!important}
      #setupScreen:not([data-setup-step="1"]) #setupEntryBack{display:none!important}
      #setupScreen[data-setup-step="1"] #onlineHostContext{display:flex!important}
      #setupScreen:not([data-setup-step="1"]) #onlineHostContext{display:none!important}

      /* Steg 3: visa bara det som behövs. */
      .setup-advanced-option{display:none!important}
      .setup-main .panel.show-simple-advanced .setup-advanced-option{display:block!important}
      .simple-advanced-toggle{width:100%;margin:10px 0 0;min-height:44px;border:1px dashed rgba(151,180,194,.35);border-radius:12px;background:rgba(255,255,255,.018);color:#b9ced8;font:800 12px/1 system-ui;cursor:pointer}
      .simple-advanced-toggle:hover{border-color:rgba(104,246,255,.45);color:#e4f8ff}
      #setupScreen .rules-grid{gap:10px!important}
      #setupScreen .field-card{padding:14px!important}
      #setupScreen .panel-heading{margin-bottom:12px!important}
      #setupScreen .panel-heading h2{font-size:clamp(22px,4vw,30px)!important}
      #setupScreen .panel-hint{display:none!important}

      /* Sammanfattningskortet reduceras till en ren startknapp. */
      #setupScreen .setup-summary{max-width:780px!important;width:100%!important;margin:0 auto!important;padding:14px!important}
      #setupScreen .setup-summary .step-kicker,
      #setupScreen .setup-summary .summary-visual,
      #setupScreen .setup-summary #summaryRows{display:none!important}
      #setupScreen .setup-summary h2{font-size:17px!important;margin:0 0 10px!important;color:#dbeef5}
      #setupScreen .setup-summary h2:after{content:' – kontrollera namnen och starta';font-weight:500;color:#839ba8}
      #setupScreen.online-host-mode .setup-summary h2:after{content:' – skapa rummet när inställningarna känns bra'}

      /* Mindre kort och tydligare val. */
      #modeGrid.mode-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}
      #modeGrid .mode-card{min-height:145px!important;padding:16px!important}
      #modeGrid .mode-card strong{font-size:16px!important}
      #modeGrid .mode-card small{font-size:11px!important;line-height:1.35!important}
      #scopeTabs.segmented{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      #scopeTabs.segmented button{min-height:54px;padding:9px 7px!important}

      @media(max-width:720px){
        #modeGrid.mode-grid{grid-template-columns:1fr!important}
        #modeGrid .mode-card{min-height:92px!important;display:grid!important;grid-template-columns:42px 1fr!important;grid-template-rows:auto auto!important;column-gap:12px!important;align-items:center!important}
        #modeGrid .mode-icon{grid-row:1/3!important;margin:0!important}
        #scopeTabs.segmented{grid-template-columns:1fr 1fr!important}
        .simple-step-guide{margin-top:6px}
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
    guide.id='simpleStepGuide';
    guide.className='simple-step-guide';
    guide.innerHTML='<b>1</b><div><strong>Välj spelläge</strong><small>Tryck på ett alternativ. Du går vidare automatiskt.</small></div>';
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
    button.textContent='＋ Fler inställningar (valfritt)';
    const anchor=theme||panel.lastElementChild;
    if(anchor)panel.insertBefore(button,anchor);else panel.appendChild(button);
    button.addEventListener('click',()=>{
      const open=panel.classList.toggle('show-simple-advanced');
      button.textContent=open?'− Dölj fler inställningar':'＋ Fler inställningar (valfritt)';
    });
  }

  function updateInstruction(){
    const screen=document.getElementById('setupScreen');
    const guide=document.getElementById('simpleStepGuide');
    if(!screen||!guide)return;
    if(screen.classList.contains('orten-entry-gate')){guide.style.display='none';return}
    guide.style.display='flex';
    const step=Number(screen.dataset.setupStep)||1;
    const host=screen.classList.contains('online-host-mode');
    const copy=host
      ? {
          1:['Välj spelläge','Välj hur matchen ska avgöras. Solo används inte online.'],
          2:['Välj område','Välj Sverige, Norden, Europa eller Världen.'],
          3:['Kontrollera och skapa rummet','Ändra tid om du vill. Tryck sedan på Skapa onlinerum.']
        }
      : {
          1:['Välj spelläge','Tryck på Klassisk, Tålighet eller Solo. Nästa steg öppnas automatiskt.'],
          2:['Välj område','Välj var ni ska spela. Nästa steg öppnas automatiskt.'],
          3:['Skriv namn och starta','Skriv spelarnas namn. Turtid är valfri. Tryck sedan på Starta spelet.']
        };
    const [title,text]=copy[step]||copy[1];
    guide.innerHTML=`<b>${step}</b><div><strong>${title}</strong><small>${text}</small></div>`;

    const labels=[['Spelläge','Spelläge'],['Område','Område'],['Namn & start','Namn & start']];
    document.querySelectorAll('[data-wizard-dot]').forEach((dot,index)=>{
      const small=dot.querySelector('small');if(small&&labels[index])small.textContent=labels[index][1];
    });
    const stepText=document.getElementById('setupStepText');if(stepText)stepText.textContent=`Steg ${step} av 3`;

    const heading=setupPanel(step)?.querySelector('.panel-heading h2');
    if(heading){
      if(step===1)heading.textContent='Välj ett spelläge';
      else if(step===2)heading.textContent='Välj område';
      else heading.textContent=host?'Sista steget':'Skriv namn och starta';
    }

    const back=document.querySelector('#setupEntryBack button');
    if(back)back.textContent='← Start';
    const hostBack=document.getElementById('onlineHostBack');
    if(hostBack)hostBack.textContent='← Till onlinevalet';

    const timer=document.getElementById('timerSelect')?.closest('.field-card');
    if(timer)timer.classList.toggle('hidden',!host&&settings?.mode==='solo');
  }

  function simplifyOnlineModal(){
    const body=document.getElementById('onlineModalBody');if(!body)return;
    const title=body.querySelector('h2');
    const intro=body.querySelector('.online-intro');
    if(title&&title.textContent.includes('Spela Orten tillsammans'))title.textContent='Online';
    if(intro)intro.textContent='Skapa ett rum eller anslut med en rumskod.';
    const createTab=body.querySelector('[data-online-tab="create"]');
    const joinTab=body.querySelector('[data-online-tab="join"]');
    if(createTab)createTab.textContent='Skapa rum';
    if(joinTab)joinTab.textContent='Anslut till rum';
  }

  function refresh(){
    ensureGuide();ensureAdvancedToggle();updateInstruction();simplifyOnlineModal();
  }

  function init(){
    installStyles();
    refresh();
    if(document.body)new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-setup-step']});
    document.addEventListener('click',()=>setTimeout(refresh,0),true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
