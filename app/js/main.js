'use strict';
/* ============ التشغيل ============ */
(async function main() {
  Sky.init();
  Player.init();
  Editor.init();
  Bars.init();
  Ambience.init();
  Study.init();
  Rope.init();
  Reminders.init();

  // أيقونات الأزرار
  $$('[data-ic]').forEach(b => b.insertAdjacentHTML('afterbegin', ic(b.dataset.ic)));

  // المكتبة
  $('#btnNew').onclick = () => Library.openForm();
  $('#btnLibMore').onclick = async e => {
    const t = e.currentTarget, n = await Trash.count();
    Menu.open(t, [
      { icon: 'help', label: 'الجولة التعريفية', act: () => Tour.start('lib') },
      { icon: 'search', label: 'بحث بكل الكتب', hint: 'Ctrl+F', act: () => Finder.open() },
      { icon: 'journal', label: 'يومياتي', act: () => Study.journalPanel() },
      { icon: 'trash', label: 'سلة المحذوفات' + (n ? ` (${n})` : ''), act: () => Trash.panel() },
      '-',
      { icon: 'upload', label: 'استعادة نسخة احتياطية', act: () => Backup.importFile() },
      { icon: 'download', label: 'حفظ نسخة احتياطية لكل المكتبة', act: () => Backup.exportBooks() },
      '-',
      { icon: 'bell', label: 'التذكيرات والمؤقت', act: () => Reminders.panel($('#btnNight')) },
      { icon: 'music', label: 'أصوات الجو', act: () => Ambience.panel($('#btnSound')) },
    ]);
  };
  $('#btnNight').onclick = e => Reminders.panel(e.currentTarget);
  $('#btnSound').onclick = e => Ambience.panel(e.currentTarget);
  $('#streak').onclick = () => Study.journalPanel();

  // شريط الكتاب العلوي
  const curLive = () => Editor.live.get(Editor.curPage) || [...Editor.live.values()][0];
  const fromTop = p => { if (Pop.cur) Pop.cur._from = '#topbar'; return p; };
  $('#tbBack').onclick = () => Reader.close();
  $('#tbIndex').onclick = e => Finder.index(e.currentTarget);
  $('#tbWeb').onclick = () => IdeaWeb.open();
  $('#tbReview').onclick = e => Study.reviewMenu(e.currentTarget);
  $('#tbSearch').onclick = () => Finder.open();
  $('#tbFocus').onclick = () => Study.setFocus(!Study.focus);
  $('#tbEdit').onclick = () => Library.openForm(Reader.book);
  $('#tbPaper').onclick = e => { Reader.paperPanel(e.currentTarget); fromTop(); };
  $('#tbPdf').onclick = () => Exporter.pdf();
  $('#tbHelp').onclick = () => Tour.start('book');
  $('#tbFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
  $('#tbMic').onclick = e => { const l = curLive(); if (!l) { Toast.show({ icon: 'page', text: 'افتح الكتاب أولاً' }); return; } Voice.attachToPage(l); };
  $('#tbInsert').onclick = e => {
    const l = curLive();
    if (!l) { Toast.show({ icon: 'page', text: 'افتح الكتاب أولاً (اسحب الغلاف)' }); return; }
    const saved = Sel.save();
    const at = fn => () => { l.c.focus(); if (saved && l.c.contains(saved.startContainer)) Sel.restore(saved); else Editor.ensureCaret(l); fn(); };
    const r = l.pg.getBoundingClientRect();
    const fake = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 3 };
    Menu.open(e.currentTarget, [
      { head: `إدراج في الصفحة ${l.i + 1}` },
      { icon: 'table', label: 'جدول', act: at(() => Ctx.tablePicker(fake, l)) },
      { icon: 'code', label: 'صندوق كود', act: at(() => Editor.insertCode(l)) },
      { icon: 'check', label: 'قائمة مهام', act: at(() => Editor.insertChecklist(l)) },
      { icon: 'note', label: 'ملاحظة لاصقة', act: () => Stickies.addNote(l) },
      { icon: 'image', label: 'صور من جهازك (ستيكر)', act: async () => { const fs = await pickFile('image/*', true); if (fs.length) Stickies.addPhotos(l, fs); } },
      { icon: 'film', label: 'فيديو قصير', act: at(() => Media2.insertVideo(l)) },
      { icon: 'video', label: 'رابط فيديو/موقع', act: at(() => Links.open(Sel.save(), l)) },
      { icon: 'page', label: 'رابط لصفحة أو كتاب', act: at(() => Links.open(Sel.save(), l, 'page')) },
      { icon: 'mic', label: 'تسجيل صوت للصفحة', act: () => Voice.attachToPage(l) },
      { icon: 'music', label: 'ملف صوتي من جهازك', act: () => AudioFile.attach(l) },
      '-',
      { icon: 'addpage', label: 'إضافة صفحة بعد هذه', act: () => Reader.insertPageAfter(l.i) },
    ]);
    fromTop();
  };

  // شريط التنقل السفلي
  $('#navPrev').onclick = () => Reader.turn(-1);
  $('#navNext').onclick = () => Reader.turn(1);
  $('#pgRange').addEventListener('change', e => { const t = +e.target.value; if (t !== Reader.s) Reader.turn(t > Reader.s ? 1 : -1, t); });
  $('#pgInfo').onclick = e => {
    const f = el(`<form class="panel goto"><label class="fld"><span>اذهب إلى صفحة</span><input class="inp" type="number" min="1" max="${Reader.pages.length}" value="${Math.max(1, 2 * Reader.s + 1)}"></label><button class="btn primary">اذهب</button></form>`);
    f.onsubmit = ev => { ev.preventDefault(); const n = parseInt($('input', f).value, 10); Pop.close(); if (n >= 1) Reader.goToPage(n - 1); };
    Pop.open(e.currentTarget, f, { place: 'above', cls: 'panel-pop' });
    if (Pop.cur) Pop.cur._from = '#navbar';
    setTimeout(() => $('input', f).select(), 20);
  };

  // لوحة المفاتيح
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); Editor.flushAll(); Toast.show({ icon: 'check', text: 'محفوظ ✓ (الحفظ تلقائي دائماً)', timeout: 1500 }); return; }
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); if (!$('.modal-back')) Finder.open(); return; }
    if (mod && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      if (!$('#reader').hidden && Reader.book) Exporter.pdf();
      else Toast.show({ icon: 'pdf', text: 'افتح الكتاب اللي بدك تصدّره، بعدين اضغط PDF أو Ctrl+P', timeout: 3500 });
      return;
    }
    if ($('#reader').hidden || !Reader.book) return;
    if (mod && e.code === 'KeyG') { e.preventDefault(); IdeaWeb.open(); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); Study.setFocus(!Study.focus); return; }
    if (e.key === 'Escape' && Study.focus && !Pop.cur && !$('.modal-back')) { Study.setFocus(false); return; }
    if ($('.modal-back')) return;
    const editing = document.activeElement && (document.activeElement.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
    const rtl = Reader.book.dir === 'rtl';
    let d = 0;
    if (e.key === 'PageDown') d = 1;
    else if (e.key === 'PageUp') d = -1;
    else if ((e.altKey || !editing) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) d = (e.key === 'ArrowLeft') === rtl ? 1 : -1;
    if (d) { e.preventDefault(); Reader.turn(d); }
  });

  addEventListener('resize', debounce(() => Reader.layout(), 80));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { Editor.flushAll(); Reader.saveBook.flush(); } });
  addEventListener('beforeunload', () => { Editor.flushAll(); Reader.saveBook.flush(); });
  addEventListener('error', e => console.warn('خطأ:', e.message));
  addEventListener('unhandledrejection', e => console.warn('خطأ:', e.reason));

  document.body.classList.add('ready');
  try {
    await Promise.race([DB.open(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]);
  } catch (e) {
    document.body.insertAdjacentHTML('beforeend', '<div class="fatal">تعذّر فتح التخزين المحلي. أغلق كل نوافذ دفتري وافتحه من جديد.</div>');
    return;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await IdeaWeb.load().catch(() => {});
  await Library.load();
  Trash.autoPurge().catch(() => {});
  if (!Library.books.length || Tour.willRun('lib')) Tour.maybe('lib'); // جولة الترحيب أول مرة
})();
