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
    if(parts.length!==7||parts[0]!=='game'||parts[1]!=='1')return null;
    const stamp=Number(parts[2]),score=Math.floor(Number(row.score)||0);
    if(!Number.isFinite(stamp)||stamp<1)return null;
    return {id:parts[3],stamp,mode:parts[4],area:parts[5],room:parts[6]==='-'?'':parts[6],firstPlayer:String(row.player_name||''),score,updatedAt:row.updated_at?Date.parse(row.updated_at):stamp};
  }

  function parsePlayer(row){
    const parts=String(row?.board_key||'').split('|');
    if(parts.length!==5||parts[0]!=='gplayer'||parts[1]!=='1')return null;
    return {id:parts[2],index:Number(parts[3])||0,stat:parts[4],name:String(row.player_name||'Spelare')};
  }

  function parsePoint(row){
    const parts=String(row?.board_key||'').split('|');
    if(parts.length!==9||parts[0]!=='gpt'||parts[1]!=='1')return null;
    const round=Number(parts[3]),index=Number(parts[4]),lat=Number(parts[5]),lon=Number(parts[6]),playerIndex=Number(parts[7]);
    if(!Number.isFinite(round)||!Number.isFinite(index)||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
    return {id:parts[2],round,index,lat,lon,playerIndex:Number.isFinite(playerIndex)?playerIndex:0,countryCode:parts[8]==='-'?'':parts[8],name:String(row.player_name||`Ort ${index}`)};
  }

  function parseCrossing(row){
    const parts=String(row?.board_key||'').split('|');
    if(parts.length!==7||parts[0]!=='gx'||parts[1]!=='1')return null;
    const round=Number(parts[3]),index=Number(parts[4]),lat=Number(parts[5]),lon=Number(parts[6]);
    if(!Number.isFinite(round)||!Number.isFinite(index)||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
    return {id:parts[2],round,index,lat,lon};
  }

  function parseStreet(row){
    const parts=String(row?.board_key||'').split('|');
    if(parts.length!==6||parts[0]!=='gst'||parts[1]!=='1')return null;
    return {id:parts[2],round:Number(parts[3])||1,index:Number(parts[4])||1,scores:parts[5],name:String(row.player_name||'Gata')};
  }

  function modeText(mode){return ({classic:'⚡ Klassisk',endurance:'🛡️ Tålighet',elimination:'🏆 Utslagning',duel:'⚔️ Duell',solo:'🧭 Solo',street:'🏙️ Gatduell'})[mode]||mode||'Orten'}
  function areaText(area){return ({WORLD:'Världen',EUROPE:'Europa',NORDIC:'Norden',UMEA:'Umeå',SE:'Sverige',CUSTOM:'Eget område'})[area]||area||'Okänt område'}
  function dateText(stamp){try{return new Intl.DateTimeFormat('sv-SE',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(stamp))}catch{return ''}}
  function playerNames(id,first=''){
    const names=(playerMap.get(id)||[]).sort((a,b)=>a.index-b.index).map(player=>player.name).filter(Boolean);
    return names.length?names.join(' · '):(first||'Okänd spelare');
  }

  async function loadHistory(){
    $('refresh').disabled=true;
    $('status').className='status loading';
    $('status').textContent='Hämtar spelhistorik…';
    $('list').innerHTML='';
    try{
      const [summaryResult,playerResult]=await Promise.all([
        client.from(TABLE).select('player_name,score,updated_at,board_key').like('board_key','game|1|%').order('updated_at',{ascending:false}).limit(1500),
        client.from(TABLE).select('player_name,board_key').like('board_key','gplayer|1|%').limit(10000)
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
      $('status').textContent=games.length?`${games.length} genomförda spel hittades.`:'Inga spel har sparats med den nya historiken ännu.';
    }catch(error){
      console.error(error);
      $('status').className='status error';
      $('status').textContent='Kunde inte hämta spelhistoriken. Försök igen.';
    }finally{$('refresh').disabled=false}
  }

  function renderList(){
    if(!games.length){$('list').innerHTML='<div class="empty">Nya genomförda spel kommer att visas här automatiskt.</div>';return}
    $('list').innerHTML=games.map((game,index)=>`<article class="game-row"><button type="button" data-game="${index}"><div class="game-main"><span class="time">${safe(dateText(game.stamp))}</span><strong>${safe(modeText(game.mode))} · ${safe(areaText(game.area))}</strong><small>${safe(playerNames(game.id,game.firstPlayer))}${game.room?` · Online ${safe(game.room)}`:''}</small></div><div class="score"><b>${game.score}</b><span>drag</span></div><span class="arrow">→</span></button></article>`).join('');
    $('list').querySelectorAll('[data-game]').forEach(button=>button.addEventListener('click',()=>openGame(games[Number(button.dataset.game)])));
  }

  function destroyMap(){if(map){try{map.remove()}catch{}map=null;mapLayer=null}}

  async function loadGameRows(id){
    const [pointsResult,crossResult,streetResult,playersResult]=await Promise.all([
      client.from(TABLE).select('player_name,score,board_key').like('board_key',`gpt|1|${id}|%`).limit(2500),
      client.from(TABLE).select('player_name,score,board_key').like('board_key',`gx|1|${id}|%`).limit(300),
      client.from(TABLE).select('player_name,score,board_key').like('board_key',`gst|1|${id}|%`).limit(1500),
      client.from(TABLE).select('player_name,score,board_key').like('board_key',`gplayer|1|${id}|%`).limit(20)
    ]);
    for(const result of [pointsResult,crossResult,streetResult,playersResult])if(result.error)throw result.error;
    const unique=(rows,parser,keyFn)=>{
      const map=new Map();for(const row of rows||[]){const parsed=parser(row);if(parsed)map.set(keyFn(parsed),parsed)}return [...map.values()];
    };
    return {
      points:unique(pointsResult.data,parsePoint,item=>`${item.round}|${item.index}|${item.playerIndex}|${item.lat}|${item.lon}`),
      crossings:unique(crossResult.data,parseCrossing,item=>`${item.round}|${item.index}|${item.lat}|${item.lon}`),
      streets:unique(streetResult.data,parseStreet,item=>`${item.round}|${item.index}|${item.name}`),
      players:unique(playersResult.data,parsePlayer,item=>`${item.index}|${item.name}`).sort((a,b)=>a.index-b.index)
    };
  }

  async function openGame(game){
    destroyMap();
    $('historyView').classList.add('hidden');
    $('detailView').classList.remove('hidden');
    $('detailView').innerHTML=`<button id="back" class="back" type="button">← Alla spel</button><div class="detail-head"><div><span class="eyebrow">${safe(dateText(game.stamp))}</span><h2>${safe(modeText(game.mode))} · ${safe(areaText(game.area))}</h2><p>${safe(playerNames(game.id,game.firstPlayer))}</p></div><div class="big-score"><b>${game.score}</b><span>DRAG</span></div></div><div class="detail-loading">Hämtar spelomgången…</div>`;
    $('back').addEventListener('click',()=>{destroyMap();$('detailView').classList.add('hidden');$('historyView').classList.remove('hidden')});
    try{
      const data=await loadGameRows(game.id);
      const names=data.players.length?data.players.map(player=>player.name).join(' · '):playerNames(game.id,game.firstPlayer);
      $('detailView').innerHTML=`<button id="back" class="back" type="button">← Alla spel</button><div class="detail-head"><div><span class="eyebrow">${safe(dateText(game.stamp))}</span><h2>${safe(modeText(game.mode))} · ${safe(areaText(game.area))}</h2><p>${safe(names)}${game.room?` · Online ${safe(game.room)}`:''}</p></div><div class="big-score"><b>${game.score}</b><span>${game.mode==='street'?'GATVAL':'DRAG'}</span></div></div><div id="detailContent"></div>`;
      $('back').addEventListener('click',()=>{destroyMap();$('detailView').classList.add('hidden');$('historyView').classList.remove('hidden')});
      if(game.mode==='street')renderStreet(data.streets);else renderRoute(game,data.points,data.crossings);
    }catch(error){
      console.error(error);
      $('detailView').querySelector('.detail-loading')?.remove();
      $('detailView').insertAdjacentHTML('beforeend','<div class="empty error-box">Kunde inte hämta detaljerna för den här spelomgången.</div>');
    }
  }

  function renderStreet(streets){
    const host=$('detailContent');
    const rounds=new Map();
    for(const street of streets){if(!rounds.has(street.round))rounds.set(street.round,[]);rounds.get(street.round).push(street)}
    const html=[...rounds.entries()].sort((a,b)=>a[0]-b[0]).map(([round,items])=>{
      items.sort((a,b)=>a.index-b.index);
      const score=items.at(-1)?.scores||'';
      return `<article class="street-round"><div><strong>Runda ${round}</strong>${score?`<span>Ställning ${safe(score)}</span>`:''}</div><p>${items.map((item,index)=>`<b>${index+1}. ${safe(item.name)}</b>`).join('<i>→</i>')}</p></article>`;
    }).join('');
    host.innerHTML=html||'<div class="empty">Ingen gatkedja sparades för matchen.</div>';
  }

  function renderRoute(game,points,crossings){
    const host=$('detailContent');
    const rounds=[...new Set(points.map(point=>point.round))].sort((a,b)=>a-b);
    if(!rounds.length){host.innerHTML='<div class="empty">Ingen rutt sparades för matchen.</div>';return}
    host.innerHTML=`${rounds.length>1?`<div class="round-picker"><label for="roundSelect">Runda</label><select id="roundSelect">${rounds.map(round=>`<option value="${round}">Runda ${round}</option>`).join('')}</select></div>`:''}<div id="historyMap" class="map"></div><ol id="routeList" class="route-list"></ol>`;
    const draw=round=>drawRound(game,round,points,crossings);
    $('roundSelect')?.addEventListener('change',event=>draw(Number(event.target.value)));
    draw(rounds[0]);
  }

  function drawRound(game,round,points,crossings){
    destroyMap();
    const current=points.filter(point=>point.round===round).sort((a,b)=>a.index-b.index);
    const cross=crossings.filter(item=>item.round===round);
    const host=$('historyMap'),list=$('routeList');
    if(list)list.innerHTML=current.map(point=>`<li><b>${String(point.index).padStart(2,'0')}</b><span>${safe(point.name)}${point.countryCode?`<small>${safe(point.countryCode)}</small>`:''}</span></li>`).join('');
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
  loadHistory();
})();
