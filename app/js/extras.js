'use strict';
/* ============ الروابط (فيديو/مواقع/صفحات) ============ */
const Links = {
  isVideo(u) { return /youtu\.?be|vimeo\.com|tiktok\.com|\/reel|\/watch|\.mp4(\?|$)|\.webm(\?|$)/i.test(u || ''); },
  short(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u).slice(0, 24); } },
  fix(u) { u = (u || '').trim(); if (!u) return ''; if (!/^[a-z][\w+.-]*:/i.test(u)) u = 'https://' + u; return u; },
  openUrl(u) { window.open(u, '_blank', 'noopener'); },
  async open(range, l, tab = 'url') {
    const hasText = !!(range && !range.collapsed && range.toString().trim() && l.c.contains(range.commonAncestorContainer));
    const books = (await DB.all('books')).sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    const cur = Reader.book;
    const opts = [cur, ...books.filter(b => b.id !== cur.id)].map(b => `<option value="${b.id}">${esc(b.title)}${b.series && b.series.name ? ` — ${esc(b.series.name)} ج${b.series.part}` : ''}${b.id === cur.id ? ' (هذا الكتاب)' : ''}</option>`).join('');
    const f = el(`<form class="linkform panel" autocomplete="off">
      <div class="seg tabs"><button type="button" data-t="url">${ic('video')} رابط / فيديو</button><button type="button" data-t="page">${ic('page')} صفحة أو كتاب</button></div>
      <div class="tab" data-tab="url">
        <input class="inp" name="url" dir="ltr" placeholder="https://www.youtube.com/watch?v=…">
        ${hasText ? `<p class="muted sm">سيُربط النص: «${esc(range.toString().trim().slice(0, 40))}»</p>` : '<input class="inp" name="title" placeholder="عنوان يظهر (اختياري)">'}
        <div class="row">
          <button class="btn primary" data-do="${hasText ? 'wrap' : 'chip'}">${hasText ? 'ربط بالنص' : 'إدراج في السطر'}</button>
          <button type="button" class="btn ghost" data-do="attach">${ic('bookmark')} إرفاق بالصفحة</button>
        </div>
      </div>
      <div class="tab" data-tab="page" hidden>
        <label class="fld"><span>الكتاب</span><select class="inp" name="book">${opts}</select></label>
        <label class="fld short"><span>رقم الصفحة</span><input class="inp" type="number" name="page" min="1" value="1"></label>
        <div class="row"><button class="btn primary" data-do="${hasText ? 'pwrap' : 'pchip'}">${hasText ? 'ربط النص بالصفحة' : 'إدراج رابط الصفحة'}</button></div>
      </div></form>`);
    const show = t => {
      $$('.tabs button', f).forEach(b => b.classList.toggle('on', b.dataset.t === t));
      $$('.tab', f).forEach(x => x.hidden = x.dataset.tab !== t);
      setTimeout(() => (t === 'url' ? f.elements.url : f.elements.page).focus(), 20);
    };
    f.addEventListener('click', e => { const b = e.target.closest('.tabs button'); if (b) show(b.dataset.t); });
    const run = what => {
      const F = f.elements;
      if (what === 'wrap' || what === 'chip' || what === 'attach') {
        const url = this.fix(F.url.value);
        if (!url) { F.url.focus(); return; }
        Pop.close();
        if (what === 'attach') { Attach.add(l, { type: 'link', url, title: (F.title && F.title.value.trim()) || '' }); Toast.show({ icon: 'bookmark', text: 'أُرفق الرابط بالصفحة', timeout: 2000 }); return; }
        if (what === 'wrap') this.wrap(range, l, { href: url }, 'vlink');
        else {
          const t = (F.title && F.title.value.trim()) || this.short(url);
          this.chip(range, l, `<a class="chip vlink" href="${esc(url)}" contenteditable="false">${ic(this.isVideo(url) ? 'play' : 'link')}${esc(t)}</a>`);
        }
      } else {
        const bookId = F.book.value, page = clamp(parseInt(F.page.value, 10) || 1, 1, 9999) - 1;
        const bk = books.find(b => b.id === bookId);
        Pop.close();
        const attrs = { href: '#', 'data-book': bookId, 'data-page': page };
        if (what === 'pwrap') this.wrap(range, l, attrs, 'plink');
        else {
          const lbl = (bookId === cur.id ? '' : (bk ? bk.title + ' · ' : '')) + 'صفحة ' + (page + 1);
          this.chip(range, l, `<a class="chip plink" href="#" data-book="${bookId}" data-page="${page}" contenteditable="false">${ic('page')}${esc(lbl)}</a>`);
        }
      }
    };
    f.onsubmit = e => { e.preventDefault(); run(e.submitter ? e.submitter.dataset.do : (f.querySelector('.tab:not([hidden]) .btn.primary').dataset.do)); };
    $('[data-do=attach]', f).onclick = () => run('attach');
    const rect = range && range.getBoundingClientRect && range.getBoundingClientRect();
    const anchor = rect && rect.width + rect.height > 0 ? rect : l.pg.getBoundingClientRect();
    Pop.open({ getBoundingClientRect: () => anchor }, f, { cls: 'panel-pop' });
    show(tab);
  },
  wrap(range, l, attrs, cls) {
    l.c.focus(); Sel.restore(range);
    const mark = '#lnk-' + uid();
    document.execCommand('createLink', false, mark);
    $$('a', l.c).filter(a => a.getAttribute('href') === mark).forEach(a => {
      a.className = cls;
      for (const k in attrs) a.setAttribute(k, attrs[k]);
    });
    Editor.changed(l);
  },
  chip(range, l, html) {
    l.c.focus();
    if (range && l.c.contains(range.startContainer)) Sel.restore(range); else Editor.ensureCaret(l);
    document.execCommand('insertHTML', false, html + '&nbsp;');
    Editor.changed(l);
  },
  menuFor(a, l) {
    const unlink = () => {
      if (a.classList.contains('chip')) a.remove(); else a.replaceWith(...a.childNodes);
      Editor.changed(l);
    };
    if (a.classList.contains('plink')) {
      const bid = a.dataset.book, pg = +a.dataset.page || 0;
      const other = bid && bid !== Reader.book.id;
      Menu.open(a, [
        { icon: 'page', label: other ? `افتح الكتاب المرتبط · صفحة ${pg + 1}` : `اذهب إلى الصفحة ${pg + 1}`, act: () => Reader.openLink(bid || Reader.book.id, pg) },
        '-', { icon: 'x', label: 'إزالة الرابط', act: unlink },
      ], { place: 'above' });
    } else {
      const url = a.getAttribute('href');
      Menu.open(a, [
        { icon: this.isVideo(url) ? 'play' : 'open', label: this.isVideo(url) ? 'تشغيل الفيديو' : 'فتح الرابط', act: () => this.openUrl(url) },
        { icon: 'copy', label: 'نسخ الرابط', act: () => navigator.clipboard.writeText(url) },
        '-', { icon: 'x', label: 'إزالة الرابط', act: unlink },
      ], { place: 'above' });
    }
  },
};

/* ============ تسجيل الصوت ============ */
const Voice = {
  record(anchor) {
    return new Promise(res => {
      const box = el(`<div class="rec"><button class="recbtn" title="تسجيل"><i></i></button>
        <div class="rinfo"><b class="rtime">0:00</b><span class="rhint">اضغط وابدأ الكلام</span></div>
        <button class="ib rcancel" title="إلغاء">${ic('x')}</button></div>`);
      Pop.open(anchor.getBoundingClientRect ? anchor : { getBoundingClientRect: () => anchor }, box, { cls: 'rec-pop', place: 'above' });
      let mr = null, stream = null, chunks = [], t0 = 0, iv = 0, done = false;
      const finish = v => { if (done) return; done = true; clearInterval(iv); if (stream) stream.getTracks().forEach(t => t.stop()); res(v); };
      Pop.onclose = () => { if (mr && mr.state === 'recording') { mr.onstop = null; mr.stop(); } finish(null); };
      $('.rcancel', box).onclick = () => Pop.close();
      $('.recbtn', box).onclick = async () => {
        if (!mr) {
          try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
          catch { Toast.show({ icon: 'mic', title: 'المايكروفون', text: 'لم أستطع الوصول للمايكروفون. اسمح بالوصول ثم جرّب مرة أخرى.' }); Pop.close(); return; }
          const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
          mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 40000 } : {});
          mr.ondataavailable = e => e.data.size && chunks.push(e.data);
          mr.onstop = async () => {
            const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
            const dur = (Date.now() - t0) / 1000;
            const id = await Media.save(blob);
            const out = { id, dur };
            finish(out);
            Pop.close();
          };
          mr.start(); t0 = Date.now();
          box.classList.add('on');
          $('.rhint', box).textContent = 'اضغط للإيقاف والحفظ';
          iv = setInterval(() => { $('.rtime', box).textContent = fmtTime((Date.now() - t0) / 1000); if (Date.now() - t0 > 15 * 60e3) mr.stop(); }, 250);
        } else if (mr.state === 'recording') { clearInterval(iv); mr.stop(); }
      };
    });
  },
  async attachToSelection(range, l) {
    if (!range || range.collapsed || !l.c.contains(range.commonAncestorContainer)) return this.attachToPage(l);
    const rect = range.getBoundingClientRect();
    const res = await this.record({ getBoundingClientRect: () => rect });
    if (!res) return;
    l.c.focus(); Sel.restore(range);
    const span = document.createElement('span');
    span.className = 'voice'; span.dataset.blob = res.id; span.dataset.dur = Math.round(res.dur);
    try { range.surroundContents(span); } catch { span.append(range.extractContents()); range.insertNode(span); }
    getSelection().collapse(span, span.childNodes.length);
    Editor.changed(l);
    Toast.show({ icon: 'mic', text: 'رُبط التسجيل بالكلمة — اضغط عليها للاستماع', timeout: 2600 });
  },
  async attachToPage(l, e) {
    const anchor = e && e.clientX ? { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 } : $('.attach', l.pg).getBoundingClientRect();
    const res = await this.record({ getBoundingClientRect: () => anchor });
    if (!res) return;
    Attach.add(l, { type: 'audio', blob: res.id, dur: res.dur, at: Date.now() });
    Toast.show({ icon: 'mic', text: 'أُرفق التسجيل بالصفحة (أعلى الصفحة)', timeout: 2600 });
  },
  menuFor(span, l) {
    Menu.open(span, [
      { icon: 'play', label: 'استمع للتسجيل' + (span.dataset.dur ? ' · ' + fmtTime(+span.dataset.dur) : ''), act: () => Player.toggle(span.dataset.blob, span) },
      { icon: 'trash', label: 'إزالة التسجيل', danger: true, act: () => { Media.del(span.dataset.blob); span.replaceWith(...span.childNodes); Editor.changed(l); } },
    ], { place: 'above' });
  },
};

/* ============ فيديو قصير داخل الصفحة ============ */
const Media2 = {
  async insertVideo(l, file) {
    const saved = Sel.save();
    file = file || await pickFile('video/*');
    if (!file) return;
    const mb = file.size / 1048576;
    if (mb > 250) { Toast.show({ icon: 'film', title: 'الفيديو كبير جداً', text: 'اختر فيديو أقصر (أقل من 250 ميجا).' }); return; }
    if (mb > 60 && !(await Modal.confirm('فيديو كبير', `حجم الفيديو ${mb.toFixed(0)} ميجا. سيُحفظ داخل الدفتر. متابعة؟`, { ok: 'أضفه' }))) return;
    const id = await Media.save(file);
    l.c.focus();
    if (saved && l.c.contains(saved.startContainer)) Sel.restore(saved);
    const f = el(`<figure class="media" contenteditable="false"><video controls preload="metadata" playsinline data-blob="${id}"></video><button class="mx" title="إزالة الفيديو">${ic('x')}</button></figure>`);
    Editor.insertBlock(l, f);
    Media.hydrate(f);
    Editor.changed(l);
  },
};

/* ============ مؤقت الحبل ============ */
const Rope = {
  L0: 58, len: 58, run: null, iv: 0,
  init() {
    const r = $('#rope');
    r.innerHTML = `<svg class="rope-svg" width="110" height="100%" aria-hidden="false">
      <defs><radialGradient id="bead" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#f6dc9b"/><stop offset=".55" stop-color="#c8963f"/><stop offset="1" stop-color="#6e4a1c"/></radialGradient></defs>
      <g class="rp"><line class="r-a" x1="34" y1="-6" x2="34" y2="58"/><line class="r-b" x1="34" y1="-6" x2="34" y2="58"/></g>
      <g class="knot" transform="translate(34,74)" tabindex="0" role="button" aria-label="مؤقت: اسحب الحبل لأسفل">
        <circle class="k-glow" r="24"/><circle class="k-ring" r="15" fill="url(#bead)"/><circle class="k-hole" r="4.5"/>
      </g>
      <g class="tag" transform="translate(56,74)"><rect x="0" y="-15" rx="9" width="50" height="30"/><text x="25" y="5"></text></g>
    </svg>`;
    this.svg = $('svg', r);
    this.knot = $('.knot', r);
    this.tag = $('.tag', r);
    this.knot.addEventListener('pointerdown', e => this.down(e));
    this.knot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.menu(); } });
    try { const s = JSON.parse(localStorage.getItem('rope') || 'null'); if (s && (s.paused || s.end > Date.now())) { this.run = s; this.startTick(); Study.sessionStart(Math.round(s.total / 60e3), true); } } catch { }
    this.paint();
  },
  ppm() { return Math.max(3, (innerHeight - 190) / 90); },
  setLen(L) {
    this.len = L;
    $$('line', this.svg).forEach(x => x.setAttribute('y2', L));
    this.knot.setAttribute('transform', `translate(34,${L + 16})`);
    this.tag.setAttribute('transform', `translate(56,${L + 16})`);
  },
  label(t) {
    const tx = $('text', this.tag);
    tx.textContent = t || '';
    this.tag.classList.toggle('show', !!t);
    if (t) { const w = Math.max(44, tx.getComputedTextLength() + 22); $('rect', this.tag).setAttribute('width', w); tx.setAttribute('x', w / 2); }
  },
  down(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    try { this.knot.setPointerCapture(e.pointerId); } catch { }
    const y0 = e.clientY, L0 = this.run ? this.len : this.L0;
    let moved = false, mins = 0;
    $('#rope').classList.add('pulling');
    const mv = ev => {
      const dy = ev.clientY - y0;
      if (!moved && Math.abs(dy) < 5) return;
      moved = true;
      if (this.run) return;
      const L = clamp(this.L0 + Math.max(0, dy), this.L0, this.L0 + 90 * this.ppm());
      mins = Math.round((L - this.L0) / this.ppm());
      if (mins > 10) mins = Math.round(mins / 5) * 5;
      this.setLen(L);
      this.label(mins ? `${mins} د` : '');
    };
    const up = () => {
      this.knot.removeEventListener('pointermove', mv); this.knot.removeEventListener('pointerup', up); this.knot.removeEventListener('pointercancel', up);
      $('#rope').classList.remove('pulling');
      if (!moved) { this.menu(); return; }
      if (this.run) return;
      if (mins >= 1) this.start(mins);
      else this.retract();
    };
    this.knot.addEventListener('pointermove', mv); this.knot.addEventListener('pointerup', up); this.knot.addEventListener('pointercancel', up);
  },
  start(mins) {
    this.run = { total: mins * 60e3, end: Date.now() + mins * 60e3, paused: 0 };
    this.save(); this.swing(); this.startTick();
    if (!Study.session) Study.sessionStart(mins);
    Toast.show({ icon: 'timer', text: `بدأت جلسة الدراسة: ${mins} دقيقة. ركّز… وأنا بنبهك`, timeout: 2600 });
  },
  startTick() { clearInterval(this.iv); this.iv = setInterval(() => this.paint(), 1000); this.paint(); },
  remaining() { const r = this.run; return !r ? 0 : r.paused ? r.paused : Math.max(0, r.end - Date.now()); },
  paint() {
    if (!this.run) { this.setLen(this.L0); this.label(''); $('#rope').classList.remove('running', 'paused'); return; }
    const rem = this.remaining();
    const L = this.L0 + (rem / 60e3) * this.ppm();
    this.setLen(L);
    this.label(fmtTime(rem / 1000));
    $('#rope').classList.add('running');
    $('#rope').classList.toggle('paused', !!this.run.paused);
    if (!this.run.paused && rem <= 0) this.finish();
  },
  save() { localStorage.setItem('rope', JSON.stringify(this.run)); },
  stop() { Study.sessionEnd(false); clearInterval(this.iv); this.run = null; localStorage.removeItem('rope'); this.label(''); $('#rope').classList.remove('running', 'paused'); this.retract(); },
  finish() {
    Study.sessionEnd(true); // بيسألك شو تعلمت وبيحفظه بيومياتك
    this.stop();
    Sound.chime(); setTimeout(() => Sound.chime(), 1700);
    if (Reminders.cfg.sys && document.hidden && window.Notification && Notification.permission === 'granted') new Notification('دفتري — انتهى الوقت', { body: 'خذ استراحة قصيرة ✦' });
  },
  menu() {
    const items = this.run ? [
      { head: 'المتبقي ' + fmtTime(this.remaining() / 1000) },
      this.run.paused ? { icon: 'play', label: 'استئناف', act: () => { this.run.end = Date.now() + this.run.paused; this.run.paused = 0; this.save(); this.paint(); } }
        : { icon: 'pause', label: 'إيقاف مؤقت', act: () => { this.run.paused = this.remaining(); this.save(); this.paint(); } },
      { icon: 'plus', label: '+5 دقائق', act: () => { if (this.run.paused) this.run.paused += 5 * 60e3; else this.run.end += 5 * 60e3; this.run.total += 5 * 60e3; this.save(); this.paint(); } },
      '-', { icon: 'x', label: 'إلغاء المؤقت', danger: true, act: () => this.stop() },
    ] : [
      { head: 'اسحب الحبل لأسفل لتحديد الوقت' },
      ...[5, 15, 25, 45, 60].map(m => ({ icon: 'timer', label: `${m} دقيقة`, act: () => this.start(m) })),
    ];
    Menu.open(this.knot, items);
  },
  retract() {
    const from = this.len, t0 = performance.now();
    const step = now => {
      const t = (now - t0) / 1000;
      const L = this.L0 + (from - this.L0) * Math.exp(-5 * t) * Math.cos(9 * t);
      this.setLen(Math.max(this.L0 - 12, L));
      if (t < 1.4) requestAnimationFrame(step); else this.setLen(this.L0);
    };
    requestAnimationFrame(step);
    this.swing();
  },
  swing() { const r = $('#rope'); r.classList.remove('swing'); void r.offsetWidth; r.classList.add('swing'); },
};

/* ============ تذكير المي والحركة ============ */
const Reminders = {
  cfg: { water: { on: true, every: 40 }, move: { on: true, every: 50 }, sound: true, sys: false },
  last: {},
  MSG: {
    water: [['اشرب مي 💧', 'كاسة مي هلّأ بتفرق مع تركيزك.'], ['وقت المي 💧', 'جسمك بحاجة ماء… اشرب كم رشفة.'], ['ترطيب 💧', 'المخ ٧٥٪ ماء — اسقيه.']],
    move: [['قوم تحرّك 🚶', 'قوم امشي دقيقتين ومدّ ظهرك.'], ['استراحة حركة', 'حرّك رقبتك وكتافك، وريّح عيونك ٢٠ ثانية بعيد عن الشاشة.'], ['يلا وقفة', 'قوم عن الكرسي شوي… الكود مش رايح لمكان.']],
  },
  init() {
    try { Object.assign(this.cfg, JSON.parse(localStorage.getItem('rem') || '{}')); } catch { }
    try { this.last = JSON.parse(localStorage.getItem('remLast') || '{}'); } catch { this.last = {}; }
    const now = Date.now();
    ['water', 'move'].forEach(k => { if (!this.last[k] || now - this.last[k] > 6 * 3600e3) this.last[k] = now; });
    this.saveLast();
    setInterval(() => this.tick(), 20000);
  },
  saveCfg() { localStorage.setItem('rem', JSON.stringify(this.cfg)); },
  saveLast() { localStorage.setItem('remLast', JSON.stringify(this.last)); },
  tick() {
    const now = Date.now();
    for (const k of ['water', 'move']) {
      const c = this.cfg[k];
      if (c.on && now - (this.last[k] || now) >= c.every * 60e3) { this.last[k] = now; this.saveLast(); this.fire(k); }
    }
  },
  fire(k) {
    const list = this.MSG[k], [title, text] = list[(Math.random() * list.length) | 0];
    if (this.cfg.sound) Sound.chime(true);
    Toast.show({
      icon: k === 'water' ? 'water' : 'walk', title, text, cls: 'rem ' + k, timeout: 60000, actions: [
        { label: 'بعد ٥ د', act: () => { this.last[k] = Date.now() - (this.cfg[k].every - 5) * 60e3; this.saveLast(); } },
        { label: k === 'water' ? 'شربت ✓' : 'تحركت ✓', primary: true },
      ],
    });
    if (this.cfg.sys && document.hidden && window.Notification && Notification.permission === 'granted') new Notification(title, { body: text });
  },
  panel(anchor) {
    const c = this.cfg;
    const opt = (v, cur) => [15, 20, 30, 40, 45, 50, 60, 90].map(m => `<option value="${m}" ${m === cur ? 'selected' : ''}>كل ${m} دقيقة</option>`).join('');
    const n = el(`<div class="panel rem-panel">
      <h4>${ic('moon')} وقتك الهادئ</h4>
      <div class="rem-row">${ic('water')}<label class="chk"><input type="checkbox" data-k="water.on" ${c.water.on ? 'checked' : ''}> <span>ذكّرني أشرب مي</span></label><select class="inp sm" data-k="water.every">${opt(0, c.water.every)}</select></div>
      <div class="rem-row">${ic('walk')}<label class="chk"><input type="checkbox" data-k="move.on" ${c.move.on ? 'checked' : ''}> <span>ذكّرني أقوم أتحرك</span></label><select class="inp sm" data-k="move.every">${opt(0, c.move.every)}</select></div>
      <label class="chk"><input type="checkbox" data-k="sound" ${c.sound ? 'checked' : ''}> <span>صوت خفيف مع التذكير</span></label>
      <label class="chk"><input type="checkbox" data-k="sys" ${c.sys ? 'checked' : ''}> <span>إشعار ويندوز إذا كانت النافذة مصغّرة</span></label>
      <div class="lbl">${ic('timer')} المؤقت: اسحب الحبل المعلّق بأعلى الشاشة لأسفل — كل ما سحبت أكثر زاد الوقت.</div>
      <div class="row"><button class="btn ghost sm" data-a="test">جرّب التذكير</button><button class="btn ghost sm" data-a="amb">${ic('music')} أصوات الجو</button><button class="btn ghost sm" data-a="journal">${ic('journal')} يومياتي</button></div>
    </div>`);
    n.addEventListener('change', async e => {
      const k = e.target.dataset.k; if (!k) return;
      const v = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
      const [a, b] = k.split('.');
      if (b) { c[a][b] = v; if (b === 'every' || b === 'on') { this.last[a] = Date.now(); this.saveLast(); } } else c[a] = v;
      if (k === 'sys' && v && window.Notification && Notification.permission !== 'granted') {
        const p = await Notification.requestPermission().catch(() => 'denied');
        if (p !== 'granted') { c.sys = false; e.target.checked = false; Toast.show({ icon: 'bell', text: 'لم يُسمح بالإشعارات' }); }
      }
      this.saveCfg();
    });
    $('[data-a=test]', n).onclick = () => { Pop.close(); this.fire(Math.random() > .5 ? 'water' : 'move'); };
    $('[data-a=amb]', n).onclick = () => Ambience.panel($('#btnSound'));
    $('[data-a=journal]', n).onclick = () => { Pop.close(); Study.journalPanel(); };
    Pop.open(anchor, n, { cls: 'panel-pop', place: 'above' });
  },
};

/* ============ التصدير PDF ============ */
const Exporter = {
  async pdf() {
    const R = Reader;
    if (!R.book || this.busy) return;
    this.busy = true;
    setTimeout(() => { this.busy = false; }, 4000);
    Editor.flushAll();
    Pop.close(); Editor.hideBars();
    const box = $('#print');
    box.innerHTML = '';
    box.className = R.paperClasses();
    box.removeAttribute('style');
    const v = R.paperVars();
    for (const k in v) box.style.setProperty(k, v[k]);
    const empty = p => !p.html && !(p.stickies || []).length && !(p.attach || []).length;
    let last = R.pages.length - 1;
    while (last > 0 && empty(R.pages[last])) last--;
    const add = (node, cls = '') => { const s = el(`<section class="pp ${cls}"></section>`); s.append(node); box.append(s); return s; };
    add(R.coverPage('right'), 'pp-cover').style.setProperty('--cvbg', (R.book.cover && R.book.cover.color) || '#1d2b53');
    for (let i = 0; i <= last; i++) add(R.pageEl(i, false, R.sideOfIndex(i)));
    $$('figure.media video', box).forEach(vd => vd.replaceWith(el(`<div class="vid-ph">${ic('film')}<span>فيديو مرفق داخل الدفتر</span></div>`)));
    $$('.flipzone', box).forEach(x => x.remove());
    Toast.show({ icon: 'pdf', title: 'تصدير PDF', text: 'من نافذة الطباعة اختر «حفظ كـ PDF» أو «Microsoft Print to PDF» واضغط حفظ.', timeout: 6000 });
    await Media.hydrate(box);
    const old = document.title;
    document.title = R.book.title;
    const done = () => { box.innerHTML = ''; document.title = old; document.body.classList.remove('printing'); };
    addEventListener('afterprint', done, { once: true });
    document.body.classList.add('printing');
    await raf(); await raf();
    window.print();
  },
};

/* ============ النسخ الاحتياطي ============ */
function blobToDataURL(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); }); }
function dataURLToBlob(d) {
  const i = d.indexOf(','), head = d.slice(0, i), b64 = d.slice(i + 1);
  const mime = (head.match(/data:([^;,]+)/) || [])[1] || '';
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
  return new Blob([u], { type: mime });
}
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[\\/:*?"<>|]+/g, '-');
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const Backup = {
  async exportBooks(ids = null) {
    Editor.flushAll();
    const all = await DB.all('books');
    const books = ids ? all.filter(b => ids.includes(b.id)) : all;
    if (!books.length) { Toast.show({ icon: 'books', text: 'لا توجد كتب للحفظ' }); return; }
    const close = Toast.show({ icon: 'download', text: 'جاري تجهيز النسخة الاحتياطية…', timeout: 0 });
    const pages = [], ids2 = new Set();
    for (const b of books) {
      const ps = (await DB.getMany('pages', b.pageIds || [])).filter(Boolean);
      ps.forEach(p => { pages.push(p); collectBlobs(p).forEach(x => ids2.add(x)); });
      if (b.cover && b.cover.image) ids2.add(b.cover.image);
    }
    const blobs = [];
    for (const id of ids2) { const r = await DB.get('blobs', id); if (r) blobs.push({ id, type: r.type, data: await blobToDataURL(r.blob) }); }
    const out = new Blob([JSON.stringify({ app: 'daftari', v: 1, at: Date.now(), books, pages, blobs, links: (await DB.all('links')).filter(x => pages.some(p => p.id === x.a) && pages.some(p => p.id === x.b)) })], { type: 'application/json' });
    close();
    downloadBlob(out, (books.length === 1 ? books[0].title : 'مكتبة دفتري') + ' ' + new Date().toISOString().slice(0, 10) + '.daftari.json');
    Toast.show({ icon: 'download', text: 'حُفظت النسخة في مجلد التنزيلات (Downloads)', timeout: 4000 });
  },
  async importFile() {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); if (data.app !== 'daftari') throw 0; }
    catch { Toast.show({ icon: 'x', text: 'الملف ليس نسخة احتياطية من دفتري' }); return; }
    const existing = await DB.all('books');
    const have = new Set(existing.map(b => b.id));
    for (const bl of data.blobs || []) {
      if (await DB.get('blobs', bl.id)) continue;
      const blob = dataURLToBlob(bl.data);
      await DB.put('blobs', { id: bl.id, blob, type: bl.type || blob.type, size: blob.size });
    }
    for (const x of data.links || []) if (!(await DB.get('links', x.id))) await DB.put('links', x);
    await IdeaWeb.load();
    let added = 0, skipped = 0;
    for (const b of data.books || []) {
      if (have.has(b.id)) { skipped++; continue; }
      let t = b.title, n = 2;
      while (existing.some(x => normTitle(x.title) === normTitle(t))) t = `${b.title} (${n++})`;
      b.title = t;
      await DB.putMany('pages', (data.pages || []).filter(p => p.bookId === b.id));
      await DB.put('books', b);
      existing.push(b); added++;
    }
    Toast.show({ icon: 'upload', text: `تمت استعادة ${added} كتاب` + (skipped ? ` (${skipped} موجود مسبقاً)` : '') });
    Library.load();
  },
};
