// مشغّل اختبارات دفتري: بيشغّل Edge الحقيقي بدون واجهة، بيفتح التطبيق من file://،
// وبيشغّل كل مجموعة اختبارات بملف تعريف جديد ونظيف. بدون أي مكتبات خارجية.
//   node tests/run.mjs            ← كل الاختبارات
//   node tests/run.mjs ui journey ← بس المجموعات اللي اسمها فيه هالكلمات
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runStatic } from './static.mjs';
import http from 'node:http';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const APP = pathToFileURL(path.join(ROOT, 'app', 'index.html')).href;
const REPORT = path.join(HERE, 'report');
const SHOTS = path.join(REPORT, 'shots');
const filters = process.argv.slice(2).map(s => s.toLowerCase());
const sleep = ms => new Promise(r => setTimeout(r, ms));

function findBrowser() {
  const c = [
    process.env['ProgramFiles(x86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.ProgramFiles + '\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.ProgramFiles + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return c.find(p => p && fs.existsSync(p));
}

// سيرفر محلي صغير (زي GitHub Pages) للمجموعات اللي بدها http: عامل الخدمة والتثبيت ما بيشتغلوا من file://
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
function serveApp() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const f = path.join(ROOT, 'app', u.endsWith('/') ? u + 'index.html' : u);
      if (!f.startsWith(path.join(ROOT, 'app')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

class Browser {
  constructor(port, prof) { this.port = port; this.prof = prof; this.id = 0; this.pend = new Map(); this.errors = []; this.rpc = null; }
  async start(url = APP) {
    const exe = findBrowser();
    if (!exe) throw new Error('لم أجد Edge أو Chrome');
    this.proc = spawn(exe, ['--headless=new', ...(process.env.DAFTARI_NO_GPU ? ['--disable-gpu'] : []), '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-port=0', `--user-data-dir=${this.prof}`, '--window-size=1366,800',
      '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', url], { stdio: 'ignore' });
    let t;
    for (let i = 0; i < 60 && !t; i++) {
      await sleep(250);
      // المنفذ بيختاره المتصفح نفسه (0) حتى ما نتصل بالغلط بمتصفح قديم عالق من تشغيل سابق
      try { this.port = +fs.readFileSync(path.join(this.prof, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0]; } catch { continue; }
      try { t = (await (await fetch(`http://127.0.0.1:${this.port}/json`)).json()).find(x => x.type === 'page' && /^(file|http):/.test(x.url)); } catch { }
    }
    if (!t) throw new Error('ما قدرت أتصل بالمتصفح');
    this.ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = m => this.onMsg(JSON.parse(m.data));
    await this.send('Runtime.enable'); await this.send('Page.enable');
    await this.send('Runtime.addBinding', { name: '__rpc' });
    await this.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 800, deviceScaleFactor: 1, mobile: false });
    await this.waitReady();
  }
  onMsg(d) {
    if (d.id && this.pend.has(d.id)) { this.pend.get(d.id)(d); this.pend.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') this.errors.push('استثناء: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | '));
    if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) this.errors.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300));
    if (d.method === 'Runtime.bindingCalled' && d.params.name === '__rpc') this.onRpc(JSON.parse(d.params.payload));
  }
  send(method, params = {}) { return new Promise(r => { const i = ++this.id; this.pend.set(i, r); this.ws.send(JSON.stringify({ id: i, method, params })); }); }
  async eval(expr, timeout = 240000) {
    const p = this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const r = await Promise.race([p, sleep(timeout).then(() => ({ timeout: true }))]);
    if (r.timeout) throw new Error('انتهت مهلة الاختبار');
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
  }
  async waitReady() {
    for (let i = 0; i < 80; i++) {
      try { if (await this.eval("!!(typeof Library !== 'undefined' && document.body.dataset.booted === '1')", 3000)) break; } catch { }
      await sleep(200);
    }
    await sleep(300);
  }
  // أوامر الاختبارات للمتصفح: صور، مقاس الشاشة، ماوس وكيبورد حقيقي
  async onRpc({ id, cmd, args }) {
    let res = null;
    try {
      if (cmd === 'shot') {
        const s = await this.send('Page.captureScreenshot', { format: 'png' });
        const f = path.join(SHOTS, `${args.suite}-${args.name}.png`.replace(/[^\w\-.؀-ۿ]+/g, '_'));
        fs.writeFileSync(f, Buffer.from(s.result.data, 'base64'));
        res = path.relative(REPORT, f).replace(/\\/g, '/');
      } else if (cmd === 'viewport') {
        await this.send('Emulation.setDeviceMetricsOverride', { width: args.w, height: args.h, deviceScaleFactor: 1, mobile: false });
      } else if (cmd === 'mouse') {
        for (const ev of args.events) await this.send('Input.dispatchMouseEvent', { button: 'left', clickCount: 1, buttons: ev.type === 'mouseReleased' ? 0 : 1, ...ev });
      } else if (cmd === 'key') {
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...args }); await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...args });
      } else if (cmd === 'text') {
        await this.send('Input.insertText', { text: args.text });
      } else if (cmd === 'gc') {
        await this.send('HeapProfiler.collectGarbage');
      } else if (cmd === 'metrics') {
        res = (await this.send('Performance.getMetrics')).result?.metrics;
      } else if (cmd === 'server') {
        // تشغيل/إطفاء السيرفر (= فصل الإنترنت) لاختبار الشغل بدون إنترنت
        if (args.on === false && this.srv) { await new Promise(r => { this.srv.closeAllConnections && this.srv.closeAllConnections(); this.srv.close(() => r()); }); this.srvPort = this.srv.address && this.srv.address() ? this.srv.address().port : this.srvPort; }
        res = true;
      } else if (cmd === 'installability') {
        res = (await this.send('Page.getInstallabilityErrors')).result?.installabilityErrors || null;
      } else if (cmd === 'manifest') {
        const r = (await this.send('Page.getAppManifest')).result || {};
        res = { url: r.url, errors: r.errors, ok: !!r.data };
      } else if (cmd === 'fixture') {
        // ملفات حقيقية للاختبار (file:// ما بيسمح بـ fetch)
        res = fs.readFileSync(path.join(HERE, 'fixtures', path.basename(args.name))).toString('base64');
      }
    } catch (e) { res = { error: e.message }; }
    this.send('Runtime.evaluate', { expression: `window.__rpcDone && window.__rpcDone(${id}, ${JSON.stringify(res)})` });
  }
  async reload() { this.errors = []; await this.send('Page.reload'); await sleep(500); await this.waitReady(); }
  // سكّر المتصفح كله (مش بس العملية الأم): Edge بيفتح عمليات أبناء بتضل عايشة لو قتلنا الأب بس
  async close() {
    try {
      const line = fs.readFileSync(path.join(this.prof, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[1];
      const bw = new WebSocket(`ws://127.0.0.1:${this.port}${line}`);
      await Promise.race([new Promise(r => { bw.onopen = r; bw.onerror = r; }), sleep(2000)]);
      bw.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      await sleep(800);
    } catch { }
    try { this.ws.close(); } catch { }
    // احتياط: أي عملية لسا عايشة بنفس ملف التعريف
    const prof = this.prof.replace(/'/g, "''");
    spawnSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${prof}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' });
  }
}

async function runSuite(file, idx) {
  const code = fs.readFileSync(file, 'utf8');
  const harness = fs.readFileSync(path.join(HERE, 'lib', 'harness.js'), 'utf8');
  const name = path.basename(file, '.js');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'daftari-test-'));
  const b = new Browser(9500 + idx, prof);
  const out = { name, tests: [], errors: [], ms: 0 };
  const t0 = Date.now();
  try {
    // مجموعة فيها http: true بتنفتح من سيرفر محلي بدل file://
    if (/\bhttp:\s*true\b/.test(code)) { b.srv = await serveApp(); await b.start(`http://127.0.0.1:${b.srv.address().port}/index.html`); }
    else await b.start();
    await b.send('Performance.enable');
    const phases = await b.eval(`(()=>{ ${code}; return SUITE.phases.length; })()`);
    for (let ph = 0; ph < phases; ph++) {
      if (ph > 0) await b.reload();
      const r = await b.eval(`(async()=>{ ${harness}; ${code}; return await __T.runPhase(SUITE, ${ph}, ${JSON.stringify(name)}); })()`);
      out.title = r.title;
      out.tests.push(...r.tests);
      if (b.errors.length) { out.errors.push(...b.errors.map(e => `[مرحلة ${ph + 1}] ${e}`)); b.errors = []; }
    }
  } catch (e) { out.tests.push({ name: 'تشغيل المجموعة', ok: false, err: e.message, ms: 0 }); }
  finally { if (b.srv) try { b.srv.close(); } catch { } await b.close(); await sleep(500); try { fs.rmSync(prof, { recursive: true, force: true }); } catch { } }
  out.ms = Date.now() - t0;
  // أي خطأ بالكونسول بيعتبر فشل (إلا اللي الاختبار نفسه سبّبه عن قصد)
  const real = out.errors.filter(e => !/__expected__/.test(e));
  if (real.length) out.tests.push({ name: 'ولا خطأ بالكونسول طول المجموعة', ok: false, err: real.slice(0, 6).join('\n'), ms: 0 });
  else out.tests.push({ name: 'ولا خطأ بالكونسول طول المجموعة', ok: true, ms: 0 });
  return out;
}

function html(all, total, failed, ms) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = all.map(s => {
    const f = s.tests.filter(t => !t.ok).length;
    return `<section class="${f ? 'bad' : 'good'}"><h2>${f ? '✗' : '✓'} ${esc(s.title || s.name)} <small>${s.tests.length - f}/${s.tests.length} · ${(s.ms / 1000).toFixed(1)} ث</small></h2>
      <ul>${s.tests.map(t => `<li class="${t.ok ? 'ok' : 'no'}"><b>${t.ok ? '✓' : '✗'}</b> ${esc(t.name)} ${t.ms ? `<small>${t.ms}ms</small>` : ''}${t.err ? `<pre>${esc(t.err)}</pre>` : ''}${t.info ? `<pre class="info">${esc(typeof t.info === 'string' ? t.info : JSON.stringify(t.info, null, 1))}</pre>` : ''}${(t.shots || []).map(p => `<a href="${p}" target="_blank"><img src="${p}" loading="lazy"></a>`).join('')}</li>`).join('')}</ul></section>`;
  }).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تقرير اختبارات دفتري</title>
<style>body{margin:0;font:15px "Segoe UI",Tahoma,sans-serif;background:#0a1836;color:#e7ecff;padding:28px}h1{margin:0 0 6px;color:#f3e2b0}.sum{display:flex;gap:14px;margin:16px 0 26px}.sum div{padding:14px 20px;border-radius:14px;background:#13244d}.sum b{display:block;font-size:26px}section{background:#0f1f45;border:1px solid #233a72;border-radius:16px;padding:14px 18px;margin-bottom:14px}section.bad{border-color:#c94a5a}h2{margin:0 0 8px;font-size:17px}h2 small{color:#95a5cb;font-weight:400}ul{list-style:none;margin:0;padding:0}li{padding:6px 0;border-top:1px solid #1b2f60}li.ok b{color:#8cdcaa}li.no b{color:#ff8b98}li small{color:#7f8db3}pre{white-space:pre-wrap;background:#2a1220;color:#ffc6cd;padding:8px 10px;border-radius:8px;direction:ltr;text-align:left;font-size:12.5px}pre.info{background:#14264f;color:#cfe0ff}img{max-width:420px;border-radius:8px;margin:6px 6px 0 0;border:1px solid #233a72}</style>
<h1>تقرير اختبارات دفتري</h1><div>${new Date().toLocaleString('ar')}</div>
<div class="sum"><div><b>${total}</b>اختبار</div><div><b style="color:#8cdcaa">${total - failed}</b>نجح</div><div><b style="color:${failed ? '#ff8b98' : '#8cdcaa'}">${failed}</b>فشل</div><div><b>${(ms / 1000).toFixed(0)}</b>ثانية</div></div>${rows}</html>`;
}

(async () => {
  fs.rmSync(REPORT, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  const t0 = Date.now();
  const all = [];
  const want = n => !filters.length || filters.some(f => n.toLowerCase().includes(f));
  if (want('static')) {
    process.stdout.write('▶ static … ');
    const s = runStatic(ROOT);
    all.push(s);
    console.log(s.tests.every(t => t.ok) ? '✓' : `✗ (${s.tests.filter(t => !t.ok).length})`);
  }
  const files = fs.readdirSync(path.join(HERE, 'suites')).filter(f => f.endsWith('.js')).sort().filter(want);
  for (const [i, f] of files.entries()) {
    process.stdout.write(`▶ ${f} … `);
    const r = await runSuite(path.join(HERE, 'suites', f), i);
    all.push(r);
    const bad = r.tests.filter(t => !t.ok);
    console.log(bad.length ? `✗ ${bad.length} فشل` : `✓ ${r.tests.length}`);
    bad.forEach(t => console.log(`   ✗ ${t.name}\n     ${String(t.err || '').split('\n')[0]}`));
  }
  const total = all.reduce((s, x) => s + x.tests.length, 0), failed = all.reduce((s, x) => s + x.tests.filter(t => !t.ok).length, 0);
  fs.writeFileSync(path.join(REPORT, 'report.json'), JSON.stringify({ at: new Date().toISOString(), total, failed, suites: all }, null, 1));
  fs.writeFileSync(path.join(REPORT, 'index.html'), html(all, total, failed, Date.now() - t0));
  console.log(`\n${failed ? '✗' : '✓'} ${total - failed}/${total} نجح · التقرير: tests/report/index.html`);
  process.exit(failed ? 1 : 0);
})();
