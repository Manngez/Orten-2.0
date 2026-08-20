import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,playPlace} from '../src/engine.js';
import {countryOptions,loadPlaces,searchPlaces} from '../src/data.js';

const place=(id,name,countryCode,lat=60,lon=15)=>({id,name,countryCode,country:countryCode,lat,lon});

test('spelmotorn nekar orter utanför valda länder',()=>{
  const state=createGame({mode:'classic',players:['A','B'],allowedCountries:['SE']});
  assert.deepEqual(state.allowedCountries,['SE']);
  assert.throws(()=>playPlace(state,place('oslo','Oslo','NO',59.91,10.75)),/utanför de valda länderna/);
  const next=playPlace(state,place('umea','Umeå','SE',63.83,20.26));
  assert.equal(next.places.length,1);
  assert.equal(next.places[0].countryCode,'SE');
});

test('ortsökningen filtrerar på valda länder och listar tillgängliga länder',async()=>{
  await loadPlaces({allowDemo:true});
  assert.equal(searchPlaces('Oslo',12,{countries:['SE']}).length,0);
  assert.equal(searchPlaces('Oslo',12,{countries:['NO']})[0]?.name,'Oslo');
  assert.equal(searchPlaces('Umeå',12,{countries:['SE']})[0]?.name,'Umeå');
  const countries=countryOptions();
  assert.ok(countries.some(item=>item.code==='SE'));
  assert.ok(countries.some(item=>item.code==='NO'));
});
