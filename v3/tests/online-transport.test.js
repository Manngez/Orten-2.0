import test from 'node:test';
import assert from 'node:assert/strict';
import {createOnlineController,makeRoomCode} from '../src/online.js';

test('rumskoden är fem tecken och undviker tvetydiga tecken',()=>{
  const code=makeRoomCode(()=>0);
  assert.equal(code.length,5);
  assert.match(code,/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
});

test('onlinekontrollern startar helt offline',()=>{
  const controller=createOnlineController();
  const state=controller.snapshot();
  assert.equal(state.role,'offline');
  assert.equal(state.status,'idle');
  assert.equal(state.started,false);
  assert.deepEqual(state.players,[]);
  assert.equal(controller.canMove(),false);
});

test('bara värden kan ändra online-läget',()=>{
  const controller=createOnlineController();
  assert.equal(controller.setMode('duel'),false);
  assert.equal(controller.snapshot().mode,'classic');
});
