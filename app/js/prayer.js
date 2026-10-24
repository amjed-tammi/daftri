'use strict';
/* ============ أوقات الصلاة (Aladhan — مجاني وبدون مفتاح) ============
   منجيب الشهر كامل بطلب واحد ومنخزّنه، فبيضل شغّال بدون إنترنت لآخر الشهر (والشهر الجاي بينجاب قبل ما يخلص).
   الموقع: مدينة من القائمة أو «حدّد موقعي». طريقة الحساب: تلقائي حسب البلد أو بتختارها.
   بالمكتبة: «الصلاة الجاية» وقديش باقي. وقت الأذان: تذكير هادئ، وإذا في جلسة دراسة بالحبل: «وقّف الجلسة للصلاة». */
const PRAYER_API = 'https://api.aladhan.com/v1/';
const PRAYERS = [['Fajr', 'الفجر'], ['Sunrise', 'الشروق'], ['Dhuhr', 'الظهر'], ['Asr', 'العصر'], ['Maghrib', 'المغرب'], ['Isha', 'العشاء']];
const PRAYER_CITIES = [['عمّان', 'Amman', 'Jordan'], ['إربد', 'Irbid', 'Jordan'], ['الزرقاء', 'Zarqa', 'Jordan'], ['العقبة', 'Aqaba', 'Jordan'], ['القدس', 'Jerusalem', 'Palestine'], ['رام الله', 'Ramallah', 'Palestine'], ['نابلس', 'Nablus', 'Palestine'], ['الخليل', 'Hebron', 'Palestine'], ['غزة', 'Gaza', 'Palestine'], ['الرياض', 'Riyadh', 'Saudi Arabia'], ['جدة', 'Jeddah', 'Saudi Arabia'], ['مكة', 'Makkah', 'Saudi Arabia'], ['القاهرة', 'Cairo', 'Egypt'], ['الإسكندرية', 'Alexandria', 'Egypt'], ['دبي', 'Dubai', 'United Arab Emirates'], ['أبوظبي', 'Abu Dhabi', 'United Arab Emirates'], ['الكويت', 'Kuwait City', 'Kuwait'], ['الدوحة', 'Doha', 'Qatar'], ['المنامة', 'Manama', 'Bahrain'], ['مسقط', 'Muscat', 'Oman'], ['بيروت', 'Beirut', 'Lebanon'], ['دمشق', 'Damascus', 'Syria'], ['بغداد', 'Baghdad', 'Iraq'], ['الدار البيضاء', 'Casablanca', 'Morocco'], ['الجزائر', 'Algiers', 'Algeria'], ['تونس', 'Tunis', 'Tunisia'], ['الخرطوم', 'Khartoum', 'Sudan'], ['إسطنبول', 'Istanbul', 'Turkey']];
const PRAYER_METHODS = [['', 'تلقائي حسب البلد'], ['23', 'وزارة الأوقاف — الأردن'], ['4', 'أم القرى — مكة'], ['5', 'الهيئة المصرية العامة للمساحة'], ['3', 'رابطة العالم الإسلامي'], ['8', 'منطقة الخليج'], ['16', 'دبي'], ['9', 'الكويت'], ['10', 'قطر'], ['13', 'تركيا'], ['21', 'المغرب'], ['19', 'الجزائر'], ['18', 'تونس'], ['2', 'أمريكا الشمالية (ISNA)'], ['12', 'فرنسا'], ['1', 'كراتشي']];

const Prayer = {
  get c() { return Settings.d.prayer; },
  data: null, // { key, days: { 'DD-MM-YYYY': { t: {Fajr: '05:25 (+03)'…}, h: 'هجري' } } }
  init() {
    try { this.data = JSON.parse(localStorage.getItem('prayerCache') || 'null'); } catch { this.data = null; }
    if (!this.c.on) return;
    this.ensure().then(() => this.paint()).catch(() => {});
    clearInterval(this.iv);
    this.iv = setInterval(() => { this.check(); this.paint(); }, 30000);
  },
  where() { const c = this.c; return c.lat != null ? `${c.lat.toFixed(3)},${c.lng.toFixed(3)}` : `${c.city}|${c.country}`; },
  key() { const c = this.c; return [this.where(), c.method || 'auto', c.school || 0].join('|'); },
  url(y, m) {
    const c = this.c;
    const base = c.lat != null ? `${PRAYER_API}calendar/${y}/${m}?latitude=${c.lat}&longitude=${c.lng}` : `${PRAYER_API}calendarByCity/${y}/${m}?city=${encodeURIComponent(c.city)}&country=${encodeURIComponent(c.country)}`;
    return base + (c.method ? `&method=${c.method}` : '') + `&school=${c.school || 0}`;
  },
  dkey(d) { return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; },
  // الشهر من الإنترنت (مرة وحدة) ← مخزّن
  async month(y, m) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
    let j;
    try { j = await (await fetch(this.url(y, m), { signal: ctl.signal })).json(); } finally { clearTimeout(to); }
    if (!j || j.code !== 200 || !Array.isArray(j.data)) throw new Error((j && j.data && typeof j.data === 'string' && j.data) || 'ما لقينا هالمدينة');
    const key = this.key();
    if (!this.data || this.data.key !== key) this.data = { key, days: {} };
    for (const d of j.data) this.data.days[d.date.gregorian.date] = { t: d.timings, h: `${d.date.hijri.day} ${d.date.hijri.month.ar} ${d.date.hijri.year}` };
    // منخلي بس من الشهر الماضي ولقدّام (حجم صغير)
    const cut = new Date(); cut.setDate(1); cut.setMonth(cut.getMonth() - 1);
    for (const k of Object.keys(this.data.days)) { const [dd, mm, yy] = k.split('-').map(Number); if (new Date(yy, mm - 1, dd) < cut) delete this.data.days[k]; }
    try { localStorage.setItem('prayerCache', JSON.stringify(this.data)); } catch { }
  },
  async ensure() {
    const now = new Date(), key = this.key();
    if (!this.data || this.data.key !== key || !this.data.days[this.dkey(now)]) await this.month(now.getFullYear(), now.getMonth() + 1);
    // آخر الشهر: منجيب الجاي بالهدوء، حتى ما يوقف لو انقطع النت
    const nx = new Date(now); nx.setDate(nx.getDate() + 3);
    if (!this.data.days[this.dkey(nx)]) this.month(nx.getFullYear(), nx.getMonth() + 1).catch(() => {});
  },
  // «05:25 (+03)» ← وقت حقيقي (حسب منطقة المدينة نفسها)
  at(day, s) {
    const m = /(\d{1,2}):(\d{2})(?:\s*\(([+-])(\d{1,2})(?::?(\d{2}))?\))?/.exec(s || ''); if (!m) return null;
    const [dd, mm, yy] = day.split('-').map(Number);
    if (!m[3]) return new Date(yy, mm - 1, dd, +m[1], +m[2]);
    const off = (m[3] === '-' ? -1 : 1) * (+m[4] * 60 + +(m[5] || 0));
    return new Date(Date.UTC(yy, mm - 1, dd, +m[1], +m[2]) - off * 60e3);
  },
  times(d = new Date()) {
    const k = this.dkey(d), r = this.data && this.data.days[k];
    if (!r) return null;
    return PRAYERS.map(([en, ar]) => ({ en, ar, at: this.at(k, r.t[en]) })).filter(x => x.at);
  },
  hijri(d = new Date()) { const r = this.data && this.data.days[this.dkey(d)]; return r ? r.h : ''; },
  next(now = new Date()) {
    const today = (this.times(now) || []).filter(x => x.en !== 'Sunrise');
    const n = today.find(x => x.at > now);
    if (n) return n;
    const t = new Date(now); t.setDate(t.getDate() + 1);
    const tm = (this.times(t) || []).find(x => x.en === 'Fajr');
    return tm || null;
  },
  fmt(d) { return d.toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' }); },
  rel(ms) { const m = Math.max(0, Math.round(ms / 60e3)); if (m < 1) return 'هلّق'; if (m < 60) return `بعد ${m} د`; const h = Math.floor(m / 60), r = m % 60; return `بعد ${h} س${r ? ` و${r} د` : ''}`; },
  // بالمكتبة (جنب «مطلوب اليوم»)
  chipHTML() {
    if (!this.c.on) return '';
    const n = this.next(); if (!n) return '';
    return `<button class="pr-chip" data-a="prayer" title="أوقات الصلاة اليوم">🕌 <b>${n.ar}</b> ${this.fmt(n.at)} <span>${this.rel(n.at - Date.now())}</span></button>`;
  },
  paint() { const c = $('.pr-chip'); if (c) { const h = this.chipHTML(); if (h) c.outerHTML = h; else c.remove(); } },
  // وقت الأذان: مرة وحدة لكل صلاة
  check(now = new Date()) {
    if (!this.c.on) return;
    const k = this.dkey(now);
    let seen; try { seen = JSON.parse(localStorage.getItem('prayerSeen') || '{}'); } catch { seen = {}; }
    if (seen.d !== k) seen = { d: k, l: [] };
    for (const p of (this.times(now) || []).filter(x => x.en !== 'Sunrise')) {
      if (p.at > now || now - p.at > 20 * 60e3 || seen.l.includes(p.en)) continue;
      seen.l.push(p.en); localStorage.setItem('prayerSeen', JSON.stringify(seen));
      this.notify(p);
    }
  },
  notify(p) {
    if (Reminders.cfg.sound) Sound.chime(true);
    const inSession = Rope.run && !Rope.run.paused;
    Toast.show({
      emoji: '🕌', title: `حان وقت صلاة ${p.ar}`, text: inSession ? 'جلستك بتستنّاك لترجع.' : (this.c.label || ''), cls: 'rem', timeout: 120000,
      actions: inSession ? [{ label: 'كمّل' }, { label: 'وقّف الجلسة للصلاة', primary: true, act: () => Rope.pause(true) }] : [{ label: 'تم', primary: true }],
    });
    if (Reminders.cfg.sys && document.hidden && window.Notification && Notification.permission === 'granted') new Notification(`دفتري — حان وقت صلاة ${p.ar}`, { body: this.c.label || '' });
  },
  // كبسة على الشريحة: أوقات اليوم
  panel(anchor) {
    const ts = this.times(), n = this.next();
    const box = el(`<div class="panel pr-panel"><h4>🕌 أوقات الصلاة <small dir="auto">${esc(this.c.label || '')}</small></h4>
      <p class="muted sm">${esc(this.hijri())}</p>
      ${ts ? `<ul>${ts.map(x => `<li class="${n && x.en === n.en && x.at - n.at === 0 ? 'on' : ''} ${x.en === 'Sunrise' ? 'sun' : ''}"><span>${x.ar}</span><b>${this.fmt(x.at)}</b></li>`).join('')}</ul>` : '<p class="muted">ما قدرنا نجيب الأوقات — اتصل بالإنترنت مرة وحدة.</p>'}
      <button class="btn ghost sm" data-a="set">${ic('gear')} المدينة وطريقة الحساب</button></div>`);
    $('[data-a=set]', box).onclick = () => { Pop.close(); Settings.panel('app'); setTimeout(() => $('.pr-block')?.scrollIntoView({ block: 'center' }), 250); };
    Pop.open(anchor, box, { cls: 'panel-pop' });
  },
  // تغيّر شي بالإعدادات: نجيب من جديد
  async refresh() {
    clearInterval(this.iv);
    if (!this.c.on) { this.paint(); return 'off'; }
    this.data = null;
    await this.month(new Date().getFullYear(), new Date().getMonth() + 1);
    this.init();
    if (!$('#library').hidden) Library.render();
    return 'ok';
  },
  locate() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) { rej(new Error('الجهاز ما بيدعم تحديد الموقع')); return; }
      navigator.geolocation.getCurrentPosition(p => res({ lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4) }), () => rej(new Error('ما قدرنا نحدد موقعك — اختار مدينتك من القائمة')), { timeout: 12000, maximumAge: 864e5 });
    });
  },
};
