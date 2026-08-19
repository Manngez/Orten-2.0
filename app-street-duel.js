'use strict';

(() => {
  const ENGINE=window.OrtenStreetDuel;
  if(!ENGINE) throw new Error('Gatduellmotorn saknas.');

  const DATA_URLS=[
    'https://opendataumea.opendatasoft.com/api/explore/v2.1/catalog/datasets/roads_umea/exports/geojson?timezone=Europe%2FStockholm&use_labels=false&epsg=4326',
    'https://opendata.umea.se/api/explore/v2.1/catalog/datasets/roads_umea/exports/geojson?timezone=Europe%2FStockholm&use_labels=false&epsg=4326'
  ];
  const ROUND_TARGET=3;
  const TURN_SECONDS=20;
  const CENTER=[63.8258,20.2630];
  const PEERJS_URL='https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
  const STREET_ROOM_RE=/^U[A-Z0-9]{5}$/;

  let graph=null;
  let graphPromise=null;
  let streetMap=null;
  let streetLayer=null;
  let timer=null;
  let timerRemaining=TURN_SECONDS;
  let state=null;
  let lastResult=null;
  let lastNetworkSecond=null;

  const net={
    role:'offline',code:'',status:'idle',peer:null,conn:null,guestConn:null,
    hostName:'',guestName:'',guestId:'',guestConnected:false,guestReady:false,
    started:false,lastError:'',peerLoadPromise:null,reconnectTimer:null,reconnectAttempts:0
  };

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const safeCode=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  const isStreetCode=value=>STREET_ROOM_RE.test(safeCode(value));
  const isOnline=()=>net.role!=='offline';
  const localPlayerIndex=()=>net.role==='host'?0:net.role==='guest'?1:null;

  function randomCore(){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out='';for(let i=0;i<5;i++)out+=chars[Math.floor(Math.random()*chars.length)];
    return out;
  }
  function streetRoomCode(seed=''){
    let value=safeCode(seed);
    if(value.startsWith('U'))value=value.slice(1);
    value=value.slice(0,5);
    return `U${value.length===5?value:randomCore()}`;
  }
  function streetPeerId(code){return `orten2-street-${safeCode(code).toLowerCase()}`;}
  function guestPlayerId(code){
    const key=`orten2:street-online-player:${safeCode(code)}`;
    try{
      let id=localStorage.getItem(key);
      if(!id){id=`sg-${crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}`;localStorage.setItem(key,id);}
      return id;
    }catch{return `sg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
  }
  function storageName(){try{return localStorage.getItem('orten2:online-name')||'';}catch{return '';}}
  function saveName(name){try{localStorage.setItem('orten2:online-name',String(name||'').trim());}catch{}}
  function networkStatusText(){return {idle:'Inte ansluten',connecting:'Ansluter…',connected:'Ansluten',reconnecting:'Återansluter…',error:'Anslutningsfel'}[net.status]||net.status;}
  function currentNetSettings(){
    return {timer:Number(window.OrtenStreetDuelTimerOptions?.seconds ?? TURN_SECONDS),difficulty:String(window.OrtenStreetDuelDifficultyOptions?.key || 'hard')};
  }
  function applyNetSettings(meta={}){
    const timerValue=Number(meta.timer);
    if(window.OrtenStreetDuelTimerOptions?.options?.includes(timerValue))window.OrtenStreetDuelTimerOptions.setSeconds(timerValue);
    if(meta.difficulty&&window.OrtenStreetDuelDifficultyOptions?.levels?.[meta.difficulty])window.OrtenStreetDuelDifficultyOptions.setLevel(meta.difficulty);
  }

  function injectStyles(){
    if($('streetDuelStyles')) return;
    const style=document.createElement('style');
    style.id='streetDuelStyles';
    style.textContent=`
      #streetDuelMode{border-color:rgba(255,216,106,.24);background:linear-gradient(145deg,rgba(49,42,18,.78),rgba(7,19,31,.96))}
      #streetDuelMode .mode-icon{filter:drop-shadow(0 0 16px rgba(255,216,106,.24))}
      .street-duel-screen{min-height:100dvh;background:radial-gradient(circle at 15% 12%,rgba(255,216,106,.08),transparent 30%),#06111d;color:#eefaff}
      .street-duel-top{height:64px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:8px 14px;border-bottom:1px solid rgba(132,181,201,.16);background:rgba(5,15,25,.94);position:relative;z-index:510}
      .street-duel-top button{width:42px;height:42px;border-radius:13px;border:1px solid rgba(132,181,201,.22);background:#0b1c2a;color:#fff;font-size:20px}
      .street-duel-brand{text-align:center}.street-duel-brand strong{display:block;font-size:14px;letter-spacing:.08em}.street-duel-brand small{display:block;color:#7f9ba8;font-size:10px;margin-top:2px}
      .street-duel-source{font-size:10px;color:#8da6b2;white-space:nowrap}
      .street-duel-shell{display:grid;grid-template-columns:minmax(245px,310px) 1fr minmax(280px,360px);min-height:calc(100dvh - 64px)}
      .street-duel-side{padding:18px;border-right:1px solid rgba(132,181,201,.14);background:rgba(5,15,25,.9);overflow:auto}
      .street-duel-side.right{border-right:0;border-left:1px solid rgba(132,181,201,.14)}
      .street-duel-player{border:1px solid rgba(132,181,201,.15);border-radius:16px;padding:13px;margin-bottom:10px;background:rgba(255,255,255,.025);transition:.18s}.street-duel-player.active{border-color:var(--p);box-shadow:0 0 0 1px color-mix(in srgb,var(--p) 25%,transparent),0 0 28px color-mix(in srgb,var(--p) 10%,transparent)}
      .street-duel-player span{font-size:10px;color:#8099a6;text-transform:uppercase;letter-spacing:.08em}.street-duel-player strong{display:block;font-size:17px;margin-top:3px}.street-duel-player b{float:right;font-size:24px;color:var(--p)}
      .street-duel-round{margin:18px 0 8px;color:#8ba5b2;font-size:11px;font-weight:800;letter-spacing:.08em}
      .street-duel-current{border:1px solid rgba(104,246,255,.24);border-radius:19px;padding:16px;background:linear-gradient(145deg,rgba(104,246,255,.08),rgba(255,255,255,.018));margin-bottom:13px}.street-duel-current small{display:block;color:#8ca8b5;font-size:10px;letter-spacing:.08em}.street-duel-current strong{display:block;font-size:25px;line-height:1.08;margin-top:7px;color:#dffcff;overflow-wrap:anywhere}
      .street-duel-timer{height:9px;border-radius:999px;background:#102330;overflow:hidden;margin-top:13px}.street-duel-timer i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#68f6ff,#ffd86a);transition:width .2s linear}.street-duel-timer-text{text-align:right;font-size:11px;color:#9db2bd;margin-top:4px}
      .street-duel-chain{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.street-duel-chain span{font-size:10px;padding:7px 9px;border-radius:999px;background:#0b1e2c;border:1px solid rgba(132,181,201,.14);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .street-duel-map-wrap{position:relative;min-height:480px;background:#0a1720}.street-duel-map{position:absolute;inset:0}.street-duel-map:after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 100px rgba(3,12,20,.42);z-index:400}
      .street-duel-map-note{position:absolute;left:12px;bottom:12px;z-index:450;padding:8px 10px;border-radius:10px;background:rgba(5,15,25,.82);backdrop-filter:blur(8px);font-size:10px;color:#a8c0ca;border:1px solid rgba(132,181,201,.15)}
      .street-duel-prompt{font-size:12px;color:#9bb2bc;line-height:1.45;margin-bottom:13px}.street-duel-search{position:relative}.street-duel-search input{width:100%;height:52px;border:1px solid rgba(104,246,255,.24);border-radius:15px;background:#091b29;color:#fff;padding:0 13px;font-size:16px;outline:none}.street-duel-search input:focus{border-color:#68f6ff;box-shadow:0 0 0 3px rgba(104,246,255,.08)}
      .street-duel-submit{width:100%;height:46px;margin-top:9px;border:0;border-radius:14px;background:linear-gradient(135deg,#68f6ff,#64d6e8);color:#041018;font-weight:950;font-size:14px}.street-duel-submit:disabled{opacity:.4}
      .street-duel-suggestions{display:grid;gap:5px;margin-top:7px}.street-duel-suggestions button{border:1px solid rgba(132,181,201,.14);border-radius:11px;background:#0a1b28;color:#dff4fb;padding:9px 10px;text-align:left;font:inherit;font-size:12px}.street-duel-suggestions button:hover{border-color:#68f6ff}
      .street-duel-message{min-height:44px;margin-top:11px;border-radius:12px;padding:10px 11px;background:rgba(255,255,255,.025);color:#9db3bd;font-size:11px;line-height:1.45}.street-duel-message.good{color:#aaf4c5;border:1px solid rgba(115,245,167,.18)}.street-duel-message.bad{color:#ffc1b5;border:1px solid rgba(255,143,112,.2)}
      .street-duel-rules{margin-top:18px;padding-top:14px;border-top:1px solid rgba(132,181,201,.12);font-size:10px;line-height:1.5;color:#7f99a5}.street-duel-rules strong{display:block;color:#bed3dc;margin-bottom:4px}
      .street-duel-overlay{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;padding:16px;background:rgba(2,9,15,.78);backdrop-filter:blur(12px)}.street-duel-overlay.hidden{display:none}.street-duel-card{width:min(520px,100%);border:1px solid rgba(132,181,201,.2);border-radius:24px;padding:23px;background:linear-gradient(160deg,#0d2535,#07131f);box-shadow:0 28px 90px rgba(0,0,0,.48)}.street-duel-card .eyebrow{font-size:10px;color:#ffd86a;letter-spacing:.12em;font-weight:900}.street-duel-card h2{font-size:30px;margin:7px 0 8px}.street-duel-card p{font-size:12px;color:#91aab6;line-height:1.55}.street-duel-names{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:16px 0}.street-duel-names input{height:46px;border-radius:13px;border:1px solid rgba(132,181,201,.2);background:#081a27;color:#fff;padding:0 12px;font-size:14px}.street-duel-big-button{width:100%;height:50px;border:0;border-radius:15px;background:linear-gradient(135deg,#ffd86a,#ffb967);color:#1c1202;font-weight:950;font-size:14px}.street-duel-big-button:disabled{opacity:.45}.street-duel-load{font-size:11px;color:#8fa8b3;margin-top:9px;text-align:center}.street-duel-result-score{display:flex;gap:12px;justify-content:center;margin:18px 0}.street-duel-result-score span{font-size:32px;font-weight:950}
      .street-online-settings{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}.street-online-settings label{display:grid;gap:5px;font-size:10px;font-weight:850;color:#9db4be}.street-online-settings select{height:42px;border:1px solid rgba(132,181,201,.2);border-radius:11px;background:#081a27;color:#fff;padding:0 9px}
      @media(max-width:900px){.street-duel-shell{grid-template-columns:1fr}.street-duel-side{border:0;padding:12px}.street-duel-side.left{display:grid;grid-template-columns:1fr 1fr;gap:8px}.street-duel-side.left .street-duel-round,.street-duel-side.left .street-duel-current,.street-duel-side.left .street-duel-chain{grid-column:1/-1}.street-duel-map-wrap{min-height:43dvh}.street-duel-side.right{border:0}.street-duel-source{display:none}}
      @media(max-width:520px){.street-duel-top{height:58px}.street-duel-shell{min-height:calc(100dvh - 58px)}.street-duel-side.left{padding:9px}.street-duel-player{padding:9px;margin:0}.street-duel-current{padding:12px;margin:2px 0}.street-duel-current strong{font-size:20px}.street-duel-map-wrap{min-height:35dvh}.street-duel-side.right{padding:11px 12px 18px}.street-duel-names,.street-online-settings{grid-template-columns:1fr}.street-duel-card{padding:19px}.street-duel-card h2{font-size:26px}}
    `;
    document.head.appendChild(style);
  }

  function ensureModeButton(){
    const grid=$('modeGrid');
    if(!grid||$('streetDuelMode')) return;
    const button=document.createElement('button');
    button.id='streetDuelMode';button.type='button';button.className='mode-card';
    button.innerHTML='<span class="mode-icon">🏙️</span><strong>Gatduell Umeå</strong><small>Svara med en gata som korsar den aktuella.</small>';
    button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      if($('setupScreen')?.classList.contains('online-host-mode')){
        const hiddenName=$('onlineHostName')?.value?.trim()||storageName();
        const seed=$('onlineCreateCode')?.value||'';
        createStreetRoom(hiddenName,streetRoomCode(seed));
        return;
      }
      open();
    });
    grid.appendChild(button);
  }

  function ensureScreen(){
    if($('streetDuelScreen')) return;
    const screen=document.createElement('main');
    screen.id='streetDuelScreen';screen.className='screen street-duel-screen';
    screen.innerHTML=`
      <header class="street-duel-top">
        <button id="streetDuelBack" type="button" aria-label="Tillbaka">←</button>
        <div class="street-duel-brand"><strong>🏙️ GATDUELL · UMEÅ</strong><small>Vilken gata korsar?</small></div>
        <span class="street-duel-source">Gatudata · Umeå Open Data / NVDB</span>
      </header>
      <section class="street-duel-shell">
        <aside class="street-duel-side left">
          <div id="streetDuelP0" class="street-duel-player" style="--p:#68f6ff"><b>0</b><span>Spelare 1</span><strong>Spelare 1</strong></div>
          <div id="streetDuelP1" class="street-duel-player" style="--p:#ff8f70"><b>0</b><span>Spelare 2</span><strong>Spelare 2</strong></div>
          <div id="streetDuelRound" class="street-duel-round">RUNDA 1 · BÄST AV 5</div>
          <div class="street-duel-current"><small>AKTUELL GATA</small><strong id="streetDuelCurrent">–</strong><div class="street-duel-timer"><i id="streetDuelTimerBar"></i></div><div id="streetDuelTimerText" class="street-duel-timer-text">20 sek</div></div>
          <div id="streetDuelChain" class="street-duel-chain"></div>
        </aside>
        <section class="street-duel-map-wrap"><div id="streetDuelMap" class="street-duel-map"></div><div class="street-duel-map-note">Karta utan gatunamn · aktuell gata markeras</div></section>
        <aside class="street-duel-side right">
          <div id="streetDuelPrompt" class="street-duel-prompt">Laddar gatnätet…</div>
          <form id="streetDuelForm" autocomplete="off">
            <div class="street-duel-search"><input id="streetDuelInput" type="text" inputmode="search" maxlength="80" placeholder="Skriv en gata i Umeå" aria-label="Gata" /></div>
            <div id="streetDuelSuggestions" class="street-duel-suggestions"></div>
            <button id="streetDuelSubmit" class="street-duel-submit" type="submit">Spela gatan</button>
          </form>
          <div id="streetDuelMessage" class="street-duel-message">Skriv en gata som korsar den aktuella gatan.</div>
          <div class="street-duel-rules"><strong>Så avgörs rundan</strong>Fel korsning, återanvänd gata eller slut på tiden förlorar rundan. Gatan måste finnas i Umeås gatnät. Först till tre rundvinster vinner matchen.</div>
        </aside>
      </section>`;
    document.body.insertBefore(screen,$('placeModal')||document.body.lastChild);

    const overlay=document.createElement('div');
    overlay.id='streetDuelOverlay';overlay.className='street-duel-overlay hidden';
    overlay.innerHTML='<div id="streetDuelOverlayCard" class="street-duel-card"></div>';
    document.body.appendChild(overlay);

    $('streetDuelBack').addEventListener('click',close);
    $('streetDuelForm').addEventListener('submit',submitMove);
    $('streetDuelInput').addEventListener('input',renderSuggestions);
  }

  function showOnly(name){document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));$(`${name}Screen`)?.classList.add('active');}

  async function fetchStreetData(){
    let lastError=null;
    for(const url of DATA_URLS){
      try{
        const response=await fetch(url,{headers:{Accept:'application/geo+json,application/json'},cache:'force-cache'});
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const data=await response.json();
        const features=Array.isArray(data?.features)?data.features:Array.isArray(data?.results)?data.results:[];
        if(features.length<100) throw new Error('För få vägsegment i svaret.');
        return features;
      }catch(error){lastError=error;}
    }
    throw lastError||new Error('Gatudata kunde inte hämtas.');
  }

  function loadGraph(){
    if(graph) return Promise.resolve(graph);
    if(graphPromise) return graphPromise;
    graphPromise=fetchStreetData().then(features=>{const built=ENGINE.buildGraph(features,{toleranceMeters:8});if(built.size<80) throw new Error(`Gatunätet blev för litet (${built.size} gator).`);graph=built;return graph;}).catch(error=>{graphPromise=null;throw error;});
    return graphPromise;
  }

  function ensureMap(){
    if(streetMap) return;
    streetMap=L.map('streetDuelMap',{zoomControl:false,minZoom:10,maxZoom:18,zoomSnap:.25,preferCanvas:true}).setView(CENTER,12.3);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(streetMap);
    streetLayer=L.layerGroup().addTo(streetMap);L.control.zoom({position:'topright'}).addTo(streetMap);
  }

  function linesFor(name){return graph?.get(name)?.lines||[];}
  function renderMap(previous=null){
    if(!streetMap||!streetLayer||!state?.current) return;
    streetLayer.clearLayers();const bounds=[];
    if(previous){for(const line of linesFor(previous)){const pts=line.map(([lon,lat])=>[lat,lon]);bounds.push(...pts);L.polyline(pts,{color:'#ff8f70',weight:5,opacity:.58,interactive:false}).addTo(streetLayer);}}
    for(const line of linesFor(state.current)){const pts=line.map(([lon,lat])=>[lat,lon]);bounds.push(...pts);L.polyline(pts,{color:'#68f6ff',weight:7,opacity:.92,interactive:false}).addTo(streetLayer);}
    if(bounds.length) streetMap.fitBounds(L.latLngBounds(bounds),{padding:[38,38],maxZoom:15,animate:true,duration:.45});
  }

  function playerName(index){return state?.players?.[index]?.name||`Spelare ${index+1}`;}
  function setMessage(text,kind=''){const el=$('streetDuelMessage');if(!el)return;el.textContent=text;el.className=`street-duel-message${kind?` ${kind}`:''}`;}
  function canLocalMove(){
    if(!state||state.roundOver)return false;
    if(!isOnline())return true;
    const index=localPlayerIndex();if(index===null||state.active!==index)return false;
    if(net.role==='guest')return net.status==='connected'&&!!net.conn?.open;
    return net.role==='host'&&net.guestConnected;
  }

  function updateUI(){
    if(!state) return;
    for(let i=0;i<2;i++){const el=$(`streetDuelP${i}`);if(!el)continue;el.classList.toggle('active',!state.roundOver&&state.active===i);el.querySelector('span').textContent=`Spelare ${i+1}`;el.querySelector('strong').textContent=playerName(i);el.querySelector('b').textContent=state.scores[i];}
    $('streetDuelRound').textContent=`RUNDA ${state.round} · FÖRST TILL ${ROUND_TARGET}`;$('streetDuelCurrent').textContent=state.current||'–';$('streetDuelChain').innerHTML=state.used.map((name,index)=>`<span>${index+1}. ${esc(name)}</span>`).join('');
    const mine=canLocalMove();
    if(state.roundOver)$('streetDuelPrompt').textContent='Rundan är avgjord.';else if(isOnline()&&!mine)$('streetDuelPrompt').innerHTML=`Väntar på <strong>${esc(playerName(state.active))}</strong>.`;else $('streetDuelPrompt').innerHTML=`<strong>${esc(playerName(state.active))}</strong>, skriv en gata som korsar <strong>${esc(state.current)}</strong>.`;
    $('streetDuelInput').disabled=state.roundOver||(isOnline()&&!mine);$('streetDuelSubmit').disabled=state.roundOver||(isOnline()&&!mine);
    const small=document.querySelector('.street-duel-brand small');if(small)small.textContent=isOnline()?`Online · ${net.code}`:'Vilken gata korsar?';
  }

  function stopTimer(){clearInterval(timer);timer=null;}
  function resetTimer(){
    stopTimer();timerRemaining=TURN_SECONDS;lastNetworkSecond=null;renderTimer();if(!state||state.roundOver||net.role==='guest')return;
    timer=setInterval(()=>{timerRemaining-=.2;renderTimer();if(net.role==='host'&&net.started){const second=Math.ceil(Math.max(0,timerRemaining));if(second!==lastNetworkSecond){lastNetworkSecond=second;broadcastGameState();}}if(timerRemaining<=0){stopTimer();loseRound(state.active,'Tiden tog slut.');}},200);
  }
  function renderTimer(){const pct=Math.max(0,Math.min(100,timerRemaining/TURN_SECONDS*100));if($('streetDuelTimerBar')) $('streetDuelTimerBar').style.width=`${pct}%`;if($('streetDuelTimerText')) $('streetDuelTimerText').textContent=`${Math.ceil(Math.max(0,timerRemaining))} sek`;}

  function freshState(names){return {players:[{name:names[0]||'Spelare 1'},{name:names[1]||'Spelare 2'}],scores:[0,0],round:1,active:0,current:null,previous:null,used:[],roundOver:false,matchOver:false};}
  function startMatch(names){state=freshState(names);lastResult=null;hideOverlay();startRound();}
  function startRound(){
    state.roundOver=false;state.matchOver=false;lastResult=null;state.active=(state.round-1)%2;state.current=ENGINE.chooseStart(graph);state.previous=null;state.used=[state.current];$('streetDuelInput').value='';$('streetDuelSuggestions').innerHTML='';setMessage('Skriv en gata som korsar den aktuella gatan.');updateUI();renderMap();resetTimer();if(net.role==='host'&&net.started)broadcastGameState();if(canLocalMove())setTimeout(()=>$('streetDuelInput')?.focus(),100);
  }

  function submitMove(event){
    event.preventDefault();if(!state||state.roundOver||!graph) return;
    if(isOnline()){
      if(!canLocalMove()){setMessage(`Väntar på ${playerName(state.active)}.`);return;}
      const raw=$('streetDuelInput').value;
      if(net.role==='guest'){if(!raw.trim())return;net.conn?.send({type:'MOVE',name:raw});setMessage('Skickar gatan till spelledaren…');$('streetDuelInput').disabled=true;$('streetDuelSubmit').disabled=true;return;}
      applyMove(raw,0);return;
    }
    applyMove($('streetDuelInput').value,state.active);
  }

  function applyMove(raw,actorIndex){
    if(!state||state.roundOver||!graph)return;
    if(Number(actorIndex)!==Number(state.active)){if(net.role==='host'&&actorIndex===1)sendGuest({type:'MOVE_ERROR',message:'Det är inte din tur.'});return;}
    const resolved=ENGINE.resolveName(graph,raw);
    if(!resolved){if(net.role==='host'&&actorIndex===1)sendGuest({type:'MOVE_ERROR',message:'Jag hittar inte den gatan i Umeås gatnät.'});else setMessage('Jag hittar inte den gatan i Umeås gatnät. Kontrollera stavningen och försök igen.','bad');return;}
    const result=ENGINE.validateMove(graph,state.current,resolved,state.used);
    if(!result.ok){if(result.reason==='used') return loseRound(state.active,`${resolved} har redan använts i den här rundan.`);return loseRound(state.active,`${resolved} korsar inte ${state.current}.`);}
    const previous=state.current;state.previous=previous;state.current=result.name;state.used.push(result.name);const mover=state.active;state.active=1-state.active;$('streetDuelInput').value='';$('streetDuelSuggestions').innerHTML='';setMessage(`✓ ${result.name} korsar ${previous}. ${playerName(state.active)} står på tur.`,'good');updateUI();renderMap(previous);
    const legal=ENGINE.unusedNeighbors(graph,state.current,state.used);if(!legal.length) return winRound(mover,`${playerName(mover)} stängde vägen – det finns ingen oanvänd korsande gata kvar.`);resetTimer();if(net.role==='host')broadcastGameState();if(canLocalMove())setTimeout(()=>$('streetDuelInput')?.focus(),80);
  }

  function loseRound(loser,reason){winRound(1-loser,reason);}
  function winRound(winner,reason){stopTimer();state.roundOver=true;state.scores[winner]++;state.matchOver=state.scores[winner]>=ROUND_TARGET;lastResult={winner,reason,matchOver:state.matchOver};updateUI();setMessage(`${reason} ${playerName(winner)} vinner rundan.`,'bad');showRoundResult();if(net.role==='host')broadcastGameState();}
  function showRoundResult(){
    if(!lastResult||!state)return;const {winner,reason}=lastResult;const card=$('streetDuelOverlayCard');const onlineGuest=net.role==='guest';
    card.innerHTML=`<span class="eyebrow">${state.matchOver?'MATCHEN ÄR AVGJORD':`RUNDA ${state.round} KLAR`}</span><h2>${esc(playerName(winner))} vinner${state.matchOver?'!':' rundan'}</h2><p>${esc(reason)}</p><div class="street-duel-result-score"><span style="color:#68f6ff">${state.scores[0]}</span><span>–</span><span style="color:#ff8f70">${state.scores[1]}</span></div><button id="streetDuelNext" class="street-duel-big-button" type="button" ${onlineGuest?'disabled':''}>${onlineGuest?'Väntar på spelledaren…':state.matchOver?'Spela ny match':'Nästa runda'}</button>`;
    $('streetDuelOverlay').classList.remove('hidden');if(onlineGuest)return;
    $('streetDuelNext').addEventListener('click',()=>{if(state.matchOver){if(net.role==='host'){state=freshState([playerName(0),playerName(1)]);lastResult=null;hideOverlay();startRound();broadcastGameState();return;}return showLobby();}state.round++;hideOverlay();startRound();});
  }

  function renderSuggestions(){if(!graph||!state||state.roundOver||$('streetDuelInput')?.disabled)return;const list=ENGINE.suggestions(graph,$('streetDuelInput').value,6);$('streetDuelSuggestions').innerHTML=list.map(name=>`<button type="button" data-street="${esc(name)}">${esc(name)}</button>`).join('');$('streetDuelSuggestions').querySelectorAll('[data-street]').forEach(button=>button.addEventListener('click',()=>{$('streetDuelInput').value=button.dataset.street;$('streetDuelSuggestions').innerHTML='';$('streetDuelInput').focus();}));}
  function hideOverlay(){$('streetDuelOverlay')?.classList.add('hidden');}
  function showLobby(message=''){
    stopTimer();lastResult=null;const card=$('streetDuelOverlayCard');card.innerHTML=`<span class="eyebrow">NYTT LOKALT SPELLÄGE</span><h2>🏙️ Gatduell Umeå</h2><p>Ni turas om att skriva en gata som faktiskt korsar den aktuella gatan. Fel korsning eller slut på tiden kostar rundan. Först till tre rundvinster vinner.</p><div class="street-duel-names"><input id="streetDuelName0" maxlength="24" value="" placeholder="Namn spelare 1" aria-label="Namn spelare 1"><input id="streetDuelName1" maxlength="24" value="" placeholder="Namn spelare 2" aria-label="Namn spelare 2"></div><button id="streetDuelStart" class="street-duel-big-button" type="button" ${graph?'':'disabled'}>${graph?'Starta Gatduell':'Laddar Umeås gator…'}</button><div id="streetDuelLoad" class="street-duel-load">${message|| (graph?`${graph.size} korsande gatunamn redo.`:'Hämtar gatnät…')}</div>`;$('streetDuelOverlay').classList.remove('hidden');if(graph) bindLobbyStart();else loadGraph().then(()=>{if(!$('streetDuelOverlay')?.classList.contains('hidden'))showLobby(`${graph.size} korsande gatunamn redo.`);}).catch(error=>{const load=$('streetDuelLoad');if(load)load.textContent=`Kunde inte hämta gatdata: ${error.message}`;const start=$('streetDuelStart');if(start){start.disabled=true;start.textContent='Gatdata saknas';}});
  }
  function bindLobbyStart(){$('streetDuelStart')?.addEventListener('click',()=>{const names=[$('streetDuelName0').value.trim(),$('streetDuelName1').value.trim()];if(!names[0]||!names[1]){const load=$('streetDuelLoad');if(load)load.textContent='Båda spelarna måste skriva sitt namn.';return;}startMatch(names);});}
  function open(){resetNetwork(false);ensureScreen();injectStyles();showOnly('streetDuel');ensureMap();setTimeout(()=>streetMap.invalidateSize(),80);showLobby();}

  function returnToStart(){stopTimer();hideOverlay();state=null;lastResult=null;showOnly('setup');const setup=$('setupScreen');setup?.classList.add('orten-entry-gate');setup?.classList.remove('online-host-mode');$('playEntryGate')?.classList.remove('hidden');$('setupEntryBack')?.classList.add('hidden');$('onlineHostContext')?.classList.add('hidden');$('onlineHostBanner')?.classList.add('hidden');if(typeof showSetupStep==='function')showSetupStep(1);}
  function close(){if(isOnline()){leaveStreetOnline(true);return;}stopTimer();hideOverlay();state=null;showOnly('setup');if(typeof showSetupStep==='function') showSetupStep(1);}

  function peerOptions(){const iceServers=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];const turn=globalThis.ORTEN_TURN;if(turn?.urls)iceServers.push({urls:turn.urls,username:turn.username||undefined,credential:turn.credential||undefined});return {debug:1,config:{iceServers,iceCandidatePoolSize:4}};}
  function ensurePeerJs(){
    if(globalThis.Peer)return Promise.resolve(globalThis.Peer);if(net.peerLoadPromise)return net.peerLoadPromise;
    net.peerLoadPromise=new Promise((resolve,reject)=>{const existing=document.querySelector('script[data-orten-peerjs]');const done=()=>globalThis.Peer?resolve(globalThis.Peer):reject(new Error('PeerJS kunde inte starta.'));if(existing){existing.addEventListener('load',done,{once:true});existing.addEventListener('error',()=>reject(new Error('PeerJS kunde inte laddas.')),{once:true});return;}const script=document.createElement('script');script.src=PEERJS_URL;script.async=true;script.dataset.ortenPeerjs='1';script.addEventListener('load',done,{once:true});script.addEventListener('error',()=>reject(new Error('PeerJS kunde inte laddas. Kontrollera nätet.')),{once:true});document.head.appendChild(script);}).catch(error=>{net.peerLoadPromise=null;throw error;});return net.peerLoadPromise;
  }
  function clearReconnect(){if(net.reconnectTimer){clearTimeout(net.reconnectTimer);net.reconnectTimer=null;}}
  function closePeer(){clearReconnect();try{net.conn?.close();}catch{}net.conn=null;try{net.guestConn?.close();}catch{}net.guestConn=null;try{net.peer?.destroy();}catch{}net.peer=null;}
  function resetNetwork(keepPeerPromise=true){closePeer();const promise=keepPeerPromise?net.peerLoadPromise:null;Object.assign(net,{role:'offline',code:'',status:'idle',peer:null,conn:null,guestConn:null,hostName:'',guestName:'',guestId:'',guestConnected:false,guestReady:false,started:false,lastError:'',peerLoadPromise:promise,reconnectTimer:null,reconnectAttempts:0});}
  function sendGuest(message){if(net.guestConn?.open){try{net.guestConn.send(message);}catch{}}}
  function sendHost(message){if(net.conn?.open){try{net.conn.send(message);}catch{}}}
  function lobbyPayload(){return {type:'STREET_LOBBY',code:net.code,hostName:net.hostName,guestName:net.guestName,guestConnected:net.guestConnected,guestReady:net.guestReady,started:net.started,settings:currentNetSettings()};}
  function sendLobby(){if(net.role==='host')sendGuest(lobbyPayload());}
  function snapshot(){return {state:clone(state),timerRemaining:Number(timerRemaining),lastResult:lastResult?clone(lastResult):null,settings:currentNetSettings()};}
  function broadcastGameState(type='STREET_STATE'){if(net.role!=='host'||!net.started||!state)return;sendGuest({type,payload:snapshot()});}
  function playerRow(name,sub,color,mark){return `<div class="online-player"><i style="--p:${color}"></i><span><strong>${esc(name||'Väntar…')}</strong><small>${esc(sub)}</small></span><b>${mark}</b></div>`;}

  function renderStreetOnlineLobby(){
    const modal=$('onlineModal'),body=$('onlineModalBody');if(!modal||!body)return;const isHost=net.role==='host';const settings=currentNetSettings();const levels=window.OrtenStreetDuelDifficultyOptions?.levels||{hard:{key:'hard',icon:'🔴',label:'Hard'},medium:{key:'medium',icon:'🟡',label:'Medium'},easy:{key:'easy',icon:'🟢',label:'Easy'}};const timerOptions=window.OrtenStreetDuelTimerOptions?.options||[0,10,15,20,30,45,60];const guestSub=net.guestConnected?(net.guestReady?'Redo':'Inte redo'):'Väntar på spelare';const canStart=isHost&&net.status==='connected'&&net.guestConnected&&net.guestReady&&!net.started;
    body.innerHTML=`<div class="online-lobby-head"><div><span class="step-kicker">🏙️ GATDUELL ONLINE</span><h2>${esc(net.code)}</h2></div><span class="online-status ${esc(net.status)}">● ${esc(networkStatusText())}</span></div><div class="online-room-code"><span>Rumskod</span><strong>${esc(net.code)}</strong><button id="streetOnlineCopy" type="button">Kopiera</button></div>${isHost&&!net.started?`<div class="street-online-settings"><label>Svårighetsgrad<select id="streetOnlineDifficulty">${Object.values(levels).map(level=>`<option value="${esc(level.key)}"${level.key===settings.difficulty?' selected':''}>${esc(level.icon||'')} ${esc(level.label||level.key)}</option>`).join('')}</select></label><label>Tidsgräns<select id="streetOnlineTimer">${timerOptions.map(value=>`<option value="${value}"${Number(value)===Number(settings.timer)?' selected':''}>${Number(value)===0?'Ingen tidsgräns':`${value} sekunder`}</option>`).join('')}</select></label></div>`:`<div class="online-settings-preview"><span>Match</span><strong>Gatduell Umeå · ${esc(levels[settings.difficulty]?.label||settings.difficulty)} · ${settings.timer?`${settings.timer} sek`:'utan tidsgräns'}</strong></div>`}<div class="online-lobby-section"><div class="online-section-head"><strong>Spelare</strong><span>${net.guestConnected?'2':'1'}/2</span></div><div class="online-player-list">${playerRow(net.hostName,'Spelledare','#68f6ff','★')}${playerRow(net.guestName,guestSub,'#ff8f70',net.guestConnected?(net.guestReady?'✓':'…'):'×')}</div></div>${net.lastError?`<div class="online-error">${esc(net.lastError)}</div>`:''}<div class="online-actions">${isHost?`<button id="streetOnlineStart" class="primary-button" type="button" ${canStart?'':'disabled'}>${net.started?'Spelet pågår':'Starta Gatduell'}</button>`:`<button id="streetOnlineReady" class="primary-button" type="button" ${net.status==='connected'&&!net.started?'':'disabled'}>${net.guestReady?'✓ Redo':'Jag är redo'}</button>`}<button id="streetOnlineLeave" class="ghost-button" type="button">${isHost?'Stäng rummet':'Lämna rummet'}</button></div><p class="online-network-note">Två spelare · samma gata, tur, timer och resultat synkas mellan enheterna.</p>`;
    modal.classList.remove('hidden');
    $('streetOnlineCopy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(net.code);if(typeof toast==='function')toast('Rumskoden kopierad.');}catch{if(typeof toast==='function')toast(`Rumskod: ${net.code}`);}});
    $('streetOnlineDifficulty')?.addEventListener('change',event=>{applyNetSettings({...settings,difficulty:event.target.value});sendLobby();renderStreetOnlineLobby();});
    $('streetOnlineTimer')?.addEventListener('change',event=>{applyNetSettings({...settings,timer:Number(event.target.value)});sendLobby();renderStreetOnlineLobby();});
    $('streetOnlineReady')?.addEventListener('click',()=>{net.guestReady=!net.guestReady;sendHost({type:'READY',ready:net.guestReady});renderStreetOnlineLobby();});
    $('streetOnlineStart')?.addEventListener('click',startOnlineHostGame);$('streetOnlineLeave')?.addEventListener('click',()=>leaveStreetOnline(true));
  }

  async function createStreetRoom(name,code){
    name=String(name||'').trim();if(!name){if(typeof toast==='function')toast('Skriv ditt namn först.','error');return;}resetNetwork();saveName(name);net.role='host';net.code=streetRoomCode(code);net.hostName=name;net.status='connecting';renderStreetOnlineLobby();
    try{const PeerCtor=await ensurePeerJs();const peer=new PeerCtor(streetPeerId(net.code),peerOptions());net.peer=peer;const timeout=setTimeout(()=>{if(!peer.open&&net.role==='host'){net.status='error';net.lastError='Nätverkstjänsten svarar inte.';renderStreetOnlineLobby();}},9000);peer.on('open',()=>{clearTimeout(timeout);if(net.role!=='host')return;net.status='connected';net.lastError='';renderStreetOnlineLobby();});peer.on('connection',attachStreetGuest);peer.on('disconnected',()=>{if(net.role!=='host'||peer.destroyed)return;net.status='reconnecting';renderStreetOnlineLobby();setTimeout(()=>{try{peer.reconnect();}catch{}},1200);});peer.on('error',error=>{if(net.role!=='host')return;net.status='error';net.lastError=error?.type==='unavailable-id'?'Rumskoden används redan. Stäng rummet och skapa ett nytt.':'Nätverksanslutningen misslyckades.';renderStreetOnlineLobby();});}catch(error){net.status='error';net.lastError=error?.message||'Kunde inte skapa Gatduell-rummet.';renderStreetOnlineLobby();}
  }

  function attachStreetGuest(conn){
    let id='';conn.on('open',()=>{try{conn.send(lobbyPayload());}catch{}});conn.on('data',message=>{const msg=message||{};if(msg.type==='HELLO'){const nextId=String(msg.playerId||'');const name=String(msg.name||'').trim().slice(0,24);if(!nextId||!name)return;if(net.guestConnected&&net.guestId&&net.guestId!==nextId){try{conn.send({type:'ERROR',message:'Rummet har redan två spelare.'});conn.close();}catch{}return;}id=nextId;try{if(net.guestConn&&net.guestConn!==conn)net.guestConn.close();}catch{}net.guestConn=conn;net.guestId=nextId;net.guestName=name;net.guestConnected=true;net.guestReady=false;sendLobby();renderStreetOnlineLobby();if(net.started&&state){resetTimer();sendGuest({type:'STREET_START',payload:snapshot()});}return;}if(msg.type==='READY'&&id){net.guestReady=!!msg.ready;sendLobby();renderStreetOnlineLobby();return;}if(msg.type==='MOVE'&&id&&net.started){if(!state||state.roundOver){sendGuest({type:'MOVE_ERROR',message:'Rundan tar inte emot drag just nu.'});return;}applyMove(String(msg.name||''),1);return;}if(msg.type==='LEAVE'&&id){handleStreetGuestDisconnect(conn);return;}});conn.on('close',()=>handleStreetGuestDisconnect(conn));conn.on('error',()=>handleStreetGuestDisconnect(conn));
  }
  function handleStreetGuestDisconnect(conn){if(net.role!=='host'||net.guestConn!==conn)return;net.guestConn=null;net.guestConnected=false;net.guestReady=false;if(net.started&&!state?.roundOver){stopTimer();setMessage('Motspelaren tappade anslutningen. Väntar på återanslutning.','bad');updateUI();}renderStreetOnlineLobby();}

  async function joinStreetRoom(name,code){
    name=String(name||'').trim();code=safeCode(code);if(!name){const error=$('onlineMenuError');if(error){error.textContent='Du måste skriva ditt namn.';error.classList.remove('hidden');}return;}if(!isStreetCode(code))return;resetNetwork();saveName(name);net.role='guest';net.code=code;net.guestName=name;net.guestId=guestPlayerId(code);net.status='connecting';renderStreetOnlineLobby();
    try{const PeerCtor=await ensurePeerJs();const peer=new PeerCtor(peerOptions());net.peer=peer;const timeout=setTimeout(()=>{if(!peer.open&&net.role==='guest'){net.status='error';net.lastError='Nätverkstjänsten svarar inte.';renderStreetOnlineLobby();}},9000);peer.on('open',()=>{clearTimeout(timeout);if(net.role!=='guest')return;connectStreetGuest();});peer.on('disconnected',()=>{if(net.role!=='guest'||peer.destroyed)return;net.status='reconnecting';renderStreetOnlineLobby();try{peer.reconnect();}catch{}});peer.on('error',error=>{if(net.role!=='guest')return;if(error?.type==='peer-unavailable')scheduleStreetReconnect();else{net.status='error';net.lastError='Nätverksanslutningen misslyckades.';renderStreetOnlineLobby();}});}catch(error){net.status='error';net.lastError=error?.message||'Kunde inte ansluta till Gatduell-rummet.';renderStreetOnlineLobby();}
  }
  function connectStreetGuest(){
    if(net.role!=='guest'||!net.peer?.open)return;clearReconnect();net.status=net.reconnectAttempts?'reconnecting':'connecting';renderStreetOnlineLobby();const conn=net.peer.connect(streetPeerId(net.code),{reliable:true,serialization:'json'});net.conn=conn;let opened=false;const timeout=setTimeout(()=>{if(opened||conn.open)return;try{conn.close();}catch{}scheduleStreetReconnect();},7000);conn.on('open',()=>{opened=true;clearTimeout(timeout);net.status='connected';net.lastError='';net.reconnectAttempts=0;conn.send({type:'HELLO',playerId:net.guestId,name:net.guestName});renderStreetOnlineLobby();});conn.on('data',handleStreetHostMessage);conn.on('close',()=>{clearTimeout(timeout);if(net.role==='guest')scheduleStreetReconnect();});conn.on('error',()=>{clearTimeout(timeout);if(net.role==='guest')scheduleStreetReconnect();});
  }
  function scheduleStreetReconnect(){if(net.role!=='guest')return;clearReconnect();if(net.reconnectAttempts>=5){net.status='error';net.lastError='Kunde inte återansluta till rummet.';renderStreetOnlineLobby();return;}const delay=Math.min(1000*2**net.reconnectAttempts,8000);net.reconnectAttempts++;net.status='reconnecting';net.lastError=`Återansluter om ${Math.ceil(delay/1000)} s…`;renderStreetOnlineLobby();net.reconnectTimer=setTimeout(()=>{if(net.peer?.open)connectStreetGuest();else{try{net.peer?.reconnect();}catch{}net.reconnectTimer=setTimeout(connectStreetGuest,1000);}},delay);}

  async function applyRemoteSnapshot(payload){if(!payload?.state)return;applyNetSettings(payload.settings||{});await loadGraph();ensureScreen();ensureMap();showOnly('streetDuel');state=clone(payload.state);timerRemaining=Number(payload.timerRemaining)||0;lastResult=payload.lastResult?clone(payload.lastResult):null;hideOverlay();updateUI();renderTimer();renderMap(state.previous||null);setMessage(state.roundOver&&lastResult?`${lastResult.reason} ${playerName(lastResult.winner)} vinner rundan.`:'Synkad med spelledaren.',state.roundOver?'bad':'good');if(lastResult&&state.roundOver)showRoundResult();setTimeout(()=>streetMap?.invalidateSize(),50);}
  function handleStreetHostMessage(message){const msg=message||{};if(msg.type==='STREET_LOBBY'){net.hostName=String(msg.hostName||net.hostName);net.guestName=String(msg.guestName||net.guestName);net.guestConnected=!!msg.guestConnected;net.guestReady=!!msg.guestReady;net.started=!!msg.started;applyNetSettings(msg.settings||{});renderStreetOnlineLobby();return;}if(msg.type==='STREET_START'){net.started=true;net.guestConnected=true;net.guestReady=true;applyRemoteSnapshot(msg.payload);$('onlineModal')?.classList.add('hidden');return;}if(msg.type==='STREET_STATE'){net.started=true;applyRemoteSnapshot(msg.payload);return;}if(msg.type==='MOVE_ERROR'){setMessage(String(msg.message||'Draget kunde inte spelas.'),'bad');updateUI();return;}if(msg.type==='ROOM_CLOSED'){if(typeof toast==='function')toast(msg.message||'Spelledaren stängde rummet.','error',4200);resetNetwork();returnToStart();return;}if(msg.type==='ERROR'){net.lastError=String(msg.message||'Ett nätverksfel inträffade.');renderStreetOnlineLobby();}}

  async function startOnlineHostGame(){if(net.role!=='host'||net.started||!net.guestConnected||!net.guestReady)return;try{await loadGraph();ensureScreen();ensureMap();state=freshState([net.hostName,net.guestName]);lastResult=null;showOnly('streetDuel');hideOverlay();net.started=true;startRound();sendLobby();sendGuest({type:'STREET_START',payload:snapshot()});$('onlineModal')?.classList.add('hidden');setTimeout(()=>streetMap.invalidateSize(),80);if(typeof toast==='function')toast(`Gatduell-rum ${net.code} startat.`);}catch(error){net.lastError=`Kunde inte starta Gatduell: ${error.message}`;renderStreetOnlineLobby();}}
  function leaveStreetOnline(toStart=false){if(net.role==='host')sendGuest({type:'ROOM_CLOSED',message:'Spelledaren stängde Gatduell-rummet.'});else if(net.role==='guest')sendHost({type:'LEAVE'});resetNetwork();$('onlineModal')?.classList.add('hidden');if(toStart)returnToStart();}

  function installOnlineInterceptors(){document.addEventListener('click',event=>{const join=event.target?.closest?.('#onlineJoinButton');if(join){const code=safeCode($('onlineJoinCode')?.value||'');if(isStreetCode(code)){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();joinStreetRoom($('onlineGuestName')?.value||'',code);return;}}const onlineButton=event.target?.closest?.('#onlineButton');if(onlineButton&&isOnline()){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();renderStreetOnlineLobby();}},true);}
  function bootstrap(){injectStyles();ensureModeButton();ensureScreen();installOnlineInterceptors();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();

  window.OrtenStreetDuelApp={open,close,loadGraph,get graph(){return graph;},get online(){return {role:net.role,code:net.code,status:net.status,started:net.started};}};
})();
