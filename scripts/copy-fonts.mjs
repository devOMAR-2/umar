// Copies the self-hosted woff2 font files (SIL OFL 1.1) from @fontsource
// packages into assets/fonts/. Zero dependencies. Run: npm run fonts
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'fonts');

const families = [
  {
    pkg: '@fontsource/ibm-plex-sans-arabic',
    slug: 'ibm-plex-sans-arabic',
    subsets: ['arabic', 'latin'],
    weights: [400, 500, 600, 700],
  },
  {
    pkg: '@fontsource/ibm-plex-mono',
    slug: 'ibm-plex-mono',
    subsets: ['latin'],
    weights: [400, 500],
  },
];

await mkdir(outDir, { recursive: true });

let count = 0;
let total = 0;
for (const { pkg, slug, subsets, weights } of families) {
  const srcDir = join(root, 'node_modules', ...pkg.split('/'), 'files');
  for (const subset of subsets) {
    for (const weight of weights) {
      const file = `${slug}-${subset}-${weight}-normal.woff2`;
      const src = join(srcDir, file);
      try {
        await copyFile(src, join(outDir, file));
      } catch (err) {
        console.error(`✗ ${file}: ${err.code === 'ENOENT' ? `not found (is ${pkg} installed?)` : err.message}`);
        process.exitCode = 1;
        continue;
      }
      const { size } = await stat(join(outDir, file));
      total += size;
      count += 1;
      console.log(`✓ ${file} (${(size / 1024).toFixed(1)} KB)`);
    }
  }
}

console.log(`\n${count} files copied to assets/fonts (${(total / 1024).toFixed(1)} KB total)`);
