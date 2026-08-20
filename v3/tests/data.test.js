import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDatasetManifest} from '../src/data.js';

const sha='a'.repeat(64);
const facts={count:150_000,countryCount:200,bytes:12_345_678,sha256:sha};
const manifest={
  schemaVersion:1,
  dataset:'geonames-cities500',
  version:`2026-08-20-${sha.slice(0,12)}`,
  count:facts.count,
  countryCount:facts.countryCount,
  bytes:facts.bytes,
  sha256:sha
};

test('godkänner ett komplett och matchande datasetmanifest',()=>{
  assert.equal(assertDatasetManifest(manifest,facts),true);
});

test('stoppar ett ofullständigt ortregister',()=>{
  assert.throws(()=>assertDatasetManifest({...manifest,count:149_999},{...facts,count:149_999}),/ofullständigt/);
});

test('stoppar fel checksumma',()=>{
  assert.throws(()=>assertDatasetManifest({...manifest,sha256:'b'.repeat(64)},facts),/SHA-256/);
});

test('stoppar manifest vars antal inte matchar datafilen',()=>{
  assert.throws(()=>assertDatasetManifest({...manifest,count:facts.count+1},facts),/antal matchar inte/);
});

test('stoppar fel schemaversion',()=>{
  assert.throws(()=>assertDatasetManifest({...manifest,schemaVersion:2},facts),/dataversion/);
});
