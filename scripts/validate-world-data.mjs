import { readFileSync } from 'node:fs';

const path = new URL('../data/world-places.json', import.meta.url);
const rows = JSON.parse(readFileSync(path, 'utf8'));
const ids = new Set();
const countries = new Set();
const wanted = new Set(['stockholm','umea','new york city','tokyo','sydney']);
const found = new Set();
const norm = value => String(value ?? '').trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();

if (!Array.isArray(rows) || rows.length < 150_000) throw new Error(`För få orter: ${rows?.length ?? 'ogiltig fil'}`);
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
const missing=[...wanted].filter(x=>!found.has(x));
if (missing.length) throw new Error(`Saknar kontrollorter: ${missing.join(', ')}`);
console.log(`Validering OK: ${rows.length.toLocaleString('en-US')} orter, ${countries.size} land/territorier, unika GeoNames-id och giltiga koordinater.`);
