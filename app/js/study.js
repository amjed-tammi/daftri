'use strict';
/* ============ الدراسة: أسئلة المراجعة، وضع الامتحان، النجوم، التركيز، الجلسات واليوميات ============ */
const DAY = 864e5;
const REVIEW_STEPS = [1, 3, 7, 16, 35, 80]; // بعد كم يوم يرجع السؤال حسب مستواه
function ymd(t = Date.now()) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dayStart(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function endOfToday() { return dayStart() + DAY - 1; }
function htmlText(html) {
  if (!html) return '';
  const h = html.replace(/<\/(p|div|li|h\d|tr|pre|blockquote)>|<br\s*\/?>/gi, '$&\n').replace(/<\/t[dh]>/gi, '$& ');
  return new DOMParser().parseFromString(h, 'text/html').body.textContent || '';
}

const Study = {
  exam: false, focus: false, rv: null, session: null, lastStar: null,

  init() {
    Sky.extra = (g, w, h) => this.drawStars(g, w, h);
    Sky.draw();
    document.addEventListener('selectionchange', debounce(() => this.trackCurrent(), 60));
    this.renderStreak();
    const rb = $('#reviewbar');
    rb.addEventListener('click', e => {
      const b = e.target.closest('[data-rv]'); if (!b) return;
      const a = b.dataset.rv;
      if (a === 'reveal') this.reveal();
      else if (a === 'ok') this.rate(true);
      else if (a === 'again') this.rate(false);
      else if (a === 'end') this.finishReview();
    });
  },

  /* ===== أسئلة المراجعة ===== */
  async mark(range, l) {
    if (!range || range.collapsed || !l.c.contains(range.commonAncestorContainer) || !range.toString().trim()) {
      Toast.show({ icon: 'cards', text: 'حدّد الجواب أولاً (كلمة أو جملة)، بعدين اضغط الزر' });
      return;
    }
    const inside = (range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement).closest('.ans');
    if (inside) { this.unmark(inside, l); return; }
    const id = 'c' + uid();
    l.c.focus(); Sel.restore(range);
    const span = document.createElement('span');
    span.className = 'ans'; span.dataset.card = id;
    try { range.surroundContents(span); } catch { span.append(range.extractContents()); range.insertNode(span); }
    getSelection().collapse(span.parentNode, [...span.parentNode.childNodes].indexOf(span) + 1);
    await DB.put('cards', { id, bookId: Reader.book.id, level: 0, due: dayStart() + DAY, created: Date.now(), reviews: 0 });
    Editor.changed(l); l.save.flush();
    this.updateBadge();
    Toast.show({ icon: 'cards', title: 'صار سؤال مراجعة ✦', text: 'الجواب بيتخبّى بوضع الامتحان، والسؤال بيرجعلك بكرة.', timeout: 4000 });
  },
  unmark(span, l) {
    DB.del('cards', span.dataset.card);
    span.replaceWith(...span.childNodes);
    Editor.changed(l);
    this.updateBadge();
    Toast.show({ icon: 'cards', text: 'أُلغي سؤال المراجعة', timeout: 2000 });
  },
  // يربط الأسئلة بصفحاتها، ويصلّح أي سؤال انحذف أو انضاف من نسخة احتياطية
  async syncCards(book, pages) {
    const all = (await DB.all('cards')).filter(c => c.bookId === book.id);
    const byId = new Map(all.map(c => [c.id, c]));
    const found = new Map();
    pages.forEach((p, i) => { (p.html || '').replace(/data-card="([^"]+)"/g, (_, id) => { if (!found.has(id)) found.set(id, i); return ''; }); });
    const out = [];
    for (const [id, i] of found) {
      let c = byId.get(id);
      if (!c) { c = { id, bookId: book.id, level: 0, due: Date.now(), created: Date.now(), reviews: 0 }; DB.put('cards', c); }
      out.push({ ...c, pageIndex: i });
    }
    all.filter(c => !found.has(c.id)).forEach(c => DB.del('cards', c.id));
    return out;
  },
  async dueCards(book, pages) {
    const cards = await this.syncCards(book, pages);
    return cards.filter(c => c.due <= endOfToday()).sort((a, b) => a.pageIndex - b.pageIndex);
  },
  async updateBadge() {
    if (!Reader.book) return;
    Editor.flushAll();
    const n = (await this.dueCards(Reader.book, Reader.pages)).length;
    const b = $('#rvBadge');
    b.textContent = n; b.hidden = !n;
    return n;
  },
  async onBookOpen(b) {
    const n = await this.updateBadge();
    const key = 'rvAsk-' + b.id;
    if (Tour.active || Tour.willRun('book')) return; // ما نقاطع الجولة
    if (n && localStorage.getItem(key) !== ymd()) {
      localStorage.setItem(key, ymd());
      setTimeout(() => Toast.show({
        icon: 'moon', title: `عندك ${n} ${n === 1 ? 'سؤال' : 'أسئلة'} للمراجعة اليوم 🌙`, text: `تقريباً ${Math.max(1, Math.round(n * .5))} دقائق`, timeout: 15000,
        actions: [{ label: 'لاحقاً' }, { label: 'ابدأ المراجعة', primary: true, act: () => this.startReview() }],
      }), 1200);
    }
  },
  onBookClose() {
    if (this.rv) this.finishReview(true);
  },
  async decorateLibrary() {
    const cards = (await DB.all('cards')).filter(c => c.due <= endOfToday());
    const count = {};
    cards.forEach(c => { count[c.bookId] = (count[c.bookId] || 0) + 1; });
    $$('.bk[data-id]').forEach(bk => {
      const n = count[bk.dataset.id];
      $('.bk-due', bk)?.remove();
      if (n) $('.bk-meta', bk).append(el(`<span class="bk-due">${ic('cards')} ${n} للمراجعة</span>`));
    });
  },

  /* ===== وضع الامتحان ===== */
  setExam(on) {
    this.exam = on;
    $('#book').classList.toggle('exam', on);
    $$('.ans.shown').forEach(x => x.classList.remove('shown'));
    $('#tbReview').classList.toggle('active', on);
  },
  onClick(e) {
    const a = e.target.closest('.ans');
    if (!a || !(this.exam || this.rv)) return false;
    e.preventDefault();
    if (this.rv && a.classList.contains('rv-target')) { this.reveal(); return true; }
    a.classList.toggle('shown');
    return true;
  },
  reviewMenu(anchor) {
    Menu.open(anchor, [
      { head: 'المراجعة = أسئلة بترجعلك لحد ما تحفظها' },
      { icon: 'play', label: 'ابدأ مراجعة اليوم' + ($('#rvBadge').hidden ? '' : ` (${$('#rvBadge').textContent})`), act: () => this.startReview() },
      { icon: 'tape', label: (this.exam ? '✓ ' : '') + 'وضع الامتحان: خبّي كل الأجوبة', act: () => this.setExam(!this.exam) },
      '-',
      { icon: 'cards', label: 'شو يعني مراجعة؟ وكيف أعمل سؤال؟', act: () => Toast.show({ icon: 'cards', title: 'المراجعة بثلاث خطوات', text: '١) اكتب سؤال وجوابه بالصفحة، حدّد الجواب واضغط 🩹 بشريط التنسيق — الجواب بيتغطّى بشريط لاصق. ٢) «ابدأ مراجعة اليوم» بيعرضلك الأسئلة المستحقة: بتفكر، بتكشف الجواب، وبتقول عرفته أو لا. ٣) اللي عرفته بيرجعلك بعد أيام أطول (١، ٣، ٧…)، واللي ما عرفته بيرجع بكرة. «وضع الامتحان» بيغطي كل الأجوبة بالكتاب لتسمّع لحالك.', timeout: 16000 }) },
      { icon: 'journal', label: 'يومياتي', act: () => this.journalPanel() },
    ]);
    if (Pop.cur) Pop.cur._from = '#topbar';
  },

  /* ===== جلسة المراجعة ===== */
  async startReview() {
    if (!Reader.book || this.rv) return;
    Editor.flushAll();
    const q = await this.dueCards(Reader.book, Reader.pages);
    if (!q.length) { Toast.show({ icon: 'moon', text: 'ما في أسئلة للمراجعة اليوم 🌙 — كمّل كتابة', timeout: 3000 }); return; }
    this.rv = { q, total: q.length, done: 0, ok: 0, cur: null, wasExam: this.exam };
    document.body.classList.add('reviewing');
    $('#navbar').classList.remove('show');
    this.setExam(true);
    $('#reviewbar').hidden = false;
    this.nextCard();
  },
  clearTarget() {
    $$('.rv-target').forEach(x => x.classList.remove('rv-target', 'shown'));
    $$('.rv-focus').forEach(x => x.classList.remove('rv-focus'));
  },
  async nextCard() {
    const R = this.rv; if (!R) return;
    this.clearTarget();
    const card = R.q.shift();
    if (!card) { this.finishReview(); return; }
    R.cur = card;
    await Reader.showPage(card.pageIndex);
    const span = $(`.content [data-card="${card.id}"]`);
    if (!span) { this.nextCard(); return; }
    span.classList.add('rv-target');
    const blk = topBlock(span.closest('.content'), span);
    if (blk) blk.classList.add('rv-focus');
    this.bar(`<span class="rv-n">${R.done + 1} من ${R.total}</span><span class="rv-t">فكّر بالجواب… بعدين اضغط على الشريط الأصفر</span><button class="btn primary sm" data-rv="reveal">اكشف الجواب</button><button class="ib" data-rv="end" title="إنهاء">${ic('x')}</button>`);
  },
  reveal() {
    const span = $('.rv-target'); if (!span) return;
    span.classList.add('shown');
    this.bar(`<span class="rv-n">${this.rv.done + 1} من ${this.rv.total}</span><span class="rv-t">كيف كان؟</span><button class="btn ghost sm" data-rv="again">🔁 لسا</button><button class="btn primary sm" data-rv="ok">✓ عرفتها</button><button class="ib" data-rv="end" title="إنهاء">${ic('x')}</button>`);
  },
  async rate(ok) {
    const R = this.rv; if (!R || !R.cur) return;
    const c = await DB.get('cards', R.cur.id) || { ...R.cur };
    delete c.pageIndex;
    c.level = ok ? Math.min((c.level || 0) + 1, REVIEW_STEPS.length - 1) : 0;
    c.due = dayStart() + REVIEW_STEPS[c.level] * DAY;
    c.reviews = (c.reviews || 0) + 1; c.last = Date.now();
    await DB.put('cards', c);
    R.done++; if (ok) R.ok++;
    R.cur = null;
    this.nextCard();
  },
  bar(html) { $('#reviewbar').innerHTML = html; },
  finishReview(silent = false) {
    const R = this.rv; if (!R) return;
    this.rv = null;
    this.clearTarget();
    this.setExam(R.wasExam);
    document.body.classList.remove('reviewing');
    $('#reviewbar').hidden = true;
    this.updateBadge();
    if (R.done && !silent) {
      Toast.show({ icon: 'star', title: 'خلصت المراجعة ✦', text: `عرفت ${R.ok} من ${R.done}. اللي ما عرفته بيرجعلك بكرة.`, timeout: 6000 });
      this.markToday();
    }
  },

  /* ===== النجوم والسلسلة ===== */
  days() { try { return JSON.parse(localStorage.getItem('studyDays') || '[]'); } catch { return []; } },
  streak() {
    const set = new Set(this.days());
    let n = 0, t = Date.now();
    if (!set.has(ymd(t))) t -= DAY;
    while (set.has(ymd(t))) { n++; t -= DAY; }
    return n;
  },
  markToday() {
    const d = ymd(), days = this.days();
    if (days.includes(d)) return;
    days.push(d);
    localStorage.setItem('studyDays', JSON.stringify(days));
    Sky.draw();
    this.renderStreak();
    const s = this.streak();
    Toast.show({ icon: 'star', title: 'نجمة جديدة انضافت لسماك ✦', text: `${days.length} يوم دراسة` + (s > 1 ? ` · ${s} أيام ورا بعض 🔥` : ''), timeout: 6000 });
    if (this.lastStar) {
      const sp = el('<i class="newstar"></i>');
      sp.style.left = this.lastStar.x + 'px'; sp.style.top = this.lastStar.y + 'px';
      document.body.append(sp); setTimeout(() => sp.remove(), 3200);
    }
  },
  renderStreak() {
    const b = $('#streak'); if (!b) return;
    const n = this.days().length, s = this.streak();
    b.hidden = !n;
    b.innerHTML = `✦ ${n}` + (s > 1 ? ` <small>🔥${s}</small>` : '');
    b.title = `${n} يوم دراسة — كل يوم بتراجع أو بتخلّص جلسة بتنضاف نجمة ذهبية للسماء` + (s > 1 ? `\n${s} أيام ورا بعض` : '');
  },
  drawStars(g, w, h) {
    const n = Math.min(this.days().length, 400);
    let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const x = w * (.03 + rnd() * .94), y = h * (.03 + rnd() * .6), r = 2.4 + rnd() * 1.4;
      const gl = g.createRadialGradient(x, y, 0, x, y, r * 6);
      gl.addColorStop(0, 'rgba(255,220,140,.55)'); gl.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 6, 0, 6.283); g.fill();
      g.fillStyle = '#ffe7a8'; g.beginPath();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * .35 : r * 1.6; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      this.lastStar = { x, y };
    }
  },

  /* ===== وضع التركيز ===== */
  setFocus(on) {
    this.focus = on;
    document.body.classList.toggle('focus-mode', on);
    $('#tbFocus').classList.toggle('active', on);
    if (!on) $$('.is-current').forEach(x => x.classList.remove('is-current'));
    else { this.trackCurrent(); Toast.show({ icon: 'focus', text: 'وضع التركيز — Ctrl+Shift+F أو Esc للخروج', timeout: 2500 }); }
  },
  trackCurrent() {
    if (!this.focus) return;
    const s = getSelection();
    const n = s.rangeCount ? s.anchorNode : null;
    const c = n && (n.nodeType === 1 ? n : n.parentElement).closest('.content[contenteditable]');
    const blk = c ? topBlock(c, n) : null;
    $$('.is-current').forEach(x => { if (x !== blk) x.classList.remove('is-current'); });
    if (blk && blk.nodeType === 1) blk.classList.add('is-current');
  },

  /* ===== جلسة الدراسة (الحبل) ===== */
  sessionStart(mins, quiet = false) {
    this.session = { start: Date.now(), mins, amb: false };
    document.body.classList.add('in-session');
    if (!quiet && Music.forSession()) this.session.amb = true;
  },
  sessionEnd(done) {
    const s = this.session; if (!s) return;
    this.session = null;
    document.body.classList.remove('in-session');
    if (s.amb) Music.stop();
    if (done) this.journalPrompt(s);
  },
  journalPrompt(s) {
    const n = el(`<form class="journal-form">
      <div class="jf-head">${ic('star')}<div><h3>انتهت الجلسة ✦</h3><p class="muted">${s.mins} دقيقة تركيز. أحسنت — خذ استراحة، اشرب مي وحرّك جسمك.</p></div></div>
      <label class="fld"><span>شو تعلمت اليوم؟ <small>(بينحفظ بيومياتك)</small></span><textarea class="inp" rows="4" placeholder="مثلاً: فهمت الفرق بين let و const…"></textarea></label>
      <div class="row end"><button type="button" class="btn ghost" data-a="more">+5 دقائق</button><button type="button" class="btn ghost" data-a="skip">تخطّي</button><button class="btn primary">احفظ</button></div>
    </form>`);
    const m = Modal.open(n, { cls: 'sm' });
    const ta = $('textarea', n);
    setTimeout(() => ta.focus(), 80);
    $('[data-a=more]', n).onclick = () => { m.close(); Rope.start(5); };
    $('[data-a=skip]', n).onclick = () => { m.close(); this.markToday(); };
    n.onsubmit = async e => {
      e.preventDefault();
      const text = ta.value.trim();
      if (text) await DB.put('journal', { id: 'j' + uid(), at: Date.now(), mins: s.mins, text, bookId: Reader.book ? Reader.book.id : null, bookTitle: Reader.book ? Reader.book.title : '' });
      m.close();
      this.markToday();
      if (text) Toast.show({ icon: 'journal', text: 'انحفظت بيومياتك ✓', timeout: 2000 });
    };
  },
  async journalPanel() {
    const items = (await DB.all('journal')).sort((a, b) => b.at - a.at);
    const n = el(`<div class="journal">
      <div class="jf-head">${ic('journal')}<div><h3>يومياتي</h3><p class="muted">اللي كتبته بآخر كل جلسة دراسة · ${this.days().length} يوم دراسة</p></div></div>
      <div class="j-list">${items.length ? items.map(j => `<article data-id="${j.id}"><header><b>${new Date(j.at).toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' })}</b><span>${j.mins ? j.mins + ' دقيقة' : ''}${j.bookTitle ? ' · ' + esc(j.bookTitle) : ''}</span><button class="ib" title="حذف" data-del="${j.id}">${ic('trash')}</button></header><p>${esc(j.text)}</p></article>`).join('') : '<p class="muted empty-j">لسا ما في شي. اسحب الحبل وابدأ جلسة دراسة، وبآخرها اكتب شو تعلمت 🌙</p>'}</div>
      <div class="row end"><button class="btn ghost" data-a="close">إغلاق</button></div></div>`);
    const m = Modal.open(n, { cls: 'wide' });
    n.addEventListener('click', async e => {
      const d = e.target.closest('[data-del]');
      if (d) { await DB.del('journal', d.dataset.del); d.closest('article').remove(); return; }
      if (e.target.closest('[data-a=close]')) m.close();
    });
  },
};
