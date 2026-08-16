'use strict';

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OrtenDuelRoutes=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function indexedPlayerRoute(route=[],playerIndex=0){
    return (Array.isArray(route)?route:[])
      .map((place,index)=>({place,index}))
      .filter(item=>item.place?.playerIndex===playerIndex);
  }

  function playerMoveCount(route=[],playerIndex=0){
    return indexedPlayerRoute(route,playerIndex).length;
  }

  function playerLast(route=[],playerIndex=0){
    return indexedPlayerRoute(route,playerIndex).at(-1)?.place||null;
  }

  function segments(route=[],mode='classic'){
    const source=Array.isArray(route)?route:[];
    if(mode!=='duel'){
      const out=[];
      for(let i=1;i<source.length;i++)out.push({a:source[i-1],b:source[i],startIndex:i-1,endIndex:i,playerIndex:source[i]?.playerIndex??0});
      return out;
    }
    const players=[...new Set(source.map(p=>p?.playerIndex).filter(Number.isInteger))];
    const out=[];
    for(const playerIndex of players){
      const own=indexedPlayerRoute(source,playerIndex);
      for(let i=1;i<own.length;i++)out.push({a:own[i-1].place,b:own[i].place,startIndex:own[i-1].index,endIndex:own[i].index,playerIndex});
    }
    return out.sort((a,b)=>a.endIndex-b.endIndex);
  }

  function candidateCrossings(route=[],playerIndex=0,place,geometry){
    if(!place||!geometry?.intersectionOf||!geometry?.unwrapLon)return [];
    const own=indexedPlayerRoute(route,playerIndex);
    if(own.length<3)return [];
    const start=own.at(-1).place;
    const candidate={...place,ux:geometry.unwrapLon(place.lon,start.ux)};
    const hits=[];
    for(let i=0;i<own.length-2;i++){
      const hit=geometry.intersectionOf(start,candidate,own[i].place,own[i+1].place);
      if(hit)hits.push({...hit,crossedStartIndex:own[i].index,crossedEndIndex:own[i+1].index,crossedPlayerIndex:playerIndex});
    }
    hits.sort((a,b)=>a.t-b.t);
    return hits;
  }

  return Object.freeze({indexedPlayerRoute,playerMoveCount,playerLast,segments,candidateCrossings});
});
