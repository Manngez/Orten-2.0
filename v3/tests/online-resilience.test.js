import test from 'node:test';
import assert from 'node:assert/strict';
import {createOnlineController} from '../src/online.js';
import {ONLINE_PROTOCOL_VERSION} from '../src/online-protocol.js';

class Emitter{
  constructor(){this.handlers=new Map()}
  on(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn);return this}
  emit(name,...args){for(const fn of this.handlers.get(name)||[])fn(...args)}
}

class FakeConnection extends Emitter{
  constructor(metadata={}){super();this.metadata=metadata;this.open=false;this.other=null;this.closed=false}
  send(message){if(this.open&&!this.closed&&this.other?.open)queueMicrotask(()=>this.other.emit('data',structuredClone(message)))}
  close(){
    if(this.closed)return;
    this.closed=true;this.open=false;
    const other=this.other;
    queueMicrotask(()=>this.emit('close'));
    if(other&&!other.closed){other.closed=true;other.open=false;queueMicrotask(()=>other.emit('close'))}
  }
}

const registry=new Map();
let guestCounter=0;
class FakePeer extends Emitter{
  constructor(id){
    super();this.id=id||`guest-${++guestCounter}`;this.open=false;this.destroyed=false;this.connections=[];registry.set(this.id,this);
    queueMicrotask(()=>{this.open=true;this.emit('open',this.id)});
  }
  connect(targetId,options={}){
    const target=registry.get(targetId);const client=new FakeConnection(options.metadata||{});this.connections.push(client);
    if(!target){queueMicrotask(()=>client.emit('error',{type:'peer-unavailable'}));return client}
    const server=new FakeConnection(options.metadata||{});client.other=server;server.other=client;target.connections.push(server);
    queueMicrotask(()=>{target.emit('connection',server);client.open=true;server.open=true;server.emit('open');client.emit('open')});
    return client;
  }
  reconnect(){if(!this.destroyed&&!this.open){this.open=true;queueMicrotask(()=>this.emit('open',this.id))}}
  destroy(){this.destroyed=true;this.open=false;registry.delete(this.id)}
}

class MemoryStorage{
  constructor(){this.values=new Map()}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(String(key),String(value))}
  removeItem(key){this.values.delete(String(key))}
  clear(){this.values.clear()}
}

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const p=(id,name,lat,lon)=>({id,name,lat,lon,countryCode:'SE',country:'Sverige'});
const canonical=new Map([
  ['umea',p('umea','Umeå',63.8258,20.263)],
  ['stockholm',p('stockholm','Stockholm',59.3293,18.0686)],
  ['malmo',p('malmo','Malmö',55.605,13.0038)],
  ['goteborg',p('goteborg','Göteborg',57.7089,11.9746)]
]);
const rawMove=(playerId,clientMoveId,place)=>({protocol:ONLINE_PROTOCOL_VERSION,type:'MOVE',playerId,clientMoveId,place});

async function settle(){await tick();await tick();await tick()}

test('anslutningen binder identitet, stoppar replay och återtar samma spelare efter omladdning',async()=>{
  registry.clear();guestCounter=0;
  globalThis.Peer=FakePeer;
  globalThis.sessionStorage=new MemoryStorage();
  let hostState=null;let guestState=null;let guest2State=null;
  const hostErrors=[];
  const resolver=id=>canonical.get(String(id))||null;
  const host=createOnlineController({resolvePlace:resolver,onState:event=>{hostState=event.state},onError:error=>hostErrors.push(error.message)});
  const guest=createOnlineController({onState:event=>{guestState=event.state}});

  await host.createRoom({name:'Anna',code:'ABCDE',mode:'classic'});
  await guest.joinRoom({name:'Bertil',code:'ABCDE'});
  await settle();
  const oldGuestId=guest.snapshot().playerId;
  const guestPeer=registry.get('guest-1');
  const guestConn=guestPeer.connections[0];
  host.startGame();
  await settle();

  // Gästen försöker utge sig för att vara värden medan det är värdens tur.
  guestConn.send(rawMove('host','spoof-1',p('stockholm','Stockholm',0,0)));
  await settle();
  assert.equal(hostState.places.length,0);
  assert.match(hostErrors.at(-1),/inte den spelarens tur/);

  host.submitMove(p('umea','Umeå',0,0));
  await settle();
  assert.equal(hostState.places[0].lat,63.8258,'värden ska använda sin kanoniska ortdata');

  // Paketets playerId ignoreras: identiteten kommer från PeerJS-anslutningen.
  guestConn.send(rawMove('host','guest-move-1',p('stockholm','Stockholm',0,0)));
  await settle();
  assert.equal(hostState.places.length,2);
  assert.equal(hostState.places[1].name,'Stockholm');
  assert.equal(hostState.places[1].lat,59.3293);

  host.submitMove(p('malmo','Malmö',0,0));
  await settle();
  assert.equal(host.snapshot().revision,3);

  // Samma drag-id får aldrig kunna bli ett nytt drag när det återspelas senare.
  guestConn.send(rawMove(oldGuestId,'guest-move-1',p('goteborg','Göteborg',57.7089,11.9746)));
  await settle();
  assert.equal(hostState.places.length,3);
  assert.equal(host.snapshot().revision,3);

  // Simulera att gästens sida laddas om. sessionStorage behåller spelar-id:t.
  guest.leave();
  await settle();
  assert.equal(host.snapshot().players[1].connected,false);

  const guest2=createOnlineController({onState:event=>{guest2State=event.state}});
  await guest2.joinRoom({name:'Nytt visningsnamn',code:'ABCDE'});
  await settle();
  assert.equal(guest2.snapshot().playerId,oldGuestId);
  assert.equal(host.snapshot().players.length,2);
  assert.equal(host.snapshot().players[1].connected,true);
  assert.equal(host.snapshot().players[1].name,'Bertil','namnet i en pågående match ska inte kunna bytas vid återanslutning');
  assert.equal(guest2State.places.length,3);
  assert.equal(guest2.snapshot().revision,3);
  assert.equal(guestState.places.length,3);

  host.leave();guest2.leave();
  delete globalThis.Peer;delete globalThis.sessionStorage;
});
