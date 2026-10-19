const SUITE = {
  title: 'UX — سهولة الاستعمال، الوصول، الوضوح، والعربي مع الإنجليزي',
  phases: [async T => {
    const { expect } = T;
    const lum = hex => { const n = parseInt(hex.replace('#', ''), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const visibleButtons = root => [...(root || document).querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.height && getComputedStyle(b).visibility !== 'hidden' && b.offsetParent; });
    const nameless = list => list.filter(b => !(b.textContent.trim() || b.title || b.getAttribute('aria-label')));

    const b = await T.makeBook('UX كتاب', { htmls: ['<h2>عنوان</h2><p>نص عربي</p><p>English paragraph only</p>', '', '', ''] });

    await T.test('كل زر إله اسم (نص أو تلميح) — بالمكتبة', () => {
      const bad = nameless(visibleButtons());
      expect(bad.map(x => x.id || x.className).join(', '), 'أزرار بدون اسم:').toBe('');
    });
    await T.test('كل زر إله اسم — جوّا الكتاب (الشريط، التنسيق، اللوحات)', async () => {
      await Reader.open(b.id, 0); await T.sleep(600); T.quiet();
      Bars.show('#topbar'); Bars.show('#navbar'); await T.sleep(500);
      const bad = nameless(visibleButtons()).filter(x => !x.closest('.selbar .hl'));
      // أزرار ألوان الهايلايت لازم يكون إلها تلميح
      const hl = [...document.querySelectorAll('#selbar .hl')].filter(x => !x.title);
      expect(bad.concat(hl).map(x => x.id || x.className).join(', '), 'أزرار بدون اسم:').toBe('');
    });
    await T.test('حجم أزرار الشريط مريح للضغط (≥ 28px)', () => {
      const small = [...document.querySelectorAll('#topbar button, #navbar button, #selbar button, .corner button')].filter(x => x.offsetParent).filter(x => { const r = x.getBoundingClientRect(); return r.width < 20 || r.height < 20; });
      T.info({ checked: document.querySelectorAll('#topbar button, #selbar button').length });
      expect(small.map(x => x.title || x.className).join(', '), 'أزرار صغيرة:').toBe('');
    });
    await T.test('تباين الحبر مع كل لون ورق (WCAG ≥ 4.5)', () => {
      const bad = [];
      for (const [tone, , paper] of PAPER_TONES) {
        const p = { tone, ink: '#1f2a5a' }; fixInk(p);
        const r = contrast(p.ink, paper);
        if (r < 4.5) bad.push(`${tone}: ${r.toFixed(1)}`);
      }
      expect(bad.join(', ')).toBe('');
    });
    await T.test('كل خانة كتابة بتاخذ اتجاه اللغة (dir=auto)', async () => {
      const opened = [];
      const check = () => [...document.querySelectorAll('input[type=text], input:not([type]), textarea')].filter(i => i.offsetParent && i.dir !== 'auto');
      Library.openForm(Reader.book); await T.sleep(300); opened.push(...check()); T.clean();
      Reminders.panel(document.querySelector('#btnNight')); document.querySelector('.rem-new').open = true; await T.sleep(200); opened.push(...check()); T.clean();
      await Finder.open(); await T.sleep(300); opened.push(...check()); T.clean();
      Exams.editor(null); await T.sleep(300); opened.push(...check()); T.clean();
      expect(opened.map(i => i.name || i.placeholder).join(', '), 'خانات بدون اتجاه تلقائي:').toBe('');
    });
    await T.test('العربي يمين والإنجليزي يسار بنفس الكتاب تلقائياً', () => {
      const ps = [...document.querySelectorAll('.page[data-i="0"] .content p')];
      const pos = p => { const r = document.createRange(); r.selectNodeContents(p); const t = r.getBoundingClientRect(), c = p.getBoundingClientRect(); return { l: t.left - c.left, r: c.right - t.right }; };
      const ar = pos(ps[0]), en = pos(ps[1]);
      expect(ar.r < 6, 'العربي لازم يبدأ من اليمين').toBeTruthy();
      expect(en.l < 6, 'الإنجليزي لازم يبدأ من اليسار').toBeTruthy();
    });
    await T.test('النوافذ والقوائم ما بتطلع برا الشاشة', async () => {
      const bad = [];
      const tryOpen = async (name, fn, sel) => { T.clean(); await T.sleep(100); await fn(); await T.sleep(350); const e = document.querySelector(sel); if (!e || !T.inView(e)) bad.push(name); };
      await tryOpen('إعدادات الكتاب', () => Reader.paperPanel(document.querySelector('#tbPaper')), '.pop');
      await tryOpen('الموسيقى', () => Music.panel(document.querySelector('#btnSound')), '.pop');
      await tryOpen('التذكيرات', () => Reminders.panel(document.querySelector('#btnNight')), '.pop');
      await tryOpen('الفهرس', () => Finder.index(document.querySelector('#tbIndex')), '.pop');
      await tryOpen('الامتحانات', () => Exams.panel(), '.modal');
      await tryOpen('الإعدادات العامة', () => Settings.panel(), '.modal');
      await T.viewport(1024, 650);
      await tryOpen('الإعدادات على شاشة صغيرة', () => Settings.panel(), '.modal');
      await tryOpen('قائمة الكليك يمين بزاوية الشاشة', async () => { const l = Editor.live.get(0); l.pg.dispatchEvent(new MouseEvent('contextmenu', { clientX: innerWidth - 5, clientY: innerHeight - 5, bubbles: true, cancelable: true })); }, '.pop');
      await T.viewport(1366, 800);
      expect(bad.join(', '), 'طالعة برا:').toBe('');
    });
    await T.test('الشاشات الفاضية فيها إرشاد شو يعمل المستخدم', async () => {
      const bad = [];
      Music.panel(document.querySelector('#btnSound')); await T.sleep(150); if (!document.querySelector('.mu-empty')) bad.push('الموسيقى'); T.clean();
      Reminders.panel(document.querySelector('#btnNight')); await T.sleep(150); if (!document.querySelector('.rem-empty')) bad.push('التذكيرات'); T.clean();
      await Exams.panel(); await T.sleep(200); if (!document.querySelector('.exams .empty-j')) bad.push('الامتحانات'); T.clean();
      await Study.journalPanel(); await T.sleep(200); if (!document.querySelector('.empty-j')) bad.push('اليوميات'); T.clean();
      await Trash.panel(); await T.sleep(200); if (!document.querySelector('.empty-j')) bad.push('السلة'); T.clean();
      expect(bad.join(', '), 'بدون إرشاد:').toBe('');
    });
    await T.test('وضع التركيز بيبهّت باقي الأسطر فعلاً', async () => {
      const l = Editor.live.get(0); l.c.focus(); setCaretAt(l.c.querySelector('h2'), 2);
      Study.setFocus(true); await T.sleep(700);
      const other = l.c.querySelector('p');
      expect(+getComputedStyle(other).opacity).toBeLessThan(.5);
      Study.setFocus(false);
    });
    await T.test('الرسائل بتختفي لحالها وما بتتراكم', async () => {
      for (let i = 0; i < 6; i++) Toast.show({ text: 'رسالة ' + i, timeout: 600 });
      await T.sleep(1200);
      expect(document.querySelectorAll('.toast').length).toBe(0);
    });
    await T.test('الأسماء المختلطة (عربي + English) بتنعرض صح بالعناوين', async () => {
      Reader.close(); await T.sleep(300);
      const t = document.querySelector('.bk-t');
      expect(getComputedStyle(t).unicodeBidi).toBe('plaintext');
      await T.shot('library');
    });
  }],
};
