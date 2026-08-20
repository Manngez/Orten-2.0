import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,playPlace} from '../src/engine.js';
import {abandonMatchJournal,appendMatchState,compactMatchJournal,createMatchJournal,expandMatchJournal,loadMatchHistory,parseMatchJournal,replayMatchState,saveMatchJournal,serializeMatchJournal} from '../src/journal.js';

const p=(id,name,lat,lon)=>({id,name,lat,lon,countryCode:'SE',country:'Sverige'});

class MemoryStorage{
  constructor(){this.values=new Map()}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(String(key),String(value))}
}

class ThrowingStorage{
  getItem(){throw new Error('blocked')}
  setItem(){throw new Error('blocked')}
}

test('journalen följer start, drag och replay utan att duplicera samma state',()=>{
  let state=createGame({mode:'classic',players:['A','B']});
  let journal=createMatchJournal(state,{id:'match-1',at:1000});
  assert.equal(journal.entries.length,1);
  assert.equal(journal.entries[0].event,'start');

  journal=appendMatchState(journal,state,{event:'render',at:1100});
  assert.equal(journal.entries.length,1,'identiskt state ska inte dupliceras');

  state=playPlace(state,p('umea','Umeå',63.8258,20.263));
  journal=appendMatchState(journal,state,{event:'move',at:1200});
  state=playPlace(state,p('stockholm','Stockholm',59.3293,18.0686));
  journal=appendMatchState(journal,state,{event:'move',at:1300});
  assert.equal(journal.entries.length,3);
  assert.equal(replayMatchState(journal,1).places[0].name,'Umeå');
  assert.equal(replayMatchState(journal,2).places[1].name,'Stockholm');

  const replay=replayMatchState(journal,2);
  replay.players[0].name='Ändrad';
  assert.equal(journal.entries[2].state.players[0].name,'A','replay ska vara en frikopplad kopia');
});

test('avslutad match markeras automatiskt och överlever full serialisering',()=>{
  let state=createGame({mode:'classic',players:['A','B']});
  let journal=createMatchJournal(state,{id:'match-2',at:2000});
  state=playPlace(state,p('a','A',0,0));journal=appendMatchState(journal,state,{at:2100});
  state=playPlace(state,p('b','B',10,10));journal=appendMatchState(journal,state,{at:2200});
  state=playPlace(state,p('c','C',0,10));journal=appendMatchState(journal,state,{at:2300});
  state=playPlace(state,p('d','D',10,0));journal=appendMatchState(journal,state,{at:2400});
  assert.equal(state.status,'finished');
  assert.equal(journal.status,'finished');
  assert.equal(journal.endedAt,2400);
  assert.equal(journal.winner,0);

  const parsed=parseMatchJournal(serializeMatchJournal(journal));
  assert.equal(parsed.entries.length,journal.entries.length);
  assert.equal(parsed.status,'finished');
});

test('kompakt lagring kan byggas tillbaka till identisk replay',()=>{
  let state=createGame({mode:'classic',players:['A','B']});
  let journal=createMatchJournal(state,{id:'compact-1',at:3000});
  state=playPlace(state,p('umea','Umeå',63.8258,20.263));journal=appendMatchState(journal,state,{revision:1,at:3100});
  state=playPlace(state,p('stockholm','Stockholm',59.3293,18.0686));journal=appendMatchState(journal,state,{revision:2,at:3200});

  const compact=compactMatchJournal(journal);
  assert.equal(compact.storageVersion,1);
  assert.equal(compact.entries,undefined);
  assert.equal(compact.steps.length,2);
  assert.equal(compact.steps[1].place.name,'Stockholm');

  const expanded=expandMatchJournal(compact);
  assert.equal(expanded.entries.length,3);
  assert.deepEqual(replayMatchState(expanded,2),replayMatchState(journal,2));
});

test('avbruten match kan journalföras och sparad historik begränsas',()=>{
  const storage=new MemoryStorage();
  for(let i=0;i<4;i++){
    const state=createGame({mode:'solo',players:[`P${i}`]});
    let journal=createMatchJournal(state,{id:`m${i}`,at:100+i});
    journal=abandonMatchJournal(journal,{at:200+i});
    assert.equal(saveMatchJournal(journal,{storage,limit:3}),true);
  }
  const raw=JSON.parse(storage.getItem('orten3:match-history:v1'));
  assert.equal(raw[0].storageVersion,1);
  assert.equal(raw[0].entries,undefined,'persistensen ska inte lagra full state för varje steg');

  const history=loadMatchHistory({storage});
  assert.equal(history.length,3);
  assert.deepEqual(history.map(item=>item.id),['m3','m2','m1']);
  assert.equal(history[0].status,'abandoned');
});

test('blockerad lokal lagring får inte stoppa spelet',()=>{
  const state=createGame({mode:'solo',players:['A']});
  const journal=abandonMatchJournal(createMatchJournal(state,{id:'blocked'}));
  const storage=new ThrowingStorage();
  assert.equal(saveMatchJournal(journal,{storage}),false);
  assert.deepEqual(loadMatchHistory({storage}),[]);
});
