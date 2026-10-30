// Beer Styles kept free of the DOM: Untappd check-ins hung on a style tree
// (root → class → family → style), measures rolled up that tree for any span of
// check-ins, and the tree drawn from it: a joint for the root, each class, family and
// style, and a twig out to every beer.
// The class above the family comes from taxonomy.json; Untappd has no such tier.
const DAY=864e5;
export const LEVELS=['root','class','family','style'];

// 'Stout - Imperial / Double' is family Stout, style Imperial / Double; a bare type is its own family.
export function parseStyle(type){const i=String(type).indexOf(' - ');return i<0?{family:String(type).trim(),style:null}:{family:type.slice(0,i).trim(),style:type.slice(i+3).trim()};}

// The tree for the styles present, in taxonomy order: classes as listed, families in
// their kinship order, styles alphabetically. Nodes come level by level, so a parent's
// index is always below its children's. An unmapped family fails loudly.
export function styleTree(types,taxonomy){
  const families=new Map();
  for(const type of new Set(types)){const {family,style}=parseStyle(type);(families.get(family)||families.set(family,new Set()).get(family)).add(style);}
  const missing=[...families.keys()].filter(f=>!taxonomy.familyToClass[f]);
  if(missing.length)throw Error(`Unmapped style families (add them to taxonomy.json): ${missing.sort().join(', ')}`);
  const classes=Object.keys(taxonomy.classes),order=Object.keys(taxonomy.familyToClass);
  const nodes=[{name:'Beer',parent:-1,level:0,cls:null}],leaf=new Map();
  const used=classes.filter(c=>[...families.keys()].some(f=>taxonomy.familyToClass[f]===c));
  const classIndex=new Map(used.map(c=>[c,nodes.push({name:taxonomy.classes[c],parent:0,level:1,cls:c})-1]));
  const sorted=[...families.keys()].sort((a,b)=>used.indexOf(taxonomy.familyToClass[a])-used.indexOf(taxonomy.familyToClass[b])||order.indexOf(a)-order.indexOf(b));
  const familyIndex=new Map(sorted.map(f=>[f,nodes.push({name:f,parent:classIndex.get(taxonomy.familyToClass[f]),level:2,cls:taxonomy.familyToClass[f]})-1]));
  for(const f of sorted)for(const style of [...families.get(f)].sort((a,b)=>a===null?-1:b===null?1:a.localeCompare(b))){
    // A bare type is a leaf at its family; a family with substyles hangs them below.
    if(style===null)leaf.set(f,familyIndex.get(f));
    else leaf.set(`${f} - ${style}`,nodes.push({name:style,parent:familyIndex.get(f),level:3,cls:taxonomy.familyToClass[f]})-1);
  }
  return {nodes,leaf:type=>{const {family,style}=parseStyle(type);return leaf.get(style===null?family:`${family} - ${style}`);}};
}

const ratingOf=v=>{const n=Number(v);return v===null||v===undefined||v===''||!Number.isFinite(n)||n<=0?null:Math.round(n*100)/100;};
// What the page ships: the tree, one row per beer (name, brewery, ABV, crowd rating),
// one row per check-in (day from the first, leaf node, beer, my rating), day order.
// No venues, no times of day.
export function publicBeers(rows,taxonomy){
  const bad=rows.filter(r=>!r.created_at||!r.beer_type||r.bid==null);
  if(bad.length)throw Error(`${bad.length} check-ins lack a date, style or beer id`);
  const sorted=byTime(rows);
  const {nodes,leaf}=styleTree(sorted.map(r=>r.beer_type),taxonomy),beerIndex=new Map(),beers=[];
  const start=sorted[0].created_at.slice(0,10),t0=Date.parse(`${start}T00:00:00Z`);
  const checkins=sorted.map(r=>{
    if(!beerIndex.has(r.bid))beerIndex.set(r.bid,beers.push([r.beer_name,r.brewery_name,r.beer_abv==null||r.beer_abv===''?null:+r.beer_abv,ratingOf(r.global_weighted_rating_score??r.global_rating_score)])-1);
    else{const b=beers[beerIndex.get(r.bid)];b[3]??=ratingOf(r.global_weighted_rating_score??r.global_rating_score);}
    return [Math.floor((Date.parse(r.created_at)-t0)/DAY),leaf(r.beer_type),beerIndex.get(r.bid),ratingOf(r.rating_score)];
  });
  return {start,nodes:nodes.map(n=>[n.name,n.parent,n.level,n.cls]),beers,checkins};
}
const byTime=rows=>[...rows].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.checkin_id-b.checkin_id);
// The detail panel's record, one per beer in publicBeers' order, loaded only when a beer
// is opened: its Untappd profile (description, label, brewery, IBU, how many have had
// it, its page) and my check-ins of it, newest first, as [day, rating]; notes, photos and venues stay private.
export function publicProfiles(rows,profiles,start){
  const t0=Date.parse(`${start}T00:00:00Z`),out=[],at=new Map();
  for(const r of byTime(rows)){
    if(!at.has(r.bid)){
      const p=profiles[String(r.bid)]||{},label=p.beer_label_hd||p.beer_label||r.beer_label,slug=p.beer_slug||r.beer_slug;
      at.set(r.bid,out.push(Object.fromEntries(Object.entries({
        description:p.beer_description?.trim()||null,label:label&&!/badge-beer-default/.test(label)?label:null,
        url:slug?`https://untappd.com/b/${slug}/${r.bid}`:null,ibu:p.beer_ibu||null,ratings:p.rating_count||null,
        drinkers:p.stats?.total_user_count||null,added:p.created_at?new Date(p.created_at).toISOString().slice(0,10):null,
        brewery:p.brewery&&Object.keys(p.brewery).length?p.brewery:null,mine:[]}).filter(([,v])=>v!=null)))-1);
    }
    out[at.get(r.bid)].mine.unshift([Math.floor((Date.parse(r.created_at)-t0)/DAY),ratingOf(r.rating_score)]);
  }
  return out;
}
export const decodeNodes=data=>data.nodes.map(([name,parent,level,cls],i)=>({i,name,parent,level,cls}));

// Measures for every node over check-ins up to day `to` (and from `from`), or the first
// `count` check-ins, rolled up
// the tree: counts sum; means weigh each rated check-in, never average children.
// Crowd is the mean crowd rating of the distinct beers had; delta is mine minus the
// crowd's over check-ins that have both.
export function aggregate(data,{to=Infinity,from=-Infinity,keep=null,count=Infinity}={}){
  const n=data.nodes.length,parent=data.nodes.map(d=>d[1]);
  const s={count:new Float64Array(n),beers:new Float64Array(n),mySum:new Float64Array(n),myN:new Float64Array(n),dSum:new Float64Array(n),dN:new Float64Array(n),gSum:new Float64Array(n),gN:new Float64Array(n),first:new Float64Array(n).fill(-1),last:new Float64Array(n).fill(-1),seen:Array.from({length:n},()=>new Set())};
  for(let j=0;j<data.checkins.length&&j<count;j++){
    const c=data.checkins[j],[day,leaf,beer,my]=c;if(day>to)break;if(day<from||(keep&&!keep(c)))continue;
    const crowd=data.beers[beer][3];
    for(let i=leaf;i>=0;i=parent[i]){
      s.count[i]++;if(s.first[i]<0)s.first[i]=day;s.last[i]=day;
      if(my!=null){s.mySum[i]+=my;s.myN[i]++;if(crowd!=null){s.dSum[i]+=my-crowd;s.dN[i]++;}}
      if(!s.seen[i].has(beer)){s.seen[i].add(beer);s.beers[i]++;if(crowd!=null){s.gSum[i]+=crowd;s.gN[i]++;}}
    }
  }
  return s;
}
// The colour value of node i: my mean, the crowd's mean, or my mean minus the crowd's,
// pulled toward the parent's when rated check-ins are few: (n·mean + k·parent)/(n + k).
export function measure(s,i,mode,parent,{k=3,shrink=true}={}){
  if(mode==='mine')return s.myN[i]?s.mySum[i]/s.myN[i]:null;
  if(mode==='crowd')return s.gN[i]?s.gSum[i]/s.gN[i]:null;
  if(!s.dN[i])return null;
  const p=parent[i];if(!shrink||p<0||!s.dN[p])return s.dSum[i]/s.dN[i];
  return (s.dSum[i]+k*s.dSum[p]/s.dN[p])/(s.dN[i]+k);
}
// Per beer, in order of first check-in: its leaf (style, or bare family), the index of
// its first check-in, how many times it was had, and my mean rating of it.
export function beerFacts(data){
  const out=new Map();
  data.checkins.forEach(([day,leaf,beer,my],j)=>{
    const b=out.get(beer)||out.set(beer,{beer,leaf,first:j,firstDay:day,lastDay:day,n:0,sum:0,rated:0}).get(beer);
    b.n++;b.lastDay=day;if(my!=null){b.sum+=my;b.rated++;}
  });
  return [...out.values()].map(b=>({...b,mine:b.rated?b.sum/b.rated:null,crowd:data.beers[b.beer][3]}));
}
// The finished tree, laid out once (at build time) for a screen of the given
// width/height and the same every time (d3-force's random source is seeded). Every
// beer is a terminal node on its style (or bare family); every joint above it is a
// node too. Seeded as a radial tree, beers in the order of their style and the order
// first had, then relaxed by forces: short twigs, joints that push apart, beers that
// never overlap, and a pull to the centre weaker along the screen's long side, so the
// tree branches out in every direction and fills the screen's shape.
// Returns [x, y] per joint (node index) and per beer, in layout units round the origin.
export const TWIG=[0,46,30,20,9],BEER_RADIUS=3;
export function tree(data,d3,{aspect=1}={}){
  const nodes=decodeNodes(data),facts=beerFacts(data),kids=nodes.map(()=>[]),beersOf=nodes.map(()=>[]);
  for(const n of nodes)if(n.parent>=0)kids[n.parent].push(n.i);
  for(const f of facts)beersOf[f.leaf].push(f.beer);
  // Joints first (index i), then beers (index nodes.length + b).
  const J=nodes.length,sim=[],links=[],order=[],walk=i=>{kids[i].forEach(walk);for(const b of beersOf[i])order.push([i,b]);};walk(0);
  const angle=new Float64Array(J),count=new Float64Array(J),seat=new Map();
  order.forEach(([leaf,b],k)=>{const a=2*Math.PI*k/order.length;seat.set(b,a);for(let i=leaf;i>=0;i=nodes[i].parent){angle[i]+=a;count[i]++;}});
  for(let i=0;i<J;i++)angle[i]=count[i]?angle[i]/count[i]:0;
  const depth=i=>nodes[i].level,ring=[0,60,130,190,240];
  for(const n of nodes)sim.push({level:n.level,beer:false,r:n.level?2.5:4,x:Math.cos(angle[n.i])*ring[n.level]*aspect**.5,y:Math.sin(angle[n.i])*ring[n.level]/aspect**.5});
  for(const f of facts){const a=seat.get(f.beer),R=ring[depth(f.leaf)+1];sim[J+f.beer]={level:depth(f.leaf)+1,beer:true,r:BEER_RADIUS,x:Math.cos(a)*R*aspect**.5,y:Math.sin(a)*R/aspect**.5};}
  for(const n of nodes)if(n.parent>=0)links.push({source:n.parent,target:n.i,d:TWIG[n.level]});
  for(const f of facts)links.push({source:f.leaf,target:J+f.beer,d:TWIG[4]});
  sim.forEach((d,k)=>{if(d)d.id=k;});sim[0].fx=sim[0].fy=0;
  d3.forceSimulation(sim.filter(Boolean)).stop()
    .force('link',d3.forceLink(links).id(d=>d.id).distance(l=>l.d).strength(l=>l.target.beer?.9:.6))
    .force('charge',d3.forceManyBody().strength(d=>d.beer?-14:-70).distanceMax(220).theta(.8))
    .force('collide',d3.forceCollide(d=>d.r+1.4).strength(.9).iterations(2))
    .force('x',d3.forceX(0).strength(.025/aspect)).force('y',d3.forceY(0).strength(.025*aspect))
    .tick(300);
  return {nodes:sim.slice(0,J).map(d=>[d.x,d.y]),beers:data.beers.map((_,b)=>sim[J+b]?[sim[J+b].x,sim[J+b].y]:null)};
}

// Playback steps one new beer at a time, as County Counting steps one county: the index
// of each beer's first check-in, in order.
export const beerSteps=data=>{const seen=new Set(),out=[];data.checkins.forEach(([,,beer],j)=>{if(!seen.has(beer)){seen.add(beer);out.push(j);}});return out;};
export const dayLabel=(data,day,options={month:'short',year:'numeric'})=>new Date(Date.parse(`${data.start}T12:00:00Z`)+day*DAY).toLocaleDateString('en-US',{...options,timeZone:'UTC'});
