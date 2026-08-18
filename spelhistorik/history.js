'use strict';

(() => {
  const PROJECT_URL='https://mewauzsogkbcchnvsath.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_lWTB9F286pzThGxYp3Zj2w_uIco-VDU';
  const TABLE='orten_highscores';
  const client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const $=id=>document.getElementById(id);
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const COLORS=['#68f6ff','#ff8f70','#ffd86a','#73f5a7','#c69cff','#75a7ff'];

  let games=[];
  let playerMap=new Map();
  let map=null;
  let mapLayer=null;

  function parseSummary(row){
    const parts=String(row?.board_key||'').split('|');
    if(parts.length!==8||parts[0]!=='replay'||parts[1]!=='game'||parts[2]!=='1')return null;
    const stamp=Number(parts[3]),score=Math.floor(Number(row.score)||0);
    if(!Number.isFinite(stamp)||stamp<1)return null;
    return {id:parts[4],stamp,mode:parts[5],area:parts[6],room:parts[7]==='-'?'':parts[7],firstPlayer:String(row.player_name||''),score,updatedAt:row.updated_at?Date.parse(row.updated_at):stamp};
  }

  function parsePlayer(row){
    const parts=String(row?.board_key||'').split('|');
    if(parts.length!==6||parts[0]!=='replay'||parts[1]!=='player'||parts[2]!=='1')return null;
    return {id:parts[3],index:Number(parts[4])||0,stat:parts[5],name:String(row.player_name||'Spelare')};
  }

  function parsePoint(row){
    const parts=String(row?.board_key||'').split('|');
    if(parts.length!==10||parts[0]!=='replay'||parts[1]!=='pt'||parts[2]!=='1')return null;
    const round=Number(parts[4]),index=Number(parts[5]),lat=Number(parts[6]),lon=Number(parts[7]),playerIndex=Number(parts[8]);
    if(!Number.isFinite(round)||!Number.isFinite(index)||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
    return {id:parts[3],round,index,lat,lon,playerIndex:Number.isFinite(playerIndex)?playerIndex:0,countryCode:parts[9]==='-'?'':parts[9],name:String(row.player_name||`Ort ${index}`)};
  }

  function parseCrossing(row){
    const parts=String(row?.board_key||'').split('|');
    if(parts.length!==8||parts[0]!=='replay'||parts[1]!=='x'||parts[2]!=='1')return null;
    const round=Number(parts[4]),index=Number(parts[5]),lat=Number(parts[6]),lon=Number(parts[7]);
    if(!Number.isFinite(round)||!Number.isFinite(index)||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
    return {id:parts[3],round,index,lat,lon};
  }

  function parseStreet(row){
    const parts=String(row?.board_key||'').split('|');
    if(parts.length!==7||parts[0]!=='replay'||parts[1]!=='street'||parts[2]!=='1')return null;
    return {id:parts[3],round:Number(parts[4])||1,index:Number(parts[5])||1,scores:parts[6],name:String(row.player_name||'Gata')};
  }

  function modeText(mode){return ({classic:'⚡ Klassisk',endurance:'🛡️ Tålighet',elimination:'🏆 Utslagning',duel:'⚔️ Duell',solo:'🧭 Solo',street:'🏙️ Gatduell'})[mode]||mode||'Orten'}
  function modePlain(mode){return ({classic:'Klassisk',endurance:'Tålighet',elimination:'Utslagning',duel:'Duell',solo:'Solo',street:'Gatduell'})[mode]||mode||'Orten'}
  function areaText(area){return ({WORLD:'Världen',EUROPE:'Europa',NORDIC:'Norden',UMEA:'Umeå',SE:'Sverige',CUSTOM:'Eget område'})[area]||area||'Okänt område'}
  function dateText(stamp){try{return new Intl.DateTimeFormat('sv-SE',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(stamp))}catch{return ''}}
  function shortDateText(stamp){try{return new Intl.DateTimeFormat('sv-SE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(stamp))}catch{return ''}}
  function localDateKey(stamp){
    const date=new Date(stamp);if(Number.isNaN(date.getTime()))return '';
    const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,'0'),day=String(date.getDate()).padStart(2,'0');
    return `${year}-${month}-${day}`;
  }
  function playerNames(id,first=''){
    const names=(playerMap.get(id)||[]).sort((a,b)=>a.index-b.index).map(player=>player.name).filter(Boolean);
    return names.length?names.join(' · '):(first||'Okänd spelare');
  }

  function filteredGames(){
    const mode=$('modeFilter')?.value||'all';
    const period=$('periodFilter')?.value||'all';
    const specific=$('dateFilter')?.value||'';
    const now=Date.now();
    const startToday=new Date();startToday.setHours(0,0,0,0);
    return games.filter(game=>{
      if(mode!=='all'&&game.mode!==mode)return false;
      if(specific&&localDateKey(game.stamp)!==specific)return false;
      if(!specific){
        if(period==='today'&&game.stamp<startToday.getTime())return false;
        if(period==='24h'&&game.stamp<now-86400000)return false;
        if(period==='7d'&&game.stamp<now-7*86400000)return false;
        if(period==='30d'&&game.stamp<now-30*86400000)return false;
      }
      return true;
    });
  }

  function filtersActive(){return ($('modeFilter')?.value||'all')!=='all'||($('periodFilter')?.value||'all')!=='all'||!!$('dateFilter')?.value}

  async function loadHistory(){
    $('refresh').disabled=true;
    $('status').className='status loading';
    $('status').textContent='Hämtar spelhistorik…';
    $('list').innerHTML='';
    try{
      const [summaryResult,playerResult]=await Promise.all([
        client.from(TABLE).select('player_name,score,updated_at,board_key').like('board_key','replay|game|1|%').order('updated_at',{ascending:false}).limit(1500),
        client.from(TABLE).select('player_name,board_key').like('board_key','replay|player|1|%').limit(10000)
      ]);
      if(summaryResult.error)throw summaryResult.error;
      if(playerResult.error)throw playerResult.error;

      playerMap=new Map();
      for(const row of playerResult.data||[]){
        const player=parsePlayer(row);if(!player)continue;
        const list=playerMap.get(player.id)||[];
        if(!list.some(item=>item.index===player.index&&item.name===player.name))list.push(player);
        playerMap.set(player.id,list);
      }

      const deduped=new Map();
      for(const row of summaryResult.data||[]){
        const game=parseSummary(row);if(!game)continue;
        const current=deduped.get(game.id);
        if(!current||game.updatedAt>current.updatedAt)deduped.set(game.id,game);
      }
      games=[...deduped.values()].sort((a,b)=>b.stamp-a.stamp);
      renderList();
      $('status').className='status ok';
      $('status').textContent=games.length?`${games.length} genomförda spel laddade.`:'Inga spel har sparats med den nya historiken ännu.';
    }catch(error){
      console.error(error);
      $('status').className='status error';
      $('status').textContent='Kunde inte hämta spelhistoriken. Försök igen.';
      $('filterCount').textContent='0 spel';
    }finally{$('refresh').disabled=false}
  }

  function renderList(){
    const visible=filteredGames();
    $('filterCount').textContent=filtersActive()?`${visible.length} av ${games.length} spel`:`${games.length} spel`;
    if(!games.length){$('list').innerHTML='<div class="empty">Nya genomförda spel kommer att visas här automatiskt.</div>';return}
    if(!visible.length){$('list').innerHTML='<div class="empty">Inga spel matchar de valda filtren.</div>';return}
    $('list').innerHTML=visible.map(game=>`<article class="game-row"><button type="button" data-game-id="${safe(game.id)}"><div class="game-main"><span class="time">${safe(dateText(game.stamp))}</span><strong>${safe(modeText(game.mode))} · ${safe(areaText(game.area))}</strong><small>${safe(playerNames(game.id,game.firstPlayer))}${game.room?` · Online ${safe(game.room)}`:''}</small></div><div class="score"><b>${game.score}</b><span>${game.mode==='street'?'gatval':'drag'}</span></div><span class="arrow">→</span></button></article>`).join('');
    $('list').querySelectorAll('[data-game-id]').forEach(button=>button.addEventListener('click',()=>{
      const game=games.find(item=>item.id===button.dataset.gameId);if(game)openGame(game);
    }));
  }

  function destroyMap(){if(map){try{map.remove()}catch{}map=null;mapLayer=null}}

  async function loadGameRows(id){
    const [pointsResult,crossResult,streetResult,playersResult]=await Promise.all([
      client.from(TABLE).select('player_name,score,board_key').like('board_key',`replay|pt|1|${id}|%`).limit(2500),
      client.from(TABLE).select('player_name,score,board_key').like('board_key',`replay|x|1|${id}|%`).limit(300),
      client.from(TABLE).select('player_name,score,board_key').like('board_key',`replay|street|1|${id}|%`).limit(1500),
      client.from(TABLE).select('player_name,score,board_key').like('board_key',`replay|player|1|${id}|%`).limit(20)
    ]);
    for(const result of [pointsResult,crossResult,streetResult,playersResult])if(result.error)throw result.error;
    const unique=(rows,parser,keyFn)=>{
      const values=new Map();for(const row of rows||[]){const parsed=parser(row);if(parsed)values.set(keyFn(parsed),parsed)}return [...values.values()];
    };
    return {
      points:unique(pointsResult.data,parsePoint,item=>`${item.round}|${item.index}|${item.playerIndex}|${item.lat}|${item.lon}`),
      crossings:unique(crossResult.data,parseCrossing,item=>`${item.round}|${item.index}|${item.lat}|${item.lon}`),
      streets:unique(streetResult.data,parseStreet,item=>`${item.round}|${item.index}|${item.name}`),
      players:unique(playersResult.data,parsePlayer,item=>`${item.index}|${item.name}`).sort((a,b)=>a.index-b.index)
    };
  }

  function statText(player){
    const match=String(player?.stat||'').match(/^([sk])(\d+)$/);if(!match)return '';
    const value=Number(match[2])||0;
    return match[1]==='s'?`${value} poäng`:`${value} korsning${value===1?'':'ar'}`;
  }

  function playerCards(players){
    if(!players?.length)return '';
    return `<section class="player-section"><div class="detail-section-title"><h3>Spelare</h3><span>${players.length} ${players.length===1?'spelare':'spelare'}</span></div><div class="player-cards">${players.map((player,index)=>`<div class="player-card"><i style="--player:${COLORS[index%COLORS.length]}"></i><div><strong>${safe(player.name)}</strong>${statText(player)?`<span>${safe(statText(player))}</span>`:''}</div></div>`).join('')}</div></section>`;
  }

  function detailSummary(game,data){
    const rounds=game.mode==='street'?[...new Set(data.streets.map(item=>item.round))]:[...new Set(data.points.map(item=>item.round))];
    const moveCount=game.mode==='street'?data.streets.length:data.points.length;
    const cards=[
      ['Spelläge',modePlain(game.mode)],
      ['Område',areaText(game.area)],
      ['Tid',shortDateText(game.stamp)],
      [game.mode==='street'?'Gatval':'Drag',String(game.score||moveCount)],
      ['Rundor',String(rounds.length||1)],
      ['Spelare',String(data.players.length||1)]
    ];
    if(game.mode!=='street')cards.push(['Korsningar',String(data.crossings.length)]);
    cards.push(['Typ',game.room?`Online ${game.room}`:'Lokalt spel']);
    return `<div class="detail-summary">${cards.map(([label,value],index)=>`<div class="summary-card${index===3?' accent':''}"><span>${safe(label)}</span><strong>${safe(value)}</strong></div>`).join('')}</div>`;
  }

  function bindBack(){
    $('back')?.addEventListener('click',()=>{destroyMap();$('detailView').classList.add('hidden');$('historyView').classList.remove('hidden');window.scrollTo({top:0,behavior:'auto'})});
  }

  async function openGame(game){
    destroyMap();
    $('historyView').classList.add('hidden');
    $('detailView').classList.remove('hidden');
    $('detailView').innerHTML=`<button id="back" class="back" type="button">← Alla spel</button><div class="detail-head"><div class="detail-head-copy"><span class="eyebrow">${safe(dateText(game.stamp))}</span><h2>${safe(modeText(game.mode))} · ${safe(areaText(game.area))}</h2><p>${safe(playerNames(game.id,game.firstPlayer))}</p></div><div class="big-score"><b>${game.score}</b><span>${game.mode==='street'?'GATVAL':'DRAG'}</span></div></div><div class="detail-loading">Hämtar spelomgången…</div>`;
    bindBack();
    window.scrollTo({top:0,behavior:'auto'});
    try{
      const data=await loadGameRows(game.id);
      const names=data.players.length?data.players.map(player=>player.name).join(' · '):playerNames(game.id,game.firstPlayer);
      $('detailView').innerHTML=`<button id="back" class="back" type="button">← Alla spel</button><div class="detail-head"><div class="detail-head-copy"><span class="eyebrow">${safe(dateText(game.stamp))}</span><h2>${safe(modeText(game.mode))} · ${safe(areaText(game.area))}</h2><p>${safe(names)}${game.room?` · Online ${safe(game.room)}`:''}</p></div><div class="big-score"><b>${game.score}</b><span>${game.mode==='street'?'GATVAL':'DRAG'}</span></div></div>${detailSummary(game,data)}${playerCards(data.players)}<div id="detailContent"></div>`;
      bindBack();
      if(game.mode==='street')renderStreet(data.streets,data.players);else renderRoute(game,data.points,data.crossings,data.players);
    }catch(error){
      console.error(error);
      $('detailView').querySelector('.detail-loading')?.remove();
      $('detailView').insertAdjacentHTML('beforeend','<div class="empty error-box">Kunde inte hämta detaljerna för den här spelomgången.</div>');
    }
  }

  function renderStreet(streets,players=[]){
    const host=$('detailContent');
    const rounds=new Map();
    for(const street of streets){if(!rounds.has(street.round))rounds.set(street.round,[]);rounds.get(street.round).push(street)}
    const ordered=[...rounds.entries()].sort((a,b)=>a[0]-b[0]);
    const lastItems=ordered.at(-1)?.[1]||[];
    const finalScore=[...lastItems].sort((a,b)=>a.index-b.index).at(-1)?.scores||'';
    let winner='';
    const scoreParts=finalScore.split('-').map(Number);
    if(players.length>=2&&scoreParts.length===2&&scoreParts.every(Number.isFinite)&&scoreParts[0]!==scoreParts[1])winner=players[scoreParts[0]>scoreParts[1]?0:1]?.name||'';
    const overview=`<div class="detail-section-title"><h3>Matchförlopp</h3><span>${winner?`Vinnare: ${safe(winner)}`:'Gatduell'}</span></div><div class="street-overview"><div class="summary-card"><span>Rundor</span><strong>${ordered.length}</strong></div><div class="summary-card"><span>Gatval</span><strong>${streets.length}</strong></div><div class="summary-card accent"><span>Slutställning</span><strong>${safe(finalScore||'–')}</strong></div></div>`;
    const html=ordered.map(([round,items])=>{
      items.sort((a,b)=>a.index-b.index);
      const score=items.at(-1)?.scores||'';
      return `<article class="street-round"><div><strong>Runda ${round}</strong>${score?`<span>Ställning ${safe(score)}</span>`:''}</div><p>${items.map((item,index)=>`<b>${index+1}. ${safe(item.name)}</b>`).join('<i>→</i>')}</p></article>`;
    }).join('');
    host.innerHTML=overview+(html||'<div class="empty">Ingen gatkedja sparades för matchen.</div>');
  }

  function renderRoute(game,points,crossings,players=[]){
    const host=$('detailContent');
    const rounds=[...new Set(points.map(point=>point.round))].sort((a,b)=>a-b);
    if(!rounds.length){host.innerHTML='<div class="empty">Ingen rutt sparades för matchen.</div>';return}
    host.innerHTML=`<div class="detail-section-title"><div><h3>Spelrutt</h3>${crossings.length?`<span class="crossing-note"><i></i>${crossings.length} registrerade korsningar</span>`:''}</div>${rounds.length>1?`<div class="round-picker"><label for="roundSelect">Runda</label><select id="roundSelect">${rounds.map(round=>`<option value="${round}">Runda ${round}</option>`).join('')}</select></div>`:''}</div><div id="historyMap" class="map"></div><ol id="routeList" class="route-list"></ol>`;
    const draw=round=>drawRound(game,round,points,crossings,players);
    $('roundSelect')?.addEventListener('change',event=>draw(Number(event.target.value)));
    draw(rounds[0]);
  }

  function drawRound(game,round,points,crossings,players=[]){
    destroyMap();
    const current=points.filter(point=>point.round===round).sort((a,b)=>a.index-b.index);
    const cross=crossings.filter(item=>item.round===round);
    const host=$('historyMap'),list=$('routeList');
    if(list)list.innerHTML=current.map(point=>{
      const player=players[point.playerIndex];
      const sub=[point.countryCode,game.mode==='duel'&&player?.name?player.name:''].filter(Boolean).join(' · ');
      return `<li><b>${String(point.index).padStart(2,'0')}</b><span>${safe(point.name)}${sub?`<small>${safe(sub)}</small>`:''}</span>${game.mode==='duel'?`<i class="route-player" style="background:${COLORS[point.playerIndex%COLORS.length]}"></i>`:''}</li>`;
    }).join('');
    if(!host||!window.L||!current.length)return;
    map=L.map(host,{zoomControl:true,minZoom:2,maxZoom:18,worldCopyJump:true,preferCanvas:true}).setView([20,0],2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(map);
    mapLayer=L.layerGroup().addTo(map);

    if(game.mode==='duel'){
      const groups=new Map();
      for(const point of current){if(!groups.has(point.playerIndex))groups.set(point.playerIndex,[]);groups.get(point.playerIndex).push(point)}
      for(const [playerIndex,route] of groups){if(route.length>1)L.polyline(route.map(point=>[point.lat,point.lon]),{color:COLORS[playerIndex%COLORS.length],weight:5,opacity:.9}).addTo(mapLayer)}
    }else if(current.length>1)L.polyline(current.map(point=>[point.lat,point.lon]),{color:COLORS[0],weight:5,opacity:.9}).addTo(mapLayer);

    current.forEach(point=>L.circleMarker([point.lat,point.lon],{radius:7,color:COLORS[(game.mode==='duel'?point.playerIndex:0)%COLORS.length],weight:3,fillOpacity:.95}).addTo(mapLayer).bindTooltip(`${point.index}. ${point.name}`,{direction:'top'}));
    cross.forEach(item=>L.circleMarker([item.lat,item.lon],{radius:10,color:'#ff5c5c',weight:4,fillOpacity:.2}).addTo(mapLayer).bindTooltip('Korsning',{direction:'top'}));
    const bounds=L.latLngBounds(current.map(point=>[point.lat,point.lon]));
    if(bounds.isValid())map.fitBounds(bounds,{padding:[35,35],maxZoom:8});
    setTimeout(()=>map?.invalidateSize(),80);
  }

  $('refresh').addEventListener('click',loadHistory);
  $('modeFilter').addEventListener('change',renderList);
  $('periodFilter').addEventListener('change',()=>{if($('periodFilter').value!=='all')$('dateFilter').value='';renderList()});
  $('dateFilter').addEventListener('change',()=>{if($('dateFilter').value)$('periodFilter').value='all';renderList()});
  $('clearFilters').addEventListener('click',()=>{$('modeFilter').value='all';$('periodFilter').value='all';$('dateFilter').value='';renderList()});
  loadHistory();
})();
