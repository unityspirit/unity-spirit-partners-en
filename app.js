// ============================================================
//  YOUR COMPANY — app.js (ScrollCanvas Engine v3)
//  900 frames, 6 sections, synced to native scroll
// ============================================================

const TOTAL_FRAMES = 900;
const PAGE_COUNT   = 6;
const LERP         = 0.08;
const CONCURRENCY  = 48;
const isMobile     = innerWidth < 768;
const FRAME_DIR    = isMobile ? 'frames-mobile' : 'frames-webp';

// ---- DOM refs ----
const canvas  = document.getElementById('gl-canvas');
const ctx     = canvas.getContext('2d');
const pCanvas = document.getElementById('particle-canvas');
const pCtx    = pCanvas.getContext('2d');
const pages   = Array.from(document.querySelectorAll('.page'));
const navLinks    = document.querySelectorAll('#nav-links .nav-link:not(.nav-cta)');
const drawerLinks = document.querySelectorAll('#drawer-links .drawer-link');

// ---- State ----
const frames = new Array(TOTAL_FRAMES);
let loadedCount  = 0;
let isReady      = false;
let preloaderDismissed = false;
const PRELOADER_THRESHOLD = 15;
let currentFrame = 0;
let targetFrame  = 0;

// ---- Canvas resize ----
function resizeCanvases() {
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pCanvas.width = innerWidth;
  pCanvas.height = innerHeight;
}
resizeCanvases();
window.addEventListener('resize', resizeCanvases);

// ============================================================
//  LOADER
// ============================================================
const loaderEl = document.createElement('div');
loaderEl.id = 'loader';
loaderEl.innerHTML = `
  <div class="loader-inner">
    <img src="images/logo.svg" alt="YOUR COMPANY" style="width:112px;height:112px;object-fit:contain;border-radius:10px;margin-bottom:8px">
    <div class="loader-logo">YOUR COMPANY</div>
    <div class="loader-bar-wrap"><div class="loader-bar" id="loader-bar"></div></div>
    <div class="loader-pct" id="loader-pct">0%</div>
  </div>`;
document.body.appendChild(loaderEl);

// Site loading bar (Phase 2)
const siteBarEl = document.createElement('div');
siteBarEl.id = 'siteLoadingBar';
siteBarEl.innerHTML = '<div class="site-loading-fill"><div class="site-loading-fill-inner" id="siteLoadingFillInner"></div></div><span class="site-loading-text" id="siteLoadingText">Loading video...</span>';
document.body.appendChild(siteBarEl);

const loaderCSS = document.createElement('style');
loaderCSS.textContent = `
  #loader {
    position:fixed; inset:0; z-index:9999;
    background:rgba(10,15,30,0.94);
    display:flex; align-items:center; justify-content:center;
    transition:opacity 0.8s ease;
    backdrop-filter:blur(8px);
  }
  #loader.fade-out { opacity:0; pointer-events:none; }
  .loader-inner { text-align:center; display:flex; flex-direction:column; align-items:center; gap:20px; }
  .loader-logo {
    font-family:'Cormorant Garamond',serif;
    font-size:2.2rem; font-weight:300; letter-spacing:0.3em;
    color:#c9a84c;
    animation:loaderPulse 2s ease-in-out infinite;
  }
  @keyframes loaderPulse { 0%,100%{opacity:.6} 50%{opacity:1} }
  .loader-bar-wrap {
    width:260px; height:2px; background:rgba(201,168,76,.2);
    border-radius:2px; overflow:hidden;
  }
  .loader-bar {
    height:100%; width:0%;
    background:linear-gradient(90deg,#c9a84c,#e8c97a);
    border-radius:2px; transition:width 0.1s;
  }
  .loader-pct { font-size:.75rem; color:rgba(201,168,76,.6); letter-spacing:.15em; }
`;
document.head.appendChild(loaderCSS);

// Site loading bar CSS (Phase 2 - deferred)
const siteBarStyle = document.createElement('style');
siteBarStyle.textContent = '.site-loading-bar{position:fixed;bottom:0;left:0;width:100%;height:28px;background:rgba(10,10,10,.85);backdrop-filter:blur(8px);z-index:9998;display:flex;align-items:center;padding:0 16px;gap:10px;opacity:0;visibility:hidden;transition:opacity .5s,visibility .5s;border-top:1px solid rgba(255,255,255,.08)}.site-loading-bar.active{opacity:1;visibility:visible}.site-loading-bar.done{opacity:0;visibility:hidden}.site-loading-fill{flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}.site-loading-fill-inner{height:100%;width:0;background:linear-gradient(90deg,var(--gold,var(--accent,#c9a84c)),var(--gold-light,#e8c97a));border-radius:2px;transition:width .2s}.site-loading-text{font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap}';
document.head.appendChild(siteBarStyle);

// ============================================================
//  FRAME LOADING
// ============================================================
function frameName(i) {
  return `${FRAME_DIR}/frame_${String(i + 1).padStart(6, '0')}.webp`;
}

async function loadFrame(idx) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      frames[idx] = img;
      loadedCount++;
      if (loadedCount === 1) { isReady = true; drawFrame(0); }
      const realPct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
      if (!preloaderDismissed) {
        const visualPct = Math.min(Math.round((realPct / PRELOADER_THRESHOLD) * 100), 100);
        const bar = document.getElementById('loader-bar');
        const pctEl = document.getElementById('loader-pct');
        if (bar) bar.style.width = visualPct + '%';
        if (pctEl) pctEl.textContent = visualPct + '%';
        if (realPct >= PRELOADER_THRESHOLD) {
          preloaderDismissed = true;
          const loader = document.getElementById('loader');
          if (loader) { loader.classList.add('fade-out'); setTimeout(() => loader.remove(), 900); }
          if (typeof pages !== 'undefined' && pages[0]) pages[0].classList.add('is-active');
          const slb = document.getElementById('siteLoadingBar');
          setTimeout(() => { if(slb) slb.style.opacity='1';slb.style.visibility='visible'; }, 700);
        }
      } else {
        const phase2Pct = Math.round(((realPct - PRELOADER_THRESHOLD) / (100 - PRELOADER_THRESHOLD)) * 100);
        const fill = document.getElementById('siteLoadingFillInner');
        const txt = document.getElementById('siteLoadingText');
        if (fill) fill.style.width = phase2Pct + '%';
        if (txt) txt.textContent = 'Loading video ' + realPct + '%';
      }
      resolve();
    };
    img.onerror = () => { frames[idx] = null; loadedCount++; resolve(); };
    img.src = frameName(idx);
  });
}

async function loadAllFrames() {
  const queue = Array.from({ length: TOTAL_FRAMES }, (_, i) => i);
  async function worker() {
    while (queue.length > 0) {
      const idx = queue.shift();
      await loadFrame(idx);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

loadAllFrames().then(() => {
  isReady = true;
  if (!preloaderDismissed) {
    const loader = document.getElementById('loader');
    if (loader) { loader.classList.add('fade-out'); setTimeout(() => loader.remove(), 900); }
  }
  const slb = document.getElementById('siteLoadingBar');
  const txt = document.getElementById('siteLoadingText');
  if (txt) txt.textContent = 'Loading complete';
  setTimeout(() => { if(slb) { slb.style.opacity='0';setTimeout(function(){if(slb)slb.remove()},600); } }, 800);
  if (pages[0]) pages[0].classList.add('is-active');
});

// ============================================================
//  DRAW FRAME
// ============================================================
function drawFrame(idx) {
  const img = frames[Math.max(0, Math.min(idx, TOTAL_FRAMES - 1))];
  if (!img) return;
  const W = innerWidth, H = innerHeight;
  const r = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth * r, ih = img.naturalHeight * r;
  const x = (W - iw) / 2, y = (H - ih) / 2;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, x, y, iw, ih);
  // Vignette
  const vig = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.85);
  vig.addColorStop(0, 'rgba(10,15,30,0)');
  vig.addColorStop(1, 'rgba(10,15,30,0.78)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  // Bottom darkening
  const bot = ctx.createLinearGradient(0, H*0.6, 0, H);
  bot.addColorStop(0, 'rgba(10,15,30,0)');
  bot.addColorStop(1, 'rgba(10,15,30,0.88)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H*0.6, W, H*0.4);
}

// ============================================================
//  SCROLL → FRAME MAPPING
// ============================================================
window.addEventListener('scroll', () => {
  if (!isReady) return;
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const progress = maxScroll > 0 ? scrollY / maxScroll : 0;
  targetFrame = progress * (TOTAL_FRAMES - 1);
  clampFrame();
}, { passive: true });

function clampFrame() {
  targetFrame = Math.max(0, Math.min(targetFrame, TOTAL_FRAMES - 1));
}

// ============================================================
//  PARTICLES
// ============================================================
const PARTICLE_COUNT = 55;
const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
  x: Math.random() * innerWidth,
  y: Math.random() * innerHeight,
  vx: (Math.random() - 0.5) * 0.25,
  vy: -(Math.random() * 0.3 + 0.05),
  r: Math.random() * 1.8 + 0.4,
  alpha: Math.random() * 0.45 + 0.1,
  gold: Math.random() > 0.45,
}));

function drawParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = pCanvas.width;
    if (p.x > pCanvas.width) p.x = 0;
    if (p.y < 0) p.y = pCanvas.height;
    if (p.y > pCanvas.height) { p.y = pCanvas.height; p.vy = -(Math.random() * 0.3 + 0.05); }
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    pCtx.fillStyle = p.gold
      ? `rgba(201,168,76,${p.alpha})`
      : `rgba(124,140,248,${p.alpha * 0.5})`;
    pCtx.fill();
  });
}

// ============================================================
//  RAF LOOP
// ============================================================
function animate() {
  requestAnimationFrame(animate);
  currentFrame += (targetFrame - currentFrame) * LERP;
  if (isReady) drawFrame(Math.round(currentFrame));
  drawParticles();
}
animate();

// ============================================================
//  INTERSECTION OBSERVER
// ============================================================
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = pages.indexOf(entry.target);
      pages.forEach((p, i) => p.classList.toggle('is-active', i === idx));
      navLinks.forEach((l, i) => l.classList.toggle('active', i === idx - 1));
      drawerLinks.forEach((l, i) => l.classList.toggle('active', i === idx - 1));
    }
  });
}, { root: null, rootMargin: '-40% 0px -40% 0px' });

pages.forEach(p => observer.observe(p));

// ============================================================
//  SCROLL-TO-SECTION
// ============================================================
document.querySelectorAll('[data-scroll]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    const idx = parseInt(el.dataset.scroll);
    if (pages[idx]) pages[idx].scrollIntoView({ behavior: 'smooth' });
    document.getElementById('nav-drawer').hidden = true;
    document.getElementById('nav-scrim').hidden = true;
  });
});

// ============================================================
//  BURGER / DRAWER
// ============================================================
document.getElementById('burger').addEventListener('click', () => {
  document.getElementById('nav-drawer').hidden = false;
  document.getElementById('nav-scrim').hidden = false;
});
document.getElementById('drawer-close').addEventListener('click', () => {
  document.getElementById('nav-drawer').hidden = true;
  document.getElementById('nav-scrim').hidden = true;
});
document.getElementById('nav-scrim').addEventListener('click', () => {
  document.getElementById('nav-drawer').hidden = true;
  document.getElementById('nav-scrim').hidden = true;
});

// ============================================================
//  NAVBAR SCROLL EFFECT
// ============================================================
window.addEventListener('scroll', () => {
  document.getElementById('navbar').style.background =
    scrollY > 60 ? 'rgba(10,15,30,0.97)' : 'rgba(10,15,30,0.85)';
}, { passive: true });

// === SITE LOADING BAR (Phase 2 — deferred) ===
(function(){
  if (document.getElementById('siteLoadingBar')) return;
  var el = document.createElement('div');
  el.id = 'siteLoadingBar';
  el.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;height:32px;background:rgba(10,10,10,.88);backdrop-filter:blur(10px);z-index:9998;display:flex;align-items:center;padding:0 20px;gap:12px;opacity:0;visibility:hidden;transition:opacity .5s,visibility .5s;border-top:1px solid rgba(255,255,255,.08);';
  el.innerHTML = '<div style="flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;"><div id="slbFill" style="height:100%;width:0;background:linear-gradient(90deg,var(--gold,var(--accent,#c9a84c)),#e8c97a);border-radius:2px;transition:width .25s;"></div></div><span id="siteLoadingText" style="font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap;">Loading video...</span>';
  document.body.appendChild(el);
})();
