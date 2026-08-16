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

  const files=['app-core.js','app-setup.js','game-geometry.js','app-map.js','map-themes.js','app-search.js','app-ui.js','app-online.js','app-online-entry.js'];
  const load=i=>{
    if(i>=files.length)return;
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
