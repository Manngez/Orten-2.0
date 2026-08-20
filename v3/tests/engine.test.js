import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,playPlace} from '../src/engine.js';

const p=(id,name,lat,lon)=>({id,name,lat,lon,country:'Test'});

test('klassisk avslutas vid första korsningen',()=>{
  let g=createGame({mode:'classic',players:['A','B']});
  g=playPlace(g,p('1','A',0,0));
  g=playPlace(g,p('2','B',10,10));
  g=playPlace(g,p('3','C',0,10));
  g=playPlace(g,p('4','D',10,0));
  assert.equal(g.status,'finished');
  assert.equal(g.crossing.playerIndex,1);
  assert.equal(g.winner,0);
});

test('klassisk hittar korsning över datumgränsen',()=>{
  let g=createGame({mode:'classic',players:['A','B']});
  g=playPlace(g,p('1','A',0,170));
  g=playPlace(g,p('2','B',10,-170));
  g=playPlace(g,p('3','C',-10,-170));
  g=playPlace(g,p('4','D',10,170));
  assert.equal(g.status,'finished');
  assert.equal(g.crossing.playerIndex,1);
  assert.ok(Math.abs(g.crossing.lon)>170,'korsningen ska ligga nära datumgränsen');
});

test('duell bygger separata linjer för spelarna',()=>{
  let g=createGame({mode:'duel',players:['A','B']});
  g=playPlace(g,p('a','A',0,0));
  g=playPlace(g,p('x','X',20,20));
  g=playPlace(g,p('b','B',0,10));
  g=playPlace(g,p('y','Y',20,30));
  assert.equal(g.segments.length,2);
  assert.deepEqual(g.segments.map(s=>s.playerIndex),[0,1]);
});

test('duell avslutas direkt vid korsning med motspelarens linje',()=>{
  let g=createGame({mode:'duel',players:['A','B']});
  g=playPlace(g,p('a','A',0,0));
  g=playPlace(g,p('x','X',-10,5));
  g=playPlace(g,p('b','B',0,10));
  g=playPlace(g,p('y','Y',10,5));
  assert.equal(g.status,'finished');
  assert.equal(g.crossing.playerIndex,1);
  assert.equal(g.crossing.crossedPlayerIndex,0);
  assert.equal(g.winner,0);
});

test('duell räknar också korsning med egen linje',()=>{
  let g=createGame({mode:'duel',players:['A','B']});
  g=playPlace(g,p('a','A',0,0));
  g=playPlace(g,p('x','X',40,40));
  g=playPlace(g,p('b','B',0,10));
  g=playPlace(g,p('y','Y',45,40));
  g=playPlace(g,p('c','C',10,10));
  g=playPlace(g,p('z','Z',45,50));
  g=playPlace(g,p('d','D',-10,5));
  assert.equal(g.status,'finished');
  assert.equal(g.crossing.playerIndex,0);
  assert.equal(g.crossing.crossedPlayerIndex,0);
});
