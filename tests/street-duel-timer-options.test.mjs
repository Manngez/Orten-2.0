import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'app-street-duel-timer-options.js'),'utf8');

test('Gatduell erbjuder ingen tidsgräns och flera tidsval',()=>{
  assert.match(source,/OPTIONS=\[0,10,15,20,30,45,60\]/);
  assert.match(source,/Ingen tidsgräns/);
  assert.match(source,/DEFAULT_SECONDS=20/);
});

test('ingen tidsgräns stoppar nedräkningen helt',()=>{
  assert.match(source,/selectedSeconds===0\) return 0/);
  assert.match(source,/text\.textContent='Ingen tidsgräns'/);
});

test('valbar tidsgräns skalar den befintliga Gatduell-timern',()=>{
  assert.match(source,/selectedSeconds\/DEFAULT_SECONDS/);
  assert.match(source,/scaledDelay/);
  assert.match(source,/streetDuelTimerSelect/);
});
