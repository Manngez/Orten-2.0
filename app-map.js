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
    return L.divIcon({className:'city-marker-wrap',html:`<div class="city-marker${latest}" style="--marker:${color}">${idx+1}</div>`,iconSize:[26,26],iconAnchor:[13,13]});
  }

  function segmentParts(a,b){
    const lon1=a.lon,lon2=b.lon; const diff=lon2-lon1;
    if(Math.abs(diff)<=180) return [[[a.lat,lon1],[b.lat,lon2]]];
    if(lon1>0 && lon2<0){const adj=lon2+360;const t=(180-lon1)/(adj-lon1);const lat=a.lat+(b.lat-a.lat)*t;return [[[a.lat,lon1],[lat,180]],[[lat,-180],[b.lat,lon2]]];}
    if(lon1<0 && lon2>0){const adj=lon2-360;const t=(-180-lon1)/(adj-lon1);const lat=a.lat+(b.lat-a.lat)*t;return [[[a.lat,lon1],[lat,-180]],[[lat,180],[b.lat,lon2]]];}
    return [[[a.lat,lon1],[b.lat,lon2]]];
  }

  function renderMap(){
    if(!map||!routeLayer)return; routeLayer.clearLayers(); const crossed=new Set(game.lastCrossings.map(c=>c.crossedSegmentIndex));
    for(let i=1;i<game.route.length;i++){
      const a=game.route[i-1],b=game.route[i]; const color=game.players[b.playerIndex]?.color||PLAYER_COLORS[0];
      segmentParts(a,b).forEach(part=>L.polyline(part,{color,weight:5,opacity:.9,lineCap:'round',interactive:false}).addTo(routeLayer));
      if(crossed.has(i-1)) segmentParts(a,b).forEach(part=>L.polyline(part,{color:'#ff5f6d',weight:8,opacity:.78,dashArray:'8 8',interactive:false}).addTo(routeLayer));
    }
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

  function unwrapLon(lon,prevUx){let x=lon;if(prevUx==null)return x;while(x-prevUx>180)x-=360;while(x-prevUx<-180)x+=360;return x;}
  function mercY(lat){const r=clamp(lat,-85,85)*Math.PI/180;return Math.log(Math.tan(Math.PI/4+r/2));}
  function normalizeLon(x){let lon=((x+180)%360+360)%360-180;return lon===-180?180:lon;}
  function intersectionOf(a,b,c,d){
    const A={x:a.ux,y:mercY(a.lat)},B={x:b.ux,y:mercY(b.lat)},C={x:c.ux,y:mercY(c.lat)},D2={x:d.ux,y:mercY(d.lat)};
    const r={x:B.x-A.x,y:B.y-A.y},s={x:D2.x-C.x,y:D2.y-C.y}; const den=r.x*s.y-r.y*s.x; if(Math.abs(den)<1e-12)return null;
    const q={x:C.x-A.x,y:C.y-A.y}; const t=(q.x*s.y-q.y*s.x)/den; const u=(q.x*r.y-q.y*r.x)/den; const eps=1e-8;
    if(t<=eps||t>1+eps||u<=eps||u>=1-eps)return null;
    const x=A.x+t*r.x,y=A.y+t*r.y; const lat=(2*Math.atan(Math.exp(y))-Math.PI/2)*180/Math.PI;
    return {lat,lon:normalizeLon(x),ux:x,t,u};
  }

  function crossingsForNewPlace(place){
    if(game.route.length<3)return [];
    const start=game.route.at(-1); const candidate={...place,ux:unwrapLon(place.lon,start.ux)}; const hits=[];
    for(let i=0;i<game.route.length-2;i++){
      const hit=intersectionOf(start,candidate,game.route[i],game.route[i+1]); if(hit)hits.push({...hit,crossedSegmentIndex:i});
    }
    hits.sort((a,b)=>a.t-b.t); return hits;
  }

  function stablePlaceKey(p){ return p.geonameId?`gn:${p.geonameId}`:(p.id||`${norm(p.name)}|${p.countryCode}|${norm(p.region)}|${p.lat.toFixed(4)}|${p.lon.toFixed(4)}`); }
  function haversine(a,b){const R=6371,toR=v=>v*Math.PI/180,dLat=toR(b.lat-a.lat),dLon=toR(b.lon-a.lon);const s=Math.sin(dLat/2)**2+Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(s));}
  function isDuplicate(place){
    if(game.settings.duplicatePolicy==='allow')return false;
    if(game.settings.duplicatePolicy==='nameCountry')return game.route.some(p=>norm(p.name)===norm(place.name)&&p.countryCode===place.countryCode);
    return game.route.some(p=>stablePlaceKey(p)===stablePlaceKey(place) || (norm(p.name)===norm(place.name)&&p.countryCode===place.countryCode&&norm(p.region)===norm(place.region)&&haversine(p,place)<1));
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
