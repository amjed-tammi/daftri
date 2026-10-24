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
