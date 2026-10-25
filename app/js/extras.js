'use strict';
/* ============ الروابط (فيديو/مواقع/صفحات) ============ */
const Links = {
  isVideo(u) { return /youtu\.?be|vimeo\.com|tiktok\.com|\/reel|\/watch|\.mp4(\?|$)|\.webm(\?|$)/i.test(u || ''); },
  short(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u).slice(0, 24); } },
  fix(u) { u = (u || '').trim(); if (!u) return ''; if (!/^[a-z][\w+.-]*:/i.test(u)) u = 'https://' + u; return u; },
  openUrl(u) { window.open(u, '_blank', 'noopener'); },
  async open(range, l, tab = 'url') {
    const hasText = !!(range && !range.collapsed && range.toString().trim() && l.c.contains(range.commonAncestorContainer));
    const books = (await DB.all('books')).sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    const cur = Reader.book;
    const opts = [cur, ...books.filter(b => b.id !== cur.id)].map(b => `<option value="${b.id}">${esc(b.title)}${b.series && b.series.name ? ` — ${esc(b.series.name)} ج${b.series.part}` : ''}${b.id === cur.id ? ' (هذا الكتاب)' : ''}</option>`).join('');
    const f = el(`<form class="linkform panel" autocomplete="off">
      <div class="seg tabs"><button type="button" data-t="url">${ic('video')} رابط / فيديو</button><button type="button" data-t="page">${ic('page')} صفحة أو كتاب</button></div>
      <div class="tab" data-tab="url">
        <input class="inp" name="url" dir="ltr" placeholder="https://www.youtube.com/watch?v=…">
        ${hasText ? `<p class="muted sm">سيُربط النص: «${esc(range.toString().trim().slice(0, 40))}»</p>` : '<input class="inp" name="title" placeholder="عنوان يظهر (اختياري)">'}
        <div class="row">
          <button class="btn primary" data-do="${hasText ? 'wrap' : 'chip'}">${hasText ? 'ربط بالنص' : 'إدراج في السطر'}</button>
          <button type="button" class="btn ghost" data-do="attach">${ic('bookmark')} إرفاق بالصفحة</button>
        </div>
      </div>
      <div class="tab" data-tab="page" hidden>
        <label class="fld"><span>الكتاب</span><select class="inp" name="book">${opts}</select></label>
        <label class="fld short"><span>رقم الصفحة</span><input class="inp" type="number" name="page" min="1" value="1"></label>
        <div class="row"><button class="btn primary" data-do="${hasText ? 'pwrap' : 'pchip'}">${hasText ? 'ربط النص بالصفحة' : 'إدراج رابط الصفحة'}</button></div>
      </div></form>`);
    const show = t => {
      $$('.tabs button', f).forEach(b => b.classList.toggle('on', b.dataset.t === t));
      $$('.tab', f).forEach(x => x.hidden = x.dataset.tab !== t);
      setTimeout(() => (t === 'url' ? f.elements.url : f.elements.page).focus(), 20);
    };
    f.addEventListener('click', e => { const b = e.target.closest('.tabs button'); if (b) show(b.dataset.t); });
    const run = what => {
      const F = f.elements;
      if (what === 'wrap' || what === 'chip' || what === 'attach') {
        const url = this.fix(F.url.value);
        if (!url) { F.url.focus(); return; }
        Pop.close();
        if (what === 'attach') { Attach.add(l, { type: 'link', url, title: (F.title && F.title.value.trim()) || '' }); Toast.show({ icon: 'bookmark', text: 'أُرفق الرابط بالصفحة', timeout: 2000 }); return; }
        if (what === 'wrap') this.wrap(range, l, { href: url }, 'vlink');
        else {
          const t = (F.title && F.title.value.trim()) || this.short(url);
          this.chip(range, l, `<a class="chip vlink" href="${esc(url)}" contenteditable="false">${ic(this.isVideo(url) ? 'play' : 'link')}${esc(t)}</a>`);
        }
      } else {
        const bookId = F.book.value, page = clamp(parseInt(F.page.value, 10) || 1, 1, 9999) - 1;
        const bk = books.find(b => b.id === bookId);
        Pop.close();
        const attrs = { href: '#', 'data-book': bookId, 'data-page': page };
        if (what === 'pwrap') this.wrap(range, l, attrs, 'plink');
        else {
          const lbl = (bookId === cur.id ? '' : (bk ? bk.title + ' · ' : '')) + 'صفحة ' + (page + 1);
          this.chip(range, l, `<a class="chip plink" href="#" data-book="${bookId}" data-page="${page}" contenteditable="false">${ic('page')}${esc(lbl)}</a>`);
        }
      }
    };
    f.onsubmit = e => { e.preventDefault(); run(e.submitter ? e.submitter.dataset.do : (f.querySelector('.tab:not([hidden]) .btn.primary').dataset.do)); };
    $('[data-do=attach]', f).onclick = () => run('attach');
    const rect = range && range.getBoundingClientRect && range.getBoundingClientRect();
    const anchor = rect && rect.width + rect.height > 0 ? rect : l.pg.getBoundingClientRect();
    Pop.open({ getBoundingClientRect: () => anchor }, f, { cls: 'panel-pop' });
    show(tab);
  },
  wrap(range, l, attrs, cls) {
    l.c.focus(); Sel.restore(range);
    const mark = '#lnk-' + uid();
    document.execCommand('createLink', false, mark);
    $$('a', l.c).filter(a => a.getAttribute('href') === mark).forEach(a => {
      a.className = cls;
      for (const k in attrs) a.setAttribute(k, attrs[k]);
    });
    Editor.changed(l);
  },
  chip(range, l, html) {
    l.c.focus();
    if (range && l.c.contains(range.startContainer)) Sel.restore(range); else Editor.ensureCaret(l);
    document.execCommand('insertHTML', false, html + '&nbsp;');
    Editor.changed(l);
  },
  menuFor(a, l) {
    const unlink = () => {
      if (a.classList.contains('chip')) a.remove(); else a.replaceWith(...a.childNodes);
      Editor.changed(l);
    };
    if (a.classList.contains('plink')) {
      const bid = a.dataset.book, pg = +a.dataset.page || 0;
      const other = bid && bid !== Reader.book.id;
      Menu.open(a, [
        { icon: 'page', label: other ? `افتح الكتاب المرتبط · صفحة ${pg + 1}` : `اذهب إلى الصفحة ${pg + 1}`, act: () => Reader.openLink(bid || Reader.book.id, pg) },
        '-', { icon: 'x', label: 'إزالة الرابط', act: unlink },
      ], { place: 'above' });
    } else {
      const url = a.getAttribute('href');
      Menu.open(a, [
        { icon: this.isVideo(url) ? 'play' : 'open', label: this.isVideo(url) ? 'تشغيل الفيديو' : 'فتح الرابط', act: () => this.openUrl(url) },
        { icon: 'copy', label: 'نسخ الرابط', act: () => navigator.clipboard.writeText(url) },
        '-', { icon: 'x', label: 'إزالة الرابط', act: unlink },
      ], { place: 'above' });
    }
  },
};

/* ============ تسجيل الصوت ============ */
const Voice = {
  record(anchor) {
    return new Promise(res => {
      const box = el(`<div class="rec"><button class="recbtn" title="تسجيل"><i></i></button>
        <div class="rinfo"><b class="rtime">0:00</b><span class="rhint">اضغط وابدأ الكلام</span></div>
        <button class="ib rcancel" title="إلغاء">${ic('x')}</button></div>`);
      Pop.open(anchor.getBoundingClientRect ? anchor : { getBoundingClientRect: () => anchor }, box, { cls: 'rec-pop', place: 'above' });
      let mr = null, stream = null, chunks = [], t0 = 0, iv = 0, done = false;
      const finish = v => { if (done) return; done = true; clearInterval(iv); if (stream) stream.getTracks().forEach(t => t.stop()); res(v); };
      Pop.onclose = () => { if (mr && mr.state === 'recording') { mr.onstop = null; mr.stop(); } finish(null); };
      $('.rcancel', box).onclick = () => Pop.close();
      $('.recbtn', box).onclick = async () => {
        if (!mr) {
          try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
          catch { Toast.show({ icon: 'mic', title: 'المايكروفون', text: 'لم أستطع الوصول للمايكروفون. اسمح بالوصول ثم جرّب مرة أخرى.' }); Pop.close(); return; }
          const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
          mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 40000 } : {});
          mr.ondataavailable = e => e.data.size && chunks.push(e.data);
          mr.onstop = async () => {
            const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
            const dur = (Date.now() - t0) / 1000;
            const id = await Media.save(blob);
            const out = { id, dur };
            finish(out);
            Pop.close();
          };
          mr.start(); t0 = Date.now();
          box.classList.add('on');
          $('.rhint', box).textContent = 'اضغط للإيقاف والحفظ';
          iv = setInterval(() => { $('.rtime', box).textContent = fmtTime((Date.now() - t0) / 1000); if (Date.now() - t0 > 15 * 60e3) mr.stop(); }, 250);
        } else if (mr.state === 'recording') { clearInterval(iv); mr.stop(); }
      };
    });
  },
  async attachToSelection(range, l) {
    if (!range || range.collapsed || !l.c.contains(range.commonAncestorContainer)) return this.attachToPage(l);
    const rect = range.getBoundingClientRect();
    const res = await this.record({ getBoundingClientRect: () => rect });
    if (!res) return;
    l.c.focus(); Sel.restore(range);
    const span = document.createElement('span');
    span.className = 'voice'; span.dataset.blob = res.id; span.dataset.dur = Math.round(res.dur);
    try { range.surroundContents(span); } catch { span.append(range.extractContents()); range.insertNode(span); }
    getSelection().collapse(span, span.childNodes.length);
    Editor.changed(l);
    Toast.show({ icon: 'mic', text: 'رُبط التسجيل بالكلمة — اضغط عليها للاستماع', timeout: 2600 });
  },
  async attachToPage(l, e) {
    const anchor = e && e.clientX ? { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 } : $('.attach', l.pg).getBoundingClientRect();
    const res = await this.record({ getBoundingClientRect: () => anchor });
    if (!res) return;
    Attach.add(l, { type: 'audio', blob: res.id, dur: res.dur, at: Date.now() });
    Toast.show({ icon: 'mic', text: 'أُرفق التسجيل بالصفحة (أعلى الصفحة)', timeout: 2600 });
  },
  menuFor(span, l) {
    Menu.open(span, [
      { icon: 'play', label: 'استمع للتسجيل' + (span.dataset.dur ? ' · ' + fmtTime(+span.dataset.dur) : ''), act: () => Player.toggle(span.dataset.blob, span) },
      { icon: 'trash', label: 'إزالة التسجيل', danger: true, act: () => { Media.del(span.dataset.blob); span.replaceWith(...span.childNodes); Editor.changed(l); } },
    ], { place: 'above' });
  },
};

/* ============ فيديو قصير داخل الصفحة ============ */
const Media2 = {
  // الفيديو بينحط على الصفحة كعنصر بتسحبه لأي مكان، والنص بيلتف حواليه
  async insertVideo(l, file, pt) {
    file = file || await pickFile('video/*');
    if (!file) return;
    const mb = file.size / 1048576;
    if (mb > 250) { Toast.show({ icon: 'film', title: 'الفيديو كبير جداً', text: 'اختر فيديو أقصر (أقل من 250 ميجا).' }); return; }
    if (mb > 60 && !(await Modal.confirm('فيديو كبير', `حجم الفيديو ${mb.toFixed(0)} ميجا. سيُحفظ داخل الدفتر. متابعة؟`, { ok: 'أضفه' }))) return;
    const id = await Media.save(file);
    Stickies.addVideo(l, id, pt);
    Toast.show({ icon: 'film', text: 'اسحب الفيديو من شريطه الفوقاني لأي مكان بالصفحة', timeout: 3000 });
  },
};

/* ============ مؤقت الحبل ============ */
const Rope = {
  L0: 58, len: 58, run: null, iv: 0,
  init() {
    const r = $('#rope');
    r.innerHTML = `<svg class="rope-svg" width="110" height="100%" aria-hidden="false">
      <defs><radialGradient id="bead" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#f6dc9b"/><stop offset=".55" stop-color="#c8963f"/><stop offset="1" stop-color="#6e4a1c"/></radialGradient></defs>
      <g class="rp"><line class="r-a" x1="34" y1="-6" x2="34" y2="58"/><line class="r-b" x1="34" y1="-6" x2="34" y2="58"/></g>
      <g class="knot" transform="translate(34,74)" tabindex="0" role="button" aria-label="مؤقت: اسحب الحبل لأسفل">
        <circle class="k-glow" r="24"/><circle class="k-ring" r="15" fill="url(#bead)"/><circle class="k-hole" r="4.5"/>
      </g>
      <g class="tag" transform="translate(56,74)"><rect x="0" y="-15" rx="9" width="50" height="30"/><text x="25" y="5"></text></g>
    </svg>`;
    this.svg = $('svg', r);
    this.knot = $('.knot', r);
    this.tag = $('.tag', r);
    this.knot.addEventListener('pointerdown', e => this.down(e));
    this.knot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.menu(); } });
    try { const s = JSON.parse(localStorage.getItem('rope') || 'null'); if (s && (s.paused || s.end > Date.now())) { this.run = s; this.startTick(); Study.sessionStart(Math.round(s.total / 60e3), true); } } catch { }
    this.paint();
  },
  ppm() { return Math.max(3, (innerHeight - 190) / 90); },
  setLen(L) {
    this.len = L;
    $$('line', this.svg).forEach(x => x.setAttribute('y2', L));
    this.knot.setAttribute('transform', `translate(34,${L + 16})`);
    this.tag.setAttribute('transform', `translate(56,${L + 16})`);
  },
  label(t) {
    const tx = $('text', this.tag);
    tx.textContent = t || '';
    this.tag.classList.toggle('show', !!t);
    if (t) { const w = Math.max(44, tx.getComputedTextLength() + 22); $('rect', this.tag).setAttribute('width', w); tx.setAttribute('x', w / 2); }
  },
  down(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    try { this.knot.setPointerCapture(e.pointerId); } catch { }
    const y0 = e.clientY, L0 = this.run ? this.len : this.L0;
    let moved = false, mins = 0;
    $('#rope').classList.add('pulling');
    const mv = ev => {
      const dy = ev.clientY - y0;
      if (!moved && Math.abs(dy) < 5) return;
      moved = true;
      if (this.run) return;
      const L = clamp(this.L0 + Math.max(0, dy), this.L0, this.L0 + 90 * this.ppm());
      mins = Math.round((L - this.L0) / this.ppm());
      if (mins > 10) mins = Math.round(mins / 5) * 5;
      this.setLen(L);
      this.label(mins ? `${mins} د` : '');
    };
    const up = () => {
      this.knot.removeEventListener('pointermove', mv); this.knot.removeEventListener('pointerup', up); this.knot.removeEventListener('pointercancel', up);
      $('#rope').classList.remove('pulling');
      if (!moved) { this.menu(); return; }
      if (this.run) return;
      if (mins >= 1) this.start(mins);
      else this.retract();
    };
    this.knot.addEventListener('pointermove', mv); this.knot.addEventListener('pointerup', up); this.knot.addEventListener('pointercancel', up);
  },
  start(mins) {
    // المادة: من الكتاب اللي إنت فيه (لحساب ساعات كل مادة)
    this.run = { total: mins * 60e3, end: Date.now() + mins * 60e3, paused: 0, sid: Reader.book ? Library.sid(Reader.book) : NO_SUBJECT };
    this.save(); this.swing(); this.startTick();
    if (!Study.session) Study.sessionStart(mins);
    Toast.show({ icon: 'timer', text: `بدأت جلسة الدراسة: ${mins} دقيقة. ركّز… وأنا بنبهك`, timeout: 2600 });
  },
  startTick() { clearInterval(this.iv); this.iv = setInterval(() => this.paint(), 1000); this.paint(); },
  remaining() { const r = this.run; return !r ? 0 : r.paused ? r.paused : Math.max(0, r.end - Date.now()); },
  paint() {
    if (!this.run) { this.setLen(this.L0); this.label(''); $('#rope').classList.remove('running', 'paused'); return; }
    const rem = this.remaining();
    const L = this.L0 + (rem / 60e3) * this.ppm();
    this.setLen(L);
    this.label(fmtTime(rem / 1000));
    $('#rope').classList.add('running');
    $('#rope').classList.toggle('paused', !!this.run.paused);
    if (!this.run.paused && rem <= 0) this.finish();
  },
  save() { localStorage.setItem('rope', JSON.stringify(this.run)); },
  stop() {
    // الدقايق اللي درستها فعلاً (الإيقاف المؤقت ما بينحسب) — حتى لو وقّفت قبل الوقت
    if (this.run) Study.logMinutes((this.run.total - this.remaining()) / 60e3, this.run.sid);
    Study.sessionEnd(false); clearInterval(this.iv); this.run = null; localStorage.removeItem('rope'); this.label(''); $('#rope').classList.remove('running', 'paused'); this.retract(); },
  finish() {
    Study.sessionEnd(true); // بيسألك شو تعلمت وبيحفظه بيومياتك
    this.stop();
    Sound.chime(); setTimeout(() => Sound.chime(), 1700);
    if (Reminders.cfg.sys && document.hidden && window.Notification && Notification.permission === 'granted') new Notification('دفتري — انتهى الوقت', { body: 'خذ استراحة قصيرة ✦' });
  },
  pause(prayer = false) {
    if (!this.run || this.run.paused) return;
    this.run.paused = this.remaining(); this.save(); this.paint();
    if (prayer) Toast.show({ emoji: '🤲', text: 'وقّفنا الجلسة. لما ترجع اضغط الحبل ← «استئناف» وبتكمّل من نفس الدقيقة.', timeout: 6000 });
  },
  menu() {
    const items = this.run ? [
      { head: 'المتبقي ' + fmtTime(this.remaining() / 1000) },
      this.run.paused ? { icon: 'play', label: 'استئناف', act: () => { this.run.end = Date.now() + this.run.paused; this.run.paused = 0; this.save(); this.paint(); } }
        : { icon: 'pause', label: 'إيقاف مؤقت', act: () => { this.run.paused = this.remaining(); this.save(); this.paint(); } },
      { icon: 'plus', label: '+5 دقائق', act: () => { if (this.run.paused) this.run.paused += 5 * 60e3; else this.run.end += 5 * 60e3; this.run.total += 5 * 60e3; this.save(); this.paint(); } },
      '-', { icon: 'x', label: 'إلغاء المؤقت', danger: true, act: () => this.stop() },
    ] : [
      { head: 'اسحب الحبل لأسفل لتحديد الوقت' },
      ...[5, 15, 25, 45, 60].map(m => ({ icon: 'timer', label: `${m} دقيقة`, act: () => this.start(m) })),
    ];
    Menu.open(this.knot, items);
  },
  retract() {
    const from = this.len, t0 = performance.now();
    const step = now => {
      const t = (now - t0) / 1000;
      const L = this.L0 + (from - this.L0) * Math.exp(-5 * t) * Math.cos(9 * t);
      this.setLen(Math.max(this.L0 - 12, L));
      if (t < 1.4) requestAnimationFrame(step); else this.setLen(this.L0);
    };
    requestAnimationFrame(step);
    this.swing();
  },
  swing() { const r = $('#rope'); r.classList.remove('swing'); void r.offsetWidth; r.classList.add('swing'); },
};

/* ============ النسخ الاحتياطي التلقائي ============
   بمتصفحات كروم/إيدج: الطالب بيختار مجلد مرة وحدة (مثلاً جوّا OneDrive أو Google Drive) وكل يوم بتنحفظ نسخة لحالها،
   وبنخلي آخر 7 أيام. بالمتصفحات اللي ما بتسمح (آيفون، فايرفوكس): تذكير لطيف كل أسبوع ينزّل نسخة. ما في سيرفر ولا حساب. */
const AutoBackup = {
  can: typeof window.showDirectoryPicker === 'function',
  NAME: /^دفتري \d{4}-\d{2}-\d{2}\.daftari\.json$/,
  get c() { return Settings.d.backup; },
  async dir() { const r = await DB.get('meta', 'backupDir'); return r && r.handle; },
  init() {
    if (!this.c.since) { this.c.since = Date.now(); Settings.save(); }
    setTimeout(() => this.run().catch(e => console.warn('backup', e)), 15000);
    setInterval(() => this.run().catch(() => {}), 20 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.run().catch(() => {}); });
  },
  // اختيار المجلد (لازم من ضغطة زر)
  async pick() {
    if (!this.can) { Toast.show({ icon: 'download', title: 'متصفحك ما بيسمح بمجلد تلقائي', text: 'بنذكّرك كل أسبوع تنزّل نسخة، أو افتح دفتري من Edge أو Chrome على الكمبيوتر.', timeout: 7000 }); return false; }
    let h;
    try { h = await showDirectoryPicker({ id: 'daftari-backup', mode: 'readwrite', startIn: 'documents' }); } catch { return false; }
    await DB.put('meta', { id: 'backupDir', handle: h });
    Object.assign(this.c, { on: true, dir: h.name, sig: '' }); Settings.save();
    const r = await this.run(true);
    if (r === 'ok') Toast.show({ icon: 'check', title: 'النسخ الاحتياطي التلقائي شغّال ✦', text: `كل يوم بتنحفظ نسخة بمجلد «${h.name}» (آخر 7 أيام).`, timeout: 5000 });
    return true;
  },
  off() { this.c.on = false; Settings.save(); },
  // بصمة صغيرة للمكتبة: ما بنكتب نسخة إذا ما تغيّر شي
  async sig() {
    const books = await DB.all('books');
    const n = await Promise.all(['plans', 'journal', 'subjects', 'files', 'links'].map(s => DB.all(s).then(x => x.length)));
    return books.length + ':' + Math.max(0, ...books.map(b => b.updated || 0)) + ':' + n.join(',');
  },
  async run(force = false, ask = false) {
    const c = this.c;
    if (!c.on) return this.remind();
    if (!this.can) return this.remind();
    const h = await this.dir(); if (!h) return 'nodir';
    const sig = await this.sig();
    if (!force && c.sig === sig) return 'same';
    const o = { mode: 'readwrite' };
    if ((await h.queryPermission(o)) !== 'granted' && !(ask && (await h.requestPermission(o)) === 'granted')) { this.askOnce(); return 'perm'; }
    const out = await Backup.build(); if (!out) return 'empty';
    const fh = await h.getFileHandle(`دفتري ${ymd()}.daftari.json`, { create: true });
    const w = await fh.createWritable(); await w.write(out.blob); await w.close();
    const old = []; for await (const [nm, e] of h.entries()) if (e.kind === 'file' && this.NAME.test(nm)) old.push(nm);
    for (const nm of old.sort().slice(0, -7)) await h.removeEntry(nm).catch(() => {});
    Object.assign(c, { last: Date.now(), size: out.blob.size, sig, dir: h.name }); Settings.save();
    return 'ok';
  },
  // بعد إعادة تشغيل المتصفح ممكن يطلب الإذن مرة ثانية: ضغطة وحدة باليوم
  askOnce() {
    if (this._asked) return; this._asked = true;
    Toast.show({ icon: 'download', title: 'النسخ الاحتياطي التلقائي بدّه موافقتك', text: `ليكمّل يحفظ بمجلد «${this.c.dir || ''}».`, timeout: 15000, actions: [{ label: 'لاحقاً' }, { label: 'اسمح', primary: true, act: () => this.run(true, true).then(r => { if (r === 'ok') Toast.show({ icon: 'check', text: 'انحفظت نسخة اليوم ✓', timeout: 2500 }); }) }] });
  },
  noteManual() { this.c.last = Date.now(); Settings.save(); },
  // «افتح آخر نسخة»: أحدث ملف بالمجلد (مثلاً جهازك الثاني حفظه بـ OneDrive) — الكتب الأحدث بتتحدّث، والجديدة بتنضاف
  async restoreLatest() {
    const h = await this.dir();
    if (!h) { Toast.show({ icon: 'download', text: 'اختار مجلد النسخ الاحتياطي أول', timeout: 3000 }); return null; }
    const o = { mode: 'readwrite' };
    if ((await h.queryPermission(o)) !== 'granted' && (await h.requestPermission(o)) !== 'granted') return null;
    const names = []; for await (const [nm, e] of h.entries()) if (e.kind === 'file' && this.NAME.test(nm)) names.push(nm);
    if (!names.length) { Toast.show({ icon: 'download', text: 'ما في نسخ بهالمجلد لسا', timeout: 3000 }); return null; }
    const latest = names.sort().pop();
    const file = await (await h.getFileHandle(latest)).getFile();
    return Backup.importFile(file);
  },
  // بدون مجلد: كل أسبوع تذكير (بس إذا في كتب)
  async remind() {
    const c = this.c, ref = c.last || c.since || Date.now();
    if (Date.now() - ref < 7 * 864e5 || c.remindAt && Date.now() - c.remindAt < 864e5) return 'wait';
    if (!(await DB.all('books')).length || Tour.active) return 'empty';
    c.remindAt = Date.now(); Settings.save();
    Toast.show({ icon: 'download', title: 'صار إلك فترة بدون نسخة احتياطية', text: 'كتبك محفوظة بالمتصفح بس. نسخة على جهازك بتحميها لو انمسح المتصفح.', timeout: 15000, actions: [{ label: 'لاحقاً' }, this.can ? { label: 'نسخ تلقائي لمجلد', primary: true, act: () => this.pick() } : { label: 'نزّل نسخة', primary: true, act: () => Backup.exportBooks() }] });
    return 'reminded';
  },
  status() {
    const c = this.c;
    if (!this.can) return c.last ? `آخر نسخة: ${ago(c.last)}` : 'ما في نسخة لسا';
    if (!c.on) return 'مطفي — كتبك محفوظة بالمتصفح بس';
    return `شغّال على مجلد «${esc(c.dir || '')}»` + (c.last ? ` · آخر نسخة ${ago(c.last)} (${fmtSize(c.size || 0)})` : '');
  },
};

/* ============ التذكيرات: الطالب بيعملها بنفسه ============ */
const Reminders = {
  // القائمة بتبدأ فاضية — الطالب بيعمل تذكيراته بنفسه، وفي اقتراحات جاهزة بضغطة
  list: [],
  cfg: { sound: true, sys: false },
  TEMPLATES: [
    { icon: '💧', title: 'اشرب مي', text: 'كاسة مي هلّأ بتفرق مع تركيزك.', every: 40 },
    { icon: '🚶', title: 'قوم تحرّك', text: 'قوم امشي دقيقتين ومدّ ظهرك.', every: 50 },
    { icon: '👀', title: 'ريّح عيونك', text: 'طلّع على شي بعيد ٢٠ ثانية.', every: 20 },
    { icon: '🧘', title: 'نفس عميق', text: 'خذ ٣ أنفاس عميقة وارجع.', every: 60 },
    { icon: '📵', title: 'بعّد الجوال', text: 'خلي الجوال بعيد لحد ما تخلص.', every: 30 },
  ],
  EMOJIS: ['💧', '🚶', '👀', '🧘', '📵', '☕', '🍎', '📖', '✍️', '💤', '🧠', '⏰', '🌙', '⭐'],
  init() {
    try { Object.assign(this.cfg, JSON.parse(localStorage.getItem('remCfg') || '{}')); } catch { }
    try { this.list = JSON.parse(localStorage.getItem('reminders') || '[]'); } catch { this.list = []; }
    const now = Date.now();
    this.list.forEach(r => { if (!r.last || now - r.last > 6 * 3600e3) r.last = now; });
    this.save();
    setInterval(() => this.tick(), 20000);
  },
  save() { localStorage.setItem('reminders', JSON.stringify(this.list)); localStorage.setItem('remCfg', JSON.stringify(this.cfg)); },
  tick() {
    const now = Date.now();
    this.list.forEach(r => { if (r.on && now - (r.last || now) >= r.every * 60e3) { r.last = now; this.save(); this.fire(r); } });
  },
  fire(r) {
    if (this.cfg.sound) Sound.chime(true);
    Toast.show({
      emoji: r.icon, title: r.title, text: r.text || '', cls: 'rem', timeout: 60000, actions: [
        { label: 'بعد ٥ د', act: () => { r.last = Date.now() - (r.every - 5) * 60e3; this.save(); } },
        { label: 'تم ✓', primary: true },
      ],
    });
    if (this.cfg.sys && document.hidden && window.Notification && Notification.permission === 'granted') new Notification(`${r.icon} ${r.title}`, { body: r.text || '' });
  },
  add(t) { const r = { id: 'r' + uid(), icon: t.icon || '⏰', title: t.title, text: t.text || '', every: clamp(+t.every || 30, 1, 600), on: true, last: Date.now() }; this.list.push(r); this.save(); return r; },
  panel(anchor) {
    const n = el(`<div class="panel rem-panel">
      <h4>${ic('bell')} تذكيراتي</h4>
      <div class="rem-list"></div>
      <div class="rem-sugg-h lbl">اقتراحات — ضغطة وبتنضاف:</div>
      <div class="rem-sugg"></div>
      <details class="rem-new"><summary>${ic('plus')} تذكير جديد من عندي</summary>
        <div class="rem-emojis">${this.EMOJIS.map((e, i) => `<button type="button" data-e="${e}" class="${i === 11 ? 'on' : ''}">${e}</button>`).join('')}</div>
        <input class="inp" data-f="title" dir="auto" placeholder="شو بدك أذكّرك؟ مثلاً: راجع الفصل الثالث">
        <input class="inp" data-f="text" dir="auto" placeholder="ملاحظة صغيرة (اختياري)">
        <label class="rng"><span>كل كم دقيقة</span><input type="number" class="inp sm" data-f="every" min="1" max="600" value="30"><b>د</b></label>
        <button class="btn primary sm" data-a="create">إضافة</button>
      </details>
      <label class="chk"><input type="checkbox" data-k="sound" ${this.cfg.sound ? 'checked' : ''}> <span>صوت خفيف مع التذكير</span></label>
      <label class="chk"><input type="checkbox" data-k="sys" ${this.cfg.sys ? 'checked' : ''}> <span>إشعار ويندوز إذا النافذة مصغّرة</span></label>
      <div class="lbl">${ic('timer')} المؤقت: اسحب الحبل المعلّق فوق لتحت — كل ما سحبت أكثر زاد الوقت.</div>
      <div class="row"><button class="btn ghost sm" data-a="music">${ic('music')} الموسيقى</button><button class="btn ghost sm" data-a="journal">${ic('journal')} يومياتي</button></div>
    </div>`);
    let emoji = this.EMOJIS[11];
    const render = () => {
      $('.rem-list', n).innerHTML = this.list.length ? this.list.map(r => `<div class="rem-item ${r.on ? '' : 'off'}" data-id="${r.id}">
          <span class="rem-ic">${esc(r.icon)}</span>
          <div class="rem-t"><b dir="auto">${esc(r.title)}</b><small>كل ${r.every} دقيقة${r.text ? ' · ' + esc(r.text) : ''}</small></div>
          <label class="sw-toggle" title="تشغيل/إيقاف"><input type="checkbox" data-t="on" ${r.on ? 'checked' : ''}><i></i></label>
          <button class="ib" data-t="test" title="جرّبه">${ic('play')}</button>
          <button class="ib" data-t="del" title="حذف">${ic('trash')}</button></div>`).join('')
        : '<p class="muted rem-empty">ما في تذكيرات لسا. ضيف من الاقتراحات أو اعمل تذكير خاص فيك 👇</p>';
      const have = new Set(this.list.map(r => r.title));
      $('.rem-sugg', n).innerHTML = this.TEMPLATES.filter(t => !have.has(t.title)).map(t => `<button type="button" data-tpl="${esc(t.title)}">${t.icon} ${esc(t.title)} <small>كل ${t.every} د</small></button>`).join('') || '<small class="muted">ضفت كل الاقتراحات ✓</small>';
    };
    n.addEventListener('click', e => {
      const tpl = e.target.closest('[data-tpl]');
      if (tpl) { this.add(this.TEMPLATES.find(t => t.title === tpl.dataset.tpl)); render(); return; }
      const em = e.target.closest('[data-e]');
      if (em) { emoji = em.dataset.e; $$('[data-e]', n).forEach(x => x.classList.toggle('on', x === em)); return; }
      const row = e.target.closest('.rem-item'), r = row && this.list.find(x => x.id === row.dataset.id);
      const t = e.target.closest('[data-t]');
      if (t && r) {
        if (t.dataset.t === 'del') { this.list = this.list.filter(x => x !== r); this.save(); render(); }
        else if (t.dataset.t === 'test') this.fire(r);
        return;
      }
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'create') {
        const title = $('[data-f=title]', n).value.trim();
        if (!title) { $('[data-f=title]', n).focus(); return; }
        this.add({ icon: emoji, title, text: $('[data-f=text]', n).value.trim(), every: $('[data-f=every]', n).value });
        $('[data-f=title]', n).value = ''; $('[data-f=text]', n).value = '';
        render();
        Toast.show({ emoji, text: `انضاف التذكير: ${title}`, timeout: 2200 });
      } else if (a.dataset.a === 'music') Music.panel($('#btnSound'));
      else if (a.dataset.a === 'journal') { Pop.close(); Study.journalPanel(); }
    });
    n.addEventListener('change', async e => {
      if (e.target.dataset.t === 'on') {
        const r = this.list.find(x => x.id === e.target.closest('.rem-item').dataset.id);
        r.on = e.target.checked; r.last = Date.now(); this.save(); e.target.closest('.rem-item').classList.toggle('off', !r.on); return;
      }
      const k = e.target.dataset.k; if (!k) return;
      this.cfg[k] = e.target.checked;
      if (k === 'sys' && e.target.checked && window.Notification && Notification.permission !== 'granted') {
        const p = await Notification.requestPermission().catch(() => 'denied');
        if (p !== 'granted') { this.cfg.sys = false; e.target.checked = false; Toast.show({ icon: 'bell', text: 'لم يُسمح بالإشعارات' }); }
      }
      this.save();
    });
    render();
    Pop.open(anchor, n, { cls: 'panel-pop', place: 'above' });
  },
};

/* ============ التصدير PDF ============ */
const Exporter = {
  // قبل الطباعة: كل الدفتر، أو الصفحتين اللي قدامك، أو من صفحة لصفحة (مثلاً الفصل الثالث بس)
  choose() {
    const R = Reader; if (!R.book) return;
    Editor.flushAll();
    const empty = p => !p.html && !p.bg && !(p.stickies || []).length && !(p.attach || []).length;
    let last = R.pages.length - 1; while (last > 0 && empty(R.pages[last])) last--;
    const s0 = Math.max(0, 2 * R.s), s1 = Math.min(last, s0 + 1);
    const n = el(`<form class="prt" autocomplete="off">
      <div class="jf-head">${ic('pdf')}<div><h3>طباعة / PDF</h3><p class="muted">من نافذة الطباعة اختار «حفظ كـ PDF» إذا بدك ملف.</p></div></div>
      <label class="prt-o"><input type="radio" name="w" value="all" checked> <span><b>كل الدفتر</b> <small>${last + 1} صفحة مع الغلاف</small></span></label>
      ${R.s >= 0 ? `<label class="prt-o"><input type="radio" name="w" value="here"> <span><b>الصفحات اللي قدامي</b> <small>${s0 + 1}${s1 > s0 ? '–' + (s1 + 1) : ''}</small></span></label>` : ''}
      <label class="prt-o"><input type="radio" name="w" value="range"> <span><b>من صفحة</b> <input class="inp prt-n" type="number" name="from" min="1" max="${last + 1}" value="${s0 + 1}"> <b>لـ</b> <input class="inp prt-n" type="number" name="to" min="1" max="${last + 1}" value="${Math.min(last + 1, s0 + 4)}"></span></label>
      <div class="row end"><button type="button" class="btn ghost" data-a="cancel">إلغاء</button><button class="btn primary">${ic('pdf')} اطبع</button></div></form>`);
    const m = Modal.open(n, { cls: 'sm' });
    $$('.prt-n', n).forEach(i => i.addEventListener('focus', () => { n.w.value = 'range'; }));
    $('[data-a=cancel]', n).onclick = () => m.close();
    n.onsubmit = e => {
      e.preventDefault();
      const w = n.w.value;
      let range = null;
      if (w === 'here') range = { from: s0, to: s1 };
      else if (w === 'range') { const a = clamp((+n.from.value || 1) - 1, 0, last), b = clamp((+n.to.value || 1) - 1, 0, last); range = { from: Math.min(a, b), to: Math.max(a, b) }; }
      m.close();
      setTimeout(() => this.pdf(range), 250);
    };
  },
  async pdf(range = null) {
    const R = Reader;
    if (!R.book || this.busy) return;
    this.busy = true;
    setTimeout(() => { this.busy = false; }, 4000);
    Editor.flushAll();
    Pop.close(); Editor.hideBars();
    const box = $('#print');
    box.innerHTML = '';
    box.className = R.paperClasses();
    box.removeAttribute('style');
    const v = R.paperVars();
    for (const k in v) box.style.setProperty(k, v[k]);
    const empty = p => !p.html && !(p.stickies || []).length && !(p.attach || []).length;
    let last = R.pages.length - 1;
    while (last > 0 && empty(R.pages[last])) last--;
    const add = (node, cls = '') => { const s = el(`<section class="pp ${cls}"></section>`); s.append(node); box.append(s); return s; };
    // الغلاف بس لما تطبع الدفتر كله
    if (!range) add(R.coverPage('right'), 'pp-cover').style.setProperty('--cvbg', (R.book.cover && R.book.cover.color) || '#1d2b53');
    const from = range ? range.from : 0, to = range ? Math.min(range.to, R.pages.length - 1) : last;
    for (let i = from; i <= to; i++) add(R.pageEl(i, false, R.sideOfIndex(i)));
    $$('figure.media video, .sticky.video video', box).forEach(vd => vd.replaceWith(el(`<div class="vid-ph">${ic('film')}<span>فيديو مرفق داخل الدفتر</span></div>`)));
    $$('.flipzone', box).forEach(x => x.remove());
    Toast.show({ icon: 'pdf', title: 'تصدير PDF', text: 'من نافذة الطباعة اختر «حفظ كـ PDF» أو «Microsoft Print to PDF» واضغط حفظ.', timeout: 6000 });
    await Media.hydrate(box);
    const old = document.title;
    document.title = R.book.title;
    const done = () => { box.innerHTML = ''; document.title = old; document.body.classList.remove('printing'); };
    addEventListener('afterprint', done, { once: true });
    document.body.classList.add('printing');
    await raf(); await raf();
    window.print();
  },
};

/* ============ النسخ الاحتياطي ============ */
function blobToDataURL(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); }); }
function dataURLToBlob(d) {
  const i = d.indexOf(','), head = d.slice(0, i), b64 = d.slice(i + 1);
  const mime = (head.match(/data:([^;,]+)/) || [])[1] || '';
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
  return new Blob([u], { type: mime });
}
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[\\/:*?"<>|]+/g, '-');
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const Backup = {
  async exportBooks(ids = null) {
    const close = Toast.show({ icon: 'download', text: 'جاري تجهيز النسخة الاحتياطية…', timeout: 0 });
    const out = await this.build(ids);
    close();
    if (!out) { Toast.show({ icon: 'books', text: 'لا توجد كتب للحفظ' }); return; }
    downloadBlob(out.blob, (out.books.length === 1 ? out.books[0].title : 'مكتبة دفتري') + ' ' + new Date().toISOString().slice(0, 10) + '.daftari.json');
    Toast.show({ icon: 'download', text: 'حُفظت النسخة في مجلد التنزيلات (Downloads)', timeout: 4000 });
    if (!ids) AutoBackup.noteManual();
  },
  // ملف النسخة (نفس الملف للتنزيل وللنسخ التلقائي)
  async build(ids = null) {
    Editor.flushAll();
    const all = await DB.all('books');
    const books = ids ? all.filter(b => ids.includes(b.id)) : all;
    if (!books.length) return null;
    const pages = [], ids2 = new Set();
    for (const b of books) {
      const ps = (await DB.getMany('pages', b.pageIds || [])).filter(Boolean);
      ps.forEach(p => { pages.push(p); collectBlobs(p).forEach(x => ids2.add(x)); });
      if (b.cover && b.cover.image) ids2.add(b.cover.image);
    }
    // المواد وملفات الـPDF والتقويم (للنسخة الكاملة كل شي، ولكتاب: ملفاته بس)
    const sids = new Set(books.map(b => b.subjectId));
    const subjects = (await DB.all('subjects')).filter(s => !s.sys && sids.has(s.id));
    const files = (await DB.all('files')).filter(f => ids ? ids.includes(f.bookId) : true);
    files.forEach(f => ids2.add(f.blob));
    const plans = ids ? [] : await DB.all('plans');
    const blobs = [];
    for (const id of ids2) { const r = await DB.get('blobs', id); if (r) blobs.push({ id, type: r.type, data: await blobToDataURL(r.blob) }); }
    const pids = new Set(pages.map(p => p.id));
    const blob = new Blob([JSON.stringify({ app: 'daftari', v: 1, at: Date.now(), books, pages, blobs, links: (await DB.all('links')).filter(x => pids.has(x.a) && pids.has(x.b)), subjects, files, plans })], { type: 'application/json' });
    return { blob, books };
  },
  // استعادة: من ملف بتختاره، أو ملف جاهز (مثلاً آخر نسخة بمجلد النسخ التلقائي)
  async importFile(file = null) {
    const f = file || await pickFile('.json,application/json');
    if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); if (data.app !== 'daftari') throw 0; }
    catch { Toast.show({ icon: 'x', text: 'الملف ليس نسخة احتياطية من دفتري' }); return; }
    const existing = await DB.all('books');
    const have = new Set(existing.map(b => b.id));
    for (const bl of data.blobs || []) {
      if (await DB.get('blobs', bl.id)) continue;
      const blob = dataURLToBlob(bl.data);
      await DB.put('blobs', { id: bl.id, blob, type: bl.type || blob.type, size: blob.size });
    }
    for (const x of data.links || []) if (!(await DB.get('links', x.id))) await DB.put('links', x);
    for (const st of ['subjects', 'files', 'plans']) for (const x of data[st] || []) if (!(await DB.get(st, x.id))) await DB.put(st, x);
    await IdeaWeb.load();
    let added = 0, skipped = 0, updated = 0;
    for (const b of data.books || []) {
      if (have.has(b.id)) {
        // نفس الكتاب: إذا النسخة أحدث (كتبت عليه بجهاز ثاني) بنحدّثه، وإلا بنتركه
        const mine = existing.find(x => x.id === b.id);
        if (!((b.updated || 0) > (mine.updated || 0))) { skipped++; continue; }
        if (Reader.book && Reader.book.id === b.id) Reader.close();
        const gone = (mine.pageIds || []).filter(id => !(b.pageIds || []).includes(id));
        if (gone.length) await DB.delMany('pages', gone);
        await DB.putMany('pages', (data.pages || []).filter(p => p.bookId === b.id).map(p => ({ ...p, html: stripAns(p.html) })));
        await DB.put('books', b);
        updated++; continue;
      }
      let t = b.title, n = 2;
      while (existing.some(x => normTitle(x.title) === normTitle(t))) t = `${b.title} (${n++})`;
      b.title = t;
      await DB.putMany('pages', (data.pages || []).filter(p => p.bookId === b.id).map(p => ({ ...p, html: stripAns(p.html) })));
      await DB.put('books', b);
      existing.push(b); added++;
    }
    Toast.show({ icon: 'upload', text: `تمت استعادة ${added} كتاب` + (updated ? `، وتحدّث ${updated}` : '') + (skipped ? ` (${skipped} زي ما هو)` : '') });
    Library.load();
    return { added, updated, skipped };
  },
};
