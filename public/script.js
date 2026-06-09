/* ============================================================
   AgendoRápido — interactions  (versão corrigida)
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const isMobile = () => window.innerWidth <= 768;

  /* ---------- Header scroll ---------- */
  const header = $('#header');
  const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const nav = $('#nav');
  const toggle = $('#menuToggle');

  function closeMenu() {
    nav.classList.remove('open');
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    const opening = !nav.classList.contains('open');
    if (opening) {
      nav.classList.add('open');
      toggle.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    } else {
      closeMenu();
    }
  });

  $$('#nav a').forEach(a => a.addEventListener('click', closeMenu));

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) closeMenu();
  });

  /* ---------- Cursor glow (apenas desktop) ---------- */
  const glow = $('#cursorGlow');
  let gx = innerWidth / 2, gy = innerHeight / 2, cx = gx, cy = gy;
  if (!reduce && matchMedia('(pointer:fine)').matches) {
    window.addEventListener('mousemove', e => {
      gx = e.clientX; gy = e.clientY; glow.style.opacity = '1';
    });
    (function rafGlow() {
      cx = lerp(cx, gx, 0.12); cy = lerp(cy, gy, 0.12);
      glow.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(rafGlow);
    })();
  }

  /* ---------- Reveal on scroll ---------- */
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

  /* ---------- Magnetic buttons (somente pointer:fine) ---------- */
  if (!reduce && matchMedia('(pointer:fine)').matches) {
    $$('.magnetic').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX - r.left - r.width/2) * 0.25}px, ${(e.clientY - r.top - r.height/2) * 0.35}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------- Dashboard 3D tilt — SOMENTE desktop ---------- */
  const tilt = $('#dashTilt');
  if (tilt) {
    if (!reduce && matchMedia('(pointer:fine)').matches && !isMobile()) {
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
      /* Mobile: sem nenhuma transformação 3D */
      tilt.style.transform = 'none';
    }
  }

  /* ---------- Feature card tilt (somente pointer:fine) ---------- */
  if (!reduce && matchMedia('(pointer:fine)').matches) {
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

  /* ---------- Flow step stepping ---------- */
  const flowSteps = $$('.flow-step');
  if (flowSteps.length) {
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
  const script = [
    { side: 'in',  html: 'Oi! Queria marcar um corte 😄' },
    { side: 'out', html: 'Olá! Claro 😊 Tenho horário <b>amanhã 15:30</b>. Pode ser?' },
    { side: 'in',  html: 'Pode sim!' },
    { side: 'out', html: 'Agendado! ✅ Corte <b>amanhã 15:30</b>. Te lembro 1h antes 🔔' },
  ];
  let demoTimer = null;

  function addMsg(i) {
    if (!waThread) return;
    const m = script[i];
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
      () => addMsg(0),
      () => addMsg(1),
      () => activateRow(0),
      () => addMsg(2),
      () => addMsg(3),
      () => activateRow(1),
      () => activateRow(2),
      () => activateRow(3),
      () => activateRow(4),
    ];
    demoTimer = setInterval(() => {
      seq[step]();
      step++;
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

  /* ---------- Particle canvas ---------- */
  function particles(canvas, count, color) {
    if (!canvas || reduce) return;
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
    window.addEventListener('resize', () => { resize(); build(); }, { passive: true });
  }
  particles($('#heroParticles'), isMobile() ? 30 : 70, '147,197,253');
  particles($('#ctaParticles'), isMobile() ? 20 : 60, '147,197,253');

  /* ---------- Smooth scroll com offset do header fixo ---------- */
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = header ? header.offsetHeight : 74;
      const y = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  /* ---------- Hero parallax (somente desktop) ---------- */
  if (!reduce && !isMobile()) {
    const aurora = $('.hero__aurora');
    window.addEventListener('scroll', () => {
      if (aurora && window.scrollY < 900)
        aurora.style.transform = `translateY(${window.scrollY * 0.25}px)`;
    }, { passive: true });
  }

})();