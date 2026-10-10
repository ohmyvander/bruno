const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitForGuiExit = async ({ exited, isClosed, hasResult, disconnect, poll = delay }) => {
  while (!isClosed() && !hasResult()) await poll(100);
  // Electron waits for attached inspector clients on normal exit.
  disconnect();
  return exited;
};
const endpoint = (port) => new Promise((resolve, reject) => {
  const request = http.get(`http://127.0.0.1:${port}/json/list`, (response) => {
    let body = '';
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => {
      try { resolve(JSON.parse(body)[0]?.webSocketDebuggerUrl); } catch (error) { reject(error); }
    });
  });
  request.on('error', reject);
  request.setTimeout(500, () => request.destroy(new Error('Inspector endpoint timed out')));
});

const run = async () => {
  const binary = process.env.BRUNO_WIN7_ELECTRON_BINARY;
  const temporary = process.env.BRUNO_WIN7_SMOKE_USER_DATA;
  assert.ok(binary && temporary, 'Use check-win7-gui.js to launch packaged GUI tests');
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));

  // Packaged Electron ignores script entry arguments. Pause before application
  // code instead, installing the same test hooks without changing the release.
  const child = spawn(binary, [`--inspect-brk=127.0.0.1:${port}`, `--user-data-dir=${temporary}`, '--disable-gpu'], {
    cwd: path.resolve(__dirname, '..'), env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  let closed = false;
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (status, signal) => { closed = true; resolve({ status, signal }); });
  });
  // Attach immediately so an early launch error cannot become an unhandled rejection.
  exited.catch(() => {});
  let socket;
  const pending = new Map();
  const timeout = setTimeout(() => child.kill(), 75000);
  try {
    let url;
    for (let attempt = 0; attempt < 100 && !closed; attempt++) {
      try { url = await endpoint(port); } catch (_) {}
      if (url) break;
      await delay(100);
    }
    assert.ok(url, 'Packaged Electron did not expose its paused inspector');
    socket = new WebSocket(url);
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    let nextId = 1;
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    let paused;
    const firstPause = new Promise((resolve) => { paused = resolve; });
    socket.on('message', (bytes) => {
      const message = JSON.parse(String(bytes));
      if (message.id) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) waiter?.reject(new Error(JSON.stringify(message.error)));
        else waiter?.resolve(message.result);
      } else if (message.method === 'Debugger.paused') {
        paused(message.params.callFrames[0].callFrameId);
      }
    });
    socket.on('close', () => {
      for (const waiter of pending.values()) waiter.reject(new Error('Packaged inspector disconnected'));
      pending.clear();
    });
    await command('Runtime.enable');
    await command('Debugger.enable');
    await command('Runtime.runIfWaitingForDebugger');
    const callFrameId = await Promise.race([
      firstPause,
      exited.then((result) => { throw new Error(`Packaged app exited before test hooks: ${JSON.stringify(result)}`); })
    ]);
    const script = path.join(__dirname, 'check-win7-gui.js');
    const injected = await command('Debugger.evaluateOnCallFrame', {
      callFrameId, expression: `process.argv.push('--app'); require(${JSON.stringify(script)}); 'hooks-installed'`, returnByValue: true
    });
    assert.equal(injected.exceptionDetails, undefined, JSON.stringify(injected.exceptionDetails));
    assert.equal(injected.result.value, 'hooks-installed');
    await command('Debugger.resume');
    const reportFile = path.join(temporary, 'gui-result.json');
    const result = await waitForGuiExit({
      exited, isClosed: () => closed, hasResult: () => fs.existsSync(reportFile), disconnect: () => socket.terminate()
    });
    assert.equal(result.status, 0, `Packaged GUI exited: ${JSON.stringify(result)}`);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    assert.equal(report.passed, true, report.error);
    console.log('Packaged application GUI acceptance passed.');
  } finally {
    clearTimeout(timeout);
    socket?.terminate();
    if (!closed) child.kill();
    await exited.catch(() => {});
  }
};

if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { waitForGuiExit };
