// A fixed neighbourhood inset inside a clock's home ring. It never follows a
// day. Tiles from OpenFreeMap, drawn in the page's map tokens, labels hidden.
const MAPLIBRE='https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs',ZOOM=12.5;
let library=null;
// One style download and one library load, shared by every inset on the page.
function load(){
  return library??=Promise.all([import(MAPLIBRE),fetch('https://tiles.openfreemap.org/styles/positron').then(r=>{if(!r.ok)throw Error('Map style unavailable');return r.json();})]);
}
function layerPaint(layer,theme){
  if(layer.type==='background')return {'background-color':theme.mapLand};
  if(layer.type==='fill')return {'fill-color':/water/.test(layer.id)?theme.mapWater:/park|wood|grass|landcover/.test(layer.id)?theme.mapPark:/building/.test(layer.id)?theme.mapBuilding:theme.mapLand,'fill-outline-color':theme.mapBuilding};
  if(layer.type==='line')return {'line-color':/water/.test(layer.id)?theme.mapWater:/boundary/.test(layer.id)?theme.home:theme.mapRoad};
  return {};
}
// Labels and icons are never shown, so they are dropped with the sprite and
// glyphs they need: a sprite that never arrives can stall the whole map.
function themed(base,theme){
  const style=structuredClone(base);delete style.sprite;delete style.glyphs;
  style.layers=style.layers.filter(layer=>layer.type!=='symbol'&&!Object.keys(layer.paint??{}).some(key=>key.endsWith('-pattern')));
  for(const layer of style.layers){layer.paint??={};Object.assign(layer.paint,layerPaint(layer,theme));}
  return style;
}
// Small insets are still pictures: each offscreen map draws once and is removed,
// so a page of clocks holds no live maps.
export function homeSnapshot(center,theme,size){
  return load().then(([{Map},base])=>new Promise((resolve,reject)=>{
    const ratio=Math.min(devicePixelRatio||1,2),box=document.createElement('div');
    box.style.cssText=`position:fixed;left:-9999px;top:0;width:${size}px;height:${size}px`;document.body.append(box);
    const map=new Map({container:box,style:themed(base,theme),center,zoom:ZOOM,interactive:false,attributionControl:false,renderWorldCopies:false,pixelRatio:ratio,canvasContextAttributes:{preserveDrawingBuffer:true}});
    const done=url=>{setTimeout(()=>{map.remove();box.remove();url?resolve(url):reject(Error('Map unavailable'));});};
    map.once('idle',()=>done(map.getCanvas().toDataURL('image/png')));
    map.on('error',()=>done(null));
  }));
}
export function homeMap(container,theme,center){
  let map=null,ready=false;
  const paint=()=>{
    if(!map||!ready)return;
    for(const layer of map.getStyle().layers){
      for(const [key,value]of Object.entries(layerPaint(layer,theme)))map.setPaintProperty(layer.id,key,value);
      if(layer.type==='symbol')map.setLayoutProperty(layer.id,'visibility','none');
    }
  };
  load().then(([{Map},base])=>{
    const style=themed(base,theme);
    map=new Map({container,style,center,zoom:ZOOM,interactive:false,attributionControl:false,renderWorldCopies:false});
    new ResizeObserver(()=>{if(!map)return;map.resize();map.jumpTo({center,zoom:ZOOM});}).observe(container);
    map.on('load',()=>{ready=true;paint();map.jumpTo({center,zoom:ZOOM});container.dataset.loaded='true';});
    map.on('error',()=>{container.dataset.unavailable='true';});
  }).catch(error=>{container.dataset.unavailable='true';console.warn('Home map unavailable:',error);});
  return {
    setTheme(next){theme=next;paint();},
    setCenter(next){center=next;map?.jumpTo({center,zoom:ZOOM});},
    remove(){map?.remove();map=null;},
  };
}
