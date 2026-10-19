'use strict';
/* ============ الجولة التعريفية: تعليم خطوة بخطوة مع إضاءة على كل جزء ============ */
const TOURS = {
  lib: [
    { title: 'أهلاً فيك بدفتري 🌙', text: 'دفترك الهادئ للكتابة والدراسة: ورق حقيقي بتقلّبه، عربي وإنجليزي مع بعض، أسئلة مراجعة، ومؤقت بيساعدك تركّز. خلّيني آخذك جولة سريعة (دقيقتين).', center: true, first: true },
    { el: '#btnNew', title: 'أنشئ كتاب', text: 'كل مادة أو مشروع إله كتاب. بتختار اسمه (ما بيتكرر)، لون الغلاف أو صورة من جهازك، نوع الورق، واتجاهه: يفتح من اليمين للعربي أو من اليسار للإنجليزي.' },
    { el: '#shelves .shelf, #shelves .empty', title: 'رفوف مكتبتك', text: 'كتبك بتصير هون. لو ربطت كتب كأجزاء سلسلة (الجزء ١، ٢…) بيصيروا على رف خاص. ومن زر «⋯» على أي كتاب: تعديل، نسخة احتياطية، أو حذف (بيروح للسلة 30 يوم).', pad: 10 },
    { el: '#btnLibMore', title: 'قائمة المزيد', text: 'هون البحث بكل الكتب (Ctrl+F)، يومياتك، سلة المحذوفات، والنسخ الاحتياطي لكل المكتبة.' },
    { el: '#rope .knot', title: 'الحبل = جلسة دراسة', text: 'اسحب الحبل لتحت: كل ما سحبت أكثر زاد الوقت. وقت الجلسة الضوء بيخف حوالين الكتاب، وبآخرها بيسألك «شو تعلمت اليوم؟».', try: 'جرّب تسحبه شوي لتحت 👆', pad: 14 },
    { el: '#btnNight', title: 'تذكير المي والحركة', text: 'بيذكّرك تشرب مي وتقوم تتحرك كل فترة بتختارها. بتقدر توقفه أو تغيّر وقته من هون.', pad: 8 },
    { el: '#btnSound', title: 'أصوات الجو', text: 'مطر، موج، مدفأة، ريح، ليل… أو أي صوت من جهازك. بتتحكم بالصوت وبتقدر تخليه يشتغل لحاله مع جلسة الدراسة.', pad: 8 },
    { el: '#sky', title: 'سماؤك بتمتلي نجوم ✦', text: 'كل يوم بتراجع فيه أو بتخلّص جلسة دراسة بتنضاف نجمة ذهبية للسماء. وعدد الأيام بيبيّن تحت جنب الجرس.', center: true },
    { title: 'يلا نجرّب داخل كتاب', text: 'بنعملك «كتاب تجريبي» فيه أمثلة جاهزة (سؤال مراجعة، كود، ملاحظة لاصقة) وبنكمل الجولة جوّا. بتقدر تحذفه بعدين.', center: true, last: true, cta: 'افتح كتاب تجريبي', act: () => Tour.practiceBook() },
  ],
  book: [
    { title: 'هذا كتابك 📖', text: 'كل كتاب بيفتح على غلافه. تقدر تكتب على الصفحات مباشرة، وكل شي بينحفظ لحاله.', center: true, first: true },
    { el: () => Reader.s < 0 ? $('.coverpg') : $(`.slot.${Reader.fwdSide()} .page`), title: 'التقليب مثل الكتاب الحقيقي', text: 'اسحب طرف الصفحة الخارجي أو اضغط عليه لتقلّب. وبالكيبورد: PageDown و PageUp. ولما تمتلي الصفحة الكلام بيكمل على اللي بعدها لحاله.', try: 'اضغط «التالي» وبقلّبلك الغلاف', next: async () => { if (Reader.s < 0) await Reader.turn(1); } },
    { el: () => $('.page[data-i="0"] .content') || $('.slot .content'), title: 'اكتب عربي و English', text: 'كل سطر بياخذ اتجاهه لحاله، وكل شي بينحفظ تلقائياً.', try: 'كليك يمين على الصفحة = كل الإدراجات (جدول، كود، صور، فيديو…)', pad: 8 },
    { el: '#selbar:not([hidden])', title: 'شريط التنسيق', text: 'مثبّت تحت الكتاب: عريض، هايلايت بألوان، عناوين وقوائم، المحاذاة (يمين، وسط، يسار، أو تلقائي حسب لغة السطر — مثلاً تخلي الإنجليزي تحت العربي)، رابط، تسجيل صوت، وزر 🩹 لسؤال المراجعة.', try: 'زر الدبوس 📌 بآخره بيخليه يطلع فوق النص المحدد بس، إذا بتحب هيك', pad: 6 },
    { el: '#topbar', bar: true, title: 'الأدوات مخفية لحد ما تحتاجها', text: 'قرّب الماوس لأعلى حافة الشاشة وبيطلع هالشريط. ولأسفل الشاشة بيطلع شريط التنقل بين الصفحات.', pad: 6 },
    { el: '#tbInsert', bar: true, title: 'إدراج', text: 'جدول، صندوق كود ملوّن، قائمة مهام، ملاحظة لاصقة، صور من جهازك كستيكر، فيديو قصير، رابط فيديو أو صفحة، تسجيل أو ملف صوتي.' },
    { el: '#tbPaper', bar: true, title: 'الورق والخط', text: 'مسطّر، مربعات، نقاط، كورنيل أو سادة، ولون الورق والمسافة بين السطور. ومن هون بتختار خط عربي وخط إنجليزي كل واحد لحاله.' },
    { el: '#tbReview', bar: true, title: 'المراجعة والامتحان', text: 'حدّد جواب واضغط 🩹 بيصير سؤال مراجعة. من هون بتبدأ مراجعة اليوم، أو بتشغّل «وضع الامتحان» اللي بيخبّي كل الأجوبة تحت شريط لاصق.' },
    { el: '#tbIndex', bar: true, title: 'الفهرس', text: 'كل العناوين اللي بتكتبها (زر H) بتظهر هون مع أرقام صفحاتها، وبتنقلك إلها بضغطة.' },
    { el: '#tbWeb', bar: true, title: 'شبكة الأفكار 🕸', text: 'اربط الصفحات اللي فكرتها مرتبطة ببعض (حتى مع كتب نفس السلسلة)، وشوفهم كشبكة عنكبوت. اضغط على أي صفحة بالشبكة وبتفوت عليها بزوم. وكل صفحة إلها شارة 🕸 تحت بتربطها منها.' },
    { el: '#tbSearch', bar: true, title: 'البحث', text: 'Ctrl+F: دوّر بالكتاب أو بكل الكتب. البحث بيتجاهل التشكيل والهمزات، وبيلوّنلك الكلمة بالصفحة.' },
    { el: '#tbFocus', bar: true, title: 'وضع التركيز', text: 'بيضل السطر اللي بتكتبه واضح والباقي بيبهت. Ctrl+Shift+F أو Esc للخروج.' },
    { el: '#tbPdf', bar: true, title: 'PDF', text: 'لما تخلص، صدّر الكتاب PDF (أو Ctrl+P) واختار «Save as PDF». الروابط بتضل شغّالة.' },
    { el: '#navbar', nav: true, title: 'التنقل', text: 'أسهم للصفحة السابقة والتالية، شريط للقفز السريع، واضغط على رقم الصفحة لتروح لصفحة معيّنة.', pad: 6 },
    { title: 'جاهز ✦', text: 'بالكتاب التجريبي في سؤال مراجعة وكود وملاحظة لاصقة — جرّب عليهم براحتك. وبتقدر تعيد الجولة أي وقت من زر «؟» فوق أو من قائمة «⋯» بالمكتبة.', center: true, last: true, cta: 'يلا نبلّش' },
  ],
};

const Tour = {
  active: null, i: 0,
  willRun(name) { return !localStorage.getItem('tour-' + name); },
  maybe(name) { if (this.willRun(name) && !this.active) setTimeout(() => { if (!this.active) this.start(name); }, name === 'book' ? 900 : 600); },
  start(name) {
    this.end(false);
    Pop.close(); Editor.hideBars();
    $$('.toast').forEach(t => t.remove());
    this.active = name; this.i = 0;
    localStorage.setItem('tour-' + name, '1');
    this.box = el(`<div id="tour"><div class="tour-hole"></div><div class="tour-card" role="dialog" aria-live="polite"></div></div>`);
    document.body.append(this.box);
    this._key = e => {
      const a = document.activeElement;
      const typing = a && (a.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(a.tagName));
      if (e.key === 'Escape') { e.stopPropagation(); this.end(); }
      else if (e.key === 'Enter' && !typing && !$('.modal-back')) { e.preventDefault(); this.next(); }
    };
    this._rs = debounce(() => this.place(), 100);
    document.addEventListener('keydown', this._key, true);
    addEventListener('resize', this._rs);
    this.show();
  },
  steps() { return TOURS[this.active] || []; },
  target(s) {
    if (!s.el) return null;
    const t = typeof s.el === 'function' ? s.el() : $(s.el);
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return r.width || r.height ? t : null;
  },
  show() {
    const s = this.steps()[this.i]; if (!s) { this.end(); return; }
    if (s.bar) Bars.show('#topbar'); else if (!s.nav) $('#topbar') && $('#topbar').classList.remove('show');
    if (s.nav) Bars.show('#navbar'); else $('#navbar') && $('#navbar').classList.remove('show');
    const n = this.steps().length;
    const card = $('.tour-card', this.box);
    card.classList.remove('in');
    card.innerHTML = `
      <div class="tc-top"><span class="tc-n">${this.i + 1} من ${n}</span><button class="tc-x" data-t="skip" title="إنهاء الجولة">${ic('x')}</button></div>
      <h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>
      ${s.try ? `<div class="tc-try">💡 ${esc(s.try)}</div>` : ''}
      <div class="tc-dots">${Array.from({ length: n }, (_, k) => `<i class="${k === this.i ? 'on' : k < this.i ? 'done' : ''}"></i>`).join('')}</div>
      <div class="tc-acts">
        ${s.first ? '<button class="btn ghost sm" data-t="skip">تخطّي</button>' : '<button class="btn ghost sm" data-t="back">السابق</button>'}
        ${s.last && s.act ? '<button class="btn ghost sm" data-t="done">إنهاء</button>' : ''}
        <button class="btn primary sm" data-t="next">${esc(s.cta || (s.first ? 'ابدأ الجولة' : s.last ? 'تمام' : 'التالي'))}</button>
      </div>`;
    card.onclick = e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const t = b.dataset.t;
      if (t === 'skip' || t === 'done') this.end();
      else if (t === 'back') { this.i = Math.max(0, this.i - 1); this.show(); }
      else this.next();
    };
    requestAnimationFrame(() => { this.place(); requestAnimationFrame(() => card.classList.add('in')); });
    // الهدف ممكن يكون عم يتحرك (شريط عم ينزل أو صفحة عم تتقلب) فنلحقه لحد ما يثبت
    clearInterval(this._follow);
    let k = 0;
    this._follow = setInterval(() => { this.place(); if (++k > 12) clearInterval(this._follow); }, 120);
  },
  async next() {
    const s = this.steps()[this.i];
    if (this._busy) return;
    this._busy = true;
    try { if (s && s.next) await s.next(); } finally { this._busy = false; }
    if (s && s.last) { const act = s.act; this.end(); if (act) act(); return; }
    this.i++;
    this.show();
  },
  place() {
    if (!this.active) return;
    const s = this.steps()[this.i]; if (!s) return;
    const hole = $('.tour-hole', this.box), card = $('.tour-card', this.box);
    const t = s.center ? null : this.target(s);
    const pad = s.pad != null ? s.pad : 6;
    let r = null;
    if (t) {
      const b = t.getBoundingClientRect();
      r = { left: Math.max(4, b.left - pad), top: Math.max(4, b.top - pad), right: Math.min(innerWidth - 4, b.right + pad), bottom: Math.min(innerHeight - 4, b.bottom + pad) };
      Object.assign(hole.style, { left: r.left + 'px', top: r.top + 'px', width: r.right - r.left + 'px', height: r.bottom - r.top + 'px', opacity: 1 });
    } else Object.assign(hole.style, { left: innerWidth / 2 + 'px', top: innerHeight / 2 + 'px', width: '0px', height: '0px', opacity: 1 });
    const cw = card.offsetWidth, ch = card.offsetHeight, g = 16;
    let x, y;
    if (!r) { x = (innerWidth - cw) / 2; y = (innerHeight - ch) / 2; }
    else {
      const big = (r.bottom - r.top) > innerHeight * .55;
      if (!big && r.bottom + g + ch < innerHeight - 8) { y = r.bottom + g; x = (r.left + r.right) / 2 - cw / 2; }
      else if (!big && r.top - g - ch > 8) { y = r.top - g - ch; x = (r.left + r.right) / 2 - cw / 2; }
      else if (r.left - g - cw > 8) { x = r.left - g - cw; y = (r.top + r.bottom) / 2 - ch / 2; }
      else if (r.right + g + cw < innerWidth - 8) { x = r.right + g; y = (r.top + r.bottom) / 2 - ch / 2; }
      else { x = (innerWidth - cw) / 2; y = innerHeight - ch - 24; }
    }
    card.style.left = clamp(x, 8, innerWidth - cw - 8) + 'px';
    card.style.top = clamp(y, 8, innerHeight - ch - 8) + 'px';
  },
  end(fade = true) {
    if (!this.box) { this.active = null; return; }
    const b = this.box;
    this.box = null; this.active = null;
    clearInterval(this._follow);
    document.removeEventListener('keydown', this._key, true);
    removeEventListener('resize', this._rs);
    if (fade) { b.classList.add('out'); setTimeout(() => b.remove(), 300); } else b.remove();
    if (!$('#reader').hidden) { Bars.hideSoon('#topbar'); Bars.hideSoon('#navbar'); }
  },
  // كتاب تجريبي فيه أمثلة على كل شي
  async practiceBook() {
    let title = 'كتاب تجريبي', k = 2;
    while (Library.titleTaken(title)) title = `كتاب تجريبي ${k++}`;
    const nb = { id: 'k' + uid(), title, author: '', dir: 'rtl', cover: { color: '#1f5c63', image: null }, paper: { ...PAPER_DEFAULT }, series: null, pageIds: [], created: Date.now(), updated: Date.now(), lastSpread: -1 };
    const cid = 'c' + uid();
    const cb = '<span class="cb" contenteditable="false"></span>';
    const htmls = [
      `<h2>أهلاً بدفترك ✦</h2><p>هاد كتاب للتجربة، اكتب فيه وغيّر براحتك واحذفه وقت ما بدك.</p><p>Arabic و English بنفس السطر؟ عادي، كل سطر بياخذ اتجاهه.</p><h3>سؤال مراجعة</h3><p>شو يعني HTML؟ الجواب: <span class="ans" data-card="${cid}">لغة لبناء هيكل صفحات الويب</span></p><ul class="check"><li>${cb}اقلب الصفحة بسحب طرفها</li><li>${cb}حدّد كلمة وجرّب الهايلايت</li><li>${cb}كليك يمين على الصفحة</li><li>${cb}اسحب الحبل وابدأ جلسة</li></ul>`,
      `<h2>صندوق كود</h2><pre class="code" dir="ltr" spellcheck="false">${highlightCode("const name = 'دفتري';\nconsole.log(`Hello ${name}`);")}</pre><p>الصق أي كود وبيتعرف عليه لحاله وبيلوّنه.</p><h3>جدول صغير</h3><table class="tbl"><tbody><tr><th>المفهوم</th><th>مثال</th></tr><tr><td>متغير</td><td>let x = 5</td></tr><tr><td>دالة</td><td>function f() {}</td></tr></tbody></table>`,
      '', '',
    ];
    const pages = htmls.map((html, i) => ({ id: 'p' + uid(), bookId: nb.id, html, stickies: i === 1 ? [{ id: uid(), kind: 'note', w: 200, x: 340, y: 560, rot: -2.5, color: '#fff1a1', text: 'أنا ملاحظة لاصقة 🙂 اسحبني من الشريط اللي فوق' }] : [], attach: [] }));
    pages.forEach(p => nb.pageIds.push(p.id));
    await DB.putMany('pages', pages);
    await DB.put('books', nb);
    await DB.put('cards', { id: cid, bookId: nb.id, level: 0, due: Date.now(), created: Date.now(), reviews: 0 });
    await Library.load();
    localStorage.removeItem('tour-book');
    Reader.open(nb.id);
  },
};
