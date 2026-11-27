// main.ts — Sayap Nusantara entrypoint for make.fun program/v1.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Standard library only; no network, no install.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The bounty's gate caps, as RULES.txt states them: the dossier text is
// capped at 160 KiB, at most 4 screenshots of 256 KiB each, game/ at most
// 993 entries and 48 MiB, paths at most 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyClean(name: string): void {
  const src = join(repoRoot, name);
  const dst = join(outDir, name);
  if (!existsSync(src)) {
    throw new Error(`missing ${name}/ in repository at ${src}`);
  }
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyClean('game');
copyClean('screenshots');

const dossier = buildDossier(outDir, DOSSIER_CAPS);
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossier);

// Sanity check before reporting success: the dossier must be non-empty
// and the copied game must still open at game/index.html.
if (dossier.length === 0 || !existsSync(join(outDir, 'game', 'index.html'))) {
  throw new Error('output incomplete: dossier empty or game/index.html missing');
}
console.log(`wrote ${dossierPath} (${dossier.length} bytes)`);
