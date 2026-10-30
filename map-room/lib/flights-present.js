// Presentation mode: the globe alone, opening on every flight with the whole world in
// view; Play flies them again in order. Follow frames
// each flight with three either side; Fixed holds the lower 48, and dragging
// or zooming switches to it where the view is. The line along the bottom scrubs;
// Space, the arrows, R and F drive it from the keyboard. Shared by
// flights.html?present and the website, which pass their own data and asset locations.
import {monthYear,advance,runningCounts,plural} from './flight-model.js';
import {drawGlobe} from './flight-renderer.js';
import {fitRouteWindow,blendFrames,easeCamera} from './flight-camera.js';
import {readTheme} from './theme.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const style={opacity:.18,width:1,height:.2,grid:true,labels:false,color:'mint'},NEIGHBORS=3,EASE=.5,SPEED=10,HOME={lon:-65,lat:35,zoom:1};
const KEYS='Space play/pause · ← → step (Shift ×10) · R reset · F full screen · Esc exit';
let settled=false,canvas,palette=readTheme(),data,world,flights=[],spans=[],counts=[],position=0,playing=false,last=0,camera='watch',viewMode='follow',dirty=true,lastIndex=-1,view={...HOME},goal={...view};
const frames=new Map();
// Fixed and the end hold the lower 48, where most of the flying is, fitted like a
// flight window over two spans corner to corner (no arc lift).
const CORNERS={nw:{coordinates:[-124.7,48.4]},se:{coordinates:[-80.1,25.1]},ne:{coordinates:[-67,44.8]},sw:{coordinates:[-117.1,32.5]}};
const lower48=()=>{if(!frames.has('48'))frames.set('48',fitRouteWindow([{origin:'nw',destination:'se'},{origin:'sw',destination:'ne'}],CORNERS,0,{neighbors:1,height:0,width:canvas.clientWidth,viewportHeight:canvas.clientHeight}));return frames.get('48');};
const index=()=>Math.min(flights.length-1,Math.floor(position));
const ended=()=>position>=flights.length;
function frame(i){
  if(!frames.has(i))frames.set(i,fitRouteWindow(flights,data.airports,i,{neighbors:NEIGHBORS,height:style.height,width:canvas.clientWidth,viewportHeight:canvas.clientHeight}));
  return frames.get(i);
}
// The finished map shows the whole globe, arcs and all; Fixed holds the lower 48.
function frameRoute(){
  const i=index();if(!flights[i]||camera!=='watch')return;
  if(viewMode==='fixed')goal={...lower48()};
  else if(ended())goal={...HOME};
  else{goal=frame(i);if(i<flights.length-1&&!reduced.matches)goal=blendFrames(goal,frame(i+1),Math.min(1,position-i));}
  if(reduced.matches)view={...goal};
}
// Buttons are text in the study and icons on the website: an icon button swaps its
// symbol (#icon-<name>) and keeps the words as its label.
function caption(button,text,icon){const use=button.querySelector('use');if(!use){button.textContent=text;return;}use.setAttribute('href',`#icon-${icon}`);button.setAttribute('aria-label',text);button.title=text;}
function setPlaying(value){playing=value&&flights.length>0;caption($('present-play'),playing?'Pause':ended()&&!settled?'Replay':'Play',playing?'pause':'play');last=0;}
function labels(){
  const i=index(),f=flights[i];
  $('map-date').textContent=f?monthYear(f.date):'';
  $('map-tally').textContent=f?`${plural(i+1,'flight')} · ${plural(counts[i].airports,'airport')} · ${plural(counts[i].legs,'leg')}`:'';
}
function progressBar(){
  const bar=$('map-progress').parentElement,share=flights.length?Math.min(1,position/flights.length):0;
  bar.style.setProperty('--p',share);bar.setAttribute('aria-valuenow',Math.round(share*100));bar.setAttribute('aria-valuetext',`${$('map-date').textContent}, ${$('map-tally').textContent}`);
}
function draw(){drawGlobe(canvas,world,data.airports,ended()?flights:flights.slice(0,Math.max(0,index())),ended()?null:flights[index()],ended()?1:position%1,view,style,palette);progressBar();dirty=false;}
function tick(now){
  const dt=last?Math.min((now-last)/1000,.1):0;last=now;
  if(playing&&!document.hidden){position=advance(position,dt,SPEED,spans);if(ended()){position=flights.length;setPlaying(false);}dirty=true;}
  const i=ended()?-2:index();if(i!==lastIndex){lastIndex=i;frameRoute();labels();}
  if(camera==='watch'&&!reduced.matches&&!document.hidden){
    frameRoute();
    if(d3.geoDistance([view.lon,view.lat],[goal.lon,goal.lat])>1e-5||Math.abs(Math.log(goal.zoom/view.zoom))>1e-4){view=easeCamera(view,goal,dt,EASE);dirty=true;}
  }
  if(dirty)draw();requestAnimationFrame(tick);
}
// Jump to a flight (from the scrubber or the arrow keys); playing carries on from there.
function seek(at){
  if(!data)return;settled=false;
  position=Math.max(0,Math.min(flights.length,at));camera='watch';lastIndex=-1;setPlaying(playing);labels();dirty=true;
}
// The page opens settled on the finished network, the whole globe in view (Reset and R
// return there, back on Follow); Play from there starts over.
function settle(){settled=true;if(data)setView('follow',false);setPlaying(false);position=flights.length;lastIndex=-1;camera='watch';frameRoute();view={...goal};if(data)labels();dirty=true;}
const press=(group,value)=>{for(const b of $(group).querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.value===value));};
function setView(mode,move=true){viewMode=mode;press('present-view',mode);if(move){camera='watch';frameRoute();dirty=true;}}
function explore(){camera='explore';if(viewMode!=='fixed')setView('fixed',false);dirty=true;}
function zoom(factor){explore();view.zoom=Math.max(.65,Math.min(5,view.zoom*factor));}
function controls(){
  const g=document.createElement('div');g.className='segmented';g.id='present-view';g.setAttribute('role','group');g.setAttribute('aria-label','Camera');
  g.append(...[['follow','Follow'],['fixed','Fixed']].map(([v,text])=>{const b=document.createElement('button');b.dataset.value=v;b.textContent=text;b.setAttribute('aria-pressed',String(v===viewMode));b.onclick=()=>setView(v);return b;}));
  document.querySelector('.present-buttons').prepend(g);
  $('present-play').onclick=()=>{if(playing){setPlaying(false);return;}settled=false;if(ended()){position=0;lastIndex=-1;}camera='watch';setPlaying(!reduced.matches);dirty=true;};
  $('present-reset').onclick=settle;
  // A click leaves no button holding focus, so Space and the arrows keep driving playback.
  $('present-tools').addEventListener('click',e=>{if(e.detail)e.target.closest('button')?.blur();});
  $('present-full').onclick=()=>{const wrap=canvas.closest('.globe-wrap');if(document.fullscreenElement)document.exitFullscreen();else wrap.requestFullscreen?.().catch(()=>{});};
  document.addEventListener('fullscreenchange',()=>{const on=Boolean(document.fullscreenElement);caption($('present-full'),on?'Exit full screen':'Full screen',on?'shrink':'expand');frames.clear();frameRoute();dirty=true;});
  // One finger drags the globe; two pinch to zoom.
  let drag=null,pinch=null;const pointers=new Map(),spread=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  canvas.onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);if(pointers.size===2)pinch=spread();};
  canvas.onpointermove=e=>{const p=pointers.get(e.pointerId);if(p){p.x=e.clientX;p.y=e.clientY;}if(pinch){const d=spread();if(d>0){zoom(d/pinch);pinch=d;}return;}if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>0){explore();view.lon-=dx*.3/view.zoom;view.lat=Math.max(-85,Math.min(85,view.lat+dy*.3/view.zoom));}drag={x:e.clientX,y:e.clientY};};
  canvas.onpointerup=canvas.onpointercancel=e=>{pointers.delete(e.pointerId);pinch=null;const [rest]=pointers.values();drag=rest?{...rest}:null;};
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?.94:1.06);},{passive:false});
  canvas.onkeydown=e=>{const turn={ArrowUp:[0,8],ArrowDown:[0,-8]}[e.key];if(turn){e.preventDefault();explore();view.lat=Math.max(-85,Math.min(85,view.lat+turn[1]));}else if('+=-'.includes(e.key)&&e.key){e.preventDefault();zoom(e.key==='-'?1/1.15:1.15);}};
  // Space plays and pauses; left and right step a flight (ten with Shift), held to run;
  // R resets to the finished map; F toggles full screen (Esc also leaves it).
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.closest?.('input,select,textarea,summary,a')||document.querySelector('dialog[open]'))return;
    if(e.code==='Space'&&!e.repeat&&!e.target.closest?.('button')){e.preventDefault();$('present-play').click();}
    else if((e.key==='f'||e.key==='F')&&!e.repeat){e.preventDefault();$('present-full').click();}
    else if((e.key==='r'||e.key==='R')&&!e.repeat){e.preventDefault();settle();}
    else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();seek(Math.floor(position)+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?10:1));}
  });
  // The progress line is a scrubber: click to jump, drag the handle; play resumes on release.
  const bar=$('map-progress').parentElement,share=e=>{const r=bar.getBoundingClientRect();return (e.clientX-r.left)/r.width;};
  let resume=false;
  bar.onpointerdown=e=>{if(!data)return;resume=playing;setPlaying(false);bar.setPointerCapture(e.pointerId);bar.classList.add('dragging');seek(share(e)*flights.length);};
  bar.onpointermove=e=>{if(bar.classList.contains('dragging'))seek(share(e)*flights.length);};
  bar.onpointerup=bar.onpointercancel=()=>{if(!bar.classList.contains('dragging'))return;bar.classList.remove('dragging');if(resume&&!ended())setPlaying(true);};
  new ResizeObserver(()=>{frames.clear();frameRoute();dirty=true;}).observe(canvas);
  reduced.addEventListener('change',()=>{if(reduced.matches){setPlaying(false);view={...goal};dirty=true;}});
  document.addEventListener('visibilitychange',()=>{last=0;});
  // Follow the page theme, whoever sets it.
  new MutationObserver(()=>{palette=readTheme();dirty=true;}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
}
// The keyboard note and the scrubber; pages without them get them here.
function overlay(){
  const wrap=canvas.closest('.globe-wrap');
  if(!$('map-keys'))wrap.append(Object.assign(document.createElement('p'),{id:'map-keys',className:'map-keys',textContent:KEYS}));
  const bar=$('map-progress').parentElement;bar.classList.add('scrubber');bar.removeAttribute('aria-hidden');
  Object.entries({role:'slider','aria-label':'Playback position','aria-valuemin':0,'aria-valuemax':100}).forEach(([k,v])=>bar.setAttribute(k,v));
  if(!bar.querySelector('b'))bar.append(document.createElement('b'));
}
// Fetch JSON, reporting the share received (0–1) when the server gives a length.
async function load(url,report=()=>{}){
  const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);
  const total=+r.headers.get('content-length');
  if(!total||!r.body){const json=await r.json();report(1);return json;}
  const reader=r.body.getReader(),parts=[];let got=0;
  for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);got+=value.length;report(Math.min(1,got/total));}
  const bytes=new Uint8Array(got);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}
  report(1);return JSON.parse(new TextDecoder().decode(bytes));
}
// The loading line fills with the files, holds full a moment, then the globe takes over.
const progress=value=>$('load-status').style.setProperty('--load',value);
const FILL=400,FADE=300,pause=ms=>new Promise(done=>setTimeout(done,reduced.matches?0:ms));
export async function present({data:dataUrl,assets='assets/'}){
  canvas=$('globe');document.body.classList.add('present-mode','loading');$('present-tools').hidden=false;overlay();controls();
  try{
    const shares=[0,0,0,0],track=i=>v=>{shares[i]=v;progress(.04+.96*shares.reduce((a,b)=>a+b)/shares.length);};progress(.04);
    let states,lakes;[data,world,states,lakes]=await Promise.all([load(dataUrl,track(0)),load(assets+'world.json',track(1)),load(assets+'us-states.json',track(2)).catch(()=>(track(2)(1),null)),load(assets+'lakes.json',track(3)).catch(()=>(track(3)(1),null))]);
    if(!data.flights?.length)throw Error('No flight records');
    style.states=states;style.lakes=lakes;flights=data.flights;counts=runningCounts(flights);
    spans=flights.map(f=>d3.geoDistance(data.airports[f.origin].coordinates,data.airports[f.destination].coordinates));
    progress(1);await pause(FILL);
    settle();requestAnimationFrame(tick);
    document.body.classList.remove('loading');$('load-status').classList.add('done');
    await pause(FADE);$('load-status').hidden=true;
  }catch(error){$('load-status').textContent='The flight archive is unavailable';$('load-status').classList.add('failed');console.error(error);}
}
