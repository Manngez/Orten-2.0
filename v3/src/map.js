import {segmentParts} from './geometry.js';

const PLAYER_COLORS=['#68f6ff','#ff8f70','#ffd86a','#73f5a7'];
const TILE_URL='https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
const TILE_ATTR='&copy; OpenStreetMap contributors &copy; CARTO';

export function createGameMap(element){
  const L=globalThis.L;
  if(!L)throw new Error('Kartbiblioteket Leaflet kunde inte laddas.');
  if(!element)throw new Error('Kartytan saknas.');

  const map=L.map(element,{
    zoomControl:false,
    minZoom:2,
    maxZoom:18,
    worldCopyJump:true,
    zoomSnap:.25,
    zoomDelta:.5,
    wheelPxPerZoomLevel:80,
    inertia:true,
    preferCanvas:true
  }).setView([24,8],2.35);

  L.tileLayer(TILE_URL,{
    subdomains:'abcd',
    maxZoom:20,
    attribution:TILE_ATTR
  }).addTo(map);
  L.control.zoom({position:'bottomright'}).addTo(map);

  const routeLayer=L.layerGroup().addTo(map);
  let userNavigatingUntil=0;
  let programmatic=false;
  let lastPlaceCount=-1;

  const markUserNavigation=()=>{
    if(!programmatic)userNavigatingUntil=Date.now()+7000;
  };
  map.on('dragstart',markUserNavigation);
  map.on('zoomstart',markUserNavigation);
  element.addEventListener('wheel',markUserNavigation,{passive:true});
  element.addEventListener('touchstart',markUserNavigation,{passive:true});

  const runProgrammatic=action=>{
    programmatic=true;
    action();
    setTimeout(()=>{programmatic=false},900);
  };

  function fitState(state,force=false){
    if(!state?.places?.length)return;
    if(!force&&Date.now()<userNavigatingUntil)return;
    const places=state.places;
    if(places.length===1){
      const p=places[0];
      runProgrammatic(()=>map.flyTo([p.lat,p.lon],6,{duration:.55}));
      return;
    }

    const recent=places.length>8?places.slice(-6):places;
    const lonSpan=Math.max(...recent.map(p=>p.lon))-Math.min(...recent.map(p=>p.lon));
    if(lonSpan>180){
      const p=places.at(-1);
      runProgrammatic(()=>map.flyTo([p.lat,p.lon],4.5,{duration:.55}));
      return;
    }

    const bounds=L.latLngBounds(recent.map(p=>[p.lat,p.lon]));
    runProgrammatic(()=>map.flyToBounds(bounds,{padding:[54,54],maxZoom:6.5,duration:.55}));
  }

  function render(state,{forceFit=false}={}){
    routeLayer.clearLayers();
    if(!state)return;

    for(const segment of state.segments||[]){
      const color=PLAYER_COLORS[segment.playerIndex%PLAYER_COLORS.length];
      for(const part of segmentParts(segment.a,segment.b)){
        L.polyline(part,{color,weight:5,opacity:.92,lineCap:'round',interactive:false}).addTo(routeLayer);
      }
    }

    (state.places||[]).forEach((place,index)=>{
      const color=PLAYER_COLORS[place.playerIndex%PLAYER_COLORS.length];
      const marker=L.circleMarker([place.lat,place.lon],{
        radius:index===state.places.length-1?8:6,
        weight:3,
        color:'#06111d',
        fillColor:color,
        fillOpacity:1
      }).addTo(routeLayer);
      const region=place.region?` · ${place.region}`:'';
      const country=place.country||place.countryCode||'';
      marker.bindTooltip(`${place.name}${country?` · ${country}`:''}${region}`,{
        direction:'top',
        offset:[0,-8],
        className:'v3-city-tooltip'
      });
    });

    if(state.crossing&&Number.isFinite(state.crossing.lat)&&Number.isFinite(state.crossing.lon)){
      L.circleMarker([state.crossing.lat,state.crossing.lon],{
        radius:11,
        weight:3,
        color:'#ffffff',
        fillColor:'#ff5f6d',
        fillOpacity:1,
        interactive:false
      }).addTo(routeLayer);
    }

    if(forceFit||state.places.length!==lastPlaceCount)fitState(state,forceFit);
    lastPlaceCount=state.places.length;
  }

  function invalidate(){setTimeout(()=>map.invalidateSize(),40);}
  function reset(){runProgrammatic(()=>map.setView([24,8],2.35,{animate:false}));}
  function destroy(){map.remove();}

  return {render,fitState,invalidate,reset,destroy,map};
}
