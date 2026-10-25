// Street-following route geometry (OSRM at routing.openstreetmap.de) and subway legs.
import { miles, travel } from './crawl.js';

const OSRM = { walk: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot', ride: 'https://routing.openstreetmap.de/routed-car/route/v1/driving' };
const cache = new Map();
const STORE = 'nycCfbBarCrawler.routes';

// The public server is shared and rate-limited: one request at a time, a short gap between them,
// and results remembered across visits so a reload costs nothing.
let queue = Promise.resolve();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function scheduled(task) {
  const run = queue.then(task);
  queue = run.catch(() => {}).then(() => sleep(150));
  return run;
}
function stored() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
function remember(key, coords) {
  try {
    const all = stored();
    all[key] = coords;
    const keys = Object.keys(all);
    for (const old of keys.slice(0, Math.max(0, keys.length - 150))) delete all[old]; // keep the newest 150
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {}
}

// Circuit breaker: once the server fails (after a retry), skip it for a minute and use the fallback,
// so a route with many legs doesn't queue behind requests that are going to time out.
let downUntil = 0;
const TIMEOUT_MS = 4000, COOL_OFF_MS = 60000;

async function request(profile, points) {
  if (Date.now() < downUntil) throw new Error('routing unavailable');
  const url = `${OSRM[profile]}/${points.map(p => p.join(',')).join(';')}?overview=full&geometries=geojson&steps=false`;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) throw new Error(response.status);
      return (await response.json()).routes[0].geometry.coordinates;
    } catch (error) {
      if (attempt >= 1 || Date.now() < downUntil) { downUntil = Date.now() + COOL_OFF_MS; throw error; }
      await sleep(900);
    }
  }
}

async function osrm(profile, points) {
  const key = `${profile}:${points.map(p => p.map(n => n.toFixed(5)).join(',')).join(';')}`;
  if (!cache.has(key)) {
    const saved = stored()[key];
    cache.set(key, saved ? Promise.resolve(saved) : scheduled(() => request(profile, points))
      .then(coords => { remember(key, coords); return coords; })
      .catch(error => { cache.delete(key); throw error; }));
  }
  return cache.get(key);
}

// When routing is unavailable: Manhattan's street grid runs about 29 degrees east of true north
// between Houston St and 110th. Inside it, walk your street to a real avenue, along the avenue to the
// destination's street, then along that street. Elsewhere, a straight line.
const GRID_DEGREES = 29;
const K = Math.cos(40.75 * Math.PI / 180); // longitude scale at midtown, fixed so grid coordinates line up
const T = GRID_DEGREES * Math.PI / 180;
const toGrid = ([lng, lat]) => { const x = lng * K; return [x * Math.cos(T) - lat * Math.sin(T), x * Math.sin(T) + lat * Math.cos(T)]; };
const fromGrid = ([u, v]) => [(u * Math.cos(T) + v * Math.sin(T)) / K, -u * Math.sin(T) + v * Math.cos(T)];
// Where each avenue crosses 42nd St (west to east); an avenue is a line of constant u in grid coordinates.
const AVENUES = [
  [-74.0033, 40.7632], [-73.9999, 40.7616], [-73.9962, 40.7600], [-73.9929, 40.7586], // 12th, 11th, 10th, 9th
  [-73.9897, 40.7577], [-73.9868, 40.7563], [-73.9840, 40.7549], [-73.9806, 40.7532], // 8th, 7th, 6th, 5th
  [-73.9793, 40.7524], [-73.9776, 40.7516], [-73.9759, 40.7509], [-73.9744, 40.7502], // Madison, Park, Lexington, 3rd
  [-73.9716, 40.7489], [-73.9690, 40.7478], // 2nd, 1st
].map(p => toGrid(p)[0]);
// The grid proper: Houston to 110th, minus the West Village's older streets.
const inGrid = ([lng, lat]) => lat > 40.726 && lat < 40.800 && lng > -74.015 && lng < -73.93 && !(lat < 40.740 && lng < -73.997);

export function gridPath(a, b) {
  if (!inGrid(a) || !inGrid(b)) return [a, b];
  const [ua, va] = toGrid(a), [ub, vb] = toGrid(b);
  // Any avenue between the two costs the same distance; take the one nearest A. If none lies
  // between them, take the one that adds the least detour.
  const [lo, hi] = ua < ub ? [ua, ub] : [ub, ua];
  const between = AVENUES.filter(u => u >= lo && u <= hi).sort((x, y) => Math.abs(x - ua) - Math.abs(y - ua));
  const avenue = between[0] ?? AVENUES.reduce((best, u) => (Math.abs(ua - u) + Math.abs(ub - u) < Math.abs(ua - best) + Math.abs(ub - best) ? u : best));
  return [a, fromGrid([avenue, va]), fromGrid([avenue, vb]), b];
}

/**
 * Best station pair for a subway hop: short walks at both ends, strongly preferring a pair on a
 * shared line (a one-seat ride). Pure; exported for tests.
 */
export function stationPair(from, to, stations) {
  const near = point => stations.map(s => ({ s, d: miles(point, [s.lng, s.lat]) })).sort((a, b) => a.d - b.d).slice(0, 5);
  let best = null;
  for (const a of near(from)) for (const b of near(to)) {
    if (a.s === b.s) continue;
    const shared = a.s.lines.filter(l => b.s.lines.includes(l));
    const score = a.d + b.d + (shared.length ? 0 : 0.6);
    if (!best || score < best.score) best = { from: a.s, to: b.s, lines: shared.length ? shared : a.s.lines, transfer: !shared.length, score };
  }
  return best;
}

/**
 * The stretch of a subway service's track between two stations, as a coordinate list.
 * Picks the line part that passes closest to both, then slices between their nearest vertices.
 * Falls back to a straight segment if the service isn't in the data or runs too far from either station.
 */
export function trackBetween(subway, service, a, b) {
  const feature = subway?.lines.features.find(f => f.properties.service === service);
  if (!feature) return [a, b];
  let best = null;
  for (const part of feature.geometry.coordinates) {
    const nearest = p => part.reduce((acc, c, i) => { const d = miles(p, c); return d < acc.d ? { d, i } : acc; }, { d: Infinity, i: 0 });
    const na = nearest(a), nb = nearest(b);
    if (!best || na.d + nb.d < best.d) best = { d: na.d + nb.d, part, i: na.i, j: nb.i };
  }
  if (!best || best.d > 0.5) return [a, b];
  const [lo, hi] = best.i <= best.j ? [best.i, best.j] : [best.j, best.i];
  const stretch = best.part.slice(lo, hi + 1);
  if (best.i > best.j) stretch.reverse();
  return [a, ...stretch, b];
}

/**
 * Geometry for the whole route. points = [home, stop1, stop2, …] as [lng, lat].
 * Returns { walk: [coords…], rides: [{ coords, color }] }; falls back to straight lines if routing fails.
 */
export async function routeGeometry(points, mode, subway, lineColor) {
  if (points.length < 2) return { walk: [], rides: [] };
  const straight = gridPath;
  if (mode === 'walk' || mode === 'ride') {
    try { return { walk: [await osrm(mode, points)], rides: [] }; }
    catch { return { walk: points.slice(1).map((to, i) => gridPath(points[i], to)), rides: [] }; }
  }
  // Train: walk short legs; for long ones walk to a station, ride, and walk from the far station.
  const walk = [], rides = [];
  await Promise.all(points.slice(1).map(async (to, i) => {
    const from = points[i];
    const leg = travel(miles(from, to), 'train');
    const walkLeg = async (a, b) => { try { walk.push(await osrm('walk', [a, b])); } catch { walk.push(straight(a, b)); } };
    if (leg.mode !== 'train' || !subway) return walkLeg(from, to);
    const pair = stationPair(from, to, subway.stations);
    const a = [pair.from.lng, pair.from.lat], b = [pair.to.lng, pair.to.lat];
    rides.push({ coords: trackBetween(subway, pair.lines[0], a, b), color: lineColor(pair.lines[0]), lines: pair.lines, stations: [pair.from, pair.to] });
    await Promise.all([walkLeg(from, a), walkLeg(b, to)]);
  }));
  return { walk, rides };
}
