import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const HS=require('../highscore.js');
globalThis.OrtenHighscore=HS;
const GLOBAL=require('../supabase-highscore.js');

const key='solo|country:SE|any|exact';

test('replay token is safe to use inside a leaderboard storage key',()=>{
  const token=GLOBAL.boardToken(key);
  assert.ok(token.length>0);
  assert.equal(token.includes('|'),false);
  assert.equal(token.includes('%'),false);
});

test('replay prefix binds a replay to leaderboard and exact personal-best timestamp',()=>{
  const prefix=GLOBAL.replayPrefix(key,1723912345678);
  assert.match(prefix,/^replay\|[^|]+\|1723912345678\|$/);
});

test('replay route normalization keeps valid coordinates and compact place identity',()=>{
  const points=GLOBAL.normalizeReplayPoints([
    {name:'Umeå',lat:63.8258,lon:20.2630,countryCode:'se'},
    {name:'Fel',lat:120,lon:20,countryCode:'SE'},
    {name:'Stockholm',lat:59.3293,lon:18.0686,countryCode:'SE'}
  ]);
  assert.equal(points.length,2);
  assert.equal(points[0].name,'Umeå');
  assert.equal(points[0].countryCode,'SE');
  assert.equal(points[1].index,3);
});

test('stored replay point keys can be parsed back into route coordinates',()=>{
  const prefix=GLOBAL.replayPrefix(key,1723912345678);
  const parsed=GLOBAL.parseReplayBoardKey(`${prefix}0007|63.82580|20.26300|SE`);
  assert.equal(parsed.stamp,1723912345678);
  assert.equal(parsed.index,7);
  assert.equal(parsed.lat,63.8258);
  assert.equal(parsed.lon,20.263);
  assert.equal(parsed.countryCode,'SE');
});
