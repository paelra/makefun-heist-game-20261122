// VAULTFALL hand-in program (Node 22, standard library only). It copies the
// playable game (game/) and the maker's screenshots (screenshots/) from beside
// this file into the output directory and writes /output/dossier.json with the
// vendored make.fun library, exactly the shape the gate rebuilds and compares
// byte for byte. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Post-build verification (my own addition, console only — it never touches
// the output bytes): the program refuses to write a dossier when the game
// entry point or the screenshots are missing, counts what it handed in, and
// prints a short build summary so a bad hand-in fails loudly here instead of
// silently at the gate.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// --- Pre-flight: fail loudly instead of handing in a broken entry. ---
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('VAULTFALL hand-in refused: game/index.html is missing.');
}
const gameFiles = countFiles(gameDir);
if (gameFiles === 0) throw new Error('VAULTFALL hand-in refused: game/ is empty.');
if (!existsSync(shotsDir)) throw new Error('VAULTFALL hand-in refused: screenshots/ is missing.');
const shotNames = readdirSync(shotsDir).filter((name) => !name.startsWith('.')).sort();
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`VAULTFALL hand-in refused: expected 3-4 screenshots, found ${shotNames.length}.`);
}
for (const name of shotNames) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > 262144) throw new Error(`VAULTFALL hand-in refused: ${name} is ${size} bytes (cap 256 KiB).`);
}

// --- Hand-in: copy game + screenshots, then write the dossier. ---
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// --- Build summary (console only; the output directory is already written). ---
const dossierBytes = Buffer.byteLength(dossier, 'utf8');
const shotSizes = shotNames.map((name) => `${name}=${statSync(join(shotsDir, name)).size}B`).join(' ');
console.log(`VAULTFALL hand-in complete: ${gameFiles} game files, ${shotNames.length} screenshots (${shotSizes}), dossier.json ${dossierBytes} bytes.`);
console.log(`Output: ${out}`);

function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countFiles(join(dir, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}
