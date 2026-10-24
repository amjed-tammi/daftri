'use strict';
/* ============ الإعدادات: افتراضي التطبيق، وإعدادات كل كتاب ============ */

/* أدوات الورق والكتابة: نفس اللوحة بتنستعمل بالإعدادات العامة، وإنشاء الكتاب، وإعدادات الكتاب */
const PaperUI = {
  make(p, { onChange = () => { }, preview = false } = {}) {
    const n = el(`<div class="paperui">
      ${preview ? '<div class="pv-wrap"><div class="pv"></div><small class="muted">معاينة</small></div>' : ''}
      <div class="pu-sec"><h4>الورق</h4>
        <div class="seg wrap" data-k="style">${PAPER_STYLES.map(([v, t]) => `<button type="button" data-v="${v}"><i class="mini ps-${v}"></i>${t}</button>`).join('')}</div>
        <div class="swatches" data-k="tone">${PAPER_TONES.map(([v, t, c]) => `<button type="button" class="sw" data-v="${v}" title="${t}" style="--c:${c}"></button>`).join('')}</div>
        <label class="rng"><span>المسافة بين السطور</span><input type="range" min="24" max="48" step="2" data-k="lh" value="${p.lh}"><b>${p.lh}</b></label>
        <div class="lbl">لون السطور</div>
        <div class="swatches" data-k="line">${LINE_COLORS.map(([c, t]) => `<button type="button" class="sw ${c === 'auto' ? 'auto' : ''}" data-v="${c}" title="${t}" style="--c:${c === 'auto' ? '#ccc' : c}"></button>`).join('')}</div>
        <label class="chk"><input type="checkbox" data-k="margin" ${p.margin ? 'checked' : ''}> <span>خط الهامش الأحمر</span></label>
      </div>
      <div class="pu-sec"><h4>الكتابة</h4>
        <div class="seg wrap" data-k="font">${FONTS.map(([v, t]) => `<button type="button" data-v="${v}" class="f-${v}">${t} Aa</button>`).join('')}</div>
        <div class="fontrow"><span>الخط العربي</span><button type="button" class="fontpick" data-pick="ar"></button></div>
        <div class="fontlist" data-list="ar" hidden></div>
        <div class="fontrow"><span>الخط الإنجليزي</span><button type="button" class="fontpick" data-pick="en"></button></div>
        <div class="fontlist" data-list="en" hidden></div>
        <label class="rng"><span>حجم الخط</span><input type="range" min="14" max="28" step="1" data-k="fs" value="${p.fs}"><b>${p.fs}</b></label>
        <label class="rng"><span>حجم العربي مقابل الإنجليزي</span><input type="range" min="70" max="160" step="5" data-k="arScale" value="${p.arScale || 100}"><b>${p.arScale || 100}%</b></label>
        <div class="lbl">لون الحبر</div>
        <div class="swatches" data-k="ink">${INKS.map(c => `<button type="button" class="sw" data-v="${c}" style="--c:${c}"></button>`).join('')}</div>
      </div>
    </div>`);
    const sync = () => {
      $$('[data-k=style] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === p.style));
      $$('[data-k=tone] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === p.tone));
      $$('[data-k=line] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === (p.line || 'auto')));
      $$('[data-k=font] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === p.font && !p.fontCustom));
      $$('[data-k=ink] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === p.ink));
      const fa = FontKit.ar(p), fe = FontKit.en(p), ba = $('[data-pick=ar]', n), be = $('[data-pick=en]', n);
      ba.textContent = FontKit.label('ar', fa) + ' · أبجد'; ba.style.fontFamily = `"${fa}"`;
      be.textContent = FontKit.label('en', fe) + ' · Abc'; be.style.fontFamily = `"${fe}"`;
      if (preview) this.preview($('.pv', n), p);
    };
    n.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    n.addEventListener('click', e => {
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        const kind = pick.dataset.pick, list = $(`[data-list=${kind}]`, n), open = list.hidden;
        $$('.fontlist', n).forEach(x => x.hidden = true);
        if (open) { FontKit.fillList(list, kind, kind === 'ar' ? FontKit.ar(p) : FontKit.en(p)); list.hidden = false; }
        return;
      }
      const f = e.target.closest('[data-font]');
      if (f) {
        if (f.closest('.fontlist').dataset.list === 'ar') p.fontAr = f.dataset.font; else p.fontEn = f.dataset.font;
        p.fontCustom = true;
        $$('.fontlist', n).forEach(x => x.hidden = true);
        sync(); onChange('font', true); return;
      }
      const b = e.target.closest('button[data-v]'); if (!b) return;
      const k = b.parentElement.dataset.k; if (!k) return;
      if (k === 'font') { p.font = b.dataset.v; delete p.fontAr; delete p.fontEn; p.fontCustom = false; p.arScale = 100; const r = $('[data-k=arScale]', n); r.value = 100; r.nextElementSibling.textContent = '100%'; }
      else p[k] = b.dataset.v;
      if (k === 'tone') fixInk(p);
      sync(); onChange(k, k === 'style' || k === 'font');
    });
    n.addEventListener('input', e => {
      const k = e.target.dataset.k;
      if (k === 'arScale') { p.arScale = +e.target.value; e.target.nextElementSibling.textContent = p.arScale + '%'; sync(); onChange(k, false); return; }
      if (k === 'lh' || k === 'fs') {
        p[k] = +e.target.value;
        if (k === 'fs') p.fs = Math.min(p.fs, Math.floor(p.lh * .8));
        if (k === 'lh' && p.fs > p.lh * .8) { p.fs = Math.floor(p.lh * .8); const fsI = $('[data-k=fs]', n); fsI.value = p.fs; fsI.nextElementSibling.textContent = p.fs; }
        e.target.nextElementSibling.textContent = p[k];
        sync(); onChange(k, false);
      }
    });
    n.addEventListener('change', e => {
      const k = e.target.dataset.k;
      if (k === 'lh' || k === 'fs' || k === 'arScale') onChange(k, true);
      else if (k === 'margin') { p.margin = e.target.checked; sync(); onChange(k, true); }
    });
    sync();
    return n;
  },
  // صفحة صغيرة بتوريك شكل الورق والخط
  preview(box, p) {
    const lh = p.lh, T = Math.round(lh * 1.4);
    box.className = `pv tone-${p.tone} dir-rtl${p.margin ? '' : ' nomargin'}`;
    box.style.cssText = `--lh:${lh}px;--T:${T}px;--CH:${lh * 6}px;--fs:${p.fs}px;--ink:${p.ink};${p.line && p.line !== 'auto' ? `--line:${p.line};` : ''}`;
    box.innerHTML = `<div class="page side-right ps-${p.style}"><div class="lines"></div><div class="mline"></div>
      <div class="content" style="font-family:'${FontKit.en(p)}','${FontKit.ar(p)}',sans-serif"><h3>الدرس الأول ✦</h3><p>المتغيرات variables بنخزّن فيها القيم.</p><p dir="ltr" style="text-align:left">let name = "Daftari";</p></div></div>`;
  },
};

const Settings = {
  d: { paper: null, dir: 'rtl', music: { track: null, auto: false, session: true } },
  load() {
    let x = {};
    try { x = JSON.parse(localStorage.getItem('appDefaults') || '{}'); } catch { }
    // جهاز ضعيف (نواتين أو ذاكرة قليلة): الوضع الخفيف بيبدأ شغّال لحاله
    const weak = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
    this.d = {
      dir: x.dir || 'rtl', paper: { ...PAPER_DEFAULT, ...(x.paper || {}) }, music: { track: null, auto: false, session: true, ...(x.music || {}) },
      backup: { on: false, ...(x.backup || {}) },
      prayer: { on: false, city: 'Amman', country: 'Jordan', label: 'عمّان', lat: null, lng: null, method: '', school: 0, ...(x.prayer || {}) },
      app: { lite: weak, profile: null, ...(x.app || {}) },
    };
    this.applyLite();
  },
  // إعدادات التطبيق العامة (الوضع الخفيف، نوع المستخدم…)
  set(k, v) { this.d.app[k] = v; this.save(); if (k === 'lite') this.applyLite(); },
  applyLite() { document.body.classList.toggle('lite', !!(this.d.app && this.d.app.lite)); },
  save() { localStorage.setItem('appDefaults', JSON.stringify(this.d)); },
  newPaper() { return JSON.parse(JSON.stringify(this.d.paper)); },
  // موسيقى الكتاب: «الافتراضي» بيرجع لإعدادات التطبيق
  bookMusic(b) {
    const m = (b && b.music) || {};
    let track = m.track === 'none' ? null : (m.track && m.track !== 'default' ? m.track : this.d.music.track);
    if (track && !Music.has(track)) track = null;
    return { track, auto: m.auto != null ? m.auto : this.d.music.auto };
  },
  musicOptions(cur, withDefault = true) {
    const def = Music.name(this.d.music.track);
    return (withDefault ? `<option value="default" ${!cur || cur === 'default' ? 'selected' : ''}>الافتراضي${def ? ` (${esc(def)})` : ''}</option>` : '')
      + `<option value="none" ${cur === 'none' || (!withDefault && !cur) ? 'selected' : ''}>بدون موسيقى</option>`
      + Music.tracks.map(t => `<option value="${t.id}" ${cur === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  },

  // أوقات الصلاة: نجيبها من جديد ونعرض أوقات اليوم (أو السبب إذا ما زبطت)
  async prayerSync(n) {
    const st = n && $('.pr-status', n);
    if (!this.d.prayer.on) { Prayer.refresh(); return; }
    if (st) st.textContent = 'عم نجيب الأوقات…';
    try { await Prayer.refresh(); if (st) st.textContent = 'اليوم: ' + Prayer.times().filter(x => x.en !== 'Sunrise').map(x => `${x.ar} ${Prayer.fmt(x.at)}`).join(' · '); }
    catch (er) { if (st) st.textContent = 'ما قدرنا نجيب الأوقات: ' + (er.name === 'AbortError' ? 'ما في إنترنت' : er.message) + ' — جرّب مرة ثانية.'; }
  },

  /* ===== لوحة الإعدادات العامة ===== */
  panel(tab = 'books') {
    const D = this.d, P = JSON.parse(JSON.stringify(D.paper));
    const n = el(`<div class="settings">
      <div class="jf-head">${ic('gear')}<div><h3>الإعدادات</h3><p class="muted">الافتراضي لكل كتاب جديد، والموسيقى، وإعدادات التطبيق. وكل كتاب إله إعداداته الخاصة من زر «الإعدادات» جوّاه.</p></div></div>
      <div class="seg st-tabs"><button data-t="books">${ic('books')} الكتب الجديدة</button><button data-t="music">${ic('music')} الموسيقى</button><button data-t="app">${ic('gear')} التطبيق</button></div>
      <div class="st-tab" data-tab="books">
        <div class="fld"><span>اتجاه الكتب الجديدة</span><div class="seg" data-k="dir"><button type="button" data-v="rtl">يفتح من اليمين <small>عربي</small></button><button type="button" data-v="ltr">يفتح من اليسار <small>English</small></button></div></div>
        <div class="st-paper"></div>
        <div class="row"><button class="btn ghost sm" data-a="applyall">${ic('books')} طبّق هالورق على كل كتبي الحالية</button></div>
      </div>
      <div class="st-tab" data-tab="music" hidden>
        <label class="fld"><span>الموسيقى الافتراضية للكتب</span><select class="inp" data-k="mtrack">${this.musicOptions(D.music.track, false)}</select></label>
        <label class="chk"><input type="checkbox" data-k="mauto" ${D.music.auto ? 'checked' : ''}> <span>شغّلها لحالها لما أفتح أي كتاب</span></label>
        <label class="chk"><input type="checkbox" data-k="msession" ${D.music.session ? 'checked' : ''}> <span>شغّلها لما أبدأ جلسة دراسة (الحبل)</span></label>
        <p class="lbl">${ic('music')} مكتبة الموسيقى: ارفع أغانيك أو أصوات المطر اللي بتحبها من زر ♫ تحت على اليسار. وكل كتاب بتقدر تختارله موسيقى خاصة من إعداداته.</p>
        <button class="btn ghost sm" data-a="music">${ic('upload')} افتح مكتبة الموسيقى</button>
      </div>
      <div class="st-tab" data-tab="app" hidden>
        <label class="chk"><input type="checkbox" data-k="flip" ${localStorage.getItem('flipSound') === '0' ? '' : 'checked'}> <span>صوت تقليب الورق</span></label>
        <label class="chk"><input type="checkbox" data-k="dock" ${Editor.docked() ? 'checked' : ''}> <span>شريط التنسيق مثبّت تحت الكتاب</span></label>
        <div class="st-block">
          <b>${ic('download')} النسخ الاحتياطي التلقائي</b>
          <p class="muted sm">${AutoBackup.status()}</p>
          <p class="lbl">كتبك محفوظة جوّا المتصفح. ${AutoBackup.can ? 'اختار مجلد (مثلاً جوّا OneDrive أو Google Drive) وكل يوم بتنحفظ نسخة لحالها، وبنخلّي آخر 7 أيام.' : 'متصفحك ما بيسمح بمجلد تلقائي، فبنذكّرك كل أسبوع تنزّل نسخة.'}</p>
          <div class="row">${AutoBackup.can ? `<button class="btn primary sm" data-a="bkpick">${ic('folder')} ${D.backup.on ? 'غيّر المجلد' : 'اختار مجلد'}</button>${D.backup.on ? `<button class="btn ghost sm" data-a="bknow">${ic('check')} احفظ نسخة هلّق</button><button class="btn ghost sm" data-a="bkoff">أطفيه</button>` : ''}` : `<button class="btn primary sm" data-a="backup">${ic('download')} نزّل نسخة</button>`}</div>
        </div>
        <div class="st-block pr-block">
          <b>🕌 أوقات الصلاة</b>
          <label class="chk"><input type="checkbox" data-k="pron" ${D.prayer.on ? 'checked' : ''}> <span>اعرض الصلاة الجاية بالمكتبة، وذكّرني وقت الأذان (ووقّف جلسة الدراسة إذا بدّي)</span></label>
          <div class="pr-set" ${D.prayer.on ? '' : 'hidden'}>
            <div class="row"><select class="inp" data-k="prcity">${PRAYER_CITIES.map(([ar, en, co]) => `<option value="${esc(en + '|' + co)}" ${D.prayer.lat == null && D.prayer.city === en ? 'selected' : ''}>${esc(ar)}</option>`).join('')}${D.prayer.lat != null ? '<option selected value="geo">📍 موقعي</option>' : ''}</select>
              <button class="btn ghost sm" type="button" data-a="prgeo">📍 حدّد موقعي</button></div>
            <div class="row">
              <label class="fld"><span>طريقة الحساب</span><select class="inp" data-k="prmethod">${PRAYER_METHODS.map(([v, t]) => `<option value="${v}" ${String(D.prayer.method || '') === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
              <label class="fld"><span>العصر</span><select class="inp" data-k="prschool"><option value="0" ${+D.prayer.school ? '' : 'selected'}>الجمهور</option><option value="1" ${+D.prayer.school ? 'selected' : ''}>الحنفي</option></select></label>
            </div>
            <p class="muted sm pr-status">${Prayer.times() ? 'اليوم: ' + Prayer.times().filter(x => x.en !== 'Sunrise').map(x => `${x.ar} ${Prayer.fmt(x.at)}`).join(' · ') : 'بنجيب الأوقات من Aladhan (مجاني) مرة بالشهر، وبتضل شغّالة بدون إنترنت.'}</p>
          </div>
        </div>
        <label class="chk"><input type="checkbox" data-k="study" ${Onboard.study() ? 'checked' : ''}> <span>أدوات الدراسة بالشريط (مراجعة، امتحانات، شبكة الأفكار)</span></label>
        <label class="chk"><input type="checkbox" data-k="lite" ${D.app.lite ? 'checked' : ''}> <span>وضع خفيف: بدون تأثيرات ولا حركة (للأجهزة القديمة وتوفير البطارية)</span></label>
        <div class="row"><button class="btn ghost sm" data-a="reminders">${ic('bell')} التذكيرات</button><button class="btn ghost sm" data-a="tour">${ic('help')} الجولة التعريفية</button></div>
        <div class="row"><button class="btn ghost sm" data-a="backup">${ic('download')} نسخة احتياطية لكل المكتبة</button><button class="btn ghost sm" data-a="restore">${ic('upload')} استعادة</button><button class="btn ghost sm" data-a="trash">${ic('trash')} سلة المحذوفات</button></div>
      </div>
      <div class="row end"><button class="btn primary" data-a="close">تمام</button></div>
    </div>`);
    const m = Modal.open(n, { cls: 'wide' });
    const show = t => { $$('.st-tabs button', n).forEach(b => b.classList.toggle('on', b.dataset.t === t)); $$('.st-tab', n).forEach(x => x.hidden = x.dataset.tab !== t); };
    const syncDir = () => $$('[data-k=dir] button', n).forEach(b => b.classList.toggle('on', b.dataset.v === D.dir));
    $('.st-paper', n).append(PaperUI.make(P, { preview: true, onChange: () => { D.paper = JSON.parse(JSON.stringify(P)); this.save(); } }));
    n.addEventListener('click', async e => {
      const t = e.target.closest('.st-tabs [data-t]'); if (t) { show(t.dataset.t); return; }
      const dv = e.target.closest('[data-k=dir] [data-v]'); if (dv) { D.dir = dv.dataset.v; this.save(); syncDir(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      switch (a.dataset.a) {
        case 'close': m.close(); break;
        case 'music': m.close(); Music.panel($('#btnSound')); break;
        case 'reminders': m.close(); Reminders.panel($('#btnNight')); break;
        case 'tour': m.close(); localStorage.removeItem('tour-book'); Tour.start($('#reader').hidden ? 'lib' : 'book'); break;
        case 'backup': Backup.exportBooks(); break;
        case 'restore': m.close(); Backup.importFile(); break;
        case 'trash': m.close(); Trash.panel(); break;
        case 'bkpick': if (await AutoBackup.pick()) { m.close(); this.panel('app'); } break;
        case 'bknow': { const r = await AutoBackup.run(true, true); Toast.show({ icon: r === 'ok' ? 'check' : 'download', text: r === 'ok' ? 'انحفظت نسخة ✓' : 'ما قدرنا نحفظ — اختار المجلد مرة ثانية', timeout: 2500 }); m.close(); this.panel('app'); break; }
        case 'bkoff': AutoBackup.off(); m.close(); this.panel('app'); break;
        case 'prgeo': {
          const st = $('.pr-status', n); st.textContent = 'عم نحدد موقعك…';
          try { const g = await Prayer.locate(); Object.assign(D.prayer, { lat: g.lat, lng: g.lng, label: 'موقعي' }); this.save(); await this.prayerSync(n); } catch (er) { st.textContent = er.message; }
          break;
        }
        case 'applyall': {
          if (!(await Modal.confirm('تطبيق على كل الكتب', 'بدك ورق وخط هالإعدادات يصير لكل كتبك الحالية؟', { ok: 'طبّق' }))) return;
          Editor.flushAll();
          for (const b of await DB.all('books')) { b.paper = JSON.parse(JSON.stringify(D.paper)); await DB.put('books', b); }
          if (Reader.book) { Reader.book.paper = JSON.parse(JSON.stringify(D.paper)); Reader.applyPaper(); Reader.render(); }
          Library.load();
          Toast.show({ icon: 'check', text: 'تطبّق على كل الكتب ✓' });
        }
      }
    });
    n.addEventListener('change', e => {
      const k = e.target.dataset.k;
      if (k === 'mtrack') { D.music.track = e.target.value === 'none' ? null : e.target.value; this.save(); }
      else if (k === 'mauto') { D.music.auto = e.target.checked; this.save(); }
      else if (k === 'msession') { D.music.session = e.target.checked; this.save(); }
      else if (k === 'flip') localStorage.setItem('flipSound', e.target.checked ? '1' : '0');
      else if (k === 'dock') Editor.setDock(e.target.checked);
      else if (k === 'lite') this.set('lite', e.target.checked);
      else if (k && k.startsWith('pr')) {
        const P = D.prayer, v = e.target.value;
        if (k === 'pron') { P.on = e.target.checked; $('.pr-set', n).hidden = !P.on; }
        else if (k === 'prcity' && v !== 'geo') { const [city, country] = v.split('|'); const c = PRAYER_CITIES.find(x => x[1] === city); Object.assign(P, { city, country, label: c ? c[0] : city, lat: null, lng: null }); }
        else if (k === 'prmethod') P.method = v;
        else if (k === 'prschool') P.school = +v;
        this.save(); this.prayerSync(n);
      }
      else if (k === 'study') { this.set('studyTools', e.target.checked); Onboard.applyProfile(); }
    });
    syncDir(); show(tab);
  },
};
