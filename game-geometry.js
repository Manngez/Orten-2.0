'use strict';

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OrtenGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function unwrapLon(lon, prevUx) {
    let x = lon;
    if (prevUx == null) return x;
    while (x - prevUx > 180) x -= 360;
    while (x - prevUx < -180) x += 360;
    return x;
  }

  function mercY(lat) {
    const r = clamp(lat, -85, 85) * Math.PI / 180;
    return Math.log(Math.tan(Math.PI / 4 + r / 2));
  }

  function normalizeLon(x) {
    const lon = ((x + 180) % 360 + 360) % 360 - 180;
    return lon === -180 ? 180 : lon;
  }

  function segmentParts(a, b) {
    const lon1 = a.lon;
    const lon2 = b.lon;
    const diff = lon2 - lon1;
    if (Math.abs(diff) <= 180) return [[[a.lat, lon1], [b.lat, lon2]]];

    if (lon1 > 0 && lon2 < 0) {
      const adjusted = lon2 + 360;
      const t = (180 - lon1) / (adjusted - lon1);
      const lat = a.lat + (b.lat - a.lat) * t;
      return [[[a.lat, lon1], [lat, 180]], [[lat, -180], [b.lat, lon2]]];
    }

    if (lon1 < 0 && lon2 > 0) {
      const adjusted = lon2 - 360;
      const t = (-180 - lon1) / (adjusted - lon1);
      const lat = a.lat + (b.lat - a.lat) * t;
      return [[[a.lat, lon1], [lat, -180]], [[lat, 180], [b.lat, lon2]]];
    }

    return [[[a.lat, lon1], [b.lat, lon2]]];
  }

  function intersectionOf(a, b, c, d) {
    const A = { x: a.ux, y: mercY(a.lat) };
    const B = { x: b.ux, y: mercY(b.lat) };
    const C = { x: c.ux, y: mercY(c.lat) };
    const D = { x: d.ux, y: mercY(d.lat) };
    const r = { x: B.x - A.x, y: B.y - A.y };
    const s = { x: D.x - C.x, y: D.y - C.y };
    const den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-12) return null;

    const q = { x: C.x - A.x, y: C.y - A.y };
    const t = (q.x * s.y - q.y * s.x) / den;
    const u = (q.x * r.y - q.y * r.x) / den;
    const eps = 1e-8;

    // A new segment may end on an older segment, but touching a segment endpoint
    // must not be counted as a crossing. This mirrors the game rule.
    if (t <= eps || t > 1 + eps || u <= eps || u >= 1 - eps) return null;

    const x = A.x + t * r.x;
    const y = A.y + t * r.y;
    const lat = (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
    return { lat, lon: normalizeLon(x), ux: x, t, u };
  }

  function haversine(a, b) {
    const R = 6371;
    const toR = value => value * Math.PI / 180;
    const dLat = toR(b.lat - a.lat);
    const dLon = toR(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  return Object.freeze({
    unwrapLon,
    mercY,
    normalizeLon,
    segmentParts,
    intersectionOf,
    haversine
  });
});
