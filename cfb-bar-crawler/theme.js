// Palette values live in CSS; the map reads the same tokens.
export function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const token = name => css.getPropertyValue(`--${name}`).trim();
  return {
    dark: document.documentElement.classList.contains('dark'),
    paper: token('bg'), ink: token('text'), muted: token('muted'), caption: token('caption'),
    accent: token('accent'), accentDeep: token('accent-deep'), faint: token('bar-faint'),
    mapLand: token('map-land'), mapWater: token('map-water'), mapRoad: token('map-road'),
    mapPark: token('map-park'), mapBuilding: token('map-building'),
  };
}

export function initTheme(onChange) {
  const toggle = document.getElementById('darkToggle'), query = matchMedia('(prefers-color-scheme: dark)');
  let explicit = false;
  try { explicit = localStorage.getItem('darkMode') !== null; } catch {}
  const setMeta = () => { document.querySelector('meta[name="theme-color"]').content = readTheme().paper; };
  function apply(dark) {
    document.documentElement.classList.toggle('dark', dark);
    toggle.checked = dark;
    setMeta();
    onChange(readTheme());
  }
  toggle.checked = document.documentElement.classList.contains('dark');
  setMeta();
  toggle.addEventListener('change', () => {
    explicit = true;
    try { localStorage.setItem('darkMode', String(toggle.checked)); } catch {}
    apply(toggle.checked);
  });
  query.addEventListener('change', event => { if (!explicit) apply(event.matches); });
}
