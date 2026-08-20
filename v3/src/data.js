const DEMO=[
['Umeå',63.8258,20.2630,'SE','Sverige'],['Skellefteå',64.7507,20.9528,'SE','Sverige'],['Luleå',65.5848,22.1567,'SE','Sverige'],['Kiruna',67.8558,20.2253,'SE','Sverige'],['Östersund',63.1792,14.6357,'SE','Sverige'],['Sundsvall',62.3908,17.3069,'SE','Sverige'],['Gävle',60.6749,17.1413,'SE','Sverige'],['Falun',60.6065,15.6355,'SE','Sverige'],['Stockholm',59.3293,18.0686,'SE','Sverige'],['Uppsala',59.8586,17.6389,'SE','Sverige'],['Västerås',59.6099,16.5448,'SE','Sverige'],['Örebro',59.2753,15.2134,'SE','Sverige'],['Karlstad',59.3793,13.5036,'SE','Sverige'],['Göteborg',57.7089,11.9746,'SE','Sverige'],['Borås',57.7210,12.9401,'SE','Sverige'],['Jönköping',57.7826,14.1618,'SE','Sverige'],['Linköping',58.4108,15.6214,'SE','Sverige'],['Norrköping',58.5877,16.1924,'SE','Sverige'],['Kalmar',56.6634,16.3568,'SE','Sverige'],['Växjö',56.8777,14.8091,'SE','Sverige'],['Halmstad',56.6745,12.8578,'SE','Sverige'],['Helsingborg',56.0465,12.6945,'SE','Sverige'],['Malmö',55.6050,13.0038,'SE','Sverige'],['Oslo',59.9139,10.7522,'NO','Norge'],['Bergen',60.3913,5.3221,'NO','Norge'],['Trondheim',63.4305,10.3951,'NO','Norge'],['Helsingfors',60.1699,24.9384,'FI','Finland'],['Åbo',60.4518,22.2666,'FI','Finland'],['Köpenhamn',55.6761,12.5683,'DK','Danmark'],['Århus',56.1629,10.2039,'DK','Danmark'],['Reykjavik',64.1466,-21.9426,'IS','Island'],['Berlin',52.5200,13.4050,'DE','Tyskland'],['Hamburg',53.5511,9.9937,'DE','Tyskland'],['Paris',48.8566,2.3522,'FR','Frankrike'],['London',51.5074,-0.1278,'GB','Storbritannien'],['Madrid',40.4168,-3.7038,'ES','Spanien'],['Rom',41.9028,12.4964,'IT','Italien'],['Warszawa',52.2297,21.0122,'PL','Polen'],['Prag',50.0755,14.4378,'CZ','Tjeckien'],['Wien',48.2082,16.3738,'AT','Österrike']
].map((row,index)=>({id:`demo-${index}`,name:row[0],lat:row[1],lon:row[2],countryCode:row[3],country:row[4]}));

let places=[];
let source='demo';

const norm=value=>String(value||'').trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'');

export async function loadPlaces(){
  try{
    const response=await fetch('../data/world-places.json',{cache:'no-store'});
    if(!response.ok)throw new Error(String(response.status));
    const rows=await response.json();
    if(!Array.isArray(rows)||rows.length<10000)throw new Error(`bara ${Array.isArray(rows)?rows.length:0} orter`);
    places=rows.map(row=>({id:String(row[0]),name:String(row[1]),lat:Number(row[2]),lon:Number(row[3]),countryCode:String(row[4]||''),country:String(row[4]||''),region:String(row[6]||'')})).filter(p=>p.name&&Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    source='full';
  }catch{
    places=DEMO;
    source='demo';
  }
  return {count:places.length,source};
}

export function searchPlaces(query,limit=12){
  const q=norm(query);
  if(!q)return [];
  return places
    .map(place=>{const n=norm(place.name);let score=0;if(n===q)score=100;if(n.startsWith(q))score=Math.max(score,80);if(n.includes(q))score=Math.max(score,50);return {place,score}})
    .filter(item=>item.score)
    .sort((a,b)=>b.score-a.score||a.place.name.localeCompare(b.place.name,'sv'))
    .slice(0,limit)
    .map(item=>item.place);
}

export function dataSource(){return source;}
