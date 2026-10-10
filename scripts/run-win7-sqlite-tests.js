const path = require('path');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(root, 'packages/bruno-electron/package.json'));
const result = spawnSync(appRequire('electron'), [require.resolve('jest/bin/jest'), '--runInBand'], {
  cwd: path.join(root, 'packages/bruno-sqlite'),
  env: { ...process.env, NODE_OPTIONS: '', ELECTRON_RUN_AS_NODE: '1', BRUNO_SQLITE_BACKEND: 'legacy' },
  stdio: 'inherit'
});
if (result.error) throw result.error;
process.exit(result.status === null ? 1 : result.status);
