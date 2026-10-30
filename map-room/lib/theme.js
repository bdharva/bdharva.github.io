// Palette values live in CSS; Canvas and the map use the same theme tokens.
export function readTheme() {
  const css=getComputedStyle(document.documentElement);
  const token=name=>css.getPropertyValue(`--${name}`).trim();
  return {
    dark:document.documentElement.classList.contains('dark'),
    paper:token('bg'),ink:token('text'),muted:token('muted'),ring:token('plot-ring'),home:token('plot-home'),
    oneInk:token('plot-ink'),groups:[token('group-0'),token('group-1')],
    mapLand:token('map-land'),mapWater:token('map-water'),mapRoad:token('map-road'),mapPark:token('map-park'),mapBuilding:token('map-building')
  };
}
export function initTheme(onChange) {
  const toggle=document.getElementById('darkToggle'),query=matchMedia('(prefers-color-scheme: dark)');
  let explicit=false;
  try{explicit=localStorage.getItem('darkMode')!==null;}catch{}
  function apply(dark) {
    document.documentElement.classList.toggle('dark',dark);toggle.checked=dark;
    document.querySelector('meta[name="theme-color"]').content=readTheme().paper;
    onChange(readTheme());
  }
  toggle.checked=document.documentElement.classList.contains('dark');
  document.querySelector('meta[name="theme-color"]').content=readTheme().paper;
  toggle.addEventListener('change',()=>{explicit=true;try{localStorage.setItem('darkMode',String(toggle.checked));}catch{}apply(toggle.checked);});
  query.addEventListener('change',event=>{if(!explicit)apply(event.matches);});
}
