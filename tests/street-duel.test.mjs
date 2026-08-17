import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const E=require('../street-duel-engine.js');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=readFileSync(join(root,'app-street-duel.js'),'utf8');

const feature=(name,coords)=>({type:'Feature',properties:{namn:name,geometry:`LINESTRING (${coords.map(([x,y])=>`${x} ${y}`).join(', ')})`},geometry:{type:'LineString',coordinates:coords}});
const features=[
  feature('Storgatan',[[20.20,63.82],[20.21,63.82]]),
  feature('Skolgatan',[[20.21,63.82],[20.21,63.83]]),
  feature('Renmarksesplanaden',[[20.21,63.83],[20.22,63.83]]),
  feature('Kungsgatan',[[20.22,63.83],[20.22,63.84]]),
  feature('Rådhusesplanaden',[[20.21,63.82],[20.22,63.82]])
];
const graph=E.buildGraph(features,{bbox:{west:20.1,south:63.7,east:20.5,north:63.9},toleranceMeters:3});

test('parses NVDB WKT line geometry',()=>{
  assert.deepEqual(E.parseWktLine('LINESTRING (20.1 63.8, 20.2 63.9)'),[[20.1,63.8],[20.2,63.9]]);
});

test('builds street-intersection graph from shared road endpoints',()=>{
  assert.equal(graph.crosses('Storgatan','Skolgatan'),true);
  assert.equal(graph.crosses('Storgatan','Rådhusesplanaden'),true);
  assert.equal(graph.crosses('Storgatan','Kungsgatan'),false);
  assert.ok(graph.neighbors('Skolgatan').includes('Renmarksesplanaden'));
});

test('validates crossing, reused and non-crossing moves',()=>{
  assert.deepEqual(E.validateMove(graph,'Storgatan','Skolgatan',['Storgatan']),{ok:true,name:'Skolgatan'});
  assert.equal(E.validateMove(graph,'Storgatan','Skolgatan',['Storgatan','Skolgatan']).reason,'used');
  assert.equal(E.validateMove(graph,'Storgatan','Kungsgatan',['Storgatan']).reason,'not-crossing');
  assert.equal(E.validateMove(graph,'Storgatan','Inte en gata',['Storgatan']).reason,'unknown');
});

test('street search is accent-insensitive and does not reveal only legal moves',()=>{
  assert.ok(E.suggestions(graph,'radhus',6).includes('Rådhusesplanaden'));
  assert.ok(E.suggestions(graph,'gatan',10).includes('Kungsgatan'));
});

test('published UI is a local best-of-five timed Umeå street duel',()=>{
  assert.match(app,/Gatduell Umeå/);
  assert.match(app,/TURN_SECONDS=20/);
  assert.match(app,/ROUND_TARGET=3/);
  assert.match(app,/roads_umea\/exports\/geojson/);
  assert.match(app,/light_nolabels/);
  assert.match(app,/Fel korsning, återanvänd gata eller slut på tiden/);
  assert.doesNotMatch(app,/Highscore|GLOBAL_SCORE|Supabase/i);
});
