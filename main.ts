// Hyrcanian Airmail — hand-in program (Node 22, standard library only).
// Copies the static game and its screenshots beside this file into the output
// directory and writes dossier.json with the vendored make.fun library.
// Locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string): void {
  mkdirSync(join(outDir, name), { recursive: true });
  cpSync(join(root, name), join(outDir, name), { recursive: true });
}

copyTree('game');
if (existsSync(join(root, 'screenshots'))) copyTree('screenshots');

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
