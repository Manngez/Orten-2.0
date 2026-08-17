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

  let graph=null;
  let graphPromise=null;
  let streetMap=null;
  let streetLayer=null;
  let timer=null;
  let timerRemaining=TURN_SECONDS;
  let state=null;

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
      @media(max-width:900px){.street-duel-shell{grid-template-columns:1fr}.street-duel-side{border:0;padding:12px}.street-duel-side.left{display:grid;grid-template-columns:1fr 1fr;gap:8px}.street-duel-side.left .street-duel-round,.street-duel-side.left .street-duel-current,.street-duel-side.left .street-duel-chain{grid-column:1/-1}.street-duel-map-wrap{min-height:43dvh}.street-duel-side.right{border:0}.street-duel-source{display:none}}
      @media(max-width:520px){.street-duel-top{height:58px}.street-duel-shell{min-height:calc(100dvh - 58px)}.street-duel-side.left{padding:9px}.street-duel-player{padding:9px;margin:0}.street-duel-current{padding:12px;margin:2px 0}.street-duel-current strong{font-size:20px}.street-duel-map-wrap{min-height:35dvh}.street-duel-side.right{padding:11px 12px 18px}.street-duel-names{grid-template-columns:1fr}.street-duel-card{padding:19px}.street-duel-card h2{font-size:26px}}
    `;
    document.head.appendChild(style);
  }

  function ensureModeButton(){
    const grid=$('modeGrid');
    if(!grid||$('streetDuelMode')) return;
    const button=document.createElement('button');
    button.id='streetDuelMode';button.type='button';button.className='mode-card';
    button.innerHTML='<span class="mode-icon">🏙️</span><strong>Gatduell Umeå</strong><small>Svara med en gata som korsar den aktuella.</small>';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open();});
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

  function showOnly(name){
    document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
    $(`${name}Screen`)?.classList.add('active');
  }

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
    graphPromise=fetchStreetData().then(features=>{
      const built=ENGINE.buildGraph(features,{toleranceMeters:8});
      if(built.size<80) throw new Error(`Gatunätet blev för litet (${built.size} gator).`);
      graph=built;return graph;
    }).catch(error=>{graphPromise=null;throw error;});
    return graphPromise;
  }

  function ensureMap(){
    if(streetMap) return;
    streetMap=L.map('streetDuelMap',{zoomControl:false,minZoom:10,maxZoom:18,zoomSnap:.25,preferCanvas:true}).setView(CENTER,12.3);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(streetMap);
    streetLayer=L.layerGroup().addTo(streetMap);
    L.control.zoom({position:'topright'}).addTo(streetMap);
  }

  function linesFor(name){return graph?.get(name)?.lines||[];}

  function renderMap(previous=null){
    if(!streetMap||!streetLayer||!state?.current) return;
    streetLayer.clearLayers();
    const bounds=[];
    if(previous){
      for(const line of linesFor(previous)){
        const pts=line.map(([lon,lat])=>[lat,lon]);bounds.push(...pts);
        L.polyline(pts,{color:'#ff8f70',weight:5,opacity:.58,interactive:false}).addTo(streetLayer);
      }
    }
    for(const line of linesFor(state.current)){
      const pts=line.map(([lon,lat])=>[lat,lon]);bounds.push(...pts);
      L.polyline(pts,{color:'#68f6ff',weight:7,opacity:.92,interactive:false}).addTo(streetLayer);
    }
    if(bounds.length) streetMap.fitBounds(L.latLngBounds(bounds),{padding:[38,38],maxZoom:15,animate:true,duration:.45});
  }

  function playerName(index){return state?.players?.[index]?.name||`Spelare ${index+1}`;}

  function setMessage(text,kind=''){
    const el=$('streetDuelMessage');if(!el)return;
    el.textContent=text;el.className=`street-duel-message${kind?` ${kind}`:''}`;
  }

  function updateUI(){
    if(!state) return;
    for(let i=0;i<2;i++){
      const el=$(`streetDuelP${i}`);if(!el)continue;
      el.classList.toggle('active',!state.roundOver&&state.active===i);
      el.querySelector('span').textContent=`Spelare ${i+1}`;
      el.querySelector('strong').textContent=playerName(i);
      el.querySelector('b').textContent=state.scores[i];
    }
    $('streetDuelRound').textContent=`RUNDA ${state.round} · FÖRST TILL ${ROUND_TARGET}`;
    $('streetDuelCurrent').textContent=state.current||'–';
    $('streetDuelChain').innerHTML=state.used.map((name,index)=>`<span>${index+1}. ${esc(name)}</span>`).join('');
    $('streetDuelPrompt').innerHTML=state.roundOver?'Rundan är avgjord.':`<strong>${esc(playerName(state.active))}</strong>, skriv en gata som korsar <strong>${esc(state.current)}</strong>.`;
    $('streetDuelInput').disabled=state.roundOver;
    $('streetDuelSubmit').disabled=state.roundOver;
  }

  function stopTimer(){clearInterval(timer);timer=null;}
  function resetTimer(){
    stopTimer();timerRemaining=TURN_SECONDS;renderTimer();
    if(!state||state.roundOver)return;
    timer=setInterval(()=>{
      timerRemaining-=.2;renderTimer();
      if(timerRemaining<=0){stopTimer();loseRound(state.active,'Tiden tog slut.');}
    },200);
  }
  function renderTimer(){
    const pct=Math.max(0,Math.min(100,timerRemaining/TURN_SECONDS*100));
    if($('streetDuelTimerBar')) $('streetDuelTimerBar').style.width=`${pct}%`;
    if($('streetDuelTimerText')) $('streetDuelTimerText').textContent=`${Math.ceil(Math.max(0,timerRemaining))} sek`;
  }

  function startMatch(names){
    state={players:[{name:names[0]||'Spelare 1'},{name:names[1]||'Spelare 2'}],scores:[0,0],round:1,active:0,current:null,used:[],roundOver:false,matchOver:false};
    hideOverlay();startRound();
  }

  function startRound(){
    state.roundOver=false;
    state.active=(state.round-1)%2;
    state.current=ENGINE.chooseStart(graph);
    state.used=[state.current];
    $('streetDuelInput').value='';$('streetDuelSuggestions').innerHTML='';
    setMessage('Skriv en gata som korsar den aktuella gatan.');
    updateUI();renderMap();resetTimer();
    setTimeout(()=>$('streetDuelInput')?.focus(),100);
  }

  function submitMove(event){
    event.preventDefault();
    if(!state||state.roundOver||!graph) return;
    const raw=$('streetDuelInput').value;
    const resolved=ENGINE.resolveName(graph,raw);
    if(!resolved){setMessage('Jag hittar inte den gatan i Umeås gatnät. Kontrollera stavningen och försök igen.','bad');return;}
    const result=ENGINE.validateMove(graph,state.current,resolved,state.used);
    if(!result.ok){
      if(result.reason==='used') return loseRound(state.active,`${resolved} har redan använts i den här rundan.`);
      return loseRound(state.active,`${resolved} korsar inte ${state.current}.`);
    }

    const previous=state.current;
    state.current=result.name;state.used.push(result.name);
    const mover=state.active;
    state.active=1-state.active;
    $('streetDuelInput').value='';$('streetDuelSuggestions').innerHTML='';
    setMessage(`✓ ${result.name} korsar ${previous}. ${playerName(state.active)} står på tur.`,'good');
    updateUI();renderMap(previous);

    const legal=ENGINE.unusedNeighbors(graph,state.current,state.used);
    if(!legal.length) return winRound(mover,`${playerName(mover)} stängde vägen – det finns ingen oanvänd korsande gata kvar.`);
    resetTimer();setTimeout(()=>$('streetDuelInput')?.focus(),80);
  }

  function loseRound(loser,reason){winRound(1-loser,reason);}
  function winRound(winner,reason){
    stopTimer();state.roundOver=true;state.scores[winner]++;
    state.matchOver=state.scores[winner]>=ROUND_TARGET;
    updateUI();setMessage(`${reason} ${playerName(winner)} vinner rundan.`,'bad');
    showRoundResult(winner,reason);
  }

  function showRoundResult(winner,reason){
    const card=$('streetDuelOverlayCard');
    card.innerHTML=`<span class="eyebrow">${state.matchOver?'MATCHEN ÄR AVGJORD':`RUNDA ${state.round} KLAR`}</span><h2>${esc(playerName(winner))} vinner${state.matchOver?'!':' rundan'}</h2><p>${esc(reason)}</p><div class="street-duel-result-score"><span style="color:#68f6ff">${state.scores[0]}</span><span>–</span><span style="color:#ff8f70">${state.scores[1]}</span></div><button id="streetDuelNext" class="street-duel-big-button" type="button">${state.matchOver?'Spela ny match':'Nästa runda'}</button>`;
    $('streetDuelOverlay').classList.remove('hidden');
    $('streetDuelNext').addEventListener('click',()=>{
      if(state.matchOver) return showLobby();
      state.round++;hideOverlay();startRound();
    });
  }

  function renderSuggestions(){
    if(!graph||!state||state.roundOver)return;
    const list=ENGINE.suggestions(graph,$('streetDuelInput').value,6);
    $('streetDuelSuggestions').innerHTML=list.map(name=>`<button type="button" data-street="${esc(name)}">${esc(name)}</button>`).join('');
    $('streetDuelSuggestions').querySelectorAll('[data-street]').forEach(button=>button.addEventListener('click',()=>{
      $('streetDuelInput').value=button.dataset.street;$('streetDuelSuggestions').innerHTML='';$('streetDuelInput').focus();
    }));
  }

  function hideOverlay(){$('streetDuelOverlay')?.classList.add('hidden');}
  function showLobby(message=''){
    stopTimer();
    const card=$('streetDuelOverlayCard');
    card.innerHTML=`<span class="eyebrow">NYTT LOKALT SPELLÄGE</span><h2>🏙️ Gatduell Umeå</h2><p>Ni turas om att skriva en gata som faktiskt korsar den aktuella gatan. Fel korsning eller slut på tiden kostar rundan. Först till tre rundvinster vinner.</p><div class="street-duel-names"><input id="streetDuelName0" maxlength="24" value="Spelare 1" aria-label="Namn spelare 1"><input id="streetDuelName1" maxlength="24" value="Spelare 2" aria-label="Namn spelare 2"></div><button id="streetDuelStart" class="street-duel-big-button" type="button" ${graph?'':'disabled'}>${graph?'Starta Gatduell':'Laddar Umeås gator…'}</button><div id="streetDuelLoad" class="street-duel-load">${message|| (graph?`${graph.size} korsande gatunamn redo.`:'Hämtar gatnät…')}</div>`;
    $('streetDuelOverlay').classList.remove('hidden');
    if(graph) bindLobbyStart();
    else loadGraph().then(()=>{if(!$('streetDuelOverlay')?.classList.contains('hidden'))showLobby(`${graph.size} korsande gatunamn redo.`);}).catch(error=>{
      const load=$('streetDuelLoad');if(load)load.textContent=`Kunde inte hämta gatdata: ${error.message}`;
      const start=$('streetDuelStart');if(start){start.disabled=true;start.textContent='Gatdata saknas';}
    });
  }

  function bindLobbyStart(){
    $('streetDuelStart')?.addEventListener('click',()=>{
      const names=[$('streetDuelName0').value.trim()||'Spelare 1',$('streetDuelName1').value.trim()||'Spelare 2'];
      startMatch(names);
    });
  }

  function open(){
    ensureScreen();injectStyles();showOnly('streetDuel');ensureMap();setTimeout(()=>streetMap.invalidateSize(),80);showLobby();
  }

  function close(){
    stopTimer();hideOverlay();state=null;showOnly('setup');
    if(typeof showSetupStep==='function') showSetupStep(1);
  }

  function bootstrap(){injectStyles();ensureModeButton();ensureScreen();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();

  window.OrtenStreetDuelApp={open,close,loadGraph,get graph(){return graph;}};
})();
