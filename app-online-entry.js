'use strict';

(() => {
  const flow = { mode:'gate' };

  function injectStyles(){
    if(document.getElementById('orten-play-type-style')) return;
    const style=document.createElement('style');
    style.id='orten-play-type-style';
    style.textContent=`
      #onlineButton{display:none!important}
      .play-type-flow-hidden{display:none!important}
      .play-type-gate{width:min(1040px,calc(100% - 24px));margin:34px auto 64px;display:grid;gap:22px}
      .play-type-head{text-align:center;max-width:720px;margin:0 auto}.play-type-head .eyebrow{display:inline-block;margin-bottom:8px}.play-type-head h1{margin:0;font-size:clamp(38px,7vw,72px);letter-spacing:-.045em;line-height:.96}.play-type-head h1 span{color:var(--cyan)}.play-type-head p{margin:15px auto 0;max-width:610px;color:#9cb3c1;font-size:15px;line-height:1.55}
      .play-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.play-type-card{position:relative;min-height:255px;border:1px solid var(--line);border-radius:24px;padding:26px;text-align:left;background:linear-gradient(145deg,rgba(16,39,57,.94),rgba(7,19,31,.96));color:#fff;cursor:pointer;overflow:hidden;box-shadow:0 18px 55px rgba(0,0,0,.22);transition:transform .18s,border-color .18s,box-shadow .18s}.play-type-card:before{content:"";position:absolute;inset:auto -35px -55px auto;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,rgba(104,246,255,.13),transparent 68%);pointer-events:none}.play-type-card:hover,.play-type-card:focus-visible{transform:translateY(-3px);border-color:rgba(104,246,255,.55);box-shadow:0 22px 70px rgba(0,0,0,.3),0 0 0 1px rgba(104,246,255,.07)}.play-type-card.online{border-color:rgba(115,245,167,.28);background:linear-gradient(145deg,rgba(12,48,51,.92),rgba(7,21,32,.97))}.play-type-card.online:before{background:radial-gradient(circle,rgba(115,245,167,.16),transparent 68%)}
      .play-type-icon{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;font-size:29px;background:rgba(104,246,255,.08);border:1px solid rgba(104,246,255,.2);margin-bottom:30px}.play-type-card.online .play-type-icon{background:rgba(115,245,167,.08);border-color:rgba(115,245,167,.2)}.play-type-card strong{display:block;font-size:26px;letter-spacing:-.025em;margin-bottom:7px}.play-type-card small{display:block;color:#91a9b7;line-height:1.48;font-size:13px;max-width:390px}.play-type-arrow{position:absolute;right:22px;top:22px;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);color:#c9e7ef;font-size:18px}
      .play-type-online-actions{display:none;grid-template-columns:1fr 1fr;gap:12px;padding:16px;border:1px solid rgba(115,245,167,.2);border-radius:20px;background:rgba(7,24,31,.82);box-shadow:0 16px 45px rgba(0,0,0,.2)}.play-type-online-actions.open{display:grid}.play-type-online-actions .choice{min-height:92px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.025);color:#fff;text-align:left;padding:16px;cursor:pointer}.play-type-online-actions .choice:hover{border-color:#73f5a7;background:rgba(115,245,167,.055)}.play-type-online-actions .choice strong{display:block;font-size:15px;margin-bottom:5px}.play-type-online-actions .choice small{display:block;color:#839ba9;font-size:11px;line-height:1.4}
      .play-type-context{width:min(1240px,calc(100% - 24px));margin:10px auto 2px;display:flex;align-items:center;justify-content:space-between;gap:12px}.play-type-back{border:1px solid var(--line);border-radius:12px;background:rgba(7,20,32,.72);color:#c7dbe4;min-height:40px;padding:0 13px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.play-type-mode-pill{border:1px solid rgba(104,246,255,.22);border-radius:999px;padding:8px 12px;color:#b9d8e2;background:rgba(104,246,255,.04);font-size:11px;font-weight:850}.play-type-mode-pill.online{border-color:rgba(115,245,167,.25);color:#aef8ca;background:rgba(115,245,167,.05)}
      .online-host-setup-banner{width:min(1240px,calc(100% - 24px));margin:7px auto 14px;border:1px solid rgba(115,245,167,.22);border-radius:15px;background:linear-gradient(90deg,rgba(115,245,167,.07),rgba(104,246,255,.03));padding:12px 14px;display:flex;align-items:center;gap:11px;color:#dff8e8}.online-host-setup-banner span{font-size:20px}.online-host-setup-banner strong{font-size:12px}.online-host-setup-banner small{display:block;color:#7fa094;font-size:10px;margin-top:2px}
      .online-host-mode #playersCard{display:none!important}.online-host-mode [data-mode="solo"]{opacity:.34;filter:grayscale(.8);pointer-events:none}.online-host-mode [data-mode="solo"] small:after{content:" · ej online"}
      @media(max-width:780px){.play-type-gate{margin-top:22px}.play-type-grid{grid-template-columns:1fr}.play-type-card{min-height:190px;padding:20px}.play-type-icon{margin-bottom:19px}.play-type-card strong{font-size:22px}.play-type-online-actions{grid-template-columns:1fr}.play-type-head h1{font-size:44px}.play-type-context{margin-top:4px}.play-type-mode-pill{font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function setupParts(){
    return [
      document.querySelector('#setupScreen .hero'),
      document.getElementById('setupWizardNav'),
      document.querySelector('#setupScreen .setup-grid'),
      document.querySelector('#setupScreen .footer')
    ].filter(Boolean);
  }

  function setSetupVisible(visible){
    setupParts().forEach(el=>el.classList.toggle('play-type-flow-hidden',!visible));
    const context=document.getElementById('playTypeContext');
    if(context) context.classList.toggle('play-type-flow-hidden',!visible);
  }

  function ensureGate(){
    if(document.getElementById('playTypeGate')) return;
    const setup=document.getElementById('setupScreen');
    const header=setup?.querySelector('.topbar');
    if(!setup||!header) return;

    const gate=document.createElement('section');
    gate.id='playTypeGate';
    gate.className='play-type-gate';
    gate.innerHTML=`
      <div class="play-type-head">
        <span class="eyebrow">FÖRST · VÄLJ HUR NI SPELAR</span>
        <h1>Hur vill du <span>spela?</span></h1>
        <p>Välj om ni spelar tillsammans på samma skärm eller från varsin enhet. Därefter väljer du spelläge, område och regler.</p>
      </div>
      <div class="play-type-grid">
        <button id="chooseLocalPlay" class="play-type-card" type="button">
          <span class="play-type-arrow">→</span><span class="play-type-icon">🎮</span>
          <strong>På samma enhet</strong><small>Det klassiska upplägget. Turas om på samma mobil, surfplatta eller dator.</small>
        </button>
        <button id="chooseOnlinePlay" class="play-type-card online" type="button">
          <span class="play-type-arrow">→</span><span class="play-type-icon">🌐</span>
          <strong>Online</strong><small>Skapa ett rum eller anslut med kod. Varje spelare använder sin egen enhet.</small>
        </button>
      </div>
      <div id="playTypeOnlineActions" class="play-type-online-actions">
        <button id="chooseOnlineHost" class="choice" type="button"><strong>＋ Skapa rum</strong><small>Välj matchinställningar först och öppna sedan lobbyn.</small></button>
        <button id="chooseOnlineJoin" class="choice" type="button"><strong>⌁ Anslut till rum</strong><small>Skriv ditt namn och rumskoden från spelledaren.</small></button>
      </div>`;
    header.insertAdjacentElement('afterend',gate);

    const context=document.createElement('div');
    context.id='playTypeContext';
    context.className='play-type-context play-type-flow-hidden';
    context.innerHTML='<button id="playTypeBack" class="play-type-back" type="button">← Lokal / Online</button><span id="playTypeModePill" class="play-type-mode-pill">🎮 Samma enhet</span>';
    gate.insertAdjacentElement('afterend',context);

    const banner=document.createElement('div');
    banner.id='onlineHostSetupBanner';
    banner.className='online-host-setup-banner play-type-flow-hidden';
    banner.innerHTML='<span>🌐</span><div><strong>ONLINE · SKAPA RUM</strong><small>Välj matchens spelläge, område och regler. Spelarna ansluter i lobbyn efteråt.</small></div>';
    context.insertAdjacentElement('afterend',banner);

    document.getElementById('chooseLocalPlay')?.addEventListener('click',()=>showSetup('local'));
    document.getElementById('chooseOnlinePlay')?.addEventListener('click',()=>document.getElementById('playTypeOnlineActions')?.classList.toggle('open'));
    document.getElementById('chooseOnlineHost')?.addEventListener('click',()=>showSetup('online-host'));
    document.getElementById('chooseOnlineJoin')?.addEventListener('click',openJoin);
    document.getElementById('playTypeBack')?.addEventListener('click',showGate);
  }

  function resetStartButton(){
    if(!els?.startButton) return;
    els.startButton.innerHTML='<span>Starta spelet</span><b>→</b>';
  }

  function showGate(){
    flow.mode='gate';
    document.getElementById('setupScreen')?.classList.remove('online-host-mode');
    document.getElementById('playTypeGate')?.classList.remove('play-type-flow-hidden');
    document.getElementById('onlineHostSetupBanner')?.classList.add('play-type-flow-hidden');
    setSetupVisible(false);
    resetStartButton();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function showSetup(mode){
    flow.mode=mode;
    const setup=document.getElementById('setupScreen');
    setup?.classList.toggle('online-host-mode',mode==='online-host');
    document.getElementById('playTypeGate')?.classList.add('play-type-flow-hidden');
    setSetupVisible(true);
    const pill=document.getElementById('playTypeModePill');
    if(pill){
      pill.classList.toggle('online',mode==='online-host');
      pill.textContent=mode==='online-host'?'🌐 Online · skapa rum':'🎮 Samma enhet';
    }
    document.getElementById('onlineHostSetupBanner')?.classList.toggle('play-type-flow-hidden',mode!=='online-host');
    if(mode==='online-host'){
      if(settings.mode==='solo'){settings.mode='classic';normalizePlayerCount();updateSetupUI(false)}
      if(els?.startButton) els.startButton.innerHTML='<span>Fortsätt till onlinerum</span><b>→</b>';
    }else resetStartButton();
    if(typeof showSetupStep==='function') showSetupStep(1);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function clickOnlineTab(tab){
    const onlineButton=document.getElementById('onlineButton');
    if(!onlineButton) return;
    onlineButton.click();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.querySelector(`[data-online-tab="${tab}"]`)?.click();
      if(tab==='join') document.getElementById('onlineJoinCode')?.focus();
    }));
  }

  function openJoin(){
    flow.mode='online-join';
    clickOnlineTab('join');
  }

  function interceptStart(){
    els?.startButton?.addEventListener('click',event=>{
      if(flow.mode!=='online-host') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clickOnlineTab('create');
    },true);
  }

  function bootstrap(){
    injectStyles();
    ensureGate();
    interceptStart();
    const requested=new URLSearchParams(location.search).get('room');
    if(requested){
      document.getElementById('playTypeOnlineActions')?.classList.add('open');
      setTimeout(openJoin,90);
    }else showGate();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  else bootstrap();
})();
