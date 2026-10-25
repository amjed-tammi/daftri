'use strict';
/* ============ ملاحظة سريعة، وصوّر السبورة ============ */

// ملاحظة سريعة: فكرة أو واجب خطر عبالك — بتنحفظ بدفتر «مسودات» مع الوقت، وبترتّبها بعدين
const QuickNote = {
  TITLE: 'مسودات',
  open() {
    const n = el(`<form class="qn" autocomplete="off">
      <div class="jf-head">${ic('edit')}<div><h3>ملاحظة سريعة ✎</h3><p class="muted">اكتب وخلص — بتنحفظ بدفتر «${this.TITLE}» مع الوقت، وبترتّبها بعدين.</p></div></div>
      <textarea class="inp" rows="5" dir="auto" placeholder="فكرة، واجب، سؤال بدي أسأله للأستاذ…" aria-label="الملاحظة"></textarea>
      <div class="row end"><span class="muted sm qn-k">Ctrl+Enter للحفظ</span><button type="button" class="btn ghost" data-a="cancel">إلغاء</button><button class="btn primary">${ic('check')} احفظ</button></div></form>`);
    const m = Modal.open(n, { cls: 'sm' });
    const ta = $('textarea', n);
    setTimeout(() => ta.focus(), 60);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); n.requestSubmit(); } });
    $('[data-a=cancel]', n).onclick = () => m.close();
    n.onsubmit = async e => {
      e.preventDefault();
      const t = ta.value.trim(); if (!t) { ta.focus(); return; }
      m.close();
      const { book, i } = await this.save(t);
      Toast.show({ icon: 'check', title: 'انحفظت بالمسودات ✓', text: t.length > 60 ? t.slice(0, 60) + '…' : t, timeout: 4500, actions: [{ label: 'افتح المسودات', primary: true, act: () => (Reader.book && Reader.book.id === book.id ? Reader.goToPage(i) : Reader.open(book.id, i)) }] });
    };
  },
  // دفتر المسودات (بينعمل أول مرة)
  async book() {
    let b = (await DB.all('books')).find(x => x.drafts);
    if (b) return b;
    let title = this.TITLE, k = 2;
    while (Library.titleTaken(title)) title = `${this.TITLE} ${k++}`;
    b = { id: 'k' + uid(), drafts: true, subjectId: NO_SUBJECT, title, author: '', dir: Settings.d.dir, cover: { color: '#4a2c5e', image: null }, paper: Settings.newPaper(), series: null, music: { track: 'default', auto: null }, pageIds: [], created: Date.now(), updated: Date.now(), lastSpread: -1 };
    const pages = [0, 1, 2, 3].map(() => ({ id: 'p' + uid(), bookId: b.id, html: '', stickies: [], attach: [] }));
    pages.forEach(p => b.pageIds.push(p.id));
    await DB.putMany('pages', pages); await DB.put('books', b);
    return b;
  },
  // بنضيفها لآخر صفحة فيها مكان (والصفحة بتتوزّع لحالها لما تنفتح لو طفحت)
  async save(text) {
    const b = await this.book();
    const open = Reader.book && Reader.book.id === b.id;
    if (open) Editor.flushAll();
    const pages = open ? Reader.pages : (await DB.getMany('pages', b.pageIds)).map((p, i) => p || { id: b.pageIds[i], bookId: b.id, html: '', stickies: [], attach: [] });
    const used = p => htmlText(p.html || '').trim().length;
    let i = pages.length - 1; while (i > 0 && !used(pages[i])) i--;
    if (used(pages[i]) > 700) i++;
    if (i >= pages.length) {
      const extra = [0, 1].map(() => ({ id: 'p' + uid(), bookId: b.id, html: '', stickies: [], attach: [] }));
      extra.forEach(p => { pages.push(p); if (!open) b.pageIds.push(p.id); });
      if (open) Reader.book.pageIds.push(...extra.map(p => p.id));
      await DB.putMany('pages', extra);
    }
    const when = new Date().toLocaleString('ar', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
    const html = `<h3>✎ ${esc(when)}</h3>` + text.split(/\n+/).map(x => `<p>${esc(x)}</p>`).join('');
    const p = pages[i];
    p.html = (p.html || '') + html;
    await DB.put('pages', p);
    const book = open ? Reader.book : b;
    book.updated = Date.now();
    await DB.put('books', book);
    if (open) Reader.render(); else if (!$('#library').hidden) Library.load();
    return { book, i };
  },
};

// صوّر السبورة أو ورقة الأستاذ: الموبايل بيفتح الكاميرا مباشرة، والكمبيوتر بيفتح كاميرا اللابتوب بنافذة
const Camera = {
  async shoot(l) {
    if (!l) { Toast.show({ icon: 'page', text: 'افتح الكتاب أولاً' }); return; }
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return this.native(l);
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } }); }
    catch { return this.native(l); } // ما في كاميرا أو ما سمح: منختار صورة من الجهاز
    const n = el(`<div class="cam">
      <div class="cam-view"><video autoplay playsinline muted></video><div class="cam-flash"></div></div>
      <div class="row end"><span class="muted sm">صوّر السبورة أو الورقة، وبتنحط بالصفحة ${l.i + 1}</span><button class="btn ghost" data-a="close">إلغاء</button><button class="btn primary cam-snap" data-a="snap">${ic('image')} صوّر</button></div></div>`);
    const v = $('video', n);
    v.srcObject = stream;
    const stop = () => stream.getTracks().forEach(t => t.stop());
    const m = Modal.open(n, { cls: 'wide cam-modal', onClose: stop });
    n.onclick = async e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'close') { m.close(); return; }
      if (!v.videoWidth) return;
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      $('.cam-flash', n).classList.add('on');
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
      m.close();
      await this.place(l, new File([blob], 'صورة.jpg', { type: 'image/jpeg' }));
    };
  },
  native(l) {
    return new Promise(res => {
      const i = document.createElement('input');
      i.type = 'file'; i.accept = 'image/*'; i.setAttribute('capture', 'environment');
      i.onchange = async () => { if (i.files[0]) await this.place(l, i.files[0]); res(); };
      i.oncancel = () => res();
      i.click();
    });
  },
  // صورة السبورة بتنحط كبيرة (بتقدر تصغّرها وتحركها)
  async place(l, file) {
    await Stickies.addPhotos(l, [file], null, 380);
    Toast.show({ icon: 'image', text: 'انحطت الصورة بالصفحة ✓ — اسحبها لأي مكان وكبّرها من زاويتها', timeout: 3500 });
  },
};
