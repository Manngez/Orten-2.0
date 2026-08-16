import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const G=require('../game-geometry.js');
const Duel=require('../duel-routes.js');

const p=(name,lat,lon,playerIndex)=>({name,lat,lon,ux:lon,playerIndex});

test('duell kopplar bara ihop samma spelares orter',()=>{
  const route=[
    p('A',0,0,0),p('X',20,20,1),p('B',0,10,0),p('Y',25,20,1),p('C',10,10,0),p('Z',25,30,1)
  ];
  const segments=Duel.segments(route,'duel');
  assert.deepEqual(segments.map(s=>[s.startIndex,s.endIndex,s.playerIndex]),[
    [0,2,0],[1,3,1],[2,4,0],[3,5,1]
  ]);
});

test('en spelare kan korsa motståndarens linje utan egen korsning',()=>{
  const route=[
    p('A',0,0,0),p('X',-5,5,1),p('B',0,10,0),p('Y',5,5,1),p('C',10,10,0)
  ];
  const hits=Duel.candidateCrossings(route,0,{name:'D',lat:10,lon:0},G);
  assert.equal(hits.length,0);
});

test('egen tidigare sträcka räknas som korsning i duell',()=>{
  const route=[
    p('A',0,0,0),p('X',30,30,1),p('B',0,10,0),p('Y',35,30,1),p('C',10,10,0)
  ];
  const hits=Duel.candidateCrossings(route,0,{name:'D',lat:-10,lon:5},G);
  assert.equal(hits.length,1);
  assert.equal(hits[0].crossedStartIndex,0);
  assert.equal(hits[0].crossedEndIndex,2);
  assert.equal(hits[0].crossedPlayerIndex,0);
});

test('playerMoveCount håller de två rutterna separata',()=>{
  const route=[p('A',0,0,0),p('X',0,0,1),p('B',0,1,0),p('Y',0,1,1),p('C',0,2,0)];
  assert.equal(Duel.playerMoveCount(route,0),3);
  assert.equal(Duel.playerMoveCount(route,1),2);
  assert.equal(Duel.playerLast(route,1).name,'Y');
});
