'use strict';
/* ============ المكتبة: إنشاء الكتب والسلاسل ============ */
const PAPER_DEFAULT = { style: 'lined', tone: 'cream', lh: 32, line: 'auto', margin: true, font: 'hand', fs: 19, ink: '#1f2a5a' };
const COVER_COLORS = [
  ['#1d2b53', 'كحلي'], ['#6b1e2e', 'خمري'], ['#2f4a3a', 'زيتي'], ['#6a4325', 'بني'],
  ['#1b1b1f', 'أسود'], ['#1f5c63', 'فيروزي'], ['#4a2c5e', 'بنفسجي'], ['#d9c7a3', 'بيج'],
];
const PAPER_STYLES = [['lined', 'مسطّر'], ['grid', 'مربعات'], ['dots', 'نقاط'], ['cornell', 'كورنيل'], ['blank', 'سادة']];
const PAPER_TONES = [['white', 'أبيض', '#fdfcf8'], ['cream', 'كريمي', '#f7f0dd'], ['aged', 'قديم', '#ecdcb6'], ['kraft', 'كرافت', '#d6ba8c'], ['legal', 'أصفر', '#fbf3a8'], ['black', 'أسود', '#17191f']];
// الورق الأسود بدّه حبر فاتح، والفاتح بدّه حبر غامق
function fixInk(paper) {
  const dark = paper.tone === 'black', inkLight = isLight(paper.ink || '#1f2a5a');
  if (dark && !inkLight) paper.ink = '#f4f1e8';
  else if (!dark && inkLight) paper.ink = '#1f2a5a';
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function coverHTML(b) {
  const c = b.cover || { color: '#1d2b53' };
  const part = b.series && b.series.name ? `<div class="cv-part"><small>الجزء</small><b>${esc(b.series.part)}</b></div>` : '';
  return `<div class="cover ${isLight(c.color) ? 'light' : ''} ${c.image ? 'has-img' : ''}" style="--cv:${c.color}">
    ${c.image ? `<img class="cv-img" data-blob="${c.image}" alt="" draggable="false">` : ''}
    <div class="cv-tex"></div><div class="cv-frame"></div>
    <div class="cv-text">
      ${b.series && b.series.name ? `<div class="cv-series">${esc(b.series.name)}</div>` : ''}
      <div class="cv-title">${esc(b.title || 'بدون عنوان')}</div>
      ${b.author ? `<div class="cv-author">${esc(b.author)}</div>` : ''}
    </div>${part}</div>`;
}

function ago(t) {
  const d = Math.floor((Date.now() - t) / 864e5);
  if (d <= 0) return 'اليوم';
  if (d === 1) return 'أمس';
  if (d < 30) return `قبل ${d} يوم`;
  return new Date(t).toLocaleDateString('ar');
}

const Library = {
  books: [], subjects: [], files: [],
  cur: null, // المادة المفتوحة (null = الصفحة الرئيسية: المواد أولاً)
  async load() {
    const [books, subjects, files] = await Promise.all([DB.all('books'), DB.all('subjects'), DB.all('files'), Cal.load()]);
    this.books = books || []; this.files = files || [];
    this.subjects = (subjects || []).filter(x => !x.sys).sort((a, b) => a.created - b.created);
    this.render();
  },
  // مادة الكتاب (أو «بدون مادة» إذا ما إله مادة أو مادته انحذفت/جاي من جهاز ثاني)
  sid(x) { const s = x && x.subjectId; return s && this.subjects.some(o => o.id === s) ? s : NO_SUBJECT; },
  subject(id) { return this.subjects.find(s => s.id === id) || null; },
  subjectName(id) { const s = this.subject(id); return s ? s.name : 'بدون مادة'; },
  subjectOptions(sel) { return [`<option value="${NO_SUBJECT}">بدون مادة</option>`, ...this.subjects.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`)].join(''); },
  seriesNames() {
    const m = new Map();
    this.books.forEach(b => { if (b.series && b.series.name) m.set(normTitle(b.series.name), b.series.name); });
    return [...m.values()];
  },
  seriesOf(b) {
    if (!b.series || !b.series.name) return [];
    const k = normTitle(b.series.name);
    return this.books.filter(x => x.series && normTitle(x.series.name) === k).sort((a, c) => a.series.part - c.series.part);
  },
  // «كمّل من وين وقفت»: آخر كتاب فتحته وعلى أي صفحة، بضغطة وحدة
  continueCard() {
    const b = this.books.filter(x => x.opened).sort((a, c) => c.opened - a.opened)[0];
    if (!b) return null;
    const s = b.lastSpread != null ? b.lastSpread : -1;
    const where = s < 0 ? 'على الغلاف' : `صفحة ${2 * s + 1}–${2 * s + 2}`;
    const c = el(`<button class="continue-card" data-id="${b.id}" title="كمّل (Enter)">
      <span class="cc-cover" style="--cv:${esc((b.cover && b.cover.color) || '#1d2b53')}"></span>
      <span class="cc-txt"><small>كمّل من وين وقفت</small><b dir="auto">${esc(b.title)}</b><span>${where} · ${esc(ago(b.opened))}</span></span>
      <span class="cc-go">${ic('open')} كمّل</span></button>`);
    c.onclick = () => Reader.open(b.id);
    return c;
  },
  render() {
    const box = $('#shelves');
    box.innerHTML = '';
    Cal.badge();
    if (this.cur && !this.subject(this.cur)) this.cur = null;
    if (!this.books.length && !this.subjects.length) {
      const e = el(`<div class="empty">
        <div class="empty-book">${coverHTML({ title: 'كتابك الأول', cover: { color: '#1d2b53' } })}</div>
        <h2>المكتبة فاضية… والليل طويل</h2>
        <p>أنشئ أول كتاب، اختر غلافه وورقه، وابدأ الكتابة. أو رتّب دراستك بمواد (رياضيات، فيزياء…) وحط كتب كل مادة جوّاها.</p>
        <div class="row"><button class="btn primary lg" data-a="book">${ic('plus')} أنشئ أول كتاب</button><button class="btn ghost lg" data-a="subj">${ic('folder')} ابدأ بمادة</button></div></div>`);
      $('[data-a=book]', e).onclick = () => this.openForm();
      $('[data-a=subj]', e).onclick = () => Subjects.form();
      box.append(e);
      Files.shelf(box, NO_SUBJECT);
      return;
    }
    const strip = Cal.strip(); if (strip) box.append(strip);
    if (!this.cur) { const cc = this.continueCard(); if (cc) box.append(cc); }
    const sid = this.cur || NO_SUBJECT;
    if (this.cur) box.append(Subjects.head(this.subject(this.cur)));
    else if (this.subjects.length) box.append(Subjects.grid());
    const list = this.books.filter(b => this.sid(b) === sid);
    if (this.cur && !list.length) {
      const e = el(`<div class="subj-empty"><p>ما في كتب بهالمادة لسا. ضيف دفتر للمحاضرات، أو ارفع ملف PDF.</p><button class="btn primary">${ic('plus')} كتاب جديد بهالمادة</button></div>`);
      $('button', e).onclick = () => this.openForm();
      box.append(e);
    }
    const groups = new Map(); const solo = [];
    for (const b of list) {
      if (b.series && b.series.name) {
        const k = normTitle(b.series.name);
        if (!groups.has(k)) groups.set(k, { name: b.series.name, books: [] });
        groups.get(k).books.push(b);
      } else solo.push(b);
    }
    const shelf = (title, sub, list, isSeries) => {
      const s = el(`<section class="shelf ${isSeries ? 'series' : ''}"><div class="shelf-head">${isSeries ? ic('series') : ic('books')}<h3>${esc(title)}</h3><span>${esc(sub)}</span></div><div class="shelf-row"></div><div class="shelf-board"></div></section>`);
      list.forEach(b => $('.shelf-row', s).append(this.card(b)));
      box.append(s);
    };
    [...groups.values()].sort((a, b) => Math.max(...b.books.map(x => x.updated)) - Math.max(...a.books.map(x => x.updated)))
      .forEach(g => shelf('سلسلة · ' + g.name, g.books.length + ' أجزاء', g.books.sort((a, b) => a.series.part - b.series.part), true));
    if (solo.length) shelf(this.cur ? 'كتب المادة' : this.subjects.length ? 'كتب بدون مادة' : 'كتبي', solo.length + ' كتاب', solo.sort((a, b) => b.updated - a.updated), false);
    Files.shelf(box, sid);
    Media.hydrate(box);
  },
  card(b) {
    const n = (b.pageIds || []).length;
    const c = el(`<div class="bk" tabindex="0" data-id="${b.id}">
      <div class="bk-3d ${b.dir === 'ltr' ? 'ltr' : 'rtl'}"><div class="bk-pages"></div>${coverHTML(b)}</div>
      <div class="bk-meta"><span class="bk-t">${esc(b.title)}</span><span class="bk-s">${n} صفحة · ${ago(b.updated)}</span></div>
      <button class="ib bk-more" title="خيارات">${ic('more')}</button></div>`);
    c.addEventListener('click', e => { if (!e.target.closest('.bk-more')) Reader.open(b.id); });
    c.addEventListener('keydown', e => { if (e.key === 'Enter') Reader.open(b.id); });
    $('.bk-more', c).onclick = e => {
      e.stopPropagation();
      Menu.open(e.currentTarget, [
        { icon: 'open', label: 'فتح', act: () => Reader.open(b.id) },
        { icon: 'edit', label: 'تعديل الغلاف والمعلومات', act: () => this.openForm(b) },
        { icon: 'share', label: 'مشاركة الكتاب (.daftar)', act: () => Share.exportBook(b.id) },
        { icon: 'download', label: 'حفظ نسخة احتياطية', act: () => Backup.exportBooks([b.id]) },
        { icon: 'attach', label: 'ملفات PDF لهالكتاب', act: () => Files.panel({ bookId: b.id }) },
        { icon: 'calendar', label: 'خطّط لهالكتاب بالتقويم', act: () => Cal.open({ bookId: b.id }) },
        '-',
        { icon: 'trash', label: 'حذف الكتاب', danger: true, act: () => this.remove(b) },
      ]);
    };
    return c;
  },
  titleTaken(title, exceptId) {
    const k = normTitle(title);
    return this.books.some(b => b.id !== exceptId && normTitle(b.title) === k);
  },
  openForm(book = null) {
    const isEdit = !!book;
    const d = book ? JSON.parse(JSON.stringify(book)) : {
      title: '', author: '', dir: Settings.d.dir, cover: { color: COVER_COLORS[0][0], image: null },
      paper: Settings.newPaper(), series: null, music: { track: 'default', auto: null }, subjectId: this.cur || NO_SUBJECT,
    };
    d.paper = { ...Settings.newPaper(), ...(d.paper || {}) };
    let newImage = null; // ملف صورة غلاف جديد
    let imgUrl = null;
    const names = this.seriesNames();
    const f = el(`<form class="bookform" autocomplete="off">
      <div class="bf-preview"><div class="bf-cover"></div><p class="muted sm">معاينة الغلاف</p></div>
      <div class="bf-fields">
        <h2>${isEdit ? 'تعديل الكتاب' : 'كتاب جديد'}</h2>
        <label class="fld"><span>عنوان الكتاب</span><input name="title" maxlength="80" required placeholder="مثلاً: دفتر JavaScript"><em class="err"></em></label>
        <label class="fld"><span>المؤلف <small>(اختياري)</small></span><input name="author" maxlength="60"></label>
        <label class="fld"><span>${ic('folder')} المادة</span><select name="subject">${this.subjectOptions(book ? this.sid(book) : (this.cur || NO_SUBJECT))}</select></label>
        <div class="fld"><span>اتجاه الكتاب</span>
          <div class="seg" data-k="dir">
            <button type="button" data-v="rtl">يفتح من اليمين <small>عربي</small></button>
            <button type="button" data-v="ltr">يفتح من اليسار <small>English</small></button>
          </div></div>
        <div class="fld"><span>لون الغلاف</span>
          <div class="swatches">${COVER_COLORS.map(([c, n]) => `<button type="button" class="sw" data-c="${c}" title="${n}" style="--c:${c}"></button>`).join('')}
            <button type="button" class="btn ghost sm" data-a="img">${ic('image')} صورة من جهازك</button>
            <button type="button" class="btn ghost sm" data-a="noimg" hidden>${ic('x')} إزالة الصورة</button>
          </div></div>
        <details class="more-opts">
          <summary>إعدادات الكتاب: الورق، الخط، الموسيقى، السلسلة</summary>
          <div class="bf-paper"></div>
          <div class="fld"><span>${ic('music')} موسيقى الكتاب</span><select class="inp" name="music">${Settings.musicOptions((d.music && d.music.track) || 'default')}</select></div>
          <label class="chk"><input type="checkbox" name="musicAuto" ${((d.music && d.music.auto != null) ? d.music.auto : Settings.d.music.auto) ? 'checked' : ''}> <span>شغّلها لحالها لما أفتح الكتاب</span></label>
          <label class="chk"><input type="checkbox" name="inSeries"> <span>هذا الكتاب جزء من سلسلة</span></label>
          <div class="series-f" hidden>
            <label class="fld"><span>اسم السلسلة</span><input name="sname" list="snames" maxlength="60" placeholder="مثلاً: رحلتي في البرمجة"><datalist id="snames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
            <label class="fld short"><span>رقم الجزء</span><input name="spart" type="number" min="1" max="999" value="1"><em class="err"></em></label>
          </div>
        </details>
        <div class="row end"><button type="button" class="btn ghost" data-a="cancel">إلغاء</button><button class="btn primary" type="submit">${isEdit ? 'حفظ' : 'إنشاء الكتاب'}</button></div>
      </div></form>`);
    const m = Modal.open(f, { cls: 'wide', onClose: () => { if (imgUrl) URL.revokeObjectURL(imgUrl); } });
    const F = f.elements;
    F.title.value = d.title; F.author.value = d.author || '';
    if (d.series) { F.inSeries.checked = true; F.sname.value = d.series.name; F.spart.value = d.series.part; $('.series-f', f).hidden = false; $('details', f).open = true; }

    const preview = async () => {
      const pv = $('.bf-cover', f);
      const tmp = { ...d, title: F.title.value.trim() || 'عنوان الكتاب', author: F.author.value.trim(), series: F.inSeries.checked && F.sname.value.trim() ? { name: F.sname.value.trim(), part: F.spart.value || 1 } : null };
      pv.innerHTML = coverHTML(tmp);
      pv.className = 'bf-cover ' + (d.dir === 'ltr' ? 'ltr' : 'rtl');
      if (newImage) { const im = $('.cv-img', pv); if (im) { im.removeAttribute('data-blob'); im.src = imgUrl; } }
      else Media.hydrate(pv);
      $('[data-a=noimg]', f).hidden = !d.cover.image;
    };
    const syncSeg = () => {
      $$('.seg[data-k=dir] button', f).forEach(b => b.classList.toggle('on', b.dataset.v === d.dir));
      $$('.seg[data-k=style] button', f).forEach(b => b.classList.toggle('on', b.dataset.v === d.paper.style));
      $$('.sw[data-c]', f).forEach(b => b.classList.toggle('on', b.dataset.c === d.cover.color && !d.cover.image));
      $$('.sw[data-tone]', f).forEach(b => b.classList.toggle('on', b.dataset.tone === d.paper.tone));
    };
    f.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.closest('.paperui')) return;
      if (b.closest('.seg[data-k=dir]')) d.dir = b.dataset.v;
      else if (b.dataset.c) { d.cover.color = b.dataset.c; d.cover.image = null; newImage = null; }
      else if (b.dataset.a === 'img') {
        const file = await pickFile('image/*'); if (!file) return;
        newImage = await Media.downscale(file, 1400);
        if (imgUrl) URL.revokeObjectURL(imgUrl);
        imgUrl = URL.createObjectURL(newImage);
        d.cover.image = 'new';
      } else if (b.dataset.a === 'noimg') { d.cover.image = null; newImage = null; }
      else if (b.dataset.a === 'cancel') { m.close(); return; }
      else return;
      syncSeg(); preview();
    });
    F.inSeries.onchange = () => {
      $('.series-f', f).hidden = !F.inSeries.checked;
      if (F.inSeries.checked && !F.sname.value && names.length) F.sname.focus();
      preview();
    };
    F.sname.addEventListener('input', () => {
      const k = normTitle(F.sname.value);
      const parts = this.books.filter(b => b.id !== (book && book.id) && b.series && normTitle(b.series.name) === k).map(b => +b.series.part);
      if (parts.length && !isEdit) F.spart.value = Math.max(...parts) + 1;
      preview();
    });
    F.title.addEventListener('input', () => { $('.err', F.title.parentElement).textContent = ''; preview(); });
    F.author.addEventListener('input', preview);
    F.spart.addEventListener('input', preview);

    f.onsubmit = async e => {
      e.preventDefault();
      const title = F.title.value.trim();
      const errT = $('.err', F.title.parentElement);
      if (!title) { errT.textContent = 'اكتب عنواناً للكتاب'; F.title.focus(); return; }
      if (this.titleTaken(title, book && book.id)) { errT.textContent = 'يوجد كتاب بنفس الاسم — اختر اسماً مختلفاً'; F.title.focus(); return; }
      let series = null;
      if (F.inSeries.checked) {
        const name = F.sname.value.trim(), part = parseInt(F.spart.value, 10);
        const errP = $('.err', F.spart.parentElement);
        if (!name) { $('details', f).open = true; F.sname.focus(); return; }
        if (!(part >= 1)) { errP.textContent = 'رقم غير صالح'; return; }
        const clash = this.books.find(b => b.id !== (book && book.id) && b.series && normTitle(b.series.name) === normTitle(name) && +b.series.part === part);
        if (clash) { errP.textContent = `الجزء ${part} موجود: «${clash.title}»`; $('details', f).open = true; return; }
        series = { name, part };
      }
      let coverImage = d.cover.image;
      if (newImage) coverImage = await Media.save(newImage);
      const oldImg = book && book.cover.image;
      if (oldImg && oldImg !== coverImage) Media.del(oldImg);
      if (book) {
        const subjectId = F.subject.value;
        if (this.sid(book) !== subjectId) {
          // ملفات الكتاب بتنتقل معه للمادة الجديدة
          const fs = this.files.filter(x => x.bookId === book.id).map(x => ({ ...x, subjectId }));
          if (fs.length) await DB.putMany('files', fs);
        }
        Object.assign(book, { subjectId, title, author: F.author.value.trim(), dir: d.dir, cover: { color: d.cover.color, image: coverImage }, series, paper: d.paper, music: { track: F.music.value, auto: F.musicAuto.checked }, updated: Date.now() });
        await DB.put('books', book);
        m.close();
        await this.load();
        if (Reader.book && Reader.book.id === book.id) { Reader.book = book; Reader.applyPaper(); Reader.render(); }
      } else {
        const nb = { id: 'k' + uid(), subjectId: F.subject.value, title, author: F.author.value.trim(), dir: d.dir, cover: { color: d.cover.color, image: coverImage }, paper: { ...d.paper }, music: { track: F.music.value, auto: F.musicAuto.checked }, series, pageIds: [], created: Date.now(), updated: Date.now(), lastSpread: -1 };
        const pages = [];
        for (let i = 0; i < 4; i++) { const p = { id: 'p' + uid(), bookId: nb.id, html: '', stickies: [], attach: [] }; pages.push(p); nb.pageIds.push(p.id); }
        await DB.putMany('pages', pages);
        await DB.put('books', nb);
        m.close();
        await this.load();
        Reader.open(nb.id); // دفتر جديد: الغلاف بيتقلّب لحاله (Reader.open)
      }
    };
    $('.bf-paper', f).append(PaperUI.make(d.paper, { preview: true }));
    syncSeg(); preview();
    setTimeout(() => F.title.focus(), 60);
  },
  // الحذف ينقل الكتاب لسلة المحذوفات (يُسترجع خلال 30 يوم)
  async remove(b) {
    const item = await Trash.addBook(b);
    Toast.show({ icon: 'trash', text: `نُقل «${b.title}» لسلة المحذوفات`, timeout: 7000, actions: [{ label: 'تراجع', act: () => Trash.restore(item) }] });
    this.load();
  },
};

// كل الوسائط المرتبطة بصفحة
function collectBlobs(p) {
  const out = [];
  (p.html || '').replace(/data-blob="([^"]+)"/g, (_, id) => { out.push(id); return ''; });
  (p.stickies || []).forEach(s => s.blob && out.push(s.blob));
  (p.attach || []).forEach(a => a.blob && out.push(a.blob));
  if (p.bg) out.push(p.bg); // صورة صفحة الـPDF
  return out;
}
