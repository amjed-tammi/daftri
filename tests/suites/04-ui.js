const SUITE = {
  title: 'UI — كل زر، كل قائمة، كل جولة، وكل مقاس شاشة',
  phases: [async T => {
    const { expect } = T;
    const b = await T.makeBook('واجهة UI', { htmls: ['<h2>عنوان</h2><p>نص عربي و English text</p>', '<p>صفحة ثانية</p>', '', ''] });
    const openBook = async () => { await Reader.open(b.id, 0); await T.sleep(600); T.quiet(); };
    const showTop = () => { Bars.show('#topbar'); return T.sleep(450); };

    await T.test('أزرار المكتبة: كل زر بيفتح نافذته', async () => {
      const cases = [['#btnNew', '.bookform'], ['#btnSettings', '.settings'], ['#btnLibMore', '.menu'], ['#btnSound', '.music-panel'], ['#btnNight', '.rem-panel']];
      for (const [btn, want] of cases) {
        T.clean(); await T.sleep(150);
        await T.mouse.click(btn);
        await T.waitFor(() => document.querySelector(want), 2500, `${btn} ← ${want}`);
      }
    });
    await T.test('أزرار الشريط العلوي بالكتاب: كل زر بيفتح شي', async () => {
      await openBook();
      const cases = [['#tbIndex', '.toc'], ['#tbWeb', '#iw'], ['#tbSearch', '.finder'], ['#tbInsert', '.menu'], ['#tbPaper', '.paper-panel'], ['#tbMore', '.menu']];
      const bad = [];
      for (const [btn, want] of cases) {
        T.clean(); document.querySelector('#iw [data-a=close]')?.click(); await T.sleep(400);
        await showTop();
        await T.mouse.click(btn);
        try { await T.waitFor(() => document.querySelector(want), 2500); } catch { bad.push(btn); }
        if (typeof Tour !== 'undefined' && Tour.active) Tour.end(false);
      }
      document.querySelector('#iw [data-a=close]')?.click(); await T.sleep(400);
      expect(bad.join(','), 'أزرار ما فتحت:').toBe('');
    });
    await T.test('زر التركيز والعودة للمكتبة', async () => {
      await showTop(); await T.mouse.click('#tbFocus');
      expect(document.body.classList.contains('focus-mode')).toBeTruthy();
      await T.key('Escape', 'Escape');
      await T.waitFor(() => !document.body.classList.contains('focus-mode'), 2000, 'خروج بالـ Esc');
      await showTop(); await T.mouse.click('#tbBack');
      await T.waitFor(() => !document.querySelector('#library').hidden, 2000, 'رجوع للمكتبة');
      await openBook();
    });
    await T.test('قائمة الكليك يمين: كل إدراج بيضيف عنصره', async () => {
      const l = Editor.live.get(0);
      const doMenu = async label => {
        const r = l.pg.getBoundingClientRect();
        l.pg.dispatchEvent(new MouseEvent('contextmenu', { clientX: r.left + 200, clientY: r.top + 300, bubbles: true, cancelable: true }));
        await T.sleep(150);
        const item = [...document.querySelectorAll('.menu .m-item')].find(x => x.textContent.includes(label));
        if (!item) throw new Error('ما لقيت ' + label);
        await T.mouse.click(item); await T.sleep(250);
      };
      await doMenu('صندوق كود'); expect(!!l.c.querySelector('pre.code')).toBeTruthy();
      await doMenu('قائمة مهام'); expect(!!l.c.querySelector('ul.check')).toBeTruthy();
      await doMenu('ملاحظة لاصقة'); expect(l.p.stickies.some(s => s.kind === 'note')).toBeTruthy();
      await doMenu('جدول'); await T.waitFor(() => document.querySelector('.tgrid i'));
      await T.mouse.click('.tgrid i[data-r="2"][data-c="3"]'); await T.sleep(200);
      expect(l.c.querySelectorAll('table tr').length).toBe(2);
      const items = (() => { const r = l.pg.getBoundingClientRect(); l.pg.dispatchEvent(new MouseEvent('contextmenu', { clientX: r.left + 200, clientY: r.top + 300, bubbles: true, cancelable: true })); return document.querySelectorAll('.menu .m-item').length; })();
      T.info({ menuItems: items });
      await T.shot('context-inserts');
    });
    await T.test('شريط التنسيق: عريض، هايلايت، محاذاة، عنوان (ضغطات حقيقية)', async () => {
      const l = Editor.live.get(0);
      const p = [...l.c.querySelectorAll('p')].find(x => x.textContent.includes('English'));
      const sel = () => { const r = document.createRange(); r.selectNodeContents(p); l.c.focus(); Sel.restore(r); };
      sel(); await T.mouse.click('#selbar [data-c=bold]'); expect(!!p.querySelector('b, strong, [style*="font-weight"]')).toBeTruthy();
      sel(); await T.mouse.click('#selbar [data-hl="#fff176"]'); expect(!!p.querySelector('[style*="background-color"]')).toBeTruthy();
      sel(); await T.mouse.click('#selbar [data-al=center]'); expect(p.style.textAlign).toBe('center');
      sel(); await T.mouse.click('#selbar [data-al=auto]'); expect(p.style.textAlign).toBe('');
    });
    await T.test('تقليب بالكيبورد (PageDown/PageUp) وبالسحب بالماوس', async () => {
      document.activeElement.blur(); getSelection().removeAllRanges();
      await T.key('PageDown', 'PageDown'); await T.waitFor(() => !Reader.busy && Reader.s === 1, 3000, 'PageDown');
      await T.key('PageUp', 'PageUp'); await T.waitFor(() => !Reader.busy && Reader.s === 0, 3000, 'PageUp');
      const z = document.querySelector(`.slot.${Reader.fwdSide()} .flipzone`).getBoundingClientRect();
      const spine = document.querySelector('#bookInner').getBoundingClientRect();
      await T.mouse.drag(z.left + z.width / 2, z.top + 300, spine.right - 40, z.top + 300, 16);
      await T.waitFor(() => !Reader.busy && Reader.s === 1, 3000, 'سحب الصفحة');
      // سحبة سريعة قصيرة (فليك) بتقلب مثل الكتاب الحقيقي
      const z2 = document.querySelector(`.slot.${Reader.fwdSide()} .flipzone`).getBoundingClientRect();
      await T.mouse.drag(z2.left + z2.width / 2, z2.top + 300, z2.left + 70, z2.top + 300, 4);
      await T.waitFor(() => !Reader.busy, 3000);
      expect(Reader.s, 'الفليك لازم يقلب').toBe(2);
      await Reader.turn(-1, 0);
    });
    await T.test('اختصارات: Ctrl+F بحث، Ctrl+G شبكة، Esc بيسكّر', async () => {
      document.activeElement.blur();
      await T.key('f', 'KeyF', 2); await T.waitFor(() => document.querySelector('.finder'), 2000, 'Ctrl+F');
      await T.key('Escape', 'Escape'); await T.waitFor(() => !document.querySelector('.finder'), 2000, 'Esc');
      await T.key('g', 'KeyG', 2); await T.waitFor(() => document.querySelector('#iw'), 2000, 'Ctrl+G');
      await T.sleep(600);
      await T.key('Escape', 'Escape'); await T.waitFor(() => !document.querySelector('#iw'), 2000, 'Esc للشبكة');
    });
    await T.test('الاختصارات بتشتغل والكيبورد على العربي (Ctrl+F = Ctrl+ب)', async () => {
      document.activeElement.blur();
      await T.key('ب', 'KeyF', 2); await T.waitFor(() => document.querySelector('.finder'), 2000, 'Ctrl+ب');
      await T.key('Escape', 'Escape'); await T.waitFor(() => !document.querySelector('.finder'), 2000);
    });
    await T.test('مقاسات الشاشة: الكتاب بيعبّي الشاشة وما بيتغطى، وما في سكرول أفقي', async () => {
      const sizes = [[1366, 768], [1920, 1080], [1280, 720], [1024, 700]];
      const res = [];
      for (const [w, h] of sizes) {
        await T.viewport(w, h); await T.sleep(300);
        const bk = document.querySelector('#bookInner').getBoundingClientRect(), sb = document.querySelector('#selbar').getBoundingClientRect();
        expect(bk.left >= 0 && bk.right <= w && bk.top >= 0 && bk.bottom <= h, `${w}x${h} الكتاب برا الشاشة`).toBeTruthy();
        if (!document.querySelector('#selbar').hidden) expect(bk.bottom <= sb.top + 2, `${w}x${h} الكتاب فوق شريط التنسيق`).toBeTruthy();
        expect(document.documentElement.scrollWidth <= w, `${w}x${h} سكرول أفقي`).toBeTruthy();
        res.push(`${w}x${h}: ${Math.round(bk.width / w * 100)}% عرض`);
        await T.shot(`book-${w}x${h}`);
      }
      await T.viewport(1366, 800);
      T.info(res);
    });
    await T.test('الجولتين: كل خطوة إلها هدف موجود، والبطاقة جوّا الشاشة وما بتغطي الهدف', async () => {
      T.allowTour();
      const problems = [];
      for (const name of ['book', 'lib']) {
        if (name === 'lib') { Reader.close(); await T.sleep(400); }
        Tour.start(name);
        for (let i = 0; i < 40 && Tour.active; i++) {
          await T.sleep(650);
          const s = Tour.steps()[Tour.i], card = document.querySelector('.tour-card');
          const tgt = s.center ? null : Tour.target(s);
          if (!s.center && !tgt) problems.push(`${name}#${Tour.i + 1} «${s.title}»: الهدف مش ظاهر`);
          if (!T.inView(card)) problems.push(`${name}#${Tour.i + 1}: البطاقة برا الشاشة`);
          if (tgt) { const r = tgt.getBoundingClientRect(); if (r.width * r.height < innerWidth * innerHeight * .4 && T.overlap(card, tgt)) problems.push(`${name}#${Tour.i + 1} «${s.title}»: البطاقة فوق الهدف`); }
          if (i === 2) await T.shot(`tour-${name}-step3`);
          if (s.last && name === 'lib') { Tour.end(false); break; }
          await T.mouse.click('.tour-card [data-t=next]');
        }
      }
      expect(problems.join('\n')).toBe('');
      T.info({ lib: TOURS.lib.length, book: TOURS.book.length });
    });
  }],
};
