import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const HS=require('../highscore.js');
globalThis.OrtenHighscore=HS;
const GLOBAL=require('../supabase-highscore.js');

const sweden={mode:'solo',scope:'country',country:'SE',placeType:'any',duplicatePolicy:'exact'};

test('global adapter uses the exact same leaderboard key as local highscore',()=>{
  assert.equal(GLOBAL.boardKey(sweden),HS.boardKey(sweden));
  assert.notEqual(GLOBAL.boardKey(sweden),GLOBAL.boardKey({...sweden,country:'NO'}));
});

test('global row normalization sorts scores and limits the visible board',()=>{
  const rows=Array.from({length:12},(_,i)=>({player_name:`P${i+1}`,score:i+1,updated_at:new Date(1000+i).toISOString()}));
  const normalized=GLOBAL.normalizeRows(rows);
  assert.equal(normalized.length,10);
  assert.equal(normalized[0].score,12);
  assert.equal(normalized.at(-1).score,3);
  assert.equal(normalized[0].source,'global');
});

test('global personal best logic never replaces a better score',()=>{
  assert.equal(GLOBAL.isPersonalBest(null,8),true);
  assert.equal(GLOBAL.isPersonalBest(8,9),true);
  assert.equal(GLOBAL.isPersonalBest(8,8),false);
  assert.equal(GLOBAL.isPersonalBest(8,7),false);
  assert.equal(GLOBAL.isPersonalBest(8,0),false);
});

test('Supabase SDK is version pinned and project URL is HTTPS',()=>{
  assert.match(GLOBAL.PROJECT_URL,/^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.equal(GLOBAL.SDK_URL,'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0');
});
