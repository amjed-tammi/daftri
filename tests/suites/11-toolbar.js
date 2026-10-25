const SUITE = {
  title: 'ترتيب الأدوات: الشريط المجمّع، قائمة ⋯، وكل الأدوات (Ctrl+/)',
  phases: [async T => {
    const { expect } = T;
    const b = await T.makeBook('كتاب الأدوات', { htmls: ['<p>نص</p>', '', '', ''] });

    await T.test('Ctrl+/ بالمكتبة بيفتح «كل الأدوات» وفيه أوامر المكتبة بس', async () => {
      await T.key('/', 'Slash', 2);
      await T.waitFor(() => document.querySelector('.palette'), 2000, 'نافذة كل الأدوات');
      const labels = [...document.querySelectorAll('.pl-item span')].map(s => s.textContent);
      expect(labels).toContain('كتاب جديد');
      expect(labels.includes('طباعة / PDF (كله أو صفحات)'), 'PDF مش لازم يطلع بالمكتبة').toBeFalsy();
      await T.shot('palette-library');
      await T.key('Escape', 'Escape');
    });
    await T.test('جوّا الكتاب: الشريط فيه مجموعات واضحة وأزرار أقل', async () => {
      await Reader.open(b.id, 0); await T.sleep(700); T.quiet();
      Bars.show('#topbar'); await T.sleep(500);
      const n = [...document.querySelectorAll('#topbar button')].filter(x => x.offsetParent).length;
      T.info({ visibleButtons: n });
      expect(n).toBeLessThan(11);
      expect(!!document.querySelector('.tb-cluster #tbIndex') && !!document.querySelector('.tb-cluster #tbWeb')).toBeTruthy();
      expect(!document.querySelector('#tbReview') && !document.querySelector('#tbExam'), 'المراجعة والامتحانات انشالوا').toBeTruthy();
      await T.shot('topbar-grouped');
    });
    await T.test('الشريط ما بيطلع برا الشاشة ولا بيتداخل (1024 و 1366)', async () => {
      for (const [w, h] of [[1024, 700], [1366, 800]]) {
        await T.viewport(w, h); Bars.show('#topbar'); await T.sleep(400);
        const btns = [...document.querySelectorAll('#topbar button')].filter(x => x.offsetParent);
        const out = btns.filter(x => !T.inView(x));
        expect(out.map(x => x.id).join(','), `برا الشاشة على ${w}:`).toBe('');
        const tl = document.querySelector('.tb-title');
        const hit = btns.filter(x => x.id !== 'tbBack' && T.overlap(x, tl));
        expect(hit.map(x => x.id).join(','), `فوق العنوان على ${w}:`).toBe('');
      }
    });
    await T.test('قائمة ⋯ فيها اللي انشال من الشريط (PDF، الغلاف، تسجيل، ملء الشاشة، الجولة)', async () => {
      Bars.show('#topbar'); await T.sleep(400);
      await T.mouse.click('#tbMore');
      await T.waitFor(() => document.querySelector('.menu'));
      const labels = [...document.querySelectorAll('.menu .m-item span')].map(s => s.textContent);
      for (const l of ['كل الأدوات…', 'طباعة / PDF (كله أو صفحات)', 'الغلاف ومعلومات الكتاب', 'تسجيل صوت للصفحة', 'ملء الشاشة', 'الجولة التعريفية']) expect(labels, 'ناقص: ' + l).toContain(l);
      await T.shot('more-menu');
    });
    await T.test('البحث بالأدوات بيفهم عربي و English وبيتجاهل الهمزات', async () => {
      Palette.open(); await T.sleep(250);
      const inp = document.querySelector('.palette input');
      const find = async q => { inp.value = q; inp.dispatchEvent(new Event('input')); await T.sleep(60); return [...document.querySelectorAll('.pl-item span')].map(s => s.textContent); };
      expect(await find('pdf')).toContain('طباعة / PDF (كله أو صفحات)');
      expect(await find('ورقة')).toContain('ورقة ليلة الامتحان: ملخص الكتاب بصفحة وحدة');
      expect(await find('اعدادات')).toContain('الإعدادات العامة');
      expect(await find('focus')).toContain('وضع التركيز');
      expect((await find('zzzz')).length).toBe(0);
      expect(!!document.querySelector('.pl-empty')).toBeTruthy();
    });
    await T.test('أسهم + Enter بيشغّل الأداة، وبتطلع أول وحدة بـ«استعملتها مؤخراً»', async () => {
      Palette.open(); await T.sleep(250);
      const inp = document.querySelector('.palette input'); inp.value = 'تركيز'; inp.dispatchEvent(new Event('input')); inp.focus();
      await T.key('Enter', 'Enter');
      await T.waitFor(() => Study.focus, 2000, 'وضع التركيز اشتغل');
      Study.setFocus(false); await T.sleep(300);
      Palette.open(); await T.sleep(250);
      expect(document.querySelector('.pl-g').textContent).toBe('استعملتها مؤخراً');
      expect(document.querySelector('.pl-item span').textContent).toBe('وضع التركيز');
      await T.shot('palette-recent');
    });
    await T.test('كل أمر بقائمة الأدوات بيشتغل بدون أخطاء', async () => {
      const bad = [];
      for (const c of Cmd.here()) {
        if (['back', 'full', 'pdf', 'tour', 'share', 'mic', 'restore', 'open', 'backup'].includes(c.id)) continue; // بتفتح نافذة نظام أو بتطلع من الكتاب
        try { T.clean(); await T.sleep(80); await c.act(); await T.sleep(350); } catch (e) { bad.push(c.id + ': ' + e.message); }
        if (Study.focus) Study.setFocus(false);
        document.querySelectorAll('#iw, #exam').forEach(x => { if (x.id === 'iw' && typeof IdeaWeb.close === 'function') IdeaWeb.close(); });
      }
      expect(bad.join(' | ')).toBe('');
    });
    await T.test('كل خطوات الجولة إلها هدف موجود بالشريط الجديد', async () => {
      T.clean(); Bars.show('#topbar'); await T.sleep(400);
      const miss = TOURS.book.filter(s => s.el && !s.optional && typeof s.el === 'string' && !document.querySelector(s.el) && !s.el.includes('selbar')).map(s => s.el);
      expect(miss.join(', ')).toBe('');
      expect(TOUR_V >= 5, 'نسخة الجولة').toBeTruthy();
    });
  }],
};
