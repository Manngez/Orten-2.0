'use strict';

(() => {
  const HS=window.OrtenHighscore;
  const GLOBAL=window.OrtenGlobalHighscore;
  const D=window.OrtenData;
  const GEO=window.OrtenGeometry;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const MAJOR_SCOPES=['country:SE','nordic','continent:europe','world'];
  const PLACE_TYPES=['any','urban','city'];
  const DUPLICATES=['exact','nameCountry','allow'];
  let boardToken=0;
  let currentEntries=[];
  let replayMap=null;
  let replayLayer=null;
  let replayTile=null;
  let replayPoints=[];
  let replayStep=1;
  let replayTimer=null;

  function injectStyles(){
    if(document.querySelector('link[data-highscore-browser-css]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.dataset.highscoreBrowserCss='true';
    try{
      const src=new URL(document.currentScript?.src||location.href,location.href);
      const href=new URL('styles-highscore-browser.css',src);
      const version=src.searchParams.get('v');if(version)href.searchParams.set('v',version);
      link.href=href.href;
    }catch{link.href='styles-highscore-browser.css'}
    document.head.appendChild(link);
  }

  function parseBoardKey(key=''){
    const parts=String(key).split('|');
    if(parts.length!==4||parts[0]!=='solo')return null;
    if(!PLACE_TYPES.includes(parts[2])||!DUPLICATES.includes(parts[3]))return null;
    return {key:String(key),scope:parts[1],placeType:parts[2],duplicatePolicy:parts[3]};
  }

  function makeBoardKey(scope,placeType,duplicatePolicy){
    return `solo|${scope}|${placeType}|${duplicatePolicy}`;
  }

  function scopeLabelFromKey(scope='world'){
    if(scope==='world')return '🌐 Världen';
    if(scope==='nordic')return '❄️ Norden';
    if(scope.startsWith('country:')){
      const code=scope.slice(8).toUpperCase();
      return `${D?.flag?.(code)||'🌍'} ${D?.countryName?.(code)||code}`;
    }
    if(scope.startsWith('continent:')){
      const key=scope.slice(10);return `🌍 ${D?.CONTINENT_META?.[key]?.name||key}`;
    }
    if(scope.startsWith('custom:')){
      const codes=scope.slice(7).split(',').filter(Boolean);
      if(codes.length<=3&&codes.length)return codes.map(code=>`${D?.flag?.(code)||''} ${D?.countryName?.(code)||code}`.trim()).join(', ');
      return codes.length?`🌍 ${codes.length} valda länder`:'Eget område';
    }
    return scope;
  }

  function placeTypeText(value){return {any:'Alla orter',urban:'Större orter',city:'Städer'}[value]||value}
  function duplicateText(value){return {exact:'Unik faktisk plats',nameCountry:'Namn + land',allow:'Återanvändning tillåten'}[value]||value}

  function settingsFromBoard(parsed){
    const base={...settings,mode:'solo',playerCount:1,timer:0,placeType:parsed.placeType,duplicatePolicy:parsed.duplicatePolicy};
    const scope=parsed.scope;
    if(scope==='world')return {...base,scope:'world'};
    if(scope==='nordic')return {...base,scope:'custom',countries:['SE','NO','FI','DK','IS']};
    if(scope.startsWith('country:'))return {...base,scope:'country',country:scope.slice(8).toUpperCase()};
    if(scope.startsWith('continent:'))return {...base,scope:'continent',continent:scope.slice(10)};
    if(scope.startsWith('custom:'))return {...base,scope:'custom',countries:scope.slice(7).split(',').filter(Boolean)};
    return {...base,scope:'world'};
  }

  function currentParsed(){
    try{return parseBoardKey(HS.boardKey({...settings,mode:'solo'}))}catch{return parseBoardKey('solo|country:SE|any|exact')}
  }

  function message(text,type='info'){
    const host=document.getElementById('toast');
    if(!host)return;
    host.textContent=text;host.classList.remove('hidden','error');if(type==='error')host.classList.add('error');
    clearTimeout(message.timer);message.timer=setTimeout(()=>host.classList.add('hidden'),3600);
  }

  function boardRowsMarkup(rows,key){
    if(!rows.length)return '<div class="highscore-empty"><strong>Ingen har satt rekord på den här topplistan ännu.</strong><br>Spela Solo och bli först.</div>';
    return rows.map((row,index)=>{
      const medal=index===0?'🥇':index===1?'🥈':index===2?'🥉':`#${index+1}`;
      const date=HS?.formatDate?.(row.date)||'';
      const replay=row.hasReplay&&row.userId
        ? `<button class="highscore-replay-button" type="button" data-replay-index="${index}">▶ Se omgång</button>`
        : '<span class="highscore-replay-unavailable">Omgång ej sparad</span>';
      return `<div class="highscore-row highscore-browser-row"><div class="highscore-rank">${medal}</div><div class="highscore-player"><strong>${safe(row.name)}</strong><small>${safe(date||'Globalt rekord')}</small></div><div class="highscore-score">${Number(row.score)||0}<small>ORTER</small></div><div class="highscore-replay-action">${replay}</div></div>`;
    }).join('');
  }

  function ensureOptions(select,values,labeler){
    const current=select.value;select.innerHTML='';
    values.forEach(value=>select.add(new Option(labeler(value),value)));
    if(values.includes(current))select.value=current;
  }

  async function loadCatalog(){
    const area=document.getElementById('highscoreAreaSelect');if(!area)return;
    const before=area.value||currentParsed()?.scope||'country:SE';
    let keys=[];
    try{if(GLOBAL?.boards)keys=await GLOBAL.boards()}catch(err){console.warn('Kunde inte läsa alla highscore-typer.',err)}
    const scopes=[...MAJOR_SCOPES];
    keys.map(parseBoardKey).filter(Boolean).forEach(board=>{if(!scopes.includes(board.scope))scopes.push(board.scope)});
    scopes.sort((a,b)=>{
      const ai=MAJOR_SCOPES.indexOf(a),bi=MAJOR_SCOPES.indexOf(b);
      if(ai>=0||bi>=0)return (ai<0?99:ai)-(bi<0?99:bi);
      return scopeLabelFromKey(a).localeCompare(scopeLabelFromKey(b),'sv');
    });
    ensureOptions(area,scopes,scopeLabelFromKey);
    area.value=scopes.includes(before)?before:'country:SE';
  }

  async function renderBoard(){
    const area=document.getElementById('highscoreAreaSelect');
    const type=document.getElementById('highscorePlaceTypeSelect');
    const duplicate=document.getElementById('highscoreDuplicateSelect');
    const host=document.getElementById('highscoreBrowserBoard');
    const note=document.getElementById('highscoreBrowserNote');
    const title=document.getElementById('highscoreBrowserTitle');
    if(!area||!type||!duplicate||!host||!note||!title)return;
    const token=++boardToken;
    const key=makeBoardKey(area.value,type.value,duplicate.value);
    const parsed=parseBoardKey(key);
    title.textContent=scopeLabelFromKey(parsed.scope);
    note.textContent=`Solo · ${placeTypeText(parsed.placeType)} · ${duplicateText(parsed.duplicatePolicy)}`;
    host.innerHTML='<div class="highscore-loading"><span></span>Hämtar topplistan…</div>';
    currentEntries=[];

    if(GLOBAL?.listByKey){
      try{
        const result=await GLOBAL.listByKey(key);if(token!==boardToken)return;
        currentEntries=(result.entries||[]).map(row=>({...row,boardKey:key}));
        host.innerHTML=boardRowsMarkup(currentEntries,key);
        return;
      }catch(err){console.warn('Global highscore kunde inte laddas.',err)}
    }

    if(token!==boardToken)return;
    const local=HS?.list?.(settingsFromBoard(parsed))||[];
    currentEntries=local.map(row=>({...row,boardKey:key,hasReplay:false}));
    host.innerHTML=boardRowsMarkup(currentEntries,key);
    note.textContent+=local.length?' · Visar lokala resultat eftersom den globala tjänsten inte kunde nås.':' · Global topplista kunde inte nås.';
  }

  function ensureBrowserModal(){
    if(document.getElementById('highscoreBrowserModal'))return;
    const modal=document.createElement('div');modal.id='highscoreBrowserModal';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    modal.innerHTML=`<div class="modal-backdrop"></div><section class="modal-card highscore-browser-card"><button class="modal-close" id="highscoreBrowserClose" type="button" aria-label="Stäng">×</button><span class="step-kicker">🏆 ALLA HIGHSCORES</span><div class="highscore-browser-heading"><div><h2 id="highscoreBrowserTitle">Highscores</h2><p id="highscoreBrowserNote">Välj topplista.</p></div></div><div class="highscore-filter-grid"><label><span>Område</span><select id="highscoreAreaSelect" class="select"></select></label><label><span>Ortfilter</span><select id="highscorePlaceTypeSelect" class="select"><option value="any">Alla orter</option><option value="urban">Större orter</option><option value="city">Städer</option></select></label><label><span>Dubblettregel</span><select id="highscoreDuplicateSelect" class="select"><option value="exact">Unik faktisk plats</option><option value="nameCountry">Namn + land</option><option value="allow">Återanvändning tillåten</option></select></label></div><div id="highscoreBrowserBoard" class="highscore-board" aria-live="polite"></div><p class="highscore-browser-footnote">Nya globala personbästa sparar även spelrutten. Äldre rekord kan därför sakna “Se omgång”.</p></section>`;
    document.body.appendChild(modal);
    const parsed=currentParsed();
    const type=document.getElementById('highscorePlaceTypeSelect');const duplicate=document.getElementById('highscoreDuplicateSelect');
    if(parsed){type.value=parsed.placeType;duplicate.value=parsed.duplicatePolicy}
    ['highscoreAreaSelect','highscorePlaceTypeSelect','highscoreDuplicateSelect'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderBoard));
    document.getElementById('highscoreBrowserBoard')?.addEventListener('click',event=>{
      const button=event.target.closest('[data-replay-index]');if(!button)return;
      const row=currentEntries[Number(button.dataset.replayIndex)];if(row)openReplay(row);
    });
    document.getElementById('highscoreBrowserClose')?.addEventListener('click',closeBrowser);
    modal.querySelector('.modal-backdrop')?.addEventListener('click',closeBrowser);
  }

  async function openBrowser(){
    ensureBrowserModal();
    document.getElementById('highscoreModal')?.classList.add('hidden');
    const modal=document.getElementById('highscoreBrowserModal');modal.classList.remove('hidden');
    const parsed=currentParsed();
    const area=document.getElementById('highscoreAreaSelect');
    if(parsed){document.getElementById('highscorePlaceTypeSelect').value=parsed.placeType;document.getElementById('highscoreDuplicateSelect').value=parsed.duplicatePolicy}
    await loadCatalog();
    if(parsed&&[...area.options].some(option=>option.value===parsed.scope))area.value=parsed.scope;
    await renderBoard();
  }
  function closeBrowser(){boardToken++;document.getElementById('highscoreBrowserModal')?.classList.add('hidden')}

  function routeWithUx(points){
    let previous=null;
    return points.map(point=>{
      let ux=point.lon;
      try{if(GEO?.unwrapLon)ux=GEO.unwrapLon(point.lon,previous)}catch{}
      previous=ux;return {...point,ux};
    });
  }

  function finalCrossings(points){
    if(!GEO?.intersectionOf||points.length<4)return [];
    const start=points.at(-2),end=points.at(-1),hits=[];
    for(let i=0;i<points.length-3;i++){
      try{const hit=GEO.intersectionOf(start,end,points[i],points[i+1]);if(hit)hits.push({...hit,startIndex:i,endIndex:i+1})}catch{}
    }
    return hits;
  }

  function segmentParts(a,b){
    try{if(GEO?.segmentParts)return GEO.segmentParts(a,b)}catch{}
    return [[[a.lat,a.lon],[b.lat,b.lon]]];
  }

  function ensureReplayMap(){
    if(replayMap)return replayMap;
    const el=document.getElementById('highscoreReplayMap');if(!el||!window.L)return null;
    replayMap=L.map(el,{zoomControl:true,minZoom:2,maxZoom:18,worldCopyJump:true,zoomSnap:.25,preferCanvas:true}).setView([20,0],2.3);
    replayTile=L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(replayMap);
    replayLayer=L.layerGroup().addTo(replayMap);
    return replayMap;
  }

  function marker(index,isLatest){
    return L.divIcon({className:'city-marker-wrap replay-marker-wrap',html:`<div class="replay-city-marker${isLatest?' latest':''}">${index+1}</div>`,iconSize:[26,26],iconAnchor:[13,13]});
  }

  function fitReplay(){
    if(!replayMap||!replayPoints.length)return;
    const lons=replayPoints.map(p=>p.lon);const span=Math.max(...lons)-Math.min(...lons);
    if(span>180){const last=replayPoints.at(-1);replayMap.setView([last.lat,last.lon],4);return}
    const bounds=L.latLngBounds(replayPoints.map(p=>[p.lat,p.lon]));replayMap.fitBounds(bounds,{padding:[38,38],maxZoom:6.5,animate:false});
  }

  function renderReplay(){
    if(!replayMap||!replayLayer)return;
    replayLayer.clearLayers();
    const visible=replayPoints.slice(0,replayStep);const atEnd=replayStep===replayPoints.length;
    const crossings=atEnd?finalCrossings(replayPoints):[];
    const crossed=new Set(crossings.map(hit=>`${hit.startIndex}:${hit.endIndex}`));
    for(let i=0;i<visible.length-1;i++){
      const a=visible[i],b=visible[i+1];const isFinal=atEnd&&i===visible.length-2;const wasCrossed=crossed.has(`${i}:${i+1}`);
      segmentParts(a,b).forEach(part=>L.polyline(part,{color:isFinal?'#ff6f74':'#68f6ff',weight:isFinal?6:4,opacity:.9,lineCap:'round',interactive:false}).addTo(replayLayer));
      if(wasCrossed)segmentParts(a,b).forEach(part=>L.polyline(part,{color:'#ffd86a',weight:8,opacity:.72,dashArray:'8 7',interactive:false}).addTo(replayLayer));
    }
    visible.forEach((point,index)=>{
      const m=L.marker([point.lat,point.lon],{icon:marker(index,index===visible.length-1),keyboard:false}).addTo(replayLayer);
      m.bindTooltip(`${safe(point.name)}${point.countryCode?` · ${safe(point.countryCode)}`:''}`,{direction:'top',offset:[0,-11]});
    });
    if(crossings[0]){
      const c=crossings[0];
      const icon=L.divIcon({className:'city-marker-wrap',html:'<div class="cross-marker">×</div>',iconSize:[30,30],iconAnchor:[15,15]});
      L.marker([c.lat,c.lon],{icon,interactive:false}).addTo(replayLayer);
    }
    const slider=document.getElementById('highscoreReplaySlider');if(slider)slider.value=String(replayStep);
    const status=document.getElementById('highscoreReplayStatus');const current=visible.at(-1);
    if(status)status.innerHTML=`<strong>${replayStep} / ${replayPoints.length}</strong><span>${current?`${safe(current.name)}${current.countryCode?` · ${safe(current.countryCode)}`:''}`:''}</span>`;
    document.querySelectorAll('#highscoreReplayRoute [data-step]').forEach(el=>el.classList.toggle('active',Number(el.dataset.step)===replayStep));
  }

  function stopReplay(){clearInterval(replayTimer);replayTimer=null;const play=document.getElementById('highscoreReplayPlay');if(play)play.textContent='▶ Spela'}
  function playReplay(){
    if(replayTimer){stopReplay();return}
    if(replayStep>=replayPoints.length)replayStep=1;
    renderReplay();const play=document.getElementById('highscoreReplayPlay');if(play)play.textContent='Ⅱ Pausa';
    replayTimer=setInterval(()=>{
      if(replayStep>=replayPoints.length){stopReplay();return}
      replayStep++;renderReplay();
    },650);
  }

  function ensureReplayModal(){
    if(document.getElementById('highscoreReplayModal'))return;
    const modal=document.createElement('div');modal.id='highscoreReplayModal';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    modal.innerHTML=`<div class="modal-backdrop"></div><section class="modal-card highscore-replay-card"><button class="modal-close" id="highscoreReplayClose" type="button" aria-label="Stäng">×</button><span class="step-kicker">▶ REPLAY</span><div class="highscore-replay-heading"><div><h2 id="highscoreReplayTitle">Spelomgång</h2><p id="highscoreReplayMeta"></p></div></div><div id="highscoreReplayMap" class="highscore-replay-map"></div><div class="highscore-replay-controls"><button id="highscoreReplayPrev" type="button">←</button><button id="highscoreReplayPlay" type="button" class="primary-button">▶ Spela</button><button id="highscoreReplayNext" type="button">→</button></div><input id="highscoreReplaySlider" class="highscore-replay-slider" type="range" min="1" max="1" value="1"><div id="highscoreReplayStatus" class="highscore-replay-status"></div><div id="highscoreReplayRoute" class="highscore-replay-route"></div><p class="highscore-replay-note">Den röda sista sträckan är draget som avslutade Solo-omgången. En korsad äldre sträcka markeras gult.</p></section>`;
    document.body.appendChild(modal);
    document.getElementById('highscoreReplayClose')?.addEventListener('click',closeReplay);
    modal.querySelector('.modal-backdrop')?.addEventListener('click',closeReplay);
    document.getElementById('highscoreReplayPrev')?.addEventListener('click',()=>{stopReplay();replayStep=Math.max(1,replayStep-1);renderReplay()});
    document.getElementById('highscoreReplayNext')?.addEventListener('click',()=>{stopReplay();replayStep=Math.min(replayPoints.length,replayStep+1);renderReplay()});
    document.getElementById('highscoreReplayPlay')?.addEventListener('click',playReplay);
    document.getElementById('highscoreReplaySlider')?.addEventListener('input',event=>{stopReplay();replayStep=Number(event.target.value)||1;renderReplay()});
    document.getElementById('highscoreReplayRoute')?.addEventListener('click',event=>{const step=event.target.closest('[data-step]');if(!step)return;stopReplay();replayStep=Number(step.dataset.step)||1;renderReplay()});
  }

  async function openReplay(row){
    if(!GLOBAL?.loadReplay||!row?.userId||!row?.boardKey||!row?.date)return message('Den här omgången går inte att spela upp.','error');
    ensureReplayModal();
    const modal=document.getElementById('highscoreReplayModal');modal.classList.remove('hidden');
    document.getElementById('highscoreReplayTitle').textContent=`${row.name} · ${row.score} orter`;
    document.getElementById('highscoreReplayMeta').textContent='Hämtar den sparade rutten…';
    document.getElementById('highscoreReplayRoute').innerHTML='<div class="highscore-loading"><span></span>Hämtar omgång…</div>';
    try{
      const replay=await GLOBAL.loadReplay(row.boardKey,row.userId,row.date);
      if(!replay?.points?.length){closeReplay();return message('Rutten finns inte sparad för det här resultatet.','error')}
      replayPoints=routeWithUx(replay.points);replayStep=replayPoints.length;
      document.getElementById('highscoreReplayMeta').textContent=`${scopeLabelFromKey(parseBoardKey(row.boardKey)?.scope||'world')} · ${HS?.formatDate?.(row.date)||''}`;
      const slider=document.getElementById('highscoreReplaySlider');slider.max=String(replayPoints.length);slider.value=String(replayStep);
      document.getElementById('highscoreReplayRoute').innerHTML=replayPoints.map((point,index)=>`<button type="button" data-step="${index+1}"><b>${String(index+1).padStart(2,'0')}</b><span>${D?.flag?.(point.countryCode)||''} ${safe(point.name)}</span></button>`).join('');
      ensureReplayMap();setTimeout(()=>{replayMap?.invalidateSize();fitReplay();renderReplay()},80);
    }catch(err){console.warn('Replay kunde inte hämtas.',err);closeReplay();message('Kunde inte hämta den sparade omgången.','error')}
  }

  function closeReplay(){stopReplay();document.getElementById('highscoreReplayModal')?.classList.add('hidden')}

  function interceptButton(button){
    if(!button||button.dataset.highscoreBrowserIntercepted)return;
    button.dataset.highscoreBrowserIntercepted='true';
    button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();openBrowser()},{capture:true});
  }

  function init(){
    injectStyles();ensureBrowserModal();ensureReplayModal();
    interceptButton(document.getElementById('highscoreButton'));
    interceptButton(document.getElementById('resultHighscoreButton'));
    const previewOpen=document.getElementById('highscorePreviewOpen');if(previewOpen)previewOpen.textContent='Alla highscores';
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      if(!document.getElementById('highscoreReplayModal')?.classList.contains('hidden'))closeReplay();
      else if(!document.getElementById('highscoreBrowserModal')?.classList.contains('hidden'))closeBrowser();
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
