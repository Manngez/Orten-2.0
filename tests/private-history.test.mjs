import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const CORE=require('../private-history-core.js');

test('private history row keys round-trip and group complete payloads',()=>{
  const encoded='A'.repeat(2100);
  const rows=CORE.chunkPayload(encoded,{stamp:1723910000000,matchId:'match_123',chunkSize:700});
  assert.equal(rows.length,3);
  assert.equal(CORE.parseRowKey(rows[0].boardKey).matchId,'match_123');
  const shuffled=[rows[2],rows[0],rows[1]].map(part=>({board_key:part.boardKey,updated_at:'2026-08-17T10:00:00Z'}));
  const grouped=CORE.groupRows(shuffled);
  assert.equal(grouped.length,1);
  assert.equal(grouped[0].encoded,encoded);
});

test('incomplete private history chunks are never exposed as a session',()=>{
  const rows=CORE.chunkPayload('B'.repeat(1800),{stamp:1723910000000,matchId:'missing_chunk',chunkSize:600});
  assert.equal(CORE.groupRows([{board_key:rows[0].boardKey},{board_key:rows[2].boardKey}]).length,0);
});

test('encrypted history can only be decrypted with the matching private key',async()=>{
  const pair=await globalThis.crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const publicJwk=await globalThis.crypto.subtle.exportKey('jwk',pair.publicKey);
  const privateJwk=await globalThis.crypto.subtle.exportKey('jwk',pair.privateKey);
  const value={kind:'orten',players:[{name:'Test'}],rounds:[{route:[{name:'Umeå',lat:63.8258,lon:20.263}]}]};
  const envelope=await CORE.encryptObject(value,publicJwk);
  const encoded=CORE.encodeEnvelope(envelope);
  const decoded=CORE.decodeEnvelope(encoded);
  const clear=await CORE.decryptObject(decoded,privateJwk.d,publicJwk);
  assert.deepEqual(clear,value);

  const wrongPair=await globalThis.crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const wrongPrivate=await globalThis.crypto.subtle.exportKey('jwk',wrongPair.privateKey);
  await assert.rejects(()=>CORE.decryptObject(decoded,wrongPrivate.d,publicJwk));
});

test('match id stays stable for equivalent online copies in the same five minute bucket',async()=>{
  const base={kind:'orten',status:'completed',completedAt:1723910200000,roomCode:'ABCDE',settings:{mode:'classic',scope:'country',country:'SE'},players:[{name:'A',strikes:0,active:true},{name:'B',strikes:0,active:true}],totalMoves:12,totalCrossings:1,rounds:[{round:1,route:Array.from({length:12},(_,i)=>({name:`P${i}`}))}]};
  const copy={...base,completedAt:base.completedAt+12000,startedAt:base.completedAt-60000};
  assert.equal(await CORE.matchId(base),await CORE.matchId(copy));
});
