const DEMO=[
['Umeå',63.8258,20.2630,'SE','Sverige'],['Skellefteå',64.7507,20.9528,'SE','Sverige'],['Luleå',65.5848,22.1567,'SE','Sverige'],['Kiruna',67.8558,20.2253,'SE','Sverige'],['Östersund',63.1792,14.6357,'SE','Sverige'],['Sundsvall',62.3908,17.3069,'SE','Sverige'],['Gävle',60.6749,17.1413,'SE','Sverige'],['Falun',60.6065,15.6355,'SE','Sverige'],['Stockholm',59.3293,18.0686,'SE','Sverige'],['Uppsala',59.8586,17.6389,'SE','Sverige'],['Västerås',59.6099,16.5448,'SE','Sverige'],['Örebro',59.2753,15.2134,'SE','Sverige'],['Karlstad',59.3793,13.5036,'SE','Sverige'],['Göteborg',57.7089,11.9746,'SE','Sverige'],['Borås',57.7210,12.9401,'SE','Sverige'],['Jönköping',57.7826,14.1618,'SE','Sverige'],['Linköping',58.4108,15.6214,'SE','Sverige'],['Norrköping',58.5877,16.1924,'SE','Sverige'],['Kalmar',56.6634,16.3568,'SE','Sverige'],['Växjö',56.8777,14.8091,'SE','Sverige'],['Halmstad',56.6745,12.8578,'SE','Sverige'],['Helsingborg',56.0465,12.6945,'SE','Sverige'],['Malmö',55.6050,13.0038,'SE','Sverige'],['Oslo',59.9139,10.7522,'NO','Norge'],['Bergen',60.3913,5.3221,'NO','Norge'],['Trondheim',63.4305,10.3951,'NO','Norge'],['Helsingfors',60.1699,24.9384,'FI','Finland'],['Åbo',60.4518,22.2666,'FI','Finland'],['Köpenhamn',55.6761,12.5683,'DK','Danmark'],['Århus',56.1629,10.2039,'DK','Danmark'],['Reykjavik',64.1466,-21.9426,'IS','Island'],['Berlin',52.5200,13.4050,'DE','Tyskland'],['Hamburg',53.5511,9.9937,'DE','Tyskland'],['Paris',48.8566,2.3522,'FR','Frankrike'],['London',51.5074,-0.1278,'GB','Storbritannien'],['Madrid',40.4168,-3.7038,'ES','Spanien'],['Rom',41.9028,12.4964,'IT','Italien'],['Warszawa',52.2297,21.0122,'PL','Polen'],['Prag',50.0755,14.4378,'CZ','Tjeckien'],['Wien',48.2082,16.3738,'AT','Österrike']
].map((row,index)=>({id:`demo-${index}`,name:row[0],lat:row[1],lon:row[2],countryCode:row[3],country:row[4]}));

const SCHEMA_VERSION=1;
const MIN_PLACES=150_000;
const MIN_COUNTRIES=200;
let places=[];
let source='unloaded';
let activeManifest=null;

const norm=value=>String(value||'').trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'');

function hex(buffer){return [...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}

async function sha256(text){
  if(!globalThis.crypto?.subtle)throw new Error('Webbläsaren kan inte verifiera ortregistrets SHA-256.');
  const bytes=new TextEncoder().encode(text);
  return {bytes:bytes.byteLength,sha256:hex(await globalThis.crypto.subtle.digest('SHA-256',bytes))};
}

export function assertDatasetManifest(manifest,facts){
  if(!manifest||manifest.schemaVersion!==SCHEMA_VERSION)throw new Error(`Fel dataversion: ${manifest?.schemaVersion??'saknas'}`);
  if(manifest.dataset!=='geonames-cities500')throw new Error(`Fel ortdataset: ${manifest.dataset||'saknas'}`);
  if(!Number.isInteger(facts.count)||facts.count<MIN_PLACES)throw new Error(`Ortregistret är ofullständigt: ${facts.count||0} orter.`);
  if(!Number.isInteger(facts.countryCount)||facts.countryCount<MIN_COUNTRIES)throw new Error(`Ortregistret täcker för få länder/territorier: ${facts.countryCount||0}.`);
  if(manifest.count!==facts.count)throw new Error('Ortregistrets antal matchar inte manifestet.');
  if(manifest.countryCount!==facts.countryCount)throw new Error('Ortregistrets landantal matchar inte manifestet.');
  if(manifest.bytes!==facts.bytes)throw new Error('Ortregistrets filstorlek matchar inte manifestet.');
  if(!/^[a-f0-9]{64}$/.test(String(manifest.sha256||''))||manifest.sha256!==facts.sha256)throw new Error('Ortregistrets SHA-256 matchar inte manifestet.');
  if(!manifest.version||!String(manifest.version).endsWith(facts.sha256.slice(0,12)))throw new Error('Ortregistrets versionsetikett är ogiltig.');
  return true;
}

function useDemo(){
  places=DEMO;
  source='demo';
  activeManifest={schemaVersion:SCHEMA_VERSION,dataset:'demo',version:'demo',count:places.length,countryCount:new Set(places.map(place=>place.countryCode)).size};
  return {count:places.length,source,manifest:activeManifest};
}

export async function loadPlaces({allowDemo=false}={}){
  if(allowDemo)return useDemo();

  const [manifestResponse,dataResponse]=await Promise.all([
    fetch('../data/world-manifest.json',{cache:'no-store'}),
    fetch('../data/world-places.json',{cache:'no-store'})
  ]);
  if(!manifestResponse.ok)throw new Error(`Manifestet kunde inte laddas (${manifestResponse.status}).`);
  if(!dataResponse.ok)throw new Error(`Ortregistret kunde inte laddas (${dataResponse.status}).`);

  const manifest=await manifestResponse.json();
  const raw=await dataResponse.text();
  const integrity=await sha256(raw);
  let rows;
  try{rows=JSON.parse(raw);}catch{throw new Error('Ortregistret innehåller ogiltig JSON.');}
  if(!Array.isArray(rows))throw new Error('Ortregistret har fel format.');

  const mapped=[];
  const countries=new Set();
  for(const row of rows){
    if(!Array.isArray(row)||row.length<11)throw new Error('Ortregistret innehåller en ogiltig rad.');
    const id=Number(row[0]);
    const name=String(row[1]||'').trim();
    const lat=Number(row[2]);
    const lon=Number(row[3]);
    const countryCode=String(row[4]||'').toUpperCase();
    if(!Number.isInteger(id)||!name||!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180||!/^[A-Z]{2}$/.test(countryCode))throw new Error(`Ortregistret innehåller ogiltig data vid ${name||id||'okänd ort'}.`);
    countries.add(countryCode);
    mapped.push({id:String(id),name,lat,lon,countryCode,country:countryCode,region:String(row[6]||''),population:Number(row[7])||0,featureCode:String(row[8]||'')});
  }

  assertDatasetManifest(manifest,{count:mapped.length,countryCount:countries.size,bytes:integrity.bytes,sha256:integrity.sha256});
  places=mapped;
  source='full';
  activeManifest=manifest;
  return {count:places.length,source,manifest};
}

export function searchPlaces(query,limit=12){
  const q=norm(query);
  if(!q)return [];
  return places
    .map(place=>{const n=norm(place.name);let score=0;if(n===q)score=100;if(n.startsWith(q))score=Math.max(score,80);if(n.includes(q))score=Math.max(score,50);return {place,score}})
    .filter(item=>item.score)
    .sort((a,b)=>b.score-a.score||b.place.population-a.place.population||a.place.name.localeCompare(b.place.name,'sv'))
    .slice(0,limit)
    .map(item=>item.place);
}

export function dataSource(){return source;}
export function dataManifest(){return activeManifest;}
