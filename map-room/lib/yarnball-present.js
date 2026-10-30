// Presentation mode: every home chapter as a still, fully woven clock side by
// side; choosing one opens it full screen, finished, to weave again with play,
// pause, reset and a scrubber. No configuration is shown. The drawing follows the study's defaults:
// travel clipped at the 10-mile edge, weekdays and weekends in their two
// colours, and the weave that traces each day around the clock in turn.
// Shared by yarnball.html?present and the website, which pass their own
// loader: it resolves to [{city,name,years,center,days:[{date,weekend,distance}]}].
import {finiteRuns,decodeMiles,medians,medianTally,tallyDay,summarizeTally} from './timeline-data.js';
import {groupIndex} from './comparison.js';
import {readTheme} from './theme.js';
import {homeMap,homeSnapshot} from './home-map.js';

const SAMPLES=24*60/5+1,REACH=10,OPACITY=.15,DAYS_PER_SECOND=9,LONGEST_SECONDS=120;
// Nine days a second, faster only where a clock would otherwise play past two minutes.
const daysPerSecond=days=>Math.max(DAYS_PER_SECOND,days.length/LONGEST_SECONDS);
// A clock of many days would saturate at one opacity, so threads thin as the days add up
// past FULL_INK: less than in proportion, so a long chapter still reads as the densest.
const FULL_INK=700,INK_EXPONENT=.75,inkFor=days=>OPACITY*Math.min(1,(FULL_INK/days.length)**INK_EXPONENT);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const $=id=>document.getElementById(id);
let theme=readTheme(),chapters=[],years=[],view='homes',open=null;
// Real days (woven threads) or medians (each hour's median and a band): one choice for
// homes and years alike, days until changed.
let show='days';const mode=()=>show;

// Geometry of one clock in a square canvas of side `size` (CSS pixels).
function geometry(size,compact){
  const outer=size/2-(compact?14:46),inner=Math.max(compact?18:44,outer*.24);
  return {size,cx:size/2,cy:size/2,outer,inner,compact};
}
const radius=(g,miles)=>g.inner+(g.outer-g.inner)*Math.log1p(miles/.18)/Math.log1p(REACH/.18);
function point(g,index,miles){
  const angle=index/(SAMPLES-1)*Math.PI*2-Math.PI/2,r=radius(g,miles);
  return [g.cx+r*Math.cos(angle),g.cy+r*Math.sin(angle)];
}
function thread(g,day){
  const path=new Path2D();
  for(const [start,end]of finiteRuns(day.distance))for(let i=start;i<end;i++){const [x,y]=point(g,i,day.distance[i]);if(i===start)path.moveTo(x,y);else path.lineTo(x,y);}
  return path;
}
function prepare(canvas){
  const size=canvas.clientWidth,ratio=Math.min(devicePixelRatio||1,2),ctx=canvas.getContext('2d');
  canvas.width=canvas.height=Math.round(size*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
  return {ctx,size};
}
// The map inset fills the home ring.
function fitMap(element,g){const d=`${Math.max(0,g.inner*2-2)}px`;element.style.width=element.style.height=d;}
const clip=(ctx,g)=>{ctx.beginPath();ctx.arc(g.cx,g.cy,g.outer,0,Math.PI*2);ctx.clip();};
// Rings, hour ticks, and the centre label.
function face(ctx,g,chapter){
  ctx.clearRect(0,0,g.size,g.size);ctx.textAlign='center';ctx.textBaseline='middle';
  for(const miles of [0,.5,2,5,10]){
    ctx.beginPath();ctx.arc(g.cx,g.cy,radius(g,miles),0,Math.PI*2);ctx.strokeStyle=miles?theme.ring:theme.home;ctx.lineWidth=.7;ctx.stroke();
    if(miles&&!g.compact){
      const x=g.cx+radius(g,miles)*Math.cos(-Math.PI/4),y=g.cy+radius(g,miles)*Math.sin(-Math.PI/4),label=`${miles} mi`;
      ctx.font='9px "JetBrains Mono", monospace';const w=ctx.measureText(label).width;
      ctx.fillStyle=theme.paper;ctx.fillRect(x-w/2-3,y-6,w+6,12);ctx.fillStyle=theme.muted;ctx.fillText(label,x,y);
    }
  }
  for(let hour=0;hour<24;hour++){
    const angle=hour/24*Math.PI*2-Math.PI/2,major=hour%3===0,a=g.outer+(g.compact?3:5),b=g.outer+(g.compact?(major?8:5):(major?12:8));
    ctx.beginPath();ctx.moveTo(g.cx+a*Math.cos(angle),g.cy+a*Math.sin(angle));ctx.lineTo(g.cx+b*Math.cos(angle),g.cy+b*Math.sin(angle));ctx.strokeStyle=theme.home;ctx.lineWidth=.7;ctx.stroke();
    if(major&&!g.compact){
      const label=hour===0?'MIDNIGHT':hour===12?'NOON':`${hour>12?hour-12:hour}${hour<12?'a':'p'}`;
      ctx.font=hour%12===0?'9px "JetBrains Mono", monospace':'11px "DM Sans", sans-serif';ctx.fillStyle=theme.muted;
      ctx.fillText(label,g.cx+(g.outer+26)*Math.cos(angle),g.cy+(g.outer+26)*Math.sin(angle));
    }
  }
  // A small clock carries only its city code; the caption beneath names it.
  // The label sits on the map, so it gets a halo in the page colour.
  ctx.save();ctx.strokeStyle=theme.paper;ctx.lineWidth=3;ctx.lineJoin='round';ctx.fillStyle=theme.ink;
  const text=(font,value,y,fill=theme.ink)=>{ctx.font=font;ctx.strokeText(value,g.cx,y);ctx.fillStyle=fill;ctx.fillText(value,g.cx,y);};
  if(g.compact)text('500 10px "JetBrains Mono", monospace',chapter.city,g.cy);
  else{
    text('500 10px "JetBrains Mono", monospace',chapter.city,g.cy-14);
    // The name shrinks to sit inside the centre ring on a small screen.
    ctx.font='500 17px "DM Sans", sans-serif';const px=Math.max(11,Math.min(17,17*g.inner*1.7/ctx.measureText(chapter.name).width));
    text(`500 ${px.toFixed(1)}px "DM Sans", sans-serif`,chapter.name,g.cy+6);
    text('9px "JetBrains Mono", monospace',chapter.years,g.cy+24,theme.muted);
  }
  ctx.restore();
}
function weave(ctx,g,days,from,to){
  ctx.save();clip(ctx,g);ctx.lineWidth=.85;ctx.globalAlpha=inkFor(days);
  for(let k=from;k<to;k++){const day=days[k];ctx.strokeStyle=theme.groups[groupIndex(day,'weekday')];ctx.stroke(day.thread||(day.thread=thread(g,day)));}
  ctx.restore();
}
function still(entry){
  const {ctx,size}=prepare(entry.canvas),g=geometry(size,true),home=entry.kind!=='year';
  if(home)fitMap(entry.map,g);face(ctx,g,home?entry.chapter:{city:String(entry.year)});
  if(mode()==='medians')drawSummary(ctx,g,fullSummary(entry));
  else{for(const day of entry.days)day.thread=null;weave(ctx,g,entry.days,0,entry.days.length);}
  if(home)inset(entry,Math.round(g.inner*2-2));
}
// The year view: every day of a calendar year woven on one clock, as a home's are, each
// measured from the home I lived in that day.
function yearsOf(entries){
  const by=new Map();
  for(const {chapter,days}of entries)for(const day of days){
    const y=day.date.getUTCFullYear();if(!by.has(y))by.set(y,{year:y,days:[],cities:[]});
    const e=by.get(y);e.days.push(day);if(!e.cities.includes(chapter.city))e.cities.push(chapter.city);
  }
  // Days sorted by date: a year can interleave two homes, and playback adds them in order.
  return [...by.values()].sort((a,b)=>a.year-b.year).map(e=>({...e,days:e.days.sort((a,b)=>a.date-b.date),kind:'year'}));
}
// The median view's drawing (the statistics are in timeline-data.js); finished medians come
// with the data, worked out at build time, or are tallied here.
const fullSummary=entry=>entry.summary??=medians(entry.days);
// Playback: the medians of every day so far, eased between one day and the next.
function summaryAt(entry,progress){
  const days=entry.days,n=days.length;if(progress>=n)return fullSummary(entry);
  const a=Math.floor(progress),f=progress-a;
  let c=entry.playback;if(!c||c.at>a)c=entry.playback={counts:medianTally(),k:-1,at:-1,A:null,B:null};
  if(c.at!==a){
    while(c.k<a)tallyDay(c.counts,days[++c.k]);
    c.A=c.at===a-1&&c.B?c.B:summarizeTally(c.counts);
    if(a+1<n){tallyDay(c.counts,days[++c.k]);c.B=summarizeTally(c.counts);}else c.B=c.A;
    c.at=a;
  }
  const mix=(x,y)=>x.map((v,i)=>Number.isFinite(v)&&Number.isFinite(y[i])?v+(y[i]-v)*f:v);
  return c.A.map(ga=>{const gb=c.B.find(x=>x.group===ga.group);return gb?{group:ga.group,quantiles:ga.quantiles.map((q,j)=>mix(q,gb.quantiles[j]))}:ga;});
}
// A closed ring through 24 hourly radii (screen pixels), Catmull–Rom between them.
function ring(g,miles,path,reverse){
  const r=miles.map(m=>Math.min(g.outer+4,radius(g,Number.isFinite(m)?m:0))),steps=12,pts=[];
  for(let h=0;h<24;h++){
    const [p0,p1,p2,p3]=[-1,0,1,2].map(d=>r[(h+d+24)%24]);
    for(let s=0;s<steps;s++){const t=s/steps,v=.5*(2*p1+(p2-p0)*t+(2*p0-5*p1+4*p2-p3)*t*t+(3*p1-p0-3*p2+p3)*t*t*t),angle=(h+t)/24*Math.PI*2-Math.PI/2;pts.push([g.cx+Math.max(g.inner,v)*Math.cos(angle),g.cy+Math.max(g.inner,v)*Math.sin(angle)]);}
  }
  if(reverse)pts.reverse();
  pts.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath();
}
function drawSummary(ctx,g,summary){
  const groups=summary.map(({group,quantiles:[low,mid,high]})=>{
    const band=new Path2D(),median=new Path2D();ring(g,high,band,false);ring(g,low,band,true);ring(g,mid,median,false);
    return {group,band,median};
  });
  ctx.save();clip(ctx,g);
  // Both bands first, so neither covers the other's median.
  for(const {group,band}of groups){ctx.fillStyle=theme.groups[group];ctx.globalAlpha=.22;ctx.fill(band,'evenodd');}
  for(const {group,median}of groups){ctx.strokeStyle=theme.groups[group];ctx.globalAlpha=.95;ctx.lineWidth=1.5;ctx.stroke(median);}
  ctx.restore();
}
// The key, bottom left in every view: the two colours, and with medians what line and band mean.
function key(){
  let box=$('yarn-key');
  if(!box){box=Object.assign(document.createElement('p'),{id:'yarn-key',className:'yarn-key'});box.setAttribute('aria-hidden','true');(document.querySelector('.yarn-stage')||document.body).append(box);}
  const swatch=(group,words)=>`<span><i style="background:var(--group-${group})"></i>${words}</span>`;
  box.innerHTML=swatch(0,'Weekdays')+swatch(1,'Weekends')+(mode()==='medians'?`<span class="yarn-key-note">Line: median · band: middle quarter of days, by hour${open?' · playing, every day so far':''}</span>`:'');
}
// Redraw whichever gallery is showing (not the open clock).
function stills(){for(const entry of view==='years'?years:chapters)if(entry!==open&&entry.canvas)still(entry);}
// A still map picture for each small clock, redrawn when its size or the theme changes.
function inset(entry,size){
  const key=`${size} ${theme.dark}`;if(size<8||entry.insetKey===key)return;entry.insetKey=key;
  homeSnapshot(entry.chapter.center,theme,size).then(url=>{if(entry.insetKey===key)entry.map.style.backgroundImage=`url(${url})`;}).catch(()=>{entry.map.dataset.unavailable='true';});
}
// The full-screen player: finished days on one canvas, the day being woven on
// another, traced around the clock with a fading tail and a head, as in the study.
// A clock opens finished; Play weaves it again from the first day, Reset (R) settles
// it finished again, the arrows step a day (Shift ×10) and the progress line scrubs.
const player={entry:null,ctx:null,active:null,g:null,progress:0,drawn:0,playing:false,last:0,raf:0,map:null,settled:true};
const dateText=day=>day.date.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
const text=(id,value)=>{if($(id))$(id).textContent=value;};
// Buttons are text in the study and icons on the website: an icon button swaps its
// symbol (#icon-<name>) and keeps the words as its label.
function caption(button,words,icon){if(!button)return;const use=button.querySelector('use');if(!use){button.textContent=words;return;}use.setAttribute('href',`#icon-${icon}`);button.setAttribute('aria-label',words);button.title=words;}
function playerLabels(){
  const p=player,days=p.entry.days,shown=Math.min(days.length,Math.floor(p.progress)),current=days[Math.min(days.length-1,shown)];
  caption($('present-play'),p.playing?'Pause':p.progress>=days.length&&!p.settled?(mode()==='medians'?'Play again':'Weave again'):'Play',p.playing?'pause':'play');
  text('present-date',p.playing&&current?dateText(current):shown?dateText(days[shown-1]):'—');
  text('present-count',`${shown.toLocaleString('en-US')} of ${days.length.toLocaleString('en-US')} days`);
  const share=days.length?shown/days.length:0,bar=$('present-bar').parentElement;
  $('present-bar').style.transform=`scaleX(${share})`;bar.style.setProperty('--p',share);
  bar.setAttribute('aria-valuenow',Math.round(share*100));bar.setAttribute('aria-valuetext',`${$('present-date').textContent}, ${$('present-count').textContent}`);
}
function current(){
  const p=player,{ctx,g}={ctx:p.active,g:p.g},days=p.entry.days,k=Math.floor(p.progress);
  ctx.clearRect(0,0,g.size,g.size);
  if(mode()==='medians'||!p.playing||k>=days.length)return;
  const day=days[k],end=Math.floor((p.progress-k)*(SAMPLES-1)),color=theme.groups[groupIndex(day,'weekday')];
  ctx.save();clip(ctx,g);ctx.strokeStyle=ctx.fillStyle=color;ctx.lineWidth=1.3;
  for(let i=Math.max(1,end-50);i<=end;i++){
    if(!Number.isFinite(day.distance[i-1])||!Number.isFinite(day.distance[i]))continue;
    ctx.beginPath();ctx.moveTo(...point(g,i-1,day.distance[i-1]));ctx.lineTo(...point(g,i,day.distance[i]));ctx.globalAlpha=.12+.88*Math.max(0,1-(end-i)/50);ctx.stroke();
  }
  ctx.globalAlpha=1;if(Number.isFinite(day.distance[end])){ctx.beginPath();ctx.arc(...point(g,end,day.distance[end]),3.2,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
const yearFace=entry=>({city:entry.cities.join(' · '),name:String(entry.year),years:`${entry.days.length.toLocaleString('en-US')} days`});
function playerDraw(reset){
  const p=player,days=p.entry.days,target=Math.min(days.length,Math.floor(p.progress));
  const label=p.entry.kind==='year'?yearFace(p.entry):p.entry.chapter;
  if(mode()==='medians'){face(p.ctx,p.g,label);drawSummary(p.ctx,p.g,summaryAt(p.entry,p.progress));current();playerLabels();return;}
  if(reset||target<p.drawn){face(p.ctx,p.g,label);p.drawn=0;}
  weave(p.ctx,p.g,days,p.drawn,target);p.drawn=target;current();playerLabels();
}
function tick(now){
  const p=player;if(!p.playing)return;
  p.progress=Math.min(p.entry.days.length,p.progress+Math.max(0,Math.min((now-p.last)/1000,.1))*daysPerSecond(p.entry.days));p.last=now;
  if(p.progress>=p.entry.days.length)p.playing=false;
  playerDraw(false);
  if(p.playing)p.raf=requestAnimationFrame(tick);
}
function setPlaying(value){
  const p=player;p.playing=value&&!reduced.matches;cancelAnimationFrame(p.raf);
  if(p.playing){p.settled=false;if(p.progress>=p.entry.days.length){p.progress=0;playerDraw(true);}p.last=performance.now();p.raf=requestAnimationFrame(tick);}
  current();playerLabels();
}
function settle(){if(!player.entry)return;setPlaying(false);player.progress=player.entry.days.length;player.settled=true;playerDraw(true);}
// Jump to a day (from the scrubber or the arrow keys); playing carries on from there.
function seek(at){const p=player;if(!p.entry)return;p.progress=Math.max(0,Math.min(p.entry.days.length,at));p.settled=false;playerDraw(false);setPlaying(p.playing);}
function sizePlayer(){
  const p=player;if(!p.entry)return;
  const {ctx,size}=prepare($('present-canvas'));p.ctx=ctx;p.active=prepare($('present-active')).ctx;p.g=geometry(size,false);
  for(const day of p.entry.days)day.thread=null;
  $('present-map').hidden=p.entry.kind==='year';fitMap($('present-map'),p.g);playerDraw(true);
}
// The website's back button goes up one level: from an open clock to every clock, and only
// from there to Map Room.
function backLabel(){
  const back=document.querySelector('.bleed-back');if(!back)return;
  const words=open?'Yarnballs':'Map Room',node=[...back.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());
  if(node)node.textContent=words;back.setAttribute('aria-label',open?'Back to every yarnball':'Back to Map Room');
}
// The gallery offers By home or By year; an open clock offers its fellow homes (or years)
// instead, and the back button returns to the gallery.
function tabs(){
  if(!$('present-homes'))return;
  $('present-homes').hidden=!open||open.kind==='year';$('year-tabs').hidden=!open||open.kind!=='year';$('present-view').hidden=Boolean(open);
}
function pressShow(){for(const b of $('present-show')?.children||[])b.setAttribute('aria-pressed',String(b.dataset.value===mode()));}
// The website's tabs: which home's (or year's) clock is open.
function pressTab(value){for(const b of $(view==='years'?'year-tabs':'present-homes')?.querySelectorAll('button')||[]){const on=b.dataset.value===value;b.setAttribute('aria-pressed',String(on));if(on)b.scrollIntoView({block:'nearest',inline:'nearest'});}}
function openChapter(entry){
  if(open&&open!==entry)setPlaying(false);
  player.entry=entry;player.progress=entry.days.length;player.drawn=0;player.settled=true;
  const label=entry.kind==='year'?yearFace(entry):entry.chapter;
  text('present-city',label.city);text('present-name',label.name);text('present-years',label.years);
  $('present-overlay').hidden=false;document.body.classList.add('present-open');
  pressTab(String((entry.kind==='year'?years:chapters).indexOf(entry)));
  if(entry.kind!=='year'){
    if(player.map)player.map.setCenter(entry.chapter.center);else player.map=homeMap($('present-map'),theme,entry.chapter.center);
  }
  const from=open;open=entry;key();backLabel();tabs();sizePlayer();if(from&&from!==entry)still(from);
  // Focus moves to Play, off the tile that opened it, so the keys work at once; a home tab keeps it.
  if(!document.activeElement?.closest?.('#present-homes,#year-tabs'))$('present-play').focus({preventScroll:true});
}
function closeChapter(){
  setPlaying(false);$('present-overlay').hidden=true;document.body.classList.remove('present-open');
  const back=open;open=null;player.entry=null;key();backLabel();tabs();
  if(back){still(back);back.button.focus();}
}
function gallery(){
  const grid=$('present-grid');key();grid.classList.toggle('present-years',view==='years');
  if(view==='years'){
    grid.replaceChildren(...years.map(entry=>{
      const tile=document.createElement('button'),stage=document.createElement('span'),canvas=document.createElement('canvas'),caption=document.createElement('span');
      tile.className='present-tile';tile.setAttribute('aria-label',`${entry.year}, ${entry.days.length} days: open and weave`);tile.onclick=()=>openChapter(entry);
      stage.className='present-face';caption.className='present-caption';
      const city=document.createElement('span'),name=document.createElement('strong'),count=document.createElement('small');
      city.textContent=entry.cities.join(' · ');name.textContent=entry.year;count.textContent=`${entry.days.length.toLocaleString('en-US')} days`;
      stage.append(canvas);caption.append(city,name,count);tile.append(stage,caption);Object.assign(entry,{canvas,button:tile});return tile;
    }));
    // Five a row, as square as the count allows.
    const cols=Math.min(5,Math.ceil(Math.sqrt(years.length)));grid.style.setProperty('--cols',cols);grid.style.setProperty('--rows',Math.ceil(years.length/cols));
    stills();return;
  }
  grid.replaceChildren(...chapters.map(entry=>{
    const button=document.createElement('button'),stage=document.createElement('span'),map=document.createElement('span'),canvas=document.createElement('canvas'),caption=document.createElement('span');
    button.className='present-tile';button.setAttribute('aria-label',`${entry.chapter.name}, ${entry.chapter.years}: open and weave`);
    stage.className='present-face';map.className='present-map';canvas.setAttribute('aria-hidden','true');caption.className='present-caption';
    const city=document.createElement('span'),name=document.createElement('strong'),years=document.createElement('small');
    city.textContent=entry.chapter.city;name.textContent=entry.chapter.name;years.textContent=`${entry.chapter.years} · ${entry.days.length.toLocaleString('en-US')} days`;
    stage.append(map,canvas);caption.append(city,name,years);button.append(stage,caption);
    button.onclick=()=>openChapter(entry);
    Object.assign(entry,{button,canvas,map});return button;
  }));
  // Up to four homes sit in a row; more make two rows.
  const cols=chapters.length<=4?chapters.length:Math.ceil(chapters.length/2);grid.style.setProperty('--cols',cols);grid.style.setProperty('--rows',Math.ceil(chapters.length/cols));
  for(const entry of chapters)still(entry);
}
function build(){
  gallery();
  const slot=$('present-slot');if(!slot)return;
  // By home (a clock per home, to open and weave) or by year (a summary clock per year).
  const v=document.createElement('div');v.className='segmented';v.id='present-view';v.setAttribute('role','group');v.setAttribute('aria-label','View');
  v.append(...[['homes','By home'],['years','By year']].map(([value,words])=>{
    const b=document.createElement('button');b.dataset.value=value;b.textContent=words;b.setAttribute('aria-pressed',String(value===view));
    b.onclick=()=>{if(view===value)return;if(open)closeChapter();view=value;for(const x of v.children)x.setAttribute('aria-pressed',String(x===b));tabs();gallery();};return b;}));
  // Days or medians, for homes and years alike.
  const m=document.createElement('div');m.className='segmented';m.id='present-show';m.setAttribute('role','group');m.setAttribute('aria-label','Show');
  m.append(...[['days','Days'],['medians','Medians']].map(([value,words])=>{
    const b=document.createElement('button');b.dataset.value=value;b.textContent=words;
    b.onclick=()=>{if(mode()===value)return;show=value;pressShow();key();stills();if(open){setPlaying(false);sizePlayer();}};return b;}));
  const g=document.createElement('div');g.className='segmented';g.id='present-homes';g.setAttribute('role','group');g.setAttribute('aria-label','Home');
  // Tabs carry each home's name, since two homes can share a city.
  g.append(...chapters.map((e,i)=>{
    const b=document.createElement('button');b.dataset.value=String(i);b.textContent=e.chapter.name;b.setAttribute('aria-pressed','false');
    b.title=`${e.chapter.city} · ${e.chapter.years}`;b.onclick=()=>openChapter(e);return b;}));
  const y=document.createElement('div');y.className='segmented';y.id='year-tabs';y.setAttribute('role','group');y.setAttribute('aria-label','Year');y.hidden=view!=='years';
  y.append(...years.map((e,i)=>{
    const b=document.createElement('button');b.dataset.value=String(i);b.textContent=String(e.year);b.setAttribute('aria-pressed','false');
    b.title=`${e.cities.join(' · ')} · ${e.days.length} days`;b.onclick=()=>openChapter(e);return b;}));
  // Days or medians sits with the buttons on the right, as Follow and Fixed do on the maps.
  slot.replaceChildren(v,g,y);(document.querySelector('.present-buttons')||slot).prepend(m);pressShow();tabs();
}
function repaint(){
  theme=readTheme();
  stills();
  player.map?.setTheme(theme);if(open)sizePlayer();
}
// The progress line is a scrubber: click to jump, drag; play resumes on release.
function scrubber(){
  const bar=$('present-bar').parentElement,share=e=>{const r=bar.getBoundingClientRect();return (e.clientX-r.left)/r.width;};
  if(bar.classList.contains('map-progress')){bar.classList.add('scrubber');bar.removeAttribute('aria-hidden');if(!bar.querySelector('b'))bar.append(document.createElement('b'));}
  Object.entries({role:'slider','aria-label':'Playback position','aria-valuemin':0,'aria-valuemax':100}).forEach(([k,v])=>bar.setAttribute(k,v));
  let resume=false;const days=()=>player.entry.days.length;
  bar.onpointerdown=e=>{if(!player.entry)return;resume=player.playing;setPlaying(false);bar.setPointerCapture(e.pointerId);bar.classList.add('dragging');seek(share(e)*days());};
  bar.onpointermove=e=>{if(bar.classList.contains('dragging'))seek(share(e)*days());};
  bar.onpointerup=bar.onpointercancel=()=>{if(!bar.classList.contains('dragging'))return;bar.classList.remove('dragging');if(resume&&player.progress<days())setPlaying(true);};
}
// Fetch JSON, reporting the share received (0–1) when the server gives a length.
export async function fetchJson(url,report=()=>{}){
  const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);
  const total=+r.headers.get('content-length');
  if(!total||!r.body){const json=await r.json();report(1);return json;}
  const reader=r.body.getReader(),parts=[];let got=0;
  for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);got+=value.length;report(Math.min(1,got/total));}
  const bytes=new Uint8Array(got);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}
  report(1);return JSON.parse(new TextDecoder().decode(bytes));
}
const FILL=400,FADE=300,pause=ms=>new Promise(done=>setTimeout(done,reduced.matches?0:ms));
// load(report) resolves to the chapters; report(0–1) fills the website's loading line.
export async function present(load){
  document.body.classList.add('present-mode','present-yarnball');
  const status=$('load-status')||$('present-status'),progress=value=>status.style.setProperty('--load',value);
  $('present-play').onclick=()=>setPlaying(!player.playing);
  $('present-reset').onclick=settle;
  if($('present-close'))$('present-close').onclick=closeChapter;
  document.querySelector('.bleed-back')?.addEventListener('click',e=>{if(open){e.preventDefault();closeChapter();}});
  // A click leaves no button holding focus, so Space and the arrows keep driving playback.
  $('present-tools')?.addEventListener('click',e=>{if(e.detail)e.target.closest('button')?.blur();});
  const stage=$('present-overlay').closest('.bleed-stage')||$('present-overlay');
  if($('present-full'))$('present-full').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else stage.requestFullscreen?.().catch(()=>{});};
  document.addEventListener('fullscreenchange',()=>{const on=Boolean(document.fullscreenElement);caption($('present-full'),on?'Exit full screen':'Full screen',on?'shrink':'expand');});
  scrubber();
  // The website's toolbar wraps on narrow screens; the stage keeps clear of its height.
  if($('present-tools'))new ResizeObserver(([e])=>document.documentElement.style.setProperty('--tools',`${Math.ceil(e.target.getBoundingClientRect().bottom)}px`)).observe($('present-tools'));
  // Space plays and pauses; left and right step a day (ten with Shift), held to run;
  // R settles the clock finished; F toggles full screen; Escape goes back to every home.
  document.addEventListener('keydown',e=>{
    if(!open||e.metaKey||e.ctrlKey||e.altKey||e.target.closest?.('input,select,textarea,summary,a')||document.querySelector('dialog[open]'))return;
    if(e.key==='Escape'){if(!document.fullscreenElement)closeChapter();}
    else if(e.code==='Space'&&!e.repeat&&!e.target.closest('button')){e.preventDefault();setPlaying(!player.playing);}
    else if((e.key==='r'||e.key==='R')&&!e.repeat){e.preventDefault();settle();}
    else if((e.key==='f'||e.key==='F')&&!e.repeat&&$('present-full')){e.preventDefault();$('present-full').click();}
    else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();seek(Math.floor(player.progress)+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?10:1));}
  });
  // Follow the page theme, whoever sets it.
  new MutationObserver(repaint).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',repaint);
  let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{stills();sizePlayer();},120);}).observe($('present-grid'));
  try{
    progress(.04);
    const loaded=await load(v=>progress(.04+.96*v));
    chapters=loaded.filter(c=>c.days.length).map(chapter=>({chapter,days:chapter.days,summary:chapter.medians}));
    years=yearsOf(chapters);for(const y of years)y.summary=loaded.yearMedians?.[y.year];
    progress(1);if($('load-status'))await pause(FILL);
    build();document.body.classList.remove('loading');status.classList.add('done');
    if($('load-status'))await pause(FADE);status.hidden=true;
  }catch(error){status.textContent='The home chapters are unavailable';status.classList.add('failed');console.error(error);}
}
// Public data: one [date, encodeMiles text] row per day, and the finished medians of every
// home and year (null where a reading is missing).
const unnull=summary=>summary?.map(({group,quantiles})=>({group,quantiles:quantiles.map(q=>q.map(v=>v??NaN))}));
export function decodeChapters(data){
  const out=data.chapters.map((c,i)=>({...c,medians:unnull(data.medians?.homes[i]),days:c.days.map(([date,miles])=>{
    const d=new Date(date+'T12:00:00Z'),weekday=d.getUTCDay();
    return {date:d,weekend:weekday===0||weekday===6,distance:decodeMiles(miles)};
  })}));
  out.yearMedians=Object.fromEntries(Object.entries(data.medians?.years??{}).map(([y,m])=>[y,unnull(m)]));
  return out;
}
