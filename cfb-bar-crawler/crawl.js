// Pure planning logic: no DOM, no map. Tested in tests/crawl.test.mjs.

export const TZ = 'America/New_York';
const EARTH_MILES = 3958.8;
const SLOT_WINDOW_MIN = 45;      // kickoffs this close together share a slot
export const GAME_HOURS = 3.5;   // a typical broadcast window
export const HALFTIME_AT = 95;   // minutes from kickoff to halftime, roughly, in a college broadcast
export const HALFTIME_BREAK = 20; // college halftime is 20 minutes

export function miles([lng1, lat1], [lng2, lat2]) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lng2 - lng1) * rad / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.sqrt(a));
}

// Manhattan's grid makes straight-line distance optimistic; 1.25 is a common street-network factor.
const DETOUR = 1.25;

// How you get between bars: 'walk' (walk up to ~1.2 mi, else train or cab), 'ride' (cab/Uber past a few
// blocks) or 'train' (subway past ~0.8 mi). Set once per render; planning and labels both read it.
let travelMode = 'walk';
export function setTravelMode(mode) { travelMode = mode; }

export function travel(distance, mode = travelMode) {
  const street = distance * DETOUR;
  const walk = { mode: 'walk', minutes: Math.max(1, Math.round(street * 20)), miles: street };
  if (mode === 'ride') return street <= 0.35 ? walk : { mode: 'ride', minutes: Math.round(6 + street * 5), miles: street };
  if (mode === 'train') return street <= 0.8 ? walk : { mode: 'train', minutes: Math.round(9 + street * 3), miles: street };
  if (street <= 1.2) return walk;
  return { mode: 'transit', minutes: Math.round(12 + street * 4), miles: street };
}

export function describeTravel(t) {
  if (!t) return '';
  const distance = t.miles < 0.1 ? 'next door' : `${t.miles.toFixed(1)} mi`;
  const how = { walk: 'walk', ride: 'by cab', train: 'by train', transit: 'by train or cab' }[t.mode];
  return t.mode === 'walk' ? `${t.minutes} min walk · ${distance}` : `≈${t.minutes} min ${how} · ${distance}`;
}

const formatters = new Map();
function fmt(options) {
  const key = JSON.stringify(options);
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...options }));
  return formatters.get(key);
}
export const clock = date => fmt({ hour: 'numeric', minute: '2-digit' }).format(date).replace(':00', '').replace(' ', ' ');
export const dayName = date => fmt({ weekday: 'long', month: 'short', day: 'numeric' }).format(date);
export const dayKey = date => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

// Group games into kickoff slots. Games without a confirmed time go last, in one TBA slot.
export function slots(games) {
  const timed = games.filter(g => g.timeValid).sort((a, b) => new Date(a.date) - new Date(b.date));
  const out = [];
  for (const game of timed) {
    const kickoff = new Date(game.date);
    const last = out.at(-1);
    if (last && !last.tba && (kickoff - last.kickoff) / 60000 <= SLOT_WINDOW_MIN) last.games.push(game);
    else out.push({ kickoff, tba: false, games: [game] });
  }
  const tba = games.filter(g => !g.timeValid);
  if (tba.length) out.push({ kickoff: new Date(tba[0].date), tba: true, games: tba });
  return out;
}

// Bars for a game: each team's spots, merged when two teams share a bar.
export function barsForGame(game, barsByTeam) {
  const found = new Map();
  for (const side of [game.away, game.home]) {
    for (const bar of barsByTeam.get(side.id) || []) {
      if (!found.has(bar.id)) found.set(bar.id, { bar, teams: [] });
      found.get(bar.id).teams.push(side.id);
    }
  }
  return [...found.values()];
}

const ROLE_WEIGHT = { official: 1, secondary: 1.15, fan: 1.3 };

/**
 * Chart a crawl through the selected games.
 * One stop per kickoff slot. Cost of a bar = distance from your last stop (official club bars get a small edge)
 * + about a mile per selected game it doesn't show + a 1.5-mile handicap if it's only an opponent's bar.
 * `favorites` are the viewer's teams; their bars are strongly preferred over an opponent's.
 * `favoriteBars` (saved bars) get about half a mile of preference.
 * `pins` maps game id -> bar id to override the choice for that game's slot.
 * `splits` maps game id -> second-half bar id (or 'auto' for the best one) to move bars at halftime.
 * After halftime you can watch the same game elsewhere, another game from this window, or any game in
 * `dayGames` (the week's slate) that kicks off or reaches its own halftime around then.
 */
export function planCrawl({ games, barsByTeam, home, pins = {}, splits = {}, favorites = new Set(), favoriteBars = new Set(), dayGames = games }) {
  const plan = [];
  const claimed = new Set();
  let here = home;
  for (const whole of slots(games)) {
    const slot = { ...whole, games: whole.games.filter(g => !claimed.has(g.id)) };
    if (!slot.games.length) continue;
    const options = new Map();
    for (const game of slot.games) {
      for (const { bar, teams } of barsForGame(game, barsByTeam)) {
        if (!options.has(bar.id)) options.set(bar.id, { bar, games: [], teams: new Set() });
        const option = options.get(bar.id);
        option.games.push(game);
        teams.forEach(t => option.teams.add(t));
      }
    }
    const unplaceable = slot.games.filter(g => ![...options.values()].some(o => o.games.includes(g)));
    const placeable = slot.games.length - unplaceable.length;
    if (!options.size) { plan.push({ slot, stop: null, alternatives: [], unplaceable, leg: null }); continue; }

    const cost = (option, from, { catching = false } = {}) => {
      const distance = from ? miles(from, [option.bar.lng, option.bar.lat]) : 0;
      const role = Math.min(...[...option.teams].map(t => ROLE_WEIGHT[option.bar.roles?.[t]] ?? 1.3));
      // Don't send a Georgia fan to the Alabama bar when a Georgia bar exists: your own teams' bars win.
      // An opponent's bar wins only if yours is more than ~1.5 miles farther.
      const handicap = !catching && favorites.size && ![...option.teams].some(t => favorites.has(t)) ? 1.5 : 0;
      // A saved favorite bar counts as about half a mile closer.
      const liked = favoriteBars.has(option.bar.id) ? 0.5 : 0;
      return { distance, base: Math.max(0.05, (distance + 0.3) * role + handicap - liked) };
    };
    const scored = [...options.values()].map(option => {
      const { distance, base } = cost(option, here);
      // Each selected game this bar doesn't show costs about a mile of walking.
      return { ...option, distance, score: base + placeable - option.games.length };
    }).sort((a, b) => a.score - b.score);

    const pinned = slot.games.map(g => pins[g.id]).find(id => options.has(id));
    const stop = pinned ? scored.find(o => o.bar.id === pinned) : scored[0];
    const leg = here ? travel(miles(here, [stop.bar.lng, stop.bar.lat])) : null;
    const origin = [stop.bar.lng, stop.bar.lat];

    // Halftime moves. From the first-half bar you can go catch:
    //   the second half of the same game somewhere else,
    //   another game in this window, already in progress,
    //   or any game that day you'd join fresh: one kicking off around halftime (staggered start),
    //   or one reaching its own halftime then.
    const firstCovered = new Set(stop.games.map(g => g.id));
    const firstKickoff = new Date(Math.min(...stop.games.map(g => +new Date(g.date))));
    const halftime = new Date(+firstKickoff + HALFTIME_AT * 60000);
    const candidates = new Map();
    const consider = (game, part) => { if (!candidates.has(game.id)) candidates.set(game.id, { game, part }); };
    stop.games.forEach(g => consider(g, 'second'));
    slot.games.filter(g => !firstCovered.has(g.id)).forEach(g => consider(g, 'live'));
    if (!slot.tba) {
      const moveAt = +halftime + 10 * 60000; // a typical short hop
      for (const g of dayGames) {
        if (!g.timeValid || claimed.has(g.id) || candidates.has(g.id) || dayKey(new Date(g.date)) !== dayKey(halftime)) continue;
        const sinceKickoff = (moveAt - new Date(g.date)) / 60000;
        if (sinceKickoff >= -25 && sinceKickoff <= 30) consider(g, 'first');
        else if (sinceKickoff >= HALFTIME_AT - 20 && sinceKickoff <= HALFTIME_AT + HALFTIME_BREAK + 20) consider(g, 'second');
      }
    }
    const moves = new Map();
    for (const { game, part } of candidates.values()) {
      for (const { bar, teams } of barsForGame(game, barsByTeam)) {
        if (bar.id === stop.bar.id) continue;
        if (!moves.has(bar.id)) moves.set(bar.id, { bar, games: [], teams: new Set(), parts: {} });
        const move = moves.get(bar.id);
        move.games.push(game);
        move.parts[game.id] = part;
        teams.forEach(t => move.teams.add(t));
      }
    }
    // A bar showing a game you'd otherwise miss gets a mile's edge (half that for a game you didn't pick).
    const picked = new Set(games.map(g => g.id));
    const halftimeOptions = [...moves.values()].map(option => {
      const catches = option.games.filter(g => !firstCovered.has(g.id));
      // The opponent-bar handicap is for the same game; going somewhere for a *different* game is the point.
      const { distance, base } = cost(option, origin, { catching: catches.length > 0 });
      const bonus = catches.some(g => picked.has(g.id)) ? 1 : catches.length ? 0.5 : 0;
      return { ...option, distance, catches, score: base - bonus };
    }).sort((a, b) => a.score - b.score);

    const splitChoice = slot.games.map(g => splits[g.id]).find(Boolean);
    let second = null;
    if (splitChoice && halftimeOptions.length) {
      const option = halftimeOptions.find(o => o.bar.id === splitChoice) || halftimeOptions[0];
      const moveLeg = travel(option.distance);
      const arrive = new Date(+halftime + moveLeg.minutes * 60000);
      // Show the game you'd otherwise miss if this bar has one; otherwise the same game continues.
      const shown = option.catches.length ? option.catches : option.games;
      const target = g => +new Date(g.date) + (option.parts[g.id] === 'first' ? 0 : (HALFTIME_AT + HALFTIME_BREAK) * 60000);
      const lead = shown[0];
      second = {
        ...option, games: shown, leg: moveLeg, leave: halftime, arrive,
        parts: Object.fromEntries(shown.map(g => [g.id, option.parts[g.id]])),
        lateMinutes: slot.tba || option.parts[lead.id] === 'live' ? 0 : Math.max(0, Math.round((+arrive - target(lead)) / 60000)),
        progress: slot.tba ? null : shown.map(g => ({ game: g, phase: phaseAt(g, arrive) })),
      };
      // A game joined from a later window is now handled here; that window won't repeat it.
      shown.forEach(g => claimed.add(g.id));
    }

    const covered = new Set([...stop.games, ...(second?.games || [])].map(g => g.id));
    const elsewhere = slot.games.filter(g => !covered.has(g.id) && !unplaceable.includes(g));
    plan.push({ slot, stop, alternatives: scored.filter(o => o !== stop), elsewhere, unplaceable, leg, pinned: Boolean(pinned),
      halftime, halftimeOptions, second, splitKey: slot.games[0].id });
    here = second ? [second.bar.lng, second.bar.lat] : origin;
  }
  // When should you leave? Aim to arrive at kickoff, but not before the previous game's likely end.
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    if (!step.stop || !step.leg || step.slot.tba) continue;
    step.leaveBy = new Date(step.slot.kickoff - step.leg.minutes * 60000);
    const prev = plan.slice(0, i).reverse().find(s => s.stop && !s.slot.tba);
    if (prev) {
      const shown = [...prev.stop.games, ...(prev.second?.games || [])];
      const prevEnd = new Date(Math.max(...shown.map(g => +new Date(g.date))) + GAME_HOURS * 3600000);
      step.overlapMinutes = Math.max(0, Math.round((prevEnd - step.leaveBy) / 60000));
    }
  }
  return plan;
}

// Rough game state at a moment, for "you'll walk in early in the 3rd".
export function phaseAt(game, when) {
  const elapsed = (when - new Date(game.date)) / 60000;
  if (elapsed < 0) return 'before kickoff';
  if (elapsed < HALFTIME_AT / 2) return '1st quarter';
  if (elapsed < HALFTIME_AT) return '2nd quarter';
  if (elapsed < HALFTIME_AT + HALFTIME_BREAK) return 'halftime';
  if (elapsed < HALFTIME_AT + HALFTIME_BREAK + 45) return '3rd quarter';
  if (elapsed < GAME_HOURS * 60) return '4th quarter';
  return 'probably over';
}

// Closest spots for a set of teams, for the directory view.
export function nearest(bars, teamIds, home) {
  const wanted = new Set(teamIds);
  return bars
    .filter(bar => bar.teams.some(t => wanted.has(t.id)))
    .map(bar => ({ bar, distance: home ? miles(home, [bar.lng, bar.lat]) : null }))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0) || a.bar.name.localeCompare(b.bar.name));
}
