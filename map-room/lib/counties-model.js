// County chronology kept free of the DOM: boundary decoding, presence within a
// range of days, and trailing time-weighted mean positions.
// Categorical hues pass the dataviz palette checks on both map surfaces.
// Counted shadings share one mint ramp, recorded time and check-ins alike. Combined steps
// down from the most evidence to a tag alone, with Swarm alone set apart. Manual tags are
// categories, warm to cool down the spectrum from Lived to Pass Thru.
export const INKS={light:{cat:['#1f7fb8','#c8642a','#7b58c9'],all:'#1c2226',seq:['#bfe6d6','#0e5a45'],evidence:{gs:'#0e5a45',g:'#3fae8a',s:'#7b58c9',t:'#c6dcd2'},tags:{L:'#b0283f',A:'#d9772b',B:'#d6a82a',C:'#3f9e6e',D:'#3b7fc0'},tagged:'#dfe4e6'},
  dark:{cat:['#4a9bd0','#cc7738','#9c80e0'],all:'#f2f2f0',seq:['#24493f','#5fe6c2'],evidence:{gs:'#5fe6c2',g:'#2f9478',s:'#9c80e0',t:'#34463f'},tags:{L:'#ec5470',A:'#ee9145',B:'#e8c04e',C:'#5cc68f',D:'#5c9fe0'},tagged:'#30302d'}};
// Counted shadings run on a log scale from a floor to a top; `style.scale` picks the top.
export const MEASURES={hours:{min:.25,cap:1e4},days:{min:1,cap:1e3},checkins:{min:1,cap:1e3}};
export const WINDOWS=[{key:'90d',days:90,label:'90 days',short:'90 D'},{key:'1y',days:365,label:'1 year',short:'1 Y'},{key:'2y',days:730,label:'2 years',short:'2 Y'},{key:'all',days:0,label:'All recorded time',short:'ALL'}];
const decodeArcs=topology=>{const {scale:[kx,ky],translate:[dx,dy]}=topology.transform;return topology.arcs.map(arc=>{let x=0,y=0;return arc.map(([px,py])=>[(x+=px)*kx+dx,(y+=py)*ky+dy]);});};
export function decodeTopology(topology,name){
  const arcs=decodeArcs(topology);
  const ring=ids=>{const out=[];for(const i of ids){const line=i<0?arcs[~i].slice().reverse():arcs[i];out.push(...(out.length?line.slice(1):line));}return out;};
  const polygon=rings=>rings.map(ring);
  return topology.objects[name].geometries.map(g=>({type:'Feature',id:g.id,properties:g.properties||{},geometry:{type:g.type,coordinates:g.type==='Polygon'?polygon(g.arcs):g.arcs.map(polygon)}}));
}
// Borders between states at full resolution: every arc two states share, so state
// lines sit exactly on the county edges they follow (coasts are left out).
export function stateBorders(topology,name='states'){
  const users=new Map(),walk=(value,id)=>{if(Array.isArray(value))for(const v of value){if(typeof v==='number'){const k=v<0?~v:v;(users.get(k)||users.set(k,new Set()).get(k)).add(id);}else walk(v,id);}};
  for(const g of topology.objects[name].geometries)walk(g.arcs,g.id);
  const arcs=decodeArcs(topology);
  return {type:'MultiLineString',coordinates:[...users].filter(([,ids])=>ids.size>1).map(([k])=>arcs[k])};
}
// What confirms a county, strongest first: Google Timeline time and Swarm check-ins,
// either alone, or only the hand-kept tag.
export const EVIDENCE=[['gs','Google and Swarm'],['g','Google only'],['s','Swarm only'],['t','Manual only']];
export const evidence=(google,swarm,tagged)=>google?(swarm?'gs':'g'):swarm?'s':tagged?'t':null;
export function buildChronology(data){
  const series=new Map(),byDay=new Map(),recorded=[];
  for(const entry of data.daily){
    byDay.set(entry[0],entry);recorded.push(entry[0]);
    for(const [fips,hours]of entry[1]){
      let s=series.get(fips);if(!s)series.set(fips,s={days:[],hours:[]});
      s.days.push(entry[0]);s.hours.push((s.hours.at(-1)||0)+hours);
    }
  }
  return {series,byDay,recorded,days:data.days,start:data.start};
}
// Number of sorted entries at or before a day.
export function upTo(list,day){
  let lo=0,hi=list.length;
  while(lo<hi){const mid=lo+hi>>1;if(list[mid]<=day)lo=mid+1;else hi=mid;}
  return lo;
}
export function presence(s,from,to){
  if(!s)return null;
  const a=upTo(s.days,from-1),b=upTo(s.days,to);
  if(b<=a)return null;
  return {days:b-a,hours:s.hours[b-1]-(a?s.hours[a-1]:0),first:s.days[a],last:s.days[b-1]};
}
// Each county's first recorded day inside a range, in the order the counties
// were entered. `ever` instead keeps only counties whose first visit in the
// whole record falls inside the range.
export function firstVisits(chron,from,to,ever=false){
  const out=[];
  for(const [fips,s]of chron.series){
    const day=s.days[ever?0:upTo(s.days,from-1)];
    if(day===undefined||day<from||day>to)continue;
    out.push({fips,day,order:chron.byDay.get(day)[1].find(e=>e[0]===fips)?.[2]??0});
  }
  return out.sort((a,b)=>a.day-b.day||a.order-b.order);
}
// The last day of a county's record to count at playback step k: the step's day once the path
// has reached the county in that day's order (or the day is done), else the day before.
// Steps without an order (the Swarm sequence) count whole days.
export function recordAsOf(chron,steps,k,fips){
  const {day,order:now}=steps[k];if(now==null)return day;
  const at=chron.byDay.get(day)?.[1].find(e=>e[0]===fips)?.[2];
  if(at==null)return k+1<steps.length&&steps[k+1].day===day?day-1:day;
  return at<=now?day:day-1;
}
// Index range [lo,hi) of day-sorted rows that fall within an inclusive span of days.
export function rowRange(days,from,to){return [upTo(days,from-1),upTo(days,to)];}
// Recorded days either side of a gap: the day itself when recorded, otherwise
// the nearest recorded neighbours. Unrecorded time is never presence.
export function recordedAround(recorded,day){
  const i=upTo(recorded,day);
  return {previous:i?recorded[i-1]:null,next:i<recorded.length?recorded[i]:null};
}
// Trailing mean position per day and window, as [lon,lat] pairs. A window of
// zero days means everything recorded so far. A fixed window has no position
// until the record is at least that long, so a marker never stands on partial
// history. Unit vectors keep the mean correct across the antimeridian; days
// without credited time add no weight.
export function rollingMeans(daily,days,windows=WINDOWS){
  const sums=new Float64Array((days+1)*4);
  let j=0;
  for(let d=0;d<days;d++){
    for(let k=0;k<4;k++)sums[(d+1)*4+k]=sums[d*4+k];
    if(daily[j]&&daily[j][0]===d){for(let k=0;k<4;k++)sums[(d+1)*4+k]+=daily[j][2][k];j++;}
  }
  return windows.map(w=>{
    const out=new Float32Array(days*2).fill(NaN);
    for(let d=w.days?w.days-1:0;d<days;d++){
      const lo=w.days?d+1-w.days:0,at=k=>sums[(d+1)*4+k]-sums[lo*4+k];
      if(at(3)<=1e-9)continue;
      const x=at(0),y=at(1),z=at(2);
      out[d*2]=Math.atan2(y,x)*180/Math.PI;out[d*2+1]=Math.atan2(z,Math.hypot(x,y))*180/Math.PI;
    }
    return out;
  });
}
export const logScale=(value,min,max)=>Math.max(0,Math.min(1,Math.log(Math.max(value,min)/min)/Math.log(max/min)));
// Top of a counted shading scale: the fixed cap, the cap raised, or adaptive to
// the values shown so far (a nearest-rank percentile, never below ten times the floor).
export const SCALE_QUANTILES={max:1,p99:.99,p95:.95};
// Hard steps for the public map, so a county visibly steps up as hours or check-ins
// accrue: each edge is the step's lower bound.
export const STEPS={hours:{edges:[0,1,24,168,720,8766],labels:['< 1 hr','< 1 day','< 1 wk','< 1 mo','< 1 yr','1 yr +']},
  checkins:{edges:[1,2,50,100,250,500],labels:['1','< 50','< 100','< 250','< 500','500 +']}};
export const stepOf=(value,edges)=>{let i=0;while(i<edges.length-1&&value>=edges[i+1])i++;return i;};
export function scaleTop(values,scale,min,cap){
  if(scale==='fixed')return cap;
  if(scale==='raised')return cap*3;
  const sorted=Float64Array.from(values).sort(),q=SCALE_QUANTILES[scale]??1;
  return Math.max(min*10,sorted.length?sorted[Math.max(0,Math.ceil(q*sorted.length)-1)]:0);
}
// Two significant figures, for scale labels.
export const roundLabel=v=>v>=10?Number(v.toPrecision(2)):Math.round(v*10)/10;
export function dayDate(start,day){const d=new Date(`${start}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+day);return d;}
export const dayLabel=(start,day)=>dayDate(start,day).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
export const dayIndex=(start,iso)=>Math.round((Date.parse(`${iso}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/864e5);
// Inclusive day range for one calendar year, clipped to the record.
export function yearRange(start,days,year){
  if(year==='all')return [0,days-1];
  return [Math.max(0,dayIndex(start,`${year}-01-01`)),Math.min(days-1,dayIndex(start,`${year}-12-31`))];
}
export const formatHours=h=>h>=100?`${Math.round(h).toLocaleString('en-US')} h`:h>=10?`${h.toFixed(0)} h`:`${h.toFixed(1)} h`;
// What the website gets: per-day county hours, the county table, tags, and
// check-in days and the number of distinct venues per county. Venue names, check-in coordinates, and the daily
// position vectors (which pin down where each day was spent) stay private.
// Counties that share a border, from a TopoJSON topology: two counties are neighbours when
// they share an arc. {fips: Set of fips}.
export function countyNeighbors(topology){
  const byArc=new Map(),walk=(a,fips)=>Array.isArray(a)?a.forEach(x=>walk(x,fips)):(byArc.get(a<0?~a:a)??byArc.set(a<0?~a:a,new Set()).get(a<0?~a:a)).add(fips);
  for(const g of topology.objects.counties.geometries)walk(g.arcs,String(g.id).padStart(5,'0'));
  const out={};
  for(const ids of byArc.values())for(const a of ids)for(const b of ids)if(a!==b)(out[a]??=new Set()).add(b);
  return out;
}
// A gap in a trip's route: two counties reached one after the other, within WINDOW days, that
// do not touch. The drive between them crossed counties the record missed; of the routes
// through tagged counties, the one adding the fewest counties not yet reached by then is
// taken (counties already on the map cost nothing), and only those it adds join the
// sequence, in order along the road between the two. One may be a county first recorded on
// a later trip, which this earlier pass then precedes. Trips are taken earliest first.
const STOP=500;
function bridgeGaps(data,neighbors,at,{window,route}){
  const tagged=new Set(Object.keys(data.counties).filter(f=>data.counties[f].manual)),out={};
  const order=[...at.entries()].sort((a,b)=>a[1][0]-b[1][0]||a[1][1]-b[1][1]);
  for(let i=0;i+1<order.length;i++){
    const [a,[day,rank]]=order[i],[b,[next]]=order[i+1];
    if(next-day>window||neighbors[a]?.has(b))continue;
    const reached=n=>out[n]?out[n][0]<=day:at.has(n)&&at.get(n)[0]<=day&&!(at.get(n)[0]===day&&at.get(n)[1]>rank);
    // Fewest new counties first (0–1 breadth first), through tagged counties only.
    const cost=new Map([[a,0]]),back=new Map(),deque=[a];
    while(deque.length){
      const f=deque.shift();if(f===b)break;
      for(const n of neighbors[f]||[]){
        if(n!==b&&!tagged.has(n))continue;
        const c=cost.get(f)+(n===b||reached(n)?0:1);
        if(c>route||(cost.has(n)&&cost.get(n)<=c))continue;
        cost.set(n,c);back.set(n,f);c===cost.get(f)?deque.unshift(n):deque.push(n);
      }
    }
    if(!back.has(b))continue;
    const path=[];for(let c=back.get(b);c!==a;c=back.get(c))if(!reached(c))path.unshift(c);
    path.forEach((f,k)=>{out[f]=[day,rank+(k+1)/(path.length+1)];});
  }
  return out;
}
// Counties known only from a hand-kept tag, between two counties first reached within WINDOW
// days of each other, were passed through on that trip: they join the sequence just after
// the earlier of the two, rather than showing from the start. A run of up to RUN tagged
// counties side by side counts as one stretch of road; a bigger patch is left alone (a
// childhood's worth of counties is not one trip). Placed counties count as reached for
// their neighbours. {fips: [day, order]}, order placing it within that day.
export function slotTagged(data,neighbors,{window=2,run=4,route=16,stops=[]}={}){
  const chron=buildChronology(data),at=new Map(firstVisits(chron,0,data.days-1,true).map(s=>[s.fips,[s.day,s.order]]));
  for(const [fips,days]of Object.entries(data.checkins||{}))if(days.length&&!at.has(fips))at.set(fips,[days[0],0]);
  // Stops known otherwise (a summit's county on the day it was climbed) count as reached that
  // day, at its end, when the record has them only later or not at all.
  const out={};
  for(const {fips,day}of stops)if(data.counties[fips]&&(!at.has(fips)||at.get(fips)[0]>day)){out[fips]=[day,STOP];at.set(fips,out[fips]);}
  for(const [f,v]of Object.entries(bridgeGaps(data,neighbors,at,{window,route}))){out[f]=v;at.set(f,v);}
  const tagged=new Set(Object.keys(data.counties).filter(f=>data.counties[f].manual&&!at.has(f)));
  for(let changed=true;changed;){
    changed=false;const seen=new Set();
    for(const start of [...tagged].sort()){
      if(seen.has(start)||out[start])continue;
      // The run of still-unplaced tagged counties joined to this one.
      const group=[start];seen.add(start);
      for(let i=0;i<group.length;i++)for(const n of neighbors[group[i]]||[])if(tagged.has(n)&&!out[n]&&!seen.has(n)){seen.add(n);group.push(n);}
      // A county with two such neighbours of its own goes first; otherwise the whole run, if short.
      for(const members of [...group.map(f=>[f]),group.length<=run?group:[]]){
        if(!members.length||members.some(f=>out[f]))continue;
        const near=[...new Set(members.flatMap(f=>[...(neighbors[f]||[])]))].map(n=>at.get(n)).filter(Boolean).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
        const i=near.findIndex((v,k)=>k<near.length-1&&near[k+1][0]-v[0]<=window);
        if(i<0)continue;
        for(const f of members){out[f]=[near[i][0],near[i][1]+.5];at.set(f,out[f]);}changed=true;
      }
    }
  }
  return out;
}
export function publicCounties(record){
  const checkins={},places={};
  for(const row of record.checkins?.rows||[])if(row[4]&&row[0]>=0&&row[0]<record.days){(checkins[row[4]]??=[]).push(row[0]);(places[row[4]]??=new Set()).add(row[3]);}
  // How many different places each county's check-ins were at: a count, never which.
  const venues=Object.fromEntries(Object.entries(places).map(([fips,set])=>[fips,set.size]));
  return {start:record.start,days:record.days,counties:record.counties,states:record.states,manual:{legend:record.manual.legend},
    daily:record.daily.map(([day,entries])=>[day,entries]),checkins,venues};
}
// Every state's highpoint for the map's dots, from Wikidata's list; one climbed (from the
// Highpoints study's list, matched by summit within about 3 miles) takes that list's name,
// height and summit, its date and its terrain id; each keeps Wikidata's portrait.
export function publicHighpoints(all,climbed,states){
  return all.map(peak=>{
    const done=climbed.find(c=>Math.hypot(c.summit[0]-peak.at[0],c.summit[1]-peak.at[1])<.05);
    return {name:done?.name??peak.name,state:states[peak.fips]??peak.fips,feet:done?.feet??peak.feet,at:(done?.summit??peak.at).map(v=>Math.round(v*1e4)/1e4),
      ...(done&&{date:done.date,id:done.id}),...(peak.about&&{about:peak.about})};
  });
}
