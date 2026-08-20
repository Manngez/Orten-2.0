import test from 'node:test';
import assert from 'node:assert/strict';
import {intersectionOf,mercatorY,normalizeLon,segmentParts,unwrapLon} from '../src/geometry.js';

test('unwrapLon väljer närmaste världskopia över datumgränsen',()=>{
  assert.equal(unwrapLon(-170,170),190);
  assert.equal(unwrapLon(170,-170),-190);
  assert.equal(unwrapLon(20,10),20);
});

test('segmentParts delar en linje vid datumgränsen',()=>{
  const parts=segmentParts({lat:10,lon:170},{lat:20,lon:-170});
  assert.equal(parts.length,2);
  assert.equal(parts[0][1][1],180);
  assert.equal(parts[1][0][1],-180);
});

test('Web Mercator är symmetrisk runt ekvatorn',()=>{
  assert.ok(Math.abs(mercatorY(60)+mercatorY(-60))<1e-12);
});

test('intersectionOf hittar korsning över datumgränsen',()=>{
  const a={lat:0,lon:170,ux:170};
  const b={lat:0,lon:-170,ux:190};
  const c={lat:-10,lon:180,ux:180};
  const d={lat:10,lon:180,ux:180};
  const hit=intersectionOf(a,b,c,d);
  assert.ok(hit);
  assert.ok(Math.abs(hit.lat)<1e-9);
  assert.equal(normalizeLon(hit.lon),180);
});

test('beröring av ett äldre segmentändläge räknas inte som korsning',()=>{
  const a={lat:0,lon:0,ux:0};
  const b={lat:10,lon:10,ux:10};
  const c={lat:10,lon:10,ux:10};
  const d={lat:20,lon:0,ux:0};
  assert.equal(intersectionOf(a,b,c,d),null);
});
