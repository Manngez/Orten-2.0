  const G = window.OrtenGeometry;
  const DUEL = window.OrtenDuelRoutes;
  if(!G) throw new Error('OrtenGeometry saknas. Spelet stoppas för att undvika felaktig korsningsberäkning.');
  if(!DUEL) throw new Error('OrtenDuelRoutes saknas. Duellmotorn kunde inte starta.');

  function closeAllGameModals(){
    [els.placeModal,els.resultModal,els.pauseModal].forEach(m=>m.classList.add('hidden')); placeChooserOpen=false;
  }

  const MAP_TILE_URLS = {
    default:'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    atlas:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png'
  };

  function tileUrlForTheme(theme){ return theme==='atlas' ? MAP_TILE_URLS.atlas : MAP_TILE_URLS.default; }

  function applyMapTheme(theme){
    const safe=['night','atlas','paper'].includes(theme)?theme:'night';
    els.map.classList.remove('theme-night','theme-atlas','theme-paper');
    els.map.classList.add(`theme-${safe}`);
    els.gameScreen.classList.remove('theme-night-ui','theme-atlas-ui','theme-paper-ui');
    els.gameScreen.classList.add(`theme-${safe}-ui`);
    tileLayer?.setUrl(tileUrlForTheme(safe));
  }

  function initMap(){
    if(!map){
      map=L.map('map',{zoomControl:false,minZoom:2,maxZoom:18,worldCopyJump:true,zoomSnap:.25,zoomDelta:.5,wheelPxPerZoomLevel:80,inertia:true,preferCanvas:true}).setView([20,0],2.3);
      tileLayer=L.tileLayer(tileUrlForTheme(game.settings?.mapTheme),{subdomains:'abcd',maxZoom:20,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'}).addTo(map);
      routeLayer=L.layerGroup().addTo(map);
      map.on('dragstart',markUserNavigation);
      map.on('click',()=>document.querySelector('.left-panel')?.classList.remove('open'));
      const container=map.getContainer();
      container.addEventListener('wheel',markUserNavigation,{passive:true}); container.addEventListener('touchstart',markUserNavigation,{passive:true});
      map.on('moveend zoomend',()=>{if(mapProgrammatic) mapProgrammatic=false;});
    }
    applyMapTheme(game.settings.mapTheme);
    setTimeout(()=>map.invalidateSize(),80); renderMap();
  }

  function markUserNavigation(){
    if(mapProgrammatic)return; userNavigatingUntil=Date.now()+8000;
    els.mapInteractionHint.textContent='Fri navigering aktiv · automatisk följning fortsätter om några sekunder'; els.mapInteractionHint.classList.remove('fade');
    setTimeout(()=>{if(Date.now()>=userNavigatingUntil){els.mapInteractionHint.textContent='Dra, nyp eller scrolla fritt · automatisk följning pausar när du navigerar';els.mapInteractionHint.classList.add('fade')}},8200);
  }

  function withProgrammaticMap(action){ mapProgrammatic=true; action(); setTimeout(()=>{mapProgrammatic=false},900); }
  function resetMapToInitial(){ if(!map)return; withProgrammaticMap(()=>map.setView(game.initialView.center,game.initialView.zoom,{animate:false})); renderMap(); }

  function markerIcon(place,idx){
    const color=game.players[place.playerIndex]?.color||PLAYER_COLORS[0]; const latest=idx===game.route.length-1?' latest':'';
    const label=game.settings?.mode==='duel'?(place.playerMoveNumber||DUEL.playerMoveCount(game.route.slice(0,idx+1),place.playerIndex)):idx+1;
    return L.divIcon({className:'city-marker-wrap',html:`<div class="city-marker${latest}" style="--marker:${color}">${label}</div>`,iconSize:[26,26],iconAnchor:[13,13]});
  }

  function segmentParts(a,b){ return G.segmentParts(a,b); }

  function renderMap(){
    if(!map||!routeLayer)return;
    routeLayer.clearLayers();
    const crossed=new Set(game.lastCrossings.map(c=>c.crossedStartIndex!=null?`${c.crossedStartIndex}:${c.crossedEndIndex}`:`${c.crossedSegmentIndex}:${c.crossedSegmentIndex+1}`));
    const segments=DUEL.segments(game.route,game.settings?.mode);
    segments.forEach(segment=>{
      const color=game.players[segment.playerIndex]?.color||PLAYER_COLORS[0];
      segmentParts(segment.a,segment.b).forEach(part=>L.polyline(part,{color,weight:5,opacity:.9,lineCap:'round',interactive:false}).addTo(routeLayer));
      if(crossed.has(`${segment.startIndex}:${segment.endIndex}`)) segmentParts(segment.a,segment.b).forEach(part=>L.polyline(part,{color:'#ff5f6d',weight:8,opacity:.78,dashArray:'8 8',interactive:false}).addTo(routeLayer));
    });
    game.route.forEach((p,i)=>{
      const m=L.marker([p.lat,p.lon],{icon:markerIcon(p,i),keyboard:false}).addTo(routeLayer);
      const region=p.region?` · ${esc(p.region)}`:''; m.bindTooltip(`${esc(p.name)} · ${esc(p.country)}${region}`,{direction:'top',className:'city-tooltip',offset:[0,-11],permanent:!!game.settings.labels});
      m.on('click',()=>focusPlace(i));
    });
    game.lastCrossings.forEach(c=>{
      const icon=L.divIcon({className:'city-marker-wrap',html:'<div class="cross-marker">×</div>',iconSize:[30,30],iconAnchor:[15,15]});
      L.marker([c.lat,c.lon],{icon,interactive:false}).addTo(routeLayer);
    });
  }

  function focusPlace(index){const p=game.route[index];if(!p||!map)return;withProgrammaticMap(()=>map.flyTo([p.lat,p.lon],Math.max(map.getZoom(),7),{duration:.65}));}
  function focusLatest(){if(!game.route.length)return resetMapToInitial();focusPlace(game.route.length-1)}
  function fitRoute(force=false){
    if(!map||!game.route.length)return resetMapToInitial();
    if(!force && (!game.followEnabled || Date.now()<userNavigatingUntil))return;
    if(game.route.length===1)return withProgrammaticMap(()=>map.flyTo([game.route[0].lat,game.route[0].lon],6.5,{duration:.55}));
    const slice=game.route.length>8?game.route.slice(-5):game.route; const lons=slice.map(p=>p.lon); const span=Math.max(...lons)-Math.min(...lons);
    if(span>180){const p=game.route.at(-1);return withProgrammaticMap(()=>map.flyTo([p.lat,p.lon],4.4,{duration:.6}));}
    const bounds=L.latLngBounds(slice.map(p=>[p.lat,p.lon])); withProgrammaticMap(()=>map.flyToBounds(bounds,{padding:[55,55],maxZoom:6.5,duration:.6}));
  }

  function unwrapLon(lon,prevUx){ return G.unwrapLon(lon,prevUx); }
  function mercY(lat){ return G.mercY(lat); }
  function normalizeLon(x){ return G.normalizeLon(x); }
  function intersectionOf(a,b,c,d){ return G.intersectionOf(a,b,c,d); }

  function crossingsForNewPlace(place){
    if(game.settings?.mode==='duel')return DUEL.candidateCrossings(game.route,game.currentIndex,place,G);
    if(game.route.length<3)return [];
    const start=game.route.at(-1); const candidate={...place,ux:unwrapLon(place.lon,start.ux)}; const hits=[];
    for(let i=0;i<game.route.length-2;i++){
      const hit=intersectionOf(start,candidate,game.route[i],game.route[i+1]); if(hit)hits.push({...hit,crossedSegmentIndex:i});
    }
    hits.sort((a,b)=>a.t-b.t); return hits;
  }

  function stablePlaceKey(p){ return p.geonameId?`gn:${p.geonameId}`:(p.id||`${norm(p.name)}|${p.countryCode}|${norm(p.region)}|${p.lat.toFixed(4)}|${p.lon.toFixed(4)}`); }
  function haversine(a,b){ return G.haversine(a,b); }
  function isDuplicate(place){
    if(game.settings.duplicatePolicy==='allow')return false;
    const route=game.settings?.mode==='duel'?game.route.filter(p=>p.playerIndex===game.currentIndex):game.route;
    if(game.settings.duplicatePolicy==='nameCountry')return route.some(p=>norm(p.name)===norm(place.name)&&p.countryCode===place.countryCode);
    return route.some(p=>stablePlaceKey(p)===stablePlaceKey(place) || (norm(p.name)===norm(place.name)&&p.countryCode===place.countryCode&&norm(p.region)===norm(place.region)&&haversine(p,place)<1));
  }

  function searchCacheKey(query){
    const codes=scopeCodes(game.settings);
    return `${norm(query)}|${game.settings.placeType}|${codes?codes.slice().sort().join(','):'world'}`;
  }

  function rememberSearch(key,payload){
    if(searchCache.has(key)) searchCache.delete(key);
    searchCache.set(key,payload);
    while(searchCache.size>SEARCH_CACHE_LIMIT) searchCache.delete(searchCache.keys().next().value);
  }

  function countryNameMap(){
    let english=null; try{english=new Intl.DisplayNames(['en'],{type:'region'})}catch{}
    return Object.fromEntries(D.ISO_CODES.map(code=>[code,[D.countryName(code),english?.of(code)].filter(Boolean).join(' | ')]));
  }
