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
  'styles-atlas.css', 'styles-map-themes.css', 'styles-highscore.css', 'manifest.webmanifest', 'data.js', 'app.js',
  'app-core.js', 'app-setup.js', 'app-map.js', 'map-themes.js', 'app-search.js', 'app-ui.js',
  'app-highscore-ui.js', 'app-online.js', 'app-online-entry.js', 'place-worker.js', 'game-geometry.js', 'duel-routes.js', 'highscore.js',
  'supabase-highscore.js', 'service-worker.js', 'tests/geometry.test.mjs', 'tests/duel-routes.test.mjs', 'tests/highscore.test.mjs',
  'tests/global-highscore.test.mjs', 'assets/logo.svg', 'data/world-places.json', 'data/world-meta.json'
];

for (const file of requiredFiles) ok(fileExists(file), `Saknad kritisk fil: ${file}`);

const html = read('index.html');
const app = read('app.js');
const core = read('app-core.js');
const setup = read('app-setup.js');
const map = read('app-map.js');
const ui = read('app-ui.js');
const duel = read('duel-routes.js');
const mapThemes = read('map-themes.js');
const css = read('styles.css');
const sw = read('service-worker.js');
const highscore = read('highscore.js');
const globalHighscore = read('supabase-highscore.js');
const highscoreUI = read('app-highscore-ui.js');
const search = read('app-search.js');

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
ok(loaderFiles.length >= 12, 'app.js kunde inte verifiera modulordningen.');
for (const file of loaderFiles) ok(fileExists(file), `app.js försöker ladda en fil som saknas: ${file}`);
ok(loaderFiles.includes('game-geometry.js'), 'Den testade geometri-motorn måste laddas av app.js.');
ok(loaderFiles.includes('duel-routes.js'), 'Duellmotorn måste laddas av app.js.');
ok(loaderFiles.indexOf('game-geometry.js') < loaderFiles.indexOf('duel-routes.js'), 'game-geometry.js måste laddas före duel-routes.js.');
ok(loaderFiles.indexOf('duel-routes.js') < loaderFiles.indexOf('app-map.js'), 'duel-routes.js måste laddas före app-map.js.');
ok(loaderFiles.includes('highscore.js'), 'Highscore-motorn måste laddas av app.js.');
ok(loaderFiles.indexOf('highscore.js') < loaderFiles.indexOf('supabase-highscore.js'), 'Lokal highscore måste laddas före Supabase-adaptern.');
ok(loaderFiles.indexOf('supabase-highscore.js') < loaderFiles.indexOf('app-search.js'), 'Supabase-adaptern måste laddas före app-search.js.');
ok(loaderFiles.indexOf('app-highscore-ui.js') > loaderFiles.indexOf('app-ui.js'), 'Highscore-UI måste laddas efter grundläggande app-ui.js.');

const imports = [...css.matchAll(/@import\s+url\(["']\.\/([^"']+)["']\)/g)].map(match => match[1].split('?')[0]);
for (const file of imports) ok(fileExists(file), `styles.css importerar en fil som saknas: ${file}`);
ok(imports.includes('styles-highscore.css'), 'Highscore-stilar måste importeras från styles.css.');

let manifest;
try { manifest = JSON.parse(read('manifest.webmanifest')); }
catch { failures.push('manifest.webmanifest är inte giltig JSON.'); }
if (manifest) {
  ok(manifest.name === 'Orten 2.0', 'Manifestnamnet måste vara Orten 2.0.');
  ok(manifest.display === 'standalone', 'PWA-display måste vara standalone.');
  ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'Manifestet saknar appikon.');
  for (const icon of manifest.icons || []) ok(fileExists(icon.src), `Manifestikon saknas: ${icon.src}`);
}

const tileUrls = [...mapThemes.matchAll(/https:\/\/[^'"\s]+/g)]
  .map(match => match[0])
  .filter(url => url.includes('basemaps.cartocdn.com'));
ok(tileUrls.length >= 3, 'Alla tre kartteman måste ha verifierbara tile-URL:er.');
for (const url of tileUrls) ok(url.includes('_nolabels'), `Karttema får inte visa ortnamn: ${url}`);

ok(/serviceWorker\.register/.test(app), 'Service Worker måste registreras från app.js.');
ok(/world-places\.json/.test(sw), 'Service Worker måste uttryckligen hantera world-places.json.');
ok(/NETWORK_ONLY/i.test(sw), 'Det stora ortregistret måste vara network-only för att undvika gammal världsdata i cache.');
ok(sw.includes("'./duel-routes.js'"), 'Service Worker måste cacha duellmotorn.');
ok(sw.includes("'./highscore.js'"), 'Service Worker måste cacha highscore.js.');
ok(sw.includes("'./supabase-highscore.js'"), 'Service Worker måste cacha Supabase-adaptern.');
ok(sw.includes("'./app-highscore-ui.js'"), 'Service Worker måste cacha highscore-UI.');
ok(sw.includes("'./styles-highscore.css'"), 'Service Worker måste cacha highscore-stilar.');

ok(/ensureDuelModeControls/.test(core) && /dataset\.mode='duel'/.test(core), 'Duell måste finnas som ett tydligt spelläge på startsidan.');
ok(/settings\.mode==='duel'\) settings\.playerCount=2/.test(core), 'Duell måste låsa spelarantalet till exakt två.');
ok(/duel:'Duell'/.test(core) && /duel:'⚔️'/.test(core), 'Duell måste ha namn och ikon i UI.');
ok(/settings\.mode==='duel'&&previous!=='duel'/.test(setup) && /settings\.strikeLimit=1/.test(setup), 'Duell ska som standard avgöras vid första egna korsningen.');
ok(/candidateCrossings/.test(duel) && /indexedPlayerRoute/.test(duel) && /segments/.test(duel), 'Duellmotorn måste hålla spelarnas rutter separata.');
ok(/DUEL\.candidateCrossings/.test(map), 'Kartan måste kontrollera korsning mot den aktiva spelarens egen linje i Duell.');
ok(/game\.settings\?\.mode==='duel'\?game\.route\.filter/.test(map), 'Dubblettkontrollen i Duell måste gälla den egna rutten.');
ok(/kind:'duel'/.test(search) && /korsade sin egen linje/.test(search), 'Duell måste avslutas med en tydlig vinnare när den egna linjen korsas.');
ok(/motståndarens linje får korsas/.test(ui), 'Duell-UI måste förklara att motståndarens linje får korsas.');

ok(/settings\.mode!=='solo'/.test(highscore), 'Highscore-motorn måste blockera icke-Solo-resultat.');
ok(/STORAGE_LIMIT=100/.test(highscore), 'Highscore-motorn måste behålla personbästan utanför synlig topp 10.');
ok(/highscoreButton/.test(highscoreUI) && /resultHighscoreButton/.test(highscoreUI), 'Highscore måste gå att öppna både före och efter Solo-spel.');
ok(/GLOBAL TOPP 10/.test(highscoreUI) && /LOKAL TOPP 10/.test(highscoreUI), 'Highscore-UI måste ha global lista med lokal fallback.');
ok(/highscoreMine/.test(highscoreUI) && /highscoreLocalBoard/.test(highscoreUI), 'Spelarens lokala rekord måste alltid vara synligt även när global lista är tom.');
ok(/highscoreRetry/.test(highscoreUI) && /GLOBAL\.record/.test(highscoreUI), 'Highscore-vyn måste kunna återförsöka en misslyckad Solo-synkning.');
ok(/friendlyError/.test(highscoreUI), 'Highscore-vyn måste ge begriplig synkdiagnostik.');
ok(/const remote=await GLOBAL\.list\(board\)/.test(highscoreUI), 'Att öppna highscore-vyn får bara läsa den globala listan, aldrig automatiskt skriva ett resultat.');
ok(/isFinishedSoloGame/.test(highscoreUI) && /source:'solo-result'/.test(highscoreUI), 'Manuell highscore-synkning måste kräva ett faktiskt avslutat Solo-spel.');
ok(/resultHighscoreButton/.test(search) && /kind!=='solo'/.test(search), 'Resultatknappen för highscore måste döljas i Duell och andra icke-Solo-lägen.');

ok(globalHighscore.includes("TABLE='orten_highscores'"), 'Supabase-adaptern måste använda den avsedda highscore-tabellen.');
ok(globalHighscore.includes('signInAnonymously'), 'Global highscore måste skapa anonym spelaridentitet före skrivning.');
ok(globalHighscore.includes("onConflict:'user_id,board_key'"), 'Global highscore måste upserta på användare + topplista.');
ok(globalHighscore.includes('@supabase/supabase-js@2.111.0'), 'Supabase SDK måste vara versionslåst.');
ok(/PUBLISHABLE_KEY='sb_publishable_/.test(globalHighscore), 'Klienten måste använda en publishable Supabase-nyckel.');
ok(!/sb_secret_|service_role/i.test(globalHighscore), 'Hemlig Supabase-nyckel får aldrig finnas i klientkoden.');
ok(/isEligibleSubmission/.test(globalHighscore) && /source==='solo-result'/.test(globalHighscore), 'Supabase-skrivning måste kräva uttrycklig Solo-resultatkälla.');
ok(/OrtenGlobalHighscore/.test(search) && /GLOBAL_SCORE\.record/.test(search) && /source:'solo-result'/.test(search), 'Endast avslutade Solo-resultat får skickas till global highscore.');
ok(/GLOBAL SYNK MISSLYCKADES/.test(search), 'Global highscore måste falla tillbaka utan att förlora lokalt rekord.');

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

console.log(`Quality gate OK: ${requiredFiles.length} kritiska filer, ${expectedIds.length} DOM-kontrakt, ${loaderFiles.length} klientmoduler, Duell med separata linjer, Solo-only highscore, PWA, kartteman och säkerhetsregler verifierade.`);
