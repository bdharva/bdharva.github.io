// MapLibre basemap (OpenFreeMap Positron, restyled from CSS tokens), bars, home and the crawl route.
const MAPLIBRE = 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';
const NYC = [-73.985, 40.742];
let lib, map, ready = false, theme, pending = null, popup, rawStyle = null;
let homeMarker = null, stopMarkers = [], picking = false, handlers = {};
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const OURS = ['bars', 'bars-active', 'route', 'route-casing', 'route-train', 'route-train-casing', 'subway-lines', 'subway-stations'];
let subwayData = null, subwayOn = false;

function layerPaint(layer) {
  if (layer.type === 'background') return { 'background-color': theme.mapLand };
  if (layer.type === 'fill') return {
    'fill-color': /water/.test(layer.id) ? theme.mapWater : /park|wood|grass|landcover/.test(layer.id) ? theme.mapPark
      : /building/.test(layer.id) ? theme.mapBuilding : theme.mapLand,
    'fill-outline-color': theme.mapBuilding,
  };
  if (layer.type === 'line') return { 'line-color': /water/.test(layer.id) ? theme.mapWater : /boundary/.test(layer.id) ? theme.caption : theme.mapRoad };
  if (layer.type === 'symbol' && layer.layout?.['text-field']) return { 'text-color': theme.muted, 'text-halo-color': theme.mapLand };
  return {};
}

export function setMapTheme(next) {
  theme = next;
  if (!ready) return;
  for (const layer of map.getStyle().layers) {
    if (OURS.includes(layer.id)) continue;
    for (const [property, value] of Object.entries(layerPaint(layer))) map.setPaintProperty(layer.id, property, value);
  }
  map.setPaintProperty('bars', 'circle-color', theme.faint);
  map.setPaintProperty('bars', 'circle-stroke-color', theme.paper);
  map.setPaintProperty('bars-active', 'circle-stroke-color', theme.paper);
  map.setPaintProperty('route', 'line-color', theme.accentDeep);
  map.setPaintProperty('route-casing', 'line-color', theme.paper);
  map.setPaintProperty('route-train-casing', 'line-color', theme.paper);
  map.setPaintProperty('subway-stations', 'circle-color', theme.paper);
}

/** Replace the straight-line route with street/subway geometry: { walk: [coords…], rides: [{ coords, color }] }. */
let routeGeometryPending = null;
export function setRouteGeometry(geometry) {
  // Routing can finish before the map's first load; keep it and apply on load (renderMap would
  // otherwise leave the straight-line placeholder in place).
  routeGeometryPending = geometry;
  if (!ready) return;
  const line = (coords, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: coords } });
  map.getSource('route').setData(collection(geometry.walk.filter(c => c.length > 1).map(c => line(c))));
  map.getSource('route-train').setData(collection(geometry.rides.map(r => line(r.coords, { color: r.color }))));
}

export function setSubway(data, visible) {
  subwayData = data;
  subwayOn = visible;
  if (!ready || !data) return;
  map.getSource('subway-lines').setData(data.lines);
  for (const id of ['subway-lines', 'subway-stations']) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  setSubwayFocus(subwayFocus);
}

// Only the lines and stations your route uses are drawn at strength; the rest of the system is a faint ghost.
let subwayFocus = { lines: [], stations: [] };
export function setSubwayFocus(focus) {
  subwayFocus = focus;
  if (!ready || !subwayData) return;
  const used = ['in', ['get', 'service'], ['literal', focus.lines]];
  // Lines you ride get a soft tint (the ridden stretch itself is drawn bold by the route layer).
  map.setPaintProperty('subway-lines', 'line-opacity', ['case', used, 0.3, 0.07]);
  map.setPaintProperty('subway-lines', 'line-width', ['case', used, ['interpolate', ['linear'], ['zoom'], 11, 1.5, 15, 3], ['interpolate', ['linear'], ['zoom'], 11, 0.8, 15, 1.5]]);
  map.getSource('subway-stations').setData(collection(focus.stations.map(s => point([s.lng, s.lat], { name: s.name, lines: s.lines.join(' ') }))));
}

const collection = features => ({ type: 'FeatureCollection', features });
const point = (coords, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: coords } });

/**
 * scene = { bars: [{bar, color, active}], home: {coords, label}, stops: [{n, bar, color}], route: [[lng,lat],…], fit }
 */
export function renderMap(scene) {
  pending = scene;
  if (!ready) return;
  const faint = scene.bars.filter(b => !b.active), active = scene.bars.filter(b => b.active);
  map.getSource('bars').setData(collection(faint.map(({ bar }) => point([bar.lng, bar.lat], { id: bar.id }))));
  map.getSource('bars-active').setData(collection(active.map(({ bar, color }) => point([bar.lng, bar.lat], { id: bar.id, color }))));
  routeGeometryPending = null; // a new scene's geometry is on its way
  map.getSource('route').setData(collection(scene.route.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: scene.route } }] : []));
  map.getSource('route-train').setData(collection([]));

  homeMarker?.remove();
  homeMarker = null;
  if (scene.home) {
    const el = document.createElement('div');
    el.className = 'home-marker';
    el.title = `Start: ${scene.home.label}`;
    el.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-home"/></svg>';
    homeMarker = new lib.Marker({ element: el }).setLngLat(scene.home.coords).addTo(map);
  }
  stopMarkers.forEach(m => m.remove());
  stopMarkers = scene.stops.map(({ n, bar, color, icon }) => {
    const el = document.createElement('button');
    el.className = icon ? 'stop-marker bookend' : 'stop-marker';
    if (color) el.style.setProperty('--team', color);
    if (icon) el.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#icon-${icon}"/></svg>`;
    else el.textContent = n;
    el.setAttribute('aria-label', icon ? bar.name : `Stop ${n}: ${bar.name}`);
    el.addEventListener('click', event => { event.stopPropagation(); handlers.onBar?.(bar.id, icon); });
    return new lib.Marker({ element: el }).setLngLat([bar.lng, bar.lat]).addTo(map);
  });
  if (scene.fit) fitTo(scene);
}

function fitTo(scene) {
  const coords = [...scene.stops.map(s => [s.bar.lng, s.bar.lat]), ...(scene.home ? [scene.home.coords] : [])];
  const pool = coords.length > 1 ? coords : [...coords, ...scene.bars.filter(b => b.active).map(({ bar }) => [bar.lng, bar.lat])];
  if (pool.length < 2) return;
  const lng = pool.map(p => p[0]), lat = pool.map(p => p[1]);
  map.fitBounds([[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]],
    { padding: 56, maxZoom: 15, duration: reducedMotion() ? 0 : 700 });
}

export function showPopup(bar, html) {
  if (!ready) return;
  popup?.remove();
  popup = new lib.Popup({ offset: 14, maxWidth: '300px', className: 'bar-popup' }).setLngLat([bar.lng, bar.lat]).setHTML(html).addTo(map);
  map.easeTo({ center: [bar.lng, bar.lat], duration: reducedMotion() ? 0 : 500 });
}

export function setPicking(on) {
  picking = on;
  if (ready) map.getCanvas().style.cursor = on ? 'crosshair' : '';
}

export function resizeMap() { if (ready) map.resize(); }

/**
 * Render the basemap framed on `coords` in a throwaway, off-screen map and return it as an image,
 * plus a projector from [lng, lat] to pixels in that image. Works even when the visible map is hidden
 * (the phone layout). Resolves null if the map library or tiles are unavailable.
 */
export async function snapshot({ coords, width, height, theme: look, padding = 70 }) {
  if (!lib || !rawStyle || coords.length === 0) return null;
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '-20000px', top: '0', width: `${width}px`, height: `${height}px` });
  document.body.append(host);
  const previous = theme;
  theme = look;
  const style = JSON.parse(rawStyle);
  for (const layer of style.layers) {
    layer.paint ??= {};
    Object.assign(layer.paint, layerPaint(layer));
    if (layer.type === 'symbol' && /poi|housenumber|shield/.test(layer.id)) (layer.layout ??= {}).visibility = 'none';
  }
  theme = previous;
  const lng = coords.map(c => c[0]), lat = coords.map(c => c[1]);
  const bounds = [[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]];
  const shot = new lib.Map({ container: host, style, bounds, fitBoundsOptions: { padding, maxZoom: 15.5 }, pixelRatio: 1,
    interactive: false, attributionControl: false, fadeDuration: 0, canvasContextAttributes: { preserveDrawingBuffer: true } });
  try {
    await new Promise((resolve, reject) => { shot.once('idle', resolve); setTimeout(() => reject(new Error('snapshot timed out')), 12000); });
    const image = new Image();
    image.src = shot.getCanvas().toDataURL('image/png');
    await image.decode();
    return { image, project: c => { const p = shot.project(c); return [p.x, p.y]; } };
  } catch (error) {
    console.warn('Map snapshot failed:', error);
    return null;
  } finally {
    shot.remove();
    host.remove();
  }
}

export async function initMap(initialTheme, callbacks) {
  theme = initialTheme;
  handlers = callbacks;
  const status = document.getElementById('map-status');
  try {
    lib = await import(MAPLIBRE);
    const response = await fetch('https://tiles.openfreemap.org/styles/positron');
    if (!response.ok) throw new Error('Map style unavailable');
    const style = await response.json();
    rawStyle = JSON.stringify(style);
    // Paint the basemap in the page theme before first render, so dark mode doesn't flash white.
    for (const layer of style.layers) {
      layer.paint ??= {};
      Object.assign(layer.paint, layerPaint(layer));
      if (layer.type === 'symbol' && /poi|housenumber|shield/.test(layer.id)) (layer.layout ??= {}).visibility = 'none';
    }
    map = new lib.Map({ container: 'map', style, center: NYC, zoom: 12.2, attributionControl: { compact: true } });
    map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
    new ResizeObserver(() => { if (ready) map.resize(); }).observe(document.getElementById('map'));
    map.on('load', () => {
      status.remove();
      for (const id of ['bars', 'bars-active', 'route', 'route-train', 'subway-lines', 'subway-stations']) map.addSource(id, { type: 'geojson', data: collection([]) });
      map.addLayer({ id: 'subway-lines', type: 'line', source: 'subway-lines', layout: { visibility: 'none', 'line-cap': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 15, 3], 'line-opacity': 0.55 } });
      map.addLayer({ id: 'subway-stations', type: 'circle', source: 'subway-stations', layout: { visibility: 'none' },
        paint: { 'circle-color': theme.paper, 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': theme.ink } });
      map.addLayer({ id: 'route-train-casing', type: 'line', source: 'route-train', layout: { 'line-cap': 'round' },
        paint: { 'line-color': theme.paper, 'line-width': 9 } });
      map.addLayer({ id: 'route-train', type: 'line', source: 'route-train', layout: { 'line-cap': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 5 } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': theme.paper, 'line-width': 6, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': theme.accentDeep, 'line-width': 2.5, 'line-dasharray': [1.5, 1.5] } });
      map.addLayer({ id: 'bars', type: 'circle', source: 'bars',
        paint: { 'circle-color': theme.faint, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 6],
          'circle-stroke-width': 1, 'circle-stroke-color': theme.paper } });
      map.addLayer({ id: 'bars-active', type: 'circle', source: 'bars-active',
        paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 15, 9],
          'circle-stroke-width': 2, 'circle-stroke-color': theme.paper } });
      for (const layer of ['bars', 'bars-active']) {
        map.on('click', layer, event => { if (!picking) handlers.onBar?.(event.features[0].properties.id); });
        map.on('mouseenter', layer, () => { if (!picking) map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { if (!picking) map.getCanvas().style.cursor = ''; });
      }
      map.on('click', event => {
        if (!picking) return;
        setPicking(false);
        handlers.onPick?.([event.lngLat.lng, event.lngLat.lat]);
      });
      ready = true;
      setMapTheme(theme);
      if (subwayData) setSubway(subwayData, subwayOn);
      map.on('click', 'subway-stations', event => {
        if (picking) return;
        const { name, lines } = event.features[0].properties;
        popup?.remove();
        popup = new lib.Popup({ offset: 8, className: 'bar-popup' }).setLngLat(event.lngLat)
          .setHTML(`<h3>${name.replace(/[<>&]/g, '')}</h3><div class="addr">${lines.replace(/[<>&]/g, '')}</div>`).addTo(map);
      });
      const geometry = routeGeometryPending;
      if (pending) renderMap({ ...pending, fit: true });
      if (geometry) setRouteGeometry(geometry);
    });
    map.on('error', event => { if (!ready) status.textContent = 'The map service is unavailable. The crawl list still works.'; console.warn(event.error); });
  } catch (error) {
    status.textContent = 'Map unavailable offline. The crawl list still works.';
    console.warn('Map unavailable:', error);
  }
}
