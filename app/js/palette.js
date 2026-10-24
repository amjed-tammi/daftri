'use strict';
/* ============ كل الأدوات: مكان واحد لكل أوامر التطبيق (Ctrl+/) ============ */
// مصدر واحد للأوامر: قائمة «⋯» بالشريط ونافذة «كل الأدوات» بياخذوا من هون
// ctx: book = جوّا الكتاب بس، lib = بالمكتبة بس، any = بكل مكان
const Cmd = {
  // نضغط زر الشريط نفسه (بعد ما نطلّعه) حتى تفتح نوافذه بمكانها الطبيعي
  tb(id) { return () => { Bars.show('#topbar'); setTimeout(() => { const b = $(id); if (b) b.click(); }, 200); }; },
  live() { return Editor.live.get(Editor.curPage) || [...Editor.live.values()][0]; },
  list() {
    const L = () => this.live();
    const need = fn => () => { const l = L(); if (!l) { Toast.show({ icon: 'page', text: 'افتح الكتاب أولاً (اسحب الغلاف)' }); return; } fn(l); };
    return [
      // الكتابة
      { id: 'insert', g: 'كتابة', icon: 'plus', label: 'إدراج…', en: 'insert add', ctx: 'book', act: this.tb('#tbInsert') },
      { id: 'note', g: 'كتابة', icon: 'note', label: 'ملاحظة لاصقة', en: 'sticky note', ctx: 'book', act: need(l => Stickies.addNote(l)) },
      { id: 'code', g: 'كتابة', icon: 'code', label: 'صندوق كود', en: 'code snippet', ctx: 'book', act: need(l => { l.c.focus(); Editor.ensureCaret(l); Editor.insertCode(l); }) },
      { id: 'mic', g: 'كتابة', icon: 'mic', label: 'تسجيل صوت للصفحة', en: 'record voice audio', ctx: 'book', act: need(l => Voice.attachToPage(l)) },
      { id: 'import', g: 'كتابة', icon: 'upload', label: 'استيراد ملف Word / Excel / PDF', en: 'import word excel pdf docx xlsx csv file', ctx: 'book', act: need(l => Importer.pick(l)) },
      { id: 'addpage', g: 'كتابة', icon: 'addpage', label: 'إضافة صفحة بعد هذه', en: 'add page', ctx: 'book', act: need(l => Reader.insertPageAfter(l.i)) },
      // الدراسة
      { id: 'review', g: 'دراسة', icon: 'cards', label: 'ابدأ مراجعة اليوم', en: 'review flashcards', ctx: 'book', act: () => Study.startReview() },
      { id: 'examMode', g: 'دراسة', icon: 'tape', label: 'وضع الامتحان: خبّي الأجوبة', en: 'exam mode hide answers', ctx: 'book', act: () => Study.setExam(!Study.exam) },
      { id: 'sheet', g: 'دراسة', icon: 'page', label: 'ورقة ليلة الامتحان: ملخص الكتاب بصفحة وحدة', en: 'summary cheat sheet exam night print review', ctx: 'book', act: () => Sheet.open() },
      { id: 'exams', g: 'دراسة', icon: 'exam', label: 'امتحانات هالكتاب', en: 'exams quiz test', ctx: 'book', act: () => Exams.panel() },
      { id: 'index', g: 'دراسة', icon: 'list', label: 'الفهرس', en: 'index contents toc', ctx: 'book', act: this.tb('#tbIndex') },
      { id: 'web', g: 'دراسة', icon: 'web', label: 'شبكة الأفكار', en: 'idea web links graph', hint: 'Ctrl+G', ctx: 'book', act: () => IdeaWeb.open() },
      { id: 'focus', g: 'دراسة', icon: 'focus', label: 'وضع التركيز', en: 'focus mode', hint: 'Ctrl+Shift+F', ctx: 'book', act: () => Study.setFocus(!Study.focus) },
      { id: 'cal', g: 'دراسة', icon: 'calendar', label: 'تقويم الدراسة', en: 'calendar plan schedule today study', ctx: 'any', act: () => Cal.open() },
      { id: 'planBook', g: 'دراسة', icon: 'calendar', label: 'خطّط لهالكتاب بالتقويم', en: 'plan book calendar schedule', ctx: 'book', act: () => Cal.open({ bookId: Reader.book.id }) },
      { id: 'journal', g: 'دراسة', icon: 'journal', label: 'يومياتي', en: 'journal diary', ctx: 'any', act: () => Study.journalPanel() },
      // الكتاب
      { id: 'paper', g: 'الكتاب', icon: 'sliders', label: 'إعدادات هالكتاب (ورق، خط، موسيقى)', en: 'book settings paper font', ctx: 'book', act: this.tb('#tbPaper') },
      { id: 'edit', g: 'الكتاب', icon: 'edit', label: 'الغلاف ومعلومات الكتاب', en: 'cover title edit', ctx: 'book', act: () => Library.openForm(Reader.book) },
      { id: 'pdf', g: 'الكتاب', icon: 'pdf', label: 'تصدير PDF', en: 'pdf export print', hint: 'Ctrl+P', ctx: 'book', act: () => Exporter.pdf() },
      { id: 'share', g: 'الكتاب', icon: 'share', label: 'مشاركة الكتاب (.daftar)', en: 'share export', ctx: 'book', act: () => Share.exportBook(Reader.book.id) },
      { id: 'pdfs', g: 'الكتاب', icon: 'attach', label: 'ملفات PDF لهالكتاب', en: 'pdf files attachments lecture slides', ctx: 'book', act: () => Files.panel({ bookId: Reader.book.id }) },
      { id: 'back', g: 'الكتاب', icon: 'books', label: 'رجوع للمكتبة', en: 'library back close', ctx: 'book', act: () => Reader.close() },
      // المكتبة
      { id: 'new', g: 'المكتبة', icon: 'plus', label: 'كتاب جديد', en: 'new book create', ctx: 'lib', act: () => Library.openForm() },
      { id: 'subject', g: 'المكتبة', icon: 'folder', label: 'مادة جديدة', en: 'new subject course folder', ctx: 'lib', act: () => Subjects.form() },
      { id: 'importBook', g: 'المكتبة', icon: 'upload', label: 'كتاب جديد من ملف Word / Excel', en: 'import new book from word excel docx xlsx csv', ctx: 'lib', act: () => Importer.pickBook() },
      { id: 'pdfUp', g: 'المكتبة', icon: 'attach', label: 'رفع ملف PDF (محاضرة، سلايدات)', en: 'upload pdf lecture slides attach', ctx: 'lib', act: () => Files.upload({ subjectId: Library.cur || NO_SUBJECT }) },
      { id: 'open', g: 'المكتبة', icon: 'share', label: 'فتح كتاب مشارَك (.daftar)', en: 'open import shared', ctx: 'lib', act: () => Share.pick() },
      { id: 'trash', g: 'المكتبة', icon: 'trash', label: 'سلة المحذوفات', en: 'trash deleted restore', ctx: 'lib', act: () => Trash.panel() },
      { id: 'backup', g: 'المكتبة', icon: 'download', label: 'حفظ نسخة احتياطية لكل المكتبة', en: 'backup save', ctx: 'lib', act: () => Backup.exportBooks() },
      { id: 'restore', g: 'المكتبة', icon: 'upload', label: 'استعادة نسخة احتياطية', en: 'restore backup import', ctx: 'lib', act: () => Backup.importFile() },
      // عام
      { id: 'search', g: 'عام', icon: 'search', label: 'بحث', en: 'search find', hint: 'Ctrl+F', ctx: 'any', act: () => Finder.open() },
      { id: 'music', g: 'عام', icon: 'music', label: 'موسيقى الخلفية', en: 'music sound', ctx: 'any', act: () => Music.panel($('#btnSound')) },
      { id: 'remind', g: 'عام', icon: 'bell', label: 'التذكيرات', en: 'reminders alarm water', ctx: 'any', act: () => Reminders.panel($('#btnNight')) },
      { id: 'settings', g: 'عام', icon: 'gear', label: 'الإعدادات العامة', en: 'settings preferences defaults', ctx: 'any', act: () => Settings.panel() },
      { id: 'full', g: 'عام', icon: 'full', label: 'ملء الشاشة', en: 'fullscreen', ctx: 'any', act: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } },
      { id: 'prayer', g: 'عام', icon: 'moon', label: 'أوقات الصلاة', en: 'prayer times salah adhan', ctx: 'any', act: () => { if (Settings.d.prayer.on && Prayer.times()) { const c = $('.pr-chip'); if (c) Prayer.panel(c); else Settings.panel('app'); } else { Settings.panel('app'); setTimeout(() => $('.pr-block')?.scrollIntoView({ block: 'center' }), 250); } } },
      { id: 'install', g: 'عام', icon: 'download', label: 'ثبّت دفتري كتطبيق (يشتغل بدون إنترنت)', en: 'install app pwa offline desktop mobile', ctx: 'any', act: () => Pwa.install() },
      { id: 'tour', g: 'عام', icon: 'help', label: 'الجولة التعريفية', en: 'tour help guide', ctx: 'any', act: () => Tour.start(this.inBook() ? 'book' : 'lib') },
    ];
  },
  inBook() { return !$('#reader').hidden && !!Reader.book; },
  here() { const b = this.inBook(); return this.list().filter(c => c.ctx === 'any' || (c.ctx === 'book') === b); },
  get(id) { return this.list().find(c => c.id === id); },
  run(c) {
    if (!c) return;
    try {
      const r = JSON.parse(localStorage.getItem('cmd-recent') || '[]').filter(x => x !== c.id);
      localStorage.setItem('cmd-recent', JSON.stringify([c.id, ...r].slice(0, 5)));
    } catch { }
    c.act();
  },
  recent() { try { return JSON.parse(localStorage.getItem('cmd-recent') || '[]'); } catch { return []; } },
  // عناصر قائمة «⋯» من نفس المصدر
  menu(ids) { return ids.map(id => id === '-' ? '-' : (c => c && { icon: c.icon, label: c.label, hint: c.hint, act: () => this.run(c) })(this.get(id))).filter(Boolean); },
};

const Palette = {
  open() {
    if ($('.modal-back.in .palette')) return; // اللي عم تتسكّر ما بتمنع نفتح وحدة جديدة
    Pop.close();
    const all = Cmd.here(), rec = Cmd.recent();
    const n = el(`<div class="palette">
      <div class="pl-search">${ic('search')}<input type="text" dir="auto" placeholder="شو بدك تعمل؟ اكتب عربي أو English…" aria-label="ابحث عن أداة"><kbd>Esc</kbd></div>
      <div class="pl-list" role="listbox"></div>
      <div class="pl-foot"><span><kbd>↑</kbd><kbd>↓</kbd> تنقّل</span><span><kbd>Enter</kbd> تشغيل</span><span><kbd>Ctrl</kbd>+<kbd>/</kbd> بأي وقت</span></div></div>`);
    const m = Modal.open(n, { cls: 'palette-modal' });
    const inp = $('input', n), list = $('.pl-list', n);
    let shown = [], k = 0;
    const draw = () => {
      const q = normMap(inp.value.trim()).n;
      let groups;
      if (!q) {
        const r = rec.map(id => all.find(c => c.id === id)).filter(Boolean);
        groups = [];
        if (r.length) groups.push(['استعملتها مؤخراً', r]);
        const by = {}; all.filter(c => !r.includes(c)).forEach(c => (by[c.g] = by[c.g] || []).push(c));
        Object.entries(by).forEach(e => groups.push(e));
      } else {
        const hit = all.filter(c => normMap(c.label + ' ' + c.en + ' ' + c.g).n.includes(q));
        groups = hit.length ? [['النتائج', hit]] : [];
      }
      shown = groups.flatMap(g => g[1]);
      k = Math.min(k, Math.max(0, shown.length - 1));
      let i = 0;
      list.innerHTML = groups.length ? groups.map(([g, cs]) => `<div class="pl-g">${esc(g)}</div>` + cs.map(c => `<button class="pl-item${i === k ? ' on' : ''}" data-i="${i++}" role="option">${ic(c.icon)}<span dir="auto">${esc(c.label)}</span>${c.hint ? `<kbd>${esc(c.hint)}</kbd>` : ''}</button>`).join('')).join('')
        : '<div class="pl-empty">ما لقيت أداة بهالاسم — جرّب كلمة ثانية</div>';
      const on = $('.pl-item.on', list); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    const go = i => { const c = shown[i]; if (!c) return; m.close(); setTimeout(() => Cmd.run(c), 60); };
    inp.addEventListener('input', () => { k = 0; draw(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); k = (k + 1) % Math.max(1, shown.length); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); k = (k - 1 + shown.length) % Math.max(1, shown.length); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(k); }
    });
    list.addEventListener('mousedown', e => e.preventDefault());
    list.addEventListener('click', e => { const b = e.target.closest('.pl-item'); if (b) go(+b.dataset.i); });
    draw();
    setTimeout(() => inp.focus(), 30);
  },
};
