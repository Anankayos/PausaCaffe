// Balance check for "Fill the cup": plays simulated cups with three kinds of players, using the game's own physics,
// fill measure and spill rule (nobody serves), and reports how long a cup lasts and how often each fill mark is
// reached before the spill. That second number is the chance a player who serves at that mark wins the cup.
//
//   npm install && npx playwright install chromium
//   node tools/balance.js            (40 runs per row, 8 for the slow "strong" player; pass a number to change it)
//   node tools/balance.js 40 quick   (skip the strong player)
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const runs = Number(process.argv[2]) || 40, quick = process.argv[3] === 'quick';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => window.__pausaCaffe);

  const rows = await page.evaluate(({ runs, quick }) => {
    const { CupWorld, surfaceFill, rimCheck, ITEMS, TIER_R, TOP, CUP_HEIGHT, SPAWN_WEIGHTS, RISE_PER_DROP, FILL_BONUS, STEP, TOSS, mulberry32 } = window.__pausaCaffe;
    const CAP = 300; // drops; a cup that reaches it counts as "never spilled"
    const pick = (rng, w) => { let x = rng() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return i; return w.length - 1; };
    const hoverY = -(TIER_R[2] + 3);
    const clone = (w) => { const c = new CupWorld(w.CH); c.floor = w.floor; c.floorTarget = w.floorTarget; c.uid = w.uid; c.bodies = w.bodies.map((b) => Object.assign({}, b)); return c; };

    // careless: drops anywhere, about every 0.75 s.
    // decent: aims at a reachable twin (else the lowest spot) with ±3 units of thumb error, about every 1.1 s.
    // strong: tries a column every 4 units, simulates 1 s of physics for each, keeps the best (no aim error), every 1.2 s.
    function column(w, item, policy, rng) {
      const r = TIER_R[ITEMS[item].tier];
      if (policy === 'careless') return r + rng() * (100 - 2 * r);
      if (policy === 'decent') {
        let x = r + rng() * (100 - 2 * r), best = -1e9;
        for (let cx = r; cx <= 100 - r; cx += 1.5) {
          const ly = w.landingY(cx, r);
          const hit = w.bodies.find((b) => { const dx = b.x - cx, rs = r + b.r; return Math.abs(dx) < rs && Math.abs(b.y - Math.sqrt(rs * rs - dx * dx) - ly) < 1e-6; });
          const score = (hit && hit.item === item ? 200 : 0) + ly - (hit && hit.item !== item ? 10 : 0);
          if (score > best) { best = score; x = cx; }
        }
        return Math.min(100 - r, Math.max(r, x + (rng() * 6 - 3)));
      }
      let bestX = 50, best = -1e9;
      for (let cx = r; cx <= 100 - r + 0.01; cx += 4) {
        const sim = clone(w);
        sim.add(item, cx, hoverY, -TOSS);
        for (let k = 0; k < 240; k++) sim.step(STEP);
        let gain = 0;
        for (const ev of sim.events) gain += ITEMS[ev.item].tier === TOP ? 40 : (1 + ITEMS[ev.item].tier) * 6;
        let top = sim.floor; for (const b of sim.bodies) top = Math.min(top, b.y - b.r);
        const score = gain + top - sim.bodies.length * 1.5 - (sim.bodies.some((b) => b.y - b.r < 0) ? 1000 : 0);
        if (score > best) { best = score; bestX = cx; }
      }
      return bestX;
    }

    function play(height, policy, seed) {
      const rng = mulberry32(seed), w = new CupWorld(height), weights = SPAWN_WEIGHTS[2];
      let drops = 0, seconds = 0, spilled = false, frames = 0;
      const reached = FILL_BONUS.map(() => null);
      const frame = () => {
        for (let k = 0; k < 4; k++) w.step(STEP);
        seconds += 1 / 60; w.events.length = 0;
        if (++frames % 6 === 0) { const f = surfaceFill(w); FILL_BONUS.forEach((m, i) => { if (reached[i] === null && f >= m.at) reached[i] = seconds; }); }
        for (const b of w.bodies) if (rimCheck(b, 1 / 60) === 2) spilled = true;
      };
      while (!spilled && drops < CAP) {
        const item = (rng() < 0.5 ? 4 : 0) + pick(rng, weights);
        w.add(item, column(w, item, policy, rng), hoverY, -TOSS);
        drops++;
        w.setCoffee(drops * RISE_PER_DROP);
        const wait = policy === 'careless' ? 0.5 + rng() * 0.5 : policy === 'decent' ? 0.8 + rng() * 0.6 : 1.2;
        for (let t = 0; t < wait && !spilled; t += 1 / 60) frame();
      }
      return { drops, seconds, spilled, reached };
    }

    const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
    const out = [];
    for (const [cup, height] of Object.entries(CUP_HEIGHT)) {
      for (const policy of quick ? ['careless', 'decent'] : ['careless', 'decent', 'strong']) {
        const n = policy === 'strong' ? Math.max(4, Math.round(runs / 5)) : runs, res = [];
        for (let s = 1; s <= n; s++) res.push(play(height, policy, s * 7919 + height));
        const row = {
          cup, player: policy, runs: n,
          'median drops': median(res.map((r) => r.drops)),
          'median time': Math.round(median(res.map((r) => r.seconds))) + ' s',
          'never spilled': Math.round((100 * res.filter((r) => !r.spilled).length) / n) + '%',
        };
        FILL_BONUS.forEach((m, i) => {
          const hit = res.filter((r) => r.reached[i] != null);
          row['+' + m.tips + ' mark'] = Math.round((100 * hit.length) / n) + '% · ' + Math.round(median(hit.map((r) => r.reached[i])) || 0) + ' s';
        });
        out.push(row);
      }
    }
    return out;
  }, { runs, quick });

  console.table(rows);
  await browser.close();
})();
