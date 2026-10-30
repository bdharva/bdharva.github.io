// Map Room's own theme: dark unless the reader has chosen light here. The choice is
// kept under its own key, apart from the site's darkMode, and each page's head reads
// it before first paint. Buttons marked data-map-room-theme flip it.
(function(){
  var root=document.documentElement,KEY='mapRoomTheme';
  function set(dark){
    root.classList.toggle('dark',dark);
    try{localStorage.setItem(KEY,dark?'dark':'light');}catch(e){}
    document.dispatchEvent(new CustomEvent('themechange',{detail:{dark:dark}}));
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-map-room-theme]');
    if(b){set(!root.classList.contains('dark'));if(e.detail)b.blur();}
  });
})();

// On a phone the toolbar's segmented choices fold into one button that names what is
// chosen ("All Sources · Follow") and opens a menu of every group. The segmented
// controls stay the source of truth: the menu clicks their buttons and reads their
// aria-pressed, so each piece's own code needs no change.
(function(){
  var tools=document.getElementById('present-tools');if(!tools)return;
  var nav=tools.querySelector('.bleed-nav'),wrap=document.createElement('div'),toggle=document.createElement('button'),menu=document.createElement('div');
  wrap.className='picker';toggle.type='button';toggle.className='button picker-toggle';toggle.setAttribute('aria-haspopup','true');toggle.setAttribute('aria-expanded','false');
  menu.className='picker-menu';menu.hidden=true;wrap.append(toggle,menu);nav.append(wrap);
  function groups(){return Array.prototype.filter.call(tools.querySelectorAll('.segmented[role=group]'),function(g){return !wrap.contains(g)&&!g.hidden;});}
  function chosen(g){var b=g.querySelector('button[aria-pressed=true]');return b?b.textContent:'';}
  function label(){
    var gs=groups(),words=gs.map(chosen).filter(Boolean);wrap.hidden=!gs.length;
    toggle.innerHTML='<span></span><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>';toggle.firstChild.textContent=words.join(' · ');
    toggle.setAttribute('aria-label',gs.map(function(g){return (g.getAttribute('aria-label')||'Show')+': '+chosen(g);}).join(', ')+'. Change');
  }
  function close(){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}
  function open(){
    menu.innerHTML='';
    groups().forEach(function(g){
      var h=document.createElement('p');h.className='picker-heading';h.textContent=g.getAttribute('aria-label')||'';menu.append(h);
      Array.prototype.forEach.call(g.querySelectorAll('button'),function(src){
        var b=document.createElement('button');b.type='button';b.className='picker-item';b.textContent=src.textContent;b.setAttribute('aria-pressed',src.getAttribute('aria-pressed'));
        b.onclick=function(){src.click();close();toggle.focus();};menu.append(b);
      });
    });
    menu.hidden=false;toggle.setAttribute('aria-expanded','true');(menu.querySelector('[aria-pressed=true]')||menu.querySelector('button')).focus();
  }
  toggle.onclick=function(){menu.hidden?open():close();};
  document.addEventListener('click',function(e){if(!menu.hidden&&!wrap.contains(e.target))close();});
  // While the menu is open its keys are its own: Esc closes it, the arrows move through it.
  document.addEventListener('keydown',function(e){
    if(menu.hidden)return;
    if(e.key==='Escape'){e.stopImmediatePropagation();close();toggle.focus();}
    else if(/^Arrow/.test(e.key)){
      e.stopImmediatePropagation();e.preventDefault();
      var items=Array.prototype.slice.call(menu.querySelectorAll('button')),i=items.indexOf(document.activeElement);
      items[(i+(/Up|Left/.test(e.key)?-1:1)+items.length)%items.length].focus();
    }
  },true);
  // Phones without a full-screen API (iPhone Safari) lose the button rather than show a dead one.
  var full=document.getElementById('present-full');if(full&&!(document.fullscreenEnabled||document.webkitFullscreenEnabled))full.hidden=true;
  // Fold into the picker whenever the choices don't fit on one line, at any width, not only on
  // a phone: unfold, measure, and fold again if any group overflows or the toolbar wraps.
  function fit(){
    tools.classList.remove('folded');
    var gs=groups(),kids=Array.prototype.filter.call(tools.children,function(k){return k.offsetParent;}),top=kids.length?kids[0].offsetTop:0;
    var over=gs.some(function(g){return g.scrollWidth>g.clientWidth+1||g.offsetTop>gs[0].offsetTop+4;})||nav.scrollWidth>nav.clientWidth+1||kids.some(function(k){return Math.abs(k.offsetTop-top)>4;});
    tools.classList.toggle('folded',over);
  }
  function update(){fit();label();}
  window.addEventListener('resize',update);if(document.fonts)document.fonts.ready.then(update);
  new MutationObserver(function(list){if(list.some(function(m){return !wrap.contains(m.target);}))update();}).observe(tools,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed','hidden']});update();
})();
// Focus rings are for the keyboard: Tab shows them, a tap or click hides them again, so a
// button that takes focus from code (Play, a dialog's close, the picker) doesn't glow after a click.
(function(){
  var root=document.documentElement;
  document.addEventListener('keydown',function(e){if(e.key==='Tab')root.classList.add('keyboard-nav');},true);
  document.addEventListener('pointerdown',function(){root.classList.remove('keyboard-nav');},true);
})();

