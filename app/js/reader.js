'use strict';
/* ============ القارئ: عرض الكتاب وتقليب الصفحات ============ */
const PW = 600, PH = 850; // مقاس الصفحة المنطقي (يُكبَّر/يُصغَّر حسب الشاشة)
const FONTS = [['hand', 'يدوي'], ['classic', 'كلاسيكي'], ['modern', 'حديث'], ['type', 'آلة كاتبة']];
const INKS = ['#1f2a5a', '#222222', '#5a3a1e', '#1d5a3c', '#7a1f2f', '#3b3f8f', '#f4f1e8', '#ffd479', '#8fd3ff', '#b6f0c2'];
const LINE_COLORS = [['auto', 'تلقائي'], ['#7fa6d9', 'أزرق'], ['#b8b0a0', 'رمادي'], ['#c9a27a', 'بني'], ['#8cc2a4', 'أخضر'], ['#e8a0b4', 'وردي']];

const Reader = {
  book: null, pages: [], s: -1, busy: false, scale: 1,

  async open(bookId, gotoPage = null) {
    const b = await DB.get('books', bookId);
    if (!b) return;
    if (this.book) { Editor.flushAll(); this.saveBook(); }
    b.paper = { ...PAPER_DEFAULT, ...(b.paper || {}) };
    const recs = await DB.getMany('pages', b.pageIds);
    this.book = b;
    this.pages = recs.map((p, i) => p || { id: b.pageIds[i], bookId: b.id, html: '', stickies: [], attach: [] });
    if (this.pages.length % 2) this.addPages(1, false);
    if (!this.pages.length) this.addPages(2, false);
    this.s = gotoPage != null ? Math.floor(gotoPage / 2) : (b.lastSpread != null ? b.lastSpread : -1);
    this.s = clamp(this.s, -1, this.pages.length / 2 - 1);
    $('#library').hidden = true;
    $('#reader').hidden = false;
    Editor.dockSync();
    document.title = b.title + ' — دفتري';
    this.applyPaper();
    this.layout();
    this.render();
    this.updateBars();
    Bars.flash();
    Study.onBookOpen(b);
    Tour.maybe('book'); // جولة الكتاب أول مرة
  },
  close() {
    Study.onBookClose();
    Editor.flushAll();
    this.saveBook();
    Editor.unbindAll();
    Pop.close();
    this.book = null; this.pages = [];
    $('#reader').hidden = true;
    $('#library').hidden = false;
    Editor.dockSync();
    document.title = 'دفتري';
    Library.load();
  },
  saveBook: debounce(function () { if (Reader.book) { Reader.book.updated = Date.now(); DB.put('books', Reader.book); } }, 400),
  touch() { this.saveBook(); },

  addPages(n, persist = true) {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const p = { id: 'p' + uid(), bookId: this.book.id, html: '', stickies: [], attach: [] };
      this.pages.push(p); this.book.pageIds.push(p.id); ps.push(p);
    }
    if (persist) { DB.putMany('pages', ps); this.saveBook(); this.saveBook.flush(); }
    return ps;
  },

  fwdSide() { return this.book.dir === 'rtl' ? 'left' : 'right'; },
  backSide() { return this.book.dir === 'rtl' ? 'right' : 'left'; },
  idx(s, which) {
    if (s < 0) return which === 'fwd' ? 'cover' : null;
    return which === 'back' ? 2 * s : 2 * s + 1;
  },
  sideOfIndex(i) { return i % 2 === 0 ? this.backSide() : this.fwdSide(); },
  slot(side) { return $('#bookInner .slot.' + side); },

  /* المتغيرات الخاصة بالورق */
  paperVars() {
    const p = this.book.paper;
    const lh = p.lh;
    const T = clamp(Math.round(lh * 2), 56, 96);
    const lines = Math.floor((PH - T - 40) / lh);
    const v = { '--lh': lh + 'px', '--T': T + 'px', '--CH': lines * lh + 'px', '--fs': p.fs + 'px', '--ink': p.ink };
    if (p.line && p.line !== 'auto') v['--line'] = p.line;
    v['--font-en'] = FontKit.enStack(p);
    return v;
  },
  paperClasses() {
    const p = this.book.paper;
    return `dir-${this.book.dir} tone-${p.tone} font-${p.font}${p.margin ? '' : ' nomargin'}`;
  },
  applyPaper() {
    const bk = $('#book');
    FontKit.apply(this.book.paper);
    bk.className = this.paperClasses() + (this.s < 0 ? ' closed' : '') + (Study.exam ? ' exam' : '');
    bk.removeAttribute('style');
    const v = this.paperVars();
    for (const k in v) bk.style.setProperty(k, v[k]);
    this.layout();
  },
  layout() {
    if (!this.book) return;
    // نترك مكاناً للحبل على اليسار
    // وإذا شريط التنسيق مثبّت تحت، نرفع الكتاب شوي ونصغّره حتى ما يغطيه
    const dock = document.body.classList.contains('fmt-docked') ? 62 : 0;
    const s = Math.min((innerWidth - 190) / (2 * PW + 30), (innerHeight - 24 - dock) / (PH + 16));
    this.scale = s;
    $('#book').style.top = dock ? `calc(50% - ${dock / 2}px)` : '';
    $('#book').style.transform = `translate(-50%,-50%) scale(${s})`;
  },

  /* بناء الصفحات */
  coverPage(side) {
    const pg = el(`<div class="page coverpg side-${side}">${coverHTML(this.book)}<div class="spine"></div><div class="flipzone wide"></div></div>`);
    Media.hydrate(pg);
    return pg;
  },
  pageEl(i, live, side) {
    const p = this.pages[i];
    const st = p.style || this.book.paper.style;
    const pg = el(`<div class="page side-${side} ps-${st}" data-i="${i}">
      <div class="lines"></div><div class="mline"></div>
      <div class="content" ${live ? 'contenteditable="true"' : ''} spellcheck="false"></div>
      <div class="stickies"></div><div class="attach"></div>
      <div class="pnum">${i + 1}</div><div class="gutter"></div>
      ${live ? '<div class="flipzone"></div>' : ''}</div>`);
    const c = $('.content', pg);
    c.innerHTML = p.html || '';
    if (!live) $$('video', c).forEach(v => { v.preload = 'none'; v.removeAttribute('controls'); });
    Stickies.renderAll(pg, p, live);
    Attach.render(pg, p, live);
    if (live) IdeaWeb.badge(pg, p);
    Media.hydrate(pg);
    if (live) Editor.bind(pg, p);
    return pg;
  },
  fill(side, idx, live) {
    const slot = this.slot(side);
    slot.innerHTML = '';
    slot.classList.toggle('empty', idx == null);
    if (idx == null) return;
    const pg = idx === 'cover' ? this.coverPage(side) : this.pageEl(idx, live, side);
    slot.append(pg);
    const fz = $('.flipzone', pg);
    if (fz && live) fz.addEventListener('pointerdown', e => this.startDrag(e, side));
  },
  render() {
    Editor.unbindAll();
    const fwd = this.fwdSide(), back = this.backSide();
    this.fill(fwd, this.idx(this.s, 'fwd'), true);
    this.fill(back, this.idx(this.s, 'back'), true);
    $('#book').classList.toggle('closed', this.s < 0);
    this.updateBars();
    requestAnimationFrame(() => Editor.reflowAll());
  },

  /* التقليب */
  faceEl(idx, side) {
    if (idx == null) return el('<div class="blank"></div>');
    return idx === 'cover' ? this.coverPage(side) : this.pageEl(idx, false, side);
  },
  makeLeaf(side, dir, to) {
    const from = dir > 0 ? 'fwd' : 'back', land = dir > 0 ? 'back' : 'fwd';
    const other = side === 'left' ? 'right' : 'left';
    const front = this.idx(this.s, from), back = this.idx(to, land), under = this.idx(to, from);
    this.fill(side, under, false);
    const leaf = el(`<div class="leaf on-${side}"><div class="face front"><div class="shade"></div></div><div class="face back"><div class="shade"></div></div></div>`);
    $('.front', leaf).prepend(this.faceEl(front, side));
    $('.back', leaf).prepend(this.faceEl(back, other));
    $('#bookInner').append(leaf);
    $('#book').classList.toggle('closed', to < 0);
    $('#book').classList.add('turning');
    return leaf;
  },
  setLeaf(leaf, p) {
    const sign = leaf.classList.contains('on-right') ? -1 : 1;
    leaf.style.transform = `rotateY(${(sign * 180 * p).toFixed(2)}deg)`;
    leaf.style.setProperty('--p', p.toFixed(3));
    $('#bookInner').style.setProperty('--lp', p.toFixed(3));
  },
  animate(leaf, p0, p1, ms) {
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => {
        const k = clamp((now - t0) / ms, 0, 1);
        const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        this.setLeaf(leaf, p0 + (p1 - p0) * e);
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  },
  prepTurn(to) {
    if (to < -1) return false;
    const need = 2 * to + 2 - this.pages.length;
    if (need > 0) {
      this.addPages(need + (need % 2));
      Toast.show({ icon: 'addpage', text: 'أُضيفت صفحات جديدة للكتاب', timeout: 2200 });
    }
    Editor.flushAll();
    Pop.close(); Editor.hideBars();
    return true;
  },
  async turn(dir, target = null) {
    if (this.busy || !this.book) return;
    const to = target != null ? target : this.s + dir;
    if (to === this.s || !this.prepTurn(to)) return;
    this.busy = true;
    const side = dir > 0 ? this.fwdSide() : this.backSide();
    const leaf = this.makeLeaf(side, dir, to);
    Sound.flip();
    await this.animate(leaf, 0, 1, 720);
    this.s = to;
    this.finishTurn(leaf);
  },
  finishTurn(leaf) {
    this.render();
    leaf.remove();
    $('#book').classList.remove('turning');
    this.busy = false;
    this.book.lastSpread = this.s;
    this.saveBook();
    Editor.restorePendingCaret();
  },
  startDrag(e, side) {
    if (this.busy || e.button !== 0) return;
    const dir = side === this.fwdSide() ? 1 : -1;
    const to = this.s + dir;
    if (to < -1) return;
    e.preventDefault();
    // نستمع على النافذة لأن عنصر السحب نفسه يُستبدل أثناء التقليب
    const zone = window;
    const pid = e.pointerId;
    const sx = e.clientX, t0 = performance.now();
    const r = $('#bookInner').getBoundingClientRect();
    const spine = r.left + r.width / 2, pw = r.width / 2;
    let leaf = null, p = 0, moved = false, lastX = sx, v = 0;
    const move = ev => {
      if (ev.pointerId !== pid) return;
      if (ev.buttons === 0) { up(ev, true); return; } // ضاع حدث الإفلات
      if (!moved && Math.abs(ev.clientX - sx) < 6) return;
      if (!moved) {
        moved = true;
        if (!this.prepTurn(to)) return;
        this.busy = true;
        leaf = this.makeLeaf(side, dir, to);
      }
      v = ev.clientX - lastX; lastX = ev.clientX;
      let c = side === 'right' ? (ev.clientX - spine) / pw : (spine - ev.clientX) / pw;
      c = clamp(c, -1, 1);
      p = Math.acos(c) / Math.PI;
      this.setLeaf(leaf, p);
    };
    const up = async (ev, lost = false) => {
      if (ev.pointerId !== pid) return;
      zone.removeEventListener('pointermove', move);
      zone.removeEventListener('pointerup', up);
      zone.removeEventListener('pointercancel', cancel);
      if (!moved) { if (!lost) this.turn(dir); return; }
      if (!leaf) return;
      const towards = side === 'right' ? v < -3 : v > 3;
      const quick = performance.now() - t0 < 300;
      const complete = p > .42 || (towards && p > .12) || (quick && p > .08);
      if (complete) Sound.flip();
      await this.animate(leaf, p, complete ? 1 : 0, 160 + 420 * (complete ? 1 - p : p));
      if (complete) this.s = to;
      this.finishTurn(leaf);
    };
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', up);
    const cancel = ev => up(ev, true);
    zone.addEventListener('pointercancel', cancel);
  },
  goToPage(i) {
    if (!this.book) return;
    i = clamp(i, 0, this.pages.length - 1);
    const t = Math.floor(i / 2);
    if (t === this.s) { Editor.focusPage(i); return Promise.resolve(); }
    return this.turn(t > this.s ? 1 : -1, t).then(() => Editor.focusPage(i));
  },
  // يعرض الصفحة بدون وضع المؤشر فيها
  async showPage(i) {
    if (!this.book) return;
    i = clamp(i, 0, this.pages.length - 1);
    const t = Math.floor(i / 2);
    while (this.busy) await new Promise(r => setTimeout(r, 50));
    if (t !== this.s) await this.turn(t > this.s ? 1 : -1, t);
  },
  async openLink(bookId, page) {
    if (!this.book || bookId === this.book.id) { this.goToPage(page); return; }
    const b = await DB.get('books', bookId);
    if (!b) { Toast.show({ icon: 'x', text: 'الكتاب المرتبط لم يعد موجوداً' }); return; }
    await this.open(bookId, page);
  },

  /* إدارة الصفحات */
  // الحذف ينقل الصفحة لسلة المحذوفات (تُسترجع خلال 30 يوم)
  async deletePage(i) {
    Editor.flushAll();
    const [p] = this.pages.splice(i, 1);
    this.book.pageIds.splice(i, 1);
    const item = await Trash.addPage(p, this.book, i);
    DB.del('pages', p.id);
    if (this.pages.length % 2) this.addPages(1);
    if (!this.pages.length) this.addPages(2);
    this.s = clamp(this.s, -1, this.pages.length / 2 - 1);
    this.saveBook(); this.saveBook.flush(); this.render();
    Toast.show({ icon: 'trash', text: `نُقلت الصفحة ${i + 1} لسلة المحذوفات`, timeout: 7000, actions: [{ label: 'تراجع', act: () => Trash.restore(item) }] });
  },
  insertPageAfter(i) {
    Editor.flushAll();
    const p = { id: 'p' + uid(), bookId: this.book.id, html: '', stickies: [], attach: [] };
    this.pages.splice(i + 1, 0, p);
    this.book.pageIds.splice(i + 1, 0, p.id);
    DB.put('pages', p);
    if (this.pages.length % 2) this.addPages(1);
    this.saveBook(); this.render();
    Toast.show({ icon: 'addpage', text: `أُضيفت صفحة بعد الصفحة ${i + 1}`, timeout: 2000 });
  },
  setDir(d) {
    if (this.book.dir === d) return;
    Editor.flushAll();
    this.book.dir = d; this.saveBook(); this.applyPaper(); this.render();
  },

  /* الأشرطة */
  updateBars() {
    if (!this.book) return;
    const b = this.book;
    $('#tbTitle').textContent = b.title;
    const ser = Library.seriesOf(b);
    const sb = $('#tbSeries');
    sb.innerHTML = '';
    if (ser.length > 1) {
      const k = ser.findIndex(x => x.id === b.id);
      const prev = ser[k - 1], next = ser[k + 1];
      sb.append(el(`<span class="ser-name">${ic('series')} ${esc(b.series.name)} · الجزء ${esc(b.series.part)}</span>`));
      if (prev) { const x = el(`<button class="chipbtn" title="${esc(prev.title)}">الجزء ${prev.series.part}</button>`); x.onclick = () => this.open(prev.id); sb.prepend(x); }
      if (next) { const x = el(`<button class="chipbtn" title="${esc(next.title)}">الجزء ${next.series.part}</button>`); x.onclick = () => this.open(next.id); sb.append(x); }
    } else if (b.series && b.series.name) sb.append(el(`<span class="ser-name">${ic('series')} ${esc(b.series.name)} · الجزء ${esc(b.series.part)}</span>`));
    const n = this.pages.length;
    $('#pgInfo').textContent = this.s < 0 ? `الغلاف · ${n} صفحة` : `${2 * this.s + 1}–${2 * this.s + 2} من ${n}`;
    const rg = $('#pgRange');
    rg.max = n / 2 - 1; rg.min = -1; rg.value = this.s;
    rg.style.direction = b.dir;
    // أسهم التنقل حسب اتجاه الكتاب
    $('#navPrev').innerHTML = ic(b.dir === 'rtl' ? 'right' : 'left');
    $('#navNext').innerHTML = ic(b.dir === 'rtl' ? 'left' : 'right');
    $('#navbar').classList.toggle('rtl-book', b.dir === 'rtl');
  },

  paperPanel(anchor) {
    const p = this.book.paper;
    const n = el(`<div class="panel paper-panel">
      <h4>الورق</h4>
      <div class="seg wrap" data-k="style">${PAPER_STYLES.map(([v, t]) => `<button data-v="${v}"><i class="mini ps-${v}"></i>${t}</button>`).join('')}</div>
      <div class="swatches" data-k="tone">${PAPER_TONES.map(([v, t, c]) => `<button class="sw" data-v="${v}" title="${t}" style="--c:${c}"></button>`).join('')}</div>
      <label class="rng"><span>المسافة بين السطور</span><input type="range" min="24" max="48" step="2" data-k="lh" value="${p.lh}"><b>${p.lh}</b></label>
      <div class="lbl">لون السطور</div>
      <div class="swatches" data-k="line">${LINE_COLORS.map(([c, t]) => `<button class="sw ${c === 'auto' ? 'auto' : ''}" data-v="${c}" title="${t}" style="--c:${c === 'auto' ? '#ccc' : c}"></button>`).join('')}</div>
      <label class="chk"><input type="checkbox" data-k="margin" ${p.margin ? 'checked' : ''}> <span>خط الهامش الأحمر</span></label>
      <h4>الكتابة</h4>
      <div class="seg wrap" data-k="font">${FONTS.map(([v, t]) => `<button data-v="${v}" class="f-${v}">${t} Aa</button>`).join('')}</div>
      <div class="fontrow"><span>الخط العربي</span><button class="fontpick" data-pick="ar"></button></div>
      <div class="fontlist" data-list="ar" hidden></div>
      <div class="fontrow"><span>الخط الإنجليزي</span><button class="fontpick" data-pick="en"></button></div>
      <div class="fontlist" data-list="en" hidden></div>
      <label class="rng"><span>حجم الخط</span><input type="range" min="14" max="28" step="1" data-k="fs" value="${p.fs}"><b>${p.fs}</b></label>
      <label class="rng"><span>حجم العربي مقابل الإنجليزي</span><input type="range" min="70" max="160" step="5" data-k="arScale" value="${p.arScale || 100}"><b>${p.arScale || 100}%</b></label>
      <div class="lbl">لون الحبر</div>
      <div class="swatches" data-k="ink">${INKS.map(c => `<button class="sw" data-v="${c}" style="--c:${c}"></button>`).join('')}</div>
      <h4>الكتاب</h4>
      <div class="seg" data-k="dir"><button data-v="rtl">يفتح من اليمين</button><button data-v="ltr">يفتح من اليسار</button></div>
      <label class="chk"><input type="checkbox" data-k="flipSound" ${localStorage.getItem('flipSound') === '0' ? '' : 'checked'}> <span>صوت تقليب الورق</span></label>
    </div>`);
    const sync = () => {
      $$('[data-k=style] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === p.style));
      $$('[data-k=tone] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === p.tone));
      $$('[data-k=line] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === (p.line || 'auto')));
      $$('[data-k=font] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === p.font && !p.fontCustom));
      const fa = FontKit.ar(p), fe = FontKit.en(p);
      const ba = $('[data-pick=ar]', n), be = $('[data-pick=en]', n);
      ba.textContent = FontKit.label('ar', fa) + ' · أبجد'; ba.style.fontFamily = `"${fa}"`;
      be.textContent = FontKit.label('en', fe) + ' · Abc'; be.style.fontFamily = `"${fe}"`;
      $$('[data-k=ink] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === p.ink));
      $$('[data-k=dir] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === this.book.dir));
    };
    const apply = (full) => { this.saveBook(); this.applyPaper(); if (full) { Editor.flushAll(); this.render(); } sync(); };
    n.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    n.addEventListener('click', e => {
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        const kind = pick.dataset.pick, list = $(`[data-list=${kind}]`, n);
        const open = list.hidden;
        $$('.fontlist', n).forEach(x => x.hidden = true);
        if (open) { FontKit.fillList(list, kind, kind === 'ar' ? FontKit.ar(p) : FontKit.en(p)); list.hidden = false; }
        return;
      }
      const f = e.target.closest('[data-font]');
      if (f) {
        const kind = f.closest('.fontlist').dataset.list;
        if (kind === 'ar') p.fontAr = f.dataset.font; else p.fontEn = f.dataset.font;
        p.fontCustom = true;
        $$('.fontlist', n).forEach(x => x.hidden = true);
        apply(true);
        return;
      }
      const b = e.target.closest('button[data-v]'); if (!b) return;
      const k = b.parentElement.dataset.k;
      if (k === 'dir') { this.setDir(b.dataset.v); sync(); return; }
      if (k === 'font') { p.font = b.dataset.v; delete p.fontAr; delete p.fontEn; p.fontCustom = false; p.arScale = 100; const r = $('[data-k=arScale]', n); r.value = 100; r.nextElementSibling.textContent = '100%'; apply(true); return; }
      if (k === 'style') { p.style = b.dataset.v; this.pages.forEach(pg => { if (pg.style) { pg.style = null; DB.put('pages', pg); } }); apply(true); return; }
      p[k] = b.dataset.v;
      if (k === 'tone') fixInk(p);
      apply(k === 'font');
    });
    n.addEventListener('input', e => {
      const k = e.target.dataset.k;
      if (k === 'arScale') { p.arScale = +e.target.value; e.target.nextElementSibling.textContent = p.arScale + '%'; FontKit.apply(p); this.saveBook(); return; }
      if (k === 'lh' || k === 'fs') {
        p[k] = +e.target.value;
        if (k === 'fs') p.fs = Math.min(p.fs, Math.floor(p.lh * .8));
        if (k === 'lh' && p.fs > p.lh * .8) { p.fs = Math.floor(p.lh * .8); $('[data-k=fs]', n).value = p.fs; $('[data-k=fs]', n).nextElementSibling.textContent = p.fs; }
        e.target.nextElementSibling.textContent = p[k];
        apply(false);
      }
    });
    n.addEventListener('change', e => {
      const k = e.target.dataset.k;
      if (k === 'lh' || k === 'fs' || k === 'arScale') { Editor.flushAll(); this.render(); }
      else if (k === 'margin') { p.margin = e.target.checked; apply(true); }
      else if (k === 'flipSound') localStorage.setItem('flipSound', e.target.checked ? '1' : '0');
    });
    sync();
    Pop.open(anchor, n, { cls: 'panel-pop' });
  },
};

/* ============ إظهار الأدوات عند الحاجة (Progressive disclosure) ============ */
const Bars = {
  t: null,
  init() {
    document.addEventListener('mousemove', e => {
      if ($('#reader').hidden) return;
      // فوق الكتاب نفسه ما نطلّع الأشرطة إلا عند حافة الشاشة تماماً، حتى ما تغطي أزرار الصفحة
      const overBook = !!(e.target.closest && e.target.closest('#book'));
      const top = e.clientY < 8 || (e.clientY < 70 && !overBook);
      const bot = !document.body.classList.contains('reviewing') && (e.clientY > innerHeight - 8 || (e.clientY > innerHeight - 64 && !overBook));
      if (top) this.show('#topbar');
      if (bot) this.show('#navbar');
      if (!top && !e.target.closest('#topbar')) this.hideSoon('#topbar');
      if (!bot && !e.target.closest('#navbar')) this.hideSoon('#navbar');
    }, { passive: true });
  },
  show(s) { const b = $(s); clearTimeout(b._t); b._t = null; b.classList.add('show'); },
  hideSoon(s) {
    const b = $(s);
    if (Tour.active) return; // أثناء الجولة الأشرطة بتضل ظاهرة
    if (!b.classList.contains('show') || b._t) return;
    b._t = setTimeout(() => {
      b._t = null;
      if (Pop.cur && Pop.cur._from === s) { this.hideSoon(s); return; }
      if (b.matches(':hover')) return;
      b.classList.remove('show');
    }, 1300);
  },
  flash() { this.show('#topbar'); this.show('#navbar'); setTimeout(() => { this.hideSoon('#topbar'); this.hideSoon('#navbar'); }, 1800); },
};
