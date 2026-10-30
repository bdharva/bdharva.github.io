// Terrain maths kept free of the DOM: sampling, contour levels, the rotating
// projection, and the order in which a height field must be painted.
export const MESH=44;
// One vertical scale and one contour interval, in feet, for every peak, so that a
// prairie rise and an alpine crest can be compared at a glance: flat ground
// looks flat. Index contours are every fifth line.
export const EXAGGERATION=2,CONTOUR_FEET=50,INDEX_EVERY=5;
// Terrain is stored in metres and kilometres; everything shown is in feet and miles.
export const FOOT=.3048,MILE_KM=1.609344;
export const toFeet=metres=>metres/FOOT,toMiles=km=>km/MILE_KM;
export const miles=km=>{const value=toMiles(km);return `${value.toFixed(1)} mi`;};
// Contour levels in feet strictly inside a range given in metres, with the
// metre value each is drawn at.
export function contourLevels(min,max,step=CONTOUR_FEET){
  const levels=[],low=toFeet(min),high=toFeet(max);
  for(let level=Math.ceil((low+1e-6)/step)*step;level<high;level+=step)levels.push({feet:level,metres:level*FOOT});
  return levels;
}
// Height in metres at unit coordinates (u east, v south), bilinear between samples.
export function heightAt(peak,u,v){
  const n=peak.grid,x=Math.max(0,Math.min(n-1,u*(n-1))),y=Math.max(0,Math.min(n-1,v*(n-1)));
  const i=Math.min(n-2,Math.floor(x)),j=Math.min(n-2,Math.floor(y)),fx=x-i,fy=y-j,h=peak.heights;
  return (h[j*n+i]*(1-fx)+h[j*n+i+1]*fx)*(1-fy)+(h[(j+1)*n+i]*(1-fx)+h[(j+1)*n+i+1]*fx)*fy;
}
// Vertices of an n-by-n mesh in a cube: x east and y south in [-1,1], z up.
export function buildMesh(peak,n=MESH){
  const scale=EXAGGERATION/(peak.halfKm*1000),vertices=new Float32Array(n*n*3);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const u=i/(n-1),v=j/(n-1),k=(j*n+i)*3;
    vertices[k]=u*2-1;vertices[k+1]=v*2-1;vertices[k+2]=(heightAt(peak,u,v)-peak.min)*scale;
  }
  return {n,vertices,scale,top:(peak.max-peak.min)*scale};
}
// Rotate about the vertical axis, then tilt toward the viewer. Returns screen
// x, screen y (down), and depth (larger is nearer).
export function project(x,y,z,angle,pitch){
  const c=Math.cos(angle),s=Math.sin(angle),xr=x*c-y*s,yr=x*s+y*c;
  return [xr,yr*Math.sin(pitch)-z*Math.cos(pitch),yr];
}
// Cell order, far to near, for a height field seen from `angle`: depth grows
// with x when sin(angle) is positive and with y when cos(angle) is positive.
export function paintOrder(n,angle){
  const s=Math.sin(angle),c=Math.cos(angle),cells=n-1,order=new Uint16Array(cells*cells*2);
  const run=forward=>Array.from({length:cells},(_,k)=>forward?k:cells-1-k);
  const xs=run(s>=0),ys=run(c>=0);
  let k=0;
  // The axis that changes depth faster goes in the outer loop.
  if(Math.abs(s)>=Math.abs(c))for(const i of xs)for(const j of ys){order[k++]=i;order[k++]=j;}
  else for(const j of ys)for(const i of xs){order[k++]=i;order[k++]=j;}
  return order;
}
// Which cells lie inside the circle inscribed in the square, by cell centre.
// The wireframe shows only these, so it reads as a disc from every side.
export function discCells(n=MESH){
  const cells=n-1,inside=new Uint8Array(n*n);
  for(let j=0;j<cells;j++)for(let i=0;i<cells;i++){
    const x=(i+.5)/cells*2-1,y=(j+.5)/cells*2-1;
    inside[j*n+i]=x*x+y*y<=1?1:0;
  }
  return inside;
}
// Route segments grouped by the mesh cell they start in, so each is painted
// with its cell and nearer terrain can hide it.
export function routeByCell(route,n=MESH){
  const cells=new Map();
  for(let k=0;k<route.length-1;k++){
    const [u,v]=route[k],key=Math.min(n-2,Math.floor(v*(n-1)))*n+Math.min(n-2,Math.floor(u*(n-1)));
    (cells.get(key)||cells.set(key,[]).get(key)).push(k);
  }
  return cells;
}
// Elevation along a route to the summit: miles walked from the trailhead
// against feet above sea level. A loop is cut where it passes the summit.
// Distances are scaled to the surveyed route length, which the thinned line
// drawn on the map understates.
export function profile(peak){
  let route=peak.route;
  if(peak.loop&&route.length){
    const near=k=>Math.hypot(route[k][0]-peak.summit[0],route[k][1]-peak.summit[1]);
    let top=0;for(let k=1;k<route.length;k++)if(near(k)<near(top))top=k;
    route=route.slice(0,top+1);
  }
  const steps=route.map(([u,v],k)=>k?Math.hypot(u-route[k-1][0],v-route[k-1][1]):0);
  const drawn=steps.reduce((a,b)=>a+b,0),whole=peak.route.reduce((sum,[u,v],k)=>k?sum+Math.hypot(u-peak.route[k-1][0],v-peak.route[k-1][1]):0,0);
  const perUnit=whole>0&&peak.routeKm?toMiles(peak.routeKm)/whole:toMiles(peak.halfKm*2);
  let walked=0;
  return route.map(([u,v],k)=>{walked+=steps[k]*perUnit;return {miles:drawn?walked:0,feet:toFeet(heightAt(peak,u,v))};});
}
// A hike is a route long enough to draw; roadside highpoints are not.
export const isHike=peak=>peak.routeKm>=.15&&peak.route.length>1;
const CODES={Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY'};
export const stateCode=state=>CODES[state]||state.slice(0,2).toUpperCase();
// Assign each height to the first of several side-by-side lanes where it
// clears the label above it, so close heights sit beside one another instead
// of stacking. Returns a lane index for each input, in input order.
export function laneFor(ys,gap,lanes){
  const last=new Array(lanes).fill(-Infinity),out=new Array(ys.length);
  for(const i of ys.map((_,k)=>k).sort((a,b)=>ys[a]-ys[b])){
    let lane=last.findIndex(y=>ys[i]-y>=gap);
    // Every lane is taken at this height: use the one with the most room.
    if(lane<0)lane=last.indexOf(Math.min(...last));
    last[lane]=ys[i];out[i]=lane;
  }
  return out;
}
// Place a label beside each point, moving it down only as far as needed to
// clear labels already placed. Points are taken top to bottom; returns the
// label's y for each input, in input order.
export function placeLabels(points,width,height){
  const placed=[],out=new Array(points.length);
  for(const i of points.map((_,k)=>k).sort((a,b)=>points[a].y-points[b].y||points[a].x-points[b].x)){
    let y=points[i].y;
    // The small tolerance stops a label placed exactly one height below another from being moved again.
    for(let moved=true;moved;){moved=false;for(const other of placed)if(Math.abs(other.x-points[i].x)<width&&Math.abs(other.y-y)<height-1e-6){y=other.y+height;moved=true;}}
    placed.push({x:points[i].x,y});out[i]=y;
  }
  return out;
}
export const feet=n=>`${n.toLocaleString('en-US')} ft`;
export const climbed=date=>new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
export function sortPeaks(peaks,by){
  const key={relief:p=>p.min-p.max,date:p=>p.date,elevation:p=>-p.feet,state:p=>p.state}[by]||(p=>p.date);
  return [...peaks].sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:a.name.localeCompare(b.name));
}
