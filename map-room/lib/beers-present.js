// Beer Styles, presented: every beer I have checked in on Untappd at the tip of its own
// twig, on a tree that branches out in every direction from one root through Ale, Lager,
// Hybrid and Other, each style family, and each style; the joints are small and grey,
// the beers coloured by my rating (or the crowd's, or mine against the crowd's). The
// tree is laid out once at build time and never moves: Play adds one new beer a step,
// as County Counting adds counties, drawing its twig out from its style (and any new
// joint above it first). Click part of the tree to zoom to it, Esc to step back out;
// hover anything for its record. Check-in counts play no part: I logged each new beer once.
import {decodeNodes,aggregate,measure,dayLabel,beerSteps,beerFacts,BEER_RADIUS} from './beers-model.js';
import {readTheme} from './theme.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const KEYS='Space play/pause · ← → step a beer (Shift ×10) · R reset · F full screen · Esc zoom out';
const BEERS_PER_SECOND=24,TOP=72,BOTTOM=118,GROW=450;
// The Swarm purple below the middle, the mint the other maps count in above it, grey between.
const INKS={dark:{div:['#9c80e0','#8e8d87','#35a886'],none:'#3c3c39'},
  light:{div:['#7b58c9','#a3a29c','#0e8a66'],none:'#dddcd6'}};
// Hard steps, not a gradient: five bands of quarter stars for mine (and the crowd's);
// against the crowd, five bands with "about even" in the middle.
// Mine centre on 3.5, so my ratings split about evenly: 3 or less, 3.25, 3.5, 3.75, 4 up.
const STEPS={mine:{cuts:[3.25,3.5,3.75,4],labels:['3 or less','3.25','3.5','3.75','4+']},
  relative:{cuts:[-.5,-.15,.15,.5],labels:['½ below','Below','About even','Above','½ above']}};
const MODES=[['mine','Mine'],['relative','Vs crowd'],['crowd','Crowd']];
// The crowd's ratings arrive about a hundred beers an hour; until nearly every beer has
// one, the crowd stays out of the picker, the hover box, the panel and the about box.
let crowdReady=false;
let canvas,ctx,palette=readTheme(),data,nodes,parent,kids,facts,beersOf,lay,final,stats,beerAt=[],playing=false,last=0,dirty=true;
let at=0,end=0,shownSteps=-1,included=0,settled=true,mode='mine',hover=null,focus=null,manual=false,cam=null,rest=1;
let born=new Map(),joint=new Map(),mine=null;
// Theme tokens can be any CSS colour; the canvas turns them into ones d3 can mix.
function theme(){const t=readTheme();if(!ctx)return t;const norm=c=>{ctx.fillStyle='#000';ctx.fillStyle=c;return ctx.fillStyle;};return {...t,paper:norm(t.paper),ink:norm(t.ink),muted:norm(t.muted)};}
const plural=(n,word,words=word+'s')=>`${n.toLocaleString('en-US')} ${n===1?word:words}`;
const ink=()=>INKS[palette.dark?'dark':'light'];
const steps=()=>STEPS[mode==='relative'?'relative':'mine'];
// Every mode shares one diverging ramp, purple through grey to mint, so ratings either
// side of the middle step stand well apart.
function ramp(){
  const k=ink();
  return [k.div[0],d3.interpolateLab(k.div[1],k.div[0])(.55),k.div[1],d3.interpolateLab(k.div[1],k.div[2])(.55),k.div[2]];
}
const colour=v=>v==null?ink().none:ramp()[d3.bisectRight(steps().cuts,v)];
// A beer's value as of the playhead: my mean of its ratings so far, the crowd's, or the difference.
function beerValue(b){const m=mine[b],c=data.beers[b][3];return mode==='mine'?m:mode==='crowd'?c:m==null||c==null?null:m-c;}
const shown=b=>facts[b].first<included;
const live=i=>i===0||stats.beers[i]>0;
// The layout for the nearer screen shape.
const pickLayout=()=>{const a=canvas.clientWidth/Math.max(1,canvas.clientHeight-TOP-BOTTOM);return data.layout.reduce((p,q)=>Math.abs(Math.log(q.aspect/a))<Math.abs(Math.log(p.aspect/a))?q:p);};

// Step n shows the first n beers: every check-in up to the nth new beer's first, and at
// the end every check-in there is. Beers and joints new to this step start growing.
function measureAt(p){
  const n=Math.floor(p);if(n===shownSteps)return;
  const before=included;shownSteps=n;included=n>=end?data.checkins.length:n?beerAt[n-1]+1:0;
  const was=stats;stats=aggregate(data,{count:included});
  const sum=new Float64Array(data.beers.length),rated=new Float64Array(data.beers.length);
  for(let j=0;j<included;j++){const [,,b,my]=data.checkins[j];if(my!=null){sum[b]+=my;rated[b]++;}}
  mine=[...sum].map((s,b)=>rated[b]?s/rated[b]:null);
  if(playing&&included>before){
    const now=performance.now();
    for(const n of nodes)if(n.i&&stats.beers[n.i]&&!was?.beers[n.i])joint.set(n.i,now+(n.level-1)*90-270);
    for(let j=before;j<included;j++){const b=data.checkins[j][2];if(facts[b].first===j)born.set(b,now);}
  }
  corner();dirty=true;
}
function corner(){
  const styles=nodes.filter(n=>n.level&&!kids[n.i].length&&stats.count[n.i]).length;
  $('map-date').textContent=included?dayLabel(data,data.checkins[included-1][0]):'';
  $('map-tally').textContent=`${plural(stats.beers[0],'beer')} · ${plural(styles,'style')}`;
  const bar=$('map-progress').parentElement,share=end?Math.min(1,at/end):1;
  bar.style.setProperty('--p',share);bar.setAttribute('aria-valuenow',Math.round(share*100));bar.setAttribute('aria-valuetext',`${$('map-date').textContent}, ${$('map-tally').textContent}`);
}

// Everything under a joint, for its bounds: the joints below it and their beers.
function under(i){const js=[],bs=[],walk=j=>{js.push(j);for(const b of beersOf[j])if(shown(b))bs.push(b);kids[j].forEach(walk);};walk(i);return {js:js.filter(live),bs};}
function bounds(i){
  const {js,bs}=under(i),pts=[...js.map(j=>lay.nodes[j]),...bs.map(b=>lay.beers[b])];
  if(!pts.length)return null;const xs=d3.extent(pts,p=>p[0]),ys=d3.extent(pts,p=>p[1]);
  return [xs[0]-BEER_RADIUS,ys[0]-BEER_RADIUS,xs[1]+BEER_RADIUS,ys[1]+BEER_RADIUS];
}
// The view: what has grown so far (never closer than 2.5 times the finished scale), or
// the part zoomed into; a drag or the wheel takes over until Esc or a click.
function goal(){
  const w=canvas.clientWidth-40,h=canvas.clientHeight-TOP-BOTTOM-16,b=bounds(focus??0);
  if(!b)return cam||{s:rest,cx:0,cy:0};
  const s=Math.min(w/Math.max(1,b[2]-b[0]),h/Math.max(1,b[3]-b[1]));
  return {s:focus==null?Math.min(rest*2.5,s):Math.min(rest*12,s),cx:(b[0]+b[2])/2,cy:(b[1]+b[3])/2};
}
function frame(){const w=canvas.clientWidth,h=canvas.clientHeight;return {s:cam.s,ox:w/2-cam.cx*cam.s,oy:TOP+(h-TOP-BOTTOM)/2-cam.cy*cam.s};}
const toScreen=(f,p)=>[f.ox+p[0]*f.s,f.oy+p[1]*f.s];
const ease=t=>reduced.matches?1:d3.easeCubicOut(Math.max(0,Math.min(1,t)));

function draw(){
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=devicePixelRatio||1,now=performance.now();
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const f=frame(),grey=d3.interpolateLab(palette.paper,palette.ink)(.42),twig=d3.color(palette.ink).copy({opacity:.22})+'',strong=palette.ink;
  const inFocus=focus==null?null:new Set(under(focus).js);
  const grown=i=>{const t=joint.get(i);return t===undefined?1:ease((now-t)/GROW);};
  const tip=(from,to,g)=>[from[0]+(to[0]-from[0])*g,from[1]+(to[1]-from[1])*g];
  // Branches: joint to joint, then style to beer, each drawn out as it is new.
  ctx.lineCap='round';ctx.strokeStyle=twig;
  for(const n of nodes){
    if(!n.i||!live(n.i))continue;const g=grown(n.i);if(g<1)dirty=true;
    const a=toScreen(f,lay.nodes[n.parent]),b=toScreen(f,tip(lay.nodes[n.parent],lay.nodes[n.i],g));
    ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
  }
  ctx.lineWidth=.8;
  for(let b=0;b<data.beers.length;b++){
    if(!shown(b))continue;const t=born.get(b),g=t===undefined?1:ease((now-t)/GROW);
    const from=lay.nodes[facts[b].leaf];if(grown(facts[b].leaf)<1)continue;
    const a=toScreen(f,from),e=toScreen(f,tip(from,lay.beers[b],g));ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...e);ctx.stroke();
  }
  // Joints: small and grey, the root a little larger.
  for(const n of nodes){
    if(!live(n.i)||grown(n.i)<1)continue;const [x,y]=toScreen(f,lay.nodes[n.i]),r=Math.max(1.5,[4,3,2.4,1.8][n.level]*Math.min(1.6,Math.max(.7,f.s)));
    ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=n.i===hover||n.i===focus?strong:grey;ctx.fill();
  }
  // Beers: a coloured tip, swelling in as its twig arrives.
  const R=Math.max(1.6,Math.min(7,BEER_RADIUS*f.s)),named=[];
  for(let b=0;b<data.beers.length;b++){
    if(!shown(b))continue;const t=born.get(b),g=t===undefined?1:(now-t)/GROW;if(g<1)dirty=true;
    if(grown(facts[b].leaf)<1||g<.55)continue;
    const k=reduced.matches?1:d3.easeBackOut.overshoot(2)(Math.min(1,(g-.55)/.45)),[x,y]=toScreen(f,lay.beers[b]);
    let fill=colour(beerValue(b));if(inFocus&&!inFocus.has(facts[b].leaf))fill=d3.interpolateLab(palette.paper,fill)(.25);
    ctx.beginPath();ctx.arc(x,y,R*k,0,2*Math.PI);ctx.fillStyle=fill;ctx.fill();
    if(b===hover-1e6||b===opened){ctx.lineWidth=1.5;ctx.strokeStyle=strong;ctx.beginPath();ctx.arc(x,y,R+3,0,2*Math.PI);ctx.stroke();}
    if(f.s>=3.2&&(!inFocus||inFocus.has(facts[b].leaf)))named.push([b,x,y]);
  }
  // Names: classes always, families and styles as the zoom gives them room, and each
  // beer's name beside its tip once the view is close enough.
  ctx.lineJoin='round';ctx.strokeStyle=palette.paper;ctx.lineWidth=3.5;ctx.textBaseline='middle';
  const label=(text,x,y,font,fill,align='center')=>{ctx.font=font;ctx.textAlign=align;ctx.strokeText(text,x,y);ctx.fillStyle=fill;ctx.fillText(text,x,y);};
  for(const n of nodes){
    if(!n.level||!live(n.i)||grown(n.i)<1)continue;const [x,y]=toScreen(f,lay.nodes[n.i]);
    if(inFocus&&!inFocus.has(n.i)&&n.level>1)continue;
    // Big branches are named from the start; small ones as the zoom makes room.
    const z=f.s/rest,b=stats.beers[n.i];
    if(n.level===1)label(`${n.name.toUpperCase()} ${b}`,x,y-14,'600 12px "JetBrains Mono", monospace',strong);
    else if(n.level===2&&(b>=20||z>2.2||inFocus&&z>1.4))label(n.name,x,y-11,'600 11px "DM Sans", sans-serif',strong);
    else if(n.level===3&&(b>=40||z>3.5||inFocus&&z>2.2))label(n.name,x,y-10,'500 10px "DM Sans", sans-serif',palette.muted);
  }
  // Beer names beside their tips, each placed only where it overlaps no name already
  // placed (best-rated first), so a dense style shows what fits and the zoom shows more.
  const taken=[],free=r=>taken.every(t=>r[0]>t[2]||r[2]<t[0]||r[1]>t[3]||r[3]<t[1]);ctx.font='500 10px "DM Sans", sans-serif';
  for(const [b,x,y]of named.sort((p,q)=>(mine[q[0]]??0)-(mine[p[0]]??0))){
    const o=lay.beers[b],p=lay.nodes[facts[b].leaf],right=o[0]>=p[0],text=data.beers[b][0],w=ctx.measureText(text).width,lx=x+(right?R+4:-R-4);
    const box=right?[lx,y-6,lx+w,y+6]:[lx-w,y-6,lx,y+6];if(!free(box))continue;taken.push(box);
    label(text,lx,y,'500 10px "DM Sans", sans-serif',palette.muted,right?'left':'right');
  }
}
// The view eases toward its goal; the tree itself never moves.
function step(dt){
  if(manual)return;const g=goal();
  if(!cam||reduced.matches){cam=g;return;}
  const k=Math.min(1,dt*2.4),s=Math.exp(Math.log(cam.s)+(Math.log(g.s)-Math.log(cam.s))*k);
  if(Math.abs(Math.log(g.s/cam.s))>1e-4||Math.abs(g.cx-cam.cx)+Math.abs(g.cy-cam.cy)>.02){cam={s,cx:cam.cx+(g.cx-cam.cx)*k,cy:cam.cy+(g.cy-cam.cy)*k};dirty=true;}
}
function caption(button,text,icon){const use=button.querySelector('use');use.setAttribute('href',`#icon-${icon}`);button.setAttribute('aria-label',text);button.title=text;}
function setPlaying(v){playing=v&&Boolean(data);caption($('present-play'),playing?'Pause':at>=end&&!settled?'Replay':'Play',playing?'pause':'play');last=0;}
function tick(now){
  const dt=last?Math.min((now-last)/1000,.05):0;last=now;
  if(playing&&!document.hidden){at=Math.min(end,at+dt*BEERS_PER_SECOND);if(at>=end)setPlaying(false);measureAt(at);}
  step(dt);if(dirty){dirty=false;draw();}
  requestAnimationFrame(tick);
}
function seek(p){if(!data)return;settled=false;at=Math.max(0,Math.min(end,p));measureAt(at);if(!playing)setPlaying(false);}
// The scale that fits the whole finished tree: playback never comes closer than 2.5 times it.
function restScale(){const keep=[focus,shownSteps,included,stats];focus=null;included=data.checkins.length;stats=final;rest=Infinity;const s=goal().s;[focus,shownSteps,included,stats]=keep;return s;}
// The finished tree.
function settle(){
  settled=true;setPlaying(false);at=end;focus=null;manual=false;born.clear();joint.clear();
  if(data){lay=pickLayout();shownSteps=-1;measureAt(end);rest=restScale();cam=null;}
  dirty=true;
}
const press=(group,v)=>{for(const b of $(group).querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.value===v));};
function group(id,label,items,current,choose){
  const g=document.createElement('div');g.className='segmented';g.id=id;g.setAttribute('role','group');g.setAttribute('aria-label',label);
  g.append(...items.map(([v,text])=>{const b=document.createElement('button');b.dataset.value=v;b.textContent=text;b.setAttribute('aria-pressed',String(v===current));b.onclick=()=>choose(v);return b;}));return g;
}
function setMode(v){mode=v;press('present-colour',v);legend();dirty=true;}
// The key: one cell per step, then the grey of no rating.
function legend(){
  const box=$('map-key'),cells=ramp().map((c,j)=>[c,steps().labels[j]]);
  cells.push([ink().none,mode==='relative'?'No crowd rating':'Unrated','map-key-apart']);
  box.replaceChildren(...cells.map(([color,label,cls])=>{const s=document.createElement('span'),i=document.createElement('i');i.style.background=color;s.append(i,label);if(cls)s.className=cls;return s;}));
}
// What is under the pointer: a beer (returned as beer + 1e6), else the nearest joint.
function pick(e){
  if(!cam)return null;
  const f=frame(),r=canvas.getBoundingClientRect(),x=(e.clientX-r.left-f.ox)/f.s,y=(e.clientY-r.top-f.oy)/f.s,reach=Math.max(BEER_RADIUS*1.3,8/f.s);
  let best=null,dist=Infinity;
  for(let b=0;b<data.beers.length;b++){if(!shown(b))continue;const d=Math.hypot(lay.beers[b][0]-x,lay.beers[b][1]-y);if(d<reach&&d<dist){best=b+1e6;dist=d;}}
  // A joint answers for its name too, which sits just above it.
  for(const n of nodes){if(!n.level||!live(n.i))continue;const d=Math.hypot(lay.nodes[n.i][0]-x,(lay.nodes[n.i][1]-y)-(n.level<3?6:4)/f.s);if(d<16/f.s&&d<dist){best=n.i;dist=d;}}
  return best;
}
const fmt=v=>v==null?'–':v.toFixed(2),signed=v=>v==null?'–':`${v>0?'+':v<0?'−':''}${Math.abs(v).toFixed(2)}`;
const path=i=>{const out=[];for(let j=i;j>0;j=parent[j])out.unshift(nodes[j].name);return out;};
const date=d=>dayLabel(data,d,{day:'numeric',month:'short',year:'numeric'});
function tip(e){
  const p=pick(e),box=$('beer-tip');if(hover!==p){hover=p;dirty=true;}
  if(p==null){box.hidden=true;return;}
  const lines=[],name=document.createElement('strong');
  if(p>=1e6){
    const b=p-1e6,[beer,brewery,abv,crowd]=data.beers[b],fb=facts[b];name.textContent=beer;
    lines.push([brewery,abv?`${abv}%`:null].filter(Boolean).join(' · '),path(fb.leaf).join(' · '),crowdReady?`Mine ${fmt(mine[b])} · crowd ${fmt(crowd)}`:`Mine ${fmt(mine[b])}`,`First had ${date(fb.firstDay)}`);
  }else{
    const i=p;name.textContent=path(i).join(' · ');
    lines.push(plural(stats.beers[i],'beer'),
      crowdReady?`Mine ${fmt(measure(stats,i,'mine',parent))} · crowd ${fmt(measure(stats,i,'crowd',parent))} · vs crowd ${signed(measure(stats,i,'relative',parent,{shrink:false}))}`:`Mine ${fmt(measure(stats,i,'mine',parent))}`,
      stats.first[i]===stats.last[i]?date(stats.first[i]):`${dayLabel(data,stats.first[i])} – ${dayLabel(data,stats.last[i])}`);
  }
  box.replaceChildren(name,...lines.flatMap((line,j)=>j?[document.createElement('br'),line]:[line]));
  const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;box.hidden=false;
  box.style.left=`${Math.max(8,Math.min(x+14,canvas.clientWidth-box.offsetWidth-8))}px`;box.style.top=`${Math.max(8,y-box.offsetHeight-10)}px`;
}
// Click a joint to zoom to it, a beer for its panel; empty space steps back out.
// A beer opens its panel and leaves the view as it is, however it was zoomed by hand.
function zoomInto(p){
  $('beer-tip').hidden=true;
  if(p!=null&&p>=1e6){openBeer(p-1e6);return;}
  manual=false;
  if(p==null)focus=focus!=null&&nodes[focus].level>1?parent[focus]:null;
  else focus=p||null;
  dirty=true;
}
// A beer's panel: its label and Untappd profile, the crowd's figures beside mine, and my
// check-ins of it, newest first, each a date and rating. Profiles load on first open.
let about=null,opened=null;
const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids.filter(k=>k!=null&&k!==false));return e;};
function panel(){
  let box=$('beer-dialog');if(box)return box;
  const close=el('button',{className:'icon-button beer-close',type:'button',ariaLabel:'Close',title:'Close',innerHTML:'<svg class="icon"><use href="#icon-x"/></svg>'});
  box=el('dialog',{className:'app-modal beer-modal',id:'beer-dialog'},
    el('header',{className:'beer-hero',id:'beer-hero'},el('div',{className:'beer-wash',id:'beer-wash'}),
      el('img',{className:'beer-label',id:'beer-label',alt:''}),
      el('div',{className:'beer-titles'},el('p',{className:'eyebrow',id:'beer-path'}),el('h2',{id:'beer-title'}),el('p',{className:'beer-brewery',id:'beer-brewery'})),
      close),
    el('div',{className:'app-modal-body',id:'beer-body'}));
  box.setAttribute('aria-labelledby','beer-title');close.onclick=()=>box.close();
  box.addEventListener('click',e=>{if(e.target===box)box.close();});
  box.addEventListener('close',()=>{opened=null;history.replaceState(null,'',location.pathname+location.search);dirty=true;});
  document.body.append(box);return box;
}
// The hero: the label large on a blurred wash of its own colours (or of the rating's
// colour where there is no label).
function hero(b,label){
  const tone=colour(mine[b]),img=$('beer-label'),wash=$('beer-wash');
  $('beer-hero').style.setProperty('--tone',tone);
  img.hidden=!label;if(label){img.src=label;wash.style.backgroundImage=`url("${label}")`;}else wash.style.backgroundImage='none';
  $('beer-hero').classList.remove('pop');void $('beer-hero').offsetWidth;$('beer-hero').classList.add('pop');
}
const stars=v=>v==null?'Unrated':`${v.toFixed(2)} ★`;
async function openBeer(b){
  setPlaying(false);opened=b;dirty=true;history.replaceState(null,'',`#beer-${b}`);
  const box=panel(),[name,brewery,abv,crowd]=data.beers[b];
  $('beer-path').textContent=path(facts[b].leaf).join(' · ');$('beer-title').textContent=name;$('beer-brewery').textContent=brewery||'';
  hero(b,null);$('beer-body').replaceChildren(el('p',{className:'county-empty'},'Loading…'));box.scrollTop=0;if(!box.open)box.showModal();
  try{about??=await (await fetch(new URL('about.json',location.href))).json();}catch{about=[];}
  if(opened!==b)return;
  const a=about[b]||{mine:[]},br=a.brewery||{},where=[br.city,br.state||br.country].filter(Boolean).join(', ');
  $('beer-brewery').textContent=[brewery,where,br.type].filter(Boolean).join(' · ');
  const facts2=el('dl',{className:'county-facts'}),fact=(k,v)=>{if(v!=null&&v!=='')facts2.append(el('dt',{textContent:k}),el('dd',{textContent:v}));};
  const my=mine[b],diff=my!=null&&crowd!=null?my-crowd:null;
  fact('Mine',my==null?'Unrated':my.toFixed(2));if(crowdReady)fact('Crowd',crowd==null?null:`${crowd.toFixed(2)}${a.ratings?` · ${a.ratings.toLocaleString('en-US')} ratings`:''}`);
  if(crowdReady)fact('Vs crowd',diff==null?null:signed(diff));fact('ABV',abv?`${abv}%`:null);fact('IBU',a.ibu||null);
  fact('Drinkers',a.drinkers?a.drinkers.toLocaleString('en-US'):null);fact('First had',date(facts[b].firstDay));
  hero(b,a.label);
  const head=a.description&&el('p',{className:'beer-description',textContent:a.description});
  const mineList=el('ol',{className:'beer-checkins'},...a.mine.slice(0,5).map(([d,r])=>el('li',{},
    el('span',{className:'beer-checkin-top'},el('span',{textContent:date(d)}),el('strong',{textContent:stars(r)})))));
  $('beer-body').replaceChildren(...[head,facts2,a.mine.length&&el('h3',{textContent:a.mine.length===1?'My check-in':'My latest check-ins'}),a.mine.length&&mineList,a.mine.length>5&&el('p',{className:'county-empty',textContent:`and ${a.mine.length-5} earlier`}),
    a.url&&el('p',{className:'county-links'},el('a',{href:a.url,target:'_blank',rel:'noopener',textContent:'On Untappd ↗'}))].filter(Boolean));
}
function controls(){
  $('present-play').onclick=()=>{if(playing){setPlaying(false);return;}settled=false;if(at>=end){at=0;shownSteps=-1;born.clear();joint.clear();}focus=null;manual=false;setPlaying(!reduced.matches);measureAt(at);};
  $('present-reset').onclick=settle;
  $('present-tools').addEventListener('click',e=>{if(e.detail)e.target.closest('button')?.blur();});
  $('present-full').onclick=()=>{const wrap=canvas.closest('.globe-wrap');if(document.fullscreenElement)document.exitFullscreen();else wrap.requestFullscreen?.().catch(()=>{});};
  document.addEventListener('fullscreenchange',()=>{const on=Boolean(document.fullscreenElement);caption($('present-full'),on?'Exit full screen':'Full screen',on?'shrink':'expand');dirty=true;});
  // Drag to pan, scroll or pinch to zoom; a tap that does not move zooms to what it hits.
  const pointers=new Map();let pinch=null,moved=false;
  const zoomAt=(px,py,factor)=>{const r=canvas.getBoundingClientRect(),f=frame(),x=(px-r.left-f.ox)/f.s,y=(py-r.top-f.oy)/f.s,s=Math.max(rest*.6,Math.min(rest*30,cam.s*factor));
    manual=true;cam={s,cx:x-(px-r.left-canvas.clientWidth/2)/s,cy:y-(py-r.top-TOP-(canvas.clientHeight-TOP-BOTTOM)/2)/s};$('beer-tip').hidden=true;dirty=true;};
  canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),s:cam.s};}};
  canvas.onpointermove=e=>{
    const p=pointers.get(e.pointerId);if(!p){if(e.pointerType==='mouse')tip(e);return;}
    if(pointers.size===2&&pinch){p.x=e.clientX;p.y=e.clientY;const [a,b]=[...pointers.values()];zoomAt((a.x+b.x)/2,(a.y+b.y)/2,pinch.s*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d/cam.s);moved=true;return;}
    const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dx)+Math.abs(dy)>3||moved){moved=true;manual=true;cam={...cam,cx:cam.cx-dx/cam.s,cy:cam.cy-dy/cam.s};p.x=e.clientX;p.y=e.clientY;$('beer-tip').hidden=true;dirty=true;}
  };
  canvas.onpointerup=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(!moved&&!pointers.size)zoomInto(pick(e));};
  canvas.onpointercancel=e=>{pointers.delete(e.pointerId);pinch=null;};
  canvas.onpointerleave=()=>{$('beer-tip').hidden=true;if(hover!=null){hover=null;dirty=true;}};
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,e.deltaY>0?.9:1.1);},{passive:false});
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.closest?.('input,select,textarea,summary,a')||document.querySelector('dialog[open]'))return;
    if(e.code==='Space'&&!e.repeat&&!e.target.closest?.('button')){e.preventDefault();$('present-play').click();}
    else if((e.key==='f'||e.key==='F')&&!e.repeat){e.preventDefault();$('present-full').click();}
    else if((e.key==='r'||e.key==='R')&&!e.repeat){e.preventDefault();settle();}
    else if(e.key==='Escape'&&(manual||focus!=null)){if(manual)manual=false;else zoomInto(null);dirty=true;}
    else if('+=-'.includes(e.key)&&e.key){e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(r.left+r.width/2,r.top+r.height/2,e.key==='-'?1/1.25:1.25);}
    else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();seek(Math.floor(at)+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?10:1));}
  });
  const bar=$('map-progress').parentElement,share=e=>{const r=bar.getBoundingClientRect();return (e.clientX-r.left)/r.width;};let resume=false;
  bar.onpointerdown=e=>{if(!data)return;resume=playing;setPlaying(false);bar.setPointerCapture(e.pointerId);bar.classList.add('dragging');seek(share(e)*end);};
  bar.onpointermove=e=>{if(bar.classList.contains('dragging'))seek(share(e)*end);};
  bar.onpointerup=bar.onpointercancel=()=>{if(!bar.classList.contains('dragging'))return;bar.classList.remove('dragging');if(resume&&at<end)setPlaying(true);};
  new ResizeObserver(()=>{if(!data||!lay)return;lay=pickLayout();rest=restScale();if(!manual)cam=null;dirty=true;}).observe(canvas);
  reduced.addEventListener('change',()=>{if(reduced.matches)setPlaying(false);});
  document.addEventListener('visibilitychange',()=>{last=0;});
  new MutationObserver(()=>{palette=theme();legend();dirty=true;}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
}
// The keys note, the scrubber, and a tick under it for each style's first beer.
function overlay(){
  const wrap=canvas.closest('.globe-wrap');
  if(!$('map-keys'))wrap.append(Object.assign(document.createElement('p'),{id:'map-keys',className:'map-keys',textContent:KEYS}));
  const bar=$('map-progress').parentElement;bar.classList.add('scrubber');bar.removeAttribute('aria-hidden');
  Object.entries({role:'slider','aria-label':'Playback position','aria-valuemin':0,'aria-valuemax':100}).forEach(([k,v])=>bar.setAttribute(k,v));
  if(!bar.querySelector('b'))bar.append(document.createElement('b'));
}
function events(){
  const bar=$('map-progress').parentElement,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','map-events');svg.setAttribute('viewBox','0 0 1000 6');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  const firstStep=new Map();beerAt.forEach((j,k)=>{const leaf=data.checkins[j][1];if(!firstStep.has(leaf))firstStep.set(leaf,k+1);});
  svg.innerHTML=[...firstStep.values()].map(k=>`<line x1="${(k/end*1000).toFixed(1)}" x2="${(k/end*1000).toFixed(1)}" y1="0" y2="6"/>`).join('');
  bar.append(svg);
}
async function load(url,report){
  const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);
  const total=+r.headers.get('content-length');if(!total||!r.body){const json=await r.json();report(1);return json;}
  const reader=r.body.getReader(),parts=[];let got=0;
  for(;;){const {done,value:v}=await reader.read();if(done)break;parts.push(v);got+=v.length;report(Math.min(1,got/total));}
  const bytes=new Uint8Array(got);let k=0;for(const part of parts){bytes.set(part,k);k+=part.length;}
  report(1);return JSON.parse(new TextDecoder().decode(bytes));
}
const progress=v=>$('load-status').style.setProperty('--load',v);
const pause=ms=>new Promise(done=>setTimeout(done,reduced.matches?0:ms));
export async function present({data:url}){
  canvas=$('beer-map');ctx=canvas.getContext('2d');palette=theme();document.body.classList.add('present-mode','loading');overlay();controls();
  try{
    progress(.04);data=await load(url,v=>progress(.04+.96*v));
    nodes=decodeNodes(data);parent=nodes.map(n=>n.parent);kids=nodes.map(()=>[]);for(const n of nodes)if(n.parent>=0)kids[n.parent].push(n.i);
    final=aggregate(data);stats=final;
    crowdReady=data.beers.filter(b=>b[3]!=null).length>=.95*data.beers.length;
    if(crowdReady){$('present-slot').append(group('present-colour','Colour',MODES,mode,setMode));for(const e of document.querySelectorAll('[data-crowd]'))e.hidden=false;}beerAt=beerSteps(data);end=beerAt.length;
    const all=beerFacts(data);facts=[];beersOf=nodes.map(()=>[]);for(const f of all){facts[f.beer]=f;beersOf[f.leaf].push(f.beer);}
    progress(1);await pause(400);
    events();legend();settle();requestAnimationFrame(tick);
    // A link to one beer (#beer-N) opens its panel.
    const linked=/^#beer-(\d+)$/.exec(location.hash);if(linked&&data.beers[+linked[1]])openBeer(+linked[1]);
    document.body.classList.remove('loading');$('load-status').classList.add('done');await pause(300);$('load-status').hidden=true;
  }catch(error){$('load-status').textContent='The beer record is unavailable';$('load-status').classList.add('failed');console.error(error);}
}
