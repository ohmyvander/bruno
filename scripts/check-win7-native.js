const assert = require('assert');
const path = require('path');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(root, 'packages/bruno-electron/package.json'));
if (!process.versions.electron) {
  const result = spawnSync(appRequire('electron'), [__filename], {
    cwd: root, env: { ...process.env, NODE_OPTIONS: '', ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit', windowsHide: true, timeout: 30000
  });
  if (result.error) throw result.error;
  process.exit(result.status === null ? 1 : result.status);
}

assert.strictEqual(process.versions.electron, '22.3.27');
assert.strictEqual(process.versions.modules, '110');
assert.strictEqual(process.platform, 'win32');
assert.strictEqual(process.arch, 'x64');
const pty = appRequire('node-pty');
let terminal;
const timeout = setTimeout(() => {
  terminal?.kill();
  console.error('WinPTY smoke test timed out');
  process.exit(1);
}, 15000);
try {
  terminal = pty.spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'echo win7-compatible'], {
    cwd: root, cols: 80, rows: 24, env: process.env, useConpty: false
  });
  let output = '';
  terminal.onData((chunk) => { output += chunk; });
  terminal.onExit(({ exitCode }) => {
    clearTimeout(timeout);
    assert.strictEqual(exitCode, 0);
    assert.ok(output.includes('win7-compatible'), output);
    terminal.kill();
    console.log('Electron 22 / ABI 110: forced WinPTY terminal execution passed.');
  });
} catch (error) {
  clearTimeout(timeout);
  console.error(error);
  process.exit(1);
}
