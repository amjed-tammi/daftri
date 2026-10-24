const SUITE = {
  title: 'تجربة المستخدم — التنقل والنوافذ والكيبورد والعودة للكتاب',
  phases: [async T => {
    const { expect } = T;
    const book = await T.makeBook('تجربة الاستخدام', { htmls: ['<p>أول صفحة</p>', '', '<p>آخر موضع</p>', '', '', ''] });
    await Reader.open(book.id, 0); await T.sleep(600); T.quiet();
    await T.test('الرجوع فور التقليب يحفظ موضع القراءة في بطاقة كمّل', async () => {
      await Reader.turn(1); Reader.close(); await T.sleep(650);
      expect((await DB.get('books', book.id)).lastSpread).toBe(1);
      expect(document.querySelector('.continue-card').textContent).toContain('صفحة 3–4');
      await Reader.open(book.id, 0); await T.sleep(500);
    });
    await T.test('Escape يغلق التأكيد وحده ويرجع للإعدادات', async () => {
      Settings.panel(); await T.sleep(100);
      const confirmation = Modal.confirm('تأكيد تجريبي', 'إغلاق النافذة الداخلية');
      await T.sleep(100); await T.key('Escape', 'Escape'); await T.sleep(300);
      expect(await confirmation).toBe(false);
      expect(document.querySelector('.settings')).toBeTruthy();
      await T.key('Escape', 'Escape'); await T.sleep(300);
    });
    await T.test('Tab يبقى داخل النافذة ويرجع التركيز لزر الفتح بعد إغلاقها', async () => {
      const opener = document.querySelector('#tbPaper'); Bars.show('#topbar'); opener.focus();
      const node = el('<div><h2>نافذة تجربة</h2><input aria-label="نص"><button>تمام</button></div>');
      const m = Modal.open(node); await T.sleep(100);
      const input = node.querySelector('input'), last = node.querySelector('button');
      // أول عنصر بالنافذة (زر «إغلاق» فوق، بعدين الخانة): Tab من آخر عنصر بيرجع لأولها
      const first = node.closest('.modal').querySelector('button, input, [tabindex]');
      last.focus(); await T.key('Tab', 'Tab'); expect(document.activeElement).toBe(first);
      await T.key('Tab', 'Tab', 8); expect(document.activeElement).toBe(last);
      m.close(); await T.sleep(250); expect(document.activeElement).toBe(opener);
    });
    await T.test('نافذة البحث لها زر إغلاق ظاهر واسم واضح', async () => {
      await Finder.open(); await T.sleep(100);
      const dialog = document.querySelector('.finder-modal');
      expect(dialog.getAttribute('role')).toBe('dialog');
      expect(!!(dialog.getAttribute('aria-label') || dialog.getAttribute('aria-labelledby'))).toBeTruthy();
      const close = dialog.querySelector('button[aria-label="إغلاق النافذة"]');
      expect(close && T.inView(close)).toBeTruthy(); close.click(); await T.sleep(250);
    });
    await T.test('قائمة الأدوات تعمل بالأسهم وEnter وEscape يعيد المؤشر', async () => {
      let chosen = '';
      const opener = document.querySelector('#tbMore'); Bars.show('#topbar'); opener.focus();
      Menu.open(opener, [{ label: 'الأول', act: () => chosen = 'first' }, { label: 'مقفل', disabled: true }, { label: 'الثاني', act: () => chosen = 'second' }]);
      await T.sleep(100);
      await T.key('ArrowDown', 'ArrowDown'); await T.key('ArrowDown', 'ArrowDown'); await T.key('Enter', 'Enter');
      expect(chosen).toBe('second'); expect(document.activeElement).toBe(opener);
    });
    await T.test('PageDown داخل حقل الانتقال لا يقلب الكتاب خلف النافذة', async () => {
      Bars.show('#navbar'); document.querySelector('#pgInfo').click(); await T.sleep(100);
      const spread = Reader.s; await T.key('PageDown', 'PageDown'); await T.sleep(800);
      expect(Reader.s).toBe(spread); expect(document.querySelector('.goto')).toBeTruthy();
    });
    await T.test('اختصار الشبكة لا يفتحها خلف نموذج مفتوح', async () => {
      Settings.panel(); await T.sleep(100); await T.key('g', 'KeyG', 2); await T.sleep(500);
      expect(document.querySelector('#iw')).toBeFalsy();
      document.querySelector('#iw [data-a=close]')?.click();
    });
  }],
};
