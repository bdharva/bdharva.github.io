// Globe camera for the county map: the same orthographic view as Flights, so
// the country sits on the earth among its neighbours instead of floating.
export {easeCamera as easeView} from './flight-camera.js';
const RAD=Math.PI/180;
// Globe radius at zoom 1, as a share of the shorter canvas side (as in Flights).
export const GLOBE=.405,MIN_ZOOM=.65,MAX_ZOOM=60;
export const globeRadius=(view,width,height)=>Math.min(width,height)*GLOBE*view.zoom;
// Corners of the lower 48 states: the whole-country view frames these.
const LOWER_48=[[-124.7,48.4],[-123,37],[-117.1,32.5],[-106.5,31.7],[-97.4,25.9],[-80.2,25.1],[-75.5,35.2],[-66.9,44.8],[-83,46],[-95.2,49.4],[-110,49]];
// A function from (lon,lat) to screen [x,y], or null on the far side of the globe.
export function projector(view,width,height){
  const R=globeRadius(view,width,height),l0=view.lon*RAD,p0=view.lat*RAD,s0=Math.sin(p0),c0=Math.cos(p0),cx=width/2,cy=height/2;
  return (lon,lat)=>{
    const l=lon*RAD-l0,p=lat*RAD,cp=Math.cos(p),sp=Math.sin(p),cl=Math.cos(l);
    if(s0*sp+c0*cp*cl<=0)return null;
    return [cx+R*cp*Math.sin(l),cy-R*(c0*sp-s0*cp*cl)];
  };
}
// The (lon,lat) under a screen point, or null off the globe.
export function unproject(view,width,height,x,y){
  const R=globeRadius(view,width,height),px=(x-width/2)/R,py=-(y-height/2)/R,rho=Math.hypot(px,py);
  if(rho>1)return null;
  const p0=view.lat*RAD,c=Math.asin(rho),sc=Math.sin(c),cc=Math.cos(c);
  const lat=Math.asin(cc*Math.sin(p0)+(rho?py*sc*Math.cos(p0)/rho:0));
  const lon=view.lon*RAD+Math.atan2(px*sc,rho*Math.cos(p0)*cc-py*Math.sin(p0)*sc);
  return [((lon/RAD+540)%360)-180,lat/RAD];
}
// Frame a set of [lon,lat,reach] points, reach being an angular radius in
// radians around each. A long stay at home keeps its region in view: the
// frame never closes in tighter than minExtent radians either side.
export function fitPoints(points,{width=1000,height=620,minExtent=.045,maxZoom=MAX_ZOOM,minZoom=MIN_ZOOM}={}){
  if(!points.length)return homeView(width,height);
  let x=0,y=0,z=0;
  for(const [lon,lat]of points){const l=lon*RAD,p=lat*RAD;x+=Math.cos(p)*Math.cos(l);y+=Math.cos(p)*Math.sin(l);z+=Math.sin(p);}
  const centre={lon:Math.atan2(y,x)/RAD,lat:Math.atan2(z,Math.hypot(x,y))/RAD,zoom:1};
  // Extents on a unit globe (radius 1, centred at 1,1) turned to face the centre.
  const unit=projector({...centre,zoom:.5/GLOBE},2,2);
  let spanX=minExtent,spanY=minExtent;
  for(const [lon,lat,reach=0]of points){const p=unit(lon,lat);if(!p)continue;spanX=Math.max(spanX,Math.abs(p[0]-1)+reach);spanY=Math.max(spanY,Math.abs(p[1]-1)+reach);}
  const base=Math.min(width,height)*GLOBE;
  return {lon:centre.lon,lat:centre.lat,zoom:Math.max(minZoom,Math.min(maxZoom,width*.44/(base*spanX),height*.42/(base*spanY)))};
}
export function homeView(width=1000,height=620){
  let x=0,y=0,z=0;
  for(const [lon,lat]of LOWER_48){const l=lon*RAD,p=lat*RAD;x+=Math.cos(p)*Math.cos(l);y+=Math.cos(p)*Math.sin(l);z+=Math.sin(p);}
  const centre={lon:Math.atan2(y,x)/RAD,lat:Math.atan2(z,Math.hypot(x,y))/RAD},unit=projector({...centre,zoom:.5/GLOBE},2,2);
  let spanX=0,spanY=0;
  for(const [lon,lat]of LOWER_48){const p=unit(lon,lat);spanX=Math.max(spanX,Math.abs(p[0]-1));spanY=Math.max(spanY,Math.abs(p[1]-1));}
  const base=Math.min(width,height)*GLOBE;
  return {...centre,zoom:Math.min(width*.46/(base*spanX),height*.44/(base*spanY))};
}
export function settled(view,goal){
  const turn=Math.hypot((view.lon-goal.lon)*Math.cos(view.lat*RAD),view.lat-goal.lat);
  return turn*view.zoom<.002&&Math.abs(Math.log(goal.zoom/view.zoom))<1e-4;
}
