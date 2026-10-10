const assert = require('assert');
const path = require('path');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(root, 'packages/bruno-electron/package.json'));

if (!process.versions.electron) {
  const result = spawnSync(appRequire('electron'), [__filename], {
    cwd: root,
    env: { ...process.env, NODE_OPTIONS: '', ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit', windowsHide: true, timeout: 90000
  });
  if (result.error) throw result.error;
  process.exit(result.status === null ? 1 : result.status);
}

const run = async () => {
  assert.strictEqual(process.versions.electron, '22.3.27');
  assert.strictEqual(process.versions.modules, '110');
  appRequire('./src/compat/node').installNodeCompat();
  assert.strictEqual(await new Response('compatible').text(), 'compatible');
  assert.deepStrictEqual(structuredClone({ bytes: [1, 2] }), { bytes: [1, 2] });
  assert.strictEqual(appRequire('@apidevtools/json-schema-ref-parser').$RefParser instanceof Function, true);
  assert.strictEqual(typeof appRequire('@aws-sdk/credential-providers').fromIni, 'function');
  const { createDatabase } = appRequire('@usebruno/sqlite');
  const database = createDatabase(':memory:');
  assert.ok(database.db?._db, 'SQLite backend must open, not silently disable storage');
  try {
    assert.strictEqual(database.statements._prepared.size, database.statements._defs.size);
    assert.strictEqual(database.db._db.prepare('SELECT count(*) AS count FROM _migrations').get().count, 5);
  } finally {
    database.db.close();
  }
  assert.strictEqual(typeof appRequire('@usebruno/requests').makeAxiosInstance, 'function');
  const { mockDataFunctions } = appRequire('@usebruno/common');
  for (const [name, generate] of Object.entries(mockDataFunctions)) assert.notStrictEqual(generate(), undefined, name);
  const { ScriptRuntime, runScriptInNodeVm } = appRequire('@usebruno/js');
  assert.strictEqual(typeof ScriptRuntime, 'function');
  const Bru = appRequire('@usebruno/js/src/bru');
  const bru = new Bru({ runtime: 'quickjs', envVariables: {}, runtimeVariables: {}, processEnvVars: {}, collectionPath: root, collectionName: 'Win7 Smoke' });
  const sandbox = appRequire('@usebruno/js/src/sandbox/quickjs');
  console.log('Checking QuickJS loading and repeated execution...');
  await sandbox.loader();
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(sandbox.executeQuickJsVm({ script: 'value + 1', scriptType: 'expression', context: { value: i } }), i + 1);
  }
  await sandbox.executeQuickJsVmAsync({
    script: "require('chai').expect(1 + 2).to.equal(3); const bytes = new Uint8Array(8); if (crypto.getRandomValues(bytes) !== bytes) throw new Error('crypto shim failed');",
    context: { bru }, collectionPath: root
  });
  await runScriptInNodeVm({
    script: "const cheerio = require('cheerio'); if (cheerio.load('<p>compatible</p>')('p').text() !== 'compatible') throw new Error('Node VM failed');",
    context: { bru }, collectionPath: root, scriptingConfig: {}
  });
  const { Pool, JobType } = appRequire('./src/services/pool');
  const pool = new Pool();
  try {
    const parsed = await pool.run(JobType.ParseFile, { collectionPath: root, relativePath: 'package.json', format: 'json', type: 'config' });
    assert.strictEqual(parsed.data.name, 'usebruno');
  } finally {
    await pool.destroy({ force: true });
  }
  const converted = await appRequire('@usebruno/converters').postmanToBruno({
    info: { name: 'Win7 Smoke', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [{ name: 'sample', request: { method: 'GET', url: 'https://example.com' },
      event: [{ listen: 'test', script: { type: 'text/javascript', exec: ["pm.test('smoke', function () { pm.expect(1 + 2).to.eql(3); });"] } }] }]
  }, { useWorkers: true });
  assert.strictEqual(converted.collection.name, 'Win7 Smoke');
  assert.ok(converted.collection.items[0].request.script.res.includes('expect'));

  const http = require('http');
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const request = JSON.parse(body);
      const response = {
        id: 'win7-smoke', object: 'chat.completion', created: 0, model: 'win7-smoke',
        choices: [{ index: 0, message: { role: 'assistant', content: 'compatible' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      };
      if (!request.stream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const [delta, finishReason] of [[{ role: 'assistant', content: 'compatible' }, null], [{}, 'stop']]) {
        res.write(`data: ${JSON.stringify({
          ...response, object: 'chat.completion.chunk',
          choices: [{ index: 0, delta, finish_reason: finishReason }]
        })}\n\n`);
      }
      res.end('data: [DONE]\n\n');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { createOpenAI } = appRequire('@ai-sdk/openai');
    const { generateText, streamText } = appRequire('ai');
    const model = createOpenAI({ apiKey: 'local-fixture', baseURL: `http://127.0.0.1:${server.address().port}/v1` }).chat('win7-smoke');
    const generated = await generateText({ model, prompt: 'test', maxRetries: 0 });
    assert.strictEqual(generated.text, 'compatible');
    const streamed = streamText({ model, prompt: 'test', maxRetries: 0 });
    let text = '';
    for await (const chunk of streamed.textStream) text += chunk;
    assert.strictEqual(text, 'compatible');
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(`Electron ${process.versions.electron} / Node ${process.versions.node}: Web APIs, AWS/parser loading, SQLite, faker, scripts, file/import workers and AI generation/streaming passed.`);
  console.log('Windows 7 OS and packaged GUI acceptance are still required.');
};

const watchdog = setTimeout(() => {
  console.error('Electron runtime smoke test did not settle within 60 seconds');
  process.exit(1);
}, 60000);
run().then(() => clearTimeout(watchdog)).catch((err) => {
  console.error(err);
  process.exit(1);
});
