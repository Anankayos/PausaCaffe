// Maze check: generates boards with the game's own generator and confirms, per difficulty level, that every board
// forces the intended detour, can be solved with every cell filled, never repeats, and is generated quickly.
// For boards with a passage it also checks the promises the passage makes: it lies on its own pair's full-fill route
// (taking it never rules out a perfect fill), it sits in another pair's straight route (taking it means moving them),
// and taking it costs the extra cells the generator measured. It also shows how the passage changes with the level:
// whose passage it is (the item rotates: bean, milk, cup, cappuccino) and how many extra cells crossing it costs.
//
//   npm install && npx playwright install chromium
//   node tools/maze-check.js         (100 boards per level; pass a number to change it)
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const count = Number(process.argv[2]) || 100;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => window.__pausaCaffe);

  const rows = await page.evaluate((count) => {
    const { makeBoard, minExtra, levelSpec } = window.__pausaCaffe;
    const NAMES = { 0: 'bean', 1: 'cup', 4: 'milk', 5: 'cappuccino' };
    const out = [];
    for (const level of [1, 3, 4, 5, 6, 8, 12]) {
      const spec = levelSpec(level), times = [], layouts = new Set(), cost = {}, items = {};
      let inRange = 0, fillable = 0, passages = 0, onRoute = 0, inTheWay = 0, costOk = 0;
      for (let i = 0; i < count; i++) {
        const t0 = performance.now();
        const board = makeBoard(level, [], true);
        times.push(performance.now() - t0);
        const n = board.n, detour = minExtra(n, board.pairs, 14, performance.now() + 5000, null);
        if (detour === board.detour && detour >= spec.min && detour <= spec.max) inRange++;
        if (new Set(board.pairs.flatMap((p) => p.sol)).size === n * n) fillable++;
        layouts.add(board.pairs.map((p) => [p.a, p.b].sort((a, b) => a - b).join('-')).sort().join('|'));
        const g = board.gate;
        if (!g) continue;
        passages++;
        const sol = board.pairs[g.pair].sol, at = sol.indexOf(g.cell);
        if (at > 0 && at < sol.length - 1) onRoute++;
        const inBox = (p, cell) => {
          const r = (cell / n) | 0, c = cell % n, ra = (p.a / n) | 0, ca = p.a % n, rb = (p.b / n) | 0, cb = p.b % n;
          return r >= Math.min(ra, rb) && r <= Math.max(ra, rb) && c >= Math.min(ca, cb) && c <= Math.max(ca, cb);
        };
        if (board.pairs.some((p, j) => j !== g.pair && inBox(p, g.cell))) inTheWay++;
        const extra = minExtra(n, board.pairs, 20, performance.now() + 5000, g) - detour;
        if (extra === g.extra) costOk++;
        cost['+' + extra] = (cost['+' + extra] || 0) + 1;
        const who = NAMES[board.pairs[g.pair].item];
        items[who] = (items[who] || 0) + 1;
      }
      times.sort((a, b) => a - b);
      out.push({
        level, board: `${spec.n}×${spec.n}, ${spec.k} pairs`, 'detour range': `${spec.min}–${spec.max}`,
        'in range': `${inRange}/${count}`, 'fill-solvable': `${fillable}/${count}`, 'distinct layouts': `${layouts.size}/${count}`,
        passages, 'on its own route': `${onRoute}/${passages}`, "in another pair's way": `${inTheWay}/${passages}`,
        'cost as measured': `${costOk}/${passages}`, 'passage item': Object.entries(items).map(([k, v]) => `${k}:${v}`).join(' '),
        'cost aimed for': spec.cost ? `+${spec.cost[0]}–${spec.cost[1]}` : '', 'extra cells to take it': Object.entries(cost).map(([k, v]) => `${k}:${v}`).join(' '),
        'median ms': +times[count >> 1].toFixed(1), 'slowest ms': +times[count - 1].toFixed(1),
      });
    }
    return out;
  }, count);

  console.table(rows);
  await browser.close();
})();
