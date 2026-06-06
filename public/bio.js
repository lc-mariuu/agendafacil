/* ============================================================
   AgendoRápido — Bio Premium
   ▸ Para personalizar: edite apenas o objeto CONFIG abaixo.
   ▸ Troque dados, cores, links, serviços, fotos e horários.
   ============================================================ */

const CONFIG = {
  /* ---- Tema & cor (troque aqui para reskin instantâneo) ---- */
  theme: "dark",          // "dark" | "light"
  accent: ["#7c5cff", "#22d3ee"], // [cor1, cor2] do gradiente principal

  /* ---- Destino do botão AGENDAR AGORA ----
     ▸ Cole aqui o link da SUA página de agendamento (que você já tem).
       Pode ser um caminho local ("minha-agenda.html") ou uma URL completa
       ("https://seusite.com/agenda"). Todos os botões "Agendar" apontam pra cá. */
  bookingUrl: "agendar.html",
  passServiceParam: false, // true = adiciona ?servico=Nome ao link (só se sua página souber ler)

  /* ---- Perfil ---- */
  profile: {
    name: "Barbearia Navalha de Ouro",
    initials: "NO",                 // usado se não houver foto
    photo: "",                      // ex: "fotos/perfil.jpg" (deixe "" p/ monograma)
    role: "Barbearia & Studio Masculino",
    description: "Cortes clássicos e modernos, barba desenhada e cuidado de verdade. Reserve em segundos.",
    city: "Vila Madalena · São Paulo, SP",
    verified: true,
    rating: 4.9,
    reviewsCount: 487,
    clients: "12.4k",
    years: 8,
  },

  /* ---- Cartão de destaque ---- */
  features: [
    "Atendimento profissional",
    "Confirmação automática",
    "Agendamento 100% online",
    "Resposta rápida no WhatsApp",
  ],

  /* ---- Links / redes (icon define o ícone e a cor) ---- */
  links: [
    { icon: "whatsapp",  label: "WhatsApp",     sub: "Fale agora · resposta rápida", url: "https://wa.me/5511999999999", wide: true },
    { icon: "instagram", label: "Instagram",    sub: "@navalhadeouro",               url: "https://instagram.com" },
    { icon: "facebook",  label: "Facebook",     sub: "/navalhadeouro",                url: "https://facebook.com" },
    { icon: "tiktok",    label: "TikTok",       sub: "@navalhadeouro",                url: "https://tiktok.com" },
    { icon: "youtube",   label: "YouTube",      sub: "Tutoriais & bastidores",        url: "https://youtube.com" },
    { icon: "site",      label: "Site oficial", sub: "navalhadeouro.com.br",          url: "#" },
    { icon: "catalog",   label: "Catálogo",     sub: "Produtos & combos",             url: "#" },
    { icon: "maps",      label: "Google Maps",  sub: "Ver no mapa",                   url: "https://maps.google.com" },
  ],

  /* ---- Serviços ---- */
  services: [
    { emoji: "✂️", name: "Corte Masculino",   price: "R$ 60",  duration: "40 min" },
    { emoji: "🪒", name: "Barba Completa",     price: "R$ 45",  duration: "30 min" },
    { emoji: "💈", name: "Corte + Barba",      price: "R$ 95",  duration: "1h 10", featured: true },
    { emoji: "🧴", name: "Sobrancelha",        price: "R$ 25",  duration: "15 min" },
    { emoji: "✨", name: "Limpeza de Pele",    price: "R$ 80",  duration: "45 min" },
    { emoji: "👑", name: "Combo Premium",      price: "R$ 140", duration: "1h 40" },
  ],

  /* ---- Galeria (use url p/ fotos reais; vazio = placeholder) ---- */
  gallery: [
    { url: "", label: "Corte degradê" },
    { url: "", label: "Barba" },
    { url: "", label: "Studio" },
    { url: "", label: "Detalhe" },
    { url: "", label: "Cliente" },
    { url: "", label: "Ambiente" },
    { url: "", label: "Produtos" },
  ],

  /* ---- Depoimentos ---- */
  reviews: [
    { name: "Rafael Mendes",  date: "há 2 dias",   stars: 5, photo: "", initials: "RM", text: "Melhor barbearia da zona oeste. Agendei pelo link da bio em 30 segundos e fui super bem atendido." },
    { name: "Lucas Andrade",  date: "há 1 semana", stars: 5, photo: "", initials: "LA", text: "Ambiente impecável e profissionais que entendem do assunto. O combo premium vale cada centavo." },
    { name: "Bruno Carvalho", date: "há 2 semanas", stars: 5, photo: "", initials: "BC", text: "Confirmação automática no WhatsApp, sem furo de horário. Virei cliente fixo." },
    { name: "Diego Souza",    date: "há 3 semanas", stars: 5, photo: "", initials: "DS", text: "Barba desenhada perfeita. Recomendo demais, atendimento nota 10." },
  ],

  /* ---- Localização ---- */
  location: {
    name: "Rua Aspicuelta, 542 — Loja 3",
    area: "Vila Madalena, São Paulo · SP",
    mapsUrl: "https://maps.google.com/?q=Rua+Aspicuelta+542+Sao+Paulo",
  },

  /* ---- Horários (closed: true = fechado) ---- */
  // dayIndex: 0=Dom ... 6=Sáb
  hours: [
    { day: "Segunda",  open: "09:00", close: "20:00" },
    { day: "Terça",    open: "09:00", close: "20:00" },
    { day: "Quarta",   open: "09:00", close: "20:00" },
    { day: "Quinta",   open: "09:00", close: "21:00" },
    { day: "Sexta",    open: "09:00", close: "21:00" },
    { day: "Sábado",   open: "08:00", close: "18:00" },
    { day: "Domingo",  closed: true },
  ],
};

/* ============================================================
   Biblioteca de ícones (SVG inline)
   ============================================================ */
const ICONS = {
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M8 15h.01M12 15h.01M16 15h.01"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M6 16V9a4 4 0 0 1 4-4h4"/><path d="m14 9 4-4-4-4"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.5 7 .8-5.2 4.7L18 21l-6-3.4L6 21l1.2-7L2 9.3l7-.8L12 2z"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2Zm5.6 14.2c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.8-4.5-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.5.3.1.2.1.7-.1 1.2Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V7c0-1 .3-1.5 1.6-1.5H17V2.2C16.5 2.1 15.5 2 14.4 2 11.8 2 10 3.6 10 6.5V9H7v3.5h3V22h4v-9.5h2.8l.5-3.5H14Z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2 1.6 3.6 3.8 3.9v3c-1.4 0-2.7-.4-3.8-1.1v6.4c0 3.2-2.6 5.8-5.8 5.8S4.4 18.4 4.4 15.2c0-3 2.3-5.4 5.2-5.7v3.1a2.7 2.7 0 1 0 2.7 2.7V3H16Z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12s0-3.3-.4-4.8a2.5 2.5 0 0 0-1.8-1.8C18.3 5 12 5 12 5s-6.3 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.7 2 12 2 12s0 3.3.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.7 19 12 19 12 19s6.3 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8C22 15.3 22 12 22 12Zm-12 3V9l5 3-5 3Z"/></svg>',
  site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
  catalog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 4h11a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4Z"/><path d="M17 6h3v12a2 2 0 0 1-2 2M8 8h5M8 12h5"/></svg>',
  maps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6l5-2Z"/><path d="M9 4v14M15 6v14"/></svg>',
};

/* ============================================================
   Helpers
   ============================================================ */
const $ = (s, ctx = document) => ctx.querySelector(s);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const stars = (n) => Array.from({ length: 5 }, (_, i) => `<span style="opacity:${i < n ? 1 : 0.25}">${ICONS.star}</span>`).join("");

/* ============================================================
   Apply theme + accent
   ============================================================ */
function applyTheme() {
  document.documentElement.dataset.theme = CONFIG.theme;
  const [a1, a2] = CONFIG.accent;
  document.documentElement.style.setProperty("--accent-1", a1);
  document.documentElement.style.setProperty("--accent-2", a2);
}

/* ============================================================
   Render: Profile
   ============================================================ */
function renderProfile() {
  const p = CONFIG.profile;
  const avatarInner = p.photo
    ? `<div class="avatar" style="background-image:url('${p.photo}')"></div>`
    : `<div class="avatar">${p.initials}</div>`;
  const verified = p.verified
    ? `<span class="verified" title="Perfil verificado">${ICONS.check}</span>` : "";

  const status = computeStatus();
  const statusPill = status.open
    ? `<span class="meta-pill open"><span class="ico">${ICONS.clock}</span> Aberto agora · até ${status.close}</span>`
    : `<span class="meta-pill closed"><span class="ico">${ICONS.clock}</span> Fechado · ${status.next}</span>`;

  $("#profile").innerHTML = `
    <span class="brand-row"><span class="dot"></span> Disponível para agendamento</span>
    <div class="avatar-wrap">
      <div class="avatar-ring"></div>
      ${avatarInner}
      ${verified}
    </div>
    <h1>${p.name}</h1>
    <div class="role">${p.role}</div>
    <p class="desc">${p.description}</p>
    <div class="meta-row">
      <span class="meta-pill">${ICONS.pin} ${p.city}</span>
      ${statusPill}
    </div>
    <div class="stats">
      <div class="stat"><div class="num"><span class="star">${ICONS.star}</span> ${p.rating}</div><div class="lbl">${p.reviewsCount} avaliações</div></div>
      <div class="stat"><div class="num" data-count="${p.clients}">${p.clients}</div><div class="lbl">Clientes</div></div>
      <div class="stat"><div class="num">${p.years} anos</div><div class="lbl">de história</div></div>
    </div>
  `;
}

/* ============================================================
   Render: Primary CTA + fixed CTA
   ============================================================ */
function renderCTA() {
  const a = $("#ctaPrimary");
  a.href = CONFIG.bookingUrl;
  a.innerHTML = `
    <span class="ico-cal">${ICONS.calendar}</span>
    <span class="label">AGENDAR AGORA<small>Escolha serviço, dia e horário</small></span>
    <span class="arrow">${ICONS.arrow}</span>
  `;

  $("#ctaFixed").innerHTML = `<a href="${CONFIG.bookingUrl}">${ICONS.calendar} AGENDAR AGORA</a>`;
}

/* ============================================================
   Render: Features
   ============================================================ */
function renderFeatures() {
  $("#features").innerHTML = CONFIG.features.map(f => `
    <div class="feature"><span class="chk">${ICONS.check}</span><span>${f}</span></div>
  `).join("");
}

/* ============================================================
   Render: Links
   ============================================================ */
function renderLinks() {
  $("#links").innerHTML = CONFIG.links.map(l => `
    <a class="link-btn${l.wide ? " wide" : ""}" href="${l.url}" target="_blank" rel="noopener">
      <span class="ic ${l.icon}">${ICONS[l.icon] || ""}</span>
      <span class="txt"><b>${l.label}</b><small>${l.sub || ""}</small></span>
      <span class="chev">${ICONS.chevron}</span>
    </a>
  `).join("");

  // pointer glow
  $("#links").querySelectorAll(".link-btn").forEach(btn => {
    btn.addEventListener("pointermove", e => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty("--mx", `${e.clientX - r.left}px`);
      btn.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
}

/* ============================================================
   Render: Services
   ============================================================ */
function renderServices() {
  $("#services").innerHTML = CONFIG.services.map((s, i) => {
    const url = CONFIG.passServiceParam
      ? `${CONFIG.bookingUrl}?servico=${encodeURIComponent(s.name)}`
      : CONFIG.bookingUrl;
    return `
    <a class="service glass" href="${url}" style="${s.featured ? "border-color:var(--border-strong)" : ""}">
      <span class="s-thumb">${s.emoji || "✂️"}</span>
      <span class="s-info">
        <h3>${s.name}</h3>
        <span class="s-meta">
          <span class="price">${s.price}</span>
          <span class="dur">${ICONS.clock} ${s.duration}</span>
        </span>
      </span>
      <span class="s-book">Agendar</span>
    </a>`;
  }).join("");
}

/* ============================================================
   Render: Gallery
   ============================================================ */
function renderGallery() {
  $("#gallery").innerHTML = CONFIG.gallery.map((g, i) => {
    const inner = g.url
      ? `<img src="${g.url}" alt="${g.label || ""}" loading="lazy" />`
      : `<div class="gal-ph">${g.label || "Foto"}</div>`;
    return `<div class="gal-item" data-idx="${i}">${inner}<span class="zoom">${ICONS.zoom}</span></div>`;
  }).join("");

  $("#gallery").querySelectorAll(".gal-item").forEach(item => {
    item.addEventListener("click", () => openLightbox(+item.dataset.idx));
  });
}

/* ============================================================
   Render: Reviews
   ============================================================ */
function renderReviews() {
  $("#reviewsSub").textContent = `${CONFIG.profile.rating} ★ · ${CONFIG.profile.reviewsCount} avaliações`;
  $("#reviews").innerHTML = CONFIG.reviews.map(r => {
    const av = r.photo
      ? `<span class="r-av" style="background-image:url('${r.photo}')"></span>`
      : `<span class="r-av">${r.initials}</span>`;
    return `
    <article class="review glass">
      <div class="r-stars">${stars(r.stars)}</div>
      <p class="r-text">“${r.text}”</p>
      <div class="r-author">${av}<span><b>${r.name}</b><small>${r.date}</small></span></div>
    </article>`;
  }).join("");
}

/* ============================================================
   Render: Location
   ============================================================ */
function renderLocation() {
  const l = CONFIG.location;
  $("#location").innerHTML = `
    <a class="map" href="${l.mapsUrl}" target="_blank" rel="noopener" aria-label="Abrir no mapa">
      <div class="grid"></div>
      <div class="road r1"></div>
      <div class="road r2"></div>
      <div class="pin"><span class="ripple"></span><span class="dot2"></span></div>
    </a>
    <div class="loc-body">
      <span class="addr"><b>${l.name}</b><span>${l.area}</span></span>
      <a class="loc-route" href="${l.mapsUrl}" target="_blank" rel="noopener">${ICONS.route} Rota</a>
    </div>
  `;
}

/* ============================================================
   Render: Hours + status
   ============================================================ */
function dayMap() {
  // JS getDay: 0=Dom..6=Sáb → mapeia para a ordem do CONFIG.hours (Seg..Dom)
  const order = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const jsToName = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return { todayName: jsToName[new Date().getDay()], order };
}

function computeStatus() {
  const { todayName } = dayMap();
  const today = CONFIG.hours.find(h => h.day === todayName);
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  if (today && !today.closed) {
    const o = toMin(today.open), c = toMin(today.close);
    if (mins >= o && mins < c) return { open: true, close: today.close };
    if (mins < o) return { open: false, next: `abre às ${today.open}` };
  }
  // próximo dia aberto
  const idx = CONFIG.hours.findIndex(h => h.day === todayName);
  for (let i = 1; i <= 7; i++) {
    const nx = CONFIG.hours[(idx + i) % 7];
    if (nx && !nx.closed) return { open: false, next: `abre ${nx.day.toLowerCase()} às ${nx.open}` };
  }
  return { open: false, next: "consulte os horários" };
}

function renderHours() {
  const { todayName } = dayMap();
  $("#hours").innerHTML = CONFIG.hours.map(h => {
    const isToday = h.day === todayName;
    const time = h.closed
      ? `<span class="time closed">Fechado</span>`
      : `<span class="time">${h.open} – ${h.close}</span>`;
    const badge = isToday ? `<span class="badge">Hoje</span>` : "";
    return `<div class="hour-row${isToday ? " today" : ""}"><span class="day">${h.day} ${badge}</span>${time}</div>`;
  }).join("");

  const st = computeStatus();
  const sub = $("#hoursStatus");
  sub.textContent = st.open ? `Aberto · até ${st.close}` : `Fechado · ${st.next}`;
  sub.style.color = st.open ? "#2ee6a6" : "var(--text-faint)";
}

/* ============================================================
   Lightbox
   ============================================================ */
let lbIdx = 0;
function lbContent(i) {
  const g = CONFIG.gallery[i];
  return g.url ? `<img src="${g.url}" alt="${g.label || ""}" />` : `<div class="gal-ph">${g.label || "Foto"}</div>`;
}
function openLightbox(i) {
  lbIdx = i;
  $("#lbStage").innerHTML = lbContent(i);
  $("#lightbox").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeLightbox() {
  $("#lightbox").classList.remove("open");
  document.body.style.overflow = "";
}
function navLightbox(d) {
  lbIdx = (lbIdx + d + CONFIG.gallery.length) % CONFIG.gallery.length;
  $("#lbStage").innerHTML = lbContent(lbIdx);
}
function wireLightbox() {
  $(".lb-close").addEventListener("click", closeLightbox);
  $(".lb-nav.prev").addEventListener("click", () => navLightbox(-1));
  $(".lb-nav.next").addEventListener("click", () => navLightbox(1));
  $("#lightbox").addEventListener("click", e => { if (e.target.id === "lightbox") closeLightbox(); });
  document.addEventListener("keydown", e => {
    if (!$("#lightbox").classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") navLightbox(-1);
    if (e.key === "ArrowRight") navLightbox(1);
  });
}

/* ============================================================
   Scroll reveal (staggered)
   ============================================================ */
function wireReveal() {
  const els = [...document.querySelectorAll(".reveal")];
  const show = (target) => {
    if (target.classList.contains("in")) return;
    const idx = els.indexOf(target);
    target.style.transitionDelay = `${Math.min(idx, 6) * 55}ms`;
    target.classList.add("in");
  };
  const revealInView = () => {
    const h = window.innerHeight || document.documentElement.clientHeight;
    els.forEach(t => { if (t.getBoundingClientRect().top < h - 30) show(t); });
  };

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
    els.forEach(el => io.observe(el));
  }
  // Reveal anything already in view + on scroll (fallback if IO never fires)
  revealInView();
  window.addEventListener("scroll", revealInView, { passive: true });
  requestAnimationFrame(revealInView);
  setTimeout(() => els.forEach(show), 900); // safety net
}

/* ============================================================
   Fixed mobile CTA reveal on scroll
   ============================================================ */
function wireFixedCTA() {
  const fixed = $("#ctaFixed");
  const primary = $("#ctaPrimary");
  const io = new IntersectionObserver(([e]) => {
    fixed.classList.toggle("show", !e.isIntersecting && window.innerWidth < 720);
  }, { threshold: 0 });
  io.observe(primary);
}

/* ============================================================
   Init
   ============================================================ */
function init() {
  applyTheme();
  renderProfile();
  renderCTA();
  renderFeatures();
  renderLinks();
  renderServices();
  renderGallery();
  renderReviews();
  renderLocation();
  renderHours();
  wireLightbox();
  wireReveal();
  wireFixedCTA();
}

document.addEventListener("DOMContentLoaded", init);
