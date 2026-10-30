// Presentation mode: the map opens fully accumulated and still, framed on the
// whole country, with the shading choice on top of it. Play rebuilds the record
// one new county per beat, evenly timed however far apart the visits were (under
// Swarm, in the order first checked in), with the camera on the counties around
// it; Reset settles it again. Hover a county for its record; click it for a box with
// the whole record and, where the page has them, a portrait of the county. Every
// state highpoint is a ring that fills in once climbed and its county has appeared.
// Shared by counties.html?present and the website, which pass their own data and
// asset locations; data is publicCounties()' shape, plus `highpoints` on the website.
import {INKS,EVIDENCE,evidence,STEPS,stepOf,decodeTopology,stateBorders,buildChronology,presence,firstVisits,rowRange,dayDate,dayLabel,dayIndex,formatHours,recordAsOf} from './counties-model.js';
import {createScene,countyAt,drawCounties} from './counties-renderer.js';
import {MIN_ZOOM,MAX_ZOOM,homeView,fitPoints,easeView,settled,projector,unproject,globeRadius} from './counties-camera.js';
import {readTheme} from './theme.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
// TOTAL: counties and equivalents in the 50 states and DC as the Census now counts them
// (the boundary file predates Alaska's 2019 split of Valdez-Cordova in two).
const COUNTIES_PER_SECOND=14,BEHIND=2,AHEAD=24,EASE=3,STATES=56,TOTAL=3144;
// Named for where each view's data comes from: Google Timeline, Swarm check-ins, the hand-kept tags, all together.
const MODES=[['evidence','All Sources'],['time','Google'],['checkins','Swarm'],['manual','Manual']];
let canvas,palette=readTheme(),data,chron,scene,manualLabel={},checkins=new Map();
// peaks: [{name,state,feet,at,date,day,fips}], day null if not climbed. about: where the per-state portraits live.
let peaks=[],about=null;const portraits=new Map();
// Play's order: counties as first recorded by Google, or under Swarm as first checked in.
// steps: [{fips,day}]; rank: fips→step. shown: states-and-DC counties the map colours now.
let sequences={},steps=[],rank=new Map(),shown=0;
let first=0,final=0,position=0,playing=false,last=0,camera='watch',framing='country',viewMode='follow',dirty=true,lastDay=-1,selected=null,frame=null;
const style={mode:'evidence',borders:true};
const size=()=>({width:canvas.clientWidth||1000,height:canvas.clientHeight||620});
const home=()=>homeView(size().width,size().height);
let view=homeView(),goal={...view};
const goals=new Map();
const inks=()=>INKS[palette.dark?'dark':'light'];
const ended=()=>position>=steps.length;
const step=()=>Math.min(steps.length-1,Math.floor(position));
const currentDay=()=>ended()?final:steps[step()].day;
const reached=fips=>!rank.has(fips)||rank.get(fips)<=step();
// A highpoint fills once the walk has reached its county and its climb date has passed,
// so a ring never fills ahead of the county around it. `k` is a step (default: now).
const climbedBy=(p,k=step())=>ended()&&k===step()?p.day!==null:p.day!==null&&p.day<=steps[k].day&&(!rank.has(p.fips)||rank.get(p.fips)<=k);
const label=day=>dayLabel(chron.start,day);
function countyName(fips){const meta=data.counties[fips];return meta?`${meta.name}, ${meta.state}`:`${scene.byId.get(fips)?.name||fips}, ${data.states[fips.slice(0,2)]||''}`;}
function checkinsTo(fips,day){const days=checkins.get(fips);return days?rowRange(days,first,day).reduce((lo,hi)=>hi-lo):0;}
// One colour per step, from the mode's ramp; the first starts in from the pale end so it
// stands off the land in either theme.
function ramp(){const ink=inks(),shade=d3.interpolateLab(...ink.seq),n=STEPS[style.mode==='checkins'?'checkins':'hours'].edges.length;return d3.range(n).map(i=>shade(.15+.85*i/(n-1)));}
// Within a day, a county's record counts once the path has got to it: a county already on the
// map that gets more time or a check-in later in the day waits for its turn in the day's order
// (from the record), so it doesn't step up while the drive is still a few counties off.
const asOf=(fips,day)=>ended()?day:recordAsOf(chron,steps,step(),fips);
function compose(){
  const day=currentDay();
  const ink=inks(),fills=new Map(),values=new Map();
  for(const [fips,meta]of Object.entries(data.counties)){
    const upTo=reached(fips)?asOf(fips,day):day,series=chron.series.get(fips),p=reached(fips)?presence(series,first,upTo):null;
    let color=null;
    if(style.mode==='time'){if(p){values.set(fips,p.hours);continue;}}
    else if(style.mode==='checkins'){const n=reached(fips)?checkinsTo(fips,upTo):0;if(n){values.set(fips,n);continue;}}
    // A tag with no recorded visit shows from the start;
    // the rest appear on the day they were first recorded.
    else if(style.mode==='manual'){if(meta.manual&&reached(fips))color=ink.tags[meta.manual];}
    // As under Manual, a tag waits for the county's first record unless it has none.
    else color=ink.evidence[evidence(p,reached(fips)&&checkinsTo(fips,upTo)>0,meta.manual&&reached(fips))];
    // Tagged counties not yet recorded are hinted at under time spent.
    if(!color&&meta.manual&&style.mode==='time'){fills.set(fips,ink.tagged);continue;}
    if(color)fills.set(fips,color);
  }
  // The count matches the map: whatever the tab colours, less the grey hint.
  shown=[...fills.keys(),...values.keys()].filter(f=>fills.get(f)!==ink.tagged&&+f.slice(0,2)<=STATES).length;
  if(style.mode==='time'||style.mode==='checkins'){
    const colors=ramp(),{edges}=STEPS[style.mode==='checkins'?'checkins':'hours'];
    for(const [fips,v]of values)fills.set(fips,colors[stepOf(v,edges)]);
  }
  const k=step();
  frame={fills,today:ended()?[]:[steps[k].fips],selected,markers:[],
    peaks:peaks.map(p=>{const done=climbedBy(p);return {at:p.at,done,fresh:done&&!ended()&&k>0&&!climbedBy(p,k-1)};})};
}
// Fit this county, the last couple and the next couple of seconds' worth, so the
// camera is already moving toward where the record goes next and the newest county stays in view.
function cameraGoal(k){
  if(viewMode==='fixed'||framing==='country'||ended())return home();
  if(goals.has(k))return goals.get(k);
  const boxes=steps.slice(Math.max(0,k-BEHIND),k+AHEAD+1).map(s=>scene.byId.get(s.fips)).filter(Boolean).map(item=>[...item.center,item.reach]);
  if(!boxes.length)return null;
  const fitted=fitPoints(boxes,size());goals.set(k,fitted);return fitted;
}
// Every view gets the same key: a strip of swatches with a label under each, stepped
// for hours and check-ins, one cell per category otherwise.
function key(){
  const box=$('map-key'),ink=inks();box.hidden=!data;if(box.hidden)return;
  const items=style.mode==='time'||style.mode==='checkins'?((labels,colors)=>labels.map((label,i)=>[colors[i],label]))(STEPS[style.mode==='checkins'?'checkins':'hours'].labels,ramp())
    :style.mode==='manual'?data.manual.legend.map(({code,label})=>[ink.tags[code],label]):EVIDENCE.map(([kind,label])=>[ink.evidence[kind],label]);
  box.replaceChildren(...items.map(([color,label])=>{const s=document.createElement('span'),i=document.createElement('i');i.style.background=color;s.append(i,label);return s;}));
}
function labels(){
  const k=step(),date=dayDate(chron.start,currentDay());
  $('map-date').textContent=date.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
  $('map-tally').textContent=`${shown.toLocaleString('en-US')} of ${TOTAL.toLocaleString('en-US')} counties (${(100*shown/TOTAL).toFixed(1)}%)`;
  if(peaks.length)$('map-peaks').lastChild.textContent=`${peaks.filter(p=>climbedBy(p)).length} of ${peaks.length} state highpoints`;
  const bar=$('map-progress').parentElement,share=Math.min(1,position/steps.length);
  bar.style.setProperty('--p',share);bar.setAttribute('aria-valuenow',Math.round(share*100));bar.setAttribute('aria-valuetext',`${$('map-date').textContent}, ${$('map-tally').textContent}`);
}
function frameCamera(){if(camera!=='watch'||!scene)return;goal=cameraGoal(step())||goal;if(reduced.matches)view={...goal};}
// Buttons are text in the study and icons on the website: an icon button swaps its
// symbol (#icon-<name>) and keeps the words as its label.
function caption(button,text,icon){const use=button.querySelector('use');if(!use){button.textContent=text;return;}use.setAttribute('href',`#icon-${icon}`);button.setAttribute('aria-label',text);button.title=text;}
function setPlaying(value){playing=value&&Boolean(data);const text=playing?'Pause':ended()&&framing==='follow'?'Replay':'Play';caption($('present-play'),text,playing?'pause':'play');last=0;}
function settle(){setPlaying(false);position=steps.length;framing='country';camera='watch';goals.clear();frameCamera();view={...goal};lastDay=-1;dirty=true;if(data){compose();labels();}}
// Jump to a point in the walk (from the scrubber or the arrow keys); playing carries on from there.
function seek(at){
  if(!data||style.mode==='manual')return;
  position=Math.max(0,Math.min(steps.length,at));framing=ended()?'country':'follow';camera='watch';
  goals.clear();lastDay=-1;setPlaying(playing);compose();labels();dirty=true;
}
function sequence(list){return {steps:list,rank:new Map(list.map((s,i)=>[s.fips,i]))};}
const press=(group,value)=>{for(const b of $(group).querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.value===value));};
// Every tab opens finished, on the lower 48. Manual is a hand-kept map with no
// dates worth playing, so it has no Play.
function setMode(mode){
  style.mode=mode;press('present-modes',mode);$('present-play').hidden=$('present-view').hidden=$('map-progress').parentElement.hidden=mode==='manual';
  $('map-keys').textContent=mode==='manual'?'R reset · F full screen · Esc exit':'Space play/pause · ← → step (Shift ×10) · R reset · F full screen · Esc exit';
  if(data){({steps,rank}=sequences[mode==='checkins'?'swarm':mode==='evidence'?'evidence':'google']);settle();}
  key();lastDay=-1;dirty=true;
}
// Follow frames the counties being added; Fixed holds the lower 48 (choosing it
// eases back there). Dragging or zooming the map switches to Fixed where it is.
function setView(mode,move=true){viewMode=mode;press('present-view',mode);if(move){camera='watch';goals.clear();frameCamera();dirty=true;}}
const explore=()=>{camera='explore';if(viewMode!=='fixed')setView('fixed',false);};
function draw(){if(!frame)return;frame.selected=selected;drawCounties(canvas,scene,view,frame,style,palette);dirty=false;}
function tick(now){
  const dt=last?Math.min((now-last)/1000,.1):0;last=now;
  if(playing&&!document.hidden){
    position+=dt*COUNTIES_PER_SECOND;
    // At the end the camera pulls back to the whole record.
    if(ended()){position=steps.length;setPlaying(false);framing='country';lastDay=-1;}
    labels();dirty=true;
  }
  const key=ended()?-2:step();
  if(key!==lastDay){lastDay=key;compose();frameCamera();labels();dirty=true;}
  if(camera==='watch'&&!reduced.matches&&!document.hidden&&!settled(view,goal)){view=easeView(view,goal,dt,EASE);dirty=true;}
  if(dirty)draw();
  requestAnimationFrame(tick);
}
function zoom(factor,cx=canvas.clientWidth/2,cy=canvas.clientHeight/2){
  explore();
  // Keep the place under the cursor where it is while the scale changes.
  const {width,height}=size(),under=unproject(view,width,height,cx,cy);
  view.zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,view.zoom*factor));
  for(let pass=0;under&&pass<4;pass++){
    const p=projector(view,width,height)(...under);if(!p)break;
    const degrees=180/Math.PI/globeRadius(view,width,height);
    view.lon+=(p[0]-cx)*degrees/Math.max(.2,Math.cos(view.lat*Math.PI/180));view.lat=Math.max(-85,Math.min(85,view.lat-(p[1]-cy)*degrees));
  }
  dirty=true;
}
const local=e=>{const rect=canvas.getBoundingClientRect();return [e.clientX-rect.left,e.clientY-rect.top];};
const pick=e=>scene?countyAt(scene,view,canvas.clientWidth,canvas.clientHeight,...local(e)):null;
// The highpoint ring under the pointer, if any.
function peakAt(e){
  if(!peaks.length)return null;
  const project=projector(view,size().width,size().height),[x,y]=local(e);
  let best=null,near=9;
  for(const p of peaks){const xy=project(...p.at);if(!xy)continue;const d=Math.hypot(xy[0]-x,xy[1]-y);if(d<near){near=d;best=p;}}
  return best;
}
const isoLabel=iso=>new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const climbed=p=>p.day===null?'Not climbed yet':climbedBy(p)?`Climbed ${isoLabel(p.date)}`:'Not climbed by this date';
function tip(e){
  const peak=peakAt(e),fips=peak?null:pick(e),box=$('county-tip');
  if(!fips&&!peak){box.hidden=true;return;}
  if(peak){
    const name=document.createElement('strong');name.textContent=peak.name;
    box.replaceChildren(name,`${peak.state} highpoint · ${peak.feet.toLocaleString('en-US')} ft`,document.createElement('br'),climbed(peak));
  }else{
  const p=presence(chron.series.get(fips),first,currentDay()),meta=data.counties[fips],name=document.createElement('strong'),lines=[];
  name.textContent=countyName(fips);
  lines.push(p?`${formatHours(p.hours)} · ${p.days} ${p.days===1?'day':'days'}`:'Not recorded by this date');
  if(style.mode==='checkins'){const n=checkinsTo(fips,currentDay());lines.push(`${n.toLocaleString('en-US')} ${n===1?'check-in':'check-ins'} by this date`);}
  if(p)lines.push(p.first===p.last?label(p.first):`${label(p.first)} – ${label(p.last)}`);
  if(meta?.manual)lines.push(`Manual: ${manualLabel[meta.manual]}`);
  box.replaceChildren(name,...lines.flatMap((line,i)=>i?[document.createElement('br'),line]:[line]));
  }
  const [x,y]=local(e);box.hidden=false;
  box.style.left=`${Math.min(x+14,canvas.clientWidth-box.offsetWidth-8)}px`;box.style.top=`${Math.max(8,y-box.offsetHeight-10)}px`;
}
// The box a click opens. A county: the whole record here, and a portrait of the county
// from Wikipedia. A highpoint: the climb (the turning terrain, route, order, the photos on
// bdharva.com), and a portrait of the peak. Each links to the other.
const el=(tag,props={},...kids)=>{const n=Object.assign(document.createElement(tag),props);n.append(...kids.filter(k=>k!==null&&k!==undefined&&k!==false));return n;};
const n=v=>v.toLocaleString('en-US'),ordinal=v=>n(v)+(['th','st','nd','rd'][v%100>10&&v%100<14?0:v%10]||'th'),plural=(v,one,many=`${one}s`)=>`${n(v)} ${v===1?one:many}`;
function duration(h){
  if(h<1)return plural(Math.max(1,Math.round(h*60)),'minute');
  if(h<48)return plural(Math.round(h),'hour');
  const d=h/24;return `${d<10?d.toFixed(1):n(Math.round(d))} days (${n(Math.round(h))} hours)`;
}
const facts=(rows)=>el('dl',{className:'county-facts'},...rows.filter(([,v])=>v).flatMap(([k,v])=>[el('dt',{},k),el('dd',{},v)]));
const block=(title,...kids)=>el('section',{className:'county-block'},el('h3',{},title),...kids);
const link=(href,text)=>el('a',{href,target:'_blank',rel:'noopener'},text);
const jump=(text,go)=>{const b=el('button',{type:'button',className:'box-jump',textContent:`${text} →`});b.onclick=go;return b;};
const TABS={county:[['record','My record'],['about','About the county']],peak:[['climb','My climb'],['peak','About the peak']]};
const tabs={county:'record',peak:'climb'};
let boxed=null;   // {kind, key}: what the box holds
function countyTitle(fips){const meta=data.counties[fips],item=scene.byId.get(fips);return `${meta?.name||item?.name||fips}`;}
function record(fips){
  const meta=data.counties[fips],s=chron.series.get(fips),p=presence(s,first,final),days=checkins.get(fips)||[],out=[];
  const order=(name,fips)=>{const {rank,steps}=sequences[name];return rank.has(fips)?`${ordinal(rank.get(fips)+1)} of ${n(steps.length)}`:null;};
  if(p)out.push(block('Google Timeline',facts([['Time here',duration(p.hours)],['Days here',n(p.days)],['First',label(p.first)],['Last',label(p.last)],['County reached',order('google',fips)]])));
  if(days.length)out.push(block('Swarm',facts([['Check-ins',n(days.length)],['Places',data.venues?.[fips]&&n(data.venues[fips])],['Days',n(new Set(days).size)],
    ['First',label(days[0])],['Last',label(days.at(-1))],['County reached',order('swarm',fips)]])));
  if(meta?.manual){const swatch=el('i',{className:'county-swatch'});swatch.style.background=inks().tags[meta.manual];
    out.push(block('Manual',facts([['Tag',el('span',{},swatch,manualLabel[meta.manual])],['Placed with',data.slotted?.[fips]&&`the trip of ${label(data.slotted[fips][0])}`]])));}
  for(const peak of peaks.filter(peak=>peak.fips===fips))
    out.push(block('State highpoint',facts([['Summit',jump(`${peak.name}, ${n(peak.feet)} ft`,()=>openPeak(peak))],['Climbed',peak.date?isoLabel(peak.date):'Not yet']])));
  return out.length?out:[el('p',{className:'county-empty'},'Nothing recorded here yet.')];
}
async function portrait(fips){
  const state=fips.slice(0,2);
  if(!portraits.has(state))portraits.set(state,fetch(`${about}${state}.json`).then(r=>r.ok?r.json():{}).catch(()=>({})));
  return (await portraits.get(state))[fips];
}
function photo(image){
  if(!image)return null;
  const img=el('img',{src:image.src,alt:'',loading:'lazy',decoding:'async',referrerPolicy:'no-referrer'});img.onerror=()=>img.closest('figure')?.remove();
  return el('figure',{className:'county-photo'},img,el('figcaption',{},link(image.page,[image.artist,image.license].filter(Boolean).join(' · ')||'Wikimedia Commons')));
}
// The lead, the extra section under its heading, and links and credits.
function prose(entry,heading,more,links=[]){
  const wiki=`https://en.wikipedia.org/wiki/${encodeURIComponent(entry.title.replaceAll(' ','_'))}`;
  return [...(entry.lead||[]).map(text=>el('p',{},text)),...(more?.length?[el('h3',{},heading),...more.map(text=>el('p',{},text))]:[]),
    el('p',{className:'county-links'},link(wiki,'Wikipedia'),...links),
    el('p',{className:'map-credit'},'Text from ',link(wiki,'Wikipedia'),', CC BY-SA 4.0; facts from Wikidata; photo from Wikimedia Commons.')];
}
function portraitView(fips,entry){
  if(!entry)return [el('p',{className:'county-empty'},'No portrait of this county yet.')];
  return [photo(entry.image),facts([['Seat',entry.seat?.join(', ')],['Founded',entry.founded],['Named for',entry.named?.join(', ')],
    ['Population',entry.population&&`${n(entry.population.count)}${entry.population.year?` (${entry.population.year})`:''}`],['Area',entry.areaSqMi&&`${n(entry.areaSqMi)} sq mi`]]),
    ...prose(entry,'History',entry.history,entry.website?[link(entry.website,'Official site')]:[])].filter(Boolean);
}
// Highpoint terrain, fetched the first time a climb is shown; one height scale for every peak.
let terrain=null,assetsUrl='assets/';
function loadTerrain(){
  terrain??=Promise.all([fetch(`${assetsUrl}highpoints.json`).then(r=>r.json()),import('./highpoints-draw.js'),import('./highpoints-model.js')]).then(([json,draw,model])=>{
    const byId=new Map(json.peaks.map(p=>[p.id,p]));
    return {byId,draw,model,tallest:Math.max(...json.peaks.map(p=>draw.prepare(p,8).mesh.top))};
  });
  return terrain;
}
const inCounty=peak=>peak.fips&&jump(`${countyTitle(peak.fips)} County, ${peak.state}`.replace(/ County County/,' County'),()=>open(peak.fips));
function climbView(peak){
  const climbs=peaks.filter(p=>p.date).sort((a,b)=>a.date.localeCompare(b.date)),out=[];
  if(!peak.date)return [el('p',{className:'county-empty'},'Not climbed yet.'),facts([['Summit',`${n(peak.feet)} ft`],['County',inCounty(peak)]])];
  const canvas=el('canvas',{className:'peak-mesh'});canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Turning wireframe of the terrain around ${peak.name}, with the route to the summit.`);
  const figure=el('figure',{className:'peak-terrain'},canvas,el('figcaption',{},'Five miles across, heights doubled, the route in green'));
  const rows=el('div');
  out.push(figure,rows);
  loadTerrain().then(({byId,draw,model,tallest})=>{
    const t=byId.get(peak.id);if(!t||!canvas.isConnected){figure.remove();return;}
    const gain=model.isHike(t)?(p=>Math.max(0,Math.round(Math.max(...p.map(x=>x.feet))-p[0].feet)))(model.profile(t)):null;
    rows.replaceWith(facts([['Climbed',isoLabel(peak.date)],['Order',`${ordinal(climbs.indexOf(peak)+1)} of ${climbs.length} so far`],['Summit',`${n(peak.feet)} ft`],
      ['Route',model.isHike(t)?t.routeName:'Drive up, a short walk'],['Distance',model.isHike(t)&&`${model.miles(t.routeKm)}${t.loop?' loop':' each way'}`],['Climb',gain&&`${n(gain)} ft`],['County',inCounty(peak)]]));
    const item=draw.prepare(t),box=$('county-dialog');let angle=.6,last=0;
    const frame=now=>{
      if(!canvas.isConnected||!box.open)return;
      const dt=last?Math.min((now-last)/1000,.1):0;last=now;if(!reduced.matches)angle+=dt*Math.PI*2/48;
      const {ctx,w,h}=draw.sized(canvas),colors={...palette,paper:getComputedStyle(box).backgroundColor,muted:palette.muted};
      if(w&&h)draw.drawMesh(ctx,w,h,item,angle,tallest,colors);
      if(!reduced.matches)requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  if(peak.gallery){
    const img=el('img',{src:peak.gallery.photo,alt:`On ${peak.name}`,loading:'lazy',decoding:'async'});
    out.push(el('a',{className:'peak-gallery',href:peak.gallery.url},img,el('span',{},`All ${plural(peak.gallery.photos,'photo')} from the climb →`)));
  }
  return out;
}
// Peak portraits live beside the county ones (about/highpoints.json), keyed by state.
function peakPortrait(peak){
  if(!portraits.has('peaks'))portraits.set('peaks',about?fetch(`${about}highpoints.json`).then(r=>r.ok?r.json():{}).catch(()=>({})):Promise.resolve({}));
  return portraits.get('peaks').then(all=>all[peak.state]);
}
function peakView(peak,a){
  if(!a)return [el('p',{className:'county-empty'},'No portrait of this peak yet.')];
  return [photo(a.image),facts([['Elevation',`${n(peak.feet)} ft`],['Prominence',a.prominenceFt&&`${n(a.prominenceFt)} ft`],['Range',a.range?.join(', ')],['Protected',a.protected?.join(', ')],['County',inCounty(peak)]]),
    ...prose(a,a.heading,a.more)].filter(Boolean);
}
function dialog(){
  let box=$('county-dialog');if(box)return box;
  const close=el('button',{className:'icon-button',type:'button',ariaLabel:'Close',title:'Close'});close.dataset.closeModal='';
  close.innerHTML=document.getElementById('icon-x')?'<svg class="icon"><use href="#icon-x"/></svg>':'×';close.onclick=()=>box.close();
  box=el('dialog',{className:'app-modal county-modal',id:'county-dialog'},
    el('header',{className:'app-modal-header'},el('div',{},el('p',{className:'eyebrow',id:'county-state'}),el('h2',{id:'county-title'})),close),
    el('div',{className:'segmented county-tabs',id:'county-tabs',role:'group',ariaLabel:'Show'}),el('div',{className:'app-modal-body',id:'county-body'}));
  box.setAttribute('aria-labelledby','county-title');
  box.addEventListener('click',e=>{if(e.target===box)box.close();});
  box.addEventListener('close',()=>{selected=null;boxed=null;dirty=true;});
  document.body.append(box);return box;
}
async function show(kind,key,tab){
  const box=dialog(),body=$('county-body'),here={kind,key};boxed=here;
  $('county-tabs').replaceChildren(...TABS[kind].map(([value,text])=>{const b=el('button',{type:'button',textContent:text});b.dataset.value=value;b.onclick=()=>{tabs[kind]=value;show(kind,key,value);};return b;}));
  $('county-tabs').hidden=kind==='county'&&!about;
  press('county-tabs',tab);box.scrollTop=0;
  if(kind==='peak'&&tab==='climb'){body.replaceChildren(...climbView(key));return;}
  if(kind==='peak'){body.replaceChildren(el('p',{className:'county-empty'},'Loading…'));const a=await peakPortrait(key);if(boxed===here)body.replaceChildren(...peakView(key,a));return;}
  if(tab==='record'){body.replaceChildren(...record(key));return;}
  body.replaceChildren(el('p',{className:'county-empty'},'Loading…'));
  const entry=await portrait(key);
  if(boxed!==here)return;
  body.replaceChildren(...portraitView(key,entry));
}
function reveal(){setPlaying(false);dirty=true;$('county-tip').hidden=true;const box=dialog();if(!box.open)box.showModal();}
function open(fips){
  dialog();selected=fips;
  $('county-title').textContent=countyTitle(fips);$('county-state').textContent=data.states[fips.slice(0,2)]||'';
  // A county with nothing recorded opens on its portrait.
  const empty=!data.counties[fips]&&!chron.series.has(fips)&&!checkins.has(fips)&&about;
  show('county',fips,empty?'about':about?tabs.county:'record');reveal();
  if(about)portrait(fips).then(entry=>{if(entry?.title&&boxed?.key===fips)$('county-title').textContent=entry.title;});
}
function openPeak(peak){
  dialog();selected=peak.fips||null;
  $('county-title').textContent=peak.name;$('county-state').textContent=`${peak.state} highpoint`;
  show('peak',peak,peak.date?tabs.peak:'peak');reveal();
}
function controls(){
  const group=(id,label,items,value,choose)=>{
    const g=document.createElement('div');g.className='segmented';g.id=id;g.setAttribute('role','group');g.setAttribute('aria-label',label);
    g.append(...items.map(([v,text])=>{const b=document.createElement('button');b.dataset.value=v;b.textContent=text;b.setAttribute('aria-pressed',String(v===value));b.onclick=()=>choose(v);return b;}));return g;
  };
  $('present-slot').replaceChildren(group('present-modes','Colour counties by',MODES,style.mode,setMode));
  document.querySelector('.present-buttons').prepend(group('present-view','Camera',[['follow','Follow'],['fixed','Fixed']],viewMode,setView));
  $('present-play').onclick=()=>{
    if(playing){setPlaying(false);return;}
    if(style.mode==='manual')return;
    if(ended()){position=0;framing='follow';goals.clear();lastDay=-1;}
    camera='watch';setPlaying(!reduced.matches);dirty=true;
  };
  $('present-reset').onclick=settle;
  // A click leaves no button holding focus, so Space and the arrows keep driving playback.
  $('present-tools').addEventListener('click',e=>{if(e.detail)e.target.closest('button')?.blur();});
  $('present-full').onclick=()=>{const wrap=canvas.closest('.globe-wrap');if(document.fullscreenElement)document.exitFullscreen();else wrap.requestFullscreen?.().catch(()=>{});};
  document.addEventListener('fullscreenchange',()=>{const on=Boolean(document.fullscreenElement);caption($('present-full'),on?'Exit full screen':'Full screen',on?'shrink':'expand');});
  // One finger drags the map; two pinch to zoom about their midpoint.
  let drag=null,pinch=null;const pointers=new Map(),spread=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  canvas.onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(pointers.size===2){pinch=spread();if(drag)drag.moved=true;return;}drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};};
  canvas.onpointermove=e=>{
    const p=pointers.get(e.pointerId);if(p){p.x=e.clientX;p.y=e.clientY;}
    if(pinch){const d=spread(),[a,b]=[...pointers.values()],r=canvas.getBoundingClientRect();if(d>0){$('county-tip').hidden=true;zoom(d/pinch,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch=d;}return;}
    if(!drag){if(e.pointerType==='mouse')tip(e);return;}
    if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)drag.moved=true;
    if(drag.moved){explore();$('county-tip').hidden=true;const degrees=180/Math.PI/globeRadius(view,size().width,size().height);view.lon-=(e.clientX-drag.x)*degrees/Math.max(.2,Math.cos(view.lat*Math.PI/180));view.lat=Math.max(-85,Math.min(85,view.lat+(e.clientY-drag.y)*degrees));dirty=true;}
    drag.x=e.clientX;drag.y=e.clientY;
  };
  // Lifting one finger of a pinch hands the drag to the other, already moved, so it never taps.
  const lift=e=>{pointers.delete(e.pointerId);pinch=null;const [rest]=pointers.values();drag=rest?{...rest,startX:rest.x,startY:rest.y,moved:true}:null;};
  canvas.onpointerup=e=>{if(drag&&!drag.moved&&pointers.size===1){const peak=peakAt(e),fips=peak?null:pick(e);if(peak)openPeak(peak);else if(fips)open(fips);}lift(e);};
  canvas.onpointercancel=lift;canvas.onpointerleave=()=>{$('county-tip').hidden=true;};
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?.9:1.1,...local(e));},{passive:false});
  canvas.onkeydown=e=>{
    if(e.key==='Escape'){selected=null;dirty=true;return;}
    if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?1/1.3:1.3);}
  };
  // Space plays and pauses; left and right step one county (ten with Shift), held to run;
  // R resets to the finished map on the lower 48; F toggles full screen (Esc also leaves it).
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
  bar.onpointerdown=e=>{if(!data)return;resume=playing;setPlaying(false);bar.setPointerCapture(e.pointerId);bar.classList.add('dragging');seek(share(e)*steps.length);};
  bar.onpointermove=e=>{if(bar.classList.contains('dragging'))seek(share(e)*steps.length);};
  bar.onpointerup=bar.onpointercancel=()=>{if(!bar.classList.contains('dragging'))return;bar.classList.remove('dragging');if(resume&&!ended())setPlaying(true);};
  // Framing depends on the canvas shape, so fitted views are recomputed on resize.
  new ResizeObserver(()=>{goals.clear();frameCamera();if(framing==='country'&&camera==='watch')view={...goal};dirty=true;}).observe(canvas);
  reduced.addEventListener('change',()=>{if(reduced.matches){setPlaying(false);view={...goal};dirty=true;}});
  document.addEventListener('visibilitychange',()=>{last=0;});
  // Follow the page theme, whoever sets it.
  new MutationObserver(()=>{palette=readTheme();key();lastDay=-1;dirty=true;}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
}
// The date, county count and progress line over the map; pages without them get them here.
function overlay(){
  const wrap=canvas.closest('.globe-wrap'),corner=wrap.querySelector('.globe-corner')||wrap.appendChild(document.createElement('div'));
  const key=$('map-key')||Object.assign(document.createElement('span'),{id:'map-key',className:'map-key',hidden:true});
  if($('map-date'))corner.prepend(key);
  else{corner.className='globe-corner';corner.setAttribute('aria-hidden','true');
  corner.replaceChildren(key,...['map-date','map-tally'].map(id=>Object.assign(document.createElement('span'),{id,className:id==='map-date'?'map-date':''})));}
  if(!$('map-peaks')){const line=Object.assign(document.createElement('span'),{id:'map-peaks',className:'map-peaks',hidden:true});line.append(document.createElement('i'),'');corner.append(line);}
  if(!$('map-keys'))wrap.append(Object.assign(document.createElement('p'),{id:'map-keys',className:'map-keys',textContent:'Space play/pause · ← → step (Shift ×10) · R reset · F full screen · Esc exit'}));
  if(!$('map-progress')){const bar=document.createElement('div');bar.className='map-progress';bar.append(Object.assign(document.createElement('i'),{id:'map-progress'}));wrap.append(bar);}
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
// The loading line fills with the files (to 90%) and the build of the map (the rest),
// then holds full a moment before the map takes over.
const progress=value=>$('load-status').style.setProperty('--load',value);
const FILL=400,FADE=300,pause=ms=>new Promise(done=>setTimeout(done,reduced.matches?0:ms));
// prepare: turns a fetched record into that shape (the private preview passes publicCounties).
export async function present({data:dataUrl,assets='assets/',prepare=r=>r,about:aboutUrl=null}){
  about=aboutUrl;assetsUrl=assets;
  canvas=$('county-map');document.body.classList.add('present-mode','loading');$('present-tools').hidden=false;overlay();
  controls();
  try{
    const shares=[0,0,0,0,0],track=i=>v=>{shares[i]=v;progress(.04+.86*shares.reduce((a,b)=>a+b)/shares.length);};progress(.04);
    const [record,topology,world,stateLines,lakes]=await Promise.all([load(dataUrl,track(0)),load(assets+'counties-10m.json',track(1)),load(assets+'world.json',track(2)),load(assets+'us-states.json',track(3)).catch(()=>(track(3)(1),null)),load(assets+'lakes.json',track(4)).catch(()=>(track(4)(1),null))]);
    if(!record.daily?.length)throw Error('No county records');
    data=prepare(record);chron=buildChronology(data);first=0;final=data.days-1;
    checkins=new Map(Object.entries(data.checkins||{}));
    // All Sources also plays the tag-only counties placed between counties of one trip (the build's `slotted`).
    const visits=firstVisits(chron,first,final,true),slotted=Object.entries(data.slotted||{}).map(([fips,[day,order]])=>({fips,day,order}));
    // A placed county first recorded on a later trip enters with the earlier one, once.
    const placed=new Set(slotted.map(s=>s.fips));
    sequences={google:sequence(visits),evidence:sequence([...visits.filter(v=>!placed.has(v.fips)),...slotted].sort((a,b)=>a.day-b.day||a.order-b.order)),
      swarm:sequence([...checkins].filter(([,days])=>days.length).map(([fips,days])=>({fips,day:days[0]})).sort((a,b)=>a.day-b.day||a.fips.localeCompare(b.fips)))};
    ({steps,rank}=sequences[style.mode==='checkins'?'swarm':style.mode==='evidence'?'evidence':'google']);
    const counties=decodeTopology(topology,'counties');scene=createScene(counties,world,stateLines,stateBorders(topology),lakes);
    manualLabel=Object.fromEntries(data.manual.legend.map(l=>[l.code,l.label]));
    // Each highpoint's county, by its summit; climbs before the record began count from its first day.
    peaks=(data.highpoints||[]).map(p=>({...p,day:p.date?Math.max(0,dayIndex(data.start,p.date)):null,
      // The build names each summit's county; worked out here only for data without it.
      fips:p.fips??(scene.items.find(item=>p.at[1]>=item.bounds[0][1]&&p.at[1]<=item.bounds[1][1]&&p.at[0]>=item.bounds[0][0]&&p.at[0]<=item.bounds[1][0]&&d3.geoContains(item.feature,p.at))
        // A summit on a state line (Mt. Frissell's) belongs to the nearest county.
        ??d3.least(scene.items,item=>d3.geoDistance(item.center,p.at)))?.id}));
    $('map-peaks').hidden=!peaks.length;
    progress(1);await pause(FILL);
    // ?hold keeps the full loading line up until a click, for looking at it.
    if(new URLSearchParams(location.search).has('hold'))await new Promise(done=>addEventListener('click',done,{once:true}));
    key();settle();requestAnimationFrame(tick);
    document.body.classList.remove('loading');$('load-status').classList.add('done');await pause(FADE);$('load-status').hidden=true;
  }catch(error){$('load-status').textContent='The county record is unavailable';$('load-status').classList.add('failed');console.error(error);}
}
