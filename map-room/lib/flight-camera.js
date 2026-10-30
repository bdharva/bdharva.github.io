// Camera math is separate from playback: all extents use the renderer's actual
// orthographic projection, including its decorative arc lift and viewport ratio.
export function fitRouteWindow(flights, airports, index, {neighbors=2,height=.2,width=1000,viewportHeight=700,maxZoom=5}={}, geo=globalThis.d3) {
  const active=flights[index];
  if(!active)return {lon:-65,lat:35,zoom:1};
  const routes=flights.slice(Math.max(0,index-neighbors),index+neighbors+1);
  const sample=f=>{const a=airports[f.origin].coordinates,b=airports[f.destination].coordinates;
    const interpolate=geo.geoInterpolate(a,b),distance=Math.min(1,geo.geoDistance(a,b));
    return Array.from({length:33},(_,i)=>({point:interpolate(i/32),lift:1+Math.sin(Math.PI*i/32)*height*distance}));};
  const activePoints=sample(active),points=routes.flatMap(sample);
  let center=geo.geoCentroid({type:'MultiPoint',coordinates:points.map(p=>p.point)});
  // A worldwide window may not fit one hemisphere. Keep the active flight in
  // view instead of allowing unrelated routes to turn it behind the globe.
  if(!center.every(Number.isFinite)||activePoints.some(p=>geo.geoDistance(center,p.point)>Math.PI*.48))
    center=geo.geoInterpolate(airports[active.origin].coordinates,airports[active.destination].coordinates)(.5);
  const projection=geo.geoOrthographic().translate([0,0]).scale(1).rotate([-center[0],-center[1]]);
  let x=.01,y=.01,wide=false;
  for(const p of points){if(geo.geoDistance(center,p.point)>Math.PI*.48){wide=true;continue;}const xy=projection(p.point);x=Math.max(x,Math.abs(xy[0]*p.lift));y=Math.max(y,Math.abs(xy[1]*p.lift));}
  const radius=Math.min(width,viewportHeight)*.405;
  const zoom=Math.max(.65,Math.min(maxZoom,width*.40/(radius*x),viewportHeight*.36/(radius*y),wide?.9:Infinity));
  return {lon:center[0],lat:center[1],zoom};
}
export function blendFrames(a,b,t,geo=globalThis.d3){
  const eased=t*t*(3-2*t),center=geo.geoInterpolate([a.lon,a.lat],[b.lon,b.lat])(eased);
  return {lon:center[0],lat:center[1],zoom:Math.exp(Math.log(a.zoom)*(1-eased)+Math.log(b.zoom)*eased)};
}
export function easeCamera(view,goal,dt,seconds=2,geo=globalThis.d3){
  const center=geo.geoInterpolate([view.lon,view.lat],[goal.lon,goal.lat])(1-Math.exp(-dt/seconds));
  // Pull out more readily; drift inward more slowly. Zoom is multiplicative,
  // so the same perceived speed applies close up and at the whole-globe scale.
  const tau=seconds*(goal.zoom<view.zoom?.65:1.3);
  const delta=(Math.log(goal.zoom)-Math.log(view.zoom))*(1-Math.exp(-dt/tau));
  const bounded=Math.max(-dt*.45,Math.min(dt*.3,delta));
  return {lon:center[0],lat:center[1],zoom:view.zoom*Math.exp(bounded)};
}
