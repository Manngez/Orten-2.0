import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const Engine=require('../street-duel-engine.js');
const Difficulty=require('../street-duel-difficulty.js');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const loader=readFileSync(join(root,'app.js'),'utf8');
const sw=readFileSync(join(root,'service-worker.js'),'utf8');

const feature=(name,coords)=>({
  type:'Feature',
  properties:{namn:name,geometry:`LINESTRING (${coords.map(([x,y])=>`${x} ${y}`).join(', ')})`},
  geometry:{type:'LineString',coordinates:coords}
});

const bbox={west:20.1,south:63.7,east:20.5,north:63.9};
const graph=Engine.buildGraph([
  feature('Alfagatan',[[20.20,63.82],[20.21,63.82]]),
  feature('Betagatan',[[20.21,63.82],[20.22,63.82]]),
  feature('Gammagatan',[[20.22,63.82],[20.23,63.82]]),
  feature('Deltagatan',[[20.23,63.82],[20.24,63.82]]),
  feature('Sidogatan',[[20.21,63.82],[20.21,63.83]])
],{bbox,toleranceMeters:3,junctionRadiusMeters:12});

test('difficulty levels are hard 1, medium 2 and easy 3 steps',()=>{
  assert.equal(Difficulty.LEVELS.hard.steps,1);
  assert.equal(Difficulty.LEVELS.medium.steps,2);
  assert.equal(Difficulty.LEVELS.easy.steps,3);
  assert.equal(Difficulty.getLevel('unknown').key,'hard');
});

test('shortest path follows the street graph',()=>{
  assert.deepEqual(Difficulty.shortestPath(graph,'Alfagatan','Betagatan',1),['Alfagatan','Betagatan']);
  assert.deepEqual(Difficulty.shortestPath(graph,'Alfagatan','Gammagatan',2),['Alfagatan','Betagatan','Gammagatan']);
  assert.equal(Difficulty.shortestPath(graph,'Alfagatan','Deltagatan',2),null);
  assert.deepEqual(Difficulty.shortestPath(graph,'Alfagatan','Deltagatan',3),['Alfagatan','Betagatan','Gammagatan','Deltagatan']);
});

test('hard requires direct connection',()=>{
  assert.equal(Difficulty.validateMove(graph,'Alfagatan','Betagatan',['Alfagatan'],1).ok,true);
  assert.equal(Difficulty.validateMove(graph,'Alfagatan','Gammagatan',['Alfagatan'],1).ok,false);
});

test('medium allows at most two street steps',()=>{
  const result=Difficulty.validateMove(graph,'Alfagatan','Gammagatan',['Alfagatan'],2);
  assert.equal(result.ok,true);
  assert.equal(result.steps,2);
  assert.deepEqual(result.path,['Alfagatan','Betagatan','Gammagatan']);
  assert.equal(Difficulty.validateMove(graph,'Alfagatan','Deltagatan',['Alfagatan'],2).ok,false);
});

test('easy allows at most three street steps',()=>{
  const result=Difficulty.validateMove(graph,'Alfagatan','Deltagatan',['Alfagatan'],3);
  assert.equal(result.ok,true);
  assert.equal(result.steps,3);
  assert.deepEqual(result.path,['Alfagatan','Betagatan','Gammagatan','Deltagatan']);
});

test('used destination is still forbidden at every difficulty',()=>{
  const result=Difficulty.validateMove(graph,'Alfagatan','Gammagatan',['Alfagatan','Gammagatan'],3);
  assert.equal(result.ok,false);
  assert.equal(result.reason,'used');
});

test('no-move check follows selected maximum step distance',()=>{
  const hard=Difficulty.reachableUnused(graph,'Alfagatan',['Alfagatan','Betagatan','Sidogatan'],1);
  assert.deepEqual(hard,[]);
  const medium=Difficulty.reachableUnused(graph,'Alfagatan',['Alfagatan','Betagatan','Sidogatan'],2);
  assert.ok(medium.includes('Gammagatan'));
  const easy=Difficulty.reachableUnused(graph,'Alfagatan',['Alfagatan','Betagatan','Sidogatan'],3);
  assert.ok(easy.includes('Deltagatan'));
});

test('published loader and service worker include difficulty module',()=>{
  assert.match(loader,/app-street-duel-timer-options\.js','street-duel-difficulty\.js'/);
  assert.match(sw,/\.\/street-duel-difficulty\.js/);
});

test('difficulty UI exposes the three selectable labels and saves the choice',()=>{
  const source=readFileSync(join(root,'street-duel-difficulty.js'),'utf8');
  assert.match(source,/Svårighetsgrad/);
  assert.match(source,/label:'Hard',steps:1/);
  assert.match(source,/label:'Medium',steps:2/);
  assert.match(source,/label:'Easy',steps:3/);
  assert.match(source,/orten2:street-duel-difficulty/);
  assert.match(source,/lastResult\.path\.join\(' → '\)/);
});
