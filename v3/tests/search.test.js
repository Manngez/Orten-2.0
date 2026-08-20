import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPlaces,searchPlaces,placeById} from '../src/data.js';

test('demoindex hittar svenska orter utan diakritiska tecken',async()=>{
  await loadPlaces({allowDemo:true});
  assert.equal(searchPlaces('umea',1)[0]?.name,'Umeå');
  assert.equal(searchPlaces('kop',1)[0]?.name,'Köpenhamn');
});

test('ort kan slås upp auktoritativt med sitt id',async()=>{
  await loadPlaces({allowDemo:true});
  const umea=searchPlaces('umea',1)[0];
  assert.ok(umea);
  assert.equal(placeById(umea.id)?.name,'Umeå');
  assert.equal(placeById('finns-inte'),null);
});

test('tom sökning ger inga träffar',async()=>{
  await loadPlaces({allowDemo:true});
  assert.deepEqual(searchPlaces('   '),[]);
});
