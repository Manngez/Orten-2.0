'use strict';
(() => {
  const files=['app-core.js','app-setup.js','app-map.js','app-search.js','app-ui.js'];
  const load=i=>{
    if(i>=files.length)return;
    const s=document.createElement('script');
    s.src=files[i]; s.async=false;
    s.onload=()=>load(i+1);
    s.onerror=()=>console.error(`Kunde inte ladda ${files[i]}`);
    document.head.appendChild(s);
  };
  load(0);
})();
