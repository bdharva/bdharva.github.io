export function filterFlights(flights, {year='all', airport='all', route='all'}={}) {
  return flights.filter(f=>(year==='all'||f.date.slice(0,4)===year)&&(airport==='all'||f.origin===airport||f.destination===airport)&&(route==='all'||routeKey(f)===route));
}
// Radians of great-circle travel per second at 1×: a 1,600 km flight takes about 2.8 s.
export const DOT_SPEED=.09;
// Advance a playback position (flight index plus fraction) by dt seconds at a
// constant speed along the ground, crossing as many short flights as fit.
export function advance(position,dt,speed,spans){
  let left=dt*speed*DOT_SPEED;
  while(left>0&&position<spans.length){
    const i=Math.floor(position),span=Math.max(spans[i],1e-4),remaining=(i+1-position)*span;
    if(left<remaining)return position+left/span;
    left-=remaining;position=i+1;
  }
  return position;
}
export const routeKey=f=>[f.origin,f.destination].sort().join(' ↔ ');
export const dateLabel=date=>new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
// Distinct airports and legs seen up to and including each flight. A leg is a
// pair of airports in either direction, as in the route filter.
export function runningCounts(flights){
  const airports=new Set(),legs=new Set();
  return flights.map(f=>{airports.add(f.origin);airports.add(f.destination);legs.add(routeKey(f));return {airports:airports.size,legs:legs.size};});
}
export const plural=(n,word)=>`${n.toLocaleString('en-US')} ${word}${n===1?'':'s'}`;
export const monthYear=date=>new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
export function visibleHistory(flights,index,history) { return flights.slice(history==='recent'?Math.max(0,index-20):0,index); }
export const SOURCES=['JetItUp','Flightdiary','Calendar','Timeline','Swarm'];
export function routeColor(f, mode, dark=false) {
  if(mode==='mint')return dark?'#58dfbc':'#148060';
  const colors=dark?['#86bfdf','#e4ac83','#b0a3e2','#79c7b1','#dd9dbd']:['#397d9f','#b47045','#8271b2','#398e77','#a8577e'];
  if(mode==='source')return colors[Math.max(0,SOURCES.indexOf(f.source))];
  return colors[Math.min(3,Math.floor((Number(f.date.slice(0,4))-2008)/4))];
}
// What the website gets: dates and airports only. Airline, flight number,
// source and evidence stay in the private record.
export function publicFlights(data){
  const flights=data.flights.map(f=>({date:f.date,origin:f.origin,destination:f.destination}));
  const used=new Set(flights.flatMap(f=>[f.origin,f.destination]));
  const airports=Object.fromEntries([...used].sort().map(code=>{const a=data.airports[code];return [code,{code,city:a.city,coordinates:a.coordinates.map(v=>Math.round(v*1e4)/1e4)}];}));
  return {flights,airports};
}
