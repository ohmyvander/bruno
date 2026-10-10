const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(root, 'packages/bruno-electron/package.json'));

if (!process.versions.electron) {
  if (process.argv.includes('--app') && !fs.existsSync(path.join(root, 'packages/bruno-electron/web/index.html'))) {
    throw new Error('Prepare packages/bruno-electron/web with npm run build:win7 before testing application startup');
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bruno-win7-gui-'));
  const env = { ...process.env, NODE_OPTIONS: '', ELECTRON_IS_DEV: '0', BRUNO_WIN7_SMOKE_USER_DATA: directory };
  delete env.ELECTRON_RUN_AS_NODE;
  let result;
  try {
    result = spawnSync(appRequire('electron'), [__filename, ...process.argv.slice(2)], {
      cwd: root, env, stdio: 'inherit', windowsHide: true, timeout: 90000
    });
  } finally {
    if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('bruno-win7-gui-')) {
      throw new Error('Unexpected smoke-test cleanup path');
    }
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
  }
  if (result.error) throw result.error;
  process.exit(result.status === null ? 1 : result.status);
}

const { app, BrowserWindow } = require('electron');
const temporary = process.env.BRUNO_WIN7_SMOKE_USER_DATA;
if (!temporary) throw new Error('Launch this test through its Node wrapper');
app.setPath('userData', temporary);
const documentsDirectory = path.join(temporary, 'documents');
fs.mkdirSync(documentsDirectory, { recursive: true });
app.setPath('documents', documentsDirectory);
app.setAppPath(path.join(root, 'packages/bruno-electron'));
app.commandLine.appendSwitch('disable-gpu');
const watchdog = setTimeout(() => {
  console.error('Hidden-window smoke test timed out');
  app.exit(1);
}, 60000);
const finish = (error) => {
  clearTimeout(watchdog);
  if (error) console.error(error);
  app.exit(error ? 1 : 0);
};
process.on('uncaughtException', finish);
process.on('unhandledRejection', finish);

if (process.argv.includes('--app')) {
  app.on('browser-window-created', (_event, window) => {
    // The application normally shows on ready-to-show; keep smoke tests hidden.
    window.show = () => {};
    window.maximize = () => {};
    window.webContents.on('preload-error', (_event, _file, error) => finish(error));
    window.webContents.on('render-process-gone', (_event, details) => finish(new Error(JSON.stringify(details))));
    const errors = [];
    window.webContents.on('console-message', (_event, level, message) => {
      if (level === 3 && /Uncaught|TypeError|ReferenceError|SyntaxError/.test(message)) errors.push(message);
    });
    window.webContents.once('did-finish-load', async () => {
      try {
        for (let attempt = 0; attempt < 100; attempt++) {
          const mounted = await window.webContents.executeJavaScript("document.getElementById('root')?.childElementCount > 0");
          if (mounted) {
            assert.deepStrictEqual(errors, []);
            const bridge = await window.webContents.executeJavaScript("({ node: typeof require, ipc: typeof window.ipcRenderer.invoke })");
            assert.deepStrictEqual(bridge, { node: 'undefined', ipc: 'function' });
            console.log('Electron 22: real application startup, renderer mount and isolated preload passed.');
            finish();
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        throw new Error(`Renderer did not mount: ${errors.join('; ')}`);
      } catch (error) { finish(error); }
    });
  });
  require(appRequire.resolve('./src/index'));
} else {
  const AppDocuments = appRequire('./src/app/app-documents');
  AppDocuments.registerScheme();
  app.whenReady().then(async () => {
    assert.strictEqual(process.versions.electron, '22.3.27');
    const documents = new AppDocuments();
    documents.handleProtocol();
    const window = new BrowserWindow({
      show: false,
      webPreferences: { partition: AppDocuments.APP_PARTITION, nodeIntegration: false, contextIsolation: true, sandbox: true }
    });
    window.webContents.on('render-process-gone', (_event, details) => finish(new Error(`Renderer exited: ${JSON.stringify(details)}`)));
    await window.loadURL('data:text/html,<p>control</p>');
    console.log('Hidden renderer control document loaded.');
    const first = documents.register('first', '<!doctype html><p id="content">first</p>');
    const second = documents.register('second', '<!doctype html><p id="content">second</p>');
    await window.loadURL(first);
    const context = await window.webContents.executeJavaScript("({ secure: isSecureContext, subtle: typeof crypto.subtle, node: typeof require, text: document.getElementById('content').textContent })");
    assert.deepStrictEqual(context, { secure: true, subtle: 'object', node: 'undefined', text: 'first' });
    await window.webContents.executeJavaScript("localStorage.setItem('smoke', 'private')");
    await window.loadURL(second);
    assert.strictEqual(await window.webContents.executeJavaScript("localStorage.getItem('smoke')"), null);
    documents.register('first', '<!doctype html><p id="content">updated</p>');
    await window.loadURL(first);
    assert.strictEqual(await window.webContents.executeJavaScript("document.getElementById('content').textContent"), 'updated');
    documents.unregister('first');
    assert.strictEqual(await window.webContents.executeJavaScript("fetch(location.href).then(response => response.status)"), 404);
    console.log('Electron 22: real stream protocol, secure context, guest origin isolation, updates and 404 passed.');
    window.destroy();
    finish();
  }).catch(finish);
}
