# Pausa Caffè

**▶ Play it: [anankayos.github.io/PausaCaffe](https://anankayos.github.io/PausaCaffe/)** (any browser, phone or desktop; add `?playtest` for the designer tools)

A browser prototype of a two-round bar game. One file, no libraries, no external requests: about 191 KB (78 KB compressed), the header font included.

- **Unisci le coppie / Join the pairs**: a no-crossing maze. Each pair is two identical items. Draw a path between them without crossing other paths. Some boards have a **passage**: an optional extra challenge for one pair.
- **Riempi la tazza / Fill the cup**: a merge game with two chains. Coffee: bean → espresso cup → moka → coffee machine. Milk: milk → cappuccino → latte macchiato → XXL latte. The top item of each chain is served straight out of the cup for +15 mance. The cup ends when something rests above the rim, or when the player taps **Servi / Serve**.

Every "+number" on screen carries its unit: "+20 mance" in Italian, "+20 tips" in English.

Rounds alternate until the player taps **Basta così / Finish**. The end-of-visit receipt links to [coffeeit.com](https://coffeeit.com/en/homepage/) and, below it, to [alessandropesetti.com](https://alessandropesetti.com).

The game starts in Italian. **English** on the start screen switches language, and the choice is remembered on that phone.

## Twists

| Twist | How it works |
|---|---|
| The maze feeds the cup | Every joined pair becomes the item it makes (two beans → a cup), and those items drop first in the next cup, biggest first. A perfect fill adds a moka. |
| The passage | From level 3, some boards have a passage tile painted in one pair's colour, with that pair's icon. Crossing it with that pair is worth +20 mance **in the next game**: the next game starts with them on the counter, announced in the status capsule. The reward is printed on the tile. The passage sits on the straight route of another pair, so taking it means moving them. It is never required. |
| Push your luck | Three fill marks on the cup: +10, +25, +50 mance. A reached mark is kept. Serving pays the highest one, and a spill loses it. |

## The passage, by construction

The generator keeps a passage only if all three of these hold, and `tools/maze-check.js` checks them on every board:

1. It lies on its own pair's full-fill route, so crossing it never rules out a perfect fill.
2. It lies inside the straight route of at least one other pair, so it is in their way.
3. Crossing it costs that pair extra cells, as measured by the solver. Since it is never on the shortest solution, a player can always skip it.

The passage changes with the level:

| Level | Whose passage | Extra cells to cross it |
|---|---|---|
| 3 | beans | +2 |
| 4 | milk | +2 |
| 5–7 | cups, cappuccinos, beans | +2 to +4 |
| 8–11 | milk, cups, cappuccinos, beans | +4 |
| 12+ | the same rotation | +4 to +6 |

The item rotates bean → milk → cup → cappuccino with the level, so every maze item gets passages. If a board offers no passage at the level's cost, the generator tries other boards first, and only near its time limit accepts one costing +2 to +6.

The first passage a player meets comes with a demo: a dotted ghost of its pair walks through the tile, breathing slowly (one breath every 4 s), and the reward tag breathes with it until the pair crosses. The **Hint** button reveals the passage pair's route first while the passage is still open. A revealed route is drawn under the paths and disappears once its pair is joined; if that path is cut later, the route comes back.

If the player finishes the visit right after the maze, an unclaimed passage bonus is added to the visit receipt, so nothing earned is lost.

## Win and lose

The cup is endless, so serving is the win, and every loss has to feel fair.

- **Marks are kept.** Fill is measured like a liquid level, the average height of the pile's surface. Once a mark is reached, merges that lower the pile never take the tip back.
- **Serve sits under the thumb.** It appears centred in the bottom bar once the first mark is reached, labelled with the tip it pays.
- **A warning is a chance.** An item must rest above the rim for 1.6 s to spill the cup. Meanwhile the rim pulses, the hint says "Servi ora", and Serve turns orange. Serving in that window pays in full ("Appena in tempo!").
- **Only resting items count.** An item counts while it touches the pile or a wall. In the air its count pauses without resetting, so neither a launched item nor bumping the top item changes the outcome.
- **A spill is soft.** It loses only the serve bonus.
- **The coffee rises 0.5 units per drop** (never per second, so looking away is free), visibly filling the cup with a moving crema surface. This is both the progress and the pressure: it is what makes every cup end eventually.
- **A stuck maze offers a hint** after 40 s, or after two restarts. A maze solved with a hint is replayed at the same difficulty.

### Balance

`node tools/balance.js 24` on the built game. Nobody serves, so "reaches" means the mark was there to be served before the cup spilled. The strong player gets only 5 runs, so treat that row as rough.

| Cup | Player | Cup lasts | +10 | +25 | +50 |
|---|---|---|---|---|---|
| Normal (104) | Careless | 34 s | 100% · 12 s | 100% · 19 s | 96% · 25 s |
| Normal (104) | Average | 74 s | 100% · 15 s | 100% · 37 s | 96% · 57 s |
| Normal (104) | Strong | 102 s | 100% · 24 s | 100% · 62 s | 100% · 87 s |
| Tight (92) | Average | 42 s | 100% | 100% | 96% |
| Roomy (116) | Average | 87 s | 100% | 100% | 100% |

Any change to the physics reshuffles every simulated cup, so 24 runs move a few seconds either way. When merges started waiting for a visible contact (below), 60 runs per row on the old and new builds gave an average player's cup 51 → 48 s (tight), 70 → 73 s (normal) and 87 → 81 s (roomy), with the top mark reached in 93/97/100% of cups before and 93/98/98% after: the same balance.

No cup size, player or strategy produced a cup that never ends. In longer runs of the same physics (24 runs per player, 12 for the strong one), dumping everything against one wall or in the middle loses faster than playing honestly.

How the rise rate was chosen (same simulator, average player): 0.2 per drop gave 118 s cups, 0.35 gave 81 s, **0.5 gave 57 s with the +50 mark still reached in 96% of cups**, and 0.7 squeezed strong and average players together (78 s vs 59 s), so skill stopped mattering.

### Merges you can see

Two identical items that touch stay stuck together for 0.06 s (about 4 frames at 60 fps), then fuse. Any touch still merges, and a bounce that opens a gap is pulled shut. Before, they fused on the first physics step of contact: a falling item moves several units per frame, so the last frame the player saw still showed a gap of up to 4 units (about 10 px), and no frame ever showed them touching. Now 3 to 4 frames show them touching.

### Calmer merges

A merged item swells in over about 0.25 s and pushes its neighbours aside without giving them speed. It keeps only some of the pair's momentum, and nothing moves upward faster than 110 units/s. On the same drop sequences, the worst hop of a neighbour after a merge went from 432 units (out of the cup) to 32, and the 99th percentile from 108 to 18.

## Layout rules

- **Tutorial hints** sit in a cream capsule right above the content. Its left edge is on the board's left edge in the maze, and on the left edge of the cup drawing (its measuring marks) in the cup. The capsule covers only its text: the browser balances the line breaks at full width, the script freezes those breaks, and the capsule shrinks to the longest line.
- **Next item and aim bar**: in the cup, the bottom bar's status row spans the screen minus its 16 px margins: a white "POI" / "NEXT" card with the next item on the left, the moka-blue capsule filling the rest. The aim bar above it is drawn to exactly the same ends, measured from the row itself. The item in the card is sized by tier (small, medium, large) and pops in after each drop. The capsule's text wraps to two balanced lines only where one won't fit (the longest texts on a 320 px phone).
- **Aiming is proportional**: the bar's whole travel covers every column the held item can drop in, wall to wall, so the bar is wider than the cup and a finger move places the item more finely. The knob shows where the item will fall, and the dashed guide under the item shows it in the cup.
- **Status** ("Unite 0 su 3", "Prossima tacca: +25 mance") sits in a moka-blue capsule, centred, with Restart, Hint and Serve centred right below it, in thumb reach. Its capitals are centred vertically too: trimmed to cap height where the browser supports `text-box`, padded to match elsewhere.
- **Button colours follow the items**: green like the espresso cup for moving forward (Play, Serve, Next), pink like the latte for Play again, and orange only for a rim warning. White on the green is 3.4:1, so those labels are at least 19 px bold (large text); Play again uses dark ink on pink (5.9:1).
- **Background**: a cream ground, rgb(235, 228, 210), in the light theme. The board, the cup and the receipt stay white.
- **Nothing overlaps.** `tools/layout-audit.js` checks every text box against every other one, and against the board and the cup, with 2 px of air. It also flags clipped text and any capsule wider than its text. It covers 7 screen sizes from 320×568 to 768×1024, in both languages, across 8 states (home, maze tutorial, first passage with hint, solved maze, cup tutorial, passage bonus, top mark, rim warning). Last run: 112 screens, 0 problems.

## Type

- **Headers**: Coffee Town by Khurasan ([khurasanstudio.com](https://www.khurasanstudio.com)). The designer's readme says "100% free for personal use & commercial use", and 1001fonts.com lists it under CC BY-ND, so the original OTF file is embedded unmodified (no subsetting, no conversion) and credited in the settings panel. For a commercial release, written confirmation from khurasantype@gmail.com is cheap insurance.
- **Coffee Town has no accented letters** (it draws È as E). Headers wrap each accented letter so CSS draws the accent in the same ink. Every Coffee Town header uses line-height 1.2, measured from the font: its ink reaches 0.81 em above the baseline and 0.09 em below. The title's È accent clears the line above by about 0.21 em at every screen size, measured in pixels by the audit.
- **Everything else**: Helvetica (Helvetica Neue, Helvetica, then Arial). Android phones have neither, so they show Arial or their system sans. Receipts keep a monospace face, as a thermal-printer touch.

## Playable from any browser

- Script syntax is ES2017 (no `?.`, no `??`). It runs on Safari 11+, Chrome/Edge 60+, Firefox 55+ and Samsung Internet.
- No Pointer Events (iOS 12 and older): touch and mouse fallbacks drive the same input.
- No ResizeObserver: falls back to resize and orientation events.
- Old `matchMedia` listeners (Safari before 14): `addListener` fallback.
- Safe-area gutters use `max()` behind `@supports`, with a plain 16 px fallback.
- No storage (private mode, in-app browsers): the game still runs, it just forgets progress.

Tested in headless Chromium, including touch-only and mouse-only runs with Pointer Events, ResizeObserver and `MediaQueryList.addEventListener` removed. It has not been tested on a real iPhone, Firefox or Samsung Internet yet. Do that before printing the packets.

## Try it on your phone

It is live on GitHub Pages: [anankayos.github.io/PausaCaffe](https://anankayos.github.io/PausaCaffe/). Every push to `main` updates it within a minute or two. `index.html` also runs from any other static host (Netlify Drop, or itch.io as a zipped HTML5 game). Point a QR code at the shortest URL you can get.

QR tip: write the URL in capitals (`HTTPS://ABC.IT/7`). Uppercase uses the denser "alphanumeric" QR mode, so the code stays small even with error-correction level Q. Make the server path case-insensitive.

## The maze: new every time, never obvious

Boards are generated when each round starts:

1. A random path visits every cell and is cut into one segment per pair. This guarantees the board can be solved with every cell filled.
2. A solver measures the **detour**: the fewest extra cells, over all pairs, needed to join everything without crossings.
3. A detour of 0 means every pair can take its straightest route at the same time. Those boards are thrown away.
4. Each level asks for a detour range. A phone also remembers its last 30 boards and never gets one of them again.

| Level | Board | Pairs | Detour | Passage |
|---|---|---|---|---|
| 0 | 4×4 tutorial (fixed) | 2 | 0 | no |
| 1–2 | 5×5 | 3 | 2–4 | no |
| 3–4 | 5×5 | 3 | 2–6 | always |
| 5–7 | 6×6 | 3 | 4–8 | about half the boards |
| 8–11 | 6×6 | 4 | 4–8 | about half |
| 12+ | 6×6 | 4 | 6–10 | about half |

`node tools/maze-check.js` (60 boards per level, levels 1, 3, 4, 5, 6, 8 and 12): every board was in range, fill-solvable and unique. Every passage was on its own pair's route and in another pair's way, and cost exactly the measured extra cells. The item followed the rotation, and the cost stayed inside each level's range. Generation took 1–10 ms (median) and 124 ms at worst, at level 12.

Scoring: 15 mance per pair, +40 for filling every cell, +25 for no redraws, and +20 in the next game for crossing the passage.

**Drawing follows the thumb.** The path moves one cell at a time (crossing a cell's edge takes the cell), but while dragging, the line's end is drawn at the finger, projected onto the grid, and the translucent halo sits under the thumb. Before, the line's end sat on the head cell's centre: half a cell behind the thumb, then half a cell ahead on entering the next cell, which looked like lag. On a 16-cell drag, the gap between finger and line end went from 17 px median (28.5 px at worst) to 0. Drawing still takes about 1 ms a frame with the CPU slowed 4×.

## Settings

Players can change how the game plays. On the start screen, tap **Impostazioni / Settings**. Options are grouped by game, each group under the game's name; multiple-choice options show their label on top and the choices below, on/off switches sit on one line.

**Unisci le coppie / Join the pairs**
- **Passages in mazes**: on (default) or off.
- **Drawing over a path**: cuts it (*lo taglia*, default) or blocks it (*lo blocca*).

**Riempi la tazza / Fill the cup**
- **Cup size**: tight (92), normal (104, default), roomy (116).
- **Items that drop**: small only, + medium (default), + large.
- **Milk items**, **Coffee rises**: on (default) or off.

**Ripristina predefiniti / Reset to defaults** puts every option back as designed and keeps the chosen language.

### Designer extras: `?playtest`

Open the game with `?playtest` (or `#playtest`) at the end of the address to add what players never see. Without it, players get no way in.

- **Next maze**: jump to any difficulty level.
- **Playtest log**: every finished round, saved on that phone only. **Copy CSV** exports it.
- **Reset progress**: best score, maze level, tutorials seen.

The log is always recorded on the phone; the flag only shows it. CSV columns: `ts, round, kind, seconds, tips, level, board, pairs, detour, passage, passed, moves, filled, clean, cross, hints, carried, drops, ending, best_tier, merges, tops, fill, serve_bonus, clutch, pass_bonus, cup, spawn, milk, rise`. `seconds` counts only time with the page visible. `passed` marks mazes where the passage was crossed, and `pass_bonus` the bonus a cup started with. `clutch` marks cups served during a rim warning.

## Tools

```
npm install && npx playwright install chromium
npm run maze-check               # maze generator: difficulty, fill-solvability, variety, passages, speed
npm run balance                  # cup: how long it lasts and how often each mark is reached, per cup size
node tools/balance.js 40 quick   # same, without the slow "strong" player
npm run layout-audit             # no text box overlaps another, at 7 screen sizes, in both languages
```

All three load `index.html` and use the game's own code (physics, fill measure, spill rule, generator, layout), so they stay accurate when you change values.
