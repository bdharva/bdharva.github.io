import { setTravelMode, planCrawl, nearest, slots, barsForGame, miles, travel, describeTravel, clock, dayName, dayKey, GAME_HOURS, HALFTIME_AT, HALFTIME_BREAK } from './crawl.js';
import { NEIGHBORHOODS, DEFAULT_HOME, findNeighborhood } from './neighborhoods.js';
import { initTheme, readTheme } from './theme.js';
import { initMap, renderMap, setMapTheme, showPopup, setPicking, resizeMap, snapshot, setRouteGeometry, setSubway, setSubwayFocus } from './map.js';
import { routeGeometry, stationPair } from './routes.js';
import { drawCard } from './card.js';
import { suggestDay, visits as toVisits, reasons, segmentKey } from './suggest.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CONF_ORDER = ['SEC', 'Big Ten', 'ACC', 'Big 12', 'Pac-12', 'American', 'Mountain West', 'MAC', 'Conference USA', 'Sun Belt', 'FBS Independents'];
const ROLE_LABEL = { official: 'Official', secondary: 'Also', fan: 'Fan spot' };

const data = { extras: { brunch: [], nightcaps: [] }, subway: null, teams: new Map(), bars: [], barById: new Map(), barsByTeam: new Map(), weeks: [], games: [], clubs: [], season: 2026, updated: null };
const state = { week: null, home: DEFAULT_HOME, teams: new Set(), favBars: new Set(), setupTab: 'teams', barSearch: '', toggles: new Map(), pins: {}, splits: {}, mode: 'pick', brunch: null, nightcap: null, travel: 'walk', priority: 'teams', halves: 'split', locks: [], rightTab: 'crawl', openSwaps: new Set(), explore: { q: '', view: null }, filter: 'bars', search: '', pane: 'plan' };

// ---------- helpers ----------
const weekKey = w => `${w.seasonType}-${w.week}`;
const gamesInWeek = key => data.games.filter(g => `${g.seasonType}-${g.week}` === key);
const hasBar = id => (data.barsByTeam.get(id) || []).length > 0;
const logo = (id, size = 36) => `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${id}.png&w=${size}&h=${size}`;
const logoImg = (id, cls = 'logo') => id > 0 ? `<img class="${cls}" src="${logo(id)}" alt="" loading="lazy" width="18" height="18">` : `<span class="${cls}"></span>`;

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Team colors encode data. Swap near-white primaries for the alternate so dots stay visible on the light basemap.
// On the dark basemap, near-black navies swap to the alternate the same way.
function teamColor(id) {
  const t = data.teams.get(id);
  if (!t) return '#8a9399';
  const dark = document.documentElement.classList.contains('dark');
  const visible = hex => dark ? luminance(hex) > 0.04 : luminance(hex) < 0.75;
  return [t.color, t.altColor].find(visible) || '#8a9399';
}
const teamName = side => data.teams.get(side.id)?.school || side.name;
const rankOf = side => side.rank ? `<span class="rank">${side.rank}</span>` : '';

function isSelected(game) {
  if (state.toggles.has(game.id)) return state.toggles.get(game.id);
  return state.teams.has(game.home.id) || state.teams.has(game.away.id);
}
const selectedGames = () => gamesInWeek(state.week).filter(isSelected);

function kickoffLabel(game) {
  const date = new Date(game.date);
  return game.timeValid ? clock(date) : 'TBA';
}

// ---------- persistence: URL hash is shareable, localStorage remembers you ----------
function writeState() {
  const params = new URLSearchParams();
  params.set('w', state.week);
  params.set('h', findNeighborhood(state.home.label) ? state.home.label : `${state.home.coords[0].toFixed(4)},${state.home.coords[1].toFixed(4)}`);
  if (state.teams.size) params.set('t', [...state.teams].join('.'));
  if (state.favBars.size) params.set('fb', [...state.favBars].join('.'));
  const toggles = [...state.toggles].map(([id, on]) => (on ? '' : '-') + id);
  if (toggles.length) params.set('g', toggles.join('.'));
  const pins = Object.entries(state.pins).map(([g, b]) => `${g}:${b}`);
  if (pins.length) params.set('p', pins.join('.'));
  const splits = Object.entries(state.splits).map(([g, b]) => `${g}:${b}`);
  if (splits.length) params.set('s', splits.join('.'));
  if (state.mode === 'auto') params.set('m', 'auto');
  if (state.travel !== 'walk') params.set('tr', state.travel);
  if (state.brunch) params.set('br', state.brunch);
  if (state.nightcap) params.set('nc', state.nightcap);
  if (state.locks.length) params.set('lk', state.locks.join('.'));
  if (state.priority !== 'teams') params.set('pr', state.priority);
  if (state.halves !== 'split') params.set('hv', state.halves);
  history.replaceState(null, '', '#' + params.toString());
  try { localStorage.setItem('nycCfbBarCrawler', JSON.stringify({ teams: [...state.teams], favBars: [...state.favBars], home: state.home })); } catch {}
}

function readState() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('nycCfbBarCrawler') || '{}'); } catch {}
  const params = new URLSearchParams(location.hash.slice(1));
  const teams = params.get('t')?.split('.') ?? saved.teams ?? [];
  state.favBars = new Set((params.get('fb')?.split('.') ?? saved.favBars ?? []).filter(id => data.barById.has(id)));
  state.teams = new Set(teams.filter(id => data.teams.has(id)));
  const h = params.get('h');
  if (h && /^-?\d/.test(h)) { const [lng, lat] = h.split(',').map(Number); state.home = { label: 'Dropped pin', coords: [lng, lat] }; }
  else if (h && findNeighborhood(h)) state.home = findNeighborhood(h);
  else if (saved.home?.coords) state.home = saved.home;
  const weeks = data.weeks.map(weekKey);
  state.week = weeks.includes(params.get('w')) && weekIsLive(params.get('w')) ? params.get('w') : currentWeek();
  for (const token of params.get('g')?.split('.') ?? []) state.toggles.set(token.replace('-', ''), !token.startsWith('-'));
  for (const token of params.get('p')?.split('.') ?? []) { const [g, b] = token.split(':'); if (data.barById.has(b)) state.pins[g] = b; }
  if (params.get('m') === 'auto') state.mode = 'auto';
  state.brunch = data.extras.brunch.some(b => b.id === params.get('br')) ? params.get('br') : null;
  state.nightcap = data.extras.nightcaps.some(b => b.id === params.get('nc')) ? params.get('nc') : null;
  if (['ride', 'train'].includes(params.get('tr'))) state.travel = params.get('tr');
  state.locks = params.get('lk')?.split('.').filter(k => /^\d+:[012]:[\w-]+$/.test(k)) ?? [];
  if (params.get('pr') === 'matchups') state.priority = 'matchups';
  if (params.get('hv') === 'full') state.halves = 'full';
  for (const token of params.get('s')?.split('.') ?? []) { const [g, b] = token.split(':'); if (b === 'auto' || data.barById.has(b)) state.splits[g] = b; }
}

// The first week with a game still to come (kickoff within the last ~4 hours counts), so Saturday shows
// today's slate and Sunday already rolls to next week. Past the bowls, the last week.
const GAME_WINDOW_MS = 4 * 3600000;
const weekIsLive = key => gamesInWeek(key).some(g => +new Date(g.date) + GAME_WINDOW_MS > Date.now());
function currentWeek() {
  const week = data.weeks.find(w => weekIsLive(weekKey(w))) || data.weeks.at(-1);
  return weekKey(week);
}

// ---------- rendering ----------
function renderWeekSelect() {
  const upcoming = data.weeks.filter(w => weekIsLive(weekKey(w)) || weekKey(w) === state.week);
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  $('week').innerHTML = upcoming.map(w => {
    // ESPN weeks run Monday to Sunday; label them by the Saturday.
    const start = new Date(w.start), saturday = new Date(+start + ((6 - start.getUTCDay() + 7) % 7) * 864e5 + 6 * 36e5);
    const label = w.seasonType === 3 ? w.label : `${w.label} · ${fmt.format(saturday)}`;
    return `<option value="${weekKey(w)}" ${weekKey(w) === state.week ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
  $('setup-week').innerHTML = $('week').innerHTML;
  const index = upcoming.findIndex(w => weekKey(w) === state.week);
  $('week-prev').disabled = index <= 0;
  $('week-next').disabled = index >= upcoming.length - 1;
  const games = gamesInWeek(state.week);
  const withBars = games.filter(g => hasBar(g.home.id) || hasBar(g.away.id)).length;
  $('week-note').textContent = `${games.length} games · ${withBars} with an NYC alumni bar`;
}

function renderHomeSelect() {
  const custom = !findNeighborhood(state.home.label);
  $('home').innerHTML = (custom ? `<option value="__custom" selected>${esc(state.home.label)}</option>` : '') +
    NEIGHBORHOODS.map(([borough, places]) => `<optgroup label="${esc(borough)}">${places.map(([name]) =>
      `<option ${name === state.home.label ? 'selected' : ''}>${esc(name)}</option>`).join('')}</optgroup>`).join('');
  const near = nearest(data.bars, [...data.teams.keys()], state.home.coords).filter(x => x.distance < 0.75).length;
  $('home-note').textContent = `${near} bar${near === 1 ? '' : 's'} within a 15-min walk`;
}

function renderFavoriteBars() {
  document.querySelectorAll('#setup-tab button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === state.setupTab)));
  $('setup-teams').hidden = state.setupTab !== 'teams';
  $('setup-bars').hidden = state.setupTab !== 'bars';
  $('my-bars').innerHTML = [...state.favBars].map(id => data.barById.get(id)).map(b =>
    `<button class="chip" data-unfav="${b.id}" style="--team:${teamColor(b.teams[0].id)}" aria-label="Remove ${esc(b.name)}"><span class="swatch"></span>${esc(b.name)}<svg class="icon"><use href="#icon-x"/></svg></button>`).join('');
  const q = state.barSearch.trim().toLowerCase();
  const rows = data.bars
    .filter(b => !q || `${b.name} ${b.neighborhood || ''} ${b.teams.map(t => data.teams.get(t.id).school).join(' ')}`.toLowerCase().includes(q))
    .map(b => ({ b, d: miles(state.home.coords, at(b)) })).sort((x, y) => x.d - y.d)
    .map(({ b, d }) => `<label class="team-row bar-row"><input type="checkbox" data-favbar="${b.id}" ${state.favBars.has(b.id) ? 'checked' : ''}>${logoImg(b.teams[0].id)}<span class="name">${esc(b.name)}<span class="meta">${esc(b.teams.map(t => data.teams.get(t.id).school).join(', '))} · ${esc(b.neighborhood || '')}</span></span><span class="count">${d.toFixed(1)} MI</span></label>`).join('');
  $('bar-list').innerHTML = rows || `<p class="empty">No bar matches “${esc(state.barSearch)}”.</p>`;
}

const favFlag = bar => (state.favBars.has(bar.id) ? '<span class="flag star" title="Favorite bar" aria-label="Favorite bar"><svg class="icon"><use href="#icon-star"/></svg></span>' : '');

function toggleFavBar(id, on = !state.favBars.has(id)) {
  on ? state.favBars.add(id) : state.favBars.delete(id);
  render({ fit: false });
}

function renderChips() {
  $('my-teams').innerHTML = [...state.teams].map(id => data.teams.get(id)).sort((a, b) => a.school.localeCompare(b.school)).map(t =>
    `<button class="chip" data-team="${t.id}" style="--team:${teamColor(t.id)}" aria-label="Remove ${esc(t.school)}"><span class="swatch"></span>${esc(t.school)}<svg class="icon"><use href="#icon-x"/></svg></button>`).join('');
}

function renderTeams() {
  const q = state.search.trim().toLowerCase();
  const match = t => !q || `${t.school} ${t.mascot} ${t.abbr}`.toLowerCase().includes(q);
  const html = CONF_ORDER.map(conf => {
    const teams = [...data.teams.values()].filter(t => t.conf === conf && match(t)).sort((a, b) => a.school.localeCompare(b.school));
    if (!teams.length) return '';
    return `<div class="conf-label">${esc(conf)}</div>` + teams.map(t => {
      const n = (data.barsByTeam.get(t.id) || []).length;
      return `<label class="team-row ${n ? '' : 'none'}"><input type="checkbox" data-team="${t.id}" ${state.teams.has(t.id) ? 'checked' : ''}>${logoImg(t.id)}<span class="name">${esc(t.school)}</span><span class="count">${n ? `${n} BAR${n > 1 ? 'S' : ''}` : '—'}</span></label>`;
    }).join('');
  }).join('');
  $('team-list').innerHTML = html || `<p class="empty">No FBS school matches “${esc(state.search)}”.</p>`;
}

// In suggest mode the slate shows the plan: ticked = in the suggested day (or pushed in by you).
// Unticking a suggested game excludes it; ticking any game pushes it in.
function planTags() {
  const tags = new Map();
  for (const v of lastSuggestion?.visits || []) for (const { game, halves } of v.games) {
    tags.set(game.id, [...(tags.get(game.id) || []), `${halvesLabel(halves)} · ${v.bar.name}`]);
  }
  return tags;
}
const isTicked = (g, tags) => (state.mode !== 'auto' ? isSelected(g) : state.toggles.has(g.id) ? state.toggles.get(g.id) : tags.has(g.id));

function renderGames() {
  const tags = state.mode === 'auto' ? planTags() : new Map();
  const ticked = g => isTicked(g, tags);
  let games = gamesInWeek(state.week).filter(g => g.home.id > 0 || g.away.id > 0);
  if (state.filter === 'bars') games = games.filter(g => hasBar(g.home.id) || hasBar(g.away.id) || ticked(g));
  if (state.filter === 'mine') games = games.filter(ticked);
  games.sort((a, b) => (b.timeValid - a.timeValid) || new Date(a.date) - new Date(b.date));
  if (!games.length) {
    $('games').innerHTML = `<p class="empty">${state.filter === 'mine' ? 'Nothing ticked yet. Pick your teams from the gear up top, or tick games under “With a bar”.' : 'No games this week.'}</p>`;
    return;
  }
  let html = '', lastDay = null, lastSlot = null;
  for (const g of games) {
    const date = new Date(g.date);
    const day = g.timeValid ? dayKey(date) : 'tba';
    if (day !== lastDay) { html += `<div class="day-label">${g.timeValid ? esc(dayName(date)) : 'Time to be announced'}</div>`; lastDay = day; lastSlot = null; }
    const slot = g.timeValid ? clock(date) : null;
    if (slot && slot !== lastSlot) { html += `<div class="slot-label"><span>${esc(slot)}</span></div>`; lastSlot = slot; }
    const bars = barsForGame(g, data.barsByTeam).length;
    const side = s => `<span class="side ${hasBar(s.id) ? '' : 'nobar'}">${logoImg(s.id)}${rankOf(s)}<span class="school">${esc(teamName(s))}</span>${g.state !== 'pre' && s.score != null ? `<span class="rank">${esc(s.score)}</span>` : ''}</span>`;
    html += `<label class="game ${g.state === 'post' ? 'final' : ''}"><input type="checkbox" data-game="${g.id}" ${ticked(g) ? 'checked' : ''}>
      <span class="matchup">${side(g.away)}${side(g.home)}${(tags.get(g.id) || []).map(t => `<span class="plan-tag">${esc(t)}</span>`).join('')}${state.mode === 'auto' && state.toggles.get(g.id) === false ? '<span class="plan-tag" style="color:var(--caption)">Left out</span>' : ''}</span>
      <span class="game-meta"><span>${esc(g.tv[0] || '')}</span><span class="${bars ? 'bars' : ''}">${bars ? `${bars} BAR${bars > 1 ? 'S' : ''}` : 'NO BAR'}</span>${g.state === 'post' ? '<span>FINAL</span>' : g.state === 'in' ? '<span>LIVE</span>' : ''}</span></label>`;
  }
  $('games').innerHTML = html;
}

function stopColor(option) {
  const mine = [...option.teams].find(t => state.teams.has(t));
  return teamColor(mine || [...option.teams][0]);
}

// ---------- shared pieces for the crawl list ----------
const rankNum = side => (side.rank ? `<span class="gr-rank">${side.rank}</span>` : '');
// One game: logos in a fixed column, matchup (ranks inline) with an optional reason line, part and TV at right.
function gameRow(g, { part = '', why = '' } = {}) {
  return `<li class="game-row">
    <span class="gr-logos">${logoImg(g.away.id)}${logoImg(g.home.id)}</span>
    <span class="gr-main"><span class="gr-match">${rankNum(g.away)}${esc(teamName(g.away))} <span class="gr-at">${g.neutral ? 'vs' : 'at'}</span> ${rankNum(g.home)}${esc(teamName(g.home))}</span>${why ? `<span class="gr-why">${esc(why)}</span>` : ''}</span>
    <span class="gr-side">${part ? `<span class="gr-part">${esc(part)}</span>` : ''}${g.tv[0] ? `<span>${esc(g.tv[0])}</span>` : ''}</span>
  </li>`;
}
const shortMatch = g => `${esc(teamName(g.away))}–${esc(teamName(g.home))}`;
const roleFlag = (bar, teams) => ([...teams].map(t => bar.roles[t]).includes('official') ? '<span class="flag good">Club bar</span>' : '<span class="flag">Fan spot</span>');
const textLink = (attrs, label) => `<button class="text-link" ${attrs}>${label}</button>`;
// One alternative: a single line, truncating instead of wrapping.
const swapRow = (attrs, color, main, side) => `<button class="swap" ${attrs} style="--team:${color}"><i></i><span class="swap-main">${main}</span><span class="swap-side">${side}</span></button>`;
// Every stop's alternatives live behind one disclosure, which remembers being open across re-renders.
function swaps(key, groups) {
  const shown = groups.filter(g => g.rows.length);
  const count = shown.reduce((sum, g) => sum + g.rows.length, 0);
  if (!count) return '';
  return `<details class="swaps" data-key="${esc(key)}" ${state.openSwaps.has(key) ? 'open' : ''}><summary>Other options <span class="count">${count}</span></summary>
    ${shown.map(g => `<div class="swap-label">${esc(g.label)}</div>${g.rows.join('')}`).join('')}</details>`;
}
function stopItem({ n, cls = '', color, time, action = '', leg = '', bar, teams, body }) {
  return `<li class="${cls}" style="--team:${color}"><span class="dot">${n}</span><div class="stop">
    <div class="stop-top"><span class="stop-time">${time}</span>${action}</div>
    ${leg ? `<div class="leg">${leg}</div>` : ''}
    <div class="stop-name"><button data-bar="${bar.id}">${esc(bar.name)}</button>${roleFlag(bar, teams)}${favFlag(bar)}</div>
    <div class="stop-addr">${esc(bar.address.split(',')[0])} · ${esc(bar.neighborhood || bar.borough || '')}</div>
    ${body}
  </div></li>`;
}

// Every bar you walk into, in order: each stop, plus its second-half bar if you move at halftime.
const segments = plan => plan.filter(p => p.stop).flatMap(p => [p.stop, ...(p.second ? [p.second] : [])]);
const matchup = g => `${esc(teamName(g.away))} ${g.neutral ? 'vs' : 'at'} ${esc(teamName(g.home))}`;
const PART = { first: '1st half of', second: '2nd half of', live: 'the rest of' };
const PART_SHORT = { first: '1st half', second: '2nd half', live: 'in progress' };
const catchText = option => option.catches.map(g => `${PART[option.parts[g.id]]} ${matchup(g)}`).join(' + ');

// ---------- getting there ----------
const LINE_COLOR = line => ({ 1: '#EE352E', 2: '#EE352E', 3: '#EE352E', 4: '#00933C', 5: '#00933C', 6: '#00933C', 7: '#B933AD',
  A: '#0039A6', C: '#0039A6', E: '#0039A6', B: '#FF6319', D: '#FF6319', F: '#FF6319', M: '#FF6319', G: '#6CBE45',
  J: '#996633', Z: '#996633', L: '#A7A9AC', N: '#FCCC0A', Q: '#FCCC0A', R: '#FCCC0A', W: '#FCCC0A' })[line] || '#808183';
const bullet = line => `<span class="line-bullet ${'NQRW'.includes(line) ? 'dark-text' : ''}" style="--line:${LINE_COLOR(line)}">${esc(line)}</span>`;
// "12 min walk" plus, for a subway leg, which train from which station to which.
function legText(leg, from, to) {
  let html = `<strong>${esc(describeTravel(leg))}</strong>`;
  if (leg?.mode === 'train' && data.subway) {
    const pair = stationPair(from, to, data.subway.stations);
    if (pair) html += `<span class="train-hint">${pair.lines.slice(0, 4).map(bullet).join('')} ${esc(pair.from.name)} → ${esc(pair.to.name)}${pair.transfer ? ' (transfer)' : ''}</span>`;
  }
  return html;
}

// ---------- bookends: brunch before, a nightcap after ----------
const brunchSpot = () => data.extras.brunch.find(b => b.id === state.brunch) || null;
const nightcapSpot = () => data.extras.nightcaps.find(b => b.id === state.nightcap) || null;
const at = spot => [spot.lng, spot.lat];
// Where the crawl proper starts: brunch if you're having it, otherwise home.
const startPoint = () => (brunchSpot() ? at(brunchSpot()) : state.home.coords);
const closestTo = (list, point, n = 3) => list.map(spot => ({ spot, d: miles(point, at(spot)) })).sort((a, b) => a.d - b.d).slice(0, n);

const removeButton = (kind, label) => `<button class="remove" data-${kind}="" aria-label="${label}" title="${label}"><svg class="icon"><use href="#icon-x"/></svg>Remove</button>`;

// Every other bar showing a game, nearest to `from` first.
function otherBars(game, currentBarId, from) {
  return barsForGame(game, data.barsByTeam).filter(o => o.bar.id !== currentBarId)
    .map(o => ({ ...o, distance: miles(from, [o.bar.lng, o.bar.lat]) })).sort((a, b) => a.distance - b.distance);
}

function startItems() {
  const items = [`<li><span class="dot home"><svg class="icon"><use href="#icon-home"/></svg></span><div><div class="stop-time">Start</div><div class="stop-name">${esc(state.home.label)}</div></div></li>`];
  const brunch = brunchSpot();
  if (brunch) {
    const leg = travel(miles(state.home.coords, at(brunch)));
    items.push(`<li><span class="dot bookend"><svg class="icon"><use href="#icon-coffee"/></svg></span><div>
      <div class="stop-time">Brunch · GameDay ${brunch.hours ? `· opens ${esc(brunch.hours)}` : ''}</div>
      <p class="leg">${legText(leg, state.home.coords, at(brunch))}</p>
      <div class="stop-name"><button data-extra="brunch:${brunch.id}">${esc(brunch.name)}</button>${brunch.bottomless ? '<span class="flag good">Bottomless</span>' : ''}${removeButton('brunch', 'Remove brunch')}</div>
      <div class="stop-addr">${esc(brunch.address.split(',')[0])} · ${esc(brunch.neighborhood || '')}</div>
      ${brunch.blurb ? `<p class="blurb">${esc(brunch.blurb)}</p>` : ''}</div></li>`);
  } else if (data.extras.brunch.length) {
    const offers = closestTo(data.extras.brunch, state.home.coords).map(({ spot, d }) =>
      `<button class="swap" data-brunch="${spot.id}"><svg class="icon"><use href="#icon-coffee"/></svg><span class="swap-main">${esc(spot.name)}</span><span class="swap-side">${travel(d).miles.toFixed(1)} mi</span></button>`).join('');
    items.push(`<li class="bookend-offer"><span class="mono">Start early: brunch and College GameDay</span><div class="bookend-list">${offers}</div></li>`);
  }
  return items;
}

function endItems(from, after) {
  const cap = nightcapSpot();
  if (cap) {
    const leg = travel(miles(from, at(cap)));
    return [`<li><span class="dot bookend"><svg class="icon"><use href="#icon-moon"/></svg></span><div>
      <div class="stop-time">Nightcap${after ? ` · after ${esc(clock(after))}` : ''}${cap.hours ? ` · open till ${esc(cap.hours)}` : ''}</div>
      <p class="leg">${legText(leg, from, at(cap))}</p>
      <div class="stop-name"><button data-extra="nightcaps:${cap.id}">${esc(cap.name)}</button>${removeButton('nightcap', 'Remove nightcap')}</div>
      <div class="stop-addr">${esc(cap.address.split(',')[0])} · ${esc(cap.neighborhood || '')}</div>
      ${cap.blurb ? `<p class="blurb">${esc(cap.blurb)}</p>` : ''}</div></li>`];
  }
  if (!data.extras.nightcaps.length) return [];
  const offers = closestTo(data.extras.nightcaps, from).map(({ spot, d }) =>
    `<button class="swap" data-nightcap="${spot.id}"><svg class="icon"><use href="#icon-moon"/></svg><span class="swap-main">${esc(spot.name)}</span><span class="swap-side">${travel(d).miles.toFixed(1)} mi</span></button>`).join('');
  return [`<li class="bookend-offer"><span class="mono">One more? Nightcaps after the late games</span><div class="bookend-list">${offers}</div></li>`];
}

// ---------- suggested day ----------
function suggestion() {
  const games = gamesInWeek(state.week).filter(g => state.toggles.get(g.id) !== false);
  const pushed = new Set([...state.toggles].filter(([, on]) => on).map(([id]) => id));
  const result = suggestDay({ games, barsByTeam: data.barsByTeam, home: startPoint(),
    favorites: state.teams, favoriteBars: state.favBars, picked: pushed, priority: state.priority, halves: state.halves, locks: state.locks });
  const vs = toVisits(result.path, startPoint());
  for (const v of vs) {
    const playing = new Set(v.games.flatMap(({ game }) => [game.home.id, game.away.id]));
    v.teams = new Set(v.bar.teams.map(t => t.id).filter(id => playing.has(id)));
  }
  return { ...result, visits: vs };
}
const halvesLabel = halves => halves.length === 2 ? 'Full game' : halves[0] === 1 ? '1st half' : '2nd half';

// Per half in a visit: what's pinned, and the next-best swaps (tap to pin one and replan).
function visitSwapGroups(v, from) {
  const groups = v.games.map(({ game }) => {
    const segs = v.segments.filter(seg => seg.game.id === game.id);
    const replace = segs.map(segmentKey).join(',');
    return {
      label: `Watch ${teamName(game.away)}–${teamName(game.home)} elsewhere`,
      rows: otherBars(game, v.bar.id, from).slice(0, 3).map(o =>
        swapRow(`data-lock="${segs.map(seg => `${game.id}:${seg.half}:${o.bar.id}`).join(',')}" data-replace="${replace}"`, teamColor(o.teams[0]), esc(o.bar.name), `${o.distance.toFixed(1)} mi`)),
    };
  });
  const when = seg => ({ 0: 'Instead of this game', 1: 'Instead, for the 1st half', 2: seg === v.segments[0] ? 'Instead, for the 2nd half' : 'Switch at the half' })[seg.half];
  for (const seg of v.segments) {
    groups.push({
      label: `${when(seg)} · ${clock(new Date(seg.start))}`,
      rows: seg.alternatives.map(c => {
        const team = c.bar.teams.find(t => t.id === c.game.home.id || t.id === c.game.away.id)?.id;
        const part = { 0: '', 1: '1st · ', 2: '2nd · ' }[c.half];
        return swapRow(`data-lock="${segmentKey(c)}" data-replace="${segmentKey(seg)}"`, teamColor(team), `${part}${shortMatch(c.game)}`,
          c.distance < 0.05 ? 'stay here' : `${esc(c.bar.name)} · ${c.distance.toFixed(1)} mi`);
      }),
    });
  }
  return groups;
}

function renderSuggestion({ day, visits: vs }) {
  const week = data.weeks.find(w => weekKey(w) === state.week);
  $('crawl-eyebrow').textContent = `SUGGESTED / ${week?.label.toUpperCase() ?? ''}`;
  $('tab-count').textContent = vs.length ? `· ${vs.length}` : '';
  if (!vs.length) {
    $('crawl-title').textContent = 'Nothing to suggest';
    $('crawl').innerHTML = `<li class="crawl-empty" style="display:block">No games with an NYC alumni bar and a confirmed kickoff this week yet. Times usually firm up six to twelve days out.</li>`;
    return;
  }
  const gameCount = new Set(vs.flatMap(v => v.games.map(g => g.game.id))).size;
  $('crawl-title').textContent = `${dayName(vs[0].start).split(',')[0]}: ${gameCount} games, ${vs.length} bar${vs.length > 1 ? 's' : ''}`;
  const context = { favorites: state.teams, picked: new Set(selectedGames().map(g => g.id)) };
  const items = startItems();
  let from = startPoint();
  vs.forEach((v, i) => {
    const legBits = [legText(v.leg, from, [v.bar.lng, v.bar.lat]), `leave ${esc(clock(new Date(+v.start - v.leg.minutes * 60000)))}`].join('<span>·</span>');
    const late = v.lateMinutes >= 5 ? `<p class="note">You'll join about ${v.lateMinutes} minutes in.</p>` : '';
    const games = v.games.map(({ game, halves }) => gameRow(game, { part: halvesLabel(halves), why: reasons(game, context).join(' · ') })).join('');
    const pinned = v.segments.filter(seg => seg.locked).map(segmentKey);
    items.push(stopItem({
      n: i + 1, color: stopColor(v), time: `${esc(clock(v.start))} – ${esc(clock(v.end))}`, leg: legBits, bar: v.bar, teams: v.teams,
      action: pinned.length ? textLink(`data-unlock="${pinned.join(',')}"`, 'Pinned · undo') : '',
      body: `<ul class="stop-games">${games}</ul>${late}${swaps(`v:${v.bar.id}:${v.segments[0].start}`, visitSwapGroups(v, from))}`,
    }));
    from = [v.bar.lng, v.bar.lat];
  });
  items.push(...endItems(from, vs.at(-1).end));
  $('crawl').innerHTML = items.join('');
}

function renderCrawl(plan) {
  const games = selectedGames();
  const stops = segments(plan);
  const week = data.weeks.find(w => weekKey(w) === state.week);
  $('crawl-eyebrow').textContent = `THE CRAWL / ${week?.label.toUpperCase() ?? ''}`;
  $('tab-count').textContent = stops.length ? `· ${stops.length}` : '';
  if (!games.length) {
    $('crawl-title').textContent = 'Pick a few games';
    $('crawl').innerHTML = `<li class="crawl-empty" style="display:block">Tick your teams, or individual games in the slate. The crawl takes one bar per kickoff window: the closest club bar to wherever you were last, favoring bars that show more than one of your games. Any stop can split at halftime, moving to another bar for the second half of the same game or of another game in that window.</li>`;
    return;
  }
  const first = plan.find(p => p.stop)?.slot.kickoff;
  $('crawl-title').textContent = stops.length
    ? `${stops.length} stop${stops.length > 1 ? 's' : ''}${first && !plan.find(p => p.stop).slot.tba ? `, ${dayName(first).split(',')[0]}` : ''}`
    : 'No bars for these games';
  let n = 0;
  const items = startItems();
  for (const step of plan) {
    const when = step.slot.tba ? 'Time TBA' : `${dayName(step.slot.kickoff).split(',')[0].slice(0, 3)} ${clock(step.slot.kickoff)}`;
    if (!step.stop) {
      items.push(`<li><span class="dot gap">–</span><div class="stop"><div class="stop-top"><span class="stop-time">${esc(when)}</span></div><ul class="stop-games">${step.slot.games.map(g => gameRow(g)).join('')}</ul><p class="note">No NYC alumni bar for ${step.slot.games.length > 1 ? 'these games' : 'this game'} yet. Any sports bar will have it on.</p></div></li>`);
      continue;
    }
    n += 1;
    const { stop, leg } = step;
    const legBits = [leg && legText(leg, prevCoords(plan, step), [stop.bar.lng, stop.bar.lat]), step.leaveBy && `leave by ${esc(clock(step.leaveBy))}`].filter(Boolean).join('<span>·</span>');
    // Bars showing the same game(s) as this stop come first; then bars showing the window's other games.
    const showsSame = a => a.games.some(g => stop.games.includes(g));
    step.alternatives.sort((a, b) => showsSame(b) - showsSame(a));
    const barRows = step.alternatives.slice(0, 5).map(a => {
      const d = travel(miles(prevCoords(plan, step), [a.bar.lng, a.bar.lat])).miles;
      return swapRow(`data-pin="${a.bar.id}" data-games="${a.games.map(g => g.id).join(',')}"`, stopColor(a),
        `${esc(a.bar.name)}${showsSame(a) ? '' : ` <span class="swap-note">${a.games.map(shortMatch).join(', ')}</span>`}`, `${d.toFixed(1)} mi`);
    });
    const elsewhere = step.elsewhere.length ? `<p class="note warn">Also on now, at other bars: ${step.elsewhere.map(shortMatch).join(', ')}.</p>` : '';
    const unplaceable = step.unplaceable.length ? `<p class="note">No alumni bar for ${step.unplaceable.map(shortMatch).join(', ')}; any sports bar will have it on.</p>` : '';
    const overlap = step.overlapMinutes > 20 ? `<p class="note">Leaves the last stop about ${step.overlapMinutes} minutes before its game ends.</p>` : '';
    // The halftime move stays visible: loudly when it catches a game you'd otherwise miss, quietly otherwise.
    let move = '';
    if (!step.second && step.halftimeOptions.length) {
      const catcher = step.halftimeOptions.find(o => o.catches.length);
      const at = step.slot.tba ? 'At halftime' : `At halftime · ${clock(step.halftime)}`;
      move = catcher
        ? `<button class="move" data-split="${step.splitKey}" data-to="${catcher.bar.id}" style="--team:${stopColor(catcher)}"><span class="move-when">${esc(at)}</span><span class="move-what"><i></i>${catchText(catcher)}</span><span class="move-where">${esc(catcher.bar.name)} · ${esc(describeTravel(travel(catcher.distance)))}</span></button>`
        : `<button class="move quiet" data-split="${step.splitKey}" data-to="auto"><svg class="icon"><use href="#icon-route"/></svg>Move bars at halftime</button>`;
    }
    items.push(stopItem({
      n, color: stopColor(stop), bar: stop.bar, teams: stop.teams, leg: legBits,
      time: `${esc(when)}${step.second ? ' · 1st half' : ''}`,
      action: step.pinned ? textLink(`data-unpin="${step.slot.games.map(g => g.id).join(',')}"`, 'Reset bar') : '',
      body: `<ul class="stop-games">${stop.games.map(g => gameRow(g, { part: step.second ? '1st half' : '' })).join('')}</ul>
        ${overlap}${elsewhere}${unplaceable}${move}${swaps(`p:${step.splitKey}`, [{ label: 'Other bars this window', rows: barRows }])}`,
    }));
    if (step.second) {
      n += 1;
      const second = step.second;
      const moveBits = [legText(second.leg, [stop.bar.lng, stop.bar.lat], [second.bar.lng, second.bar.lat]), !step.slot.tba && `leave ${esc(clock(second.leave))}, in by ${esc(clock(second.arrive))}`].filter(Boolean).join('<span>·</span>');
      const late = second.lateMinutes > 0 ? `<p class="note warn">Longer than the 20-minute halftime: you'll miss about ${second.lateMinutes} minutes.</p>` : '';
      const joins = second.progress?.filter(p => p.phase !== 'halftime').map(p => `<p class="note">${matchup(p.game)} will be in the ${esc(p.phase)} when you walk in.</p>`).join('') || '';
      const moveRows = step.halftimeOptions.filter(o => o.bar.id !== second.bar.id).slice(0, 4).map(o =>
        swapRow(`data-split="${step.splitKey}" data-to="${o.bar.id}"`, stopColor(o), esc(o.bar.name) + (o.catches.length ? ` <span class="swap-note">${esc(PART_SHORT[o.parts[o.catches[0].id]])}, ${shortMatch(o.catches[0])}</span>` : ' <span class="swap-note">same game</span>'), `${travel(o.distance).miles.toFixed(1)} mi`));
      items.push(stopItem({
        n, cls: 'second-half', color: stopColor(second), bar: second.bar, teams: second.teams, leg: moveBits,
        time: 'Halftime', action: textLink(`data-unsplit="${step.splitKey}"`, 'Stay put'),
        body: `<ul class="stop-games">${second.games.map(g => gameRow(g, { part: PART_SHORT[second.parts[g.id]] })).join('')}</ul>${late}${joins}${swaps(`h:${step.splitKey}`, [{ label: 'Or at halftime, go to', rows: moveRows }])}`,
      }));
    }
  }
  const last = segments(plan).at(-1);
  const lastStep = plan.filter(p => p.stop).at(-1);
  if (last) items.push(...endItems([last.bar.lng, last.bar.lat], lastStep && !lastStep.slot.tba ? new Date(+lastStep.slot.kickoff + 3.5 * 3600000) : null));
  $('crawl').innerHTML = items.join('');
}

function prevCoords(plan, step) {
  const before = plan.slice(0, plan.indexOf(step)).reverse().find(p => p.stop);
  if (!before) return startPoint();
  return before.second ? [before.second.bar.lng, before.second.bar.lat] : [before.stop.bar.lng, before.stop.bar.lat];
}

function renderDirectory() {
  const mine = [...state.teams];
  const list = nearest(data.bars, mine.length ? mine : [...data.teams.keys()], state.home.coords).slice(0, mine.length ? 20 : 12);
  document.querySelector('.directory .eyebrow').textContent = mine.length ? "YOUR TEAMS' SPOTS, NEAREST FIRST" : 'NEAREST ALUMNI BARS';
  $('directory').innerHTML = list.map(({ bar, distance }) => {
    const shown = bar.teams.filter(t => !mine.length || state.teams.has(t.id));
    return `<li data-bar="${bar.id}"><span class="logos">${shown.slice(0, 3).map(t => logoImg(t.id)).join('')}</span>
      <span class="dname">${esc(bar.name)}${state.favBars.has(bar.id) ? ' ★' : ''}</span><span class="dist">${travel(distance).miles.toFixed(1)} MI</span>
      <span class="dmeta">${esc(shown.map(t => data.teams.get(t.id).school).join(', '))} · ${esc(bar.neighborhood || bar.borough || '')}</span></li>`;
  }).join('') || '<li class="empty">No bars yet for your teams.</li>';
}

function popupHtml(bar) {
  const week = gamesInWeek(state.week);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${bar.name}, ${bar.address}`)}`;
  const rows = bar.teams.map(t => {
    const team = data.teams.get(t.id);
    const game = week.find(g => g.home.id === t.id || g.away.id === t.id);
    const vs = game ? (game.home.id === t.id ? `vs ${teamName(game.away)}` : `at ${teamName(game.home)}`) : null;
    const when = game ? `${game.timeValid ? `${dayName(new Date(game.date)).split(',')[0].slice(0, 3)} ${clock(new Date(game.date))}` : 'TBA'} ${vs}` : 'Idle this week';
    const sources = t.sources.slice(0, 3).map((s, i) => `<a href="${esc(s)}" target="_blank" rel="noopener">source${t.sources.length > 1 ? ` ${i + 1}` : ''}</a>`).join(' · ');
    const confidence = t.confidence === 'high' ? 'confirmed' : t.confidence === 'medium' ? 'likely' : 'unconfirmed';
    return `<li>${logoImg(t.id)}<span><strong>${esc(team.school)}</strong> <span class="flag ${t.role === 'official' ? 'good' : ''}">${ROLE_LABEL[t.role] || t.role}</span></span>
      <span class="detail">${esc(when)}</span>
      <span class="detail">${esc(confidence)}${t.lastSeen ? `, ${esc(t.lastSeen)}` : ''}${sources ? ` · ${sources}` : ''}</span>
      ${publicNote(t) ? `<span class="detail">${esc(publicNote(t))}</span>` : ''}</li>`;
  }).join('');
  return `<h3>${esc(bar.name)}</h3><div class="addr">${esc(bar.address)} · <a href="${maps}" target="_blank" rel="noopener">directions</a></div><ul>${rows}</ul><button class="popup-more" data-explore="bar:${bar.id}">All games here →</button>`;
}

function renderLegend(plan) {
  const teams = new Set([...state.teams]);
  for (const g of selectedGames()) for (const s of [g.home, g.away]) if (hasBar(s.id)) teams.add(s.id);
  const items = [...teams].filter(hasBar).slice(0, 10).map(id => `<span><i style="--team:${teamColor(id)}"></i>${esc(data.teams.get(id).school)}</span>`);
  $('map-legend').innerHTML = [...items, '<span><i></i>Other clubs</span>', plan.some(p => p.stop) ? '<span><i class="route"></i>Your route</span>' : ''].join('');
}

const routePoints = stops => [state.home.coords, ...(brunchSpot() ? [at(brunchSpot())] : []), ...stops.map(s => [s.bar.lng, s.bar.lat]),
  ...(nightcapSpot() && stops.length ? [at(nightcapSpot())] : [])];
let lastPlan = [], lastSuggestion = null, lastGeometry = null, routeVersion = 0;
async function requestRoute(points) {
  const version = ++routeVersion;
  lastGeometry = null;
  // Debounce: rapid clicks shouldn't each hit the (rate-limited) public routing server.
  await new Promise(resolve => setTimeout(resolve, 350));
  if (version !== routeVersion) return;
  const geometry = await routeGeometry(points, state.travel, data.subway, LINE_COLOR);
  if (version !== routeVersion) return; // a newer plan replaced this one
  lastGeometry = geometry;
  setRouteGeometry(geometry);
  // Light up just the lines and stations this route rides; everything else stays a ghost.
  const lines = [...new Set(geometry.rides.flatMap(r => r.lines || []))];
  const stations = [...new Map(geometry.rides.flatMap(r => r.stations || []).map(st => [st.name + st.lng, st])).values()];
  setSubwayFocus({ lines, stations });
}
function render({ fit = true } = {}) {
  renderWeekSelect();
  renderChips();
  setTravelMode(state.travel);
  const plan = planCrawl({ games: selectedGames(), barsByTeam: data.barsByTeam, home: startPoint(), pins: state.pins, splits: state.splits, favorites: state.teams, favoriteBars: state.favBars, dayGames: gamesInWeek(state.week) });
  lastPlan = plan;
  lastSuggestion = state.mode === 'auto' ? suggestion() : null;
  renderGames();
  $('suggest-options').hidden = state.mode !== 'auto';
  $('mode-note').innerHTML = state.mode === 'auto'
    ? `Planned from rankings, the line, and your teams, weighed against the walk. Ticked games below are in the plan: untick one to leave it out, tick another to work it in.${state.toggles.size ? ' <button class="alt" id="reset-edits" style="min-height:0;padding:0 4px;border:0">Reset my edits</button>' : ''}`
    : 'Tick games below. Your teams’ games start ticked. One bar per kickoff window; split any stop at halftime.';
  document.querySelectorAll('#right-tab button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === state.rightTab)));
  $('crawl-panel').hidden = state.rightTab !== 'crawl';
  $('nearby-panel').hidden = state.rightTab !== 'nearby';
  $('priority-switch').checked = state.priority === 'teams';
  $('halves-switch').checked = state.halves === 'split';
  $('priority-note').textContent = state.priority === 'teams' ? 'Your teams’ games come first' : 'Off: best matchups of the day';
  $('halves-note').textContent = state.halves === 'split' ? 'Moves when another game is as good' : 'Off: full games in one place';
  document.querySelectorAll('#mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === state.mode)));
  if (lastSuggestion) renderSuggestion(lastSuggestion); else renderCrawl(plan);
  renderDirectory();
  renderExplore();
  renderLegend(plan);
  const relevant = new Set(state.teams);
  for (const g of selectedGames()) { relevant.add(g.home.id); relevant.add(g.away.id); }
  const stops = lastSuggestion ? lastSuggestion.visits : segments(plan);
  if (lastSuggestion) for (const v of lastSuggestion.visits) for (const { game } of v.games) { relevant.add(game.home.id); relevant.add(game.away.id); }
  renderMap({
    bars: data.bars.map(bar => {
      const hit = bar.teams.find(t => state.teams.has(t.id)) || bar.teams.find(t => relevant.has(t.id));
      return { bar, active: Boolean(hit), color: hit ? teamColor(hit.id) : null };
    }),
    home: { coords: state.home.coords, label: state.home.label },
    stops: [
      ...(brunchSpot() ? [{ bar: brunchSpot(), icon: 'coffee' }] : []),
      ...stops.map((s, i) => ({ n: i + 1, bar: s.bar, color: stopColor(s) })),
      ...(nightcapSpot() && stops.length ? [{ bar: nightcapSpot(), icon: 'moon' }] : []),
    ],
    route: routePoints(stops),
    fit,
  });
  updateDirections([...(brunchSpot() ? [brunchSpot()] : []), ...stops.map(s => s.bar), ...(nightcapSpot() && stops.length ? [nightcapSpot()] : [])]);
  setSubway(data.subway, state.travel === 'train');
  document.querySelectorAll('#travel button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === state.travel)));
  requestRoute(routePoints(stops));
  $('freshness').textContent = `Schedule from ESPN as of ${new Date(data.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Kickoff times firm up about a week out.`;
  writeState();
}

function openExtra(spot) {
  if (!spot) return;
  if (matchMedia('(max-width: 760px)').matches) setPane('map');
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name}, ${spot.address}`)}`;
  const sources = spot.sources.slice(0, 2).map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">source${spot.sources.length > 1 ? ` ${i + 1}` : ''}</a>`).join(' · ');
  showPopup(spot, `<h3>${esc(spot.name)}</h3><div class="addr">${esc(spot.address)} · <a href="${maps}" target="_blank" rel="noopener">directions</a></div>
    <ul><li><span></span><span class="detail">${esc(spot.blurb || '')}</span><span class="detail">${spot.hours ? esc(spot.hours) + ' · ' : ''}${sources}</span></li></ul>`);
}

function openBar(id, icon, { keepPane = false } = {}) {
  if (icon) return openExtra(icon === 'coffee' ? brunchSpot() : nightcapSpot());
  const bar = data.barById.get(id);
  if (!bar) return;
  if (!keepPane && matchMedia('(max-width: 760px)').matches) setPane('map');
  showPopup(bar, popupHtml(bar));
}

// Phone panes. Crawl and Explore share the right sidebar on desktop but get their own tabs here.
function setPane(pane) {
  if (pane === 'crawl' || pane === 'explore') {
    const tab = pane === 'crawl' ? 'crawl' : 'nearby';
    if (state.rightTab !== tab) { state.rightTab = tab; render({ fit: false }); }
  }
  state.pane = pane;
  $('app').dataset.pane = pane;
  document.body.dataset.pane = pane;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pane === pane)));
  if (pane === 'map') requestAnimationFrame(resizeMap);
  window.scrollTo({ top: 0 });
}

// ---------- Google Maps hand-off ----------
// Google's URL scheme takes an origin, a destination and up to 9 waypoints, in order.
function directionsUrl(bars) {
  const place = bar => `${bar.name}, ${bar.address}`;
  const route = bars.filter((bar, i) => i === 0 || bar.id !== bars[i - 1].id);
  if (!route.length) return null;
  const params = new URLSearchParams({ api: '1', travelmode: { walk: 'walking', ride: 'driving', train: 'transit' }[state.travel], origin: `${state.home.coords[1]},${state.home.coords[0]}`, destination: place(route.at(-1)) });
  const waypoints = route.slice(0, -1).slice(0, 9).map(place);
  // Google drops waypoints in transit mode, so a multi-stop train crawl hands off as a walk.
  if (waypoints.length) { params.set('waypoints', waypoints.join('|')); if (state.travel === 'train') params.set('travelmode', 'walking'); }
  return `https://www.google.com/maps/dir/?${params}`;
}

function updateDirections(bars) {
  const url = directionsUrl(bars);
  $('gmaps').href = url || '#';
  $('gmaps').setAttribute('aria-disabled', String(!url));
}

// ---------- shareable image ----------
function cardData(plan) {
  const week = data.weeks.find(w => weekKey(w) === state.week);
  if (lastSuggestion) return suggestionCard(lastSuggestion, week);
  const game = g => ({ away: g.away.id, home: g.home.id, text: `${g.away.rank ? `#${g.away.rank} ` : ''}${teamName(g.away)} ${g.neutral ? 'vs' : 'at'} ${g.home.rank ? `#${g.home.rank} ` : ''}${teamName(g.home)}`, tv: g.tv[0] || '' });
  const rows = [];
  let n = 0, distance = 0, here = startPoint();
  for (const step of plan.filter(p => p.stop)) {
    const when = step.slot.tba ? 'Time TBA' : clock(step.slot.kickoff);
    for (const [segment, time] of [[step.stop, step.second ? `${when} · 1st half` : when], ...(step.second ? [[step.second, `Halftime · ${step.second.games.map(g => PART_SHORT[step.second.parts[g.id]]).join(' + ')}`]] : [])]) {
      const coords = [segment.bar.lng, segment.bar.lat];
      distance += travel(miles(here, coords)).miles;
      here = coords;
      rows.push({ n: ++n, color: stopColor(segment), time, bar: segment.bar.name, place: segment.bar.neighborhood || segment.bar.borough || '', coords, games: segment.games.map(game) });
    }
  }
  const first = plan.find(p => p.stop && !p.slot.tba)?.slot.kickoff;
  return {
    eyebrow: `NYC CFB Bar Crawler · ${week?.label ?? ''} · New York City`,
    title: first ? dayName(first) : `${week?.label ?? ''} crawl`,
    subtitle: `${rows.length} stop${rows.length === 1 ? '' : 's'} from ${state.home.label} · about ${distance.toFixed(1)} miles on foot and train`,
    footer: 'bdharva.com · NYC CFB Bar Crawler',
    home: state.home.coords,
    rows: withBookends(rows),
  };
}

function suggestionCard({ visits: vs }, week) {
  let distance = 0, here = startPoint();
  const rows = vs.map((v, i) => {
    const coords = [v.bar.lng, v.bar.lat];
    distance += travel(miles(here, coords)).miles;
    here = coords;
    return { n: i + 1, color: stopColor(v), time: `${clock(v.start)}–${clock(v.end)}`, bar: v.bar.name, place: v.bar.neighborhood || v.bar.borough || '', coords,
      games: v.games.map(({ game: g, halves }) => ({ away: g.away.id, home: g.home.id, tv: g.tv[0] || '',
        text: `${halvesLabel(halves)}: ${g.away.rank ? `#${g.away.rank} ` : ''}${teamName(g.away)} ${g.neutral ? 'vs' : 'at'} ${g.home.rank ? `#${g.home.rank} ` : ''}${teamName(g.home)}` })) };
  });
  const games = new Set(vs.flatMap(v => v.games.map(g => g.game.id))).size;
  return {
    eyebrow: `NYC CFB Bar Crawler · ${week?.label ?? ''} · Suggested day`,
    title: vs.length ? dayName(vs[0].start) : `${week?.label ?? ''} crawl`,
    subtitle: `${games} games across ${rows.length} bars from ${state.home.label} · about ${distance.toFixed(1)} mi`,
    footer: 'bdharva.com · NYC CFB Bar Crawler',
    home: state.home.coords,
    rows: withBookends(rows),
  };
}

// Brunch and nightcap rows around the bar stops, for the card.
function withBookends(rows) {
  const row = (spot, glyph, time) => ({ glyph, time, bar: spot.name, place: spot.neighborhood || '', coords: at(spot), games: [], note: spot.blurb || spot.address.split(',')[0] });
  const brunch = brunchSpot(), cap = nightcapSpot();
  return [...(brunch ? [row(brunch, 'coffee', 'Brunch · GameDay')] : []), ...rows, ...(cap && rows.length ? [row(cap, 'moon', 'Nightcap')] : [])];
}

let cardBlob = null, cardUrl = null;
async function openCard() {
  const card = cardData(lastPlan);
  if (!card.rows.length) return toast('Pick some games first. The card shows your crawl.');
  const dialog = $('card-dialog');
  $('card-img').hidden = true;
  $('card-status').hidden = false;
  $('card-status').textContent = 'Drawing your card…';
  dialog.showModal();
  try {
    cardBlob = await drawCard({ ...card, geometry: lastGeometry }, readTheme(), snapshot);
    if (cardUrl) URL.revokeObjectURL(cardUrl);
    cardUrl = URL.createObjectURL(cardBlob);
    $('card-img').src = cardUrl;
    $('card-img').hidden = false;
    $('card-status').hidden = true;
    $('card-download').href = cardUrl;
    const file = new File([cardBlob], 'nyc-cfb-bar-crawler.png', { type: 'image/png' });
    $('card-share').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    $('card-copy').hidden = !(navigator.clipboard && window.ClipboardItem);
  } catch (error) {
    console.error(error);
    $('card-status').textContent = 'Couldn’t draw the card. Try again, or copy the link instead.';
  }
}

// ---------- explore: search any team or bar ----------
const GAME_WINDOW = 4 * 3600000;
const upcomingFor = teamIds => data.games
  .filter(g => (teamIds.includes(g.home.id) || teamIds.includes(g.away.id)) && +new Date(g.date) + GAME_WINDOW > Date.now())
  .sort((a, b) => new Date(a.date) - new Date(b.date));
const weekLabel = g => data.weeks.find(w => w.week === g.week && w.seasonType === g.seasonType)?.label || '';
const when = g => `${g.timeValid ? `${dayName(new Date(g.date)).split(',')[0].slice(0, 3)} ${dayName(new Date(g.date)).split(', ')[1]} · ${clock(new Date(g.date))}` : `${dayName(new Date(g.date)).split(', ')[1]} · time TBA`}`;
const CONFIDENCE_WORD = { high: 'confirmed', medium: 'likely', low: 'unconfirmed' };
// `notes` are for maintainers (how a bar was researched). Visitors see only `publicNote`, an optional
// one-line field the research brief asks for; structured role, confidence and sources carry the rest.
const publicNote = entry => entry?.publicNote || '';
const sourceLinks = sources => sources.slice(0, 3).map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">source${sources.length > 1 ? ` ${i + 1}` : ''}</a>`).join(' · ');

// ---------- adding a game from Explore, with conflict handling ----------
const MINUTE = 60000;
const OVERLAP_PROMPT = 180; // minutes between kickoffs below which adding a game asks how to handle it
const kickoff = g => +new Date(g.date);
const gameWeek = g => `${g.seasonType}-${g.week}`;
const matchupText = g => `${teamName(g.away)} ${g.neutral ? 'vs' : 'at'} ${teamName(g.home)}`;

// Is this game in the crawl you're looking at?
function inCrawl(g) {
  if (gameWeek(g) !== state.week) return false;
  if (state.mode === 'auto') return (lastSuggestion?.visits || []).some(v => v.games.some(x => x.game.id === g.id));
  return isSelected(g);
}

function addButton(g, barId) {
  if (g.home.id < 0 || g.away.id < 0) return '';
  const here = inCrawl(g);
  return `<button class="alt add-game ${here ? 'added' : ''}" data-add="${g.id}" data-at="${barId || ''}" data-remove="${here ? '1' : ''}">${here ? 'In crawl ✓' : gameWeek(g) === state.week ? 'Add' : 'Plan it'}</button>`;
}

// Selected (or planned) games whose broadcast windows overlap this one's. TBA times can't be judged.
function overlapping(g) {
  if (!g.timeValid) return [];
  const others = state.mode === 'auto'
    ? [...new Map((lastSuggestion?.visits || []).flatMap(v => v.games.map(x => [x.game.id, x.game]))).values()]
    : selectedGames();
  // A small tail overlap (a 4:15 game against a 7:30 kickoff) just means leaving early; the crawl notes it.
  return others.filter(o => o.id !== g.id && o.timeValid && Math.abs(kickoff(o) - kickoff(g)) < OVERLAP_PROMPT * MINUTE);
}

const setTick = (g, on) => {
  if (state.mode === 'auto') { state.toggles.set(g.id, on); return; }
  const byTeam = state.teams.has(g.home.id) || state.teams.has(g.away.id);
  if (on === byTeam) state.toggles.delete(g.id); else state.toggles.set(g.id, on);
};

// Lock a game's halves at a bar in suggest mode (the bar from context, or its nearest bar).
function lockAt(g, barId, halves) {
  const bar = barId || barsForGame(g, data.barsByTeam).map(o => o.bar).sort((a, b) => miles(startPoint(), at(a)) - miles(startPoint(), at(b)))[0]?.id;
  if (!bar) return;
  const keys = halves.map(h => `${g.id}:${h}:${bar}`);
  state.locks = [...state.locks.filter(k => !k.startsWith(`${g.id}:`)), ...keys];
}

function applyAdd(g, barId, choice, conflicts = []) {
  const [earlier, later] = [g, ...conflicts].sort((a, b) => kickoff(a) - kickoff(b));
  switch (choice) {
    case 'replace': conflicts.forEach(c => { setTick(c, false); delete state.pins[c.id]; }); setTick(g, true); if (barId) state.pins[g.id] = barId; break;
    case 'split':
      setTick(g, true);
      if (barId && g === earlier) state.pins[g.id] = barId;
      // Move at the earlier game's halftime to the later game (at this bar if it's the later one).
      state.splits[earlier.id] = g === later && barId ? barId : 'auto';
      break;
    case 'whole': setTick(g, true); lockAt(g, barId, state.halves === 'full' ? [0] : [1, 2]); break;
    case 'first': setTick(g, true); lockAt(g, barId, [1]); break;
    case 'second': setTick(g, true); lockAt(g, barId, [2]); break;
    default: setTick(g, true); if (barId && state.mode !== 'auto') state.pins[g.id] = barId; if (barId && state.mode === 'auto') lockAt(g, barId, state.halves === 'full' ? [0] : [1, 2]);
  }
  render({ fit: false });
  toast(`Added ${matchupText(g)} to your crawl.`);
}

function removeGame(g) {
  setTick(g, false);
  delete state.pins[g.id];
  state.locks = state.locks.filter(k => !k.startsWith(`${g.id}:`));
  render({ fit: false });
  toast(`Took ${matchupText(g)} out of your crawl.`);
}

function choose({ eyebrow = 'ADD TO YOUR CRAWL', title, body, choices, compare = '' }) {
  $('conflict-eyebrow').textContent = eyebrow;
  $('conflict-title').textContent = title;
  $('conflict-body').textContent = body;
  $('conflict-compare').innerHTML = compare;
  $('conflict-choices').innerHTML = choices.map((c, i) => `<button class="choice ${c.recommended ? 'recommended' : ''}" data-choice="${i}"><strong>${esc(c.label)}</strong><span>${esc(c.detail)}</span></button>`).join('');
  $('conflict-dialog').onclick = event => {
    const pick = event.target.closest('[data-choice]');
    if (pick) { $('conflict-dialog').close(); choices[Number(pick.dataset.choice)].run(); }
    else if (event.target === $('conflict-dialog') || event.target.closest('#conflict-cancel, #conflict-close')) $('conflict-dialog').close();
  };
  $('conflict-dialog').showModal();
}

// Where a game sits in the current crawl: bar and which part, for the comparison cards.
function whereInCrawl(g) {
  if (state.mode === 'auto') {
    return (lastSuggestion?.visits || []).flatMap(v => v.games.filter(x => x.game.id === g.id).map(x => `${halvesLabel(x.halves)} at ${v.bar.name}`)).join(', ');
  }
  const out = [];
  for (const step of lastPlan.filter(p => p.stop)) {
    if (step.stop.games.includes(g)) out.push(`${step.second ? '1st half' : 'Full game'} at ${step.stop.bar.name}`);
    if (step.second?.games.includes(g)) out.push(`${PART_SHORT[step.second.parts[g.id]]} at ${step.second.bar.name}`);
    if (step.elsewhere?.includes(g)) out.push('Also on in this window, at no stop yet');
  }
  return out.join(', ');
}

function whyInCrawl(g) {
  const mine = [g.home, g.away].filter(s => state.teams.has(s.id)).map(s => teamName(s));
  if (mine.length) return `Your team: ${mine.join(' and ')}`;
  if (state.toggles.get(g.id)) return 'You picked it';
  return state.mode === 'auto' ? 'The planner picked it' : '';
}

// The color a game wears in the dialog: your team, else the team whose bar you're adding it at, else any team with a bar.
function gameTeam(g, barId = null) {
  const sides = [g.home, g.away];
  const barTeams = barId ? data.barById.get(barId).teams.map(t => t.id) : [];
  return sides.find(s => state.teams.has(s.id))?.id || sides.find(s => barTeams.includes(s.id))?.id || sides.find(s => hasBar(s.id))?.id || g.home.id;
}

function compareCard(g, { adding = false, barId = null } = {}) {
  const start = new Date(g.date), end = new Date(+start + GAME_HOURS * 3600000);
  const team = gameTeam(g, adding ? barId : null);
  let where;
  if (adding) {
    const nearestBar = barId ? data.barById.get(barId) : barsForGame(g, data.barsByTeam).map(o => o.bar).sort((a, b) => miles(startPoint(), at(a)) - miles(startPoint(), at(b)))[0];
    where = nearestBar ? `${barId ? 'At' : 'Nearest bar:'} <b>${esc(nearestBar.name)}</b>` : 'No NYC alumni bar';
  } else {
    where = whereInCrawl(g) ? `<b>${esc(whereInCrawl(g))}</b>` : '';
  }
  const why = adding ? '' : whyInCrawl(g);
  const facts = [`${esc(clock(start))}–${esc(clock(end))}`, g.tv[0] && esc(g.tv.join(' / ')), g.line && esc(g.line)].filter(Boolean).join(' · ');
  return `<div class="cgame ${adding ? 'adding' : ''}" style="--team:${teamColor(team)}"><div>
    <div class="cstate">${adding ? 'Adding' : 'In your crawl'}${why ? ` · ${esc(why)}` : ''}</div>
    <div class="cmatch">${logoImg(g.away.id)}${rankOf(g.away)} ${esc(teamName(g.away))} <span class="rank">${g.neutral ? 'vs' : 'at'}</span> ${logoImg(g.home.id)}${rankOf(g.home)} ${esc(teamName(g.home))}</div>
    <div class="cmeta">${facts}</div>
    ${where ? `<div class="cmeta">${where}</div>` : ''}</div></div>`;
}

// Both broadcast windows on one axis, halftimes marked, the overlap hatched.
function timeline(games, barId = null, addingId = null) {
  const starts = games.map(kickoff), ends = starts.map(t => t + GAME_HOURS * 3600000);
  const t0 = Math.min(...starts), t1 = Math.max(...ends), pct = t => ((t - t0) / (t1 - t0)) * 100;
  const tracks = games.map((g, i) => {
    const team = gameTeam(g, g.id === addingId ? barId : null);
    return `<div class="track" style="--team:${teamColor(team)}"><span class="span" style="left:${pct(starts[i])}%;right:${100 - pct(ends[i])}%"></span><span class="half" style="left:${pct(starts[i] + HALFTIME_AT * MINUTE)}%"></span><span class="half" style="left:${pct(starts[i] + (HALFTIME_AT + HALFTIME_BREAK) * MINUTE)}%"></span></div>`;
  }).join('');
  const lo = Math.max(...starts), hi = Math.min(...ends);
  const overlap = hi > lo ? `<span class="overlap" style="left:${pct(lo)}%;right:${100 - pct(hi)}%"></span>` : '';
  const ticks = [];
  for (let t = Math.ceil(t0 / 3600000) * 3600000; t <= t1; t += 3600000) ticks.push(`<span class="tick" style="left:${pct(t)}%">${esc(clock(new Date(t)))}</span>`);
  return `<div class="timeline" aria-hidden="true">${overlap}${tracks}${ticks.join('')}</div>`;
}

function addGame(gameId, barId) {
  const g = data.games.find(x => x.id === gameId);
  const barName = barId ? data.barById.get(barId).name : null;
  if (gameWeek(g) !== state.week) {
    const label = weekLabel(g);
    return choose({
      eyebrow: 'A DIFFERENT WEEK', title: `${matchupText(g)} is in ${label}`,
      body: `Your crawl is planned one week at a time. Switch to ${label} to build around this game? Your picks for the current week will be cleared.`,
      choices: [{ label: `Switch to ${label} and add it`, detail: barName ? `Starts a ${label} crawl with this game at ${barName}.` : `Starts a ${label} crawl with this game.`, recommended: true,
        run: () => { state.week = gameWeek(g); state.toggles.clear(); state.pins = {}; state.splits = {}; state.locks = []; applyAdd(g, barId, 'add'); } }],
    });
  }
  const conflicts = overlapping(g);
  if (!conflicts.length) return applyAdd(g, barId, 'add');
  const names = conflicts.map(matchupText).join(' and ');
  const gap = Math.round(Math.abs(kickoff(conflicts[0]) - kickoff(g)) / MINUTE);
  const [earlier, later] = [g, conflicts[0]].sort((a, b) => kickoff(a) - kickoff(b));
  // Matches what planCrawl can do at halftime: join a game from the same kickoff window (<= 45 min apart),
  // or one kicking off around the earlier game's halftime (75-130 min later, per crawl.js's joinable window).
  const lagMinutes = (kickoff(later) - kickoff(earlier)) / MINUTE;
  const splitFits = conflicts.length === 1 && (lagMinutes <= 45 || (lagMinutes >= 75 && lagMinutes <= 130));
  const where = barName ? ` at ${barName}` : '';
  const choices = state.mode === 'auto' ? [
    { label: 'Work it in', detail: 'The planner rebuilds your day with this game in it and decides which halves go where.', recommended: true, run: () => applyAdd(g, barId, 'work-in', conflicts) },
    { label: `Whole game${where}`, detail: `Pin all of it${where}; the rest of the day replans around it.`, run: () => applyAdd(g, barId, 'whole', conflicts) },
    ...(state.halves === 'full' ? [] : [
      { label: `Just the 1st half${where}`, detail: 'Pin the first half here, then keep the rest of your plan.', run: () => applyAdd(g, barId, 'first', conflicts) },
      { label: `Just the 2nd half${where}`, detail: 'Finish the earlier game, then catch this one after halftime.', run: () => applyAdd(g, barId, 'second', conflicts) },
    ]),
  ] : [
    ...(splitFits ? [{ label: 'Split at halftime', detail: `First half of ${matchupText(earlier)}, then move for the second half of ${matchupText(later)}${later === g && barName ? ` at ${barName}` : ''}.`, recommended: true, run: () => applyAdd(g, barId, 'split', conflicts) }] : []),
    { label: `Replace ${conflicts.length > 1 ? 'those games' : matchupText(conflicts[0])}`, detail: `Watch ${matchupText(g)}${where} instead.`, recommended: !splitFits, run: () => applyAdd(g, barId, 'replace', conflicts) },
    { label: 'Keep both', detail: lagMinutes <= 45
      ? 'Both stay in your crawl; that window gets one bar, and the other game is listed as also on.'
      : 'Add it as its own stop; you’ll leave the earlier game before it ends.', run: () => applyAdd(g, barId, 'add', conflicts) },
  ];
  const ordered = [g, ...conflicts].sort((a, b) => kickoff(a) - kickoff(b));
  choose({
    compare: `<div class="compare">${conflicts.map(c => compareCard(c)).join('')}${compareCard(g, { adding: true, barId })}${timeline(ordered, barId, g.id)}</div>`,
    eyebrow: 'THESE OVERLAP',
    title: `${matchupText(g)} overlaps ${names}`,
    body: `Kickoffs are ${gap < 60 ? `${gap} minutes` : `${(gap / 60).toFixed(1).replace('.0', '')} hours`} apart, and a game runs about ${GAME_HOURS} hours. How do you want to handle it?`,
    choices,
  });
}

function exploreResults(q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return '';
  const teams = [...data.teams.values()].filter(t => `${t.school} ${t.mascot} ${t.abbr}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.school.toLowerCase().startsWith(needle) - a.school.toLowerCase().startsWith(needle)) || a.school.localeCompare(b.school)).slice(0, 8);
  const bars = data.bars.filter(b => `${b.name} ${b.neighborhood || ''} ${b.address}`.toLowerCase().includes(needle)).slice(0, 8);
  const extras = ['brunch', 'nightcaps'].flatMap(kind => data.extras[kind].filter(x => `${x.name} ${x.neighborhood || ''}`.toLowerCase().includes(needle)).map(x => ({ kind, x }))).slice(0, 5);
  const teamRows = teams.map(t => {
    const n = (data.barsByTeam.get(t.id) || []).length;
    return `<li><button data-explore="team:${t.id}">${logoImg(t.id)}<span class="rname">${esc(t.school)}</span><span class="rtag">${n ? `${n} bar${n > 1 ? 's' : ''}` : 'no bar yet'}</span><span class="rmeta">${esc(t.conf)}</span></button></li>`;
  }).join('');
  const barRows = bars.map(b => `<li><button data-explore="bar:${b.id}"><span class="logos">${logoImg(b.teams[0].id)}</span><span class="rname">${esc(b.name)}${state.favBars.has(b.id) ? ' ★' : ''}</span><span class="rtag">${b.teams.length} club${b.teams.length > 1 ? 's' : ''}</span><span class="rmeta">${esc(b.teams.map(t => data.teams.get(t.id).school).join(', '))} · ${esc(b.neighborhood || '')}</span></button></li>`).join('');
  const extraRows = extras.map(({ kind, x }) => `<li><button data-explore="${kind}:${x.id}"><svg class="icon glyph"><use href="#icon-${kind === 'brunch' ? 'coffee' : 'moon'}"/></svg><span class="rname">${esc(x.name)}</span><span class="rtag">${kind === 'brunch' ? 'brunch' : 'nightcap'}</span><span class="rmeta">${esc(x.neighborhood || '')}</span></button></li>`).join('');
  const html = [teamRows && `<li class="group">Teams</li>${teamRows}`, barRows && `<li class="group">Bars</li>${barRows}`, extraRows && `<li class="group">Brunch and nightcaps</li>${extraRows}`].filter(Boolean).join('');
  return html ? `<ul class="results">${html}</ul>` : `<p class="empty">Nothing matches “${esc(q)}”.</p>`;
}

function teamDetail(id) {
  const t = data.teams.get(id);
  const club = data.clubs.find(c => c.team === id);
  const bars = (data.barsByTeam.get(id) || []).map(bar => ({ bar, entry: bar.teams.find(x => x.id === id), d: miles(state.home.coords, at(bar)) })).sort((a, b) => a.d - b.d);
  const mine = state.teams.has(id);
  const barList = bars.map(({ bar, entry, d }) => `<li>${logoImg(id)}<span class="dtitle"><button data-explore="bar:${bar.id}">${esc(bar.name)}</button> <span class="flag ${entry.role === 'official' ? 'good' : ''}">${ROLE_LABEL[entry.role] || entry.role}</span></span>
    <span class="dsub">${esc(bar.address.split(',')[0])} · ${esc(bar.neighborhood || '')} · ${d.toFixed(1)} mi from ${esc(state.home.label)}</span>
    <span class="dsub">${esc(CONFIDENCE_WORD[entry.confidence] || entry.confidence)}${entry.lastSeen ? `, ${esc(entry.lastSeen)}` : ''}${entry.sources.length ? ` · ${sourceLinks(entry.sources)}` : ''}</span>
    ${publicNote(entry) ? `<span class="dsub">${esc(publicNote(entry))}</span>` : ''}</li>`).join('');
  const games = upcomingFor([id]).slice(0, 14).map(g => {
    const home = g.home.id === id, opp = home ? g.away : g.home;
    const current = `${g.seasonType}-${g.week}` === state.week;
    return `<li class="${current ? 'current' : ''}">${logoImg(opp.id)}${addButton(g, null)}<span class="dtitle">${home ? 'vs' : g.neutral ? 'vs' : 'at'} ${rankOf(opp)} ${esc(teamName(opp))}</span><span class="dsub">${esc(weekLabel(g))} · ${esc(when(g))}${g.tv.length ? ` · ${esc(g.tv.join(' / '))}` : ''}${g.line ? ` · ${esc(g.line)}` : ''}</span></li>`;
  }).join('');
  return `<div class="detail-head"><img class="biglogo" src="${logo(id, 88)}" alt="" width="44" height="44"><div><div class="eyebrow">${esc(t.conf)}</div><h2>${esc(t.school)} ${esc(t.mascot)}</h2><p>${club?.club ? (club.url ? `<a href="${esc(club.url)}" target="_blank" rel="noopener">${esc(club.club)}</a>` : esc(club.club)) : 'No NYC alumni club found yet'}</p></div></div>
    <div class="detail-actions"><button data-myteam="${id}">${mine ? 'Remove from my teams' : 'Add to my teams'}</button></div>
    <div class="detail-section"><span class="eyebrow">NYC BARS${bars.length ? ', NEAREST FIRST' : ''}</span>${barList ? `<ul class="detail-list">${barList}</ul>` : `<p class="detail-note">No game-watch bar on file yet.${club?.publicNote ? ` ${esc(club.publicNote)}` : ''}</p>`}</div>
    <div class="detail-section"><span class="eyebrow">REST OF THE SCHEDULE</span>${games ? `<ul class="detail-list">${games}</ul>` : '<p class="detail-note">No games left this season.</p>'}</div>`;
}

function barDetail(id) {
  const bar = data.barById.get(id);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${bar.name}, ${bar.address}`)}`;
  const clubs = bar.teams.map(t => `<li>${logoImg(t.id)}<span class="dtitle"><button data-explore="team:${t.id}">${esc(data.teams.get(t.id).school)}</button> <span class="flag ${t.role === 'official' ? 'good' : ''}">${ROLE_LABEL[t.role] || t.role}</span></span>
    <span class="dsub">${t.club ? `${esc(t.club)} · ` : ''}${esc(CONFIDENCE_WORD[t.confidence] || t.confidence)}${t.lastSeen ? `, ${esc(t.lastSeen)}` : ''}${t.sources.length ? ` · ${sourceLinks(t.sources)}` : ''}</span>
    ${publicNote(t) ? `<span class="dsub">${esc(publicNote(t))}</span>` : ''}</li>`).join('');
  const ids = bar.teams.map(t => t.id);
  const games = upcomingFor(ids).slice(0, 16).map(g => {
    const club = ids.includes(g.home.id) ? g.home : g.away;
    const current = `${g.seasonType}-${g.week}` === state.week;
    return `<li class="${current ? 'current' : ''}">${logoImg(club.id)}${addButton(g, bar.id)}<span class="dtitle">${rankOf(g.away)} ${esc(teamName(g.away))} ${g.neutral ? 'vs' : 'at'} ${rankOf(g.home)} ${esc(teamName(g.home))}</span><span class="dsub">${esc(weekLabel(g))} · ${esc(when(g))}${g.tv.length ? ` · ${esc(g.tv.join(' / '))}` : ''}</span></li>`;
  }).join('');
  return `<div class="detail-head"><div><div class="eyebrow">${esc(bar.neighborhood || bar.borough || '')}</div><h2>${esc(bar.name)}</h2><p>${esc(bar.address)} · ${miles(state.home.coords, at(bar)).toFixed(1)} mi from ${esc(state.home.label)}</p></div></div>
    <div class="detail-actions"><button data-favtoggle="${bar.id}" class="${state.favBars.has(bar.id) ? 'armed' : ''}" aria-pressed="${state.favBars.has(bar.id)}"><svg class="icon"><use href="#icon-star"/></svg>${state.favBars.has(bar.id) ? 'Saved' : 'Save as favorite'}</button><button data-showbar="${bar.id}"><svg class="icon"><use href="#icon-map"/></svg>Show on map</button><a class="button" href="${maps}" target="_blank" rel="noopener"><svg class="icon"><use href="#icon-nav"/></svg>Directions</a></div>
    <div class="detail-section"><span class="eyebrow">HOME TO</span><ul class="detail-list">${clubs}</ul></div>
    <div class="detail-section"><span class="eyebrow">GAMES HERE, REST OF THE SEASON</span>${games ? `<ul class="detail-list">${games}</ul>` : '<p class="detail-note">No games left this season.</p>'}</div>`;
}

function extraDetail(kind, id) {
  const x = data.extras[kind].find(e => e.id === id);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${x.name}, ${x.address}`)}`;
  const chosen = kind === 'brunch' ? state.brunch === id : state.nightcap === id;
  return `<div class="detail-head"><div><div class="eyebrow">${kind === 'brunch' ? 'BRUNCH · GAMEDAY' : 'NIGHTCAP'} · ${esc(x.neighborhood || '')}</div><h2>${esc(x.name)}</h2><p>${esc(x.address)}${x.hours ? ` · ${kind === 'brunch' ? 'opens' : 'open till'} ${esc(x.hours)}` : ''}</p></div></div>
    <div class="detail-actions"><button data-${kind === 'brunch' ? 'brunch' : 'nightcap'}="${chosen ? '' : id}">${chosen ? 'Remove from my crawl' : `Add as my ${kind === 'brunch' ? 'brunch' : 'nightcap'}`}</button><a class="button" href="${maps}" target="_blank" rel="noopener"><svg class="icon"><use href="#icon-nav"/></svg>Directions</a></div>
    <p class="detail-note">${esc(x.blurb || '')}</p><p class="detail-note">${sourceLinks(x.sources)}</p>`;
}

function renderExplore() {
  const { q, view } = state.explore;
  if ($('explore-search').value !== q) $('explore-search').value = q;
  const back = `<button class="detail-back" data-explore-back><svg class="icon"><use href="#icon-left"/></svg>${q ? 'Results' : 'Nearby spots'}</button>`;
  let detail = '';
  if (view?.kind === 'team' && data.teams.has(view.id)) detail = teamDetail(view.id);
  else if (view?.kind === 'bar' && data.barById.has(view.id)) detail = barDetail(view.id);
  else if (view && data.extras[view.kind]?.some(x => x.id === view.id)) detail = extraDetail(view.kind, view.id);
  $('explore-detail').hidden = !detail;
  $('explore-detail').innerHTML = detail ? back + detail : '';
  $('explore-results').hidden = Boolean(detail) || !q.trim();
  $('explore-results').innerHTML = detail ? '' : exploreResults(q);
  $('explore-home').hidden = Boolean(detail) || Boolean(q.trim());
}

function openExplore(view = null, { focus = false } = {}) {
  state.rightTab = 'nearby';
  if (view) state.explore.view = view;
  if (matchMedia('(max-width: 760px)').matches) setPane('explore');
  render({ fit: false });
  if (focus) $('explore-search').focus();
}

// ---------- setup: your teams (first visit, then behind the gear) ----------
function markSetupSeen() { try { localStorage.setItem('nycCfbBarCrawler.setup', '1'); } catch {} }
function setupSeen() { try { return localStorage.getItem('nycCfbBarCrawler.setup') === '1'; } catch { return true; } }
function openSetup() {
  renderFavoriteBars();
  state.search = '';
  $('team-search').value = '';
  renderTeams();
  renderChips();
  $('setup-dialog').showModal();
}
function closeSetup() {
  markSetupSeen();
  $('setup-dialog').close();
  render();
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2200);
}

function setHome(home) {
  state.home = home;
  renderHomeSelect();
  render();
}

// ---------- events ----------
function bind() {
  $('week').addEventListener('change', event => { state.week = event.target.value; state.toggles.clear(); state.pins = {}; state.splits = {}; state.locks = []; render(); });
  for (const [id, step] of [['week-prev', -1], ['week-next', 1]]) $(id).addEventListener('click', () => {
    const select = $('week'), i = select.selectedIndex + step;
    if (i < 0 || i >= select.options.length) return;
    select.selectedIndex = i;
    select.dispatchEvent(new Event('change'));
  });
  $('home').addEventListener('change', event => { const n = findNeighborhood(event.target.value); if (n) setHome(n); });
  $('locate').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Location isn’t available in this browser.');
    navigator.geolocation.getCurrentPosition(
      p => setHome({ label: 'Your location', coords: [p.coords.longitude, p.coords.latitude] }),
      () => toast('Couldn’t get your location. Pick a neighborhood or drop a pin.'),
      { enableHighAccuracy: false, timeout: 10000 });
  });
  $('pick').addEventListener('click', () => {
    const armed = $('pick').getAttribute('aria-pressed') !== 'true';
    $('pick').setAttribute('aria-pressed', String(armed));
    $('pick').classList.toggle('armed', armed);
    setPicking(armed);
    if (armed) { toast('Tap the map where you’re starting.'); if (matchMedia('(max-width: 760px)').matches) setPane('map'); }
  });
  $('team-search').addEventListener('input', event => { state.search = event.target.value; renderTeams(); });
  $('team-list').addEventListener('change', event => {
    const id = event.target.dataset.team;
    if (!id) return;
    event.target.checked ? state.teams.add(id) : state.teams.delete(id);
    render();
  });
  $('my-teams').addEventListener('click', event => {
    const chip = event.target.closest('[data-team]');
    if (!chip) return;
    state.teams.delete(chip.dataset.team);
    renderTeams();
    render();
  });
  $('games').addEventListener('change', event => {
    const id = event.target.dataset.game;
    if (!id) return;
    const game = data.games.find(g => g.id === id);
    if (state.mode === 'auto') {
      // Untick = leave it out of the plan; tick = work it in.
      state.toggles.set(id, event.target.checked);
      render({ fit: false });
      return;
    }
    const byTeam = state.teams.has(game.home.id) || state.teams.has(game.away.id);
    // Only remember a toggle when it differs from what your teams imply.
    if (event.target.checked === byTeam) state.toggles.delete(id); else state.toggles.set(id, event.target.checked);
    render();
  });
  $('slate-filter').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    state.filter = button.dataset.value;
    $('slate-filter').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    renderGames();
  });
  // Remember which "Other options" panels are open; the list re-renders on every change.
  $('crawl').addEventListener('toggle', event => {
    const key = event.target.dataset?.key;
    if (key) event.target.open ? state.openSwaps.add(key) : state.openSwaps.delete(key);
  }, true);
  $('crawl').addEventListener('click', event => {
    const pin = event.target.closest('[data-pin]'), unpin = event.target.closest('[data-unpin]'), bar = event.target.closest('[data-bar]');
    const split = event.target.closest('[data-split]'), unsplit = event.target.closest('[data-unsplit]');
    const brunch = event.target.closest('[data-brunch]'), nightcap = event.target.closest('[data-nightcap]'), extra = event.target.closest('[data-extra]');
    const lock = event.target.closest('[data-lock]'), unlock = event.target.closest('[data-unlock]');
    if (lock) {
      const replaced = new Set(lock.dataset.replace.split(','));
      state.locks = [...state.locks.filter(k => !replaced.has(k)), ...lock.dataset.lock.split(',')];
      render({ fit: false });
    }
    else if (unlock) { const keys = new Set(unlock.dataset.unlock.split(',')); state.locks = state.locks.filter(k => !keys.has(k)); render({ fit: false }); }
    else if (brunch) { state.brunch = brunch.dataset.brunch || null; render({ fit: true }); }
    else if (nightcap) { state.nightcap = nightcap.dataset.nightcap || null; render({ fit: true }); }
    else if (extra) { const [kind, id] = extra.dataset.extra.split(':'); openExtra(data.extras[kind].find(x => x.id === id)); }
    else if (split) { state.splits[split.dataset.split] = split.dataset.to; render({ fit: false }); }
    else if (unsplit) { delete state.splits[unsplit.dataset.unsplit]; render({ fit: false }); }
    else if (pin) { for (const g of pin.dataset.games.split(',')) state.pins[g] = pin.dataset.pin; render({ fit: false }); }
    else if (unpin) { for (const g of unpin.dataset.unpin.split(',')) delete state.pins[g]; render({ fit: false }); }
    else if (bar) openBar(bar.dataset.bar);
  });
  $('directory').addEventListener('click', event => { const li = event.target.closest('[data-bar]'); if (li) { state.explore.view = { kind: 'bar', id: li.dataset.bar }; renderExplore(); openBar(li.dataset.bar, null, { keepPane: true }); } });
  $('explore-search').addEventListener('input', event => { state.explore = { q: event.target.value, view: null }; renderExplore(); });
  // The map popup lives outside the panel; its "All games here" opens the bar in Explore.
  $('map').addEventListener('click', event => {
    const go = event.target.closest('.bar-popup [data-explore]');
    if (go) { const [kind, id] = go.dataset.explore.split(':'); openExplore({ kind, id }); }
  });
  $('search-open').addEventListener('click', () => openExplore(null, { focus: true }));
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) && !document.querySelector('dialog[open]')) { event.preventDefault(); openExplore(null, { focus: true }); }
  });
  $('nearby-panel').addEventListener('click', event => {
    const go = event.target.closest('[data-explore]'), back = event.target.closest('[data-explore-back]');
    const myteam = event.target.closest('[data-myteam]'), show = event.target.closest('[data-showbar]');
    const brunch = event.target.closest('[data-brunch]'), nightcap = event.target.closest('[data-nightcap]');
    const add = event.target.closest('[data-add]'), fav = event.target.closest('[data-favtoggle]');
    if (fav) toggleFavBar(fav.dataset.favtoggle);
    else if (add) {
      const g = data.games.find(x => x.id === add.dataset.add);
      if (add.dataset.remove) removeGame(g); else addGame(g.id, add.dataset.at || null);
    }
    else if (go) { const [kind, id] = go.dataset.explore.split(':'); state.explore.view = { kind, id }; renderExplore(); $('nearby-panel').scrollIntoView({ block: 'start' }); $('app').querySelector('.crawl').scrollTop = 0; }
    else if (back) { state.explore.view = null; renderExplore(); }
    else if (myteam) { const id = myteam.dataset.myteam; state.teams.has(id) ? state.teams.delete(id) : state.teams.add(id); renderTeams(); render({ fit: false }); }
    else if (show) openBar(show.dataset.showbar);
    else if (brunch) { state.brunch = brunch.dataset.brunch || null; render(); }
    else if (nightcap) { state.nightcap = nightcap.dataset.nightcap || null; render(); }
  });
  document.querySelector('.tabs').addEventListener('click', event => { const b = event.target.closest('button'); if (b) setPane(b.dataset.pane); });
  $('info').addEventListener('click', () => $('info-dialog').showModal());
  $('settings').addEventListener('click', openSetup);
  $('setup-tab').addEventListener('click', event => { const b = event.target.closest('button'); if (b) { state.setupTab = b.dataset.value; renderFavoriteBars(); } });
  $('bar-search').addEventListener('input', event => { state.barSearch = event.target.value; renderFavoriteBars(); });
  $('bar-list').addEventListener('change', event => { const id = event.target.dataset.favbar; if (id) { toggleFavBar(id, event.target.checked); renderFavoriteBars(); } });
  $('my-bars').addEventListener('click', event => { const chip = event.target.closest('[data-unfav]'); if (chip) { toggleFavBar(chip.dataset.unfav, false); renderFavoriteBars(); } });
  $('mode-note').addEventListener('click', event => { if (event.target.id === 'reset-edits') { state.toggles.clear(); state.locks = []; render({ fit: false }); } });
  for (const id of ['setup-done', 'setup-skip', 'setup-close']) $(id).addEventListener('click', closeSetup);
  $('setup-dialog').addEventListener('cancel', () => markSetupSeen());
  $('setup-week').addEventListener('change', event => { $('week').value = event.target.value; $('week').dispatchEvent(new Event('change')); });
  $('right-tab').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) { state.rightTab = button.dataset.value; render({ fit: false }); }
  });
  // Crossing the phone breakpoint: show the pane that matches the sidebar tab you were on.
  matchMedia('(max-width: 760px)').addEventListener('change', event => {
    if (event.matches && state.pane === 'crawl' && state.rightTab === 'nearby') setPane('explore');
  });
  $('info-close').addEventListener('click', () => $('info-dialog').close());
  $('info-dialog').addEventListener('click', event => { if (event.target === $('info-dialog')) $('info-dialog').close(); });
  $('share-card').addEventListener('click', openCard);
  $('priority-switch').addEventListener('change', event => { state.priority = event.target.checked ? 'teams' : 'matchups'; render(); });
  $('halves-switch').addEventListener('change', event => { state.halves = event.target.checked ? 'split' : 'full'; render(); });
  $('travel').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) { state.travel = button.dataset.value; render({ fit: false }); }
  });
  $('mode').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    state.mode = button.dataset.value;
    render();
  });
  $('card-close').addEventListener('click', () => $('card-dialog').close());
  $('card-dialog').addEventListener('click', event => { if (event.target === $('card-dialog')) $('card-dialog').close(); });
  $('card-share').addEventListener('click', async () => {
    const file = new File([cardBlob], 'nyc-cfb-bar-crawler.png', { type: 'image/png' });
    try { await navigator.share({ files: [file], title: 'NYC CFB Bar Crawler', text: 'Saturday crawl', url: location.href }); }
    catch (error) { if (error.name !== 'AbortError') toast('Sharing didn’t work here. Try Download.'); }
  });
  $('card-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': cardBlob })]); toast('Image copied.'); }
    catch { toast('Couldn’t copy the image here. Try Download.'); }
  });
  $('share').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Link copied. It opens this exact crawl.'); }
    catch { toast('Copy the address bar to share this crawl.'); }
  });
}

// ---------- boot ----------
async function load() {
  const [teams, schedule, bars, subway, extras] = await Promise.all(['data/teams.json', 'data/schedule.json', 'data/bars.json', 'data/subway.json', 'data/extras.json'].map(p => fetch(p).then(r => r.json())));
  data.subway = subway;
  data.extras = extras;
  data.season = schedule.season;
  data.updated = schedule.updated;
  data.weeks = schedule.weeks;
  data.games = schedule.games;
  for (const t of teams.teams) data.teams.set(t.id, t);
  data.bars = bars.bars;
  data.clubs = bars.clubs;
  for (const bar of data.bars) {
    bar.roles = Object.fromEntries(bar.teams.map(t => [t.id, t.role]));
    data.barById.set(bar.id, bar);
    for (const t of bar.teams) {
      if (!data.barsByTeam.has(t.id)) data.barsByTeam.set(t.id, []);
      data.barsByTeam.get(t.id).push(bar);
    }
  }
  const schools = data.barsByTeam.size;
  $('season-label').textContent = data.season;
  $('coverage').textContent = `${data.bars.length} BARS · ${schools} OF ${data.teams.size} SCHOOLS`;
  const upcoming = data.games.filter(g => +new Date(g.date) > Date.now() && g.home.id > 0).length;
  $('info-stats').innerHTML = [[data.bars.length, 'NYC bars'], [schools, `of ${data.teams.size} FBS clubs`], [upcoming, 'games to go']]
    .map(([n, label]) => `<div><strong>${n}</strong><span>${label}</span></div>`).join('');
}

async function main() {
  await load();
  readState();
  bind();
  renderHomeSelect();
  renderTeams();
  initTheme(theme => { setMapTheme(theme); render({ fit: false }); });
  initMap(readTheme(), { onBar: openBar, onPick: coords => {
    $('pick').setAttribute('aria-pressed', 'false');
    $('pick').classList.remove('armed');
    setHome({ label: 'Dropped pin', coords });
  } });
  render();
  if (!state.teams.size && !setupSeen() && !new URLSearchParams(location.hash.slice(1)).has('t')) openSetup();
}

main().catch(error => {
  console.error(error);
  $('coverage').textContent = 'COULDN’T LOAD DATA';
});
