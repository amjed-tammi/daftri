'use strict';
/* ============ المواد (فوق الكتب) وملفات PDF (محاضرات، سلايدات) ============ */
const SUBJECT_COLORS = ['#c9894a', '#4f8a6e', '#5b7bc8', '#b0566b', '#8a6bc0', '#3f9aa3', '#c4a542', '#7d8597'];

const Subjects = {
  // شبكة المواد بالصفحة الرئيسية للمكتبة
  grid() {
    const L = Library, due = Cal.dueBySubject();
    const s = el(`<section class="subjects"><div class="shelf-head">${ic('folder')}<h3>موادي</h3><span>${L.subjects.length} مادة</span></div><div class="subj-grid"></div></section>`);
    const g = $('.subj-grid', s);
    for (const x of L.subjects) {
      const nb = L.books.filter(b => L.sid(b) === x.id).length, nf = L.files.filter(f => L.sid(f) === x.id).length, n = due[x.id] || 0;
      const c = el(`<div class="subj" tabindex="0" role="button" data-sid="${x.id}" style="--sc:${x.color}">
        <span class="subj-tab"></span>
        <span class="subj-ic">${ic('folder')}</span>
        <b dir="auto">${esc(x.name)}</b>
        <small>${nb} كتاب${nf ? ` · ${nf} PDF` : ''}</small>
        ${n ? `<span class="subj-due" title="مطلوب اليوم">${n} اليوم</span>` : ''}
        <button class="ib subj-more" title="خيارات المادة">${ic('more')}</button></div>`);
      c.addEventListener('click', e => { if (!e.target.closest('.subj-more')) this.open(x.id); });
      c.addEventListener('keydown', e => { if (e.key === 'Enter') this.open(x.id); });
      $('.subj-more', c).onclick = e => { e.stopPropagation(); this.menu(e.currentTarget, x); };
      g.append(c);
    }
    const add = el(`<button class="subj add" title="مادة جديدة">${ic('plus')}<b>مادة جديدة</b><small>رياضيات، فيزياء، تاريخ…</small></button>`);
    add.onclick = () => this.form();
    g.append(add);
    return s;
  },
  // رأس صفحة المادة: رجوع، اسمها، وأزرارها
  head(x) {
    const L = Library, nb = L.books.filter(b => L.sid(b) === x.id).length;
    const h = el(`<div class="subj-head" style="--sc:${x.color}">
      <button class="btn ghost sm" data-a="home" title="رجوع لكل المواد">${ic('right')} كل المواد</button>
      <h2><span class="subj-dot"></span><span dir="auto">${esc(x.name)}</span></h2><span class="muted sm">${nb} كتاب</span>
      <div class="row subj-acts">
        <button class="btn primary sm" data-a="book">${ic('plus')} كتاب بهالمادة</button>
        <button class="btn ghost sm" data-a="pdf">${ic('attach')} رفع PDF</button>
        <button class="btn ghost sm" data-a="plan">${ic('calendar')} خطّط</button>
        <button class="ib" data-a="more" title="خيارات المادة">${ic('more')}</button>
      </div></div>`);
    h.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const k = a.dataset.a;
      if (k === 'home') this.open(null);
      else if (k === 'book') Library.openForm();
      else if (k === 'pdf') Files.upload({ subjectId: x.id });
      else if (k === 'plan') Cal.open({ subjectId: x.id });
      else if (k === 'more') this.menu(a, x);
    });
    return h;
  },
  menu(anchor, x) {
    Menu.open(anchor, [
      { icon: 'open', label: 'فتح المادة', act: () => this.open(x.id) },
      { icon: 'edit', label: 'تعديل الاسم واللون', act: () => this.form(x) },
      { icon: 'attach', label: 'رفع PDF لهالمادة', act: () => Files.upload({ subjectId: x.id }) },
      { icon: 'calendar', label: 'خطّط لهالمادة بالتقويم', act: () => Cal.open({ subjectId: x.id }) },
      '-',
      { icon: 'trash', label: 'حذف المادة (الكتب بتضل)', danger: true, act: () => this.remove(x) },
    ]);
  },
  open(id) {
    Library.cur = id;
    Library.render();
    $('#library').scrollTop = 0;
  },
  form(x = null) {
    const d = x ? { ...x } : { name: '', color: SUBJECT_COLORS[Library.subjects.length % SUBJECT_COLORS.length] };
    const f = el(`<form class="subj-form" autocomplete="off">
      <h3>${ic('folder')} ${x ? 'تعديل المادة' : 'مادة جديدة'}</h3>
      <p class="muted sm">المادة بتجمع كتبها (وأجزاء السلاسل) وملفات الـPDF تبعها بمكان واحد.</p>
      <label class="fld"><span>اسم المادة</span><input name="name" maxlength="50" required placeholder="مثلاً: رياضيات ١٠١"><em class="err"></em></label>
      <div class="fld"><span>اللون</span><div class="swatches">${SUBJECT_COLORS.map(c => `<button type="button" class="sw" data-c="${c}" style="--c:${c}" title="${c}"></button>`).join('')}</div></div>
      <div class="row end"><button type="button" class="btn ghost" data-a="cancel">إلغاء</button><button class="btn primary">${x ? 'حفظ' : 'أنشئ المادة'}</button></div></form>`);
    const m = Modal.open(f, { cls: 'sm' });
    const inp = f.elements.name; inp.value = d.name;
    const sync = () => $$('.sw', f).forEach(b => b.classList.toggle('on', b.dataset.c === d.color));
    f.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.c) { d.color = b.dataset.c; sync(); }
      else if (b.dataset.a === 'cancel') m.close();
    });
    inp.addEventListener('input', () => { $('.err', f).textContent = ''; });
    f.onsubmit = async e => {
      e.preventDefault();
      const name = inp.value.trim();
      const err = $('.err', f);
      if (!name) { err.textContent = 'اكتب اسم المادة'; inp.focus(); return; }
      const k = normTitle(name);
      if (k === normTitle('بدون مادة') || Library.subjects.some(s => s.id !== d.id && normTitle(s.name) === k)) { err.textContent = 'في مادة بنفس الاسم'; inp.focus(); return; }
      const rec = x ? { ...x, name, color: d.color } : { id: 's' + uid(), name, color: d.color, created: Date.now() };
      await DB.put('subjects', rec);
      m.close();
      if (!x) Library.cur = rec.id;
      await Library.load();
      if (!x) Toast.show({ icon: 'folder', title: `انعملت مادة «${name}» ✦`, text: 'ضيف كتاب جوّاها، أو ارفع ملف PDF للمحاضرات.', timeout: 4500 });
    };
    sync();
    setTimeout(() => inp.focus(), 60);
  },
  // الحذف ما بيضيّع شي: الكتب والملفات والمهام بترجع لـ«بدون مادة»
  async remove(x) {
    const nb = Library.books.filter(b => Library.sid(b) === x.id).length;
    if (!await Modal.confirm(`حذف مادة «${x.name}»؟`, nb ? `${nb} كتاب وملفات المادة ما رح ينحذفوا، بيرجعوا لـ«بدون مادة».` : 'المادة فاضية.', { ok: 'احذف المادة', danger: true })) return;
    const move = list => list.filter(o => o.subjectId === x.id).map(o => ({ ...o, subjectId: NO_SUBJECT }));
    const books = move(Library.books), files = move(Library.files), plans = move(Cal.plans);
    if (books.length) await DB.putMany('books', books);
    if (files.length) await DB.putMany('files', files);
    if (plans.length) await DB.putMany('plans', plans);
    await DB.del('subjects', x.id);
    if (Library.cur === x.id) Library.cur = null;
    await Library.load();
    Toast.show({ icon: 'folder', text: `انحذفت المادة، وكتبها صارت ب«بدون مادة»`, timeout: 3500 });
  },
};

/* ============ ملفات PDF ============ */
function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

const Files = {
  isPdf(f) { return !!f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')); },
  async upload(target = {}) {
    const list = await pickFile('application/pdf,.pdf', true);
    if (list && list.length) return this.addFiles(list, target);
    return [];
  },
  // الملف بينحفظ جوّا التطبيق (IndexedDB) فبيفتح بدون إنترنت وبدون ما يضل بمكانه الأصلي
  async addFiles(list, { subjectId = null, bookId = null } = {}) {
    const pdfs = [...list].filter(f => this.isPdf(f));
    if (!pdfs.length) { Toast.show({ icon: 'attach', text: 'بس ملفات PDF (محاضرات، سلايدات…)' }); return []; }
    if (bookId && !subjectId) subjectId = Library.sid(Library.books.find(b => b.id === bookId) || await DB.get('books', bookId));
    const out = [];
    for (const f of pdfs) {
      const blob = f.type === 'application/pdf' ? f : new Blob([f], { type: 'application/pdf' });
      const id = 'f' + uid();
      const rec = { id, name: (f.name || 'ملف').replace(/\.pdf$/i, ''), size: f.size, blob: await Media.save(blob), subjectId: subjectId || NO_SUBJECT, bookId: bookId || null, added: Date.now() };
      await DB.put('files', rec);
      out.push(rec);
    }
    await this.refresh();
    const one = out.length === 1 ? out[0] : null;
    Toast.show({ icon: 'attach', title: one ? `انضاف «${one.name}»` : `انضاف ${out.length} ملفات PDF`, text: 'بتلاقيه بالمادة أو من «ملفات PDF» جوّا الكتاب.', timeout: 5000, actions: one ? [{ label: 'افتحه', primary: true, act: () => this.open(one.id) }] : [] });
    return out;
  },
  async refresh() {
    if (!$('#library').hidden) await Library.load(); else Library.files = await DB.all('files');
    if (this._redraw) this._redraw();
  },
  // عارض خفيف: عارض PDF تبع المتصفح نفسه جوّا إطار، من الملف المحفوظ (blob)
  async open(id) {
    const rec = await DB.get('files', id);
    const r = rec && await DB.get('blobs', rec.blob);
    if (!r) { Toast.show({ icon: 'x', text: 'الملف مش موجود' }); return; }
    const blob = r.blob.type === 'application/pdf' ? r.blob : new Blob([r.blob], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const book = rec.bookId && Library.books.find(b => b.id === rec.bookId);
    const n = el(`<div class="pdfv">
      <header class="pdfv-top">${ic('attach')}<b dir="auto">${esc(rec.name)}</b><small class="muted">${fmtSize(rec.size || blob.size)} · ${esc(Library.subjectName(Library.sid(rec)))}${book ? ' · ' + esc(book.title) : ''}</small>
        <span class="grow"></span>
        <button class="btn ghost sm" data-a="plan" title="حط قراءته بالتقويم">${ic('calendar')} خطّط</button>
        <button class="btn ghost sm" data-a="dl" title="حفظ نسخة على جهازك">${ic('download')} تنزيل</button>
        <button class="ib" data-a="close" title="إغلاق">${ic('x')}</button></header>
      <iframe class="pdfv-frame" title="${esc(rec.name)}" src="${url}"></iframe></div>`);
    const m = Modal.open(n, { cls: 'pdf-modal', onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000) });
    n.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'close') m.close();
      else if (a.dataset.a === 'dl') downloadBlob(blob, rec.name + '.pdf');
      else if (a.dataset.a === 'plan') { m.close(); Cal.open({ fileId: rec.id }); }
    });
  },
  async remove(rec) {
    if (!await Modal.confirm(`حذف «${rec.name}»؟`, 'الملف بينحذف من دفتري (النسخة الأصلية على جهازك ما بتتأثر).', { ok: 'احذف', danger: true })) return;
    await DB.del('files', rec.id);
    await Media.del(rec.blob);
    const linked = Cal.plans.filter(p => p.fileId === rec.id).map(p => ({ ...p, fileId: null }));
    if (linked.length) await DB.putMany('plans', linked);
    await Cal.load();
    await this.refresh();
  },
  menu(anchor, rec) {
    Menu.open(anchor, [
      { icon: 'open', label: 'فتح', act: () => this.open(rec.id) },
      { icon: 'calendar', label: 'خطّط لقراءته بالتقويم', act: () => Cal.open({ fileId: rec.id }) },
      '-',
      { icon: 'trash', label: 'حذف الملف', danger: true, act: () => this.remove(rec) },
    ]);
  },
  card(rec) {
    const book = rec.bookId && Library.books.find(b => b.id === rec.bookId);
    const c = el(`<div class="pdf-card" tabindex="0" role="button" data-fid="${rec.id}" title="فتح ${esc(rec.name)}">
      <div class="pdf-sheet"><span class="pdf-tag">PDF</span><i></i><i></i><i></i></div>
      <span class="pdf-t" dir="auto">${esc(rec.name)}</span>
      <span class="pdf-s">${fmtSize(rec.size || 0)}${book ? ' · ' + esc(book.title) : ''}</span>
      <button class="ib pdf-more" title="خيارات">${ic('more')}</button></div>`);
    c.addEventListener('click', e => { if (!e.target.closest('.pdf-more')) this.open(rec.id); });
    c.addEventListener('keydown', e => { if (e.key === 'Enter') this.open(rec.id); });
    $('.pdf-more', c).onclick = e => { e.stopPropagation(); this.menu(e.currentTarget, rec); };
    return c;
  },
  // رف ملفات الـPDF بالمادة (أو بالرئيسية لملفات «بدون مادة»)
  shelf(box, sid) {
    const list = Library.files.filter(f => Library.sid(f) === sid).sort((a, b) => b.added - a.added);
    if (!list.length && sid === NO_SUBJECT) return;
    const s = el(`<section class="shelf pdfs"><div class="shelf-head">${ic('attach')}<h3>ملفات PDF</h3><span>${list.length ? list.length + ' ملف' : 'محاضرات، سلايدات، ملخصات'}</span><button class="btn ghost sm" data-a="up">${ic('upload')} رفع PDF</button></div><div class="pdf-row"></div></section>`);
    list.forEach(f => $('.pdf-row', s).append(this.card(f)));
    if (!list.length) $('.pdf-row', s).append(el('<p class="muted sm pdf-hint">ارفع محاضرات المادة وسلايداتها، وبتفتحها هون بدون إنترنت. (أو اسحب الملف وأفلته على المكتبة)</p>'));
    $('[data-a=up]', s).onclick = () => this.upload({ subjectId: sid });
    box.append(s);
  },
  // نافذة ملفات كتاب (من جوّا الكتاب) أو مادة
  panel({ bookId = null, subjectId = null } = {}) {
    const book = bookId && (Library.books.find(b => b.id === bookId) || (Reader.book && Reader.book.id === bookId ? Reader.book : null));
    const sid = subjectId || (book ? Library.sid(book) : NO_SUBJECT);
    const n = el(`<div class="files-panel">
      <div class="jf-head">${ic('attach')}<div><h3>ملفات PDF</h3><p class="muted">${book ? `«${esc(book.title)}»` : ''}${sid !== NO_SUBJECT ? ` · مادة ${esc(Library.subjectName(sid))}` : ''}</p></div></div>
      <div class="fp-list"></div>
      <div class="row end"><button class="btn ghost" data-a="close">إغلاق</button><button class="btn primary" data-a="up">${ic('upload')} رفع PDF</button></div></div>`);
    const m = Modal.open(n, { cls: 'wide', onClose: () => { this._redraw = null; } });
    const draw = () => {
      const mine = Library.files.filter(f => (bookId && f.bookId === bookId) || (!bookId && Library.sid(f) === sid));
      const rest = bookId && sid !== NO_SUBJECT ? Library.files.filter(f => f.bookId !== bookId && Library.sid(f) === sid) : [];
      const row = f => `<div class="fp-item" data-fid="${f.id}"><span class="fp-ic">PDF</span><div class="fp-t"><b dir="auto">${esc(f.name)}</b><small>${fmtSize(f.size || 0)} · ${new Date(f.added).toLocaleDateString('ar')}</small></div><button class="btn ghost sm" data-o="${f.id}">${ic('open')} فتح</button><button class="ib" data-del="${f.id}" title="حذف">${ic('trash')}</button></div>`;
      $('.fp-list', n).innerHTML = (mine.length ? mine.map(row).join('') : `<p class="muted empty-j">${book ? 'ما في ملفات لهالكتاب لسا. ارفع المحاضرة أو السلايدات وبتفتحها من هون وإنت عم تكتب.' : 'ما في ملفات لسا.'}</p>`)
        + (rest.length ? `<h4 class="fp-g">ملفات ثانية بنفس المادة</h4>` + rest.map(row).join('') : '');
    };
    this._redraw = draw;
    n.addEventListener('click', e => {
      const o = e.target.closest('[data-o]'), d = e.target.closest('[data-del]'), a = e.target.closest('[data-a]');
      if (o) this.open(o.dataset.o);
      else if (d) { const f = Library.files.find(x => x.id === d.dataset.del); if (f) this.remove(f); }
      else if (a && a.dataset.a === 'up') this.upload({ subjectId: sid, bookId });
      else if (a && a.dataset.a === 'close') m.close();
    });
    draw();
  },
};
