import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const toolbox=readFileSync(join(root,'app-toolbox.js'),'utf8');
const loader=readFileSync(join(root,'app.js'),'utf8');

test('toolbox is opt-in and does not load for ordinary players',()=>{
  assert.match(loader,/params\.get\('verktyg'\)==='1'/);
  assert.match(loader,/files\.push\('app-toolbox\.js'\)/);
  assert.match(toolbox,/params\.get\('verktyg'\) !== '1'/);
});

test('toolbox supports persistent visual overrides and export',()=>{
  assert.match(toolbox,/orten2:toolbox:overrides:v1/);
  assert.match(toolbox,/localStorage\.setItem\(STORAGE_KEY/);
  assert.match(toolbox,/JSON\.stringify\(overrides,null,2\)/);
  assert.match(toolbox,/toolboxImport/);
  assert.match(toolbox,/toolboxCopy/);
});

test('toolbox can edit content, layout and dynamically rendered elements',()=>{
  assert.match(toolbox,/toolboxText/);
  assert.match(toolbox,/toolboxFontSize/);
  assert.match(toolbox,/toolboxColor/);
  assert.match(toolbox,/toolboxWidth/);
  assert.match(toolbox,/toolboxX/);
  assert.match(toolbox,/toolboxCss/);
  assert.match(toolbox,/new MutationObserver/);
  assert.match(toolbox,/selectorFor/);
});
