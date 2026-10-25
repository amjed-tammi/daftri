'use strict';
/* ============ الدراسة: النجوم، التركيز، جلسات الحبل واليوميات ============ */
const DAY = 864e5;
function ymd(t = Date.now()) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function htmlText(html) {
  if (!html) return '';
  const h = html.replace(/<\/(p|div|li|h\d|tr|pre|blockquote)>|<br\s*\/?>/gi, '$&\n').replace(/<\/t[dh]>/gi, '$& ');
  return new DOMParser().parseFromString(h, 'text/html').body.textContent || '';
}

const Study = {
  focus: false, session: null, lastStar: null,

  init() {
    Sky.extra = (g, w, h) => this.drawStars(g, w, h);
    Sky.draw();
    document.addEventListener('selectionchange', debounce(() => this.trackCurrent(), 60));
    this.renderStreak();
  },

  onBookOpen() { },
  onBookClose() { },

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
    b.title = `${n} يوم دراسة — كل يوم بتخلّص فيه جلسة دراسة أو مهام اليوم بتنضاف نجمة ذهبية للسماء` + (s > 1 ? `\n${s} أيام ورا بعض` : '');
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

  /* ===== ساعات الدراسة لكل مادة (من جلسات الحبل) ===== */
  log() { try { return JSON.parse(localStorage.getItem('studyLog') || '[]'); } catch { return []; } },
  logMinutes(mins, sid = NO_SUBJECT) {
    mins = Math.round(mins);
    if (!(mins >= 1)) return;
    const L = this.log(); L.push({ d: ymd(), m: mins, s: sid || NO_SUBJECT });
    localStorage.setItem('studyLog', JSON.stringify(L.slice(-600)));
  },
  // آخر 7 أيام: المجموع، واليوم، ولكل مادة
  week() {
    const from = ymd(Date.now() - 6 * DAY), L = this.log().filter(x => x.d >= from);
    const by = new Map(); L.forEach(x => by.set(x.s, (by.get(x.s) || 0) + x.m));
    const subj = [...by].map(([s, m]) => ({ s, m, name: s === NO_SUBJECT ? 'عام' : Library.subjectName(s), color: (Library.subject(s) || {}).color || '#8fa3c8' })).sort((a, b) => b.m - a.m);
    return { total: L.reduce((t, x) => t + x.m, 0), today: L.filter(x => x.d === ymd()).reduce((t, x) => t + x.m, 0), subj };
  },
  hm(m) { const h = Math.floor(m / 60), r = m % 60; return h ? `${h} س${r ? ` و${r} د` : ''}` : `${r} د`; },
  weekHTML() {
    const w = this.week();
    if (!w.total) return '<div class="wk"><p class="muted sm">⏱ لسا ما في جلسات هالأسبوع — اسحب الحبل وابدأ، وبتنحسب ساعات كل مادة هون.</p></div>';
    const max = Math.max(...w.subj.map(x => x.m));
    return `<div class="wk"><div class="wk-top"><b>⏱ هالأسبوع: ${this.hm(w.total)}</b><span class="muted sm">اليوم: ${this.hm(w.today)}</span></div>
      ${w.subj.map(x => `<div class="wk-row"><span class="wk-n" dir="auto">${esc(x.name)}</span><span class="wk-bar"><i style="width:${Math.max(4, Math.round(x.m / max * 100))}%;background:${x.color}"></i></span><span class="wk-m">${this.hm(x.m)}</span></div>`).join('')}</div>`;
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
      ${this.weekHTML()}
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
