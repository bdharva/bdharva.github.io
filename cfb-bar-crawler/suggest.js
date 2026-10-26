// Auto-suggest a full day: which halves of which games to watch at which bars, noon through the late
// West Coast window. Pure logic, tested in tests/suggest.test.mjs.
//
// Each game becomes two "half" segments (kickoff → halftime, end of halftime → final) at every bar
// showing it. A dynamic program over segments sorted by start time finds the highest-value path:
//   value of a segment = matchup quality × (1.15 for a second half) × bar fit × (share of the half you catch)
//   minus travel (about 0.012 per minute moving) and a small cost per bar change.
// You can't be in two places at once: the next segment must begin by the time you could arrive, give or
// take joining up to 25 minutes late.
import { miles, travel, barsForGame, dayKey, HALFTIME_AT, HALFTIME_BREAK, GAME_HOURS } from './crawl.js';

const MIN = 60000;
const LATE_OK = 25;           // minutes you can arrive into a half and still count it
const PER_MINUTE = 0.012;     // travel cost per minute moving
const SWITCH = 0.08;          // cost of changing bars, on top of travel
const HOME_WEIGHT = 0.5;      // the first trip out is cheaper: you'd have to leave home anyway
const CONTINUE = 0.75;        // the 2nd half of a game you just watched is worth less than a fresh one...
                              // ...unless it's your team or your pick: then you want the whole thing
const LOCKED = 50;            // a choice you pinned always makes the plan if it's feasible
const WINDOW = 25 * MIN;      // alternatives start within this much of the half they'd replace
export const segmentKey = s => `${s.game.id}:${s.half}:${s.bar.id}`;
const ROLE_FIT = { official: 1, secondary: 0.95, fan: 0.9 };
const FAVORITE_BAR = 1.25;    // a bar you saved is worth a bit more for any game it shows
const SWITCH_SIDES = 1.15;    // 2nd half at the other team's bar after the 1st at this one's: the best way to see a game
                              // you're neutral on, when the hop fits inside halftime

/** How much is this game worth watching? Rankings, a close line, and your teams and picks. */
// priority 'teams' makes your teams and ticked games dominate; 'matchups' only nudges toward them.
export function matchupScore(game, { favorites = new Set(), picked = new Set(), priority = 'teams' } = {}) {
  const boost = priority === 'teams' ? 1 : 0.15;
  let q = 0.25;
  for (const side of [game.home, game.away]) {
    if (side.rank) q += 0.2 + 0.4 * (26 - side.rank) / 25;
    if (favorites.has(side.id)) q += 2.5 * boost;
  }
  if (game.home.rank && game.away.rank) q += 0.3;
  if (game.spread != null) q += 0.4 * Math.max(0, 1 - game.spread / 17);
  if (game.confGame) q += 0.05;
  if (picked.has(game.id)) q += 1.5 * boost;
  return q;
}

/** Why the planner liked a game, in a few words. */
export function reasons(game, { favorites = new Set(), picked = new Set() } = {}) {
  const out = [];
  const mine = [game.home, game.away].filter(s => favorites.has(s.id));
  if (mine.length) out.push('your team');
  else if (picked.has(game.id)) out.push('your pick');
  if (game.home.rank && game.away.rank) out.push('ranked vs ranked');
  else if (game.home.rank || game.away.rank) out.push(`#${game.home.rank || game.away.rank}`);
  if (game.spread != null && game.spread <= 7) out.push(game.line || `${game.spread}-pt line`);
  return out;
}

function segmentsFor(game, barsByTeam, context) {
  const kickoff = +new Date(game.date);
  const quality = matchupScore(game, context);
  // Whole games when you'd rather stay put; otherwise each half stands alone.
  const halves = context.halves === 'full'
    ? [{ half: 0, start: kickoff, end: kickoff + GAME_HOURS * 60 * MIN, weight: 2.15 }]
    : [
      { half: 1, start: kickoff, end: kickoff + HALFTIME_AT * MIN, weight: 1 },
      { half: 2, start: kickoff + (HALFTIME_AT + HALFTIME_BREAK) * MIN, end: kickoff + GAME_HOURS * 60 * MIN, weight: 1.15 },
    ];
  const out = [];
  for (const { bar, teams } of barsForGame(game, barsByTeam)) {
    const role = Math.max(...teams.map(t => ROLE_FIT[bar.roles?.[t]] ?? 0.9));
    // An opponent-only bar is a poor fit when you're there for your team.
    const yours = context.favorites?.size && [game.home.id, game.away.id].some(t => context.favorites.has(t));
    const fit = yours && !teams.some(t => context.favorites.has(t)) ? 0.6 * role : role;
    const liked = context.favoriteBars?.has(bar.id) ? FAVORITE_BAR : 1;
    // `sides`: what the 2nd half here is worth after the 1st half at the other team's bar. No opponent-bar
    // discount, since crossing over is the point.
    for (const h of halves) out.push({ game, bar, teams, ...h, value: quality * h.weight * fit * liked, sides: quality * h.weight * role * liked * SWITCH_SIDES });
  }
  return out;
}

/** 1st half at one team's bar, 2nd half at the other team's: same game, no team in common. */
export const switchesSides = (first, second) => first.game.id === second.game.id && first.half === 1 && second.half === 2
  && first.bar.id !== second.bar.id && !second.teams.some(t => first.teams.includes(t));

const minutesBetween = (a, b) => (a.id === b.id ? 0 : travel(miles([a.lng, a.lat], [b.lng, b.lat])).minutes);

/**
 * games: the week's games; day: a dayKey (YYYY-MM-DD, New York) or null for the busiest day.
 * Returns { day, path: [{ game, half, bar, start, end, arrive, lateMinutes, travelMinutes }], score }.
 */
export function suggestDay({ games, barsByTeam, home, favorites = new Set(), favoriteBars = new Set(), picked = new Set(), priority = 'teams', halves = 'split', locks = [], day = null, from = 11, until = 24 }) {
  const timed = games.filter(g => g.timeValid && g.home.id > 0 && g.away.id > 0);
  if (!day) {
    const counts = new Map();
    for (const g of timed) counts.set(dayKey(new Date(g.date)), (counts.get(dayKey(new Date(g.date))) || 0) + 1);
    day = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  const hourNY = date => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(date));
  const todays = timed.filter(g => dayKey(new Date(g.date)) === day && hourNY(new Date(g.date)) >= from && hourNY(new Date(g.date)) < until);
  const context = { favorites, favoriteBars, picked, priority, halves };
  const segs = todays.flatMap(g => segmentsFor(g, barsByTeam, context)).sort((a, b) => a.start - b.start || b.value - a.value);
  if (!segs.length) return { day, path: [], score: 0 };
  const locked = new Set(locks);
  const bonus = s => (locked.has(segmentKey(s)) ? LOCKED : 0);
  const mustSee = g => [g.home.id, g.away.id].some(t => favorites.has(t)) || picked.has(g.id);
  // What a segment is worth right after another one (or after home, when p is null).
  // Switching sides at the half (1st half at one team's bar, 2nd at the other's) beats staying put, for a
  // game that isn't your team's and a walk short enough to miss nothing. Your team's game stays with your crowd.
  const crossOver = (p, s) => switchesSides(p, s) && !mustSee(s.game) && minutesBetween(p.bar, s.bar) <= HALFTIME_BREAK;
  const worth = (s, p) => {
    if (!p || s.half !== 2 || p.half !== 1 || p.game.id !== s.game.id) return s.value;
    if (crossOver(p, s)) return s.sides;
    return (mustSee(s.game) ? 1 : CONTINUE) * s.value;
  };

  const homePoint = { id: '__home', lng: home[0], lat: home[1] };
  const best = new Array(segs.length), parent = new Array(segs.length), arrival = new Array(segs.length);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const fromHome = minutesBetween(homePoint, s.bar);
    best[i] = worth(s, null) + bonus(s) - fromHome * PER_MINUTE * HOME_WEIGHT;
    parent[i] = -1;
    arrival[i] = s.start;
    for (let j = 0; j < i; j++) {
      const p = segs[j];
      if (best[j] === undefined || p.start >= s.start) continue;
      if (p.game.id === s.game.id && p.half === s.half) continue;
      const moving = minutesBetween(p.bar, s.bar);
      const arrive = Math.max(s.start, p.end + moving * MIN);
      const late = (arrive - s.start) / MIN;
      if (late > LATE_OK) continue;
      const share = 1 - late / ((s.end - s.start) / MIN); // fraction of the segment you actually see
      const total = best[j] + worth(s, p) * share + bonus(s) - moving * PER_MINUTE - (p.bar.id === s.bar.id ? 0 : SWITCH);
      if (total > best[i]) { best[i] = total; parent[i] = j; arrival[i] = arrive; }
    }
  }
  let end = 0;
  for (let i = 1; i < segs.length; i++) if (best[i] > best[end]) end = i;
  const path = [];
  for (let i = end; i !== -1; i = parent[i]) path.unshift({ ...segs[i], arrive: arrival[i], i });
  let here = homePoint;
  const inPath = new Set(path.map(segmentKey));
  path.forEach((step, k) => {
    step.travelMinutes = minutesBetween(here, step.bar);
    step.lateMinutes = Math.max(0, Math.round((step.arrive - step.start) / MIN));
    step.locked = locked.has(segmentKey(step));
    // Next-best swaps for this half: same time window, judged from where you'd be coming from.
    const prev = path[k - 1] || null, from = prev ? prev.bar : homePoint;
    const scored = segs
      .filter(c => Math.abs(c.start - step.start) <= WINDOW && !inPath.has(segmentKey(c)))
      .map(c => ({ ...c, score: worth(c, prev) - minutesBetween(from, c.bar) * PER_MINUTE - (from.id === c.bar.id ? 0 : SWITCH),
        distance: miles([from.lng, from.lat], [c.bar.lng, c.bar.lat]) }))
      .sort((a, b) => b.score - a.score);
    // Prefer different games; fall back to the same game at another bar.
    const seen = new Set([`${step.game.id}:${step.half}`]);
    step.alternatives = [];
    for (const c of [...scored.filter(c => c.game.id !== step.game.id), ...scored.filter(c => c.game.id === step.game.id)]) {
      const id = `${c.game.id}:${c.half}`;
      if (seen.has(id)) continue;
      seen.add(id);
      step.alternatives.push(c);
      if (step.alternatives.length === 2) break;
    }
    here = step.bar;
  });
  return { day, path, score: best[end] };
}

/** Collapse consecutive segments at the same bar into visits, for display. */
export function visits(path, home) {
  const out = [];
  let here = home;
  for (const seg of path) {
    const last = out.at(-1);
    if (last && last.bar.id === seg.bar.id) {
      last.end = seg.end;
      last.segments.push(seg);
      continue;
    }
    out.push({ bar: seg.bar, start: seg.arrive, end: seg.end, segments: [seg], leg: travel(miles(here, [seg.bar.lng, seg.bar.lat])), lateMinutes: seg.lateMinutes });
    here = [seg.bar.lng, seg.bar.lat];
  }
  // One line per game at each visit: "full game", "1st half" or "2nd half".
  for (const v of out) {
    const byGame = new Map();
    for (const s of v.segments) byGame.set(s.game.id, [...(byGame.get(s.game.id) || []), ...(s.half === 0 ? [1, 2] : [s.half])]);
    v.games = [...byGame].map(([id, halves]) => ({ game: v.segments.find(s => s.game.id === id).game, halves }));
  }
  return out;
}
