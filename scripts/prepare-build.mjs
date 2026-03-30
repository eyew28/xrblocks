/**
 * Runs the Rollup build when this package is installed at the repo root (devDependencies
 * present). Skips when xrblocks is installed as a dependency (e.g. demos/drone via file:../../),
 * where npm does not install devDependencies — so `rollup` is missing and `prepare` would fail.
 */
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

if (!existsSync(join(root, 'node_modules', 'rollup', 'package.json'))) {
  console.warn(
    'xrblocks: skipping prepare build (rollup not installed — expected when xrblocks is a ' +
      'dependency). From the repo root run: npm install && npm run build'
  );
  process.exit(0);
}

const res = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(res.status ?? 1);
