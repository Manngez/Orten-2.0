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
    if(!own.length)return [];

    // I duell börjar den nya linjen vid den aktuella spelarens senaste ort,
    // men den får inte korsa någon redan ritad duellinje – varken den egna
    // eller motståndarens.
    const last=own.at(-1).place;
    const startUx=Number.isFinite(Number(last?.ux))?Number(last.ux):Number(last?.lon);
    const start={...last,ux:startUx};
    const candidate={...place,ux:geometry.unwrapLon(place.lon,start.ux)};
    const hits=[];

    for(const segment of segments(route,'duel')){
      // Lägg det äldre segmentet på samma obrutna longitudskala som den nya
      // linjen. Det gör korsningsregeln korrekt även nära datumgränsen.
      const a={...segment.a,ux:geometry.unwrapLon(segment.a.lon,start.ux)};
      const b={...segment.b,ux:geometry.unwrapLon(segment.b.lon,a.ux)};
      const hit=geometry.intersectionOf(start,candidate,a,b);
      if(hit){
        hits.push({
          ...hit,
          crossedStartIndex:segment.startIndex,
          crossedEndIndex:segment.endIndex,
          crossedPlayerIndex:segment.playerIndex
        });
      }
    }

    hits.sort((a,b)=>a.t-b.t);
    return hits;
  }

  return Object.freeze({indexedPlayerRoute,playerMoveCount,playerLast,segments,candidateCrossings});
});
