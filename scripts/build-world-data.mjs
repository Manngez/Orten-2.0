import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('data/world-places.json', ROOT);
const SOURCE = 'https://download.geonames.org/export/dump';
const CITIES_URL = `${SOURCE}/cities500.zip`;
const ADMIN1_URL = `${SOURCE}/admin1CodesASCII.txt`;
const ACCEPTED = new Set(['PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLA5','PPLC','PPLG','PPLL','PPLR','PPLS','PPLX']);
const MIN_PLACES = 150_000;
const MIN_COUNTRIES = 200;

const clean = value => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
const norm = value => clean(value).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, { timeout = 180_000, attempts = 5 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
        headers: { 'User-Agent': 'Orten-2.0-build/2.0' }
      });
      if (!response.ok) throw new Error(`${url} svarade ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delay = Math.min(12_000, 1500 * (2 ** (attempt - 1)));
      console.warn(`GeoNames-hämtning misslyckades (${attempt}/${attempts}). Försöker igen om ${Math.round(delay/1000)} s…`, error?.message || error);
      await sleep(delay);
    }
  }
  throw lastError || new Error(`Kunde inte hämta ${url}`);
}

async function fetchBytes(url) {
  const response = await fetchWithRetry(url, { timeout: 180_000, attempts: 5 });
  return Buffer.from(await response.arrayBuffer());
}
async function fetchText(url) {
  const response = await fetchWithRetry(url, { timeout: 90_000, attempts: 5 });
  return response.text();
}

function parseAdmin1(text) {
  const out = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [code, name] = line.split('\t');
    if (code && name) out.set(code, clean(name));
  }
  return out;
}

function aliasesFor(columns, population, featureCode) {
  const name = clean(columns[1]);
  const ascii = clean(columns[2]);
  const seen = new Set([norm(name)]);
  const aliases = [];
  const add = value => {
    value = clean(value);
    if (!value || value.length < 2 || value.length > 80 || /^[-+]?\d+(?:[.,]\d+)?$/.test(value) || /https?:\/\//i.test(value)) return;
    const key = norm(value);
    if (!key || seen.has(key)) return;
    seen.add(key); aliases.push(key);
  };
  add(ascii);
  if (population >= 15_000 || /^PPLA/.test(featureCode) || featureCode === 'PPLC') {
    for (const value of String(columns[3] || '').split(',')) {
      add(value);
      if (aliases.length >= 7) break;
    }
  }
  return aliases;
}

const work = mkdtempSync(join(tmpdir(), 'orten2-world-'));
try {
  console.log('Hämtar full GeoNames cities500-databas…');
  const [zipBytes, adminText] = await Promise.all([fetchBytes(CITIES_URL), fetchText(ADMIN1_URL)]);
  const zipPath = join(work, 'cities500.zip');
  writeFileSync(zipPath, zipBytes);
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', work], { stdio: 'inherit' });

  const admin1 = parseAdmin1(adminText);
  const source = readFileSync(join(work, 'cities500.txt'), 'utf8');
  const rows = [];
  const countries = new Map();

  for (const line of source.split('\n')) {
    if (!line) continue;
    const c = line.split('\t');
    if (c.length < 15 || c[6] !== 'P' || !ACCEPTED.has(c[7])) continue;
    const id = Number(c[0]);
    const name = clean(c[1]);
    const lat = Number(c[4]);
    const lon = Number(c[5]);
    const cc = clean(c[8]).toUpperCase();
    const adminCode = clean(c[10]);
    const region = admin1.get(`${cc}.${adminCode}`) || '';
    const population = Math.max(0, Number(c[14]) || 0);
    const featureCode = clean(c[7]);
    if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon) || !/^[A-Z]{2}$/.test(cc)) continue;

    const canonical = norm(name);
    if (!canonical) continue;
    const aliases = aliasesFor(c, population, featureCode);
    const aliasText = aliases.length ? `\u0001${aliases.join('\u0001')}\u0001` : '';
    rows.push([id, name, Number(lat.toFixed(5)), Number(lon.toFixed(5)), cc, adminCode, region, population, featureCode, canonical, aliasText]);
    countries.set(cc, (countries.get(cc) || 0) + 1);
  }

  if (rows.length < MIN_PLACES) throw new Error(`GeoNames-bygget gav bara ${rows.length} orter; minst ${MIN_PLACES} krävs.`);
  if (countries.size < MIN_COUNTRIES) throw new Error(`GeoNames-bygget gav bara ${countries.size} land/territorier; minst ${MIN_COUNTRIES} krävs.`);

  rows.sort((a,b) => a[9].localeCompare(b[9]) || b[7] - a[7] || a[0] - b[0]);
  mkdirSync(new URL('data/', ROOT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(rows), 'utf8');
  writeFileSync(new URL('data/world-meta.json', ROOT), JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'GeoNames cities500',
    count: rows.length,
    countries: Object.fromEntries([...countries.entries()].sort())
  }), 'utf8');
  console.log(`Klart: ${rows.length.toLocaleString('en-US')} spelbara orter i ${countries.size} land/territorier.`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
