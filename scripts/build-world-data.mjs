import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('data/world-places.json', ROOT);
const PRIMARY = 'https://download.geonames.org/export/dump';
const CITIES_URL = `${PRIMARY}/cities500.zip`;
const ADMIN1_URL = `${PRIMARY}/admin1CodesASCII.txt`;
const MIRROR_CITIES_URL = 'https://raw.githubusercontent.com/malikdunston/cities-database/master/src/dbs/cities500.txt';
const ACCEPTED = new Set(['PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLA5','PPLC','PPLG','PPLL','PPLR','PPLS','PPLX']);
const MIN_PLACES = 150_000;
const MIN_COUNTRIES = 200;

const clean = value => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
const norm = value => clean(value).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, { timeout = 180_000, attempts = 4 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
        headers: { 'User-Agent': 'Orten-2.0-build/2.1' }
      });
      if (!response.ok) throw new Error(`${url} svarade ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delay = Math.min(10_000, 1200 * (2 ** (attempt - 1)));
      console.warn(`Hämtning misslyckades (${attempt}/${attempts}): ${url}`);
      await sleep(delay);
    }
  }
  throw lastError || new Error(`Kunde inte hämta ${url}`);
}

async function fetchText(url, options) {
  const response = await fetchWithRetry(url, options);
  return response.text();
}

function parseAdmin1(text) {
  const out = new Map();
  for (const line of String(text || '').split('\n')) {
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
    seen.add(key);
    aliases.push(key);
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

async function loadCitiesSource(work) {
  try {
    console.log('Hämtar aktuell GeoNames cities500…');
    const response = await fetchWithRetry(CITIES_URL, { timeout: 180_000, attempts: 4 });
    const zipPath = join(work, 'cities500.zip');
    writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', work], { stdio: 'inherit' });
    return { text: readFileSync(join(work, 'cities500.txt'), 'utf8'), source: 'GeoNames cities500' };
  } catch (error) {
    console.warn(`GeoNames kunde inte hämtas: ${error?.message || error}`);
    console.log('Hämtar full cities500-spegel från GitHub i stället…');
    const text = await fetchText(MIRROR_CITIES_URL, { timeout: 180_000, attempts: 4 });
    return { text, source: 'GeoNames cities500 (GitHub mirror)' };
  }
}

const work = mkdtempSync(join(tmpdir(), 'orten2-world-'));
try {
  const [{ text: source, source: sourceLabel }, adminText] = await Promise.all([
    loadCitiesSource(work),
    fetchText(ADMIN1_URL, { timeout: 90_000, attempts: 3 }).catch(error => {
      console.warn(`Adminområden kunde inte hämtas; orterna byggs ändå: ${error?.message || error}`);
      return '';
    })
  ]);

  const admin1 = parseAdmin1(adminText);
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

  if (rows.length < MIN_PLACES) throw new Error(`Ortbygget gav bara ${rows.length} orter; minst ${MIN_PLACES} krävs.`);
  if (countries.size < MIN_COUNTRIES) throw new Error(`Ortbygget gav bara ${countries.size} land/territorier; minst ${MIN_COUNTRIES} krävs.`);

  rows.sort((a,b) => a[9].localeCompare(b[9]) || b[7] - a[7] || a[0] - b[0]);
  mkdirSync(new URL('data/', ROOT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(rows), 'utf8');
  writeFileSync(new URL('data/world-meta.json', ROOT), JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: sourceLabel,
    count: rows.length,
    countries: Object.fromEntries([...countries.entries()].sort())
  }), 'utf8');
  console.log(`Klart: ${rows.length.toLocaleString('en-US')} spelbara orter i ${countries.size} land/territorier från ${sourceLabel}.`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
