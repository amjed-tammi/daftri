const SUITE = {
  title: 'الأداء — خفيف وسريع حتى مع كتاب كبير',
  phases: [async T => {
    const { expect } = T;
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const time = async fn => { const t0 = performance.now(); await fn(); await frame(); return Math.round(performance.now() - t0); };
    const metric = async name => ((await T.metrics()) || []).find(m => m.name === name)?.value || 0;
    // معامل ضغط الجهاز: كم بياخذ «انتظار 720ms من الإطارات» فعلياً. على جهاز مضغوط كل الأرقام بتكبر بنفس النسبة
    const rafLoop = ms => new Promise(r => { const t0 = performance.now(); const st = now => (now - t0 < ms ? requestAnimationFrame(st) : r(performance.now() - t0)); requestAnimationFrame(st); });
    const load = Math.max(1, (await rafLoop(720)) / 720);
    const budget = ms => Math.round(ms * load);
    // كتاب كبير: 40 صفحة مليانة عربي وإنجليزي وكود
    const para = '<p>الشبكات بتنقل البيانات عبر طبقات OSI السبعة، وكل طبقة إلها دور واضح. Networks move data across layers.</p>';
    const htmls = Array.from({ length: 40 }, (_, i) => `<h2>فصل ${i + 1}</h2>${para.repeat(5)}<pre class="code" dir="ltr">const x = ${i};</pre>`);
    const b = await T.makeBook('كتاب كبير', { htmls });

    // الإقلاع بينقسم لقسمين: المتصفح بيقرأ ويترجم ملفات الجافاسكربت (أبطأ أول مرة بس)، وبعدين التطبيق بيجهز نفسه
    const bootInfo = () => {
      const m = performance.getEntriesByName('daftari-booted')[0], nav = performance.getEntriesByType('navigation')[0];
      return m && { appInitMs: Math.round(m.startTime - nav.domInteractive), parseAndScriptsMs: Math.round(nav.domInteractive - nav.responseEnd), totalMs: Math.round(m.startTime - nav.responseEnd) };
    };
    await T.test('الإقلاع الأول: تجهيز التطبيق نفسه (قاعدة البيانات + المكتبة) أقل من 1200ms', () => {
      const r = bootInfo();
      expect(!!r, 'علامة الإقلاع').toBeTruthy();
      T.info({ ...r, budgetMs: budget(1200), machineLoad: +load.toFixed(2), note: 'أول تشغيل بملف تعريف جديد: المتصفح ما عنده نسخة مترجمة من السكربتات' });
      expect(r.appInitMs).toBeLessThan(budget(1200));
    });

    await T.test('فتح كتاب من 40 صفحة بأقل من 1200ms', async () => {
      const open = await time(() => Reader.open(b.id, 0));
      T.quiet();
      T.info({ openMs: open, budgetMs: budget(1200) });
      expect(open).toBeLessThan(budget(1200));
      await T.sleep(1700); // مثل المستخدم: بيطّلع على الصفحة شوي قبل ما يقلّب
    });

    await T.test('تقليب الصفحة: التحضير سريع، والتقليب كامل أقل من 1200ms', async () => {
      // التقليب = تحضير (شغل التطبيق) + أنيميشن 720ms مقصود + رسم المتصفح. منقيس كل واحد لحال
      const anim = Reader.animate; let tA = 0;
      Reader.animate = function (...a) { tA = performance.now(); return anim.apply(this, a); };
      const load2 = Math.max(load, (await rafLoop(720)) / 720); // ضغط الجهاز هلق بالضبط
      const rows = [];
      try {
        for (const dir of [1, 1, 1, 1, -1]) {
          const lf = []; let po = null;
          try { po = new PerformanceObserver(l => lf.push(...l.getEntries())); po.observe({ type: 'long-animation-frame' }); } catch { }
          const t0 = performance.now(); tA = 0;
          await Reader.turn(dir); await frame();
          const t1 = performance.now();
          po && po.disconnect();
          // شغل المتصفح على الخيط الرئيسي (ستايل + تخطيط) — مش وقت الانتظار على كرت الشاشة
          const style = lf.reduce((a, e) => a + (e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0), 0);
          rows.push({ prep: Math.round((tA || t1) - t0), total: Math.round(t1 - t0), styleMs: Math.round(style) });
        }
      } finally { Reader.animate = anim; }
      T.info({ flips: rows, machineLoad: +load2.toFixed(2), budgetMs: Math.round(1200 * load2) });
      expect(Math.max(...rows.map(r => r.prep)), 'أطول تحضير قبل الأنيميشن').toBeLessThan(budget(150));
      expect(Math.max(...rows.map(r => r.styleMs)), 'أطول شغل ستايل/تخطيط بتقليبة').toBeLessThan(budget(200));
      // الرقم الكلي: الوسيط (تقليبة وحدة بطيئة من الجهاز ما بتفشّل)
      const med = rows.map(r => r.total).sort((a, b) => a - b)[2];
      expect(med, 'وسيط زمن التقليب').toBeLessThan(Math.round(1200 * load2));
    });

    await T.test('الكتابة: شغل التطبيق لكل حرف (سكربت + تنسيق + ترتيب) أقل من 8ms', async () => {
      // منقيس شغل المتصفح الفعلي (مش وقت الساعة) حتى ما يأثر ضغط الجهاز ولا رحلة الأمر من الاختبار للمتصفح
      const text = 'Typing test بالعربي والإنجليزي ';
      await Reader.open(b.id, 0); await T.sleep(400); T.quiet();
      const l = Editor.live.get(0); await T.mouse.click(l.c.querySelector('p'));
      const m = async () => Object.fromEntries(((await T.metrics()) || []).map(x => [x.name, x.value]));
      const a = await m();
      for (const ch of text) await T.typeText(ch);
      await frame();
      const z = await m();
      const work = ((z.ScriptDuration - a.ScriptDuration) + (z.RecalcStyleDuration - a.RecalcStyleDuration) + (z.LayoutDuration - a.LayoutDuration)) * 1000;
      const perChar = Math.round(work / text.length * 10) / 10;
      T.info({ perCharMs: perChar, scriptMs: Math.round((z.ScriptDuration - a.ScriptDuration) * 1000), styleMs: Math.round((z.RecalcStyleDuration - a.RecalcStyleDuration) * 1000), layoutMs: Math.round((z.LayoutDuration - a.LayoutDuration) * 1000), styleRecalcs: z.RecalcStyleCount - a.RecalcStyleCount, chars: text.length });
      expect(perChar).toBeLessThan(budget(8));
    });

    await T.test('إعادة توزيع النص على الصفحات (reflow) بأقل من 50ms', async () => {
      const l = Editor.live.get(0);
      const ts = [];
      for (let i = 0; i < 5; i++) { const t0 = performance.now(); Editor.reflow(l, false); ts.push(performance.now() - t0); }
      T.info({ reflowMs: ts.map(x => Math.round(x * 10) / 10) });
      expect(Math.max(...ts)).toBeLessThan(budget(50));
    });

    await T.test('الذاكرة وعدد العناصر ضمن الميزانية', async () => {
      await T.gc();
      const heap = Math.round(await metric('JSHeapUsedSize') / 1048576 * 10) / 10;
      const nodes = document.getElementsByTagName('*').length;
      T.info({ heapMB: heap, domElements: nodes, listeners: await metric('JSEventListeners') });
      expect(heap, 'MB').toBeLessThan(60);
      expect(nodes).toBeLessThan(4000);
      Reader.close(); await T.sleep(300);
    });

    await T.test('البحث بكل الكتب (40 صفحة) أقل من 300ms بعد ما يخلص الكتابة', async () => {
      await Finder.open(); await T.sleep(200);
      const inp = document.querySelector('.finder .inp');
      expect(!!inp, 'خانة البحث').toBeTruthy();
      const t0 = performance.now();
      inp.value = 'طبقات'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await T.waitFor(() => document.querySelectorAll('.finder .f-hit').length, 3000, 'نتائج البحث');
      const ms = Math.round(performance.now() - t0 - 120); // 120ms = انتظار مقصود لحد ما يوقف المستخدم كتابة
      T.info({ searchMs: ms, hits: document.querySelectorAll('.finder .f-hit').length });
      expect(ms).toBeLessThan(budget(300));
    });
  }, async T => {
    // المرحلة الثانية = فتح التطبيق مرة ثانية (مثل ما المستخدم بيفتحه كل يوم)
    const { expect } = T;
    const rafLoop = ms => new Promise(r => { const t0 = performance.now(); const st = now => (now - t0 < ms ? requestAnimationFrame(st) : r(performance.now() - t0)); requestAnimationFrame(st); });
    const load = Math.max(1, (await rafLoop(720)) / 720);
    await T.test('الإقلاع العادي (مش أول مرة): من تحميل الصفحة لحد ما تجهز المكتبة أقل من 1200ms', () => {
      const m = performance.getEntriesByName('daftari-booted')[0], nav = performance.getEntriesByType('navigation')[0];
      const total = Math.round(m.startTime - nav.responseEnd), init = Math.round(m.startTime - nav.domInteractive);
      T.info({ totalMs: total, appInitMs: init, budgetMs: Math.round(1200 * load), machineLoad: +load.toFixed(2) });
      expect(init, 'تجهيز التطبيق').toBeLessThan(Math.round(1200 * load));
      expect(total, 'الإقلاع كامل').toBeLessThan(Math.round(2500 * load));
    });
  }],
};
