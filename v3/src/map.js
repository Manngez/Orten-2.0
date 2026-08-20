import {segmentParts} from './geometry.js';

const PLAYER_COLORS=['#68f6ff','#ff8f70','#ffd86a','#73f5a7'];
const TILE_URL='https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
const TILE_ATTR='&copy; OpenStreetMap contributors &copy; CARTO';

export function validLatLng(point){
  const lat=Number(point?.lat),lon=Number(point?.lon);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
}

export function validLatLngPair(pair){
  const lat=Number(pair?.[0]),lon=Number(pair?.[1]);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
}

export function createGameMap(element,{onWarning=()=>{}}={}){
  const L=globalThis.L;
  if(!L)throw new Error('Kartbiblioteket Leaflet kunde inte laddas.');
  if(!element)throw new Error('Kartytan saknas.');

  const warn=(type,detail='')=>{try{onWarning(type,detail)}catch{}};
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

  function focusPlace(place){
    if(!validLatLng(place)){warn('map:invalid-place',String(place?.id||place?.name||'okänd'));return;}
    runProgrammatic(()=>map.flyTo([Number(place.lat),Number(place.lon)],Math.max(map.getZoom(),6.5),{duration:.5}));
  }

  function fitState(state,force=false){
    const places=(state?.places||[]).filter(validLatLng);
    if(!places.length)return;
    if(places.length!==(state?.places||[]).length)warn('map:invalid-place','fitState filtrerade ogiltig ort');
    if(!force&&Date.now()<userNavigatingUntil)return;
    if(places.length===1){focusPlace(places[0]);return;}

    const recent=places.length>8?places.slice(-6):places;
    const lonSpan=Math.max(...recent.map(p=>Number(p.lon)))-Math.min(...recent.map(p=>Number(p.lon)));
    if(lonSpan>180){
      const p=places.at(-1);
      runProgrammatic(()=>map.flyTo([Number(p.lat),Number(p.lon)],4.5,{duration:.55}));
      return;
    }

    const bounds=L.latLngBounds(recent.map(p=>[Number(p.lat),Number(p.lon)]));
    runProgrammatic(()=>map.flyToBounds(bounds,{padding:[54,54],maxZoom:6.5,duration:.55}));
  }

  function render(state,{forceFit=false}={}){
    routeLayer.clearLayers();
    if(!state)return;

    for(const segment of state.segments||[]){
      if(!validLatLng(segment?.a)||!validLatLng(segment?.b)){
        warn('map:invalid-segment',`${segment?.a?.id||'?'}→${segment?.b?.id||'?'}`);
        continue;
      }
      const color=PLAYER_COLORS[(Number(segment.playerIndex)||0)%PLAYER_COLORS.length];
      for(const part of segmentParts(segment.a,segment.b)){
        if(!Array.isArray(part)||part.length<2||part.some(pair=>!validLatLngPair(pair))){warn('map:invalid-segment-part',`${segment?.a?.id||'?'}→${segment?.b?.id||'?'}`);continue;}
        L.polyline(part.map(pair=>[Number(pair[0]),Number(pair[1])]),{color,weight:5,opacity:.92,lineCap:'round',interactive:false}).addTo(routeLayer);
      }
    }

    (state.places||[]).forEach((place,index)=>{
      if(!validLatLng(place)){warn('map:invalid-place',String(place?.id||place?.name||index));return;}
      const color=PLAYER_COLORS[(Number(place.playerIndex)||0)%PLAYER_COLORS.length];
      const marker=L.circleMarker([Number(place.lat),Number(place.lon)],{
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
      marker.on('click',()=>focusPlace(place));
    });

    if(state.crossing){
      if(validLatLng(state.crossing)){
        L.circleMarker([Number(state.crossing.lat),Number(state.crossing.lon)],{
          radius:11,
          weight:3,
          color:'#ffffff',
          fillColor:'#ff5f6d',
          fillOpacity:1,
          interactive:false
        }).addTo(routeLayer);
      }else warn('map:invalid-crossing','korsningspunkten ignorerades');
    }

    if(forceFit||(state.places||[]).length!==lastPlaceCount)fitState(state,forceFit);
    lastPlaceCount=(state.places||[]).length;
  }

  function invalidate(){setTimeout(()=>map.invalidateSize(),40);}
  function reset(){runProgrammatic(()=>map.setView([24,8],2.35,{animate:false}));}
  function destroy(){map.remove();}

  return {render,fitState,focusPlace,invalidate,reset,destroy,map};
}
