// Home-clock equinox dates (America/New_York) for the supported chapters.
// https://www.timeanddate.com/calendar/seasons.html?year=2020
const equinoxes={2016:[20,22],2017:[20,22],2018:[20,22],2019:[20,23],2020:[19,22],2021:[20,22]};
export function groupIndex(day, split) {
  if(split==='weekday')return day.weekend?1:0;
  const year=day.date.getUTCFullYear(),dates=equinoxes[year];
  if(!dates)throw new Error('Equinox dates are not configured for '+year);
  const key=Date.UTC(year,day.date.getUTCMonth(),day.date.getUTCDate());
  return key>=Date.UTC(year,2,dates[0])&&key<Date.UTC(year,8,dates[1])?0:1;
}
export function groupLabels(split) {
  return split==='weekday'?['Weekdays','Weekends']:['Mar–Sep','Sep–Mar'];
}
export function summarizeGroups(days, split, sampleCount, middlePercent=50) {
  const tail=(100-middlePercent)/200;
  return [0,1].map(group=>{
    const members=days.filter(day=>groupIndex(day,split)===group);
    if(!members.length)return null;
    const quantiles=[[],[],[]];
    for(let i=0;i<sampleCount;i++) {
      const values=members.map(day=>day.distance[i]).filter(Number.isFinite).sort((a,b)=>a-b);
      if(!values.length){quantiles.forEach(q=>q.push(NaN));continue;}
      [tail,0.5,1-tail].forEach((q,j)=>{
        const rank=(values.length-1)*q,low=Math.floor(rank),high=Math.ceil(rank);
        quantiles[j].push(values[low]+(values[high]-values[low])*(rank-low));
      });
    }
    return {group,count:members.length,quantiles};
  }).filter(Boolean);
}
