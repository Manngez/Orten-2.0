import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');
const failures = [];
const ok = (condition, message) => { if (!condition) failures.push(message); };
const fileExists = path => existsSync(join(root, path));

const requiredFiles = [
  'index.html', 'styles.css', 'styles-base.css', 'styles-game.css', 'styles-responsive.css',
  'styles-atlas.css', 'styles-map-themes.css', 'manifest.webmanifest', 'data.js', 'app.js',
  'app-core.js', 'app-setup.js', 'app-map.js', 'map-themes.js', 'app-search.js', 'app-ui.js',
  'app-online.js', 'app-online-entry.js', 'place-worker.js', 'game-geometry.js', 'service-worker.js',
  'assets/logo.svg', 'data/world-places.json', 'data/world-meta.json'
];

for (const file of requiredFiles) ok(fileExists(file), `Saknad kritisk fil: ${file}`);

const html = read('index.html');
const app = read('app.js');
const core = read('app-core.js');
const mapThemes = read('map-themes.js');
const css = read('styles.css');
const sw = read('service-worker.js');

ok(/<html\s+lang="sv"/i.test(html), 'index.html måste deklarera svenska som språk.');
ok(/name="viewport"/i.test(html), 'Viewport-meta saknas.');
ok(/rel="manifest"[^>]+manifest\.webmanifest/i.test(html), 'Webbmanifestet är inte länkat från index.html.');
ok(/integrity="sha256-[^"]+"/i.test(html), 'Externa Leaflet-resurser måste ha SRI-integritet.');
ok(!/\bonclick\s*=/i.test(html), 'Inline onclick-handlers är förbjudna i releasebygget.');

const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
ok(duplicateIds.length === 0, `Duplicerade DOM-id:n: ${[...new Set(duplicateIds)].join(', ')}`);

const initElsBlock = core.match(/function\s+initEls\(\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
const staticIdArray = initElsBlock.match(/\[([\s\S]*?)\]\.forEach/)?.[1] || '';
const expectedIds = [...staticIdArray.matchAll(/'([^']+)'/g)].map(match => match[1]);
for (const id of expectedIds) ok(htmlIds.includes(id), `app-core.js förväntar DOM-id som saknas i index.html: ${id}`);

const loaderBlock = app.match(/const\s+files\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';
const loaderFiles = [...loaderBlock.matchAll(/'([^']+\.js)'/g)].map(match => match[1]);
ok(loaderFiles.length >= 8, 'app.js kunde inte verifiera modulordningen.');
for (const file of loaderFiles) ok(fileExists(file), `app.js försöker ladda en fil som saknas: ${file}`);
ok(loaderFiles.includes('game-geometry.js'), 'Den testade geometri-motorn måste laddas av app.js.');
ok(loaderFiles.indexOf('game-geometry.js') < loaderFiles.indexOf('app-map.js'), 'game-geometry.js måste laddas före app-map.js.');

const imports = [...css.matchAll(/@import\s+url\(["']\.\/([^"']+)["']\)/g)].map(match => match[1].split('?')[0]);
for (const file of imports) ok(fileExists(file), `styles.css importerar en fil som saknas: ${file}`);

let manifest;
try { manifest = JSON.parse(read('manifest.webmanifest')); }
catch { failures.push('manifest.webmanifest är inte giltig JSON.'); }
if (manifest) {
  ok(manifest.name === 'Orten 2.0', 'Manifestnamnet måste vara Orten 2.0.');
  ok(manifest.display === 'standalone', 'PWA-display måste vara standalone.');
  ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'Manifestet saknar appikon.');
  for (const icon of manifest.icons || []) ok(fileExists(icon.src), `Manifestikon saknas: ${icon.src}`);
}

const tileUrls = [...mapThemes.matchAll(/https:\/\/[^'"\s]+/g)].map(match => match[0]);
ok(tileUrls.length >= 3, 'Alla tre kartteman måste ha verifierbara tile-URL:er.');
for (const url of tileUrls) ok(url.includes('_nolabels'), `Karttema får inte visa ortnamn: ${url}`);

ok(/serviceWorker\.register/.test(app), 'Service Worker måste registreras från app.js.');
ok(/world-places\.json/.test(sw), 'Service Worker måste uttryckligen hantera world-places.json.');
ok(/NETWORK_ONLY/i.test(sw), 'Det stora ortregistret måste vara network-only för att undvika gammal världsdata i cache.');

const jsFiles = ['app.js', ...loaderFiles, 'place-worker.js', 'data.js', 'service-worker.js'];
for (const file of [...new Set(jsFiles)]) {
  const source = read(file);
  ok(!/\beval\s*\(/.test(source), `eval() är förbjudet i ${file}.`);
  ok(!/new\s+Function\s*\(/.test(source), `new Function() är förbjudet i ${file}.`);
}

if (failures.length) {
  console.error(`\nQUALITY GATE FAILED (${failures.length})`);
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log(`Quality gate OK: ${requiredFiles.length} kritiska filer, ${expectedIds.length} DOM-kontrakt, ${loaderFiles.length} klientmoduler, PWA, kartteman och säkerhetsregler verifierade.`);
