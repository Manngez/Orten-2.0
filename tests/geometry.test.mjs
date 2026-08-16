import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const G = require('../game-geometry.js');

const near = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
};

test('unwrapLon keeps dateline travel continuous', () => {
  assert.equal(G.unwrapLon(-179, 179), 181);
  assert.equal(G.unwrapLon(179, -179), -181);
  assert.equal(G.unwrapLon(15, 10), 15);
});

test('segmentParts splits visual routes at the date line', () => {
  const eastbound = G.segmentParts({ lat: 60, lon: 170 }, { lat: 62, lon: -170 });
  assert.equal(eastbound.length, 2);
  assert.equal(eastbound[0][1][1], 180);
  assert.equal(eastbound[1][0][1], -180);

  const normal = G.segmentParts({ lat: 0, lon: 10 }, { lat: 5, lon: 20 });
  assert.equal(normal.length, 1);
});

test('intersectionOf detects a real crossing', () => {
  const hit = G.intersectionOf(
    { lat: 0, ux: 0 },
    { lat: 10, ux: 10 },
    { lat: 10, ux: 0 },
    { lat: 0, ux: 10 }
  );
  assert.ok(hit);
  near(hit.lon, 5, 1e-8);
  assert.ok(hit.lat > 4.9 && hit.lat < 5.1);
});

test('intersectionOf ignores parallel lines', () => {
  const hit = G.intersectionOf(
    { lat: 0, ux: 0 },
    { lat: 0, ux: 10 },
    { lat: 1, ux: 0 },
    { lat: 1, ux: 10 }
  );
  assert.equal(hit, null);
});

test('intersectionOf ignores touching an old segment endpoint', () => {
  const hit = G.intersectionOf(
    { lat: 0, ux: 0 },
    { lat: 10, ux: 10 },
    { lat: 10, ux: 10 },
    { lat: 10, ux: 20 }
  );
  assert.equal(hit, null);
});

test('normalizeLon always returns a display longitude', () => {
  assert.equal(G.normalizeLon(181), -179);
  assert.equal(G.normalizeLon(-181), 179);
  assert.equal(G.normalizeLon(540), 180);
});

test('haversine returns plausible real-world distance', () => {
  const stockholm = { lat: 59.3293, lon: 18.0686 };
  const umea = { lat: 63.8258, lon: 20.2630 };
  const km = G.haversine(stockholm, umea);
  assert.ok(km > 500 && km < 550, `Unexpected Stockholm–Umeå distance: ${km}`);
});
