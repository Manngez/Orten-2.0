'use strict';
(() => {
  const currentSrc=document.currentScript?.src || '';
  let BUILD='dev';
  try{BUILD=new URL(currentSrc,location.href).searchParams.get('v') || 'dev';}catch{}

  const installSupabaseReliability=()=>{
    if(window.__ortenSupabaseReliabilityInstalled)return;
    window.__ortenSupabaseReliabilityInstalled=true;
    const projectHost='mewauzsogkbcchnvsath.supabase.co';
    const nativeFetch=typeof window.fetch==='function'?window.fetch.bind(window):null;

    if(nativeFetch){
      window.fetch=(input,init)=>{
        let url='';
        try{url=typeof input==='string'?input:(input?.url||String(input||''))}catch{}
        if(!url.includes(projectHost))return nativeFetch(input,init);

        const controller=new AbortController();
        let sourceSignal=null;
        try{sourceSignal=init?.signal||((typeof Request!=='undefined'&&input instanceof Request)?input.signal:null)}catch{}
        const relayAbort=()=>{try{controller.abort(sourceSignal?.reason)}catch{try{controller.abort()}catch{}}};
        if(sourceSignal){
          if(sourceSignal.aborted)relayAbort();
          else sourceSignal.addEventListener('abort',relayAbort,{once:true});
        }
        const timer=setTimeout(()=>{try{controller.abort(new Error('Supabase-anropet tog för lång tid.'))}catch{try{controller.abort()}catch{}}},15000);
        const nextInit={...(init||{}),signal:controller.signal};
        return nativeFetch(input,nextInit).finally(()=>{
          clearTimeout(timer);
          try{sourceSignal?.removeEventListener('abort',relayAbort)}catch{}
        });
      };
    }

    const watchSdkScript=script=>{
      if(!script||script.dataset?.ortenSupabaseWatchdog==='1')return;
      script.dataset.ortenSupabaseWatchdog='1';
      let settled=false;
      const finish=()=>{settled=true;clearTimeout(timer)};
      const timer=setTimeout(()=>{
        if(settled||window.supabase?.createClient)return;
        try{script.dispatchEvent(new Event('error'))}catch{}
        setTimeout(()=>{try{if(!window.supabase?.createClient)script.remove()}catch{}},0);
      },12000);
      script.addEventListener('load',finish,{once:true});
      script.addEventListener('error',finish,{once:true});
    };

    document.querySelectorAll('script[data-orten-supabase-sdk]').forEach(watchSdkScript);
    new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(node?.nodeType!==1)continue;
          if(node.matches?.('script[data-orten-supabase-sdk]'))watchSdkScript(node);
          node.querySelectorAll?.('script[data-orten-supabase-sdk]').forEach(watchSdkScript);
        }
      }
    }).observe(document.documentElement,{childList:true,subtree:true});

    const recoverStuckHistoryLoader=()=>{
      const body=document.getElementById('privateHistoryBody');
      const loading=body?.querySelector?.('.private-history-loading');
      if(!body||!loading){if(body)delete body.dataset.ortenHistoryLoadingSince;return}
      const now=Date.now();
      let started=Number(body.dataset.ortenHistoryLoadingSince)||0;
      if(!started){started=now;body.dataset.ortenHistoryLoadingSince=String(now);return}
      if(now-started<22000)return;
      body.dataset.ortenHistoryLoadingSince=String(now+3600000);
      body.innerHTML='<span class="step-kicker">🔐 PRIVAT ADMINVY</span><h2>Spelomgångar · senaste 48 h</h2><div class="private-history-empty"><strong>Hämtningen tog för lång tid.</strong><br>Anslutningen har avbrutits så att adminvyn inte fastnar. Försök igen.</div><div class="private-history-toolbar"><button id="privateHistoryStuckRetry" class="ghost-button" type="button">↻ Försök igen</button></div>';
      document.getElementById('privateHistoryStuckRetry')?.addEventListener('click',()=>{
        delete body.dataset.ortenHistoryLoadingSince;
        const sdk=document.querySelector('script[data-orten-supabase-sdk]');
        if(sdk&&!window.supabase?.createClient){try{sdk.dispatchEvent(new Event('error'));sdk.remove()}catch{}}
        const modal=document.getElementById('privateHistoryModal');
        if(modal)modal.classList.add('hidden');
        setTimeout(()=>document.getElementById('privateHistoryButton')?.click(),80);
      });
    };
    setInterval(recoverStuckHistoryLoader,500);
  };
  installSupabaseReliability();

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

  const REQUIRED_NAME_INPUTS='#playerInputs input,#onlineHostName,#onlineGuestName,#streetDuelName0,#streetDuelName1';
  const normalizePlayerName=value=>String(value||'').trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/\s+/g,' ');
  const placeholderPlayerName=value=>/^(?:spelare(?:\s*(?:\d+|ett|tva|tre|fyra|fem|sex))?|player(?:\s*(?:\d+|one|two|three|four|five|six))?|spelledare|host|guest)$/i.test(normalizePlayerName(value));
  const profanityKey=value=>normalizePlayerName(value)
    .replace(/[@4]/g,'a').replace(/[3]/g,'e').replace(/[1!|]/g,'i').replace(/[0]/g,'o').replace(/[5$]/g,'s').replace(/[7+]/g,'t')
    .replace(/[^a-z0-9]+/g,'');
  const profanityToken=value=>normalizePlayerName(value)
    .replace(/[@4]/g,'a').replace(/[3]/g,'e').replace(/[1!|]/g,'i').replace(/[0]/g,'o').replace(/[5$]/g,'s').replace(/[7+]/g,'t')
    .replace(/[^a-z0-9]+/g,' ');
  const PROFANITY_PATTERNS=[
    /^fuck(?:er|ers|ing|ed|face|head|boy|girl|you|off)?$/,
    /^shit(?:head|heads|ty|face)?$/,
    /^cunt(?:s|face)?$/,
    /^pussy(?:s)?$/,
    /^asshole(?:s)?$/,
    /^motherfuck(?:er|ers|ing)?$/,
    /^kuk(?:en|ar|arna|huvud|huvudet|sugare|sugaren)?$/,
    /^fitt(?:a|an|or|orna|huvud|huvudet)?$/,
    /^knull(?:a|ar|ade|at|are|aren|ig|igt)?$/,
    /^hor(?:a|an|or|orna|unge|ungen|ungar)?$/,
    /^rovhal(?:et|en)?$/,
    /^runk(?:a|ar|ade|at|are|aren)?$/,
    /^sugmin(?:kuk|fitta)$/,
    /^fuck(?:you|off)$/
  ];
  const obscenePlayerName=value=>{
    const compact=profanityKey(value);
    if(!compact)return false;
    const tokens=profanityToken(value).split(/\s+/).filter(Boolean);
    return PROFANITY_PATTERNS.some(pattern=>pattern.test(compact)||tokens.some(token=>pattern.test(token)));
  };
  const playerNameStatus=value=>{
    if(!String(value||'').trim())return 'missing';
    if(placeholderPlayerName(value))return 'placeholder';
    if(obscenePlayerName(value))return 'obscene';
    return 'ok';
  };
  const validPlayerName=value=>playerNameStatus(value)==='ok';
  const cleanPlayerName=value=>String(value||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
  const playerNameMessage=(value,many=false)=>{
    if(playerNameStatus(value)==='obscene')return 'Välj ett annat namn – det innehåller ett ord som inte är tillåtet.';
    return many?'Alla spelare måste skriva sitt namn.':'Du måste skriva ditt namn.';
  };

  const installRequiredNames=()=>{
    if(document.documentElement.dataset.ortenRequiredNames==='1')return;
    document.documentElement.dataset.ortenRequiredNames='1';

    const style=document.createElement('style');
    style.textContent=`${REQUIRED_NAME_INPUTS}{transition:border-color .16s,box-shadow .16s}${REQUIRED_NAME_INPUTS}.name-required-field{border-color:#ff8f70!important;box-shadow:0 0 0 3px rgba(255,143,112,.12)!important}`;
    document.head.appendChild(style);

    try{
      const stored=localStorage.getItem('orten2:online-name');
      if(stored&&!validPlayerName(stored))localStorage.removeItem('orten2:online-name');
    }catch{}
    try{
      if(typeof settings!=='undefined'&&Array.isArray(settings.playerNames))settings.playerNames=settings.playerNames.map(name=>validPlayerName(name)?name:'');
    }catch{}

    const clearGenericInputs=()=>{
      document.querySelectorAll(REQUIRED_NAME_INPUTS).forEach(input=>{
        input.placeholder='Skriv ditt namn';
        input.autocomplete='name';
        if(placeholderPlayerName(input.value))input.value='';
      });
    };
    const clearInvalid=input=>{input?.classList.remove('name-required-field');input?.removeAttribute('aria-invalid')};
    const markInvalid=(input,message)=>{
      if(input){input.classList.add('name-required-field');input.setAttribute('aria-invalid','true');input.focus();try{input.scrollIntoView({behavior:'smooth',block:'center'})}catch{}}
      try{if(typeof toast==='function')toast(message,'error',3600)}catch{}
    };
    const stop=event=>{event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()};

    document.addEventListener('input',event=>{
      if(event.target?.matches?.(REQUIRED_NAME_INPUTS))clearInvalid(event.target);
    },true);

    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('button');if(!button)return;

      if(button.id==='startButton'){
        if(document.getElementById('setupScreen')?.classList.contains('online-host-mode'))return;
        const inputs=[...document.querySelectorAll('#playerInputs input')];
        let count=inputs.length;
        try{if(typeof settings!=='undefined')count=Math.max(1,Number(settings.playerCount)||inputs.length)}catch{}
        const active=inputs.slice(0,count);
        const invalid=active.find(input=>!validPlayerName(input.value));
        if(invalid){stop(event);markInvalid(invalid,playerNameMessage(invalid.value,true));return}
        active.forEach((input,index)=>{
          const name=cleanPlayerName(input.value);input.value=name;clearInvalid(input);
          try{if(typeof settings!=='undefined')settings.playerNames[index]=name}catch{}
        });
        return;
      }

      if(button.id==='onlineCreateButton'||button.id==='onlineJoinButton'){
        const input=document.getElementById(button.id==='onlineCreateButton'?'onlineHostName':'onlineGuestName');
        if(!input||!validPlayerName(input.value)){
          stop(event);const message=playerNameMessage(input?.value,false);markInvalid(input,message);
          const error=document.getElementById('onlineMenuError');
          if(error){error.textContent=message;error.classList.remove('hidden')}
          return;
        }
        input.value=cleanPlayerName(input.value);clearInvalid(input);return;
      }

      if(button.id==='streetDuelStart'){
        const inputs=[document.getElementById('streetDuelName0'),document.getElementById('streetDuelName1')].filter(Boolean);
        const invalid=inputs.find(input=>!validPlayerName(input.value));
        if(invalid){
          stop(event);const message=playerNameStatus(invalid.value)==='obscene'?playerNameMessage(invalid.value,true):'Båda spelarna måste skriva sitt namn.';markInvalid(invalid,message);
          const info=document.getElementById('streetDuelLoad');
          if(info){info.textContent=message;info.style.color='#ffb8aa'}
          return;
        }
        inputs.forEach(input=>{input.value=cleanPlayerName(input.value);clearInvalid(input)});
      }
    },true);

    const observe=()=>{
      clearGenericInputs();
      if(!document.body)return;
      new MutationObserver(clearGenericInputs).observe(document.body,{childList:true,subtree:true});
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
    clearGenericInputs();
  };

  const schedulePermanentTextOverrides=()=>{
    applyPermanentTextOverrides();
    installRequiredNames();
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(()=>{applyPermanentTextOverrides();installRequiredNames()}),{once:true});
    }else{
      requestAnimationFrame(()=>{applyPermanentTextOverrides();installRequiredNames()});
    }
  };

  const files=['app-core.js','app-setup.js','game-geometry.js','duel-routes.js','street-duel-engine.js','highscore.js','supabase-highscore.js','private-history-core.js','app-map.js','map-themes.js','app-search.js','app-ui.js','app-highscore-ui.js','app-highscore-preview.js','app-highscore-browser.js','app-online.js','app-online-entry.js','app-street-duel.js','app-street-duel-timer-options.js','street-duel-difficulty.js','app-private-history.js','app-private-history-recovery.js'];
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