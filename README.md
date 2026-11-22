# VAULTFALL: One Night at the Meridian Museum

[![make.fun](https://make.fun/c/best-heist-game-20261122-0559/badge.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![make.fun entry](https://make.fun/c/best-heist-game-20261122-0559/entry.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![make.fun rank](https://make.fun/c/best-heist-game-20261122-0559/rank.svg)](https://make.fun/c/best-heist-game-20261122-0559)

A complete, original, fully offline top-down stealth heist game. You are a
thief crossing the Meridian Museum at night: sneak past patrolling guards and
their sweeping vision cones, time the security cameras, crack the vault, grab
the side loot, and reach the green exit before the alarm locks the museum down.

## How to play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and open
http://localhost:8080). No network, no build step, system fonts only.

- **WASD / arrow keys** — move (click anywhere to walk there)
- **Shift** — run: faster, but louder and much easier to spot
- **E (hold)** — grab loot / crack the vault (stand close)
- **1** — EMP pulse: disables the nearest camera for 6s (costs $150, 2 charges)
- **2** — Decoy coin: toss it at the mouse; the nearest guard goes to look (costs $50, 3 charges)
- **3** — Lockpick: the next vault crack is fast (costs $100, 2 uses)
- **P** — pause, **R** — restart the night, **M** — mute

## The heist

- **Guards** patrol readable routes with vision cones. Being seen fills
  suspicion; full suspicion means caught. Display cases, pillars and plants
  block sight; dark **shadow zones** hide you completely.
- **Cameras** sweep their cones and feed the **alarm meter** (always on the
  HUD). The meter decays while you stay hidden.
- **Alarm at 100%** triggers lockdown: a countdown starts and you must reach
  the exit before it ends, or the night is lost.
- **Lasers** (nights 2–3) blink on and off — crossing a live beam spikes the
  alarm.
- **Loot**: the vault ($5000) is the main target; side loot (vase, painting,
  gem, idol) is optional but heavy — each piece slows you down.
- **Three nights**, escalating: more guards, faster patrols, more cameras,
  tighter alarm. Clear night 3 to retire rich.

## Structure

- `game/index.html` — page, canvas, HUD (alarm meter, loot, level, tools)
- `game/src/config.js` — tuning: speeds, cones, alarm rates, loot values
- `game/src/random.js` — seeded random helpers
- `game/src/input.js` — keyboard + mouse state
- `game/src/world.js` — level layouts: rooms, walls, cover, vents, loot, exits
- `game/src/guards.js` — guard patrols, vision cones, detection
- `game/src/cameras.js` — camera sweeps, detection, EMP disable
- `game/src/alarm.js` — alarm meter, lockdown, decay
- `game/src/tools.js` — EMP, decoy, lockpick logic and costs
- `game/src/render.js` — all canvas drawing
- `game/src/audio.js` — WebAudio oscillator cues, no audio files
- `game/src/main.js` — game loop, states, level progression, restart
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=start|play|end&seed=N`)
- `main.ts` — hand-in program: copies `game/` + `screenshots/` to the output
  dir and writes `dossier.json` via `vendor/makefun-game.ts`
- `serve.ts` — tiny static dev server for `game/` on localhost:8080

## Screenshots

`shots.json` lists the three shots: `1-cover.jpg` (thief mid-room with a
guard cone, a camera, the vault and the alarm meter in one frame),
`2-play.jpg` (near-miss, alarm rising) and `3-end.jpg` (the getaway or the
catch). Each is a real render of the game's own code, staged by `shots.js`.

## License

MIT — see `LICENSE` (`SPDX-License-Identifier: MIT`).
