/* ============================================================
   AgendoRápido — interactions
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Header scroll state ---------- */
  const header = $('#header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const nav = $('#nav');
  const toggle = $('#menuToggle');

  // CORRIGIDO: toggle da classe is-open no botão (anima as 3 barras)
  // e aria-expanded para acessibilidade
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    // Impede scroll do body quando menu aberto em mobile
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Fecha ao clicar em qualquer link
  $$('#nav a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }));

  // Fecha ao redimensionar para desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      nav.classList.remove('open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });

  /* ---------- Cursor glow ---------- */
  const glow = $('#cursorGlow');
  let gx = innerWidth / 2, gy = innerHeight / 2, cx = gx, cy = gy;
  if (!reduce && matchMedia('(pointer:fine)').matches) {
    window.addEventListener('mousemove', e => { gx = e.clientX; gy = e.clientY; glow.style.opacity = '1'; });
    (function raf() {
      cx = lerp(cx, gx, 0.12); cy = lerp(cy, gy, 0.12);
      glow.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(raf);
    })();
  }

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en, i) => {
      if (en.isIntersecting) {
        en.target.style.transitionDelay = (en.target.dataset.delay || (i % 4) * 70) + 'ms';
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]').forEach(el => io.observe(el));

  /* ---------- Animated counters ---------- */
  const fmt = (el, val) => {
    const pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    let n = Math.round(val);
    let s = el.dataset.format === 'thousand' ? n.toLocaleString('pt-BR') : String(n);
    el.textContent = pre + s + suf;
  };
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, target = +el.dataset.count, dur = 1600, t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        fmt(el, target * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ---------- Magnetic buttons ---------- */
  if (!reduce && matchMedia('(pointer:fine)').matches) {
    $$('.magnetic').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------- Dashboard 3D tilt (mouse parallax) ---------- */
  // CORRIGIDO: só ativa em telas não-touch (pointer:fine) e largura suficiente
  const tilt = $('#dashTilt');
  if (tilt && !reduce && matchMedia('(pointer:fine)').matches && window.innerWidth > 768) {
    const stage = $('.dash-stage');
    let tx = 0, ty = 0, ctxv = 0, ctyv = 0;
    stage.addEventListener('mousemove', e => {
      const r = stage.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5);
      ty = ((e.clientY - r.top) / r.height - 0.5);
    });
    stage.addEventListener('mouseleave', () => { tx = 0; ty = 0; });
    (function raf() {
      ctxv = lerp(ctxv, tx, 0.08); ctyv = lerp(ctyv, ty, 0.08);
      const baseX = 6;
      tilt.style.transform = `rotateX(${baseX - ctyv * 10}deg) rotateY(${ctxv * 12}deg)`;
      $$('.float-card', tilt).forEach(c => {
        const d = +c.dataset.depth || 30;
        c.style.transform = `translate3d(${ctxv * d}px, ${ctyv * d}px, 60px)`;
      });
      requestAnimationFrame(raf);
    })();
  } else if (tilt) {
    // Mobile: sem tilt
    tilt.style.transform = 'none';
  }

  /* ---------- Feature card glow + tilt ---------- */
  if (!reduce && matchMedia('(pointer:fine)').matches) {
    $$('.tilt').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', px * 100 + '%');
        card.style.setProperty('--my', py * 100 + '%');
        card.style.transform =
          `perspective(800px) rotateX(${(0.5 - py) * 8}deg) rotateY(${(px - 0.5) * 8}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- Solution flow active stepping ---------- */
  const flowSteps = $$('.flow-step');
  if (flowSteps.length) {
    let fi = 0;
    const flowIO = new IntersectionObserver((es) => {
      es.forEach(en => {
        if (en.isIntersecting) {
          setInterval(() => {
            flowSteps.forEach((s, i) => {
              const node = s.querySelector('.flow-step__node');
              if (node) {
                node.style.boxShadow = i === fi ? '0 18px 44px -10px rgba(37,99,235,.9)' : '';
              }
            });
            flowSteps.forEach((s, i) => s.style.opacity = i <= fi ? '1' : '.55');
            fi = (fi + 1) % flowSteps.length;
          }, 900);
          flowIO.disconnect();
        }
      });
    }, { threshold: 0.4 });
    flowIO.observe(flowSteps[0]);
  }

  /* ---------- Interactive WhatsApp demo ---------- */
  const waThread = $('#waThread');
  const demoRows = $$('.demo-row');
  const demoProgress = $('#demoProgress');
  const demoPlay = $('#demoPlay');
  const script = [
    { side: 'in', html: 'Oi! Queria marcar um corte 😄' },
    { side: 'out', html: 'Olá! Claro 😊 Tenho horário <b>amanhã 15:30</b>. Pode ser?' },
    { side: 'in', html: 'Pode sim!' },
    { side: 'out', html: 'Agendado! ✅ Corte <b>amanhã 15:30</b>. Te lembro 1h antes 🔔' },
  ];
  let demoTimer = null;

  function runDemo() {
    if (demoTimer) return;
    if (!waThread) return;
    waThread.innerHTML = '';
    demoRows.forEach(r => r.classList.remove('active'));
    if (demoProgress) demoProgress.style.width = '0%';
    let step = 0;
    const seq = [
      () => addMsg(0),
      () => addMsg(1),
      () => { activateRow(0); },
      () => addMsg(2),
      () => addMsg(3),
      () => { activateRow(1); },
      () => { activateRow(2); },
      () => { activateRow(3); },
      () => { activateRow(4); },
    ];
    const total = seq.length;
    demoTimer = setInterval(() => {
      seq[step]();
      step++;
      if (demoProgress) demoProgress.style.width = (step / total) * 100 + '%';
      if (step >= total) { clearInterval(demoTimer); demoTimer = null; }
    }, 850);
  }

  function addMsg(i) {
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

  if (demoPlay) demoPlay.addEventListener('click', () => { clearInterval(demoTimer); demoTimer = null; runDemo(); });

  if (waThread) {
    const demoSection = $('.demo');
    if (demoSection) {
      const demoIO = new IntersectionObserver((es) => {
        es.forEach(en => { if (en.isIntersecting) { runDemo(); demoIO.disconnect(); } });
      }, { threshold: 0.3 });
      demoIO.observe(demoSection);
    }
  }

  /* ---------- FAQ accordion ---------- */
  $$('.faq-item').forEach(item => {
    const q = $('.faq-item__q', item);
    const a = $('.faq-item__a', item);
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
    let w, h, dpr = Math.min(2, window.devicePixelRatio || 1), pts = [];
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
        a: Math.random() * 0.5 + 0.15
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
  particles($('#heroParticles'), 70, '147,197,253');
  particles($('#ctaParticles'), 60, '147,197,253');

  /* ---------- Smooth anchor offset for fixed header ---------- */
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const headerH = header ? header.offsetHeight : 80;
      const y = el.getBoundingClientRect().top + window.scrollY - headerH;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  /* ---------- Hero subtle parallax on scroll ---------- */
  if (!reduce) {
    const aurora = $('.hero__aurora');
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (aurora && y < 900) aurora.style.transform = `translateY(${y * 0.25}px)`;
    }, { passive: true });
  }
})();