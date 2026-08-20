import test from 'node:test';
import assert from 'node:assert/strict';
import {validLatLng,validLatLngPair} from '../src/map.js';

test('kartskyddet accepterar giltiga ortskoordinater',()=>{
  assert.equal(validLatLng({lat:63.8258,lon:20.263}),true);
  assert.equal(validLatLng({lat:'59.3293',lon:'18.0686'}),true);
  assert.equal(validLatLngPair([55.605,13.0038]),true);
});

test('kartskyddet stoppar NaN, saknade och orimliga koordinater',()=>{
  assert.equal(validLatLng({lat:NaN,lon:20}),false);
  assert.equal(validLatLng({lat:63,lon:undefined}),false);
  assert.equal(validLatLng({lat:91,lon:20}),false);
  assert.equal(validLatLng({lat:63,lon:181}),false);
  assert.equal(validLatLngPair([NaN,20]),false);
  assert.equal(validLatLngPair([63,Infinity]),false);
});
