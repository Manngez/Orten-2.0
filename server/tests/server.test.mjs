import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore} from '../store.mjs';
import {createRoomServer} from '../http.mjs';
import {createServerOnlineController} from '../../v3/src/server-online.js';
const places=new Map(['A','B','C'].map((name,i)=>[name,{id:name,name,lat:60+i,lon:18+i,countryCode:'SE'}]));
const options={resolvePlace:id=>places.get(id)};
function pair(store){const a=store.create({code:'ABCDE',name:'Anna',countries:['SE']}),b=store.join('ABCDE',{name:'Bertil'});store.request('ABCDE',a.token,'start');return [a,b]}
const move=(placeId,revision,moveId='move-0001')=>({placeId,revision,moveId});

test('server authenticates, validates turns and canonical coordinates; writes are idempotent across restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'orten-')),path=join(dir,'db.sqlite');let s=new RoomStore(path,options);
 try{
  const [a,b]=pair(s);
  assert.throws(()=>s.request('ABCDE','0'.repeat(64),'state'),/nyckel/);
  assert.throws(()=>s.request('ABCDE',b.token,'start'),/värden/);
  assert.throws(()=>s.request('ABCDE',b.token,'move',move('A',0)),/tur/);
  assert.throws(()=>s.request('ABCDE',a.token,'move',move('missing',0)),/register/);
  let r=s.request('ABCDE',a.token,'move',{...move('A',0),lat:0,lon:0,playerId:b.playerId});
  assert.equal(r.state.places[0].lat,60);assert.equal(r.revision,1);
  assert.equal(s.request('ABCDE',a.token,'move',move('A',0)).revision,1);
  s.close();s=new RoomStore(path,options);
  assert.equal(s.request('ABCDE',a.token,'move',move('A',0)).revision,1);
  assert.throws(()=>s.request('ABCDE',a.token,'move',move('B',0)),/annan ort/);
  assert.throws(()=>s.request('ABCDE',b.token,'move',move('B',0)),/uppdaterats/);
  r=s.request('ABCDE',b.token,'move',move('B',1));assert.equal(r.revision,2);
  assert.equal(r.state.places.length,2);assert.ok(!JSON.stringify(r).includes(a.token));assert.ok(!JSON.stringify(r).includes('secret'));
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});

test('room expiration, country restrictions and completed match protection',()=>{
 let now=0;const s=new RoomStore(':memory:',{...options,now:()=>now,ttl:100});
 try{const [a]=pair(s);assert.throws(()=>s.request('ABCDE',a.token,'settings',{countries:['NO']}),/ändras/);now=101;assert.throws(()=>s.request('ABCDE',a.token,'state'),/gått ut/)}finally{s.close()}
 const t=new RoomStore(':memory:',options);
 try{const a=t.create({code:'FGHJK',name:'A',countries:['NO']});t.join('FGHJK',{name:'B'});t.request('FGHJK',a.token,'start');assert.throws(()=>t.request('FGHJK',a.token,'move',move('A',0)),/utanför/);assert.equal(t.request('FGHJK',a.token,'state').revision,0)}finally{t.close()}
});
class MemoryStorage{data=new Map();getItem(k){return this.data.get(k)||null}setItem(k,v){this.data.set(k,v)}removeItem(k){this.data.delete(k)}}
const waitFor=async f=>{for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,15))}assert.fail('Timed out waiting for state')};

test('real HTTP: host page reload, lost MOVE response, retries and guest reconnection',async()=>{
 const store=new RoomStore(':memory:',options),server=createRoomServer(store,{root:new URL('../../',import.meta.url).pathname});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api`,aStorage=new MemoryStorage(),bStorage=new MemoryStorage();
 let aState,bState,drop=false;
 const a=createServerOnlineController({onState:e=>aState=e.state},{base,storage:aStorage,interval:15});
 const b=createServerOnlineController({onState:e=>bState=e.state},{base,storage:bStorage,interval:15,fetch:async(...args)=>{const r=await fetch(...args);if(drop&&String(args[0]).endsWith('/move')){drop=false;throw new TypeError('Lost response')}return r}});
 let restored;
 try{
  await a.createRoom({code:'ABCDE',name:'Anna',countries:['SE']});await b.joinRoom({code:'ABCDE',name:'Bertil'});await a.startGame();await waitFor(()=>bState);
  assert.equal(a.snapshot().token,undefined);a.submitMove(places.get('A'));await waitFor(()=>bState?.places.length===1);
  a.destroy(); // Host disappears entirely; guest can still play.
  drop=true;b.submitMove(places.get('B'));await waitFor(()=>bState?.places.length===2&&!b.snapshot().pending);
  restored=createServerOnlineController({onState:e=>aState=e.state},{base,storage:aStorage,interval:15});await restored.resume();
  assert.equal(aState.places.length,2);assert.equal(restored.snapshot().role,'host');assert.equal(restored.canMove(),true);
  assert.equal(store.request('ABCDE',JSON.parse(aStorage.getItem(`orten3:server-session:${base}`)).token,'state').revision,2);
  const bad=await fetch(base+'/rooms/ABCDE/state');assert.equal(bad.status,401);
  const origin=await fetch(base+'/rooms/ABCDE/state',{headers:{Origin:'https://evil.example'}});assert.equal(origin.status,403);
  const secret=await fetch(base.replace('/api','')+'/server/var/rooms.sqlite');assert.equal(secret.status,404);
  const cfg=await fetch(base.replace('/api','')+'/v3/server-config.js');assert.match(await cfg.text(),/ORTEN_SERVER_URL/);
 }finally{a.destroy();b.destroy();restored?.destroy();await new Promise(r=>server.close(r));store.close()}
});

test('pending move survives full client reload before delivery',async()=>{
 const store=new RoomStore(':memory:',options),server=createRoomServer(store);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api`,storage=new MemoryStorage();let resumed,state;
 const a=createServerOnlineController({}, {base,storage,interval:100000,fetch:async(...args)=>{if(String(args[0]).endsWith('/move'))throw new TypeError('offline');return fetch(...args)}});
 try{
  await a.createRoom({code:'ABCDE',name:'Anna'});store.join('ABCDE',{name:'Bertil'});await a.startGame();a.submitMove(places.get('A'));
  await new Promise(r=>setTimeout(r,20));a.destroy();
  assert.ok(JSON.parse(storage.getItem(`orten3:server-session:${base}`)).pending);
  resumed=createServerOnlineController({onState:e=>state=e.state},{base,storage,interval:100000});await resumed.resume();
  assert.equal(state.places.length,1);assert.equal(resumed.snapshot().revision,1);assert.equal(resumed.snapshot().pending,false);
 }finally{a.destroy();resumed?.destroy();await new Promise(r=>server.close(r));store.close()}
});

test('finished games cannot accept more moves; failed writes do not advance revision',()=>{
 const coords=[[0,0],[2,2],[0,2],[2,0],[3,0]];
 const s=new RoomStore(':memory:',{resolvePlace:id=>({id,name:id,lat:coords[Number(id)][0],lon:coords[Number(id)][1],countryCode:'SE'})});
 try{
  const [a,b]=pair(s);
  for(let i=0;i<4;i++)s.request('ABCDE',i%2?b.token:a.token,'move',move(String(i),i,`move-000${i}`));
  assert.equal(s.request('ABCDE',a.token,'state').state.status,'finished');
  assert.throws(()=>s.request('ABCDE',a.token,'move',move('4',4,'move-0004')),/inte aktiv/);
  assert.equal(s.request('ABCDE',a.token,'state').revision,4);
 }finally{s.close()}
});
