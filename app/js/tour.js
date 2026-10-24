'use strict';
/* ============ الجولة التعريفية: تعليم خطوة بخطوة مع إضاءة على كل جزء ============ */
// رقم نسخة الجولة: كل ما انضافت ميزة جديدة بنزيده، والخطوات الجديدة بتاخذ since بنفس الرقم
// (اللي شاف الجولة قبل بيطلعله «شوف الجديد» بالخطوات الجديدة بس)
const TOUR_V = 10;
const TOURS = {
  lib: [
    { title: 'أهلاً فيك بدفتري 🌙', text: 'دفترك الهادئ للكتابة والدراسة: ورق حقيقي بتقلّبه، عربي وإنجليزي مع بعض، أسئلة مراجعة وامتحانات، ومؤقت بيساعدك تركّز. خلّيني آخذك جولة سريعة (دقيقتين).', center: true, first: true },
    { el: '#btnNew', title: 'أنشئ كتاب', text: 'كل مادة أو مشروع إله كتاب. بتختار اسمه (ما بيتكرر)، الغلاف، اتجاهه، ومن «إعدادات الكتاب» بنفس النافذة: الورق والخط والموسيقى والسلسلة — وكلهم بيبدأوا من إعداداتك الافتراضية.', since: 4 },
    { el: '#shelves .shelf .bk, #shelves .empty', title: 'رفوف مكتبتك', text: 'كتبك بتصير هون. لو ربطت كتب كأجزاء سلسلة (الجزء ١، ٢…) بيصيروا على رف خاص. ومن زر «⋯» على أي كتاب: تعديل، مشاركة، نسخة احتياطية، أو حذف (بيروح للسلة 30 يوم).', pad: 10 },
    { el: '#shelves .shelf .bk, #shelves .empty', title: 'من ملف لكتاب 📄', text: 'اسحب ملف Word أو Excel على المكتبة وبيصير كتاب جديد باسمه، بصفحات جاهزة وبنفس تنسيقه.', pad: 10, since: 7 },
    { el: '#btnSubj', title: 'المواد 📚', text: 'رتّب دراستك بمواد: رياضيات، فيزياء، تاريخ… المكتبة بتعرض المواد أول شي، وكل مادة بتفتح على كتبها (وأجزاء السلاسل) وبتضيف كتاب جوّاها بضغطة. كتبك القديمة ما راحت: هي بـ«بدون مادة» وبتنقلها لأي مادة من «تعديل».', since: 6 },
    { el: '#btnCal', title: 'تقويم الدراسة 🗓', text: 'صفحة شهر كاملة: اضغط على أي يوم وضيف شو بدك تدرس (مادة، كتاب أو PDF، والصفحات). الأيام اللي فيها شي مطلوب بتلمع، واليوم بيطلعلك «مطلوب اليوم» بالمكتبة. ولما تخلّص كل مهام اليوم بتنضاف نجمة لسماك ✦', try: 'جرّب تضيف مهمة لبكرة', since: 6 },
    { el: '#btnSubj', title: 'ملفات PDF 📎', text: 'ارفع المحاضرات والسلايدات (أو اسحبها وأفلتها على المكتبة) وبتنحفظ جوّا دفتري، فبتفتحها بدون إنترنت بعارض خفيف. بتربطها بمادة أو بكتاب، وبتقدر تحطها بمهمة بالتقويم.', since: 6 },
    { el: '#btnSettings', title: 'الإعدادات ⚙', text: 'هون بتحدد الافتراضي لكل كتاب جديد: الورق، الخطوط، الحبر، الاتجاه، والموسيقى. وكمان إعدادات التطبيق مثل صوت التقليب وشريط التنسيق.', since: 4 },
    { el: '#btnSettings', title: 'نسخة احتياطية لحالها 🛟', text: 'كتبك محفوظة جوّا المتصفح. من الإعدادات ← «التطبيق» اختار مجلد (مثلاً بـ OneDrive أو Google Drive) وكل يوم بتنحفظ نسخة لحالها. وفي «وضع خفيف» للأجهزة القديمة والبطارية.', since: 8 },
    { el: '#btnSettings', title: 'أوقات الصلاة 🕌', text: 'من الإعدادات ← «التطبيق» شغّل أوقات الصلاة واختار مدينتك: بتشوف الصلاة الجاية وقديش باقي هون بالمكتبة، وبيذكّرك وقت الأذان — وإذا كنت بجلسة دراسة بيعرض يوقّفها لترجع تكمّل من نفس الدقيقة.', since: 10 },
    { el: '#btnLibMore', title: 'دفتري على أي جهاز 📱💻', text: 'من «⋯» ← «ثبّت دفتري كتطبيق»: بيشتغل على ويندوز وماك ولينكس وأندرويد بدون إنترنت، وبيفتح ملفات .daftar بدبل كليك.', since: 8 },
    { el: '#btnLibMore', title: 'قائمة المزيد ⋯', text: 'البحث، يومياتك، فتح كتاب مشارَك (.daftar)، النسخ الاحتياطي، والسلة — مرتبين بمجموعات. وأول شي فيها «كل الأدوات»: Ctrl+/ بأي مكان، اكتب اسم الأداة عربي أو English وبتفتح.', try: 'جرّب Ctrl+/ هلق', since: 5 },
    { el: '#rope .knot', title: 'الحبل = جلسة دراسة', text: 'اسحب الحبل لتحت: كل ما سحبت أكثر زاد الوقت. وقت الجلسة الضوء بيخف حوالين الكتاب، وبآخرها بيسألك «شو تعلمت اليوم؟».', try: 'جرّب تسحبه شوي لتحت 👆', pad: 14 },
    { el: '#btnNight', title: 'تذكيراتك إنت ⏰', text: 'إنت اللي بتعمل تذكيراتك: اشرب مي، قوم تحرّك، راجع فصل… بتختار الأيقونة والوقت، وبتوقف أو بتحذف أي واحد. وفي اقتراحات جاهزة بضغطة.', pad: 8, since: 4 },
    { el: '#btnSound', title: 'موسيقى الخلفية 🎵', text: 'ارفع موسيقاك من جهازك (أغاني، مطر، lo-fi…). ⭐ بتخليها الافتراضية، ولكل كتاب بتقدر تختار موسيقاه وتخليها تشتغل لحالها لما تفتحه.', pad: 8, since: 4 },
    { el: '#sky', title: 'سماؤك بتمتلي نجوم ✦', text: 'كل يوم بتراجع فيه، أو بتخلّص امتحان أو جلسة دراسة، بتنضاف نجمة ذهبية للسماء.', center: true },
    { title: 'يلا نجرّب داخل كتاب', text: 'بنعملك «كتاب تجريبي» فيه أمثلة جاهزة (سؤال مراجعة، كود، ملاحظة لاصقة) وبنكمل الجولة جوّا. بتقدر تحذفه بعدين.', center: true, last: true, cta: 'افتح كتاب تجريبي', act: () => Tour.practiceBook() },
  ],
  book: [
    { title: 'هذا كتابك 📖', text: 'كل كتاب بيفتح على غلافه. تقدر تكتب على الصفحات مباشرة، وكل شي بينحفظ لحاله.', center: true, first: true },
    { el: () => Reader.s < 0 ? $('.coverpg') : $(`.slot.${Reader.fwdSide()} .page`), title: 'التقليب مثل الكتاب الحقيقي', text: 'اسحب طرف الصفحة الخارجي أو اضغط عليه لتقلّب. وبالكيبورد: PageDown و PageUp. ولما تمتلي الصفحة الكلام بيكمل على اللي بعدها لحاله.', try: 'اضغط «التالي» وبقلّبلك الغلاف', next: async () => { if (Reader.s < 0) await Reader.turn(1); } },
    { el: () => $('.page[data-i="0"] .content') || $('.slot .content'), title: 'اكتب عربي و English', text: 'كل سطر بياخذ اتجاهه لحاله، وكل شي بينحفظ تلقائياً.', try: 'كليك يمين على الصفحة = كل الإدراجات (جدول، كود، صور، فيديو، امتحان…)', pad: 8 },
    { el: '#selbar:not([hidden])', title: 'شريط التنسيق', text: 'مثبّت تحت الكتاب: عريض، هايلايت بألوان، عناوين وقوائم، المحاذاة (يمين، وسط، يسار، أو تلقائي حسب لغة السطر — مثلاً تخلي الإنجليزي تحت العربي)، رابط، تسجيل صوت، وزر 🩹 لسؤال المراجعة.', try: 'زر الدبوس 📌 بآخره بيخليه يطلع فوق النص المحدد بس، إذا بتحب هيك', pad: 6 },
    { el: () => $('.slot .sticky'), optional: true, title: 'الملاحظات والصور والفيديو 🗒', text: 'اسحبهم لأي مكان بالصفحة، والنص بيلف حواليهم بدل ما يتغطى. والفيديو صار متل الملاحظة: بتسحبه من شريطه الفوقاني وبتكبّره من زاويته.', try: 'زر ⧉ على العنصر بيخليه فوق النص بدل ما يلف حواليه', pad: 10, since: 4 },
    { el: '#topbar', bar: true, title: 'الأدوات مخفية لحد ما تحتاجها', text: 'قرّب الماوس لأعلى حافة الشاشة وبيطلع هالشريط. ولأسفل الشاشة بيطلع شريط التنقل بين الصفحات.', pad: 6 },
    { el: '.tb-tools', bar: true, title: 'الشريط مرتب بمجموعات', text: 'أول زر «إدراج» للكتابة، بعده مجموعة الدراسة (مراجعة، امتحانات، فهرس، شبكة)، وبالآخر الأدوات السريعة (بحث، تركيز، إعدادات الكتاب، ⋯).', since: 5 },
    { el: '#tbInsert', bar: true, title: 'إدراج', text: 'جدول، صندوق كود ملوّن، قائمة مهام، ملاحظة لاصقة، صور من جهازك كستيكر، فيديو بتحركه بأي مكان، رابط فيديو أو صفحة، تسجيل أو ملف صوتي.' },
    { el: '#tbInsert', bar: true, title: 'ملفات وورد وإكسل وPDF 📄', text: 'اسحب أي ملف Word أو Excel أو CSV على الصفحة وبيتحوّل لصفحات بنفس تنسيقه: العناوين والخط العريض والألوان والجداول والقوائم والصور. والـPDF يا بيضل زي ما هو بعارض، يا بيتحوّل نصه لصفحات. ولما تنسخ جدول من إكسل وتلصقه بيصير جدول حقيقي.', try: 'من «إدراج» ← «ملف Word / Excel / PDF»، أو اسحبه وافلته على الصفحة', since: 7 },
    { el: '#tbPaper', bar: true, title: 'إعدادات هالكتاب ⚙', text: 'الورق والخطوط والحبر، موسيقى الكتاب وإذا بتشتغل لحالها، اتجاه الكتاب، ومشاركته بملف .daftar.', since: 4 },
    { el: '#tbExam', bar: true, title: 'الامتحانات 📝', text: 'كل كتاب إله قسم امتحانات: اختيار من متعدد، وكل سؤال مربوط بصفحته. إذا غلطت بيقلك من أي صفحة السؤال وبيفتحلك ياها، وبترجع تكمّل الامتحان. وبتقدر تعمل امتحان من أي صفحة (كليك يمين) أو تقترح أسئلة من أسئلة المراجعة.', since: 4 },
    { el: '#tbReview', bar: true, title: 'المراجعة والامتحان', text: 'حدّد جواب واضغط 🩹 بيصير سؤال مراجعة. من هون بتبدأ مراجعة اليوم، أو بتشغّل «وضع الامتحان» اللي بيخبّي كل الأجوبة تحت شريط لاصق.' },
    { el: '#tbReview', bar: true, title: 'ورقة ليلة الامتحان 📄', text: 'من «مراجعة» ← «ورقة ليلة الامتحان»: ملخص كتابك بصفحة وحدة — العناوين، اللي ظلّلته، أسئلة المراجعة وأجوبتها، والأسئلة اللي غلطت فيها. بتطبعها أو بتحفظها PDF، أو بتخبّي الأجوبة وبتسمّع لحالك.', since: 9 },
    { el: '#tbIndex', bar: true, title: 'الفهرس', text: 'كل العناوين اللي بتكتبها (زر H) بتظهر هون مع أرقام صفحاتها، وبتنقلك إلها بضغطة.' },
    { el: '#tbWeb', bar: true, title: 'شبكة الأفكار 🕸', text: 'اربط الصفحات اللي فكرتها مرتبطة ببعض (حتى مع كتب نفس السلسلة)، وشوفهم كشبكة عنكبوت. اسحب الخرزة الذهبية من صفحة لصفحة لتربطهم.' },
    { el: '#tbSearch', bar: true, title: 'البحث', text: 'Ctrl+F: دوّر بالكتاب أو بكل الكتب. البحث بيتجاهل التشكيل والهمزات، وبيلوّنلك الكلمة بالصفحة.' },
    { el: '#tbFocus', bar: true, title: 'وضع التركيز', text: 'بيضل السطر اللي بتكتبه واضح والباقي بيبهت. Ctrl+Shift+F أو Esc للخروج.' },
    { el: '#tbMore', bar: true, title: 'المزيد ⋯ وكل الأدوات', text: 'الشغلات اللي ما بتحتاجها كل دقيقة صارت هون حتى يضل الشريط خفيف: PDF (Ctrl+P)، مشاركة الكتاب، الغلاف، تسجيل صوت، ملء الشاشة، والجولة.', try: 'نسيت وين أداة؟ Ctrl+/ واكتب اسمها — وآخر شي استعملته بيطلعلك أول', since: 5 },
    { el: '#tbMore', bar: true, title: 'محاضرات الكتاب وخطته 📎🗓', text: 'من «⋯»: «ملفات PDF لهالكتاب» بتفتحلك المحاضرة جنب دفترك، و«خطّط لهالكتاب بالتقويم» بتحط صفحات بيوم معيّن. وزر «افتح» بالتقويم بيرجعك للكتاب على نفس الصفحة.', since: 6 },
    { el: '#navbar', nav: true, title: 'التنقل', text: 'أسهم للصفحة السابقة والتالية، شريط للقفز السريع، واضغط على رقم الصفحة لتروح لصفحة معيّنة.', pad: 6 },
    { title: 'جاهز ✦', text: 'بالكتاب التجريبي في سؤال مراجعة وكود وملاحظة لاصقة — جرّب عليهم براحتك. وبتقدر تعيد الجولة أي وقت من «⋯» فوق، أو Ctrl+/ واكتب «جولة».', center: true, last: true, cta: 'يلا نبلّش' },
  ],
};

const Tour = {
  active: null, i: 0,
  willRun(name) { return !localStorage.getItem('tour-' + name); },
  seenV(name) { return +localStorage.getItem('tourv-' + name) || 3; },
  maybe(name) {
    if (this.active) return;
    if (this.willRun(name)) { setTimeout(() => { if (!this.active && this.willRun(name)) this.start(name); }, name === 'book' ? 900 : 600); return; }
    // شافها قبل: إذا في خطوات جديدة منعرض «شوف الجديد»
    const v = this.seenV(name), fresh = TOURS[name].filter(s => (s.since || 0) > v);
    if (!fresh.length) return;
    localStorage.setItem('tourv-' + name, TOUR_V);
    setTimeout(() => Toast.show({ icon: 'star', title: 'في ميزات جديدة ✦', text: `  — بدك جولة سريعة عليهم؟`, timeout: 12000, actions: [{ label: 'لاحقاً' }, { label: 'شوف الجديد', primary: true, act: () => this.start(name, v) }] }), 1400);
  },
  start(name, sinceV = 0) {
    this.end(false);
    Pop.close(); Editor.hideBars();
    $$('.toast').forEach(t => t.remove());
    this.active = name; this.i = 0;
    const all = TOURS[name] || [];
    this.list = sinceV ? [{ title: 'الجديد بدفتري ✦', text: 'خلّيني فرجيك الشغلات اللي انضافت من آخر مرة.', center: true, first: true }, ...all.filter(s => (s.since || 0) > sinceV).map(s => ({ ...s, first: false, last: false })), { title: 'هيك خلصنا ✦', text: 'وبتقدر تشوف الجولة كاملة أي وقت من «الإعدادات».', center: true, last: true, cta: 'تمام' }] : all;
    localStorage.setItem('tour-' + name, '1');
    localStorage.setItem('tourv-' + name, TOUR_V);
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
    // بلّش يشتغل (كبس برا البطاقة أو بلّش يكتب)؟ الجولة بتنسحب بهدوء بدل ما تضل بنص الصفحة
    this._out = e => {
      if (!this.active || e.target.closest('.tour-card')) return;
      const s = this.steps()[this.i], t = s && !s.center && this.target(s);
      if (t && t.contains(e.target)) return; // «جرّب» على العنصر المضاء مسموح
      this.dismiss();
    };
    this._type = e => { const a = document.activeElement; if (this.active && a && a.isContentEditable && e.key.length === 1) this.dismiss(); };
    document.addEventListener('pointerdown', this._out, true);
    document.addEventListener('keydown', this._type, true);
    this.show();
  },
  steps() { return this.list || TOURS[this.active] || []; },
  target(s) {
    if (!s.el) return null;
    const t = typeof s.el === 'function' ? s.el() : $(s.el);
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return r.width || r.height ? t : null;
  },
  show() {
    const s = this.steps()[this.i]; if (!s) { this.end(); return; }
    // خطوة اختيارية بدون هدف (مثلاً ما في ملاحظات بهالكتاب): بنتخطاها
    if (s.optional && !this.target(s)) { this.i += this._back ? -1 : 1; this._back = false; this.show(); return; }
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
      if (t === 'skip') this.dismiss();
      else if (t === 'done') this.end();
      else if (t === 'back') { this.i = Math.max(0, this.i - 1); this._back = true; this.show(); }
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
      else {
        // ما في مكان فاضي كامل: منجرّب كذا مكان ومنختار اللي بيغطي أقل شي من الهدف
        const cands = [[(innerWidth - cw) / 2, innerHeight - ch - 16], [(innerWidth - cw) / 2, 16], [16, innerHeight - ch - 16], [innerWidth - cw - 16, innerHeight - ch - 16], [16, 16], [innerWidth - cw - 16, 16], [(r.left + r.right - cw) / 2, r.bottom + g], [(r.left + r.right - cw) / 2, r.top - g - ch]];
        const cover = ([cx, cy]) => { cx = clamp(cx, 8, innerWidth - cw - 8); cy = clamp(cy, 8, innerHeight - ch - 8); return Math.max(0, Math.min(cx + cw, r.right) - Math.max(cx, r.left)) * Math.max(0, Math.min(cy + ch, r.bottom) - Math.max(cy, r.top)); };
        [x, y] = cands.reduce((best, c) => cover(c) < cover(best) ? c : best);
      }
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
    document.removeEventListener('pointerdown', this._out, true);
    document.removeEventListener('keydown', this._type, true);
    removeEventListener('resize', this._rs);
    if (fade) { b.classList.add('out'); setTimeout(() => b.remove(), 300); } else b.remove();
    if (!$('#reader').hidden) { Bars.hideSoon('#topbar'); Bars.hideSoon('#navbar'); }
  },
  // المستخدم سكّر الجولة: ما منرجع نفرض عليه جولة الكتاب، ومنقلّه مرة وحدة وين يلاقيها
  dismiss() {
    const name = this.active; if (!name) return;
    this.end();
    if (name === 'lib') { localStorage.setItem('tour-book', '1'); localStorage.setItem('tourv-book', TOUR_V); }
    if (!localStorage.getItem('tourHint')) {
      localStorage.setItem('tourHint', '1');
      setTimeout(() => Toast.show({ icon: 'help', title: 'الجولة موجودة وقت ما بدك', text: 'من «⋯» ← «الجولة التعريفية»، أو Ctrl+/ واكتب «جولة».', timeout: 5000 }), 350);
    }
  },
  // كتاب تجريبي فيه أمثلة على كل شي
  async practiceBook() {
    let title = 'كتاب تجريبي', k = 2;
    while (Library.titleTaken(title)) title = `كتاب تجريبي ${k++}`;
    const nb = { id: 'k' + uid(), title, author: '', dir: 'rtl', cover: { color: '#1f5c63', image: null }, paper: Settings.newPaper(), series: null, pageIds: [], created: Date.now(), updated: Date.now(), lastSpread: -1 };
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
