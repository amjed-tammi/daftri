'use strict';
/* ============ أدوات عامة ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const raf = () => new Promise(r => requestAnimationFrame(() => r()));

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function debounce(fn, ms) {
  let t = null, args = null;
  const d = (...a) => { args = a; clearTimeout(t); t = setTimeout(run, ms); };
  const run = () => { t = null; const a = args; args = null; fn(...(a || [])); };
  d.flush = () => { if (t) { clearTimeout(t); run(); } };
  d.cancel = () => { clearTimeout(t); t = null; };
  return d;
}

// توحيد اسم الكتاب للمقارنة (بدون تشكيل/تطويل، والهمزات موحدة)
function normTitle(s) {
  return String(s || '').normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .trim().replace(/\s+/g, ' ').toLowerCase();
}

function pickFile(accept, multiple = false) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.multiple = multiple;
    i.onchange = () => res(multiple ? Array.from(i.files) : i.files[0] || null);
    i.oncancel = () => res(multiple ? [] : null);
    i.click();
  });
}

function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

/* ============ الأيقونات ============ */
const ICONS = {
  books: '<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="m15.5 5.2 3.8-1 3.2 14.6-3.8 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  pdf: '<path d="M12 3v12m0 0-4-4m4 4 4-4M5 20h14"/>',
  full: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  alr: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  alc: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  all: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  pin: '<path d="M9 3h6l-1 6 3.5 3.5h-11L10 9zM12 12.5V21"/>',
  web: '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/><path d="M12 7.5l3.2 1.3 1.3 3.2-1.3 3.2-3.2 1.3-3.2-1.3L7.5 12l1.3-3.2z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.8M12 17.2v.1"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  page: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/>',
  note: '<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  play: '<path d="M7 4.5v15l13-7.5z"/>',
  pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M5 20h14"/>',
  upload: '<path d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  cut: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16 19 4M16 16 5 4"/>',
  paste: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  olist: '<path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 15.5a1.5 1.5 0 0 1 3 .5L4 19h3"/>',
  quote: '<path d="M6 17c-1.5 0-3-1.2-3-3.5C3 9 6 6.5 9 6M15 17c-1.5 0-3-1.2-3-3.5C12 9 15 6.5 18 6"/>',
  eraser: '<path d="m16 4 5 5-10 10H6l-3-3z"/><path d="M11 9l5 5M9 19h12"/>',
  ink: '<path d="M5 20h14"/><path d="m8 16 4-11 4 11M9.5 12h5"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  water: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v3M7 12l3-5 4 2 3 3M10 7l1 6"/>',
  star: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"/>',
  addpage: '<path d="M6 3h8l4 4v14H6z"/><path d="M12 10v7M8.5 13.5h7"/>',
  series: '<path d="M4 6h7v13H4zM13 6h7v13h-7z"/><path d="M11 12h2"/>',
  bookmark: '<path d="M7 3h10v18l-5-4-5 4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 6V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>',
  tape: '<path d="M4 9.5 15.5 4l4.5 9.5L8.5 19z"/><path d="M8 8l2 4.5M12 6l2 4.5"/>',
  focus: '<circle cx="12" cy="12" r="3"/><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>',
  journal: '<path d="M5 4a1 1 0 0 1 1-1h13v16H6a1 1 0 0 0-1 1z"/><path d="M5 20a1 1 0 0 0 1 1h13M9 8h6M9 12h4"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  font: '<path d="M4 20 9.5 5h1L16 20M6.2 14.5h7.6M17 20l2.5-7 2.5 7M18 18h3"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ============ قاعدة البيانات (IndexedDB) ============ */
const DB = {
  _p: null,
  open() {
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      const r = indexedDB.open('daftari', 3);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const s of ['books', 'pages', 'blobs', 'trash', 'cards', 'journal', 'links']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this._p;
  },
  async run(store, mode, fn) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      const r = fn(s);
      if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  },
  get(st, id) { return this.run(st, 'readonly', s => s.get(id)); },
  all(st) { return this.run(st, 'readonly', s => s.getAll()); },
  put(st, v) { return this.run(st, 'readwrite', s => s.put(v)); },
  del(st, id) { return this.run(st, 'readwrite', s => s.delete(id)); },
  async getMany(st, ids) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction(st, 'readonly'); const s = t.objectStore(st);
      const out = new Array(ids.length);
      ids.forEach((id, i) => { const r = s.get(id); r.onsuccess = () => { out[i] = r.result; }; });
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
    });
  },
  async putMany(st, arr) { return this.run(st, 'readwrite', s => { arr.forEach(v => s.put(v)); }); },
  async delMany(st, ids) { return this.run(st, 'readwrite', s => { ids.forEach(id => s.delete(id)); }); },
};

/* ============ الوسائط (صور/صوت/فيديو) ============ */
const Media = {
  urls: new Map(),
  async save(blob) {
    const id = 'm' + uid();
    await DB.put('blobs', { id, blob, type: blob.type, size: blob.size });
    return id;
  },
  async url(id) {
    if (!id) return '';
    if (this.urls.has(id)) return this.urls.get(id);
    const r = await DB.get('blobs', id);
    if (!r) return '';
    const u = URL.createObjectURL(r.blob);
    this.urls.set(id, u);
    return u;
  },
  async del(ids) {
    ids = [].concat(ids).filter(Boolean);
    ids.forEach(id => { const u = this.urls.get(id); if (u) { URL.revokeObjectURL(u); this.urls.delete(id); } });
    if (ids.length) await DB.delMany('blobs', ids);
  },
  // تصغير الصورة لتوفير الذاكرة والمساحة
  async downscale(file, max = 1100) {
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close && bmp.close();
      const b = await new Promise(r => c.toBlob(r, 'image/webp', 0.86));
      return b || file;
    } catch { return file; }
  },
  // ربط عناصر الوسائط بعناوينها
  hydrate(root) {
    const jobs = $$('img[data-blob], video[data-blob]', root).map(async m => {
      const u = await this.url(m.dataset.blob);
      if (u && m.getAttribute('src') !== u) m.src = u;
      if (m.tagName === 'IMG' && m.decode) await m.decode().catch(() => {});
    });
    return Promise.all(jobs);
  },
};

/* ============ السماء الليلية ============ */
const Sky = {
  init() {
    this.c = $('#sky');
    this.draw();
    addEventListener('resize', debounce(() => this.draw(), 250));
    const box = $('#twinkles');
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('i');
      s.className = 'tw';
      s.style.cssText = `left:${(rnd() * 100).toFixed(2)}%;top:${(rnd() * 100).toFixed(2)}%;animation-delay:${(rnd() * 6).toFixed(2)}s;animation-duration:${(3 + rnd() * 5).toFixed(2)}s;--sz:${(1.5 + rnd() * 2).toFixed(1)}px`;
      box.append(s);
    }
  },
  draw() {
    const c = this.c, dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grd = g.createLinearGradient(0, 0, w * .3, h);
    grd.addColorStop(0, '#040a1c'); grd.addColorStop(.5, '#0a1836'); grd.addColorStop(1, '#122650');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // ضباب درب التبانة
    const neb = (x, y, r, col) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); };
    neb(w * .25, h * .3, Math.max(w, h) * .45, 'rgba(70,90,170,.16)');
    neb(w * .8, h * .75, Math.max(w, h) * .4, 'rgba(110,70,160,.10)');
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = Math.round(w * h / 1500);
    const cols = ['255,255,255', '205,222,255', '255,236,200', '220,210,255'];
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h, big = rnd() > .94;
      const r = big ? .9 + rnd() * 1.1 : .25 + rnd() * .75;
      g.fillStyle = `rgba(${cols[(rnd() * cols.length) | 0]},${(.35 + rnd() * .65).toFixed(2)})`;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      if (big && rnd() > .5) {
        g.strokeStyle = 'rgba(220,230,255,.25)'; g.lineWidth = .6;
        g.beginPath(); g.moveTo(x - r * 4, y); g.lineTo(x + r * 4, y); g.moveTo(x, y - r * 4); g.lineTo(x, y + r * 4); g.stroke();
      }
    }
    if (this.extra) this.extra(g, w, h); // نجوم أيام الدراسة
  },
};

/* ============ الأصوات (بدون ملفات) ============ */
const Sound = {
  ctx: null,
  ac() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
  chime(soft = false) {
    try {
      const c = this.ac(), t = c.currentTime;
      const notes = soft ? [[660, 0], [880, .16]] : [[880, 0], [1318.5, .18], [1760, .36]];
      notes.forEach(([f, d]) => {
        const o = c.createOscillator(), gn = c.createGain();
        o.type = 'sine'; o.frequency.value = f;
        gn.gain.setValueAtTime(0, t + d);
        gn.gain.linearRampToValueAtTime(soft ? .08 : .16, t + d + .02);
        gn.gain.exponentialRampToValueAtTime(.0001, t + d + 1.6);
        o.connect(gn).connect(c.destination); o.start(t + d); o.stop(t + d + 1.7);
      });
    } catch { }
  },
  flip() {
    if (localStorage.getItem('flipSound') === '0') return;
    try {
      const c = this.ac(), t = c.currentTime, len = .32;
      const buf = c.createBuffer(1, Math.round(c.sampleRate * len), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) { const k = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * k), 1.6) * (0.6 + 0.4 * Math.sin(k * 40)); }
      const src = c.createBufferSource(); src.buffer = buf;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = .7;
      const gn = c.createGain(); gn.gain.value = .07;
      src.connect(bp).connect(gn).connect(c.destination); src.start(t);
    } catch { }
  },
};

/* ============ الإشعارات الصغيرة ============ */
const Toast = {
  show({ icon = 'star', title = '', text = '', actions = [], timeout = 4500, cls = '' } = {}) {
    const t = el(`<div class="toast ${cls}" role="status">
      <div class="t-ic">${ic(icon)}</div>
      <div class="t-body">${title ? `<b>${esc(title)}</b>` : ''}${text ? `<span>${esc(text)}</span>` : ''}</div>
      <div class="t-acts"></div></div>`);
    const close = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); clearTimeout(tm); };
    actions.forEach(a => {
      const b = el(`<button class="btn ${a.primary ? 'primary' : 'ghost'} sm">${esc(a.label)}</button>`);
      b.onclick = () => { close(); a.act && a.act(); };
      $('.t-acts', t).append(b);
    });
    if (!actions.length) t.onclick = close;
    $('#toasts').append(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
    const tm = timeout ? setTimeout(() => { close(); }, timeout) : 0;
    return close;
  },
};

/* ============ النوافذ المنبثقة ============ */
const Pop = {
  cur: null, onclose: null,
  open(anchor, content, { cls = '', place = 'below', gap = 8 } = {}) {
    this.close();
    const p = el(`<div class="pop ${cls}"></div>`);
    p.append(content);
    document.body.append(p);
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0, height: 0 };
    const pw = p.offsetWidth, ph = p.offsetHeight;
    let x = r.left + r.width / 2 - pw / 2;
    let y = place === 'above' ? r.top - ph - gap : r.bottom + gap;
    if (place === 'point') { x = r.left; y = r.top; }
    if (y + ph > innerHeight - 8) y = Math.max(8, (place === 'point' ? r.top - ph : r.top - ph - gap));
    if (y < 8) y = Math.min(innerHeight - ph - 8, r.bottom + gap);
    x = clamp(x, 8, innerWidth - pw - 8);
    p.style.left = x + 'px'; p.style.top = y + 'px';
    this.cur = p;
    this._out = e => { if (this.cur && !this.cur.contains(e.target)) this.close(); };
    this._key = e => { if (e.key === 'Escape') this.close(); };
    setTimeout(() => { document.addEventListener('pointerdown', this._out, true); document.addEventListener('keydown', this._key); }, 0);
    requestAnimationFrame(() => p.classList.add('in'));
    return p;
  },
  close() {
    if (!this.cur) return;
    const p = this.cur; this.cur = null;
    p.remove();
    document.removeEventListener('pointerdown', this._out, true);
    document.removeEventListener('keydown', this._key);
    const f = this.onclose; this.onclose = null; f && f();
  },
};

/* قائمة خيارات (للكليك يمين وغيرها) */
const Menu = {
  open(anchor, items, opts = {}) {
    const m = el('<div class="menu"></div>');
    items.forEach(it => {
      if (it === '-') { m.append(el('<div class="m-sep"></div>')); return; }
      if (it.head) { m.append(el(`<div class="m-head">${esc(it.head)}</div>`)); return; }
      const b = el(`<button class="m-item ${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}>${ic(it.icon || 'star')}<span>${esc(it.label)}</span>${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</button>`);
      b.addEventListener('mousedown', e => e.preventDefault());
      b.onclick = () => { Pop.close(); it.act && it.act(); };
      m.append(b);
    });
    return Pop.open(anchor, m, { cls: 'menu-pop', ...opts });
  },
};

/* نافذة حوار */
const Modal = {
  open(node, { cls = '', onClose } = {}) {
    const back = el(`<div class="modal-back"><div class="modal ${cls}"></div></div>`);
    back.firstElementChild.append(node);
    document.body.append(back);
    requestAnimationFrame(() => back.classList.add('in'));
    const close = () => { back.classList.remove('in'); setTimeout(() => back.remove(), 220); document.removeEventListener('keydown', key); onClose && onClose(); };
    const key = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
    return { close, el: back.firstElementChild };
  },
  confirm(title, text, { ok = 'تأكيد', danger = false } = {}) {
    return new Promise(res => {
      const n = el(`<div class="confirm"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row end"><button class="btn ghost" data-a="no">إلغاء</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="ok">${esc(ok)}</button></div></div>`);
      let done = false;
      const m = Modal.open(n, { cls: 'sm', onClose: () => { if (!done) res(false); } });
      n.querySelector('[data-a=no]').onclick = () => { m.close(); };
      n.querySelector('[data-a=ok]').onclick = () => { done = true; res(true); m.close(); };
      setTimeout(() => n.querySelector('[data-a=ok]').focus(), 50);
    });
  },
};

/* حفظ/استرجاع التحديد */
const Sel = {
  save() { const s = getSelection(); return s.rangeCount ? s.getRangeAt(0).cloneRange() : null; },
  restore(r) { if (!r) return; const s = getSelection(); s.removeAllRanges(); s.addRange(r); },
};

/* مشغل صوت واحد مشترك (خفيف) */
const Player = {
  a: new Audio(), btn: null, cur: null,
  async toggle(blobId, btn) {
    if (this.cur === blobId && !this.a.paused) { this.a.pause(); return; }
    const u = await Media.url(blobId);
    if (!u) { Toast.show({ icon: 'x', text: 'التسجيل غير موجود' }); return; }
    this.stopUi();
    this.cur = blobId; this.btn = btn || null;
    this.a.src = u; this.a.play().catch(() => {});
    btn && btn.classList.add('playing');
  },
  stopUi() { if (this.btn) this.btn.classList.remove('playing'); this.btn = null; },
  init() { this.a.preload = 'none'; this.a.onpause = this.a.onended = () => this.stopUi(); },
};
