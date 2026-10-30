import {routeColor} from './flight-model.js';
const arcCache=new WeakMap();
// D3 is vendored locally. Geographic clipping keeps land and routes behind the globe hidden.
export function drawGlobe(canvas,world,airports,history,current,progress,view,style,palette) {
  const d3=globalThis.d3, ctx=canvas.getContext('2d'),w=canvas.clientWidth||canvas.width,h=canvas.clientHeight||canvas.height;
  const ratio=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const radius=Math.min(w,h)*.405*view.zoom;
  const projection=d3.geoOrthographic().translate([w/2,h/2]).scale(radius).rotate([-view.lon,-view.lat]).clipAngle(90);
  const path=d3.geoPath(projection,ctx);
  ctx.beginPath();path({type:'Sphere'});ctx.fillStyle=palette.mapWater;ctx.fill();ctx.strokeStyle=palette.ring;ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();path(world);ctx.fillStyle=palette.mapLand;ctx.fill();ctx.strokeStyle=palette.home;ctx.lineWidth=.45;ctx.stroke();
  // The large lakes the world's land fills in (the Great Lakes among them), as water.
  if(style.lakes){ctx.beginPath();path(style.lakes);ctx.fillStyle=palette.mapWater;ctx.fill();ctx.strokeStyle=palette.home;ctx.lineWidth=.45;ctx.stroke();}
  if(style.states){ctx.beginPath();path(style.states);ctx.strokeStyle=palette.home;ctx.lineWidth=.45;ctx.stroke();}
  if(style.grid){ctx.beginPath();path(d3.geoGraticule10());ctx.strokeStyle=palette.home;ctx.globalAlpha=.3;ctx.lineWidth=.5;ctx.stroke();ctx.globalAlpha=1;}
  const visible=p=>d3.geoDistance([view.lon,view.lat],p)<Math.PI/2;
  const projectArc=(a,b,t)=>{let arc=arcCache.get(a)?.get(b);if(!arc){arc={interpolate:d3.geoInterpolate(a,b),distance:Math.min(1,d3.geoDistance(a,b))};if(!arcCache.has(a))arcCache.set(a,new WeakMap());arcCache.get(a).set(b,arc);}const point=arc.interpolate(t),xy=projection(point);const lift=1+Math.sin(Math.PI*t)*style.height*arc.distance;return {point,xy:[w/2+(xy[0]-w/2)*lift,h/2+(xy[1]-h/2)*lift]};};
  function arc(f,until,alpha,width){
    const a=airports[f.origin].coordinates,b=airports[f.destination].coordinates;
    ctx.beginPath();let open=false;
    for(let i=0;i<=80;i++){const t=until*i/80,{point,xy}=projectArc(a,b,t);if(visible(point)){if(!open)ctx.moveTo(...xy);else ctx.lineTo(...xy);open=true;}else open=false;}
    ctx.globalAlpha=alpha;ctx.strokeStyle=routeColor(f,style.color,palette.dark);ctx.lineWidth=width;ctx.stroke();ctx.globalAlpha=1;
  }
  for(const f of history)arc(f,1,style.opacity,style.width);
  if(current){arc(current,1,.17,style.width);arc(current,progress,1,style.width+1);const {point,xy}=projectArc(airports[current.origin].coordinates,airports[current.destination].coordinates,progress);if(visible(point)){ctx.beginPath();ctx.arc(...xy,4,0,Math.PI*2);ctx.fillStyle=palette.dark?'#fff':'#17382f';ctx.fill();ctx.beginPath();ctx.arc(...xy,9,0,Math.PI*2);ctx.strokeStyle='#1ec896';ctx.globalAlpha=.5;ctx.stroke();ctx.globalAlpha=1;}}
  const used=new Set(history.flatMap(f=>[f.origin,f.destination]));if(current){used.add(current.origin);used.add(current.destination);}
  const targets=[];ctx.font='10px "JetBrains Mono", monospace';
  for(const code of used){const point=airports[code].coordinates;if(!visible(point))continue;const xy=projection(point),active=current&&(code===current.origin||code===current.destination);ctx.beginPath();ctx.arc(...xy,active?3.5:2,0,Math.PI*2);ctx.fillStyle=active?'#1ec896':palette.muted;ctx.fill();targets.push({code,x:xy[0],y:xy[1]});if(active||style.labels){ctx.fillStyle=palette.ink;ctx.fillText(code,xy[0]+7,xy[1]-7);}}
  return targets;
}
