// Drawing for one highpoint, shared by the Highpoints study and the embed used on
// the website: a top-down contour map and the rotating wireframe disc. Needs the
// global d3 for contours. Colours come in a palette: paper, ink, muted, mapLand.
import {MESH,CONTOUR_FEET,INDEX_EVERY,MILE_KM,contourLevels,heightAt,buildMesh,project,paintOrder,discCells,routeByCell} from './highpoints-model.js';
export const PITCH=.62,ROUTE='#1ec896';
// Cells inside the disc, per mesh size: small embeds use a coarser mesh.
const discs=new Map(),discFor=n=>discs.get(n)||discs.set(n,discCells(n)).get(n);
// Everything the wireframe needs, computed once per peak and mesh size.
export function prepare(peak,n=MESH){
  const mesh=buildMesh(peak,n),route3d=peak.route.map(([u,v])=>[u*2-1,v*2-1,(heightAt(peak,u,v)-peak.min)*mesh.scale+.012]);
  return {peak,mesh,route3d,routeCells:routeByCell(peak.route,n)};
}
// Size a canvas for its CSS box and the screen's pixel ratio, and clear it.
export function sized(canvas){
  const w=canvas.clientWidth,h=canvas.clientHeight,ratio=Math.min(devicePixelRatio||1,2),ctx=canvas.getContext('2d');
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  return {ctx,w,h};
}
// Top-down: contours, a faint tint that deepens with height, the route, summit
// and trailhead, and a one-mile scale bar unless `scaleBar` is false.
export function drawTopo(ctx,w,peak,palette,{scaleBar=true,background=true}={}){
  const n=peak.grid,at=x=>(x-.5)/(n-1)*w,unit=([u,v])=>[u*w,v*w];
  if(background){ctx.fillStyle=palette.mapLand;ctx.fillRect(0,0,w,w);}
  const path=d3.geoPath(d3.geoTransform({point(x,y){this.stream.point(at(x),at(y));}}),ctx);
  const levels=contourLevels(peak.min,peak.max),contours=d3.contours().size([n,n]).thresholds(levels.map(l=>l.metres))(peak.heights);
  const isIndex=i=>Math.round(levels[i].feet/CONTOUR_FEET)%INDEX_EVERY===0;
  // Tint deepens by index contour, so every map shades height on the same scale.
  ctx.fillStyle=palette.ink;
  contours.forEach((contour,i)=>{if(isIndex(i)){ctx.globalAlpha=.022;ctx.beginPath();path(contour);ctx.fill();}});
  ctx.strokeStyle=palette.ink;ctx.lineJoin='round';
  contours.forEach((contour,i)=>{
    const index=isIndex(i);
    ctx.globalAlpha=index?.5:.2;ctx.lineWidth=index?.9:.45;ctx.beginPath();path(contour);ctx.stroke();
  });
  ctx.globalAlpha=1;
  if(peak.route.length>1){
    const line=()=>{ctx.beginPath();peak.route.forEach((p,i)=>{const xy=unit(p);if(i)ctx.lineTo(...xy);else ctx.moveTo(...xy);});};
    ctx.lineCap='round';line();ctx.strokeStyle=palette.mapLand;ctx.lineWidth=4.5;ctx.stroke();
    line();ctx.strokeStyle=ROUTE;ctx.lineWidth=2;ctx.stroke();
    const [tx,ty]=unit(peak.trailhead);
    ctx.beginPath();ctx.arc(tx,ty,3.5,0,Math.PI*2);ctx.fillStyle=palette.mapLand;ctx.fill();ctx.strokeStyle=ROUTE;ctx.lineWidth=1.5;ctx.stroke();
  }
  const [sx,sy]=unit(peak.summit);
  ctx.beginPath();ctx.moveTo(sx,sy-7);ctx.lineTo(sx+6,sy+4);ctx.lineTo(sx-6,sy+4);ctx.closePath();
  ctx.fillStyle=palette.ink;ctx.strokeStyle=palette.mapLand;ctx.lineWidth=2;ctx.stroke();ctx.fill();
  if(!scaleBar)return;
  const bar=MILE_KM/(peak.halfKm*2)*w;
  ctx.strokeStyle=palette.ink;ctx.globalAlpha=.75;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(10,w-12);ctx.lineTo(10+bar,w-12);ctx.moveTo(10,w-15);ctx.lineTo(10,w-9);ctx.moveTo(10+bar,w-15);ctx.lineTo(10+bar,w-9);ctx.stroke();
  ctx.font='500 9px "JetBrains Mono", monospace';ctx.fillStyle=palette.ink;ctx.fillText('1 mi',10,w-19);ctx.globalAlpha=1;
}
// Wireframe: quads painted far to near, each filled with the surface colour so
// nearer terrain hides what is behind it, then the route segments of that cell.
// `tallest` sets one drawing scale shared by every disc drawn together, so the
// discs match and only the terrain differs; `line` scales the strokes. By
// default discs rest on the bottom edge; `fit:'round'` centres them, a little
// smaller, for a circular frame.
export function drawMesh(ctx,w,h,item,angle,tallest,palette,{line=1,fit='bottom'}={}){
  const {peak,mesh,route3d,routeCells}=item,n=mesh.n,v=mesh.vertices,DISC=discFor(n);
  const round=fit==='round',rise=tallest*Math.cos(PITCH),scale=Math.min(w*(round?.43:.47),h*(round?.8:.95)/(2*Math.sin(PITCH)+rise)),cx=w/2,cy=round?h/2+rise*scale/2:h*.975-Math.sin(PITCH)*scale;
  const sx=new Float32Array(n*n),sy=new Float32Array(n*n);
  for(let k=0;k<n*n;k++){const p=project(v[k*3],v[k*3+1],v[k*3+2],angle,PITCH);sx[k]=cx+p[0]*scale;sy[k]=cy+p[1]*scale;}
  const order=paintOrder(n,angle);
  ctx.lineJoin='round';ctx.lineWidth=.6*line;
  for(let k=0;k<order.length;k+=2){
    const i=order[k],j=order[k+1],a=j*n+i,b=a+1,c=a+n+1,d=a+n;
    if(!DISC[a])continue;
    ctx.beginPath();ctx.moveTo(sx[a],sy[a]);ctx.lineTo(sx[b],sy[b]);ctx.lineTo(sx[c],sy[c]);ctx.lineTo(sx[d],sy[d]);ctx.closePath();
    ctx.fillStyle=palette.paper;ctx.fill();ctx.strokeStyle=palette.muted;ctx.globalAlpha=.55;ctx.stroke();ctx.globalAlpha=1;
    const segments=routeCells.get(a);
    if(segments){
      ctx.beginPath();
      for(const s of segments){const p=route3d[s],q=route3d[s+1],P=project(...p,angle,PITCH),Q=project(...q,angle,PITCH);ctx.moveTo(cx+P[0]*scale,cy+P[1]*scale);ctx.lineTo(cx+Q[0]*scale,cy+Q[1]*scale);}
      ctx.strokeStyle=ROUTE;ctx.lineWidth=2*line;ctx.lineCap='round';ctx.stroke();ctx.lineWidth=.6*line;
    }
  }
  // The summit: a short pin, so the highest point reads from any side.
  const [u,vv]=peak.summit,z=(heightAt(peak,u,vv)-peak.min)*mesh.scale,foot=project(u*2-1,vv*2-1,z,angle,PITCH),tip=project(u*2-1,vv*2-1,z+.09,angle,PITCH);
  ctx.beginPath();ctx.moveTo(cx+foot[0]*scale,cy+foot[1]*scale);ctx.lineTo(cx+tip[0]*scale,cy+tip[1]*scale);ctx.strokeStyle=palette.ink;ctx.lineWidth=1.2*line;ctx.stroke();
  ctx.beginPath();ctx.arc(cx+tip[0]*scale,cy+tip[1]*scale,2.6*Math.max(.6,line),0,Math.PI*2);ctx.fillStyle=palette.ink;ctx.fill();
}
