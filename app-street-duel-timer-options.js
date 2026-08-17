'use strict';

(() => {
  const OPTIONS=[0,10,15,20,30,45,60];
  const DEFAULT_SECONDS=20;
  const STORAGE_KEY='orten2:street-duel-turn-seconds';
  const nativeSetInterval=window.setInterval.bind(window);
  const nativeClearInterval=window.clearInterval.bind(window);

  let selectedSeconds=readSaved();
  let lastTimerText='';
  let observer=null;

  function readSaved(){
    try{
      const value=Number(localStorage.getItem(STORAGE_KEY));
      return OPTIONS.includes(value)?value:DEFAULT_SECONDS;
    }catch{return DEFAULT_SECONDS;}
  }

  function save(value){
    selectedSeconds=OPTIONS.includes(Number(value))?Number(value):DEFAULT_SECONDS;
    try{localStorage.setItem(STORAGE_KEY,String(selectedSeconds));}catch{}
    lastTimerText='';
    syncTimerPresentation();
    syncRulesText();
    syncLobbyCopy();
  }

  function isStreetDuelTimer(handler,delay){
    if(Number(delay)!==200 || typeof handler!=='function') return false;
    const source=Function.prototype.toString.call(handler);
    return source.includes('timerRemaining') && source.includes('loseRound');
  }

  window.setInterval=function(handler,delay,...args){
    if(!isStreetDuelTimer(handler,delay)) return nativeSetInterval(handler,delay,...args);
    if(selectedSeconds===0) return 0;
    const scaledDelay=Number(delay)*(selectedSeconds/DEFAULT_SECONDS);
    return nativeSetInterval(handler,scaledDelay,...args);
  };

  window.clearInterval=function(id){return nativeClearInterval(id);};

  function timerElements(){
    return {
      bar:document.querySelector('#streetDuelTimerBar'),
      track:document.querySelector('#streetDuelTimerBar')?.closest('.street-duel-timer'),
      text:document.querySelector('#streetDuelTimerText')
    };
  }

  function syncTimerPresentation(){
    const {bar,track,text}=timerElements();
    if(!text) return;
    if(selectedSeconds===0){
      if(track) track.style.display='none';
      text.style.display='block';
      if(text.textContent!=='Ingen tidsgräns') text.textContent='Ingen tidsgräns';
      lastTimerText='Ingen tidsgräns';
      return;
    }

    if(track) track.style.display='block';
    text.style.display='block';
    const current=text.textContent.trim();
    if(current===lastTimerText) return;
    const raw=Number.parseInt(current,10);
    if(Number.isFinite(raw)){
      const shown=Math.max(0,Math.ceil(raw*(selectedSeconds/DEFAULT_SECONDS)));
      const next=`${shown} sek`;
      if(current!==next) text.textContent=next;
      lastTimerText=next;
    }else if(bar){
      lastTimerText='';
    }
  }

  function syncRulesText(){
    const rules=document.querySelector('.street-duel-rules');
    if(!rules) return;
    const next=selectedSeconds===0
      ? '<strong>Så avgörs rundan</strong>Fel korsning eller återanvänd gata förlorar rundan. Gatan måste finnas i Umeås gatnät. Först till tre rundvinster vinner matchen.'
      : '<strong>Så avgörs rundan</strong>Fel korsning, återanvänd gata eller slut på tiden förlorar rundan. Gatan måste finnas i Umeås gatnät. Först till tre rundvinster vinner matchen.';
    if(rules.innerHTML!==next) rules.innerHTML=next;
  }

  function ensureTimerChoice(){
    const card=document.getElementById('streetDuelOverlayCard');
    const start=document.getElementById('streetDuelStart');
    if(!card||!start||document.getElementById('streetDuelTimerChoice')) return;

    const wrap=document.createElement('label');
    wrap.id='streetDuelTimerChoice';
    wrap.style.cssText='display:grid;gap:6px;margin:0 0 14px;color:#bed3dc;font-size:11px;font-weight:800';
    wrap.innerHTML=`<span>Tidsgräns per tur</span><select id="streetDuelTimerSelect" aria-label="Tidsgräns per tur" style="height:46px;border-radius:13px;border:1px solid rgba(132,181,201,.2);background:#081a27;color:#fff;padding:0 12px;font:inherit">${OPTIONS.map(value=>`<option value="${value}"${value===selectedSeconds?' selected':''}>${value===0?'Ingen tidsgräns':`${value} sekunder`}</option>`).join('')}</select>`;
    start.insertAdjacentElement('beforebegin',wrap);
    document.getElementById('streetDuelTimerSelect')?.addEventListener('change',event=>save(event.target.value));
  }

  function syncLobbyCopy(){
    const card=document.getElementById('streetDuelOverlayCard');
    if(!card||!document.getElementById('streetDuelStart')) return;
    const p=card.querySelector('p');
    if(!p) return;
    const next=selectedSeconds===0
      ? 'Ni turas om att skriva en gata som faktiskt korsar den aktuella gatan. Fel korsning kostar rundan. Först till tre rundvinster vinner.'
      : 'Ni turas om att skriva en gata som faktiskt korsar den aktuella gatan. Fel korsning eller slut på tiden kostar rundan. Först till tre rundvinster vinner.';
    if(p.textContent!==next) p.textContent=next;
  }

  function syncAll(){
    ensureTimerChoice();
    syncLobbyCopy();
    syncTimerPresentation();
    syncRulesText();
  }

  function bootstrap(){
    syncAll();
    observer=new MutationObserver(()=>queueMicrotask(syncAll));
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  else bootstrap();

  window.OrtenStreetDuelTimerOptions={
    options:[...OPTIONS],
    get seconds(){return selectedSeconds;},
    setSeconds:save
  };
})();
