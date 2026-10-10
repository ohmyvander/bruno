const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(root, 'packages/bruno-electron/package.json'));
const buildEnv = {
  ...process.env,
  npm_config_cache: process.env.npm_config_cache || path.join(root, '.cache/npm'),
  ELECTRON_CACHE: process.env.ELECTRON_CACHE || path.join(root, '.cache/electron')
};
const run = (script, args = [], cwd = root, env = buildEnv) => {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}`);
};

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build Win7 on a modern Windows x64 host');
run(appRequire.resolve('electron/install.js'));
const sqliteDir = path.dirname(appRequire.resolve('better-sqlite3/package.json'));
run(require.resolve('prebuild-install/bin.js'), ['--runtime', 'electron', '--target', '22.3.27', '--arch', 'x64'], sqliteDir);
const ptyDir = path.dirname(appRequire.resolve('node-pty/package.json'));
run(require.resolve('node-gyp/bin/node-gyp.js'), [
  'rebuild', '--target=22.3.27', '--arch=x64',
  `--dist-url=${process.env.ELECTRON_HEADERS_MIRROR || 'https://electronjs.org/headers'}`,
  `--devdir=${path.join(root, '.cache/electron-headers')}`
], ptyDir);
for (const file of ['pty.node', 'winpty.dll', 'winpty-agent.exe']) {
  if (!fs.existsSync(path.join(ptyDir, 'build/Release', file))) throw new Error(`Missing WinPTY artifact: ${file}`);
}
console.log('Electron 22 / ABI 110 SQLite and WinPTY prerequisites prepared.');
