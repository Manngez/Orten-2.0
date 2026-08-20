import test from 'node:test';
import assert from 'node:assert/strict';
import {createOnlineController} from '../src/online.js';

class Emitter{
  constructor(){this.handlers=new Map()}
  on(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn);return this}
  emit(name,...args){for(const fn of this.handlers.get(name)||[])fn(...args)}
}

class FakeConnection extends Emitter{
  constructor(metadata={}){super();this.metadata=metadata;this.open=false;this.other=null;this.closed=false}
  send(message){if(this.open&&!this.closed&&this.other?.open)queueMicrotask(()=>this.other.emit('data',structuredClone(message)))}
  close(){if(this.closed)return;this.closed=true;this.open=false;const other=this.other;queueMicrotask(()=>this.emit('close'));if(other&&!other.closed){other.closed=true;other.open=false;queueMicrotask(()=>other.emit('close'))}}
}

const registry=new Map();
let guestCounter=0;
class FakePeer extends Emitter{
  constructor(id){
    super();this.id=id||`guest-${++guestCounter}`;this.open=false;this.destroyed=false;registry.set(this.id,this);
    queueMicrotask(()=>{this.open=true;this.emit('open',this.id)});
  }
  connect(targetId,options={}){
    const target=registry.get(targetId);const client=new FakeConnection(options.metadata||{});
    if(!target){queueMicrotask(()=>client.emit('error',{type:'peer-unavailable'}));return client}
    const server=new FakeConnection(options.metadata||{});client.other=server;server.other=client;
    queueMicrotask(()=>{target.emit('connection',server);client.open=true;server.open=true;server.emit('open');client.emit('open')});
    return client;
  }
  reconnect(){if(!this.destroyed&&!this.open){this.open=true;queueMicrotask(()=>this.emit('open',this.id))}}
  destroy(){this.destroyed=true;this.open=false;registry.delete(this.id)}
}

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const place=(id,name,lat,lon)=>({id,name,lat,lon,countryCode:'SE',country:'Sverige'});

test('skapa rum, anslut, starta och synka drag åt båda håll',async()=>{
  registry.clear();guestCounter=0;globalThis.Peer=FakePeer;
  let hostState=null;let guestState=null;
  const host=createOnlineController({onState:event=>{hostState=event.state}});
  const guest=createOnlineController({onState:event=>{guestState=event.state}});

  await host.createRoom({name:'Anna',code:'ABCDE',mode:'classic'});
  await guest.joinRoom({name:'Bertil',code:'ABCDE'});
  await tick();await tick();

  assert.equal(host.snapshot().players.length,2);
  assert.equal(guest.snapshot().players.length,2);
  assert.equal(host.snapshot().status,'connected');
  assert.equal(guest.snapshot().status,'connected');

  host.startGame();
  await tick();await tick();
  assert.equal(hostState.players[0].name,'Anna');
  assert.equal(guestState.players[1].name,'Bertil');
  assert.equal(host.canMove(),true);
  assert.equal(guest.canMove(),false);

  host.submitMove(place('umea','Umeå',63.8258,20.263));
  await tick();await tick();
  assert.equal(hostState.places.length,1);
  assert.equal(guestState.places.length,1);
  assert.equal(host.canMove(),false);
  assert.equal(guest.canMove(),true);

  guest.submitMove(place('stockholm','Stockholm',59.3293,18.0686));
  await tick();await tick();
  assert.equal(hostState.places.length,2);
  assert.equal(guestState.places.length,2);
  assert.equal(hostState.places[1].name,'Stockholm');
  assert.equal(host.snapshot().revision,2);
  assert.equal(guest.snapshot().revision,2);

  host.leave();guest.leave();delete globalThis.Peer;
});
