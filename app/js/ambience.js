'use strict';
/* ============ أصوات الجو: مولّدة بالكود (بدون ملفات) + أصوات من جهازك ============ */
const Ambience = {
  SOUNDS: [
    ['rain', 'مطر خفيف', '🌧'], ['storm', 'مطر غزير', '⛈'], ['waves', 'موج البحر', '🌊'], ['fire', 'نار المدفأة', '🔥'],
    ['wind', 'ريح', '🍃'], ['night', 'ليل وصراصير', '🦗'], ['brown', 'ضجيج هادئ للتركيز', '🟤'],
  ],
  cfg: { sound: 'rain', vol: 0.45, withSession: true },
  custom: [], // [{id, name}] والملف نفسه محفوظ في التخزين
  playing: false, cur: null, master: null, audio: null, _buf: {},

  init() {
    try { Object.assign(this.cfg, JSON.parse(localStorage.getItem('amb') || '{}')); } catch { }
    try { this.custom = JSON.parse(localStorage.getItem('ambCustom') || '[]'); } catch { this.custom = []; }
  },
  save() { localStorage.setItem('amb', JSON.stringify(this.cfg)); localStorage.setItem('ambCustom', JSON.stringify(this.custom)); },
  ctx() { return Sound.ac(); },
  gainFor(v) { return v * v * 0.9; },

  noise(kind) {
    if (this._buf[kind]) return this._buf[kind];
    const c = this.ctx(), len = c.sampleRate * 5;
    const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
        b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
      } else { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
    }
    // تنعيم طرفي الحلقة لمنع الطقطقة
    for (let i = 0; i < 2000; i++) { const k = i / 2000; d[i] *= k; d[len - 1 - i] *= k; }
    return (this._buf[kind] = b);
  },
  loop(buf) { const s = this.ctx().createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 4); return s; },
  filter(type, f, q = .7) { const x = this.ctx().createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; },
  gain(v) { const g = this.ctx().createGain(); g.gain.value = v; return g; },
  lfo(freq, depth, target) { const o = this.ctx().createOscillator(), g = this.gain(depth); o.frequency.value = freq; o.connect(g).connect(target); o.start(); return o; },
  // سلسلة: مصدر ← فلاتر ← مخرج
  chain(src, ...nodes) { let x = src; nodes.forEach(n => { x.connect(n); x = n; }); return src; },
  burst(out, { f = 3000, q = 2, amp = .1, dur = .03, at = 0 }) {
    const c = this.ctx(), t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noise('white');
    const g = c.createGain();
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    this.chain(s, this.filter('bandpass', f, q), g, out);
    s.start(t, Math.random() * 4); s.stop(t + dur + .02);
  },
  tone(out, { f, amp, dur, at = 0 }) {
    const c = this.ctx(), t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + .02);
  },
  // كل صوت يرجع دالة إيقاف
  gens: {
    rain(A, out, heavy = false) {
      const n = A.chain(A.loop(A.noise('pink')), A.filter('highpass', heavy ? 300 : 500), A.filter('lowpass', heavy ? 8000 : 6000), A.gain(heavy ? .75 : .45), out);
      const drops = setInterval(() => {
        for (let i = 0; i < (heavy ? 5 : 2); i++) if (Math.random() < .8) A.burst(out, { f: 1800 + Math.random() * 4500, q: 2.5, amp: (heavy ? .12 : .07) * Math.random(), dur: .02 + Math.random() * .03, at: Math.random() * .05 });
      }, 50);
      const thunder = heavy ? setInterval(() => {
        if (Math.random() > .25) return;
        const tg = A.gain(0), b = A.chain(A.loop(A.noise('brown')), A.filter('lowpass', 180), tg, out);
        const t = A.ctx().currentTime;
        tg.gain.setValueAtTime(0, t); tg.gain.linearRampToValueAtTime(.9, t + .4); tg.gain.exponentialRampToValueAtTime(.0001, t + 4);
        setTimeout(() => b.stop(), 4200);
      }, 9000) : 0;
      return () => { clearInterval(drops); clearInterval(thunder); n.stop(); };
    },
    storm(A, out) { return A.gens.rain(A, out, true); },
    waves(A, out) {
      const g = A.gain(.35), g2 = A.gain(.04);
      const n = A.chain(A.loop(A.noise('brown')), A.filter('lowpass', 750), g, out);
      const w = A.chain(A.loop(A.noise('pink')), A.filter('bandpass', 1400, .4), g2, out);
      const o1 = A.lfo(.075, .3, g.gain), o2 = A.lfo(.075, .04, g2.gain);
      return () => { n.stop(); w.stop(); o1.stop(); o2.stop(); };
    },
    wind(A, out) {
      const g = A.gain(.55), bp = A.filter('bandpass', 600, .9);
      const n = A.chain(A.loop(A.noise('pink')), bp, g, out);
      const o1 = A.lfo(.05, 300, bp.frequency), o2 = A.lfo(.11, .22, g.gain);
      return () => { n.stop(); o1.stop(); o2.stop(); };
    },
    fire(A, out) {
      const g = A.gain(.6);
      const n = A.chain(A.loop(A.noise('brown')), A.filter('lowpass', 420), g, out);
      const o = A.lfo(.3, .12, g.gain);
      const cr = setInterval(() => {
        if (Math.random() < .45) A.burst(out, { f: 1500 + Math.random() * 2800, q: 1.5, amp: .05 + Math.random() * .3, dur: .008 + Math.random() * .02 });
        if (Math.random() < .05) for (let i = 0; i < 4; i++) A.burst(out, { f: 2500, q: 1, amp: .15 * Math.random(), dur: .01, at: i * .03 });
      }, 70);
      return () => { clearInterval(cr); n.stop(); o.stop(); };
    },
    night(A, out) {
      const n = A.chain(A.loop(A.noise('pink')), A.filter('lowpass', 900), A.gain(.07), out);
      const chirp = () => {
        const f = Math.random() < .5 ? 4300 : 3700, pulses = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < pulses; i++) A.tone(out, { f, amp: .025, dur: .03, at: i * .055 });
      };
      const iv = setInterval(() => { if (Math.random() < .7) chirp(); }, 650);
      return () => { clearInterval(iv); n.stop(); };
    },
    brown(A, out) {
      const n = A.chain(A.loop(A.noise('brown')), A.filter('lowpass', 1000), A.gain(.85), out);
      return () => n.stop();
    },
  },
  async play(sound = this.cfg.sound) {
    this.stop(true);
    this.cfg.sound = sound; this.save();
    if (sound.startsWith('m')) { // صوت من الجهاز
      const u = await Media.url(sound);
      if (!u) { Toast.show({ icon: 'x', text: 'الملف الصوتي غير موجود' }); return; }
      this.audio = new Audio(u); this.audio.loop = true; this.audio.volume = this.cfg.vol;
      this.audio.play().catch(() => { });
    } else {
      const c = this.ctx();
      this.master = c.createGain(); this.master.gain.value = 0;
      this.master.connect(c.destination);
      this.master.gain.linearRampToValueAtTime(this.gainFor(this.cfg.vol), c.currentTime + 1.5);
      this.cur = (this.gens[sound] || this.gens.rain)(this, this.master);
    }
    this.playing = true;
    this.ui();
  },
  stop(now = false) {
    const m = this.master, cur = this.cur, a = this.audio;
    this.master = null; this.cur = null; this.audio = null; this.playing = false;
    if (m) {
      const c = this.ctx(), t = c.currentTime;
      m.gain.cancelScheduledValues(t); m.gain.setValueAtTime(m.gain.value, t); m.gain.linearRampToValueAtTime(0, t + (now ? .15 : 1.2));
      setTimeout(() => { cur && cur(); m.disconnect(); }, now ? 200 : 1300);
    }
    if (a) { a.pause(); a.src = ''; }
    this.ui();
  },
  toggle() { if (this.playing) this.stop(); else this.play(); },
  setVol(v) {
    this.cfg.vol = v; this.save();
    if (this.master) { const t = this.ctx().currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(this.gainFor(v), t, .1); }
    if (this.audio) this.audio.volume = v;
  },
  async addCustom() {
    const fs = await pickFile('audio/*', true);
    for (const f of fs) {
      if (f.size > 80 * 1048576) { Toast.show({ icon: 'x', text: `«${f.name}» كبير جداً (أكثر من 80 ميجا)` }); continue; }
      const id = await Media.save(f);
      this.custom.push({ id, name: f.name.replace(/\.[^.]+$/, '').slice(0, 40) });
    }
    this.save();
    if (fs.length) this.play(this.custom[this.custom.length - 1].id);
  },
  removeCustom(id) {
    if (this.cfg.sound === id) { this.stop(true); this.cfg.sound = 'rain'; }
    this.custom = this.custom.filter(x => x.id !== id); this.save();
    Media.del(id);
  },
  ui() {
    const b = $('#btnSound');
    if (b) { b.classList.toggle('on', this.playing); b.title = this.playing ? 'أصوات الجو (شغّالة)' : 'أصوات الجو'; }
    const p = Pop.cur && Pop.cur.querySelector('.amb-panel');
    if (p) this.syncPanel(p);
  },
  syncPanel(n) {
    $$('[data-snd]', n).forEach(b => b.classList.toggle('on', b.dataset.snd === this.cfg.sound));
    const pb = $('.amb-play', n);
    pb.innerHTML = this.playing ? `${ic('pause')} إيقاف` : `${ic('play')} تشغيل`;
    pb.classList.toggle('primary', !this.playing); pb.classList.toggle('ghost', this.playing);
  },
  panel(anchor) {
    const n = el(`<div class="panel amb-panel">
      <h4>${ic('moon')} أصوات الجو</h4>
      <div class="amb-grid">${this.SOUNDS.map(([k, t, e]) => `<button data-snd="${k}"><i>${e}</i><span>${t}</span></button>`).join('')}
        ${this.custom.map(x => `<button data-snd="${x.id}" class="mine"><i>🎵</i><span>${esc(x.name)}</span><em data-del="${x.id}" title="إزالة">×</em></button>`).join('')}
      </div>
      <button class="btn ghost sm" data-a="add">${ic('upload')} صوت من جهازي</button>
      <label class="rng"><span>الصوت</span><input type="range" min="0" max="1" step="0.01" value="${this.cfg.vol}" data-a="vol"><b>${Math.round(this.cfg.vol * 100)}</b></label>
      <label class="chk"><input type="checkbox" data-a="session" ${this.cfg.withSession ? 'checked' : ''}> <span>يشتغل لحاله لما أبدأ جلسة دراسة (الحبل)</span></label>
      <button class="btn amb-play"></button>
    </div>`);
    n.addEventListener('click', e => {
      const del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); this.removeCustom(del.dataset.del); del.closest('button').remove(); this.syncPanel(n); return; }
      const s = e.target.closest('[data-snd]');
      if (s) { this.play(s.dataset.snd); return; }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'add') { Pop.close(); this.addCustom(); }
    });
    $('.amb-play', n).onclick = () => this.toggle();
    n.addEventListener('input', e => { if (e.target.dataset.a === 'vol') { this.setVol(+e.target.value); e.target.nextElementSibling.textContent = Math.round(e.target.value * 100); } });
    n.addEventListener('change', e => { if (e.target.dataset.a === 'session') { this.cfg.withSession = e.target.checked; this.save(); } });
    this.syncPanel(n);
    Pop.open(anchor, n, { cls: 'panel-pop', place: 'above' });
  },
};
