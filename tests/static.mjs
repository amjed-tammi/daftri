// اختبارات تصميم النظام بدون متصفح: البنية، الاعتماديات، «مصدر واحد للحقيقة»، والعمل بدون إنترنت
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BUILTINS = new Set('Math JSON Object Array Promise Date Number String Boolean CSS URL URLSearchParams Blob File FileReader Intl Notification MediaRecorder Image Audio Node NodeFilter Event KeyboardEvent MouseEvent PointerEvent Response DOMParser ResizeObserver MutationObserver Highlight Range Uint8Array ArrayBuffer DataView Map Set WeakMap Symbol Reflect Error TypeError TextEncoder TextDecoder AbortController CompressionStream DecompressionStream WebSocket IDBKeyRange Infinity NaN BigInt RegExp HTMLElement Element Document Window SVGElement'.split(' '));

export function runStatic(ROOT) {
  const APP = path.join(ROOT, 'app'), JS = path.join(APP, 'js');
  const tests = [];
  const T = (name, fn) => { const t0 = Date.now(); const r = { name, ok: true }; try { const info = fn(); if (info !== undefined) r.info = info; } catch (e) { r.ok = false; r.err = e.message; } r.ms = Date.now() - t0; tests.push(r); };
  const fail = m => { throw new Error(m); };
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(APP, 'css', 'app.css'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const files = fs.readdirSync(JS).filter(f => f.endsWith('.js'));
  const src = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(JS, f), 'utf8')]));
  // إزالة التعليقات والنصوص التقريبية لتحليل الكود
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  const code = Object.fromEntries(Object.entries(src).map(([f, s]) => [f, strip(s)]));
  const all = Object.values(code).join('\n');

  T('كل ملفات السكربت بـ index.html موجودة، ومافي ملف JS مش مستعمل', () => {
    const missing = scripts.filter(s => !fs.existsSync(path.join(APP, s)));
    if (missing.length) fail('ناقص: ' + missing.join(', '));
    const used = new Set(scripts.map(s => path.basename(s)));
    // ملفات بتتحمّل وقت الحاجة (Lazy.files بـ core.js): مستعملة، بس ما لازم تكون كمان بـ index.html
    const lazy = [...(src['core.js'] || '').matchAll(/'js\/([a-z0-9-]+\.js)'/g)].map(m => m[1]);
    const twice = lazy.filter(f => used.has(f));
    if (twice.length) fail('بيتحمّل مرتين (بـ index.html ووقت الحاجة): ' + twice.join(', '));
    const lazyMissing = lazy.filter(f => !files.includes(f));
    if (lazyMissing.length) fail('ملف وقت الحاجة مش موجود: ' + lazyMissing.join(', '));
    lazy.forEach(f => used.add(f));
    const orphan = files.filter(f => !used.has(f));
    if (orphan.length) fail('ملفات مش مربوطة: ' + orphan.join(', '));
    const dup = scripts.filter((s, i) => scripts.indexOf(s) !== i);
    if (dup.length) fail('مكرر: ' + dup.join(', '));
    return `${scripts.length} ملف مع الإقلاع + ${lazy.length} وقت الحاجة`;
  });

  // التعريفات العامة لكل ملف (مصدر واحد للحقيقة: كل اسم معرّف بمكان واحد)
  const decl = {};
  for (const [f, s] of Object.entries(code)) for (const m of s.matchAll(/^(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm)) (decl[m[1]] = decl[m[1]] || []).push(f);
  T('كل اسم عام معرّف مرة وحدة بس (ما في تعريفين لنفس الشي)', () => {
    const dups = Object.entries(decl).filter(([, fs]) => fs.length > 1).map(([n, fs]) => `${n} ← ${fs.join(' + ')}`);
    if (dups.length) fail(dups.join('\n'));
    return `${Object.keys(decl).length} اسم عام`;
  });

  T('ما في استعمال لوحدات غير موجودة (مثل وحدة انحذفت)', () => {
    const bad = new Map();
    for (const [f, s] of Object.entries(code)) {
      const noStr = s.replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, '""');
      // أسماء محلية بالملف (متغيرات وبارامترات) ما بتعتبر وحدات
      const local = new Set();
      for (const m of noStr.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) local.add(m[1]);
      for (const m of noStr.matchAll(/\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g)) m[1].split(',').forEach(x => local.add(x.split(':').pop().split('=')[0].trim()));
      for (const m of noStr.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) m[1].split(',').forEach(x => local.add(x.replace(/[{}[\]]/g, '').split('=')[0].trim()));
      for (const m of noStr.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) local.add(m[1]);
      for (const m of noStr.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g)) local.add(m[1]);
      for (const m of noStr.matchAll(/\bfor\s*\(\s*(?:const|let)\s*(?:\[([^\]]*)\]|\{([^}]*)\})/g)) (m[1] || m[2]).split(',').forEach(x => local.add(x.split(':').pop().trim()));
      for (const m of noStr.matchAll(/(?<![\w$.])([A-Z][A-Za-z0-9_$]*)\s*\./g)) {
        const n = m[1];
        if (decl[n] || BUILTINS.has(n) || local.has(n)) continue;
        (bad.get(n) || bad.set(n, new Set()).get(n)).add(f);
      }
    }
    if (bad.size) fail([...bad].map(([n, fs]) => `${n} ← ${[...fs].join(', ')}`).join('\n'));
  });

  T('ترتيب السكربتات: كل ملف بيستعمل وقت التحميل بس اللي قبله', () => {
    const order = scripts.map(s => path.basename(s));
    const where = n => (decl[n] || [])[0];
    const probs = [];
    order.forEach((f, i) => {
      // استعمالات على مستوى الملف (برّا الدوال): أسطر تبدأ بـ const X = Y.something( أو اسم معرّف بملف لاحق
      for (const m of code[f].matchAll(/^(?:const|let)\s+\w+\s*=\s*(?:new\s+)?([A-Z]\w*)[.(]/gm)) {
        const d = where(m[1]);
        if (d && order.indexOf(d) > i) probs.push(`${f} بيستعمل ${m[1]} (من ${d}) قبل ما ينحمّل`);
      }
    });
    if (probs.length) fail(probs.join('\n'));
  });

  T('كل الأيقونات المستعملة موجودة', () => {
    const icons = new Set([...code['core.js'].matchAll(/^\s{2}([a-z][\w]*):\s*'</gm)].map(m => m[1]));
    const used = new Set();
    for (const s of [all, html]) {
      for (const m of s.matchAll(/\bic\(\s*'([a-z]\w*)'/g)) used.add(m[1]);
      for (const m of s.matchAll(/data-ic="([a-z]\w*)"/g)) used.add(m[1]);
      for (const m of s.matchAll(/\bicon:\s*'([a-z]\w*)'/g)) used.add(m[1]);
    }
    const missing = [...used].filter(n => !icons.has(n));
    if (missing.length) fail('ناقص: ' + missing.join(', '));
    return `${icons.size} أيقونة، ${used.size} مستعملة`;
  });

  T('مخطط قاعدة البيانات مصدر واحد: كل مخزن مستعمل موجود بـ DB.open', () => {
    const m = code['core.js'].match(/for \(const s of \[([^\]]+)\]\)/);
    const stores = new Set([...m[1].matchAll(/'(\w+)'/g)].map(x => x[1]));
    const used = new Set([...all.matchAll(/DB\.(?:get|all|put|del|getMany|putMany|delMany)\(\s*'(\w+)'/g)].map(x => x[1]));
    const missing = [...used].filter(s => !stores.has(s));
    if (missing.length) fail('مخازن مش معرّفة: ' + missing.join(', '));
    // مخازن ميزات انشالت (LEGACY_STORES بـ core.js): بتضل حتى ما تنمسح بيانات حدا
    const legacy = new Set([...((code['core.js'].match(/const LEGACY_STORES = \[([^\]]*)\]/) || [])[1] || '').matchAll(/'(\w+)'/g)].map(x => x[1]));
    const unused = [...stores].filter(s => !used.has(s) && !legacy.has(s));
    if (unused.length) fail('مخازن معرّفة بدون استعمال: ' + unused.join(', '));
    const ver = +code['core.js'].match(/indexedDB\.open\('daftari',\s*(\d+)\)/)[1];
    return { stores: [...stores], version: ver };
  });

  T('مفاتيح التخزين المحلي (localStorage): كل مفتاح إله مالك واحد', () => {
    const owners = {};
    for (const [f, s] of Object.entries(code)) for (const m of s.matchAll(/localStorage\.setItem\(\s*'([\w-]+)'/g)) (owners[m[1]] = owners[m[1]] || new Set()).add(f);
    const shared = Object.entries(owners).filter(([k, s]) => s.size > 1 && !/^(tour|flipSound|hintShown)/.test(k)).map(([k, s]) => `${k} ← ${[...s].join(', ')}`);
    if (shared.length) fail('مفتاح بيكتبه أكثر من ملف:\n' + shared.join('\n'));
    return Object.fromEntries(Object.entries(owners).map(([k, s]) => [k, [...s].join(',')]));
  });

  T('إعدادات الورق الافتراضية من مصدر واحد (Settings)', () => {
    const offenders = Object.entries(code).filter(([f, s]) => /\.\.\.PAPER_DEFAULT/.test(s) && f !== 'settings.js').map(([f]) => f);
    if (offenders.length) fail('بيستعمل PAPER_DEFAULT مباشرة بدل Settings.newPaper(): ' + offenders.join(', '));
  });

  T('نسخة الجولة أكبر من أو تساوي كل الخطوات الجديدة (since)', () => {
    const v = +code['tour.js'].match(/const TOUR_V\s*=\s*(\d+)/)[1];
    const since = [...code['tour.js'].matchAll(/since:\s*(\d+)/g)].map(m => +m[1]);
    const max = Math.max(0, ...since);
    if (max > v) fail(`خطوة since:${max} بس TOUR_V=${v}`);
    return { TOUR_V: v, newSteps: since.length };
  });

  T('الأزرار والعناصر المطلوبة بالكود موجودة بالصفحة', () => {
    const ids = new Set([...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
    for (const m of all.matchAll(/id="([\w-]+)"/g)) ids.add(m[1]);
    for (const m of all.matchAll(/\.id\s*=\s*'([\w-]+)'/g)) ids.add(m[1]);
    const used = new Set([...all.matchAll(/\$\(\s*'#([\w-]+)'/g)].map(m => m[1]));
    const missing = [...used].filter(i => !ids.has(i));
    if (missing.length) fail('عناصر ناقصة: #' + missing.join(', #'));
    return `${used.size} عنصر مستعمل`;
  });

  T('بيشتغل بدون إنترنت: ما في سكربت/خط/ستايل من برا', () => {
    const ext = [];
    if (/<script[^>]+src="https?:/i.test(html)) ext.push('script خارجي');
    if (/<link[^>]+href="https?:/i.test(html)) ext.push('link خارجي');
    if (/@import\s+url\(\s*['"]?https?:/i.test(css) || /url\(\s*['"]?https?:/i.test(css)) ext.push('CSS خارجي');
    for (const [f, s] of Object.entries(code)) if (/fetch\(\s*['"`]https?:/.test(s) || /new\s+WebSocket\(/.test(s)) ext.push('اتصال خارجي بـ ' + f);
    // أي عنوان إنترنت بالكود لازم يكون من القائمة: أوقات الصلاة (اختياري، بيتخزّن للشهر) وتضمين يوتيوب لروابط المستخدم
    const ALLOWED = ['api.aladhan.com', 'www.youtube.com', 'raw.githubusercontent.com', 'github.com'];
    for (const [f, s] of Object.entries(code)) for (const m of s.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) if (!ALLOWED.includes(m[1].toLowerCase())) ext.push(`${m[1]} ← ${f}`);
    if (ext.length) fail(ext.join(', '));
    return 'خدمات مسموحة بس: ' + ALLOWED.join('، ');
  });

  T('نسخة التطبيق من مصدر واحد: APP_VERSION = version.json', () => {
    const v = JSON.parse(fs.readFileSync(path.join(APP, 'version.json'), 'utf8'));
    const m = all.match(/const APP_VERSION = '([^']+)'/);
    if (!m) fail('APP_VERSION مش موجود');
    if (m[1] !== v.version) fail(`APP_VERSION ${m[1]} ≠ version.json ${v.version}`);
    if (!Array.isArray(v.notes) || !v.notes.length) fail('version.json بدون «شو الجديد»');
    return v.version;
  });

  T('أمان: ما في eval ولا new Function، وكل ملف strict', () => {
    const bad = [];
    for (const [f, s] of Object.entries(code)) {
      if (/\beval\s*\(|new\s+Function\s*\(/.test(s)) bad.push('eval بـ ' + f);
      if (!/^'use strict';/.test(src[f].trimStart())) bad.push(f + ' مش strict');
    }
    if (bad.length) fail(bad.join(', '));
  });

  T('حجم التطبيق خفيف', () => {
    const size = files.reduce((s, f) => s + fs.statSync(path.join(JS, f)).size, 0) + fs.statSync(path.join(APP, 'css', 'app.css')).size + Buffer.byteLength(html);
    if (size > 900 * 1024) fail(`الحجم ${Math.round(size / 1024)}KB أكبر من الميزانية (900KB)`);
    return `${Math.round(size / 1024)}KB (بدون أي مكتبات)`;
  });

  T('ملفات التشغيل: .cmd نصها إنجليزي بس ونهايات أسطر ويندوز', () => {
    const cmds = [...fs.readdirSync(ROOT), ...fs.readdirSync(path.join(ROOT, 'tests')).map(f => 'tests/' + f)].filter(f => f.endsWith('.cmd'));
    if (!cmds.length) fail('ما في ملفات تشغيل');
    for (const f of cmds) {
      const b = fs.readFileSync(path.join(ROOT, f));
      if ([...b].some(x => x > 127)) fail(f + ' فيه أحرف مش ASCII');
      if (!b.includes(Buffer.from('\r\n'))) fail(f + ' بدون CRLF');
    }
    return cmds;
  });

  T('سكربتات PowerShell سليمة ومحفوظة بـ BOM (للعربي)', () => {
    const dir = path.join(ROOT, 'tools');
    const res = [];
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.ps1'))) {
      const p = path.join(dir, f), b = fs.readFileSync(p);
      if (!(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf)) fail(f + ' بدون BOM');
      const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', `$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${p}',[ref]$null,[ref]$e);$e.Count`], { encoding: 'utf8' }).trim();
      if (out !== '0') fail(`${f}: ${out} أخطاء`);
      res.push(f);
    }
    return res;
  });

  T('ما في بيانات شخصية أو كتب بمجلد المشروع', () => {
    const found = [];
    const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['.git', 'node_modules', 'report'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(daftar|daftari\.json)$/i.test(e.name) || /pending\.js$/.test(e.name)) found.push(path.relative(ROOT, p)); } };
    walk(ROOT);
    if (found.length) fail(found.join(', '));
    const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    for (const k of ['*.daftar', '*.daftari.json', 'app/inbox/']) if (!gi.includes(k)) fail('.gitignore ناقصه ' + k);
  });

  T('CSS: دعم الوضع الخاص بالطباعة وتقليل الحركة', () => {
    if (!/@media print/.test(css)) fail('ما في ستايل طباعة');
    if (!/prefers-reduced-motion/.test(css)) fail('ما في احترام لتقليل الحركة');
    if (!/@page\s*\{[^}]*A4/.test(css)) fail('صفحة الطباعة مش A4');
  });

  return { name: 'static', title: 'تصميم النظام والبنية (بدون متصفح)', tests, errors: [], ms: tests.reduce((s, t) => s + t.ms, 0) };
}
