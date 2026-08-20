import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPlaces,searchPlaces} from '../src/data.js';

test('demoindex hittar svenska orter utan diakritiska tecken',async()=>{
  await loadPlaces({allowDemo:true});
  assert.equal(searchPlaces('umea',1)[0]?.name,'Umeå');
  assert.equal(searchPlaces('kop',1)[0]?.name,'Köpenhamn');
});

test('tom sökning ger inga träffar',async()=>{
  await loadPlaces({allowDemo:true});
  assert.deepEqual(searchPlaces('   '),[]);
});
