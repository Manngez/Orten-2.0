import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const dataPath = new URL('../data/world-places.json', import.meta.url);
const manifestPath = new URL('../data/world-manifest.json', import.meta.url);
const raw = readFileSync(dataPath, 'utf8');
const rows = JSON.parse(raw);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const ids = new Set();
const countries = new Set();
const wanted = new Set(['stockholm','umea','new york city','tokyo','sydney']);
const found = new Set();
const norm = value => String(value ?? '').trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const bytes = Buffer.byteLength(raw, 'utf8');
const sha256 = createHash('sha256').update(raw, 'utf8').digest('hex');

if (!manifest || manifest.schemaVersion !== 1) throw new Error(`Ogiltig datasetversion: ${manifest?.schemaVersion ?? 'saknas'}`);
if (manifest.dataset !== 'geonames-cities500') throw new Error(`Fel dataset: ${manifest.dataset || 'saknas'}`);
if (!Array.isArray(rows) || rows.length < 150_000) throw new Error(`För få orter: ${rows?.length ?? 'ogiltig fil'}`);
if (manifest.count !== rows.length) throw new Error(`Manifestets antal (${manifest.count}) matchar inte ortfilen (${rows.length})`);
if (manifest.bytes !== bytes) throw new Error(`Manifestets filstorlek (${manifest.bytes}) matchar inte ortfilen (${bytes})`);
if (!/^[a-f0-9]{64}$/.test(manifest.sha256 || '') || manifest.sha256 !== sha256) throw new Error('SHA-256 för world-places.json matchar inte manifestet');
if (!manifest.version || !String(manifest.version).endsWith(sha256.slice(0,12))) throw new Error('Datasetversionen matchar inte filens checksumma');

for (const row of rows) {
  if (!Array.isArray(row) || row.length < 11) throw new Error('Ogiltigt radformat i world-places.json');
  const [id,name,lat,lon,cc] = row;
  if (!Number.isInteger(id) || ids.has(id)) throw new Error(`Ogiltigt eller duplicerat GeoNames-id: ${id}`);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error(`Ogiltig ort: ${name || id}`);
  if (!/^[A-Z]{2}$/.test(cc)) throw new Error(`Ogiltig landskod för ${name}: ${cc}`);
  ids.add(id); countries.add(cc);
  const n=norm(name); if(wanted.has(n)) found.add(n);
}
if (countries.size < 200) throw new Error(`För få land/territorier i världsdatan: ${countries.size}`);
if (manifest.countryCount !== countries.size) throw new Error(`Manifestets landantal (${manifest.countryCount}) matchar inte ortfilen (${countries.size})`);
const missing=[...wanted].filter(x=>!found.has(x));
if (missing.length) throw new Error(`Saknar kontrollorter: ${missing.join(', ')}`);
console.log(`Validering OK: ${rows.length.toLocaleString('en-US')} orter, ${countries.size} land/territorier, dataset ${manifest.version}, SHA-256 ${sha256.slice(0,12)}…`);
