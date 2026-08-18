'use strict';

(() => {
  const flow = { mode:'gate', hostName:'', roomCode:'', committing:false };

  function injectStyles(){
    if(document.getElementById('orten-online-entry-style')) return;
    const style=document.createElement('style');
    style.id='orten-online-entry-style';
    style.textContent=`
      #highscorePreview{display:none!important}
      .orten-entry-gate .hero,.orten-entry-gate .setup-grid,.orten-entry-gate .footer,.orten-entry-gate #setupWizardNav,.orten-entry-gate #onlineButton{display:none!important}
      .play-entry-gate{width:min(1040px,calc(100% - 24px));margin:54px auto 72px;display:grid;gap:24px}
      .play-entry-head{text-align:center;max-width:720px;margin:0 auto}.play-entry-head .eyebrow{display:inline-block;margin-bottom:10px}.play-entry-head h1{margin:0;font-size:clamp(42px,7vw,76px);letter-spacing:-.05em;line-height:.96}.play-entry-head h1 span{color:var(--cyan)}.play-entry-head p{margin:16px auto 0;max-width:580px;color:#95adba;font-size:15px;line-height:1.55}
      .play-entry-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.play-entry-card{position:relative;min-height:250px;border:1px solid var(--line);border-radius:24px;padding:28px;text-align:left;background:linear-gradient(145deg,rgba(16,39,57,.94),rgba(7,19,31,.97));color:#fff;cursor:pointer;overflow:hidden;box-shadow:0 18px 55px rgba(0,0,0,.22);transition:transform .18s,border-color .18s,box-shadow .18s}.play-entry-card:before{content:"";position:absolute;right:-38px;bottom:-58px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(104,246,255,.14),transparent 68%);pointer-events:none}.play-entry-card.online{border-color:rgba(115,245,167,.3);background:linear-gradient(145deg,rgba(12,48,51,.93),rgba(7,21,32,.97))}.play-entry-card.online:before{background:radial-gradient(circle,rgba(115,245,167,.17),transparent 68%)}.play-entry-card:hover,.play-entry-card:focus-visible{transform:translateY(-3px);border-color:rgba(104,246,255,.58);box-shadow:0 22px 70px rgba(0,0,0,.3)}.play-entry-card.online:hover,.play-entry-card.online:focus-visible{border-color:rgba(115,245,167,.65)}
      .play-entry-arrow{position:absolute;right:23px;top:23px;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);color:#d9edf3;font-size:19px}.play-entry-icon{width:62px;height:62px;border-radius:18px;display:grid;place-items:center;font-size:31px;background:rgba(104,246,255,.08);border:1px solid rgba(104,246,255,.2);margin-bottom:34px}.play-entry-card.online .play-entry-icon{background:rgba(115,245,167,.08);border-color:rgba(115,245,167,.2)}.play-entry-card strong{display:block;font-size:28px;letter-spacing:-.03em;margin-bottom:8px}.play-entry-card small{display:block;color:#91a9b7;line-height:1.5;font-size:13px;max-width:390px}
      .setup-entry-back{width:min(1240px,calc(100% - 24px));margin:8px auto 0;display:flex;justify-content:flex-start}.setup-entry-back.hidden{display:none!important}.setup-entry-back button{border:1px solid var(--line);border-radius:12px;background:rgba(7,20,32,.72);color:#c7dbe4;min-height:40px;padding:0 13px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
      .online-host-mode #playersCard{display:none!important}
      .online-host-mode [data-mode="solo"]{opacity:.34;filter:grayscale(.8);pointer-events:none}
      .online-host-mode [data-mode="solo"] small:after{content:" · ej online"}
      .online-host-context{width:min(1240px,calc(100% - 24px));margin:10px auto 0;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .online-host-context.hidden,.online-host-banner.hidden{display:none!important}
      .online-host-back{border:1px solid var(--line);border-radius:12px;background:rgba(7,20,32,.72);color:#c7dbe4;min-height:40px;padding:0 13px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
      .online-host-pill{border:1px solid rgba(115,245,167,.25);border-radius:999px;padding:8px 12px;color:#aef8ca;background:rgba(115,245,167,.05);font-size:11px;font-weight:850}
      .online-host-banner{width:min(1240px,calc(100% - 24px));margin:7px auto 14px;border:1px solid rgba(115,245,167,.22);border-radius:15px;background:linear-gradient(90deg,rgba(115,245,167,.07),rgba(104,246,255,.03));padding:12px 14px;display:flex;align-items:center;gap:11px;color:#dff8e8}
      .online-host-banner span{font-size:20px}.online-host-banner strong{font-size:12px}.online-host-banner small{display:block;color:#7fa094;font-size:10px;margin-top:2px}
      .online-create-code-hidden{display:none!important}
      @media(max-width:780px){.play-entry-gate{margin-top:28px}.play-entry-grid{grid-template-columns:1fr}.play-entry-card{min-height:190px;padding:22px}.play-entry-icon{margin-bottom:20px}.play-entry-card strong{font-size:23px}.play-entry-head h1{font-size:46px}.online-host-pill{font-size:10px}.online-host-context{margin-top:4px}}
    `;
    document.head.appendChild(style);
  }

  function ensureEntryGate(){
    if(document.getElementById('playEntryGate')) return;
    const setup=document.getElementById('setupScreen');
    const header=setup?.querySelector('.topbar');
    if(!setup||!header) return;

    const gate=document.createElement('section');
    gate.id='playEntryGate';
    gate.className='play-entry-gate';
    gate.innerHTML=`
      <div class="play-entry-head">
        <span class="eyebrow">ORTEN 2.0</span>
        <h1>Hur vill du <span>spela?</span></h1>
        <p>Välj ett av två sätt att börja. Spelalternativen kommer i nästa steg.</p>
      </div>
      <div class="play-entry-grid">
        <button id="entryOnline" class="play-entry-card online" type="button">
          <span class="play-entry-arrow">→</span><span class="play-entry-icon">🌐</span>
          <strong>Online</strong><small>Skapa ett rum eller anslut till någon annans rum.</small>
        </button>
        <button id="entryLocal" class="play-entry-card" type="button">
          <span class="play-entry-arrow">→</span><span class="play-entry-icon">🎮</span>
          <strong>En enhet</strong><small>Spela på samma mobil, surfplatta eller dator.</small>
        </button>
      </div>`;
    header.insertAdjacentElement('afterend',gate);
    document.getElementById('entryOnline')?.addEventListener('click',openOnlineChoice);
    document.getElementById('entryLocal')?.addEventListener('click',showLocalSetup);
  }

  function ensureSetupBack(){
    if(document.getElementById('setupEntryBack')) return;
    const setup=document.getElementById('setupScreen');
    const hero=setup?.querySelector('.hero');
    if(!setup||!hero) return;
    const wrap=document.createElement('div');
    wrap.id='setupEntryBack';
    wrap.className='setup-entry-back hidden';
    wrap.innerHTML='<button type="button">← Online / En enhet</button>';
    hero.insertAdjacentElement('beforebegin',wrap);
    wrap.querySelector('button')?.addEventListener('click',showGate);
  }

  function showGate(){
    flow.mode='gate';
    const setup=document.getElementById('setupScreen');
    setup?.classList.add('orten-entry-gate');
    setup?.classList.remove('online-host-mode');
    document.getElementById('playEntryGate')?.classList.remove('hidden');
    document.getElementById('setupEntryBack')?.classList.add('hidden');
    document.getElementById('onlineHostContext')?.classList.add('hidden');
    document.getElementById('onlineHostBanner')?.classList.add('hidden');
    resetStartButton();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function showLocalSetup(){
    flow.mode='local';
    const setup=document.getElementById('setupScreen');
    setup?.classList.remove('orten-entry-gate','online-host-mode');
    document.getElementById('playEntryGate')?.classList.add('hidden');
    document.getElementById('setupEntryBack')?.classList.remove('hidden');
    document.getElementById('onlineHostContext')?.classList.add('hidden');
    document.getElementById('onlineHostBanner')?.classList.add('hidden');
    resetStartButton();
    if(typeof showSetupStep==='function') showSetupStep(1);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function openOnlineChoice(){
    const onlineButton=document.getElementById('onlineButton');
    if(!onlineButton) return;
    onlineButton.click();
  }

  function ensureHostContext(){
    if(document.getElementById('onlineHostContext')) return;
    const setup=document.getElementById('setupScreen');
    const hero=setup?.querySelector('.hero');
    if(!setup||!hero) return;

    const context=document.createElement('div');
    context.id='onlineHostContext';
    context.className='online-host-context hidden';
    context.innerHTML='<button id="onlineHostBack" class="online-host-back" type="button">← Avbryt online</button><span class="online-host-pill">🌐 Skapa onlinerum</span>';
    hero.insertAdjacentElement('beforebegin',context);

    const banner=document.createElement('div');
    banner.id='onlineHostBanner';
    banner.className='online-host-banner hidden';
    banner.innerHTML='<span>🌐</span><div><strong>VÄLJ SPELALTERNATIV</strong><small>När du är nöjd skapar du rummet. Därefter får du rumskoden som de andra spelarna använder.</small></div>';
    context.insertAdjacentElement('afterend',banner);

    document.getElementById('onlineHostBack')?.addEventListener('click',cancelHostSetup);
  }

  function storedName(){
    try{return localStorage.getItem('orten2:online-name')||''}catch{return ''}
  }

  function setStoredName(name){
    try{localStorage.setItem('orten2:online-name',name)}catch{}
  }

  function resetStartButton(){
    if(!els?.startButton) return;
    els.startButton.innerHTML='<span>Starta spelet</span><b>→</b>';
  }

  function beginHostSetup(name,code){
    flow.mode='host-setup';
    flow.hostName=String(name||'').trim();
    flow.roomCode=String(code||'').trim();
    if(flow.hostName) setStoredName(flow.hostName);

    const setup=document.getElementById('setupScreen');
    setup?.classList.remove('orten-entry-gate');
    setup?.classList.add('online-host-mode');
    document.getElementById('playEntryGate')?.classList.add('hidden');
    document.getElementById('setupEntryBack')?.classList.add('hidden');
    document.getElementById('onlineModal')?.classList.add('hidden');
    document.getElementById('onlineHostContext')?.classList.remove('hidden');
    document.getElementById('onlineHostBanner')?.classList.remove('hidden');

    if(settings.mode==='solo'){
      settings.mode='classic';
      normalizePlayerCount();
      updateSetupUI(false);
    }
    if(els?.startButton) els.startButton.innerHTML='<span>Skapa onlinerum</span><b>→</b>';
    if(typeof showSetupStep==='function') showSetupStep(1);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function finishHostSetup(){
    flow.mode='local';
    flow.committing=false;
    document.getElementById('setupScreen')?.classList.remove('online-host-mode');
    document.getElementById('onlineHostContext')?.classList.add('hidden');
    document.getElementById('onlineHostBanner')?.classList.add('hidden');
    resetStartButton();
  }

  function cancelHostSetup(){
    flow.hostName='';
    flow.roomCode='';
    finishHostSetup();
    showGate();
    setTimeout(openOnlineChoice,0);
  }

  function prepareOnlineMenu(){
    const button=document.getElementById('onlineButton');
    if(button){
      if(button.textContent.trim()!=='● Spela online') button.innerHTML='<span>●</span> Spela online';
      if(button.getAttribute('aria-label')!=='Spela online') button.setAttribute('aria-label','Spela online');
    }

    const create=document.getElementById('onlineCreateButton');
    const hostName=document.getElementById('onlineHostName');
    const code=document.getElementById('onlineCreateCode');
    if(hostName && !hostName.value.trim() && storedName()) hostName.value=storedName();
    if(code) code.closest('label')?.classList.add('online-create-code-hidden');
    if(create && flow.mode!=='host-setup' && !flow.committing){
      if(create.textContent!=='Välj spelalternativ →') create.textContent='Välj spelalternativ →';
      const preview=create.parentElement?.querySelector('.online-settings-preview');
      if(preview){
        const label=preview.querySelector('span');
        const value=preview.querySelector('strong');
        if(label && label.textContent!=='Nästa steg') label.textContent='Nästa steg';
        if(value && value.textContent!=='Spelläge, område, tid och karta') value.textContent='Spelläge, område, tid och karta';
      }
    }
  }

  function interceptCreateChoice(event){
    const button=event.target?.closest?.('#onlineCreateButton');
    if(!button || flow.committing) return;
    const nameInput=document.getElementById('onlineHostName');
    const codeInput=document.getElementById('onlineCreateCode');
    if(!nameInput?.value.trim()) return;

    event.preventDefault();
    event.stopPropagation();

    queueMicrotask(()=>{
      if(nameInput.classList.contains('name-required-field') || nameInput.getAttribute('aria-invalid')==='true') return;
      beginHostSetup(nameInput.value,codeInput?.value);
    });
  }

  function launchRoom(){
    const onlineButton=document.getElementById('onlineButton');
    if(!onlineButton) return;
    flow.committing=true;
    onlineButton.click();

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const createTab=document.querySelector('[data-online-tab="create"]');
      if(createTab && !createTab.classList.contains('active')) createTab.click();

      requestAnimationFrame(()=>{
        const nameInput=document.getElementById('onlineHostName');
        const codeInput=document.getElementById('onlineCreateCode');
        const createButton=document.getElementById('onlineCreateButton');
        if(!nameInput||!codeInput||!createButton){
          flow.committing=false;
          return;
        }
        nameInput.value=flow.hostName||storedName();
        if(flow.roomCode) codeInput.value=flow.roomCode;
        createButton.textContent='Skapar rum…';
        createButton.click();
        setTimeout(()=>{flow.committing=false},0);
      });
    }));
  }

  function interceptStart(){
    els?.startButton?.addEventListener('click',event=>{
      if(flow.mode!=='host-setup') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      launchRoom();
    },true);
  }

  function observeOnlineUi(){
    const refresh=()=>{
      prepareOnlineMenu();
      if(flow.mode==='host-setup' && document.querySelector('#onlineModalBody .online-lobby-head')) finishHostSetup();
    };
    refresh();
    if(document.body) new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});
  }

  function bootstrap(){
    injectStyles();
    ensureEntryGate();
    ensureSetupBack();
    ensureHostContext();
    interceptStart();
    document.addEventListener('click',interceptCreateChoice,true);
    observeOnlineUi();

    const requested=new URLSearchParams(location.search).get('room');
    if(requested){
      showGate();
      setTimeout(()=>{
        openOnlineChoice();
        requestAnimationFrame(()=>document.querySelector('[data-online-tab="join"]')?.click());
      },80);
    }else showGate();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  else bootstrap();
})();
