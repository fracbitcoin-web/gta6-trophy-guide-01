// Leonida Trophy Guide — the hand-in program (Node 22, standard library only).
// The guide itself is plain static files under app/: index.html, its script and
// stylesheet, and data/trophies.json with the 55 trophies and their guides. This
// program copies app/ and screenshots/ from beside this file into the output
// directory and writes dossier.json there with the vendored make.fun library, so
// the judge can read the guide's screenshots and source outline. The vendor
// library stays byte for byte as the kit shipped it.
//
// Run it locally with: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader, MAKEFUN_OUTPUT_DIR is unset and /output is used instead.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps match the scorer's own limits: at most 4 screenshots, each at most
// 256 KiB; app/ at most 993 files and directories and 48 MiB in all. The text
// cap shapes the dossier's source text at 160 KiB.
const dossierPath = join(outputDir, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);
console.log('Leonida Trophy Guide handed in to ' + outputDir + ' (dossier: ' + dossierPath + ')');
