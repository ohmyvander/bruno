const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const electronPackage = JSON.parse(read('packages/bruno-electron/package.json'));
const lock = JSON.parse(read('package-lock.json'));
const configModule = { exports: {} };
vm.runInNewContext(read('packages/bruno-electron/electron-builder-config.js'), {
  module: configModule,
  process: { env: {} },
  require: (name) => {
    assert.strictEqual(name, 'dotenv');
    return { config: () => {} };
  }
});

assert.strictEqual(electronPackage.devDependencies.electron, '22.3.27');
assert.strictEqual(electronPackage.dependencies['node-pty'], '1.0.0', 'WinPTY must remain available on Windows 7');
assert(!electronPackage.dependencies['@lydell/node-pty'], 'ConPTY-only terminal package is incompatible with Windows 7');
const sqlitePackage = JSON.parse(read('packages/bruno-sqlite/package.json'));
assert.strictEqual(sqlitePackage.dependencies['better-sqlite3'], '8.7.0');
assert.strictEqual(configModule.exports.electronVersion, '22.3.27');
const lockedElectron = lock.packages['packages/bruno-electron/node_modules/electron']
  || lock.packages['node_modules/electron'];
assert(lockedElectron, 'Electron must be present in the lockfile');
assert.strictEqual(lockedElectron.version, '22.3.27');
for (const [name, version] of [['node-pty', '1.0.0'], ['better-sqlite3', '8.7.0']]) {
  const locked = lock.packages[`packages/bruno-electron/node_modules/${name}`] || lock.packages[`node_modules/${name}`];
  assert(locked, `${name} must be present in the lockfile`);
  assert.strictEqual(locked.version, version);
}
for (const target of configModule.exports.win.target) {
  assert.deepStrictEqual(Array.from(target.arch), ['x64']);
}

const channels = require('../packages/bruno-electron/src/ipc/channels');
assert(channels.isAllowedInvokeChannel('renderer:ready'));
assert(!channels.isAllowedInvokeChannel('renderer:unknown-channel'));
assert(!channels.isAllowedSendChannel('renderer:unknown-channel'));
assert(channels.isAllowedListenChannel('terminal:data:session-1'));
assert(!channels.isAllowedListenChannel('evil:channel'));

const { isAllowedExternalUrl } = require('../packages/bruno-electron/src/security/url-policy');
for (const url of ['https://example.com', 'http://localhost:3000']) {
  assert(isAllowedExternalUrl(url));
}
for (const url of ['file:///C:/Windows/notepad.exe', 'javascript:alert(1)', 'data:text/html,test', 'invalid']) {
  assert(!isAllowedExternalUrl(url));
}

console.log('Win7 baseline: Electron/SQLite/WinPTY pins, x64 target, IPC and external URL boundaries passed.');
console.log('This source check does not replace packaged-app testing on Windows 7 SP1 x64.');
