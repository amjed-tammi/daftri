'use strict';
/* ============ التشغيل ============ */
(async function main() {
  Settings.load();
  Sky.init();
  Player.init();
  Editor.init();
  Bars.init();
  Music.init();
  Study.init();
  Rope.init();
  Reminders.init();

  // أيقونات الأزرار
  $$('[data-ic]').forEach(b => b.insertAdjacentHTML('afterbegin', ic(b.dataset.ic)));

  // عربي وإنجليزي بكل مكان: أي خانة كتابة بتاخذ اتجاه اللغة اللي بتكتب فيها
  const autoDir = root => $$('input:not([type]), input[type=text], input[type=search], textarea', root).forEach(i => { if (!i.hasAttribute('dir')) i.dir = 'auto'; });
  autoDir(document);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) autoDir(n.matches && n.matches('input,textarea') ? n.parentNode : n); }))).observe(document.body, { childList: true, subtree: true });

  // المكتبة
  $('#btnNew').onclick = () => Library.openForm();
  $('#btnQuick').onclick = () => QuickNote.open();
  $('#btnSubj').onclick = () => Subjects.form();
  $('#btnCal').onclick = () => Cal.open();
  // قائمة «⋯» بالمكتبة: مرتبة بمجموعات، وكل شي من مصدر واحد (Cmd)
  $('#btnLibMore').onclick = async e => {
    const t = e.currentTarget, n = await Trash.count();
    const items = Cmd.menu(['search', 'journal', '-', 'importBook', 'pdfUp', 'open', 'backup', 'restore', 'trash', '-', ...(Pwa.installed() ? [] : ['install']), 'tour', '-', 'report', 'suggest']);
    const tr = items.find(x => x.label === 'سلة المحذوفات'); if (tr && n) tr.label += ` (${n})`;
    Menu.open(t, [{ icon: 'more', label: 'كل الأدوات…', hint: 'Ctrl+/', act: () => Palette.open() }, '-', ...items]);
  };
  $('#btnNight').onclick = e => Reminders.panel(e.currentTarget);
  $('#btnSound').onclick = e => Music.panel(e.currentTarget);
  $('#btnNightLib').onclick = e => Reminders.panel(e.currentTarget);
  $('#btnSoundLib').onclick = e => Music.panel(e.currentTarget);
  $('#studyToggle').onclick = () => {
    const open = document.body.classList.toggle('left-tools-open');
    $('#studyToggle').setAttribute('aria-expanded', String(open));
    $('#studyToggle').setAttribute('aria-label', open ? 'أغلق أدوات الكتاب والدراسة' : 'افتح أدوات الكتاب والدراسة');
    $('#studyToggle').title = open ? 'أغلق أدوات الكتاب والدراسة' : 'افتح أدوات الكتاب والدراسة';
    if (!open) Pop.close();
  };
  $('#toolToggle').onclick = () => {
    if (!Editor.docked()) Editor.setDock(true);
    const open = document.body.classList.toggle('tools-open');
    $('#toolToggle').setAttribute('aria-expanded', String(open));
    $('#toolToggle').setAttribute('aria-label', open ? 'أغلق أدوات الكتابة' : 'افتح أدوات الكتابة');
    $('#toolToggle').title = open ? 'أغلق أدوات الكتابة' : 'افتح أدوات الكتابة';
  };
  $('#stage').addEventListener('wheel', e => {
    if (e.ctrlKey) { e.preventDefault(); Reader.setZoom(Reader.zoom * Math.exp(-e.deltaY * .0015)); return; }
    if (Reader.zoom <= 1) return;
    e.preventDefault();
    Reader.panX -= (e.shiftKey ? e.deltaY : e.deltaX);
    Reader.panY -= e.shiftKey ? 0 : e.deltaY;
    Reader.layout();
  }, { passive: false });
  let spacePan = false, dragPan = null, pendingSpace = null;
  const stopPan = () => { dragPan = null; document.body.classList.remove('space-dragging'); };
  const releaseSpace = () => {
    spacePan = false; stopPan(); document.body.classList.remove('space-panning');
    const pending = pendingSpace; pendingSpace = null;
    if (!pending || !pending.el.isConnected || document.activeElement !== pending.el) return;
    Sel.restore(pending.range);
    document.execCommand('insertText', false, ' ');
  };
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.ctrlKey || e.altKey || e.metaKey || $('#reader').hidden || Reader.zoom <= 1 || $('.modal-back') || Pop.cur) return;
    const active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(active.tagName)) return;
    if (active && active.isContentEditable && !active.closest('#reader')) return;
    if (active && active.isContentEditable && !spacePan) pendingSpace = { el: active, range: Sel.save() };
    e.preventDefault(); spacePan = true; document.body.classList.add('space-panning');
  });
  // أي نقرة مع المسطرة هي محاولة تحريك/تحديد، فلا نضيف بعدها مسافة داخل النص.
  document.addEventListener('pointerdown', () => { if (spacePan) pendingSpace = null; }, true);
  document.addEventListener('keyup', e => { if (e.code === 'Space') releaseSpace(); });
  addEventListener('blur', () => { pendingSpace = null; releaseSpace(); });
  const stage = $('#stage');
  stage.addEventListener('pointerdown', e => {
    if (!spacePan || e.button !== 0 || Reader.zoom <= 1) return;
    e.preventDefault(); e.stopPropagation();
    pendingSpace = null;
    dragPan = { x: e.clientX, y: e.clientY, panX: Reader.panX, panY: Reader.panY };
    stage.setPointerCapture(e.pointerId);
    document.body.classList.add('space-dragging');
  }, true);
  stage.addEventListener('pointermove', e => {
    if (!dragPan) return;
    Reader.panX = dragPan.panX + e.clientX - dragPan.x;
    Reader.panY = dragPan.panY + e.clientY - dragPan.y;
    Reader.layout();
  });
  stage.addEventListener('pointerup', stopPan);
  stage.addEventListener('pointercancel', stopPan);
  $('#sessionDial').onclick = () => Rope.menu();
  const viewer = $('#imageViewer');
  const closeImage = () => { viewer.hidden = true; $('img', viewer).removeAttribute('src'); };
  $('#imageViewerClose').onclick = closeImage;
  viewer.onclick = e => { if (e.target === viewer) closeImage(); };
  document.addEventListener('click', e => {
    const img = e.target.closest && e.target.closest('#reader .sticky.photo img, #reader .content img, #reader .pg-bg');
    if (!img || !img.src || !viewer.hidden) return;
    if (e.target.closest('.sticky.photo') && e.detail !== 2) return;
    $('img', viewer).src = img.src; viewer.hidden = false; $('#imageViewerClose').focus();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !viewer.hidden) { closeImage(); e.stopImmediatePropagation(); } }, true);
  $('#btnSettings').onclick = () => Settings.panel();
  $('#streak').onclick = () => Study.journalPanel();

  // شريط الكتاب العلوي
  const curLive = () => Editor.live.get(Editor.curPage) || [...Editor.live.values()][0];
  const fromRail = () => { if (Pop.cur) Pop.cur._from = '#studyRail'; };
  $('#tbBack').onclick = () => Reader.close();
  $('#tbInfo').onclick = e => {
    const b = Reader.book; if (!b) return;
    const series = Library.seriesOf(b);
    Menu.open(e.currentTarget, [
      { head: b.title },
      ...(b.author ? [{ head: b.author }] : []),
      { head: `${Reader.pages.length} صفحة` },
      ...(series.length > 1 ? ['-', ...series.map(part => ({ icon: 'series', label: `${part.id === b.id ? '✓ ' : ''}الجزء ${part.series.part} · ${part.title}`, act: () => Reader.open(part.id) }))] : []),
      '-', { icon: 'books', label: 'العودة للمكتبة', act: () => Reader.close() },
    ]);
  };
  $('#tbIndex').onclick = e => Finder.index(e.currentTarget);
  $('#tbWeb').onclick = () => IdeaWeb.open();
  $('#tbSearch').onclick = () => Finder.open();
  $('#tbFocus').onclick = () => Study.setFocus(!Study.focus);
  $('#tbPaper').onclick = e => { Reader.paperPanel(e.currentTarget); fromRail(); };
  // «⋯»: الشغلات اللي ما بنحتاجها كل دقيقة، حتى يضل الشريط خفيف
  $('#tbMore').onclick = e => {
    Menu.open(e.currentTarget, [
      { icon: 'more', label: 'كل الأدوات…', hint: 'Ctrl+/', act: () => Palette.open() },
      '-',
      ...Cmd.menu(['sheet', 'pdf', 'share', 'edit', 'mic', 'addpage', '-', 'pdfs', 'planBook', 'cal', 'journal', '-', 'full', 'tour', 'report']),
    ]);
    fromRail();
  };
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
      { icon: 'math', label: 'معادلة (½ x² √)', hint: 'Alt+=', act: at(() => MathEq.open(l)) },
      { icon: 'check', label: 'قائمة مهام', act: at(() => Editor.insertChecklist(l)) },
      { icon: 'note', label: 'ملاحظة لاصقة', act: () => Stickies.addNote(l) },
      { icon: 'image', label: 'صوّر السبورة أو ورقة (كاميرا)', act: () => Camera.shoot(l) },
      { icon: 'image', label: 'صور من جهازك (ستيكر)', act: async () => { const fs = await pickFile('image/*', true); if (fs.length) Stickies.addPhotos(l, fs); } },
      { icon: 'film', label: 'فيديو قصير', act: at(() => Media2.insertVideo(l)) },
      { icon: 'video', label: 'رابط فيديو/موقع', act: at(() => Links.open(Sel.save(), l)) },
      { icon: 'page', label: 'رابط لصفحة أو كتاب', act: at(() => Links.open(Sel.save(), l, 'page')) },
      { icon: 'mic', label: 'تسجيل صوت للصفحة', act: () => Voice.attachToPage(l) },
      { icon: 'music', label: 'ملف صوتي من جهازك', act: () => AudioFile.attach(l) },
      { icon: 'upload', label: 'ملف Word / Excel / PDF / CSV…', act: () => Importer.pick(l) },
      '-',
      { icon: 'addpage', label: 'إضافة صفحة بعد هذه', act: () => Reader.insertPageAfter(l.i) },
    ]);
    fromRail();
  };

  // شريط التنقل السفلي
  $('#navPrev').onclick = () => Reader.turn(-1);
  $('#navNext').onclick = () => Reader.turn(1);
  $('#pgRange').addEventListener('change', e => { const t = +e.target.value; if (t !== Reader.s) Reader.turn(t > Reader.s ? 1 : -1, t); });
  $('#pgInfo').onclick = e => {
    const f = el(`<form class="panel goto"><label class="fld"><span>اذهب إلى صفحة</span><input class="inp" type="text" dir="auto" inputmode="numeric" required value="${Math.max(1, 2 * Reader.s + 1)}"></label><button class="btn primary">اذهب</button></form>`);
    const input = $('input', f);
    input.oninput = () => input.setCustomValidity('');
    f.onsubmit = ev => {
      ev.preventDefault();
      const raw = latinDigits(input.value).trim(), n = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n < 1 || n > Reader.pages.length) {
        input.setCustomValidity(`اكتب رقم صفحة من 1 إلى ${Reader.pages.length} (مثلاً 2 أو ٢)`);
        input.reportValidity(); return;
      }
      Pop.close(); Reader.goToPage(n - 1);
    };
    Pop.open(e.currentTarget, f, { place: 'above', cls: 'panel-pop' });
    if (Pop.cur) Pop.cur._from = '#navbar';
    setTimeout(() => $('input', f).select(), 20);
  };

  // لوحة المفاتيح
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    // لا ننفّذ أوامر الكتاب خلف نافذة أو قائمة مفتوحة.
    if (e.defaultPrevented || $('.modal-back') || Pop.cur || Tour.active) return;
    if (mod && e.code === 'Slash') { e.preventDefault(); Palette.open(); return; }
    if (e.altKey && !mod && e.code === 'Equal' && !$('#reader').hidden && Reader.book) { e.preventDefault(); if (!$('.modal-back')) MathEq.open(curLive()); return; }
    if (e.altKey && !mod && e.code === 'KeyN') { e.preventDefault(); if (!$('.modal-back')) QuickNote.open(); return; }
    if (mod && e.code === 'KeyS') { e.preventDefault(); Editor.flushAll(); Toast.show({ icon: 'check', text: 'محفوظ ✓ (الحفظ تلقائي دائماً)', timeout: 1500 }); return; }
    if (mod && !e.shiftKey && e.code === 'KeyF') { e.preventDefault(); if (!$('.modal-back')) Finder.open(); return; }
    if (mod && e.code === 'KeyP') {
      e.preventDefault();
      if (!$('#reader').hidden && Reader.book) { if (!$('.modal-back')) Exporter.choose(); }
      else Toast.show({ icon: 'pdf', text: 'افتح الكتاب اللي بدك تصدّره، بعدين اضغط PDF أو Ctrl+P', timeout: 3500 });
      return;
    }
    if (e.key === 'Enter' && !$('#library').hidden && !$('.modal-back') && !Pop.cur && !Tour.active && (!document.activeElement || document.activeElement === document.body)) { const cc = $('.continue-card'); if (cc) { e.preventDefault(); cc.click(); } return; }
    if ($('#reader').hidden || !Reader.book) return;
    if (mod && e.code === 'KeyG') { e.preventDefault(); IdeaWeb.open(); return; }
    if (mod && e.shiftKey && e.code === 'KeyF') { e.preventDefault(); Study.setFocus(!Study.focus); return; }
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
  Share.wireDrop();
  Share.inbox().catch(e => console.warn(e));
  Pwa.init();
  // منظّف اللصق وقارئ الملفات: بنحمّله بهدوء بعد ما التطبيق يرتاح، فأول لصق بيكون فوري
  setTimeout(() => { const go = () => Lazy.need('importer').catch(() => {}); if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 4000 }); else go(); }, 6000);
  AutoBackup.init();
  Prayer.init();
  AppInfo.init();
  Onboard.applyProfile();
  // أول مرة: سؤال «شو بتعمل؟» بيجهّز المواد والدفاتر. وبعدها جولة الترحيب، أو «شوف الجديد» بعد كل إضافة
  if (Onboard.should()) Onboard.open(); else Tour.maybe('lib');
  setTimeout(() => { if ($('#reader').hidden) Cal.nudge(); }, 1800); // «مطلوب اليوم» مرة باليوم
  performance.mark('daftari-booted');
  document.body.dataset.booted = '1';
})();
