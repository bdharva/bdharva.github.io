// Draws the shareable PNG card: title, route map, and the numbered agenda. Pure canvas.
const W = 1080, PAD = 64, ROW = 128, MAP_MIN = 420;
const SANS = "'DM Sans', system-ui, sans-serif", MONO = "'JetBrains Mono', ui-monospace, monospace";

const logoCache = new Map();
function logo(id) {
  if (!(Number(id) > 0)) return Promise.resolve(null);
  if (!logoCache.has(id)) {
    logoCache.set(id, new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${id}.png&w=96&h=96&card=1`;
    }));
  }
  return logoCache.get(id);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fitText(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function marker(ctx, [x, y], label, fill, paper, r = 22) {
  ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fillStyle = paper; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.round(r * 0.95)}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 1);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// Bookend markers: a coffee cup (brunch) or crescent moon (nightcap), drawn as vectors.
function bookend(ctx, [x, y], glyph, ink, paper, r = 22) {
  ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fillStyle = paper; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  ctx.strokeStyle = paper; ctx.fillStyle = paper; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  const k = r / 22;
  if (glyph === 'moon') {
    ctx.beginPath(); ctx.arc(x, y, 10 * k, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 5 * k, y - 4 * k, 9 * k, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  } else {
    ctx.beginPath(); ctx.roundRect(x - 9 * k, y - 6 * k, 13 * k, 13 * k, 3 * k); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 5 * k, y + 0.5 * k, 4 * k, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  }
}

function homeGlyph(ctx, [x, y], ink, paper) {
  ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fillStyle = paper; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  ctx.strokeStyle = paper; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - 9, y - 1); ctx.lineTo(x, y - 9); ctx.lineTo(x + 9, y - 1); ctx.lineTo(x + 9, y + 9); ctx.lineTo(x - 9, y + 9); ctx.closePath(); ctx.stroke();
}

/**
 * card = { eyebrow, title, subtitle, footer, home: [lng, lat], rows: [{ n, color, time, bar, place, coords, games: [{ away, home, text, tv }] }] }
 * look = theme tokens from readTheme(); snapshot = async ({coords, width, height, theme}) => {image, project} | null
 */
export async function drawCard(card, look, snapshot) {
  await document.fonts.ready;
  const rows = card.rows;
  const listH = rows.length * ROW + 24;
  const headH = 250, footH = 100;
  const mapH = Math.max(MAP_MIN, 1350 - headH - listH - footH);
  const H = headH + mapH + listH + footH;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const ink = look.dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,5,10,0.9)';
  const muted = look.dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,5,10,0.6)';
  const caption = look.dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,5,10,0.45)';
  const rule = look.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,5,10,0.08)';

  ctx.fillStyle = look.paper; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = look.accent; ctx.fillRect(0, 0, W, 8);

  // Heading
  ctx.fillStyle = caption; ctx.font = `500 22px ${MONO}`;
  ctx.fillText(card.eyebrow.toUpperCase(), PAD, PAD + 42);
  ctx.fillStyle = ink; ctx.font = `600 64px ${SANS}`;
  ctx.fillText(fitText(ctx, card.title, W - PAD * 2), PAD, PAD + 118);
  ctx.fillStyle = muted; ctx.font = `400 30px ${SANS}`;
  ctx.fillText(fitText(ctx, card.subtitle, W - PAD * 2), PAD, PAD + 166);

  // Map
  const mapY = headH, mapW = W - PAD * 2;
  const coords = [card.home, ...rows.map(r => r.coords)];
  const shot = await snapshot({ coords, width: mapW, height: mapH, theme: look });
  ctx.save();
  roundRect(ctx, PAD, mapY, mapW, mapH, 18); ctx.clip();
  let project;
  if (shot) {
    ctx.drawImage(shot.image, PAD, mapY, mapW, mapH);
    project = c => { const [x, y] = shot.project(c); return [PAD + x, mapY + y]; };
  } else {
    // Schematic fallback: plain panel, points scaled into it.
    ctx.fillStyle = look.mapLand; ctx.fillRect(PAD, mapY, mapW, mapH);
    const lng = coords.map(c => c[0]), lat = coords.map(c => c[1]);
    const [x0, x1, y0, y1] = [Math.min(...lng), Math.max(...lng), Math.min(...lat), Math.max(...lat)];
    const k = Math.min((mapW - 160) / Math.max(x1 - x0, 1e-4) / 0.76, (mapH - 160) / Math.max(y1 - y0, 1e-4));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    project = ([x, y]) => [PAD + mapW / 2 + (x - cx) * k * 0.76, mapY + mapH / 2 - (y - cy) * k];
  }
  const points = coords.map(project);
  // Street-following geometry when we have it (walk paths dashed, subway rides solid in line color).
  const walks = card.geometry?.walk?.length ? card.geometry.walk.map(line => line.map(project)) : [points];
  const rides = (card.geometry?.rides || []).map(r => ({ color: r.color, line: r.coords.map(project) }));
  const stroke = (line, color, width, dash = []) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    ctx.beginPath(); line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const line of walks) stroke(line, look.paper, 11);
  for (const r of rides) stroke(r.line, look.paper, 15);
  for (const line of walks) stroke(line, look.accentDeep, 5, [12, 12]);
  for (const r of rides) stroke(r.line, r.color, 9);
  ctx.setLineDash([]);
  homeGlyph(ctx, points[0], ink, look.paper);
  // Draw later stops first so stop 1 sits on top where they overlap.
  rows.map((r, i) => [r, points[i + 1]]).reverse().forEach(([r, p]) => (r.glyph ? bookend(ctx, p, r.glyph, ink, look.paper) : marker(ctx, p, String(r.n), r.color, look.paper)));
  ctx.restore();
  ctx.strokeStyle = rule; ctx.lineWidth = 2; roundRect(ctx, PAD, mapY, mapW, mapH, 18); ctx.stroke();

  // Agenda: two lines per stop. Bar name with the time range right-aligned, then the matchup with the
  // neighborhood right-aligned.
  let y = mapY + mapH + 24;
  const right = W - PAD;
  for (const row of rows) {
    ctx.strokeStyle = rule; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(right, y); ctx.stroke();
    const mid = y + ROW / 2 + 2;
    if (row.glyph) bookend(ctx, [PAD + 26, mid], row.glyph, ink, look.paper, 24);
    else marker(ctx, [PAD + 26, mid], String(row.n), row.color, look.paper, 24);
    const x = PAD + 78, line1 = y + 54, line2 = y + 96;

    ctx.textAlign = 'right';
    ctx.fillStyle = caption; ctx.font = `500 20px ${MONO}`;
    const time = row.time.toUpperCase();
    const timeW = ctx.measureText(time).width;
    ctx.fillText(time, right, line1);
    ctx.font = `400 20px ${SANS}`;
    const place = fitText(ctx, row.place, 300);
    const placeW = place ? ctx.measureText(place).width : 0;
    ctx.fillText(place, right, line2);
    ctx.textAlign = 'left';

    ctx.fillStyle = ink; ctx.font = `600 34px ${SANS}`;
    ctx.fillText(fitText(ctx, row.bar, right - x - timeW - 32), x, line1);

    // The first game gets logos; the rest are named after it, as room allows.
    const game = row.games[0];
    ctx.fillStyle = muted; ctx.font = `400 23px ${SANS}`;
    if (!game && row.note) ctx.fillText(fitText(ctx, row.note, right - x - placeW - 32), x, line2);
    if (game) {
      let gx = x;
      for (const id of [game.away, game.home]) {
        const img = await logo(id);
        if (img) ctx.drawImage(img, gx, line2 - 23, 28, 28);
        gx += 32;
      }
      gx += 6;
      ctx.fillStyle = muted; ctx.font = `400 23px ${SANS}`;
      const room = right - gx - placeW - 32;
      const all = row.games.map((g, i) => `${g.text}${i === 0 && g.tv ? ` · ${g.tv}` : ''}`).join(' + ');
      const text = ctx.measureText(all).width <= room ? all
        : `${game.text}${game.tv ? ` · ${game.tv}` : ''}${row.games.length > 1 ? ` + ${row.games.length - 1} more` : ''}`;
      ctx.fillText(fitText(ctx, text, room), gx, line2);
    }
    y += ROW;
  }

  // Footer
  const fy = H - footH + 40;
  ctx.strokeStyle = rule; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, fy - 34); ctx.lineTo(W - PAD, fy - 34); ctx.stroke();
  ctx.fillStyle = look.accentDeep; ctx.font = `500 22px ${MONO}`;
  ctx.fillText(card.footer.toUpperCase(), PAD, fy + 4);
  ctx.fillStyle = caption; ctx.font = `400 16px ${SANS}`;
  const credit = '© OpenFreeMap © OpenStreetMap contributors';
  ctx.fillText(credit, W - PAD - ctx.measureText(credit).width, fy + 2);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
