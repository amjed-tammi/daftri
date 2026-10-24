/* موبايل وتابلت: صفحة وحدة بعرض الشاشة، أشرطة باللمس، وما في شي طالع برا */
const SUITE = {
  title: 'موبايل وتابلت — صفحة وحدة، لمس، وكل شي جوّا الشاشة',
  allowTour: true,
  phases: [async T => {
    const { expect } = T;
    await T.viewport(390, 844);
    await T.test('سؤال أول تشغيل جوّا الشاشة على الموبايل', async () => {
      await T.waitFor(() => document.querySelector('.onboard .ob-card'), 4000);
      await T.sleep(400);
      const bad = [...document.querySelectorAll('.onboard .ob-card, .onboard h2')].filter(x => !T.inView(x));
      expect(bad.length, 'طالع برا').toBe(0);
      expect(document.documentElement.scrollWidth).toBeLessThan(innerWidth + 2);
      await T.shot('phone-onboard');
      await T.mouse.click('.ob-card[data-p=notes]');
      await T.waitFor(() => Reader.book, 5000, 'الدفتر انفتح');
      await T.sleep(900); if (Tour.active) Tour.end(false); T.clean();
    });
    await T.test('بالكتاب: صفحة وحدة بعرض الشاشة (مش صفحتين صغار)', async () => {
      expect(document.body.classList.contains('narrow')).toBeTruthy();
      const r = document.querySelector('.page[data-i="0"]').getBoundingClientRect();
      T.info({ pageWidth: Math.round(r.width), screen: innerWidth });
      expect(r.width).toBeGreaterThan(innerWidth * .9);
      expect(r.left > -4 && r.right < innerWidth + 4, 'الصفحة جوّا الشاشة').toBeTruthy();
      await T.shot('phone-page1');
    });
    await T.test('«التالي» بيروح للصفحة الثانية من الفتحة، وبعدها بيقلّب', async () => {
      await Reader.turn(1); await T.sleep(500);
      expect(Reader.half).toBe(1); expect(Reader.s).toBe(0);
      const r2 = document.querySelector('.page[data-i="1"]').getBoundingClientRect();
      expect(r2.left > -4 && r2.right < innerWidth + 4, 'الصفحة الثانية ظاهرة').toBeTruthy();
      await Reader.turn(1); await T.sleep(1100);
      expect(Reader.s).toBe(1); expect(Reader.half).toBe(0);
      await Reader.turn(-1); await T.sleep(1100);
      expect(Reader.s).toBe(0); expect(Reader.half).toBe(1);
    });
    await T.test('لمسة على أعلى الشاشة بتطلّع الأدوات (ما في ماوس)', async () => {
      document.elementFromPoint(200, 20).dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: 200, clientY: 20, bubbles: true }));
      await T.sleep(300);
      expect(document.querySelector('#topbar').classList.contains('show')).toBeTruthy();
      expect(document.documentElement.scrollWidth).toBeLessThan(innerWidth + 2);
      await T.shot('phone-toolbar');
    });
    await T.test('تابلت بالعرض: رجعنا للصفحتين', async () => {
      await T.viewport(1180, 820); await T.sleep(400);
      expect(document.body.classList.contains('narrow')).toBeFalsy();
      await T.viewport(1366, 800);
    });
  }],
};
