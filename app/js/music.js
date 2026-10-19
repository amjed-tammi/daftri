'use strict';
/* ============ موسيقى الخلفية: المستخدم بيرفع موسيقاه، وكل كتاب إله موسيقاه ============ */
const Music = {
  tracks: [], // [{id, name}] والملف نفسه محفوظ بالتخزين المحلي
  cfg: { vol: 0.5, repeat: 'all' }, // repeat: one | all | shuffle
  audio: new Audio(), cur: null, playing: false, autoBook: null, _fade: 0,

  init() {
    try { Object.assign(this.cfg, JSON.parse(localStorage.getItem('musicCfg') || '{}')); } catch { }
    try { this.tracks = JSON.parse(localStorage.getItem('musicTracks') || '[]'); } catch { this.tracks = []; }
    // نقل الأصوات اللي كانت مرفوعة بالنسخة القديمة (أصوات الجو)
    try {
      const old = JSON.parse(localStorage.getItem('ambCustom') || '[]');
      old.forEach(x => { if (!this.tracks.some(t => t.id === x.id)) this.tracks.push({ id: x.id, name: x.name }); });
      if (old.length) { localStorage.removeItem('ambCustom'); this.save(); }
    } catch { }
    this.audio.preload = 'none';
    this.audio.onended = () => this.next(true);
    this.audio.onplay = () => { this.playing = true; this.ui(); };
    this.audio.onpause = () => { this.playing = false; this.ui(); };
    this.ui();
  },
  save() { localStorage.setItem('musicTracks', JSON.stringify(this.tracks)); localStorage.setItem('musicCfg', JSON.stringify(this.cfg)); },
  has(id) { return !!id && this.tracks.some(t => t.id === id); },
  name(id) { const t = this.tracks.find(x => x.id === id); return t ? t.name : ''; },

  fadeTo(v, ms = 900, then) {
    clearInterval(this._fade);
    const a = this.audio, from = a.volume, t0 = performance.now();
    this._fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = clamp(from + (v - from) * k, 0, 1);
      if (k >= 1) { clearInterval(this._fade); then && then(); }
    }, 40);
  },
  async play(id = this.cur || (this.tracks[0] && this.tracks[0].id)) {
    if (!id || !this.has(id)) { if (!this.tracks.length) Toast.show({ icon: 'music', text: 'ما في موسيقى لسا — ارفع من زر ♫ تحت على اليسار', timeout: 3500 }); return; }
    if (this.cur === id && !this.audio.paused) return;
    const u = await Media.url(id);
    if (!u) { Toast.show({ icon: 'x', text: 'ملف الموسيقى مش موجود' }); return; }
    if (this.cur !== id) { this.audio.src = u; this.cur = id; }
    this.audio.loop = this.cfg.repeat === 'one' || this.tracks.length === 1;
    this.audio.volume = 0;
    try { await this.audio.play(); } catch { }
    this.fadeTo(this.cfg.vol);
    this.ui();
  },
  stop(fade = true) {
    if (this.audio.paused) return;
    if (fade) this.fadeTo(0, 700, () => this.audio.pause()); else this.audio.pause();
  },
  toggle() { if (this.audio.paused) this.play(); else this.stop(); },
  next(auto = false) {
    if (!this.tracks.length) return;
    const i = this.tracks.findIndex(t => t.id === this.cur);
    let j = this.cfg.repeat === 'shuffle' ? Math.floor(Math.random() * this.tracks.length) : (i + 1) % this.tracks.length;
    if (this.cfg.repeat === 'shuffle' && this.tracks.length > 1 && j === i) j = (j + 1) % this.tracks.length;
    if (auto && this.cfg.repeat === 'one') j = Math.max(0, i);
    this.cur = null;
    this.play(this.tracks[j].id);
  },
  setVol(v) { this.cfg.vol = v; this.save(); clearInterval(this._fade); this.audio.volume = v; },

  // الكتاب لما ينفتح: بيشغّل موسيقاه إذا مفعّل
  onBookOpen(b) {
    const r = Settings.bookMusic(b);
    if (r.auto && r.track) { this.autoBook = b.id; this.play(r.track); }
    else if (this.autoBook && this.autoBook !== b.id) { this.autoBook = null; this.stop(); }
  },
  onBookClose() { if (this.autoBook) { this.autoBook = null; this.stop(); } },
  // جلسة الدراسة
  forSession() {
    if (!Settings.d.music.session || !this.audio.paused) return false;
    const r = Reader.book ? Settings.bookMusic(Reader.book) : { track: Settings.d.music.track };
    const id = r.track || Settings.d.music.track || (this.tracks[0] && this.tracks[0].id);
    if (!id) return false;
    this.play(id); return true;
  },

  async add() {
    const fs = await pickFile('audio/*', true);
    let last = null;
    for (const f of fs) {
      if (f.size > 120 * 1048576) { Toast.show({ icon: 'x', text: `«${f.name}» كبير جداً (أكثر من 120 ميجا)` }); continue; }
      const id = await Media.save(f);
      this.tracks.push({ id, name: f.name.replace(/\.[^.]+$/, '').slice(0, 50) });
      last = id;
    }
    this.save();
    if (last) { Toast.show({ icon: 'music', text: fs.length > 1 ? `انضافت ${fs.length} مقاطع ✓` : 'انضافت ✓', timeout: 2000 }); this.play(last); }
    return last;
  },
  async remove(id) {
    if (this.cur === id) { this.audio.pause(); this.audio.removeAttribute('src'); this.cur = null; }
    this.tracks = this.tracks.filter(t => t.id !== id);
    if (Settings.d.music.track === id) { Settings.d.music.track = null; Settings.save(); }
    this.save();
    Media.del(id);
  },
  rename(id, name) { const t = this.tracks.find(x => x.id === id); if (t && name.trim()) { t.name = name.trim().slice(0, 50); this.save(); } },

  ui() {
    const b = $('#btnSound');
    if (b) { b.classList.toggle('on', !this.audio.paused); b.title = !this.audio.paused ? `الموسيقى: ${this.name(this.cur)}` : 'موسيقى الخلفية'; }
    const p = Pop.cur && Pop.cur.querySelector('.music-panel');
    if (p) this.sync(p);
  },
  sync(n) {
    $$('.mu-row', n).forEach(r => {
      const on = r.dataset.id === this.cur && !this.audio.paused;
      r.classList.toggle('on', on);
      $('.mu-play', r).innerHTML = ic(on ? 'pause' : 'play');
      $('.mu-def', r).classList.toggle('on', Settings.d.music.track === r.dataset.id);
      const bk = $('.mu-book', r); if (bk) bk.classList.toggle('on', !!Reader.book && (Reader.book.music || {}).track === r.dataset.id);
    });
    $$('[data-rep]', n).forEach(x => x.classList.toggle('on', x.dataset.rep === this.cfg.repeat));
    const pb = $('.mu-main', n);
    if (pb) pb.innerHTML = !this.audio.paused ? `${ic('pause')} إيقاف` : `${ic('play')} تشغيل`;
  },
  panel(anchor) {
    const inBook = !!Reader.book && !$('#reader').hidden;
    const n = el(`<div class="panel music-panel">
      <h4>${ic('music')} موسيقى الخلفية</h4>
      <div class="mu-list">${this.tracks.length ? this.tracks.map(t => `<div class="mu-row" data-id="${t.id}">
          <button class="ib mu-play" title="تشغيل">${ic('play')}</button>
          <span class="mu-name" title="دبل كليك لتغيير الاسم" dir="auto">${esc(t.name)}</span>
          ${inBook ? `<button class="ib mu-book" title="خليها موسيقى هالكتاب">${ic('bookmark')}</button>` : ''}
          <button class="ib mu-def" title="خليها الموسيقى الافتراضية">${ic('star')}</button>
          <button class="ib mu-del" title="حذف">${ic('trash')}</button></div>`).join('')
        : '<p class="muted mu-empty">مكتبتك فاضية 🎵 ارفع أغاني أو أصوات (مطر، بيانو، lo-fi…) من جهازك.</p>'}</div>
      <button class="btn ghost sm" data-a="add">${ic('upload')} ارفع موسيقى من جهازي</button>
      <label class="rng"><span>الصوت</span><input type="range" min="0" max="1" step="0.01" value="${this.cfg.vol}" data-a="vol"><b>${Math.round(this.cfg.vol * 100)}</b></label>
      <div class="seg"><button data-rep="all">🔁 الكل</button><button data-rep="one">🔂 وحدة</button><button data-rep="shuffle">🔀 عشوائي</button></div>
      <p class="lbl">${ic('star')} = الافتراضية لكل الكتب${inBook ? ` · ${ic('bookmark')} = موسيقى هالكتاب` : ''}</p>
      ${this.tracks.length ? '<button class="btn primary mu-main"></button>' : ''}
    </div>`);
    n.addEventListener('click', async e => {
      const row = e.target.closest('.mu-row'), id = row && row.dataset.id;
      if (e.target.closest('.mu-play')) { if (this.cur === id && !this.audio.paused) this.stop(); else { this.cur !== id && (this.cur = null); this.play(id); } return; }
      if (e.target.closest('.mu-def')) { Settings.d.music.track = Settings.d.music.track === id ? null : id; Settings.save(); this.sync(n); Toast.show({ icon: 'star', text: Settings.d.music.track ? 'صارت الموسيقى الافتراضية ✓' : 'انشالت من الافتراضي', timeout: 1800 }); return; }
      if (e.target.closest('.mu-book')) { const b = Reader.book; b.music = b.music || {}; b.music.track = b.music.track === id ? 'default' : id; if (b.music.track !== 'default') b.music.auto = true; Reader.saveBook(); this.sync(n); Toast.show({ icon: 'bookmark', text: b.music.track === 'default' ? 'رجعت للموسيقى الافتراضية' : `صارت موسيقى «${b.title}» وبتشتغل لحالها ✓`, timeout: 2400 }); return; }
      if (e.target.closest('.mu-del')) { if (await Modal.confirm('حذف الموسيقى', `حذف «${this.name(id)}» من مكتبتك؟`, { ok: 'حذف', danger: true })) { await this.remove(id); row.remove(); } return; }
      const rep = e.target.closest('[data-rep]'); if (rep) { this.cfg.repeat = rep.dataset.rep; this.audio.loop = this.cfg.repeat === 'one'; this.save(); this.sync(n); return; }
      if (e.target.closest('[data-a=add]')) { Pop.close(); await this.add(); this.panel(anchor); return; }
      if (e.target.closest('.mu-main')) this.toggle();
    });
    n.addEventListener('dblclick', e => {
      const nm = e.target.closest('.mu-name'); if (!nm) return;
      const id = nm.closest('.mu-row').dataset.id;
      const inp = el(`<input class="inp sm mu-rename" dir="auto" value="${esc(this.name(id))}">`);
      nm.replaceWith(inp); inp.focus(); inp.select();
      const done = () => { this.rename(id, inp.value); const s = el(`<span class="mu-name" dir="auto" title="دبل كليك لتغيير الاسم">${esc(this.name(id))}</span>`); inp.replaceWith(s); };
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(); ev.stopPropagation(); });
      inp.addEventListener('blur', done);
    });
    n.addEventListener('input', e => { if (e.target.dataset.a === 'vol') { this.setVol(+e.target.value); e.target.nextElementSibling.textContent = Math.round(e.target.value * 100); } });
    this.sync(n);
    Pop.open(anchor, n, { cls: 'panel-pop', place: 'above' });
  },
};
