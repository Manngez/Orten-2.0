import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/engine.js';
import {acceptStateMessage,applyMoveMessage,createMoveMessage,createStateMessage} from '../src/online-protocol.js';

const place=(id,name,lat,lon)=>({id,name,lat,lon,countryCode:'SE',country:'Sverige'});

test('värden accepterar bara drag från spelaren vars tur det är',()=>{
  let state=createGame({mode:'classic',players:['Värd','Gäst'],playerIds:['host','guest']});
  const wrong=createMoveMessage('guest',place('1','Umeå',63.8258,20.263));
  assert.throws(()=>applyMoveMessage(state,wrong),/inte den spelarens tur/);

  const first=createMoveMessage('host',place('1','Umeå',63.8258,20.263),'m1');
  const applied=applyMoveMessage(state,first);
  state=applied.state;
  assert.equal(applied.ackMoveId,'m1');
  assert.equal(state.turn,1);

  const second=createMoveMessage('guest',place('2','Stockholm',59.3293,18.0686),'m2');
  state=applyMoveMessage(state,second).state;
  assert.equal(state.places.length,2);
  assert.equal(state.turn,0);
});

test('gästen ignorerar äldre state-revisioner',()=>{
  const state=createGame({mode:'duel',players:['A','B'],playerIds:['host','guest']});
  const message=createStateMessage(state,4);
  assert.equal(acceptStateMessage(3,message).accepted,true);
  assert.equal(acceptStateMessage(4,message).accepted,false);
  assert.equal(acceptStateMessage(8,message).accepted,false);
});

test('state-meddelandet är en frikopplad kopia',()=>{
  const state=createGame({mode:'classic',players:['A','B'],playerIds:['host','guest']});
  const message=createStateMessage(state,1);
  state.players[0].name='Ändrad lokalt';
  assert.equal(message.state.players[0].name,'A');
});

test('ogiltigt inkommande state stoppas',()=>{
  const state=createGame({mode:'classic',players:['A','B'],playerIds:['host','guest']});
  const message=createStateMessage(state,1);
  message.state.turn=99;
  assert.throws(()=>acceptStateMessage(0,message),/spelstate är ogiltigt/);
});
