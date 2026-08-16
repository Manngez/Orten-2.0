'use strict';
(() => {
  const currentSrc=document.currentScript?.src || '';
  let BUILD='dev';
  try{BUILD=new URL(currentSrc,location.href).searchParams.get('v') || 'dev';}catch{}

  const NativeWorker=window.Worker;
  if(NativeWorker){
    const VersionedWorker=function(url,options){
      const raw=String(url);
      const versioned=raw.includes('place-worker.js') ? `${raw}${raw.includes('?')?'&':'?'}v=${encodeURIComponent(BUILD)}` : url;
      return new NativeWorker(versioned,options);
    };
    VersionedWorker.prototype=NativeWorker.prototype;
    Object.setPrototypeOf(VersionedWorker,NativeWorker);
    window.Worker=VersionedWorker;
  }

  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
    window.addEventListener('load',()=>{
      try{
        const swUrl=new URL('./service-worker.js',currentSrc || location.href);
        swUrl.searchParams.set('v',BUILD);
        navigator.serviceWorker.register(swUrl.href,{scope:'./'}).catch(err=>console.warn('Service Worker kunde inte registreras.',err));
      }catch(err){console.warn('Service Worker kunde inte förberedas.',err)}
    },{once:true});
  }

  const applyPermanentTextOverrides=()=>{
    const themeHelp=document.getElementById('themeGrid')?.closest('.field-card')?.querySelector(':scope > small');
    if(themeHelp) themeHelp.textContent='';
    const localPlayHelp=document.querySelector('#chooseLocalPlay > small');
    if(localPlayHelp) localPlayHelp.textContent='Turas om på samma mobil, surfplatta eller dator.';
  };

  const schedulePermanentTextOverrides=()=>{
    applyPermanentTextOverrides();
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(applyPermanentTextOverrides),{once:true});
    }else{
      requestAnimationFrame(applyPermanentTextOverrides);
    }
  };

  const files=['app-core.js','app-setup.js','game-geometry.js','duel-routes.js','highscore.js','supabase-highscore.js','app-map.js','map-themes.js','app-search.js','app-ui.js','app-highscore-ui.js','app-online.js','app-online-entry.js'];
  try{
    const params=new URL(location.href).searchParams;
    if(params.get('verktyg')==='1'||params.get('toolbox')==='1')files.push('app-toolbox.js','app-toolbox-selection-guard.js','app-toolbox-mobile.js');
  }catch{}
  const load=i=>{
    if(i>=files.length){
      schedulePermanentTextOverrides();
      return;
    }
    const s=document.createElement('script');
    s.src=`${files[i]}?v=${encodeURIComponent(BUILD)}`; s.async=false;
    s.onload=()=>load(i+1);
    s.onerror=()=>{
      console.error(`Kunde inte ladda ${files[i]}`);
      const banner=document.createElement('div');
      banner.setAttribute('role','alert');
      banner.style.cssText='position:fixed;inset:auto 12px 12px;z-index:99999;padding:14px 16px;border-radius:12px;background:#5c1820;color:#fff;font:700 14px/1.4 system-ui;text-align:center';
      banner.textContent='Orten 2.0 kunde inte starta korrekt. Ladda om sidan och försök igen.';
      document.body.appendChild(banner);
    };
    document.head.appendChild(s);
  };
  load(0);
})();
