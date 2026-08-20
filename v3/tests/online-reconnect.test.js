import test from 'node:test';
import assert from 'node:assert/strict';
import {createOnlineController} from '../src/online.js';

class Emitter{
  constructor(){this.handlers=new Map()}
  on(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn);return this}
  emit(name,...args){for(const fn of this.handlers.get(name)||[])fn(...args)}
}

const peers=new Map();
class FakePeer extends Emitter{
  constructor(id){
    super();this.id=id;this.open=false;this.destroyed=false;this.reconnectCalls=0;peers.set(id,this);
    queueMicrotask(()=>{this.open=true;this.emit('open',id)});
  }
  reconnect(){
    this.reconnectCalls+=1;
    if(this.destroyed||this.open)return;
    this.open=true;
    queueMicrotask(()=>this.emit('open',this.id));
  }
  destroy(){this.destroyed=true;this.open=false;peers.delete(this.id)}
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('host använder en enda reconnect-loop och backoff vid upprepade disconnected-event',async()=>{
  globalThis.Peer=FakePeer;
  const statuses=[];
  const host=createOnlineController({onStatus:s=>statuses.push(structuredClone(s))});
  await host.createRoom({name:'Anna',code:'ABCDE'});

  const peer=peers.get('orten3-abcde');
  const firstConnection=host.snapshot().connectionId;
  assert.equal(host.snapshot().status,'connected');
  assert.ok(firstConnection);

  peer.open=false;
  peer.emit('disconnected');
  peer.emit('disconnected');
  peer.emit('disconnected');

  assert.equal(peer.reconnectCalls,0,'första återanslutningen ska vänta 1 sekund');
  assert.equal(host.snapshot().reconnectAttempt,1);
  assert.equal(host.snapshot().reconnectReason,'peer-disconnected');
  assert.equal(statuses.filter(s=>s.status==='reconnecting').length,1,'duplicerade disconnected-event får inte starta parallella försök');

  await sleep(1100);
  await sleep(0);

  assert.equal(peer.reconnectCalls,1);
  assert.equal(host.snapshot().status,'connected');
  assert.equal(host.snapshot().reconnectAttempt,0);
  assert.notEqual(host.snapshot().connectionId,firstConnection,'ny transport-epoch ska synas i diagnostiken');

  host.leave();
  delete globalThis.Peer;
});
