import {globeRadius,projector,unproject} from './counties-camera.js';
// Counties live on the same globe as Flights. Their outlines are projected for
// the current view and kept until the view changes; only counties near the
// frame are projected at all.
// stateLines: simplified state borders for the wide view; borders: the full-resolution
// ones (stateBorders), drawn once county lines show so the two agree.
export function createScene(counties,world,stateLines,borders=null,lakes=null){
  const d3=globalThis.d3,items=[],byId=new Map();
  for(const feature of counties){
    const center=d3.geoCentroid(feature),bounds=d3.geoBounds(feature);
    if(!center.every(Number.isFinite))continue;
    // Angular reach: the farthest corner of the bounding box from the centroid.
    const reach=Math.max(...[[bounds[0][0],bounds[0][1]],[bounds[1][0],bounds[1][1]],[bounds[0][0],bounds[1][1]],[bounds[1][0],bounds[0][1]]].map(corner=>d3.geoDistance(center,corner)));
    const item={id:feature.id,name:feature.properties.name,feature,center,bounds,reach};
    items.push(item);byId.set(item.id,item);
  }
  return {items,byId,world,stateLines,borders,lakes,key:'',paths:new Map(),all:null};
}
function inBounds([[west,south],[east,north]],[lon,lat]){
  // A box that crosses the antimeridian has its west edge east of its east edge.
  return lat>=south&&lat<=north&&(west<=east?lon>=west&&lon<=east:lon>=west||lon<=east);
}
export function countyAt(scene,view,width,height,x,y){
  const point=unproject(view,width,height,x,y);
  if(!point)return null;
  for(const item of scene.items)if(inBounds(item.bounds,point)&&globalThis.d3.geoContains(item.feature,point))return item.id;
  return null;
}
function outlines(scene,view,w,h,projection,project){
  const key=[view.lon.toFixed(5),view.lat.toFixed(5),view.zoom.toFixed(5),w,h].join('|');
  if(key===scene.key)return;
  const d3=globalThis.d3,R=globeRadius(view,w,h),path=d3.geoPath(projection);
  scene.key=key;scene.paths=new Map();scene.all=new Path2D();
  for(const item of scene.items){
    const p=project(...item.center),pad=item.reach*R+4;
    // Skip what is behind the globe or outside the frame.
    if(!p){if(item.reach<.2)continue;}
    else if(p[0]<-pad||p[1]<-pad||p[0]>w+pad||p[1]>h+pad)continue;
    const outline=new Path2D();path.context(outline)(item.feature);
    scene.paths.set(item.id,outline);scene.all.addPath(outline);
  }
}
// frame: {fills:Map fips→color, today:[fips], selected, peaks:[{at:[lon,lat],done,fresh}], markers:[{label,color,point:[lon,lat],trail:[[lon,lat]…]}],
//         dots:{lonlat:Float32Array, lo, hi, today} for check-in rows lo…hi, today's from `today`}
export function drawCounties(canvas,scene,view,frame,style,palette){
  const d3=globalThis.d3,ctx=canvas.getContext('2d'),w=canvas.clientWidth||canvas.width,h=canvas.clientHeight||canvas.height;
  const ratio=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const R=globeRadius(view,w,h),project=projector(view,w,h);
  const projection=d3.geoOrthographic().translate([w/2,h/2]).scale(R).rotate([-view.lon,-view.lat]).clipAngle(90).clipExtent([[-60,-60],[w+60,h+60]]);
  const path=d3.geoPath(projection,ctx);
  // The same globe as Flights: water, the world's land, a faint graticule.
  ctx.beginPath();path({type:'Sphere'});ctx.fillStyle=palette.mapWater;ctx.fill();ctx.strokeStyle=palette.ring;ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();path(scene.world);ctx.fillStyle=palette.mapLand;ctx.fill();ctx.strokeStyle=palette.home;ctx.lineWidth=.45;ctx.stroke();
  ctx.beginPath();path(d3.geoGraticule10());ctx.strokeStyle=palette.home;ctx.globalAlpha=.3;ctx.lineWidth=.5;ctx.stroke();ctx.globalAlpha=1;
  outlines(scene,view,w,h,projection,project);
  ctx.lineJoin='round';
  for(const [id,color]of frame.fills){const outline=scene.paths.get(id);if(outline){ctx.fillStyle=color;ctx.fill(outline);}}
  // The large lakes the world's land fills in (the Great Lakes among them), as water.
  if(scene.lakes){ctx.beginPath();path(scene.lakes);ctx.fillStyle=palette.mapWater;ctx.fill();ctx.strokeStyle=palette.home;ctx.lineWidth=.45;ctx.stroke();}
  // County lines fade out when counties are only a few pixels across.
  const fine=Math.min(1,Math.max(0,(view.zoom-1.6)/1.6));
  if(style.borders&&fine>0){ctx.strokeStyle=palette.ring;ctx.globalAlpha=fine;ctx.lineWidth=.5;ctx.stroke(scene.all);ctx.globalAlpha=1;}
  const states=fine>0&&scene.borders||scene.stateLines;
  if(states){ctx.beginPath();path(states);ctx.strokeStyle=palette.home;ctx.lineWidth=.9;ctx.stroke();}
  for(const id of frame.today){const outline=scene.paths.get(id);if(outline){ctx.strokeStyle=palette.ink;ctx.lineWidth=1.4;ctx.stroke(outline);}}
  // State highpoints: a ring, filled once climbed, cased in the surface colour to stand
  // off any fill; the one just climbed gets a second ring while the record passes it.
  if(frame.peaks?.length){
    const r=Math.max(2.6,Math.min(4.2,1.5*Math.sqrt(view.zoom)));
    for(const {at,done,fresh}of frame.peaks){
      const p=project(...at);if(!p||p[0]<-10||p[1]<-10||p[0]>w+10||p[1]>h+10)continue;
      ctx.beginPath();ctx.arc(p[0],p[1],r+1.6,0,Math.PI*2);ctx.fillStyle=palette.paper;ctx.globalAlpha=.9;ctx.fill();ctx.globalAlpha=1;
      ctx.beginPath();ctx.arc(p[0],p[1],done?r:r-.6,0,Math.PI*2);
      if(done){ctx.fillStyle=palette.ink;ctx.fill();}else{ctx.strokeStyle=palette.ink;ctx.lineWidth=1.3;ctx.stroke();}
      if(fresh){ctx.beginPath();ctx.arc(p[0],p[1],r+5,0,Math.PI*2);ctx.strokeStyle=palette.ink;ctx.lineWidth=1.2;ctx.stroke();}
    }
  }
  const selected=scene.paths.get(frame.selected);
  if(selected){ctx.strokeStyle=palette.paper;ctx.lineWidth=4.5;ctx.stroke(selected);ctx.strokeStyle='#1ec896';ctx.lineWidth=2.2;ctx.stroke(selected);}
  // Check-ins: a small dot for each up to the playhead, and a ringed dot for today's.
  if(frame.dots){
    const {lonlat,lo,hi,today}=frame.dots,spots=[];
    for(let k=lo;k<hi;k++){
      if(Number.isNaN(lonlat[k*2]))continue;
      const p=project(lonlat[k*2],lonlat[k*2+1]);
      if(p&&p[0]>=0&&p[0]<=w&&p[1]>=0&&p[1]<=h)spots.push(p[0],p[1],k>=today?1:0);
    }
    // A casing in the surface colour keeps each dot legible on the palest and the deepest county fill.
    const size=Math.max(2,Math.min(4,.9*Math.sqrt(view.zoom)));
    for(const [color,pad,alpha]of [[palette.paper,1,.7],[palette.ink,0,.95]]){
      ctx.fillStyle=color;ctx.globalAlpha=alpha;
      for(let k=0;k<spots.length;k+=3)if(!spots[k+2])ctx.fillRect(spots[k]-size/2-pad,spots[k+1]-size/2-pad,size+pad*2,size+pad*2);
    }
    ctx.globalAlpha=1;
    for(let k=0;k<spots.length;k+=3)if(spots[k+2]){
      ctx.beginPath();ctx.arc(spots[k],spots[k+1],4.5,0,Math.PI*2);ctx.fillStyle=palette.paper;ctx.fill();
      ctx.beginPath();ctx.arc(spots[k],spots[k+1],2.5,0,Math.PI*2);ctx.fillStyle=palette.ink;ctx.fill();
    }
  }
  for(const marker of frame.markers){
    // A trail breaks where it passes behind the globe.
    ctx.beginPath();let open=false,drawn=0;
    for(const [lon,lat]of marker.trail){const p=project(lon,lat);if(!p){open=false;continue;}if(open)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);open=true;drawn++;}
    if(drawn>1){ctx.strokeStyle=marker.color;ctx.globalAlpha=.6;ctx.lineWidth=2;ctx.lineCap='round';ctx.stroke();ctx.globalAlpha=1;}
  }
  // Markers often sit close together; labels step down so each stays readable.
  const placed=frame.markers.map(m=>({...m,xy:project(...m.point)})).filter(m=>m.xy).sort((a,b)=>a.xy[1]-b.xy[1]);
  ctx.font='500 10px "JetBrains Mono", monospace';ctx.textBaseline='middle';
  for(const {xy:[x,y],color}of placed){
    ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fillStyle=palette.paper;ctx.fill();
    ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  }
  let floor=-Infinity;
  for(const {xy:[x,y],label}of placed){
    const ly=Math.max(y,floor+14);floor=ly;
    ctx.lineWidth=3;ctx.strokeStyle=palette.paper;ctx.strokeText(label,x+11,ly);
    ctx.fillStyle=palette.ink;ctx.fillText(label,x+11,ly);
  }
}
