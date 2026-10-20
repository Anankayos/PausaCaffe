// Layout audit: run it after changing copy, fonts or layout.
//
//   npm install && npx playwright install chromium
//   node tools/layout-audit.js
//
// 1. Accent clearance, measured in pixels: the title's drawn accent against the ink of the line above and of its own
//    letter below, at three title sizes.
// 2. Overlaps: every text box (DOM and canvas labels) against every other one and against the board / cup, at seven
//    screen sizes, in Italian and English, in the states that put the most text on screen. Also flags clipped text.
const path = require('path');
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CLEAR = 2; // px of air required between boxes
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function open(viewport, init) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: viewport.width < 600 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    if (init) await page.addInitScript(init);
    await page.goto('file://' + path.resolve(__dirname, '../index.html'));
    await page.waitForFunction(() => window.__pausaCaffe);
    await page.evaluate(() => document.fonts.ready);
    await sleep(250);
    return page;
  }

  // ---------- 1. Accent clearance ----------
  const decoder = await (await browser.newContext()).newPage();
  const accentRows = [];
  for (const width of [320, 390, 430]) {
    const page = await open({ width, height: 860 });
    await page.addStyleTag({ content: '.packet{background:#fff!important;color:#000!important}.packet-title .acc::after{background:#f00!important}' });
    await sleep(100);
    const fontSize = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('homeTitle')).fontSize));
    const png = await (await page.$('#homeTitle')).screenshot();
    const r = await decoder.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
      const red = [], inkAt = (x, y) => { const i = (y * W + x) * 4; return d[i] < 110 && d[i + 1] < 110 && d[i + 2] < 110; };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i] > 160 && d[i + 1] < 110 && d[i + 2] < 110) red.push([x, y]); }
      if (!red.length) return null;
      const ys = red.map((p) => p[1]), xs = red.map((p) => p[0]);
      const top = Math.min(...ys), bottom = Math.max(...ys), left = Math.min(...xs), right = Math.max(...xs), mid = (top + bottom) / 2;
      let above = 1e9, below = 1e9;
      for (let y = Math.max(0, top - 60); y < Math.min(H, bottom + 60); y++) for (let x = Math.max(0, left - 60); x < Math.min(W, right + 60); x++) {
        if (!inkAt(x, y)) continue;
        for (const [rx, ry] of red) { const dist = Math.hypot(rx - x, ry - y); if (y < mid) above = Math.min(above, dist); else below = Math.min(below, dist); }
      }
      return { above, below };
    }, png.toString('base64'));
    accentRows.push({ width, 'title size': fontSize + 'px', 'gap to the line above': (r.above / 2).toFixed(1) + ' px (' + (r.above / 2 / fontSize).toFixed(3) + ' em)',
      'gap to its own E': (r.below / 2).toFixed(1) + ' px (' + (r.below / 2 / fontSize).toFixed(3) + ' em)' });
    await page.context().close();
  }
  console.log('Accent clearance (the accent must not touch the line above; it should sit just over its letter):');
  console.table(accentRows);

  // ---------- 2. Overlaps ----------
  const collect = (page) => page.evaluate((CLEAR) => {
    const out = [], vis = (el) => el && !el.hidden && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
    const box = (name, r, kind) => { if (r && r.width > 0 && r.height > 0) out.push({ name, kind, l: r.left, t: r.top, r: r.right, b: r.bottom }); };
    const dom = (sel, name, kind) => { for (const el of document.querySelectorAll(sel)) if (vis(el) && (el.textContent.trim() || el.tagName === 'CANVAS')) box(name || sel, el.getBoundingClientRect(), kind || 'text'); };
    const clipped = [];
    const home = !document.getElementById('home').hidden;
    if (home) {
      ['.tear span', '.packet-eyebrow', '#homeTitle', '#chainCv', '.packet-tag', '.packet-net', '#homeBest', '#btnPlay', '#btnLang', '#btnSettings'].forEach((s) => dom(s));
    } else {
      ['#btnQuit', '#hudRound', '#hudName', '#hudTips', '#nextCard', '#statusPill', '#btnRestart', '#btnHint', '#btnServe'].forEach((s) => dom(s));
      const hint = document.getElementById('hint');
      if (vis(hint) && hint.textContent.trim()) { box('#hint', hint.getBoundingClientRect(), 'text'); if (hint.scrollHeight > hint.clientHeight + 1) clipped.push('#hint'); }
      const pill = document.getElementById('statusPill');
      if (pill.textContent) {
        // Clipped sideways, or a line of text outside the capsule (the cup's capsule wraps; three lines would spill).
        const pr = pill.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(pill);
        const out = Array.prototype.some.call(rg.getClientRects(), (r) => r.top < pr.top - 1 || r.bottom > pr.bottom + 1);
        if (pill.scrollWidth > pill.clientWidth + 1 || out) clipped.push('#statusPill');
      }
      const name = document.getElementById('hudName');
      if (name.scrollHeight > name.clientHeight + 1) clipped.push('#hudName');
      const s = window.__pausaCaffe.scene, cv = document.getElementById('cv').getBoundingClientRect(), X = cv.left, Y = cv.top;
      const c = document.createElement('canvas').getContext('2d');
      if (s.kind === 'maze') box('board', { left: X + s.bx - 6, top: Y + s.by - 6, right: X + s.bx + s.size + 6, bottom: Y + s.by + s.size + 6, width: 1, height: 1 }, 'content');
      else {
        const F = window.__pausaCaffe.FILL_BONUS, CH = s.world.CH, maxR = window.__pausaCaffe.TIER_R[2];
        box('cup', { left: X + s.marksLeft, top: Y + s.oy + (s.hoverY - maxR) * s.s, right: X + s.ox + 112 * s.s, bottom: Y + s.oy + (CH + 9) * s.s, width: 1, height: 1 }, 'content');
        c.font = '600 13px "Helvetica Neue", Helvetica, Arial, sans-serif';
        const label = '←  ' + (document.documentElement.lang === 'it' ? 'trascina per mirare' : 'drag to aim') + '  →', w = c.measureText(label).width;
        box('aim label', { left: X + (s.barL + s.barR) / 2 - w / 2, top: Y + s.trackY + 20, right: X + (s.barL + s.barR) / 2 + w / 2, bottom: Y + s.trackY + 36, width: 1, height: 1 }, 'text');
        box('aim track', { left: X + s.barL, top: Y + s.trackY - 15, right: X + s.barR, bottom: Y + s.trackY + 15, width: 1, height: 1 }, 'content');
        c.font = '700 11px "Helvetica Neue", Helvetica, Arial, sans-serif';
        for (const m of F) {
          const wm = c.measureText('+' + m.tips).width, rx = X + s.ox + (-2.6 - 5) * s.s, cy = Y + s.oy + CH * (1 - m.at) * s.s;
          box('mark +' + m.tips, { left: rx - wm, top: cy - 7, right: rx, bottom: cy + 7, width: 1, height: 1 }, 'label');
        }
      }
    }
    const hits = [];
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      if ((a.kind === 'label' && b.name === 'cup') || (b.kind === 'label' && a.name === 'cup')) continue; // the marks belong to the cup
      if (a.kind === 'label' && b.kind === 'label') continue;
      if (a.kind === 'content' && b.kind === 'content') continue;
      const gapX = Math.max(a.l - b.r, b.l - a.r), gapY = Math.max(a.t - b.b, b.t - a.b);
      if (gapX < CLEAR && gapY < CLEAR) hits.push(a.name + ' × ' + b.name + ' (' + Math.round(Math.max(gapX, gapY)) + ' px)');
    }
    return { boxes: out.length, hits, clipped };
  }, CLEAR);

  const sizes = [[320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [430, 932], [768, 1024]];
  const rows = [];
  for (const lang of ['it', 'en']) for (const [width, height] of sizes) {
    const page = await open({ width, height });
    await page.evaluate((lang) => {
      localStorage.setItem('pausa-caffe:v2:settings', JSON.stringify({ lang }));
      localStorage.setItem('pausa-caffe:v2:mazeLevel', '0');
    }, lang);
    await page.reload(); await page.waitForFunction(() => window.__pausaCaffe); await page.evaluate(() => document.fonts.ready); await sleep(200);
    const states = [];
    states.push(['home', await collect(page)]);
    // Maze tutorial.
    await page.evaluate(() => window.__pausaCaffe.startVisit()); await sleep(300);
    states.push(['maze tutorial', await collect(page)]);
    // A first passage (the longest hint), with the Hint button offered.
    await page.evaluate(() => { localStorage.setItem('pausa-caffe:v2:mazeLevel', '3'); localStorage.removeItem('pausa-caffe:v2:passTutDone'); });
    await page.reload(); await page.waitForFunction(() => window.__pausaCaffe); await page.evaluate(() => document.fonts.ready); await sleep(200);
    await page.evaluate(() => window.__pausaCaffe.startVisit()); await sleep(300);
    await page.evaluate(() => { window.__pausaCaffe.scene.activeTime = 41; }); await sleep(150);
    states.push(['maze: first passage + hint', await collect(page)]);
    // Solved but not full: Restart and Serve under the longest capsule text.
    await page.evaluate((lang) => {
      const s = window.__pausaCaffe.scene;
      s.pairs.forEach((p, q) => { s.paths[q] = p.sol.slice(); }); s.complete = s.pairs.map(() => true); s.showServe(true);
      document.getElementById('statusPill').textContent = lang === 'it' ? 'Riempi tutte le caselle: +40' : 'Fill every cell: +40';
    }, lang);
    await sleep(100);
    states.push(['maze: solved', await collect(page)]);
    // Cup: tutorial start, a mark reached, a rim warning.
    await page.evaluate(() => { localStorage.removeItem('pausa-caffe:v2:mergeTutDone'); });
    await page.evaluate(() => { const s = window.__pausaCaffe.scene; s.finish(false); }); await page.waitForSelector('#sheet:not([hidden])', { timeout: 5000 });
    await page.click('#btnNext'); await sleep(400);
    states.push(['cup: tutorial start', await collect(page)]);
    await page.evaluate(() => { const s = window.__pausaCaffe.scene; s.passBonus = 20; s.bonusNote = 5; s.refreshServe(); }); await sleep(100);
    states.push(['cup: passage bonus note', await collect(page)]);
    await page.evaluate(() => { const s = window.__pausaCaffe.scene; s.bonusNote = 0; s.refreshServe(); });
    await page.evaluate(() => { const s = window.__pausaCaffe.scene; s.reachMark(window.__pausaCaffe.FILL_BONUS[2]); }); await sleep(150);
    states.push(['cup: top mark, Serve', await collect(page)]);
    await page.evaluate(() => { const s = window.__pausaCaffe.scene, w = s.world; w.step = () => {}; const b = w.add(2, 50, -8, 0); b.age = 1; b.px = b.x; b.py = b.y; b.contact = true; }); await sleep(300);
    states.push(['cup: rim warning', await collect(page)]);
    for (const [state, r] of states) rows.push({ lang, size: width + '×' + height, state, boxes: r.boxes, overlaps: r.hits.join('; ') || '—', clipped: r.clipped.join(', ') || '—' });
    await page.context().close();
  }
  const bad = rows.filter((r) => r.overlaps !== '—' || r.clipped !== '—');
  console.log('Overlap audit: ' + rows.length + ' screens checked, ' + bad.length + ' with problems');
  if (bad.length) console.table(bad); else console.table(rows.filter((r, i) => i % 7 === 0));
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})();
