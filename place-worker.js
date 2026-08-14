'use strict';

let rowsPromise = null;
let countryNames = {};
const SEARCH_LIMIT = 24;

const norm = value => String(value ?? '').trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();

async function loadRows(){
  if(!rowsPromise){
    rowsPromise = fetch('./data/world-places.json', {cache:'force-cache'})
      .then(r => { if(!r.ok) throw new Error(`world-places.json ${r.status}`); return r.json(); })
      .then(rows => { postMessage({type:'ready',count:rows.length}); return rows; })
      .catch(err => { rowsPromise=null; throw err; });
  }
  return rowsPromise;
}

function typeAllowed(row, placeType){
  if(placeType==='any') return true;
  const population = row[7] || 0;
  const featureCode = row[8] || '';
  const admin = featureCode === 'PPLC' || /^PPLA/.test(featureCode);
  if(placeType==='urban') return population >= 5000 || admin;
  return population >= 15000 || admin;
}

function placeType(row){
  const population=row[7]||0, featureCode=row[8]||'';
  if(featureCode==='PPLC') return 'capital';
  if(/^PPLA/.test(featureCode)) return 'admin';
  if(population>=15000) return 'city';
  if(population>=5000) return 'urban';
  return 'settlement';
}

function nameScore(row, q){
  const canonical=row[9]||'', aliases=row[10]||'';
  if(canonical===q) return 10000;
  if(aliases && aliases.includes(`\u0001${q}\u0001`)) return 9400;
  if(canonical.startsWith(q)) return 7600;
  if(aliases && aliases.includes(`\u0001${q}`)) return 7000;
  if(q.length>=3 && canonical.includes(q)) return 5200;
  if(q.length>=3 && aliases.includes(q)) return 4500;
  return 0;
}

function qualifierMatch(row, qualifier){
  if(!qualifier) return false;
  const cc=String(row[4]||'').toLowerCase();
  const admin=norm(row[5]);
  const region=norm(row[6]);
  const country=norm(countryNames[row[4]]||'');
  return cc===qualifier || admin===qualifier || region===qualifier || country===qualifier || region.includes(qualifier) || country.includes(qualifier);
}

function searchRows(rows, query, allowedCodes, filterType){
  const raw=String(query||'').trim();
  const parts=raw.split(',').map(norm).filter(Boolean);
  const q=parts[0]||norm(raw);
  const qualifier=parts.slice(1).join(' ');
  if(!q) return {results:[],total:0};
  const allowed=Array.isArray(allowedCodes)&&allowedCodes.length ? new Set(allowedCodes) : null;
  const matches=[];
  let qualifyingCount=0;

  for(const row of rows){
    if(allowed && !allowed.has(row[4])) continue;
    if(!typeAllowed(row,filterType)) continue;
    const base=nameScore(row,q); if(!base) continue;
    const qMatch=qualifier ? qualifierMatch(row,qualifier) : false;
    if(qMatch) qualifyingCount++;
    const population=row[7]||0;
    const admin=row[8]==='PPLC'||/^PPLA/.test(row[8]||'');
    const importance=Math.log10(population+10)*70 + (admin?80:0);
    matches.push({row,score:base+importance+(qMatch?2500:0),qMatch});
  }

  let pool=matches;
  if(qualifier && qualifyingCount) pool=matches.filter(m=>m.qMatch);
  pool.sort((a,b)=>b.score-a.score || (b.row[7]||0)-(a.row[7]||0) || String(a.row[1]).localeCompare(String(b.row[1])));
  const total=pool.length;
  const results=pool.slice(0,SEARCH_LIMIT).map(({row})=>({
    geonameId:row[0], id:`gn:${row[0]}`, name:row[1], lat:row[2], lon:row[3], countryCode:row[4], country:countryNames[row[4]]||row[4],
    adminCode:row[5]||'', region:row[6]||'', population:row[7]||0, featureCode:row[8]||'', type:placeType(row)
  }));
  return {results,total};
}

onmessage = async event => {
  const msg=event.data||{};
  if(msg.countryNames) countryNames=msg.countryNames;
  try{
    const rows=await loadRows();
    if(msg.type==='warm') return;
    if(msg.type==='search'){
      const payload=searchRows(rows,msg.query,msg.allowedCodes,msg.placeType||'any');
      postMessage({type:'result',requestId:msg.requestId,...payload});
    }
  }catch(err){
    postMessage({type:'error',requestId:msg.requestId||null,message:err?.message||String(err)});
  }
};
