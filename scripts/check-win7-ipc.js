const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const policy = require('../packages/bruno-electron/src/ipc/channels');

const root = path.resolve(__dirname, '..');
const checks = {
  invoke: policy.isAllowedInvokeChannel,
  send: policy.isAllowedSendChannel,
  on: policy.isAllowedListenChannel,
  removeAllListeners: policy.isAllowedListenChannel
};
const channels = { invoke: new Set(), send: new Set(), on: new Set(), removeAllListeners: new Set() };
const dynamic = [];
const visit = (node, file) => {
  if (!node || typeof node !== 'object') return;
  const callee = node.callee;
  const helperMethod = callee?.name === 'callIpc' ? 'invoke' : callee?.name === 'onMatch' ? 'on' : undefined;
  if (['CallExpression', 'OptionalCallExpression'].includes(node.type)
      && (helperMethod || (['MemberExpression', 'OptionalMemberExpression'].includes(callee?.type)
      && !callee.computed && checks[callee.property.name]
      && (callee.object.name === 'ipcRenderer' || callee.object.property?.name === 'ipcRenderer')))) {
    const method = helperMethod || callee.property.name;
    const arg = node.arguments[0];
    const value = arg?.type === 'StringLiteral' ? arg.value
      : arg?.type === 'TemplateLiteral' && arg.expressions.length === 0 ? arg.quasis[0].value.cooked : undefined;
    if (value !== undefined) channels[method].add(value);
    else dynamic.push({ method, file: path.relative(root, file).replace(/\\/g, '/'), line: node.loc.start.line });
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => visit(item, file));
    else if (value && typeof value === 'object') visit(value, file);
  }
};
const scan = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.[jt]sx?$/.test(entry.name) && !/\.(spec|test)\./.test(entry.name)) {
      visit(parse(fs.readFileSync(file, 'utf8'), {
        sourceType: 'unambiguous', plugins: ['jsx', 'typescript', 'decorators-legacy']
      }), file);
    }
  }
};
scan(path.join(root, 'packages/bruno-app/src'));

if (process.argv.includes('--list-missing')) {
  for (const [method, values] of Object.entries(channels)) {
    console.log(method, JSON.stringify([...values].filter((value) => !checks[method](value)).sort()));
  }
  console.log('Dynamic callsites requiring review:', JSON.stringify(dynamic));
} else {
  for (const [method, values] of Object.entries(channels)) {
    for (const channel of values) assert.ok(checks[method](channel), `Blocked upstream IPC ${method}: ${channel}`);
    assert.strictEqual(checks[method]('renderer:unknown-channel'), false);
    assert.strictEqual(checks[method]('datastore:unknown:execute'), false);
  }
  // Dynamic wrappers are reviewed separately; adding a new wrapper must be explicit.
  const reviewed = new Set([
    'packages/bruno-app/src/components/Devtools/Console/TerminalTab/index.js:on',
    'packages/bruno-app/src/components/Devtools/Console/TerminalTab/index.js:removeAllListeners',
    'packages/bruno-app/src/components/OpenAPISyncTab/hooks/useEndpointActions.js:invoke',
    'packages/bruno-app/src/utils/ai/index.js:on',
    'packages/bruno-app/src/utils/common/ipc.js:invoke',
    'packages/bruno-app/src/providers/ReduxStore/slices/collections/actions.js:invoke'
  ]);
  for (const call of dynamic) assert.ok(reviewed.has(`${call.file}:${call.method}`), `Unreviewed dynamic IPC: ${JSON.stringify(call)}`);
  console.log(`IPC coverage: ${Object.values(channels).reduce((sum, set) => sum + set.size, 0)} static channels and ${dynamic.length} reviewed dynamic callsites passed.`);
}
