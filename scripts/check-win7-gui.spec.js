const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'check-win7-gui.js'), 'utf8');
const simulate = ({ startupError, handlerError, missingCollection, wrapperArguments } = {}) => {
  const callbacks = {};
  const exits = [];
  let readyHandler;
  let release;
  const onboarding = new Promise((resolve) => { release = resolve; });
  const window = {
    webContents: {
      on: () => {}, once: (event, handler) => { callbacks[event] = handler; },
      executeJavaScript: async (script) => script.includes('childElementCount') ? true : { node: 'undefined', ipc: 'function' }
    }
  };
  const electron = {
    app: {
      setPath: () => {}, setAppPath: () => {}, exit: (status) => exits.push(status),
      commandLine: { appendSwitch: () => {} }, on: (event, handler) => { callbacks[event] = handler; }
    },
    ipcMain: { handle: (_channel, handler) => { readyHandler = handler; } }
  };
  const appRequire = Object.assign(() => {}, { resolve: () => 'application-entry' });
  const context = {
    __dirname, __filename: path.join(__dirname, 'check-win7-gui.js'),
    process: { versions: wrapperArguments ? {} : { electron: '22.3.27' }, argv: ['electron', 'script', ...(wrapperArguments || ['--app'])],
      env: { BRUNO_WIN7_SMOKE_USER_DATA: 'test-profile' }, on: () => {} },
    setTimeout: () => 1, clearTimeout: () => {}, console: { error: () => {}, log: () => {} },
    require: (name) => {
      if (name === 'assert') return {
        strictEqual: assert.equal,
        deepStrictEqual: (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected))),
        ok: assert.ok
      };
      if (name === 'fs') return {
        mkdirSync: () => {}, existsSync: () => !missingCollection,
        readFileSync: () => JSON.stringify({ preferences: { onboarding: { hasLaunchedBefore: true } } })
      };
      if (name === 'path') return path;
      if (name === 'os') return {};
      if (name === 'module') return { createRequire: () => appRequire };
      if (name === 'child_process') return {};
      if (name === 'electron') return electron;
      assert.equal(name, 'application-entry');
      electron.ipcMain.handle('renderer:ready', async () => {
        await onboarding;
        if (startupError) context.console.error('Failed to handle onboarding:', startupError);
        if (handlerError) throw handlerError;
      });
    }
  };
  vm.runInNewContext(source, context);
  callbacks['browser-window-created']({}, window);
  return { exits, release, ready: () => readyHandler(), loaded: () => callbacks['did-finish-load']() };
};

test('a mounted renderer cannot pass before onboarding and renderer-ready finish', async () => {
  const run = simulate();
  const loaded = run.loaded();
  const ready = run.ready();
  await Promise.resolve();
  assert.deepEqual(run.exits, []);
  run.release();
  await ready;
  await loaded;
  assert.deepEqual(run.exits, [0]);
});

test('onboarding errors are failures even when the application swallows them', async () => {
  const run = simulate({ startupError: new TypeError('crypto.subtle is missing') });
  const loaded = run.loaded();
  run.release();
  await run.ready();
  await loaded;
  assert.deepEqual(run.exits, [1]);
});

test('rejected renderer-ready IPC handlers cannot pass', async () => {
  const run = simulate({ handlerError: new Error('window destroyed') });
  const loaded = run.loaded();
  run.release();
  await assert.rejects(run.ready(), /window destroyed/);
  await loaded;
  assert.deepEqual(run.exits, [1]);
});

test('missing sample collection is a startup failure', async () => {
  const run = simulate({ missingCollection: true });
  const loaded = run.loaded();
  run.release();
  await run.ready();
  await loaded;
  assert.deepEqual(run.exits, [1]);
});

test('distribution arguments cannot silently run only the source protocol gate', () => {
  assert.throws(() => simulate({ wrapperArguments: ['win-unpacked', '--gui'] }), /use check-win7-package.js/);
});
