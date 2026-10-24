'use strict';
/* ============ أول تشغيل: «شو بتعمل؟» — توجيهي، جامعة، كاتب، أو بس دفتر ============
   سؤال واحد ببداية التطبيق بيجهّز كل شي: المواد، دفتر لكل مادة بالورق المناسب، وموعد الامتحان بالتقويم.
   الكاتب بيطلعله شريط أخف (بدون أدوات المراجعة والامتحانات) — وكل شي بيتغيّر بعدين من الإعدادات. */
const PROFILES = {
  tawjihi: { icon: '🎓', title: 'طالب توجيهي', text: 'موادّك جاهزة، أسئلة مراجعة وامتحانات، وعدّ تنازلي للامتحان بالتقويم.' },
  uni: { icon: '🏛', title: 'طالب جامعة', text: 'مواد الفصل، محاضرات PDF جنب ملاحظاتك، وكود وجداول.' },
  writer: { icon: '✍️', title: 'كاتب', text: 'كتب وفصول، ورق مريح ووضع تركيز — بدون أدوات الدراسة.' },
  notes: { icon: '📝', title: 'بس بدي دفتر', text: 'دفتر فاضي وابدأ اكتب فوراً.' },
};
// مواد التوجيهي: اقتراحات بتتعدّل (كل بلد ونظام إله تسمياته)
const TAWJIHI = {
  sci: ['الرياضيات', 'الفيزياء', 'الكيمياء', 'الأحياء', 'اللغة العربية', 'اللغة الإنجليزية', 'التربية الإسلامية', 'التاريخ'],
  lit: ['اللغة العربية', 'اللغة الإنجليزية', 'التربية الإسلامية', 'التاريخ', 'الجغرافيا', 'الرياضيات', 'الثقافة العامة'],
};
const UNI_HINTS = ['برمجة', 'رياضيات', 'إحصاء', 'فيزياء عامة', 'لغة إنجليزية', 'قواعد بيانات', 'محاسبة', 'علم نفس'];
// ورق كل مادة: مربعات للحساب، مسطّر للنص
const gridSubject = n => /رياض|فيزي|كيمي|إحصا|محاسب|math|phys|chem|stat/i.test(n);

const Onboard = {
  should() { return Tour.willRun('lib') && !Settings.d.app.profile && !Library.books.length && !Library.subjects.length; },
  open() {
    const n = el(`<div class="onboard">
      <div class="ob-step" data-s="1">
        <div class="ob-hello"><img src="icon.svg" alt="" width="56" height="56"><div><h2>أهلاً فيك بدفتري ✦</h2><p class="muted">سؤال واحد وبنجهّزلك كل شي. بتقدر تغيّره بعدين من الإعدادات.</p></div></div>
        <h3>شو بتعمل؟</h3>
        <div class="ob-cards">${Object.entries(PROFILES).map(([k, p]) => `<button class="ob-card" data-p="${k}"><span class="ob-ic">${p.icon}</span><b>${p.title}</b><span>${p.text}</span></button>`).join('')}</div>
        <div class="row end"><button class="btn ghost" data-a="skip">تخطّي</button></div>
      </div>
      <div class="ob-step" data-s="2" hidden></div>
    </div>`);
    // سكّر بدون ما يختار: بنكمل بالجولة، ومنسأله المرة الجاية
    const m = Modal.open(n, { cls: 'wide onboard-modal', onClose: () => { if (!Settings.d.app.profile) setTimeout(() => Tour.maybe('lib'), 300); } });
    this.m = m; this.n = n;
    n.addEventListener('click', e => {
      const c = e.target.closest('[data-p]'); if (c) { this.step2(c.dataset.p); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'skip') { Settings.set('profile', 'skip'); m.close(); Tour.maybe('lib'); }
    });
    setTimeout(() => $('.ob-card', n)?.focus(), 60);
  },
  // الخطوة الثانية حسب الاختيار
  step2(p) {
    const box = $('[data-s="2"]', this.n);
    $('[data-s="1"]', this.n).hidden = true; box.hidden = false;
    const chips = (list, on = true) => list.map(s => `<button type="button" class="ob-chip ${on ? 'on' : ''}" data-v="${esc(s)}">${esc(s)}</button>`).join('');
    const addRow = `<div class="ob-add"><input class="inp" type="text" dir="auto" placeholder="اسم مادة ثانية…" maxlength="40"><button type="button" class="btn ghost sm" data-a="add">${ic('plus')} أضف</button></div>`;
    const back = `<button class="btn ghost" data-a="back">رجوع</button>`;
    if (p === 'tawjihi') box.innerHTML = `<h3>🎓 موادّك</h3>
      <div class="seg ob-stream"><button type="button" class="on" data-st="sci">علمي</button><button type="button" data-st="lit">أدبي / إنساني</button></div>
      <p class="muted sm">شيل اللي مش إلك وضيف اللي ناقص — كل مادة بيصيرلها دفتر (مربعات للحساب، مسطّر للنص).</p>
      <div class="ob-chips">${chips(TAWJIHI.sci)}</div>${addRow}
      <label class="fld"><span>موعد أول امتحان (اختياري) — بيطلعلك عدّ تنازلي بالتقويم</span><input class="inp" type="date" name="exam" min="${ymd()}"></label>
      <div class="row end">${back}<button class="btn primary" data-a="go">${ic('check')} جهّزلي دفاتري</button></div>`;
    else if (p === 'uni') box.innerHTML = `<h3>🏛 مواد الفصل</h3>
      <p class="muted sm">اكتب مواد هالفصل (أو اختار من الاقتراحات). كل مادة بيصيرلها دفتر محاضرات، وبتقدر ترفع PDF المحاضرة جنبه.</p>
      <div class="ob-chips">${chips(UNI_HINTS, false)}</div>${addRow}
      <div class="row end">${back}<button class="btn primary" data-a="go">${ic('check')} جهّزلي دفاتري</button></div>`;
    else if (p === 'writer') box.innerHTML = `<h3>✍️ أول كتاب إلك</h3>
      <label class="fld"><span>اسم الكتاب</span><input class="inp" type="text" dir="auto" name="title" value="كتابي الأول" maxlength="80"></label>
      <div class="seg ob-paper"><button type="button" class="on" data-pp="lined">مسطّر</button><button type="button" data-pp="blank">سادة</button></div>
      <p class="muted sm">رح نخفّي أدوات الدراسة (مراجعة، امتحانات) من الشريط حتى يضل نظيف. بترجّعها من الإعدادات وقت ما بدك.</p>
      <div class="row end">${back}<button class="btn primary" data-a="go">${ic('check')} يلا نكتب</button></div>`;
    else { this.finish(p, {}); return; }
    const pickSt = st => { $$('[data-st]', box).forEach(b => b.classList.toggle('on', b.dataset.st === st)); $('.ob-chips', box).innerHTML = chips(TAWJIHI[st]); };
    box.onclick = e => {
      const t = e.target;
      if (t.closest('.ob-chip')) { t.closest('.ob-chip').classList.toggle('on'); return; }
      if (t.closest('[data-st]')) { pickSt(t.closest('[data-st]').dataset.st); return; }
      if (t.closest('[data-pp]')) { $$('[data-pp]', box).forEach(b => b.classList.toggle('on', b === t.closest('[data-pp]'))); return; }
      const a = t.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'add') this.addChip(box);
      else if (a.dataset.a === 'back') { box.hidden = true; $('[data-s="1"]', this.n).hidden = false; }
      else if (a.dataset.a === 'go') {
        const subjects = $$('.ob-chip.on', box).map(b => b.dataset.v);
        if ((p === 'tawjihi' || p === 'uni') && !subjects.length) { Toast.show({ icon: 'folder', text: 'اختار مادة وحدة على الأقل (أو ضيف وحدة)', timeout: 2500 }); return; }
        this.finish(p, { subjects, exam: $('[name=exam]', box)?.value || '', title: $('[name=title]', box)?.value.trim() || '', paper: $('[data-pp].on', box)?.dataset.pp || 'lined' });
      }
    };
    const inp = $('.ob-add input', box);
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.addChip(box); } });
    setTimeout(() => (inp && p === 'uni' ? inp : $('input, .ob-chip', box))?.focus(), 60);
  },
  addChip(box) {
    const inp = $('.ob-add input', box), v = inp.value.trim(); if (!v) return;
    const ex = $$('.ob-chip', box).find(b => normTitle(b.dataset.v) === normTitle(v));
    if (ex) ex.classList.add('on');
    else $('.ob-chips', box).insertAdjacentHTML('beforeend', `<button type="button" class="ob-chip on" data-v="${esc(v)}">${esc(v)}</button>`);
    inp.value = ''; inp.focus();
  },
  // بنعمل المواد والدفاتر، وبنفتح أول دفتر أو المكتبة
  async finish(p, o) {
    Settings.set('profile', p);
    this.applyProfile();
    const mkBook = (title, subjectId, style, color) => {
      const paper = { ...Settings.newPaper(), style };
      const b = { id: 'k' + uid(), subjectId: subjectId || NO_SUBJECT, title, author: '', dir: Settings.d.dir, cover: { color, image: null }, paper, series: null, music: { track: 'default', auto: null }, pageIds: [], created: Date.now(), updated: Date.now(), lastSpread: -1 };
      const pages = [0, 1, 2, 3].map(() => ({ id: 'p' + uid(), bookId: b.id, html: '', stickies: [], attach: [] }));
      pages.forEach(x => b.pageIds.push(x.id));
      return { b, pages };
    };
    const books = [], pages = [], subjects = [];
    if (o.subjects && o.subjects.length) {
      o.subjects.forEach((name, i) => {
        const s = { id: 's' + uid(), name, color: SUBJECT_COLORS[i % SUBJECT_COLORS.length], created: Date.now() + i };
        subjects.push(s);
        const k = mkBook(p === 'uni' ? `محاضرات ${name}` : `دفتر ${name}`, s.id, gridSubject(name) ? 'grid' : 'lined', COVER_COLORS[i % 7][0]);
        books.push(k.b); pages.push(...k.pages);
      });
    } else {
      const k = mkBook(p === 'writer' ? (o.title || 'كتابي الأول') : 'دفتري', null, p === 'writer' ? o.paper : 'lined', COVER_COLORS[0][0]);
      books.push(k.b); pages.push(...k.pages);
    }
    for (const s of subjects) await DB.put('subjects', s);
    await DB.putMany('pages', pages);
    for (const b of books) await DB.put('books', b);
    // موعد الامتحان بالتقويم
    if (o.exam) { const plan = { id: 't' + uid(), date: o.exam, title: '🎯 الامتحان', exam: true, subjectId: NO_SUBJECT, bookId: null, fileId: null, pages: '', done: false, created: Date.now() }; await DB.put('plans', plan); if (typeof Cal !== 'undefined') await Cal.load(); }
    this.m.close();
    await Library.load();
    // دفتر واحد: بنفتحه على أول صفحة. كذا مادة: المكتبة بتعرضهم وبتبدأ الجولة
    if (books.length === 1) { await Reader.open(books[0].id, 0); localStorage.setItem('tour-lib', '1'); Tour.maybe('book'); }
    else {
      Toast.show({ icon: 'check', title: `جاهزين ✦ ${subjects.length} مواد`, text: 'كل مادة إلها دفتر. افتح أي وحدة وابدأ — والجولة بتعرّفك على الباقي.', timeout: 6000 });
      setTimeout(() => Tour.maybe('lib'), 1200);
    }
  },
  // أدوات الدراسة (مراجعة، امتحانات، شبكة): مخفية للكاتب إلا إذا رجّعها من الإعدادات
  study() { const a = Settings.d.app; return a.studyTools != null ? a.studyTools : a.profile !== 'writer'; },
  applyProfile() { document.body.classList.toggle('no-study', !this.study()); },
};
