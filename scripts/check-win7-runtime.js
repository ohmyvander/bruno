const assert = require('assert');
const path = require('path');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(root, 'packages/bruno-electron/package.json'));

if (!process.versions.electron) {
  const result = spawnSync(appRequire('electron'), [__filename], {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  process.exit(result.status === null ? 1 : result.status);
}

const run = async () => {
  assert.strictEqual(process.versions.electron, '22.3.27');
  appRequire('./src/compat/node').installNodeCompat();
  assert.strictEqual(await new Response('compatible').text(), 'compatible');
  assert.deepStrictEqual(structuredClone({ bytes: [1, 2] }), { bytes: [1, 2] });
  assert.strictEqual(appRequire('@apidevtools/json-schema-ref-parser').$RefParser instanceof Function, true);
  assert.strictEqual(typeof appRequire('@aws-sdk/credential-providers').fromIni, 'function');

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
  console.log(`Electron ${process.versions.electron} / Node ${process.versions.node}: Web APIs, AWS/parser loading and AI generation/streaming passed.`);
  console.log('Windows 7 OS and packaged GUI acceptance are still required.');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
