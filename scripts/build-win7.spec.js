const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'build-win7.js'), 'utf8');
const simulate = ({ failure, args = [], npmCli = 'npm-cli.js', spawnError } = {}) => {
  const commands = [];
  const writes = [];
  const files = {
    rmSync: (file) => writes.push(['remove', file]),
    cpSync: (from, to) => writes.push(['copy', from, to]),
    readdirSync: () => [],
    readFileSync: () => '',
    writeFileSync: () => {}
  };
  const context = {
    __dirname,
    process: { execPath: process.execPath, env: { npm_execpath: npmCli }, argv: ['node', 'build-win7.js', ...args] },
    require: (name) => {
      if (name === 'fs') return files;
      if (name === 'path') return path;
      assert.equal(name, 'child_process');
      return {
        spawnSync: (_binary, command, options) => {
          assert.equal(options.cwd, path.resolve(__dirname, '..'));
          assert.equal(options.windowsHide, true);
          commands.push(Array.from(command).slice(1));
          return { status: command.includes(failure) ? 1 : 0, error: spawnError };
        }
      };
    }
  };
  let error;
  try { vm.runInNewContext(source, context); } catch (caught) { error = caught; }
  return { commands, writes, error };
};

test('installer build orders package prerequisites and every acceptance gate before packaging', () => {
  const { commands, writes, error } = simulate();
  assert.equal(error, undefined);
  const indexOf = (script) => commands.findIndex((command) => command.includes(script));
  assert.ok(indexOf('build:schema-types') < indexOf('build:bruno-converters'));
  assert.ok(indexOf('build:bruno-common') < indexOf('build:bruno-requests'));
  assert.ok(indexOf('build:bruno-sqlite') < indexOf('test:win7:runtime'));
  for (const gate of ['test:win7:baseline', 'test:win7:build', 'setup:win7', 'test:win7:ipc',
    'test:win7:runtime', 'test:win7:sqlite', 'test:win7:native', 'test:win7:gui', 'test:win7:app']) {
    assert.ok(indexOf(gate) >= 0, gate);
    assert.ok(indexOf(gate) < indexOf('dist:win'), gate);
  }
  assert.deepEqual(commands[indexOf('dist:win')].slice(-2), ['--x64', '--config.npmRebuild=false']);
  assert.ok(indexOf('test:win7:package') > indexOf('dist:win'));
  assert.deepEqual(commands.at(-1).slice(-2), ['packages/bruno-electron/out/win-unpacked', '--gui']);
  assert.equal(writes.length, 2);
  assert.equal(writes[0][1], path.resolve(__dirname, '../packages/bruno-electron/web'));
});

test('unpacked builds retain the same gates and pass --dir to electron-builder', () => {
  const result = simulate({ args: ['--dir'] });
  assert.equal(result.error, undefined);
  assert.equal(result.commands.find((command) => command.includes('dist:win')).at(-1), '--dir');
  assert.equal(result.commands.at(-1).includes('test:win7:package'), true);
});

for (const gate of ['setup:win7', 'test:win7:runtime', 'test:win7:sqlite', 'test:win7:native', 'test:win7:gui', 'test:win7:app']) {
  test(`does not package after ${gate} fails`, () => {
    const result = simulate({ failure: gate });
    assert.match(result.error.message, /failed with exit code 1/);
    assert.equal(result.commands.some((command) => command.includes('dist:win')), false);
    if (!gate.endsWith(':gui') && !gate.endsWith(':app')) assert.deepEqual(result.writes, []);
  });
}

test('launch errors and direct invocation are reported rather than hidden', () => {
  const error = new Error('spawn failed');
  assert.equal(simulate({ spawnError: error }).error, error);
  assert.match(simulate({ npmCli: '' }).error.message, /npm run build:win7/);
});

test('a failed packaged-app gate fails the build even when source gates passed', () => {
  const result = simulate({ failure: 'test:win7:package' });
  assert.match(result.error.message, /failed with exit code 1/);
  assert.equal(result.commands.at(-1).includes('test:win7:package'), true);
});
