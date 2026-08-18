'use strict';

(() => {
  const flow = { mode:'local', hostName:'', roomCode:'', committing:false };

  function injectStyles(){
    if(document.getElementById('orten-online-entry-style')) return;
    const style=document.createElement('style');
    style.id='orten-online-entry-style';
    style.textContent=`
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
      @media(max-width:780px){.online-host-pill{font-size:10px}.online-host-context{margin-top:4px}}
    `;
    document.head.appendChild(style);
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
    setup?.classList.add('online-host-mode');
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
    finishHostSetup();
    flow.hostName='';
    flow.roomCode='';
    document.getElementById('onlineButton')?.focus();
    window.scrollTo({top:0,behavior:'smooth'});
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
    ensureHostContext();
    interceptStart();
    document.addEventListener('click',interceptCreateChoice,true);
    observeOnlineUi();

    const requested=new URLSearchParams(location.search).get('room');
    if(requested){
      setTimeout(()=>{
        document.getElementById('onlineButton')?.click();
        requestAnimationFrame(()=>document.querySelector('[data-online-tab="join"]')?.click());
      },80);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  else bootstrap();
})();
