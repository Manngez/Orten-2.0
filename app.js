'use strict';
(() => {
  const BUILD='20260814-3';
  const NativeWorker=window.Worker;
  if(NativeWorker){
    const VersionedWorker=function(url,options){
      const raw=String(url);
      const versioned=raw.includes('place-worker.js') ? `${raw}${raw.includes('?')?'&':'?'}v=${BUILD}` : url;
      return new NativeWorker(versioned,options);
    };
    VersionedWorker.prototype=NativeWorker.prototype;
    Object.setPrototypeOf(VersionedWorker,NativeWorker);
    window.Worker=VersionedWorker;
  }

  const files=['app-core.js','app-setup.js','app-map.js','app-search.js','app-ui.js'];
  const load=i=>{
    if(i>=files.length)return;
    const s=document.createElement('script');
    s.src=`${files[i]}?v=${BUILD}`; s.async=false;
    s.onload=()=>load(i+1);
    s.onerror=()=>console.error(`Kunde inte ladda ${files[i]}`);
    document.head.appendChild(s);
  };
  load(0);
})();
