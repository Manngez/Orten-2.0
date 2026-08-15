'use strict';

let rowsPromise = null;
let countryNames = {};
const SEARCH_LIMIT = 24;
const DATA_VERSION = '20260814-3';

const norm = value => String(value ?? '').trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();

// Restored from the original Orten: Swedish exonyms, local spellings and
// common international/historic names. Country scoping prevents an alias
// from hijacking a real place with the same name elsewhere in the world.
const QUERY_ALIAS_GROUPS = [
  ['NO','Oslo',['Kristiania','Christiania']],
  ['NO','Trondheim',['Trondhjem','Nidaros','Drontheim']],
  ['NO','Tromsø',['Tromso']],
  ['FI','Helsinki',['Helsingfors']],
  ['FI','Turku',['Åbo','Abo']],
  ['FI','Tampere',['Tammerfors']],
  ['FI','Vaasa',['Vasa']],
  ['FI','Oulu',['Uleåborg','Uleaborg']],
  ['FI','Porvoo',['Borgå','Borga']],
  ['FI','Lappeenranta',['Villmanstrand']],
  ['FI','Hämeenlinna',['Tavastehus','Hameenlinna']],
  ['FI','Savonlinna',['Nyslott']],
  ['DK','Copenhagen',['Köpenhamn','København','Kobenhavn']],
  ['DK','Århus',['Aarhus','Arhus']],
  ['DK','Aalborg',['Ålborg','Alborg']],
  ['SE','Gothenburg',['Göteborg','Goteborg']],
  ['DE','Hamburg',['Hamborg']],
  ['DE','Munich',['München','Munchen']],
  ['DE','Nuremberg',['Nürnberg','Nurnberg']],
  ['DE','Köln',['Cologne','Koln']],
  ['DE','Hannover',['Hanover']],
  ['DE','Frankfurt am Main',['Frankfurt','Frankfurt/Main']],
  ['DE','Aachen',['Aix-la-Chapelle']],
  ['AT','Vienna',['Wien']],
  ['CZ','Prague',['Prag','Praha']],
  ['CZ','Brno',['Brünn','Brunn']],
  ['CZ','Pilsen',['Plzeň','Plzen']],
  ['PL','Warsaw',['Warszawa','Warschau']],
  ['PL','Wrocław',['Wroclaw','Breslau']],
  ['PL','Poznań',['Poznan','Posen']],
  ['PL','Szczecin',['Stettin']],
  ['PL','Łódź',['Lodz','Lodsch']],
  ['PL','Katowice',['Kattowitz']],
  ['IT','Rome',['Rom','Roma']],
  ['IT','Florence',['Florens','Firenze']],
  ['IT','Venice',['Venedig','Venezia']],
  ['IT','Naples',['Neapel','Napoli']],
  ['IT','Turin',['Torino']],
  ['IT','Genoa',['Genua','Genova']],
  ['IT','Padua',['Padova']],
  ['ES','Sevilla',['Seville']],
  ['ES','Zaragoza',['Saragossa']],
  ['ES','A Coruña',['La Coruña','La Coruna','Corunna']],
  ['ES','Valencia',['València']],
  ['ES','Bilbao',['Bilbo']],
  ['ES','Palma',['Palma de Mallorca']],
  ['ES','Donostia / San Sebastián',['San Sebastian','San Sebastián','Donostia']],
  ['PT','Lisbon',['Lissabon','Lisboa']],
  ['PT','Porto',['Oporto']],
  ['BE','Brussels',['Bryssel','Bruxelles','Brussel']],
  ['BE','Antwerp',['Antwerpen']],
  ['BE','Gent',['Ghent']],
  ['BE','Liège',['Liege','Luik','Lüttich']],
  ['BE','Leuven',['Louvain']],
  ['NL','The Hague',['Haag','Den Haag']],
  ['CH','Bern',['Berne']],
  ['CH','Basel',['Basle','Bâle','Bale']],
  ['CH','Luzern',['Lucerne']],
  ['CH','Geneva',['Genève','Geneve']],
  ['CH','Zürich',['Zurich']],
  ['GR','Athens',['Aten','Athína','Athina']],
  ['GR','Thessaloníki',['Thessaloniki','Saloniki','Thessalonica']],
  ['GR','Corfu',['Korfu','Kérkyra','Kerkyra']],
  ['GR','Ródos',['Rhodes','Rhodos','Rodos']],
  ['RS','Belgrade',['Belgrad','Beograd']],
  ['HR','Dubrovnik',['Ragusa']],
  ['HR','Split',['Spalato']],
  ['SI','Ljubljana',['Laibach']],
  ['BA','Sarajevo',['Sarajewo']],
  ['MK','Skopje',['Üsküb','Uskub']],
  ['RO','Bucharest',['Bukarest','București','Bucuresti']],
  ['RO','Cluj-Napoca',['Cluj','Klausenburg','Kolozsvár']],
  ['RO','Braşov',['Brasov','Kronstadt']],
  ['MD','Chisinau',['Chișinău','Kisjinau']],
  ['EE','Tallinn',['Reval']],
  ['EE','Tartu',['Dorpat']],
  ['LV','Daugavpils',['Dünaburg','Dunaburg','Dvinsk']],
  ['LT','Vilnius',['Vilna','Wilno']],
  ['LT','Kaunas',['Kovno']],
  ['LT','Klaipėda',['Klaipeda','Memel']],
  ['BY','Minsk',['Mensk']],
  ['BY','Hrodna',['Grodno']],
  ['UA','Kyiv',['Kiev']],
  ['UA','Lviv',['Lemberg','Lvov']],
  ['UA','Odesa',['Odessa']],
  ['UA','Kharkiv',['Kharkov','Charkiv']],
  ['UA','Dnipro',['Dnipropetrovsk','Jekaterinoslav']],
  ['UA','Zaporizhzhya',['Zaporizhzhia','Zaporozhye','Zaporizjzja']],
  ['UA','Chernivtsi',['Czernowitz','Tjernivtsi']],
  ['RU','Moscow',['Moskva']],
  ['RU','Saint Petersburg',['Sankt Petersburg','St Petersburg','Leningrad','Petrograd']],
  ['RU','Kaliningrad',['Königsberg','Konigsberg']],
  ['RU','Nizhniy Novgorod',['Nizjnij Novgorod','Nizhny Novgorod','Gorkij','Gorky']],
  ['RU','Volgograd',['Stalingrad','Tsaritsyn']],
  ['TR','Istanbul',['Konstantinopel','Constantinople','Byzantion']],
  ['TR','İzmir',['Izmir','Smyrna']],
  ['TR','Edirne',['Adrianopel','Adrianople']],
  ['TR','Ankara',['Angora']],
  ['IS','Reykjavík',['Reykjavik']],
  ['IE','Dublin',['Baile Átha Cliath','Baile Atha Cliath']],
  ['PL','Kraków',['Krakow','Krakau']],
  ['PL','Gdańsk',['Gdansk','Danzig']]
];

const QUERY_ALIASES = new Map();
for (const [country,target,aliases] of QUERY_ALIAS_GROUPS) {
  for (const alias of aliases) {
    const key=norm(alias);
    if(!key) continue;
    const list=QUERY_ALIASES.get(key)||[];
    list.push({country,target:norm(target)});
    QUERY_ALIASES.set(key,list);
  }
}

async function loadRows(){
  if(!rowsPromise){
    rowsPromise = fetch(`./data/world-places.json?v=${DATA_VERSION}`, {cache:'no-store'})
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

function singleNameScore(row, q){
  const canonical=row[9]||'', aliases=row[10]||'';
  if(canonical===q) return 10000;
  if(aliases && aliases.includes(`\u0001${q}\u0001`)) return 9400;
  if(canonical.startsWith(q)) return 7600;
  if(aliases && aliases.includes(`\u0001${q}`)) return 7000;
  if(q.length>=3 && canonical.includes(q)) return 5200;
  if(q.length>=3 && aliases.includes(q)) return 4500;
  return 0;
}

function nameScore(row, q){
  let best=singleNameScore(row,q);
  const aliases=QUERY_ALIASES.get(q);
  if(!aliases) return best;
  for(const alias of aliases){
    if(alias.country && row[4]!==alias.country) continue;
    best=Math.max(best,singleNameScore(row,alias.target)-250);
  }
  return best;
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
    geonameId:row[0], id:`gn:${row[0]}`, name:(row[0]===2711537?'Göteborg':row[1]), lat:row[2], lon:row[3], countryCode:row[4], country:countryNames[row[4]]||row[4],
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
