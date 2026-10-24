'use strict';
/* ============ تقويم الدراسة: صفحة شهر، ولكل يوم شو بدك تدرس ============ */
const CAL_WEEK = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة']; // الأسبوع بيبدأ السبت

const Cal = {
  plans: [],
  async load() { this.plans = (await DB.all('plans')) || []; return this.plans; },
  of(date) { return this.plans.filter(p => p.date === date).sort((a, b) => a.created - b.created); },
  pendingToday() { return this.of(ymd()).filter(p => !p.done); },
  dueBySubject() {
    const out = {};
    this.pendingToday().forEach(p => { const s = Library.sid(p); out[s] = (out[s] || 0) + 1; });
    return out;
  },
  linkName(p) {
    if (p.fileId) { const f = Library.files.find(x => x.id === p.fileId); if (f) return f.name; }
    if (p.bookId) { const b = Library.books.find(x => x.id === p.bookId); if (b) return b.title; }
    return '';
  },

  /* ===== بالمكتبة: «مطلوب اليوم» ===== */
  badge() {
    const n = this.pendingToday().length, b = $('#calBadge');
    if (!b) return;
    b.textContent = n; b.hidden = !n;
    $('#btnCal').classList.toggle('due', !!n);
    $('#btnCal').title = n ? `تقويم الدراسة — مطلوب اليوم: ${n}` : 'تقويم الدراسة';
  },
  // أقرب امتحان جاي (مهمة معلّمة امتحان): للعدّ التنازلي
  nextExam() { const t = ymd(); return this.plans.filter(p => p.exam && !p.done && p.date >= t).sort((a, b) => a.date < b.date ? -1 : 1)[0] || null; },
  daysTo(date) { return Math.round((new Date(date + 'T00:00') - new Date(ymd() + 'T00:00')) / 864e5); },
  strip() {
    const list = this.pendingToday(), ex = this.nextExam(), pr = Prayer.chipHTML();
    if (!list.length && !ex && !pr) return null;
    const d = ex && this.daysTo(ex.date);
    const cd = ex ? `<button class="ts-exam" data-date="${ex.date}" title="${esc(ex.date)}">🎯 ${d === 0 ? `<b>${esc(ex.title.replace(/^🎯\s*/, ''))} اليوم!</b> بالتوفيق ✦` : `باقي <b>${d}</b> ${d === 1 ? 'يوم' : d <= 10 ? 'أيام' : 'يوم'} على ${esc(ex.title.replace(/^🎯\s*/, ''))}`}</button>` : '';
    const s = el(`<div class="today-strip ${list.length ? '' : 'calm'}" role="region" aria-label="مطلوب اليوم">
      ${pr}${cd}${list.length ? `<span class="ts-dot" aria-hidden="true"></span><b>مطلوب اليوم</b>
      <div class="ts-items">${list.slice(0, 4).map(p => `<button class="ts-chip" data-pid="${p.id}" dir="auto">${esc(p.title)}</button>`).join('')}${list.length > 4 ? `<span class="muted sm">+${list.length - 4}</span>` : ''}</div>` : '<span class="ts-items"></span>'}
      <button class="btn ghost sm" data-a="cal">${ic('calendar')} افتح التقويم</button></div>`);
    s.addEventListener('click', e => { const pc = e.target.closest('.pr-chip'); if (pc) { Prayer.panel(pc); return; } const x = e.target.closest('[data-date]'); if (x) { this.open({ date: x.dataset.date }); return; } if (e.target.closest('[data-pid], [data-a=cal]')) this.open({ date: ymd() }); });
    return s;
  },
  // رسالة لطيفة مرة باليوم لما يكون في شي مطلوب
  nudge() {
    const n = this.pendingToday().length;
    if (!n || Tour.active || Tour.willRun('lib') || localStorage.getItem('calNudge') === ymd()) return;
    localStorage.setItem('calNudge', ymd());
    Toast.show({
      icon: 'calendar', title: `مطلوب اليوم: ${n} ${n === 1 ? 'مهمة' : 'مهام'} 🗓`, text: this.pendingToday().slice(0, 2).map(p => p.title).join(' · '), timeout: 12000,
      actions: [{ label: 'لاحقاً' }, { label: 'شوف اليوم', primary: true, act: () => this.open({ date: ymd() }) }],
    });
  },

  /* ===== نافذة التقويم ===== */
  async open({ date = null, bookId = null, fileId = null, subjectId = null } = {}) {
    if ($('.modal-back .cal')) return;
    await this.load();
    if (!Library.books.length && !Library.subjects.length) await Library.load();
    const sel = date || ymd();
    const st = { sel, m: new Date(sel + 'T12:00:00'), pre: { bookId, fileId, subjectId } };
    st.m.setDate(1);
    const n = el(`<div class="cal">
      <div class="cal-paper">
        <div class="cal-top">
          <button class="ib" data-a="prev" title="الشهر السابق">${ic('right')}</button>
          <h3 class="cal-month"></h3>
          <button class="ib" data-a="next" title="الشهر الجاي">${ic('left')}</button>
          <button class="btn ghost sm cal-today" data-a="today">اليوم</button>
        </div>
        <div class="cal-week">${CAL_WEEK.map(d => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid" role="grid"></div>
        <p class="cal-legend"><span><i class="lg-due"></i> في شي مطلوب</span><span><i class="lg-done"></i> خلصت ✦</span></p>
      </div>
      <div class="cal-day"></div>
    </div>`);
    const m = Modal.open(n, { cls: 'cal-modal', onClose: () => { if (!$('#library').hidden) Library.load(); } });
    this._m = m;
    const draw = () => { this.drawMonth(n, st); this.drawDay(n, st); };
    n.addEventListener('click', e => this.onClick(e, n, st, draw, m));
    n.addEventListener('change', e => this.onChange(e, n, st, draw));
    n.addEventListener('submit', e => { e.preventDefault(); this.add(n, st, draw); });
    draw();
    setTimeout(() => { const t = $('.cal-add input[name=title]', n); if (t) t.focus(); }, 80);
  },
  drawMonth(n, st) {
    const y = st.m.getFullYear(), mo = st.m.getMonth();
    $('.cal-month', n).textContent = st.m.toLocaleDateString('ar', { month: 'long', year: 'numeric' });
    const first = new Date(y, mo, 1), lead = (first.getDay() + 1) % 7; // السبت = 0
    const today = ymd();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(y, mo, 1 - lead + i, 12), k = ymd(d.getTime());
      if (i >= 35 && d.getMonth() !== mo) break;
      const ps = this.of(k), left = ps.filter(p => !p.done).length;
      const cls = ['cal-d', d.getMonth() !== mo && 'out', k === today && 'today', k === st.sel && 'sel', left && (k < today ? 'late' : 'due'), ps.length && !left && 'done'].filter(Boolean).join(' ');
      const dots = ps.slice(0, 4).map(p => { const s = Library.subject(Library.sid(p)); return `<i style="--dc:${s ? s.color : '#8fb4ff'}" class="${p.done ? 'ok' : ''}"></i>`; }).join('');
      cells.push(`<button class="${cls}" data-d="${k}" aria-label="${d.toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' })}${ps.length ? ` — ${ps.length} مهام` : ''}"><b>${d.getDate()}</b><span class="cal-dots">${dots}</span>${ps.length && !left ? '<span class="cal-star">✦</span>' : ''}</button>`);
    }
    $('.cal-grid', n).innerHTML = cells.join('');
  },
  drawDay(n, st) {
    const ps = this.of(st.sel), done = ps.filter(p => p.done).length;
    const d = new Date(st.sel + 'T12:00:00');
    const isToday = st.sel === ymd();
    const box = $('.cal-day', n);
    const keep = box.querySelector('.cal-add') ? Object.fromEntries([...new FormData(box.querySelector('.cal-add'))]) : null;
    box.innerHTML = `
      <div class="cd-head"><div><h3>${isToday ? 'اليوم · ' : ''}${d.toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        <p class="muted sm">${ps.length ? `${done} من ${ps.length} خلصت` : 'شو بدك تدرس بهاليوم؟'}</p></div>
        ${ps.length ? `<div class="cd-prog" style="--p:${Math.round(done / ps.length * 100)}%"><i></i></div>` : ''}</div>
      <div class="cd-list">${ps.length ? ps.map(p => this.taskHTML(p)).join('') : '<p class="muted cd-empty">ما في مهام بهاليوم. ضيف مادة أو كتاب أو محاضرة PDF مع الصفحات اللي بدك تخلّصها 👇</p>'}</div>
      <form class="cal-add" autocomplete="off">
        <h4>${ic('plus')} أضف مهمة لهاليوم</h4>
        <input class="inp" name="title" dir="auto" maxlength="80" placeholder="شو بدك تدرس؟ مثلاً: الفصل الثالث">
        <div class="cd-row">
          <label class="fld"><span>المادة</span><select class="inp" name="subject">${Library.subjectOptions(NO_SUBJECT)}</select></label>
          <label class="fld"><span>اربطه بـ</span><select class="inp" name="link"></select></label>
        </div>
        <input class="inp" name="pages" dir="auto" maxlength="60" placeholder="الصفحات أو ملاحظة (مثلاً: ١٢–٢٠ أو 12-20)">
        <label class="chk"><input type="checkbox" name="exam"> <span>🎯 هاد امتحان — بيطلع عدّ تنازلي إله بالمكتبة</span></label>
        <em class="err"></em>
        <button class="btn primary" type="submit">${ic('plus')} أضف</button>
      </form>`;
    const F = $('.cal-add', box).elements;
    const pre = st.pre; st.pre = null;
    let sid = keep ? keep.subject : NO_SUBJECT, link = keep ? keep.link : '';
    if (pre) {
      if (pre.bookId) { sid = Library.sid(Library.books.find(b => b.id === pre.bookId)); link = 'b:' + pre.bookId; }
      else if (pre.fileId) { sid = Library.sid(Library.files.find(f => f.id === pre.fileId)); link = 'f:' + pre.fileId; }
      else if (pre.subjectId) sid = pre.subjectId;
    } else if (!keep && Library.cur) sid = Library.cur;
    F.subject.value = Library.subject(sid) ? sid : NO_SUBJECT;
    this.fillLinks(F, link);
    if (keep) { F.title.value = keep.title || ''; F.pages.value = keep.pages || ''; }
  },
  fillLinks(F, sel = '') {
    const sid = F.subject.value, any = sid === NO_SUBJECT;
    const books = Library.books.filter(b => any || Library.sid(b) === sid), files = Library.files.filter(f => any || Library.sid(f) === sid);
    F.link.innerHTML = '<option value="">— بدون ربط —</option>'
      + (books.length ? `<optgroup label="كتاب">${books.map(b => `<option value="b:${b.id}">${esc(b.title)}</option>`).join('')}</optgroup>` : '')
      + (files.length ? `<optgroup label="ملف PDF">${files.map(f => `<option value="f:${f.id}">${esc(f.name)}</option>`).join('')}</optgroup>` : '');
    F.link.value = [...F.link.options].some(o => o.value === sel) ? sel : '';
  },
  taskHTML(p) {
    const s = Library.subject(Library.sid(p)), ln = this.linkName(p);
    const go = p.fileId && ln ? `<button class="btn ghost sm" data-go="${p.id}" title="افتح الملف">${ic('attach')} PDF</button>` : p.bookId && ln ? `<button class="btn ghost sm" data-go="${p.id}" title="افتح الكتاب">${ic('open')} افتح</button>` : '';
    return `<div class="cal-task ${p.done ? 'is-done' : ''}" data-pid="${p.id}" style="--dc:${s ? s.color : '#8fb4ff'}">
      <label class="ct-chk" title="${p.done ? 'رجّعها مش مخلصة' : 'خلصت'}"><input type="checkbox" data-done="${p.id}" ${p.done ? 'checked' : ''}><span></span></label>
      <div class="ct-t"><b dir="auto">${p.exam && !/🎯/.test(p.title) ? '🎯 ' : ''}${esc(p.title)}</b><small dir="auto">${[s && s.name, ln && ln !== p.title ? ln : '', p.pages].filter(Boolean).map(esc).join(' · ')}</small></div>
      ${go}<button class="ib" data-del="${p.id}" title="حذف المهمة">${ic('trash')}</button></div>`;
  },
  onClick(e, n, st, draw, m) {
    const a = e.target.closest('[data-a]'), d = e.target.closest('[data-d]'), go = e.target.closest('[data-go]'), del = e.target.closest('[data-del]');
    if (a && a.dataset.a === 'prev') { st.m.setMonth(st.m.getMonth() - 1); this.drawMonth(n, st); }
    else if (a && a.dataset.a === 'next') { st.m.setMonth(st.m.getMonth() + 1); this.drawMonth(n, st); }
    else if (a && a.dataset.a === 'today') { st.sel = ymd(); st.m = new Date(); st.m.setDate(1); draw(); }
    else if (d) {
      st.sel = d.dataset.d;
      const dd = new Date(st.sel + 'T12:00:00');
      if (dd.getMonth() !== st.m.getMonth() || dd.getFullYear() !== st.m.getFullYear()) { st.m = dd; st.m.setDate(1); }
      draw();
      const t = $('.cal-add input[name=title]', n); if (t && !this.of(st.sel).length) t.focus();
    } else if (go) this.go(this.plans.find(p => p.id === go.dataset.go), m);
    else if (del) this.remove(del.dataset.del, draw);
  },
  async onChange(e, n, st, draw) {
    const t = e.target;
    if (t.name === 'subject') { this.fillLinks(t.form.elements, ''); return; }
    if (t.name === 'link' && t.value) {
      // الربط بكتاب/ملف من مادة: المادة بتتعبّى لحالها
      const [k, id] = t.value.split(':'), o = k === 'b' ? Library.books.find(b => b.id === id) : Library.files.find(f => f.id === id);
      const F = t.form.elements;
      if (o && F.subject.value === NO_SUBJECT && Library.sid(o) !== NO_SUBJECT) { F.subject.value = Library.sid(o); this.fillLinks(F, t.value); }
      return;
    }
    if (t.dataset.done) await this.toggle(t.dataset.done, t.checked, draw, n);
  },
  async add(n, st, draw) {
    const F = $('.cal-add', n).elements;
    const [k, id] = (F.link.value || ':').split(':');
    const p = { id: 't' + uid(), date: st.sel, title: F.title.value.trim(), subjectId: F.subject.value, bookId: k === 'b' ? id : null, fileId: k === 'f' ? id : null, pages: F.pages.value.trim(), exam: !!(F.exam && F.exam.checked), done: false, created: Date.now() };
    if (!p.title) p.title = this.linkName(p) || (p.subjectId !== NO_SUBJECT ? 'دراسة ' + Library.subjectName(p.subjectId) : '');
    if (!p.title) { $('.cal-add .err', n).textContent = 'اكتب شو بدك تدرس، أو اختر مادة أو كتاب'; F.title.focus(); return; }
    await DB.put('plans', p);
    this.plans.push(p);
    F.title.value = ''; F.pages.value = ''; if (F.exam) F.exam.checked = false; // المادة والربط بيضلوا لمهمة ثانية بنفس المادة
    draw();
    const fresh = $(`.cal-task[data-pid="${p.id}"]`, n); if (fresh) fresh.classList.add('new');
    const t = $('.cal-add input[name=title]', n); if (t) t.focus();
  },
  async toggle(id, done, draw, n) {
    const p = this.plans.find(x => x.id === id); if (!p) return;
    p.done = done; p.doneAt = done ? Date.now() : null;
    await DB.put('plans', p);
    const day = this.of(p.date), all = day.length && day.every(x => x.done);
    draw();
    if (done && all) {
      // خلّصت كل مهام اليوم: بتنضاف نجمة للسماء (نفس سلسلة أيام الدراسة)
      const cell = $(`.cal-d[data-d="${p.date}"]`, n); if (cell) cell.classList.add('just-done');
      Sound.chime(true);
      Study.markToday();
      Toast.show({ icon: 'star', title: 'خلّصت كل مهام هاليوم ✦', text: 'أحسنت! السماء عم تمتلي نجوم.', timeout: 4500 });
    }
  },
  async remove(id, draw) {
    const p = this.plans.find(x => x.id === id); if (!p) return;
    await DB.del('plans', id);
    this.plans = this.plans.filter(x => x.id !== id);
    draw();
    Toast.show({ icon: 'trash', text: `انحذفت «${p.title}»`, timeout: 5000, actions: [{ label: 'تراجع', act: async () => { await DB.put('plans', p); this.plans.push(p); if ($('.modal-back .cal')) draw(); else if (!$('#library').hidden) Library.render(); } }] });
  },
  // «افتح»: بيفتح الكتاب على الصفحة (إذا كتبت رقم) أو ملف الـPDF
  go(p, m) {
    if (!p) return;
    if (p.fileId) { m.close(); setTimeout(() => Files.open(p.fileId), 60); return; }
    if (p.bookId) {
      const num = parseInt(String(p.pages || '').replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)), 10);
      m.close();
      setTimeout(() => Reader.open(p.bookId, num >= 1 ? num - 1 : null), 60);
    }
  },
};
