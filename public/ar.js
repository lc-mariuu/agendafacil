(function (root) {
  'use strict';

  // ─── API client ────────────────────────────────────────
  // Em produção usa /api (mesmo domínio). Em preview pode-se sobrescrever
  // setando window.AR_API_URL antes deste script, ou sessionStorage.ar_api_url.
  const API = root.AR_API_URL || sessionStorage.getItem('ar_api_url') || '/api';

  function authToken() {
    return localStorage.getItem('token') || '';
  }

  async function apiCall(path, options = {}) {
    const opts = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.auth !== false && authToken() ? { Authorization: 'Bearer ' + authToken() } : {}),
        ...options.headers,
      },
    };
    if (options.body) opts.body = JSON.stringify(options.body);
    if (options.signal) opts.signal = options.signal;

    let res;
    try {
      res = await fetch(API + path, opts);
    } catch (err) {
      throw new Error('Sem conexão. Verifique sua internet.');
    }
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { data = await res.json(); } catch {}
    }
    if (!res.ok) {
      const msg = data?.erro || data?.message || `Erro ${res.status}`;
      const e = new Error(msg);
      e.status = res.status;
      e.body = data;
      throw e;
    }
    return data;
  }

  // Conveniência
  const ar = {
    get: (path, opts) => apiCall(path, { ...opts, method: 'GET' }),
    post: (path, body, opts) => apiCall(path, { ...opts, method: 'POST', body }),
    patch: (path, body, opts) => apiCall(path, { ...opts, method: 'PATCH', body }),
    delete: (path, opts) => apiCall(path, { ...opts, method: 'DELETE' }),
    api: API,
    token: authToken,
  };

  // ─── Formatação ────────────────────────────────────
  const fmt = {
    brl: (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    brlShort: (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
    num: (v) => Number(v || 0).toLocaleString('pt-BR'),
    date: (iso) => {
      if (!iso) return '—';
      const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
      return d.toLocaleDateString('pt-BR');
    },
    dateLong: (iso) => {
      if (!iso) return '—';
      const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    },
    weekday: (iso) => {
      if (!iso) return '';
      const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
      return d.toLocaleDateString('pt-BR', { weekday: 'short' });
    },
    weekdayLong: (iso) => {
      const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
      return d.toLocaleDateString('pt-BR', { weekday: 'long' });
    },
    phone: (raw) => {
      const v = String(raw || '').replace(/\D/g, '').slice(0, 11);
      if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3').replace(/-$/, '');
      return v.replace(/(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3').replace(/-$/, '');
    },
    todayIso: () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    isoFromDate: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  };

  // ─── DOM helpers ────────────────────────────────────
  function el(tag, props = {}, ...children) {
    const node = typeof tag === 'string' ? document.createElement(tag) : tag;
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k in node) node[k] = v;
        else node.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

  // ─── Toast ────────────────────────────────────
  function toast(msg, type = 'info', ms = 2800) {
    let wrap = $('.toast-wrap');
    if (!wrap) {
      wrap = el('div', { class: 'toast-wrap' });
      document.body.appendChild(wrap);
    }
    const t = el('div', { class: 'toast' }, msg);
    if (type === 'error') t.style.background = 'var(--red)';
    if (type === 'success') t.style.background = 'var(--green)';
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 0.2s, transform 0.2s';
      t.style.opacity = '0';
      t.style.transform = 'translateX(20px)';
      setTimeout(() => t.remove(), 220);
    }, ms);
  }

  // ─── Tema ────────────────────────────────────
  function getTheme() {
    return localStorage.getItem('ar_theme') || 'light';
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('ar_theme', t);
  }
  function toggleTheme() {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }
  // Auto-aplica no load
  setTheme(getTheme());

  // ─── Ícones SVG (subset) ────────────────────
  const ICONS = {
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M14.5 19c.2-2 1.5-3.5 3.5-3.5s3 1 3.5 3"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/></svg>',
    service: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-10 10H4v-6L14 4zM12 6l6 6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    block: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    arrow_right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
    arrow_left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 19l-7-7 7-7"/></svg>',
    chevron_left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    chevron_right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    chevron_down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.5a8.4 8.4 0 0 1-12.5 7.3L3 21l2.3-6.5A8.4 8.4 0 1 1 22 11.5z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9.5 17 15 18.5 22 12 18.5 5.5 22 7 15 2 9.5 9 9"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16M8 16V11M12 16V8M16 16v-4M20 16V6"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.5L19 10l-5.1 1.5L12 17l-1.9-5.5L5 10l5.1-1.5z"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    arrow_up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    arrow_down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eye_off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>',
  };

  function icon(name, attrs = {}) {
    const svg = ICONS[name];
    if (!svg) return '';
    let html = svg;
    if (attrs.size) html = html.replace(/<svg /, `<svg width="${attrs.size}" height="${attrs.size}" `);
    if (attrs.class) html = html.replace(/<svg /, `<svg class="${attrs.class}" `);
    return html;
  }

  // Helper para criar elemento com ícone
  function iconEl(name, size = 16) {
    const span = document.createElement('span');
    span.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;flex-shrink:0;`;
    span.innerHTML = icon(name);
    const svg = span.querySelector('svg');
    if (svg) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
    return span;
  }

  // ─── Avatar ────────────────────────────────────
  function avatar(name, opts = {}) {
    const initials = (name || '?').split(' ').filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase();
    const size = opts.size || 32;
    const colors = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#db2777'];
    const idx = (name || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) % colors.length;
    const color = opts.color || colors[idx];
    return el('div', {
      style: {
        width: size + 'px',
        height: size + 'px',
        borderRadius: '50%',
        background: color,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: (size * 0.4) + 'px',
        flexShrink: 0,
      },
    }, initials);
  }

  // ─── Sparkline SVG ───────────────────────────────
  function sparkline(data, opts = {}) {
    if (!data || !data.length) return '';
    const w = opts.width || 120;
    const h = opts.height || 32;
    const color = opts.color || 'var(--accent)';
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const path = 'M' + pts.join(' L');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${path}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
  }

  // ─── Modal ───────────────────────────────────
  function openModal({ title, body, footer, width = 480, onClose }) {
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } });
    const modal = el('div', { class: 'modal', style: { maxWidth: width + 'px' } });
    const head = el('div', { class: 'modal-head' });
    head.appendChild(el('div', { class: 'modal-title' }, title));
    const closeBtn = el('button', { class: 'icon-btn', onclick: () => close() });
    closeBtn.innerHTML = icon('x');
    head.appendChild(closeBtn);
    modal.appendChild(head);
    const bodyEl = el('div', { class: 'modal-body' });
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else bodyEl.appendChild(body);
    modal.appendChild(bodyEl);
    if (footer) {
      const footEl = el('div', { class: 'modal-foot' });
      if (typeof footer === 'string') footEl.innerHTML = footer;
      else if (Array.isArray(footer)) footer.forEach(f => footEl.appendChild(f));
      else footEl.appendChild(footer);
      modal.appendChild(footEl);
    }
    back.appendChild(modal);
    document.body.appendChild(back);
    function close() {
      back.style.opacity = '0';
      setTimeout(() => { back.remove(); onClose && onClose(); }, 150);
    }
    function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);
    return { close, modal, body: bodyEl };
  }

  // ─── Confirmação ────────────────────────────────
  function confirmDialog(message, opts = {}) {
    return new Promise(resolve => {
      const m = openModal({
        title: opts.title || 'Confirmar',
        body: el('div', { class: 'f-13' }, message),
        footer: (() => {
          const f = document.createDocumentFragment();
          const btnNo = el('button', { class: 'btn', onclick: () => { m.close(); resolve(false); } }, opts.cancelText || 'Cancelar');
          const btnYes = el('button', { class: 'btn ' + (opts.danger ? 'danger' : 'primary'), onclick: () => { m.close(); resolve(true); } }, opts.confirmText || 'Confirmar');
          f.appendChild(btnNo); f.appendChild(btnYes);
          return f;
        })(),
      });
    });
  }

  // ─── Estados de auth ────────────────────────────
  function isLoggedIn() {
    return !!authToken();
  }

  function requireAuth(redirectTo = '/auth.html') {
    if (!isLoggedIn()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('negocioId');
    localStorage.removeItem('negocioNome');
    window.location.href = '/auth.html';
  }

  // ─── Copy to clipboard ─────────────────────────
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copiado!');
      return true;
    } catch {
      toast('Não foi possível copiar', 'error');
      return false;
    }
  }

  // ─── Debounce ───────────────────────────────
  function debounce(fn, wait = 200) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // ─── Export ────────────────────────────────────
  root.AR = {
    api: ar,
    fmt,
    el,
    $,
    $$,
    toast,
    icon,
    iconEl,
    avatar,
    sparkline,
    openModal,
    confirmDialog,
    isLoggedIn,
    requireAuth,
    logout,
    copyToClipboard,
    debounce,
    getTheme,
    setTheme,
    toggleTheme,
    ICONS,
  };
})(window);
