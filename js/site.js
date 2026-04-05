// ═══════════════════════════════════════════════
// Dark mode toggle (checkbox sync)
// ═══════════════════════════════════════════════
(function() {
  var toggle = document.getElementById('darkToggle');
  if (!toggle) return;
  var stored = localStorage.getItem('darkMode');
  var isDark = stored === 'true' || (stored === null && window.matchMedia('(prefers-color-scheme:dark)').matches);
  toggle.checked = isDark;
  toggle.addEventListener('change', function() {
    document.documentElement.classList.toggle('dark', toggle.checked);
    localStorage.setItem('darkMode', toggle.checked);
  });
})();

// ═══════════════════════════════════════════════
// Nav scroll-hide (works on <nav> or .post-topbar)
// ═══════════════════════════════════════════════
(function() {
  var bar = document.querySelector('nav') || document.querySelector('.post-topbar');
  if (!bar) return;
  var threshold = bar.classList.contains('post-topbar') ? 100 : 200;
  var lastY = 0;
  var ticking = false;

  function update() {
    var y = window.scrollY;
    bar.classList.toggle('tucked', y > lastY && y > threshold);
    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  });
})();

// ═══════════════════════════════════════════════
// Mobile menu
// ═══════════════════════════════════════════════
(function() {
  var toggle = document.getElementById('showmenu');
  var menu = document.getElementById('mobileMenu');
  if (!toggle || !menu) return;
  var isOpen = false;
  var openIcon = toggle.querySelector('.icon-open');
  var closeIcon = toggle.querySelector('.icon-close');

  function open() {
    menu.classList.add('is-open');
    if (openIcon) openIcon.style.display = 'none';
    if (closeIcon) closeIcon.style.display = '';
    toggle.setAttribute('aria-expanded', 'true');
    isOpen = true;
  }

  function close() {
    menu.classList.remove('is-open');
    if (openIcon) openIcon.style.display = '';
    if (closeIcon) closeIcon.style.display = 'none';
    toggle.setAttribute('aria-expanded', 'false');
    isOpen = false;
  }

  toggle.addEventListener('click', function(e) {
    e.preventDefault();
    isOpen ? close() : open();
  });

  document.addEventListener('click', function(e) {
    if (isOpen && !menu.contains(e.target) && !toggle.contains(e.target)) close();
  });

  document.addEventListener('keydown', function(e) {
    if (isOpen && e.key === 'Escape') close();
  });
})();

// ═══════════════════════════════════════════════
// Scroll reveal — staggered with one easing curve
// ═══════════════════════════════════════════════
(function() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('[data-reveal]').forEach(function(el) {
      el.classList.add('is-visible');
    });
    return;
  }

  var els = document.querySelectorAll('[data-reveal]');
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;

      // Stagger siblings
      var parent = el.parentElement;
      var siblings = parent.querySelectorAll('[data-reveal]');
      var idx = Array.prototype.indexOf.call(siblings, el);
      var delay = idx > 0 ? idx * 100 : 0;

      setTimeout(function() {
        el.classList.add('is-visible');
      }, delay);

      observer.unobserve(el);
    });
  }, { threshold: 0.12 });

  els.forEach(function(el) { observer.observe(el); });

  // Hero bg zoom on load
  var hero = document.querySelector('.hero');
  if (hero) {
    requestAnimationFrame(function() {
      hero.classList.add('is-visible');
    });
  }
})();

// ═══════════════════════════════════════════════
// Infinite apps carousel
// ═══════════════════════════════════════════════
(function() {
  var el = document.getElementById('appsCarousel');
  if (!el) return;

  var cards = el.querySelectorAll('.app-card');
  var needed = Math.ceil((window.innerWidth * 3) / 250);
  var copies = Math.ceil(needed / cards.length);
  for (var i = 0; i < copies; i++) {
    cards.forEach(function(card) { el.appendChild(card.cloneNode(true)); });
  }

  var speed = 0.5;
  var pos = 0;
  var paused = false;
  var firstSetWidth = 0;
  var gap = 12;
  cards.forEach(function(c) { firstSetWidth += c.offsetWidth + gap; });

  el.addEventListener('mouseenter', function() { paused = true; });
  el.addEventListener('mouseleave', function() { paused = false; });

  function tick() {
    if (!paused) {
      pos -= speed;
      if (Math.abs(pos) >= firstSetWidth) pos += firstSetWidth;
      el.style.transform = 'translateX(' + pos + 'px)';
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// ═══════════════════════════════════════════════
// Keep autoplay videos alive when visible
// ═══════════════════════════════════════════════
(function() {
  function safePlay(vid) {
    var p = vid.play();
    if (p) p.catch(function() {
      vid.load();
      vid.play().catch(function() {});
    });
  }

  // Autoplay videos (homepage featured): play/pause on visibility
  var autoplayVideos = document.querySelectorAll('video[autoplay]');
  if (autoplayVideos.length) {
    var autoplayObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var vid = entry.target;
        if (entry.isIntersecting) {
          safePlay(vid);
        } else {
          vid.pause();
        }
      });
    }, { threshold: 0.1 });
    autoplayVideos.forEach(function(vid) { autoplayObserver.observe(vid); });
  }

  // Lazy-loaded videos (making grid): load src and autoplay when visible
  var lazyVideos = document.querySelectorAll('video source[data-src]');
  if (lazyVideos.length) {
    var lazyObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var vid = entry.target;
          var source = vid.querySelector('source[data-src]');
          if (source) {
            source.src = source.getAttribute('data-src');
            source.removeAttribute('data-src');
            vid.load();
          }
          safePlay(vid);
          lazyObserver.unobserve(vid);
        }
      });
    }, { threshold: 0.1, rootMargin: '200px' });
    lazyVideos.forEach(function(source) {
      lazyObserver.observe(source.closest('video'));
    });
  }

  // Restore videos after bfcache (back/forward navigation)
  window.addEventListener('pageshow', function(e) {
    if (e.persisted) {
      document.querySelectorAll('video[autoplay]').forEach(function(vid) {
        vid.load();
        safePlay(vid);
      });
    }
  });
})();
