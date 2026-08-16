import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const HS=require('../highscore.js');

function memoryStorage(){
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key)
  };
}

const sweden={mode:'solo',scope:'country',country:'SE',placeType:'any',duplicatePolicy:'exact'};

test('boardKey separates scopes and rules',()=>{
  assert.notEqual(HS.boardKey(sweden),HS.boardKey({...sweden,country:'NO'}));
  assert.notEqual(HS.boardKey(sweden),HS.boardKey({...sweden,duplicatePolicy:'allow'}));
  assert.equal(HS.boardKey({...sweden,scope:'custom',countries:['SE','DK','FI','NO','IS']}),'solo|nordic|any|exact');
});

test('record stores and ranks personal bests',()=>{
  const storage=memoryStorage();
  let result=HS.record({settings:sweden,playerName:'Magnus',score:12,completedAt:100},storage);
  assert.equal(result.personalBest,true);
  assert.equal(result.rank,1);

  HS.record({settings:sweden,playerName:'Lucas',score:18,completedAt:200},storage);
  result=HS.record({settings:sweden,playerName:'Magnus',score:15,completedAt:300},storage);
  assert.equal(result.personalBest,true);
  assert.equal(result.previousBest,12);
  assert.equal(result.rank,2);
  assert.deepEqual(HS.list(sweden,storage).map(row=>[row.name,row.score]),[['Lucas',18],['Magnus',15]]);
});

test('worse result never overwrites an existing personal best',()=>{
  const storage=memoryStorage();
  HS.record({settings:sweden,playerName:'Magnus',score:20,completedAt:100},storage);
  const result=HS.record({settings:sweden,playerName:'Magnus',score:8,completedAt:200},storage);
  assert.equal(result.personalBest,false);
  assert.equal(result.previousBest,20);
  assert.equal(HS.best(sweden,'Magnus',storage).score,20);
});

test('leaderboard keeps only the ten best unique players',()=>{
  const storage=memoryStorage();
  for(let i=1;i<=14;i++)HS.record({settings:sweden,playerName:`P${i}`,score:i,completedAt:i},storage);
  const rows=HS.list(sweden,storage);
  assert.equal(rows.length,10);
  assert.equal(rows[0].score,14);
  assert.equal(rows.at(-1).score,5);
});

test('non-solo results are not eligible for highscore',()=>{
  const storage=memoryStorage();
  const result=HS.record({settings:{...sweden,mode:'classic'},playerName:'Magnus',score:99},storage);
  assert.equal(result.eligible,false);
  assert.equal(HS.list(sweden,storage).length,0);
});
