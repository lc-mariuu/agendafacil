/* ============================================================
   AgendoRápido — interactions (otimizado p/ mobile)
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const reduce   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Dispositivo "desktop com mouse" — só aí rodam os efeitos pesados
  const isDesktop = window.matchMedia('(pointer:fine)').matches && window.innerWidth > 1024;
  const heavyFX  = !reduce && isDesktop;

  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Header scroll ---------- */
  const header = $('#header');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (header) header.classList.toggle('scrolled', window.scrollY > 30);
      ticking = false;
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const nav = $('#nav');
  const toggle = $('#menuToggle');

  function closeMenu() {
    if (!nav) return;
    nav.classList.remove('open');
    if (toggle) {
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  }
  function openMenu() {
    if (!nav) return;
    nav.classList.add('open');
    if (toggle) {
      toggle.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    }
  }

  if (toggle && nav) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (nav.classList.contains('open')) closeMenu();
      else openMenu();
    });
    // Fecha ao clicar em qualquer link do menu
    $$('#nav a').forEach(a => a.addEventListener('click', closeMenu));
  }

  /* ---------- Resize: só reage a mudança REAL de largura ----------
     (no mobile a barra de endereço dispara resize ao rolar — isso
     mudava só a altura e causava o "tremido". Aqui ignoramos.) */
  let lastWidth = window.innerWidth;
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    if (w === lastWidth) return;      // largura não mudou → ignora
    lastWidth = w;
    if (w > 1024) closeMenu();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (window.rebuildParticles) window.rebuildParticles(); }, 200);
  }, { passive: true });

  /* ---------- Cursor glow (só desktop) ---------- */
  const glow = $('#cursorGlow');
  if (glow && heavyFX) {
    let gx = innerWidth / 2, gy = innerHeight / 2, cx = gx, cy = gy;
    window.addEventListener('mousemove', e => {
      gx = e.clientX; gy = e.clientY; glow.style.opacity = '1';
    }, { passive: true });
    (function rafGlow() {
      cx = lerp(cx, gx, 0.12); cy = lerp(cy, gy, 0.12);
      glow.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(rafGlow);
    })();
  }

  /* ---------- Reveal on scroll (todos os dispositivos) ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en, i) => {
      if (en.isIntersecting) {
        en.target.style.transitionDelay = (en.target.dataset.delay || (i % 4) * 70) + 'ms';
        en.target.classList.add('in');
        revealIO.unobserve(en.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal]').forEach(el => revealIO.observe(el));

  /* ---------- Animated counters ---------- */
  const fmt = (el, val) => {
    const pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    const n = Math.round(val);
    const s = el.dataset.format === 'thousand' ? n.toLocaleString('pt-BR') : String(n);
    el.textContent = pre + s + suf;
  };
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, target = +el.dataset.count, dur = 1600, t0 = performance.now();
      const tick = t => {
        const p = Math.min(1, (t - t0) / dur);
        fmt(el, target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ---------- Magnetic buttons (só desktop) ---------- */
  if (heavyFX) {
    $$('.magnetic').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX - r.left - r.width/2) * 0.25}px, ${(e.clientY - r.top - r.height/2) * 0.35}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------- Dashboard 3D tilt (só desktop) ---------- */
  const tilt = $('#dashTilt');
  if (tilt) {
    if (heavyFX) {
      const stage = $('.dash-stage');
      let tx = 0, ty = 0, ctxv = 0, ctyv = 0;
      stage.addEventListener('mousemove', e => {
        const r = stage.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5;
        ty = (e.clientY - r.top) / r.height - 0.5;
      });
      stage.addEventListener('mouseleave', () => { tx = 0; ty = 0; });
      (function rafTilt() {
        ctxv = lerp(ctxv, tx, 0.08); ctyv = lerp(ctyv, ty, 0.08);
        tilt.style.transform = `rotateX(${6 - ctyv * 10}deg) rotateY(${ctxv * 12}deg)`;
        $$('.float-card', tilt).forEach(c => {
          const d = +c.dataset.depth || 30;
          c.style.transform = `translate3d(${ctxv * d}px, ${ctyv * d}px, 60px)`;
        });
        requestAnimationFrame(rafTilt);
      })();
    } else {
      tilt.style.transform = 'none';
    }
  }

  /* ---------- Feature card tilt (só desktop) ---------- */
  if (heavyFX) {
    $$('.tilt').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', px * 100 + '%');
        card.style.setProperty('--my', py * 100 + '%');
        card.style.transform = `perspective(800px) rotateX(${(0.5 - py) * 8}deg) rotateY(${(px - 0.5) * 8}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- Flow step stepping (leve — roda em todos) ---------- */
  const flowSteps = $$('.flow-step');
  if (flowSteps.length && !reduce) {
    let fi = 0;
    const flowIO = new IntersectionObserver(es => {
      es.forEach(en => {
        if (!en.isIntersecting) return;
        setInterval(() => {
          flowSteps.forEach((s, i) => {
            const node = s.querySelector('.flow-step__node');
            if (node) node.style.boxShadow = i === fi ? '0 18px 44px -10px rgba(37,99,235,.9)' : '';
            s.style.opacity = i <= fi ? '1' : '.55';
          });
          fi = (fi + 1) % flowSteps.length;
        }, 900);
        flowIO.disconnect();
      });
    }, { threshold: 0.3 });
    flowIO.observe(flowSteps[0]);
  }

  /* ---------- WhatsApp demo ---------- */
  const waThread = $('#waThread');
  const demoRows = $$('.demo-row');
  const demoProgress = $('#demoProgress');
  const demoPlay = $('#demoPlay');
  const demoScript = [
    { side: 'in',  html: 'Oi! Queria marcar um corte 😄' },
    { side: 'out', html: 'Olá! Claro 😊 Tenho horário <b>amanhã 15:30</b>. Pode ser?' },
    { side: 'in',  html: 'Pode sim!' },
    { side: 'out', html: 'Agendado! ✅ Corte <b>amanhã 15:30</b>. Te lembro 1h antes 🔔' },
  ];
  let demoTimer = null;

  function addMsg(i) {
    if (!waThread) return;
    const m = demoScript[i];
    const div = document.createElement('div');
    div.className = 'wa-msg wa-msg--' + m.side;
    div.innerHTML = m.html;
    waThread.appendChild(div);
  }
  function activateRow(i) {
    const row = demoRows.find(r => +r.dataset.row === i);
    if (row) row.classList.add('active');
  }
  function runDemo() {
    if (demoTimer || !waThread) return;
    waThread.innerHTML = '';
    demoRows.forEach(r => r.classList.remove('active'));
    if (demoProgress) demoProgress.style.width = '0%';
    let step = 0;
    const seq = [
      () => addMsg(0), () => addMsg(1), () => activateRow(0),
      () => addMsg(2), () => addMsg(3), () => activateRow(1),
      () => activateRow(2), () => activateRow(3), () => activateRow(4),
    ];
    demoTimer = setInterval(() => {
      seq[step](); step++;
      if (demoProgress) demoProgress.style.width = (step / seq.length * 100) + '%';
      if (step >= seq.length) { clearInterval(demoTimer); demoTimer = null; }
    }, 850);
  }
  if (demoPlay) demoPlay.addEventListener('click', () => { clearInterval(demoTimer); demoTimer = null; runDemo(); });
  if (waThread) {
    const demoSection = $('.demo');
    if (demoSection) {
      const demoIO = new IntersectionObserver(es => {
        es.forEach(en => { if (en.isIntersecting) { runDemo(); demoIO.disconnect(); } });
      }, { threshold: 0.25 });
      demoIO.observe(demoSection);
    }
  }

  /* ---------- FAQ accordion ---------- */
  $$('.faq-item').forEach(item => {
    const q = $('.faq-item__q', item);
    const a = $('.faq-item__a', item);
    if (!q || !a) return;
    q.addEventListener('click', () => {
      const open = item.classList.contains('open');
      $$('.faq-item').forEach(o => {
        o.classList.remove('open');
        const oa = $('.faq-item__a', o);
        if (oa) oa.style.maxHeight = null;
      });
      if (!open) { item.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px'; }
    });
  });

  /* ---------- Particle canvas (SÓ desktop) ---------- */
  const particleInstances = [];
  function particles(canvas, count, color) {
    if (!canvas || !heavyFX) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w, h, pts = [];
    function resize() {
      const r = canvas.getBoundingClientRect();
      w = canvas.width = r.width * dpr;
      h = canvas.height = r.height * dpr;
    }
    function build() {
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: (Math.random() * 1.6 + 0.4) * dpr,
        vx: (Math.random() - 0.5) * 0.25 * dpr,
        vy: (Math.random() - 0.5) * 0.25 * dpr,
        a: Math.random() * 0.5 + 0.15,
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${p.a})`;
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    resize(); build(); draw();
    particleInstances.push({ resize, build });
  }
  // Reconstrói partículas só quando a largura muda de verdade (chamado pelo resize acima)
  window.rebuildParticles = function () {
    particleInstances.forEach(p => { p.resize(); p.build(); });
  };
  particles($('#heroParticles'), 70, '147,197,253');
  particles($('#ctaParticles'), 60, '147,197,253');

  /* ---------- Smooth scroll com offset do header ---------- */
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      const offset = header ? header.offsetHeight : 64;
      const y = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  /* ---------- Hero parallax (SÓ desktop) ---------- */
  if (heavyFX) {
    const aurora = $('.hero__aurora');
    let pTick = false;
    window.addEventListener('scroll', () => {
      if (pTick) return;
      pTick = true;
      requestAnimationFrame(() => {
        if (aurora && window.scrollY < 900)
          aurora.style.transform = `translateY(${window.scrollY * 0.25}px)`;
        pTick = false;
      });
    }, { passive: true });
  }

})();