// Takes the guide's screenshots with headless Chrome over CDP (no dependency).
// Usage: serve the app first (node serve.ts), start Chrome with
//   /opt/meta-chromium/chrome --headless=new --remote-debugging-port=9223 \
//     --no-first-run --disable-gpu --window-size=1280,800 about:blank
// then: node scripts/shots.mjs
// It seeds 13 earned trophies so the tracker shows real progress, then captures
// the guide list, the roadmap, the missables page, and the spoiler setting.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(new URL('.', import.meta.url)));
const SHOTS_DIR = join(ROOT, 'screenshots');
const PORT = 9223;
const APP_URL = 'http://localhost:8080/';

const SEEDED = [
  'Just Like Paradise', 'Paradise Lost', 'T**s Ass Drug Money', 'Vice City, Baby!',
  'Top Of The World, Ma', 'Trust', 'Break the Bank', 'Family Matters', 'DWNFALL',
  'Hi-Jacked', 'Snow Storm', 'Cunning Stunts', 'Master of None',
];

let nextId = 1;
const pending = new Map();
let ws;
let loadResolve = null;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('evaluate failed: ' + JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

async function waitForApp() {
  for (let i = 0; i < 40; i++) {
    const href = await evaluate('location.href');
    if (typeof href === 'string' && href.startsWith(APP_URL)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('app did not load at ' + APP_URL);
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
  const buf = Buffer.from(data, 'base64');
  const path = join(SHOTS_DIR, name);
  writeFileSync(path, buf);
  console.log(name, buf.length + ' bytes');
  if (buf.length > 262144) throw new Error(name + ' over the 256 KiB cap');
}

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
    if (msg.method === 'Page.loadEventFired' && loadResolve) {
      const r = loadResolve;
      loadResolve = null;
      r();
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  // 1 — guide list, with 13 trophies seeded as earned. Chrome 157 blocks a
  // direct about:blank -> localhost hop (local-network-access check), so go
  // through a file:// redirect page, which is allowed to reach localhost.
  const nav1 = send('Page.navigate', { url: 'file:///tmp/redirect.html' });
  await waitForApp();
  await nav1;
  await evaluate(`localStorage.setItem('leonida-trophy-guide-v1', JSON.stringify(${JSON.stringify(SEEDED)})); 'seeded'`);
  const nav2 = send('Page.navigate', { url: 'file:///tmp/redirect.html' });
  await waitForApp();
  await nav2;
  await new Promise((r) => setTimeout(r, 600));
  await shot('1-guide.jpg');

  // 2 — platinum roadmap tab.
  await evaluate(`document.getElementById('tabRoadmap').click(); 'roadmap'`);
  await new Promise((r) => setTimeout(r, 400));
  await shot('2-roadmap.jpg');

  // 3 — missables tab.
  await evaluate(`document.getElementById('tabMissable').click(); 'missable'`);
  await new Promise((r) => setTimeout(r, 400));
  await shot('3-missables.jpg');

  // 4 — guide tab with the spoiler setting on (story names hidden until earned).
  // Scroll to the first hidden story trophy so the effect is visible: the
  // earned story trophies at the top of the list stay revealed.
  await evaluate(`document.getElementById('tabGuide').click();
    document.getElementById('spoilerToggle').click();
    const hidden = [...document.querySelectorAll('.trophy-card')].find((c) => c.querySelector('.spoiler-note'));
    if (hidden) hidden.scrollIntoView({ block: 'center' });
    'spoiler'`);
  await new Promise((r) => setTimeout(r, 400));
  await shot('4-spoilers.jpg');

  ws.close();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
