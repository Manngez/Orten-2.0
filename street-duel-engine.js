'use strict';

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.OrtenStreetDuel=api;
})(typeof window!=='undefined'?window:globalThis,()=>{
  const DEFAULT_BBOX={west:20.10,south:63.76,east:20.50,north:63.91};

  function norm(value=''){
    return String(value).trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  }

  function flattenCoords(value){
    if(!Array.isArray(value)) return [];
    if(value.length>=2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) return [[Number(value[0]),Number(value[1])]];
    return value.flatMap(flattenCoords);
  }

  function parseWktLine(wkt=''){
    const text=String(wkt||'');
    if(!/LINESTRING/i.test(text)) return [];
    const pairs=[...text.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
      .map(match=>[Number(match[1]),Number(match[2])])
      .filter(([lon,lat])=>Number.isFinite(lon)&&Number.isFinite(lat));
    return pairs;
  }

  function featureName(feature={}){
    const p=feature.properties||feature.fields||feature;
    return String(p.namn??p.Namn??p.name??p.NAME??'').trim();
  }

  function featureCoords(feature={}){
    const p=feature.properties||feature.fields||feature;
    const fromWkt=parseWktLine(p.geometry??p.Geometry??'');
    if(fromWkt.length>=2) return fromWkt;
    const fromGeo=flattenCoords(feature.geometry?.coordinates??p.geojson?.coordinates??p.GeoJSON?.coordinates);
    return fromGeo.length>=2?fromGeo:[];
  }

  function insideBbox([lon,lat],bbox=DEFAULT_BBOX){
    return lon>=bbox.west&&lon<=bbox.east&&lat>=bbox.south&&lat<=bbox.north;
  }

  function distanceMeters(a,b){
    const lat=((a[1]+b[1])/2)*Math.PI/180;
    const dx=(a[0]-b[0])*111320*Math.cos(lat);
    const dy=(a[1]-b[1])*110540;
    return Math.hypot(dx,dy);
  }

  function buildGraph(features=[],options={}){
    const bbox=options.bbox||DEFAULT_BBOX;
    const tolerance=Math.max(1,Number(options.toleranceMeters)||7);
    const streets=new Map();
    const endpoints=[];

    for(const feature of features||[]){
      const name=featureName(feature);
      if(!name || !/[A-Za-zÅÄÖåäöÉéÜü]/.test(name)) continue;
      const coords=featureCoords(feature);
      if(coords.length<2 || !coords.some(point=>insideBbox(point,bbox))) continue;
      const key=norm(name);
      if(!key) continue;
      if(!streets.has(key)) streets.set(key,{key,name,lines:[],neighbors:new Set()});
      const street=streets.get(key);
      street.lines.push(coords);
      endpoints.push({key,point:coords[0]},{key,point:coords[coords.length-1]});
    }

    const lat0=(bbox.south+bbox.north)/2*Math.PI/180;
    const toMeters=([lon,lat])=>[lon*111320*Math.cos(lat0),lat*110540];
    const buckets=new Map();
    const bucketKey=(x,y)=>`${Math.floor(x/tolerance)}:${Math.floor(y/tolerance)}`;

    for(const endpoint of endpoints){
      const [x,y]=toMeters(endpoint.point);
      const bx=Math.floor(x/tolerance),by=Math.floor(y/tolerance);
      for(let ox=-1;ox<=1;ox++) for(let oy=-1;oy<=1;oy++){
        const list=buckets.get(`${bx+ox}:${by+oy}`)||[];
        for(const other of list){
          if(other.key===endpoint.key) continue;
          if(distanceMeters(other.point,endpoint.point)>tolerance) continue;
          streets.get(endpoint.key)?.neighbors.add(other.key);
          streets.get(other.key)?.neighbors.add(endpoint.key);
        }
      }
      const key=bucketKey(x,y);
      if(!buckets.has(key)) buckets.set(key,[]);
      buckets.get(key).push(endpoint);
    }

    const active=[...streets.values()].filter(street=>street.neighbors.size>0);
    const names=active.map(street=>street.name).sort((a,b)=>a.localeCompare(b,'sv'));
    const byKey=new Map(active.map(street=>[street.key,street]));
    const alias=new Map(active.map(street=>[street.key,street.name]));

    return {
      names,
      size:names.length,
      bbox:{...bbox},
      streets:byKey,
      alias,
      get(name){return byKey.get(norm(name))||null;},
      neighbors(name){
        const street=byKey.get(norm(name));
        if(!street) return [];
        return [...street.neighbors].map(key=>byKey.get(key)?.name).filter(Boolean).sort((a,b)=>a.localeCompare(b,'sv'));
      },
      crosses(a,b){
        const one=byKey.get(norm(a)),two=byKey.get(norm(b));
        return !!one&&!!two&&one.neighbors.has(two.key);
      }
    };
  }

  function resolveName(graph,input=''){
    if(!graph) return null;
    return graph.get(input)?.name||null;
  }

  function suggestions(graph,input='',limit=8){
    if(!graph) return [];
    const q=norm(input);
    if(!q) return [];
    return graph.names
      .filter(name=>norm(name).includes(q))
      .sort((a,b)=>{
        const aa=norm(a).startsWith(q)?0:1,bb=norm(b).startsWith(q)?0:1;
        return aa-bb||a.localeCompare(b,'sv');
      })
      .slice(0,Math.max(1,limit));
  }

  function validateMove(graph,current,candidate,used=[]){
    const currentName=resolveName(graph,current);
    const candidateName=resolveName(graph,candidate);
    if(!candidateName) return {ok:false,reason:'unknown'};
    const usedKeys=new Set((used||[]).map(norm));
    if(usedKeys.has(norm(candidateName))) return {ok:false,reason:'used',name:candidateName};
    if(!currentName || !graph.crosses(currentName,candidateName)) return {ok:false,reason:'not-crossing',name:candidateName};
    return {ok:true,name:candidateName};
  }

  function unusedNeighbors(graph,current,used=[]){
    const usedKeys=new Set((used||[]).map(norm));
    return graph.neighbors(current).filter(name=>!usedKeys.has(norm(name)));
  }

  function chooseStart(graph,random=Math.random){
    if(!graph?.names?.length) return null;
    const preferred=graph.names.filter(name=>{
      const degree=graph.neighbors(name).length;
      return degree>=3&&degree<=14;
    });
    const pool=preferred.length?preferred:graph.names.filter(name=>graph.neighbors(name).length>=2);
    if(!pool.length) return graph.names[0]||null;
    return pool[Math.floor(Math.max(0,Math.min(.999999,Number(random())||0))*pool.length)];
  }

  return {DEFAULT_BBOX,norm,parseWktLine,featureName,featureCoords,distanceMeters,buildGraph,resolveName,suggestions,validateMove,unusedNeighbors,chooseStart};
});
