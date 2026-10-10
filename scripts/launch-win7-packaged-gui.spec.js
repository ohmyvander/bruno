const assert = require('node:assert/strict');
const test = require('node:test');
const { waitForGuiExit } = require('./launch-win7-packaged-gui');

test('disconnects the inspector after GUI results, before awaiting normal exit', { timeout: 1000 }, async () => {
  let finish;
  const exited = new Promise((resolve) => { finish = resolve; });
  let polls = 0;
  const result = await waitForGuiExit({
    exited, isClosed: () => false, hasResult: () => polls === 2,
    poll: async () => { polls++; }, disconnect: () => finish({ status: 0 })
  });
  assert.equal(result.status, 0);
  assert.equal(polls, 2);
});

test('early child exit does not wait indefinitely for a missing GUI report', async () => {
  const result = await waitForGuiExit({
    exited: Promise.resolve({ status: 1 }), isClosed: () => true, hasResult: () => false,
    disconnect: () => {}, poll: async () => { throw new Error('must not poll'); }
  });
  assert.equal(result.status, 1);
});
