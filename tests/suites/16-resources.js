/* استهلاك الموارد: كم المعالج والذاكرة شغّالين والتطبيق «قاعد» (لابتوب على بطارية، جهاز قديم) */
const SUITE = {
  title: 'الموارد — خفيف وهو قاعد: معالج، ذاكرة، أنيميشن، تحميل',
  phases: [async T => {
    const { expect } = T;
    const m = async () => Object.fromEntries(((await T.metrics()) || []).map(x => [x.name, x.value]));
    // وقت المعالج المستهلك خلال فترة هدوء (ثواني شغل لكل ثانية)
    const idle = async ms => { const a = await m(); await T.sleep(ms); const b = await m(); return { cpuPct: +(100 * (b.TaskDuration - a.TaskDuration) / (ms / 1000)).toFixed(2), layouts: b.LayoutCount - a.LayoutCount, styles: b.RecalcStyleCount - a.RecalcStyleCount }; };
    const anims = () => document.getAnimations().filter(a => a.playState === 'running').length;
    const scripts = () => performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script');
    const info = {};
    await T.test('المكتبة وهي قاعدة: المعالج تقريباً صفر', async () => {
      await T.sleep(1500);
      const r = await idle(5000);
      Object.assign(info, { libIdle: r, libAnims: anims() });
      T.info({ ...r, runningAnimations: anims() });
      expect(r.cpuPct).toBeLessThan(3);
    });
    await T.test('جوّا كتاب وهو قاعد: المعالج تقريباً صفر', async () => {
      const b = await T.makeBook('موارد', { htmls: ['<p>نص</p>', '', '', ''] });
      await Reader.open(b.id, 0); await T.sleep(1800); T.quiet(); Editor.hideBars && Editor.hideBars();
      const r = await idle(5000);
      Object.assign(info, { bookIdle: r, bookAnims: anims() });
      T.info({ ...r, runningAnimations: anims() });
      expect(r.cpuPct).toBeLessThan(3);
    });
    await T.test('الذاكرة وعدد العناصر معقولين', async () => {
      const x = await m();
      const r = { heapMB: +(x.JSHeapUsedSize / 1048576).toFixed(1), nodes: x.Nodes, listeners: x.JSEventListeners, scriptsKB: Math.round(scripts().reduce((s, e) => s + (e.decodedBodySize || e.transferSize || 0), 0) / 1024), scriptFiles: scripts().length };
      Object.assign(info, r);
      T.info(r);
      expect(r.heapMB).toBeLessThan(40);
    });
    await T.test('وضع توفير البطارية بيوقف كل الأنيميشن المستمر', async () => {
      expect(!!(Settings.d.app && 'lite' in Settings.d.app), 'إعداد الوضع الخفيف').toBeTruthy();
      // منعدّ العناصر اللي فيها ضبابية (backdrop-filter) أو حركة مستمرة (animation) — هدول اللي بياكلوا كرت الشاشة
      Bars.show && Bars.show('#topbar'); Toast.show({ text: 'تجربة', timeout: 4000 }); await T.sleep(400);
      const heavy = () => { let blur = 0, moving = 0; for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e); if (s.backdropFilter && s.backdropFilter !== 'none') blur++; if (s.animationName !== 'none' && s.animationIterationCount === 'infinite') moving++; } return { blur, moving }; };
      const before = heavy();
      Settings.set('lite', true); await T.sleep(300);
      const after = heavy();
      const r = await idle(3000);
      T.info({ before, after, idleInLite: r });
      expect(before.blur + before.moving, 'قبل: لازم يكون في تأثيرات').toBeGreaterThan(0);
      expect(after.blur + after.moving, 'بالوضع الخفيف').toBe(0);
      expect(document.body.classList.contains('lite')).toBeTruthy();
      Settings.set('lite', false);
      expect(document.body.classList.contains('lite')).toBeFalsy();
    });
  }],
};
