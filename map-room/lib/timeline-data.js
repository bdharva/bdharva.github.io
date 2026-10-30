export function milesBetween(a,b){
  const rad=Math.PI/180,lat1=a[1]*rad,lat2=b[1]*rad;
  const h=Math.sin((lat2-lat1)/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin((b[0]-a[0])*rad/2)**2;
  return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
// Work on a copy: the imported observations and their coverage stay untouched.
export function cleanTrace(coordinates,home,{enabled=true,smoothing=10,gap=60,stay=600,blockedBins=[]}={}){
  const points=coordinates.map(p=>p?.slice()??null),blocked=new Set(blockedBins);
  let corrected=0,interpolated=0,inferredStay=0;
  if(enabled){
    // Short excursions returning to nearly the same place at >120 mph.
    // Geographic endpoints matter: equal distance from home isn't enough.
    for(let i=1;i<points.length-1;i++){
      const a=points[i-1];if(!a||!points[i])continue;
      for(let n=1;n<=3&&i+n<points.length;n++){
        const b=points[i+n],excursion=points.slice(i,i+n);
        if(!b||excursion.some((p,k)=>!p||blocked.has(i+k)))continue;
        const away=Math.min(...excursion.map(p=>Math.min(milesBetween(a,p),milesBetween(b,p))));
        if(away<1||milesBetween(a,b)>Math.min(.25,away*.1)||2*away/((n+1)*5/60)<=120)continue;
        for(let j=i;j<i+n;j++)points[j]=null;
        corrected+=n;break;
      }
    }
    // Bridge only bounded gaps, with geographically nearby endpoints. Never
    // cross ambiguous DST bins, missing day edges, or whole missing days.
    for(let i=0;i<points.length;i++){
      if(points[i])continue;
      const start=i;while(i<points.length&&!points[i])i++;
      const a=points[start-1],b=points[i];
      if(!a||!b||Array.from({length:i-start},(_,k)=>start+k).some(k=>blocked.has(k)))continue;
      const duration=(i-start+1)*5,separation=milesBetween(a,b);
      const shortGap=duration<=gap&&separation<=2;
      const samePlace=duration<=stay&&separation<=.25;
      if(!shortGap&&!samePlace)continue;
      const delta=((b[0]-a[0]+180)%360)-180;
      for(let j=start;j<i;j++){
        const t=(j-start+1)/(i-start+1);
        points[j]=[((a[0]+delta*t+180)%360)-180,a[1]+(b[1]-a[1])*t];
        if(!coordinates[j]){if(shortGap)interpolated++;else inferredStay++;}
      }
    }
  }
  const distance=Float32Array.from(points,p=>p?milesBetween(home,p):NaN);
  const travel=distance.some(d=>d>100);
  if(enabled&&smoothing>0){
    const original=distance.slice(),radius=Math.ceil(smoothing/5),sigma=Math.max(.5,radius/2);
    // Smooth in the plot's logarithmic radial space, independently per run.
    for(const [start,end] of finiteRuns(original))for(let i=start;i<end;i++){
      let sum=0,weights=0;
      for(let j=Math.max(start,i-radius);j<Math.min(end,i+radius+1);j++){
        const weight=Math.exp(-.5*((j-i)/sigma)**2);
        sum+=weight*Math.log1p(original[j]/.18);weights+=weight;
      }
      distance[i]=.18*Math.expm1(sum/weights);
    }
  }
  return {distance,travel,corrected,interpolated,inferredStay};
}
export function chapterDays(chapter,period='all',options={}){
  const span=period==='all'?null:chapter.periods[Number(period)];
  return chapter.days.filter(d=>!span||(d.date>=span.start&&d.date<=span.end)).map((d,index)=>{
    const date=new Date(d.date+'T12:00:00Z'),weekday=date.getUTCDay();
    const trace=cleanTrace(d.coordinates,chapter.home,{...options,blockedBins:d.blockedBins??[]});
    return {...d,...trace,index,date,weekday,weekend:weekday===0||weekday===6,
      label:`${Math.round(d.coverage*100)}% sampled coverage${trace.corrected?' · '+trace.corrected+' glitch bins filtered':''}${trace.interpolated?' · '+trace.interpolated+' gap bins interpolated':''}${trace.inferredStay?' · '+(trace.inferredStay*5/60).toFixed(1)+'h inferred same-place stay':''}${trace.travel?' · recorded beyond 100 miles':''}`};
  });
}
export function finiteRuns(values){
  const runs=[];let start=null;
  for(let i=0;i<=values.length;i++){
    if(i<values.length&&Number.isFinite(values[i])){if(start===null)start=i;}
    else if(start!==null){runs.push([start,i]);start=null;}
  }
  return runs;
}
// The presented view: the owner's chosen cleanup, every day with samples
// (travel included; the clock clips it at the 10-mile edge). The study opens
// with the same settings.
export const PRESENT_TREATMENT={enabled:true,smoothing:10,gap:120,stay:720};
export function presentDays(chapter){return chapterDays(chapter,'all',PRESENT_TREATMENT).filter(day=>day.distance.some(Number.isFinite));}
// A day's distances for the website: two characters per five-minute sample, in
// hundredths of a mile up to 79.20, "!!" where unsampled. Printable ASCII from
// '#' without the backslash, so it sits in JSON unescaped, or '@', so the
// publishing scan never reads it as an email address.
const DIGITS=Array.from({length:91},(_,i)=>String.fromCharCode(35+i)).filter(c=>c!=='\\'&&c!=='@').join(''),BASE=DIGITS.length;
export const MILES_CAP=(BASE*BASE-1)/100;
export function encodeMiles(distance){
  return Array.from(distance,v=>{if(!Number.isFinite(v))return '!!';const n=Math.round(Math.min(v,MILES_CAP)*100);return DIGITS[Math.floor(n/BASE)]+DIGITS[n%BASE];}).join('');
}
export function decodeMiles(text){
  const out=new Float32Array(text.length/2);
  for(let i=0;i<out.length;i++){const a=text[2*i],b=text[2*i+1];out[i]=a==='!'?NaN:(DIGITS.indexOf(a)*BASE+DIGITS.indexOf(b))/100;}
  return out;
}
// Yarnball's median view: for weekdays and for weekends, each hour's median distance and a
// band holding the middle MEDIAN_BAND percent of readings, pooling every reading within half
// an hour of the hour. A median hour is no day I lived: when half my days hold a short outing
// at a different time, every hour's median is still home. Readings are tallied in BINS steps
// of the clock's log scale, so playback can add one day at a time, and the finished medians
// of every home and year are worked out once at build time.
export const MEDIAN_BAND=25;
const BINS=240,TOP=Math.log1p(30/.18),PER=24;
export const medianTally=()=>[0,1].map(()=>Array.from({length:24},()=>new Float64Array(BINS)));
export function tallyDay(counts,day){
  const hours=counts[day.weekend?1:0],n=day.distance.length-1,per=n/PER;
  for(let h=0;h<24;h++)for(let k=-per/2;k<per/2;k++){const v=day.distance[(h*per+k+n)%n];if(Number.isFinite(v))hours[h][Math.min(BINS-1,Math.floor(Math.log1p(v/.18)/TOP*BINS))]++;}
}
function binQuantile(bins,target){
  let seen=0;
  for(let i=0;i<BINS;i++){if(bins[i]&&seen+bins[i]>=target)return .18*Math.expm1((i+(target-seen)/bins[i])/BINS*TOP);seen+=bins[i];}
  return .18*Math.expm1(TOP);
}
// [{group, quantiles:[low, median, high]}], each 24 hourly miles; a group with no readings is left out.
export function summarizeTally(counts){
  const tail=(100-MEDIAN_BAND)/200;
  return counts.map((hours,group)=>{
    const quantiles=[[],[],[]];let any=false;
    for(const bins of hours){let n=0;for(const c of bins)n+=c;any||=n>0;[tail,.5,1-tail].forEach((q,j)=>quantiles[j].push(n?binQuantile(bins,n*q):NaN));}
    return any?{group,quantiles}:null;
  }).filter(Boolean);
}
export const medians=days=>summarizeTally(days.reduce((counts,day)=>(tallyDay(counts,day),counts),medianTally()));

