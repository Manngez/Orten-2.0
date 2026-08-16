import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const toolbox=readFileSync(join(root,'app-toolbox.js'),'utf8');
const mobileToolbox=readFileSync(join(root,'app-toolbox-mobile.js'),'utf8');
const toolboxCss=readFileSync(join(root,'styles-toolbox.css'),'utf8');
const loader=readFileSync(join(root,'app.js'),'utf8');
const sw=readFileSync(join(root,'service-worker.js'),'utf8');

test('toolbox is opt-in and does not load for ordinary players',()=>{
  assert.match(loader,/params\.get\('verktyg'\)==='1'/);
  assert.match(loader,/files\.push\('app-toolbox\.js','app-toolbox-mobile\.js'\)/);
  assert.match(toolbox,/params\.get\('verktyg'\) !== '1'/);
  assert.match(mobileToolbox,/params\.get\('verktyg'\) !== '1'/);
});

test('toolbox assets are available offline once the app shell is cached',()=>{
  assert.match(sw,/\.\/app-toolbox\.js/);
  assert.match(sw,/\.\/app-toolbox-mobile\.js/);
  assert.match(sw,/\.\/styles-toolbox\.css/);
  assert.match(toolboxCss,/\.toolbox-panel/);
  assert.match(toolboxCss,/\.toolbox-selected/);
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

test('mobile toolbox behaves like a bottom sheet and clears the screen while picking',()=>{
  assert.match(toolboxCss,/@media\(max-width:600px\)/);
  assert.match(toolboxCss,/--toolbox-mobile-height:min\(50dvh,520px\)/);
  assert.match(toolboxCss,/body\.orten-toolbox-picking #ortenToolboxRoot \.toolbox-panel/);
  assert.match(toolboxCss,/translateY\(calc\(100% \+ 24px\)\)/);
  assert.match(toolboxCss,/toolbox-panel-is-open/);
});

test('mobile toolbox height can be dragged and persists locally',()=>{
  assert.match(mobileToolbox,/toolbox:mobile-height:v1/);
  assert.match(mobileToolbox,/pointerdown/);
  assert.match(mobileToolbox,/pointermove/);
  assert.match(mobileToolbox,/pointerup/);
  assert.match(mobileToolbox,/startHeight \+ \(startY - event\.clientY\)/);
  assert.match(mobileToolbox,/localStorage\.setItem\(HEIGHT_KEY/);
});
