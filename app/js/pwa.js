'use strict';
/* ============ تطبيق على كل الأجهزة (PWA): تثبيت، بدون إنترنت، تحديثات، فتح ملفات .daftar ============
   من ملف على الجهاز (تشغيل دفتري.cmd) كل شي بيضل زي ما هو. من موقع (GitHub Pages مثلاً) بيصير قابل للتثبيت
   على ويندوز وماك ولينكس وكروم بوك وأندرويد، وبيشتغل بدون إنترنت بعد أول فتحة. */
const Pwa = {
  prompt: null,
  web: /^https?:$/.test(location.protocol),
  init() {
    // فتح ملف .daftar (أو وورد/إكسل) من نظام التشغيل على التطبيق المثبّت
    if ('launchQueue' in window) {
      launchQueue.setConsumer(p => (p.files || []).forEach(async h => {
        const f = await h.getFile();
        if (/\.daftar$/i.test(f.name)) Share.importFile(f); else if (Importer.can(f)) Importer.newBook(f);
      }));
    }
    // اختصارات أيقونة التطبيق (كليك يمين على الأيقونة)
    const q = new URLSearchParams(location.search).get('do');
    if (q) {
      history.replaceState(null, '', location.pathname);
      setTimeout(() => { if (q === 'new') Library.openForm(); else if (q === 'cal') Cal.open({ date: ymd() }); }, 300);
    }
    if (!this.web || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
    navigator.serviceWorker.addEventListener('message', e => {
      if (!e.data || e.data.type !== 'updated') return;
      Toast.show({ icon: 'download', title: 'في نسخة أحدث من دفتري ✦', text: 'بتشتغل بالفتحة الجاية لحالها، أو حدّث هلّق (كتبك ما بتتأثر).', timeout: 12000, actions: [{ label: 'لاحقاً' }, { label: 'حدّث', primary: true, act: () => { Editor.flushAll(); location.reload(); } }] });
    });
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.prompt = e; });
    addEventListener('appinstalled', () => { this.prompt = null; Toast.show({ icon: 'check', title: 'انثبّت دفتري ✦', text: 'بتلاقيه مع تطبيقاتك، وبيشتغل بدون إنترنت.', timeout: 5000 }); });
  },
  installed() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; },
  async install() {
    if (this.installed()) { Toast.show({ icon: 'check', text: 'دفتري مثبّت عندك ✓', timeout: 2500 }); return; }
    if (this.prompt) { const p = this.prompt; this.prompt = null; p.prompt(); await p.userChoice.catch(() => {}); return; }
    // ما في زر تثبيت تلقائي (آيفون/فايرفوكس، أو مفتوح من ملف): منشرح كيف
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    Toast.show({
      icon: 'download', title: 'تثبيت دفتري كتطبيق',
      text: !this.web ? 'على ويندوز: دبل كليك على «تثبيت كتطبيق.cmd». وعلى باقي الأجهزة افتح دفتري من موقعه وثبّته من المتصفح.'
        : ios ? 'بسفاري: زر المشاركة ⬆ ← «إضافة إلى الشاشة الرئيسية».' : 'من قائمة المتصفح (⋮) ← «تثبيت دفتري» أو «إضافة للشاشة الرئيسية».',
      timeout: 9000,
    });
  },
};

/* ============ نسخة التطبيق: «في نسخة جديدة» و«أبلغ عن مشكلة» (GitHub) ============
   النسخة الحالية من مكان واحد: version.json (فحص النظام بيتأكد إنها نفس APP_VERSION). */
const APP_VERSION = '1.1.0';
const APP_REPO = 'amjed-tammi/daftri';
const UPDATE_URL = `https://raw.githubusercontent.com/${APP_REPO}/main/app/version.json`;
const AppInfo = {
  newer(a, b) { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; },
  // النسخة اللي من الموقع بتتحدّث لحالها (عامل الخدمة). اللي من ملف على الجهاز: منشيّك على GitHub مرة باليوم
  init() {
    if (Pwa.web) return;
    if (localStorage.getItem('updCheck') === ymd()) return;
    setTimeout(() => this.check().catch(() => {}), 20000);
  },
  async check(manual = false) {
    localStorage.setItem('updCheck', ymd());
    let v;
    try { v = await (await fetch(UPDATE_URL, { cache: 'no-store' })).json(); }
    catch { if (manual) Toast.show({ icon: 'download', text: 'ما قدرنا نشيّك — بدّه إنترنت', timeout: 3000 }); return 'offline'; }
    if (!v || !this.newer(v.version, APP_VERSION)) { if (manual) Toast.show({ icon: 'check', text: `عندك آخر نسخة (${APP_VERSION}) ✓`, timeout: 3000 }); return 'latest'; }
    if (!manual && localStorage.getItem('updSkip') === v.version) return 'skipped';
    Toast.show({
      icon: 'download', title: `في نسخة جديدة من دفتري ✦ ${v.version}`, text: (v.notes || [])[0] || '', timeout: 30000,
      actions: [{ label: 'لاحقاً', act: () => localStorage.setItem('updSkip', v.version) }, { label: 'شو الجديد؟', primary: true, act: () => this.whatsNew(v) }],
    });
    return 'new';
  },
  whatsNew(v) {
    const n = el(`<div class="upd">
      <div class="jf-head">${ic('download')}<div><h3>دفتري ${esc(v.version)}</h3><p class="muted">إنت على ${APP_VERSION}${v.date ? ` · نزلت ${esc(v.date)}` : ''}</p></div></div>
      <ul>${(v.notes || []).map(x => `<li dir="auto">${esc(x)}</li>`).join('')}</ul>
      <p class="muted sm">التحديث: نزّل الملف، فك الضغط، وانسخ مجلد <b>app</b> مكان القديم. كتبك ما بتتأثر (محفوظة بالمتصفح مش بالمجلد) — وللاحتياط اعمل نسخة احتياطية قبل.</p>
      <div class="row end"><button class="btn ghost" data-a="close">لاحقاً</button><button class="btn primary" data-a="get">${ic('download')} نزّل التحديث</button></div></div>`);
    const m = Modal.open(n, { cls: 'sm' });
    n.onclick = e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      m.close();
      if (a.dataset.a === 'get') window.open(`https://github.com/${APP_REPO}/archive/refs/heads/main.zip`, '_blank', 'noopener');
    };
  },
  // صفحة GitHub جاهزة: الطالب بيكتب شو صار بس، والباقي (النسخة والجهاز) بيتعبّى لحاله
  report(kind = 'bug') {
    const ua = navigator.userAgent, os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'غير معروف';
    const br = (ua.match(/(Edg|Chrome|Firefox|Version)\/(\d+)/) || [])[0] || 'متصفح';
    const how = Pwa.installed() ? 'مثبّت كتطبيق' : Pwa.web ? 'من الموقع' : 'من ملف على الجهاز';
    const info = `\n\n---\nالنسخة: ${APP_VERSION} · ${os} · ${br.replace('/', ' ')} · ${how} · الشاشة ${innerWidth}×${innerHeight}`;
    const bug = kind === 'bug';
    const body = (bug ? '**شو صار؟**\n\n\n**شو كنت متوقع يصير؟**\n\n\n**كيف بتصير؟** (الخطوات)\n1. \n' : '**الفكرة:**\n\n\n**كيف بتفيد الطالب/الكاتب؟**\n') + info;
    window.open(`https://github.com/${APP_REPO}/issues/new?labels=${bug ? 'bug' : 'enhancement'}&title=${encodeURIComponent(bug ? 'مشكلة: ' : 'اقتراح: ')}&body=${encodeURIComponent(body)}`, '_blank', 'noopener');
  },
};
