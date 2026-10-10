const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'prepare-win7.js'), 'utf8');
const root = path.resolve(__dirname, '..');
const simulate = ({ spectre, failure, missing, platform = 'win32' } = {}) => {
  const commands = [];
  const fakeRequire = (name) => {
    if (name === 'path') return path;
    if (name === 'fs') return {
      existsSync: (file) => path.basename(file) !== missing,
      readFileSync: () => '# generated\n{"variables":{"msbuild_path":"MSBuild.exe"}}'
    };
    if (name === 'module') return { createRequire: () => ({ resolve: fakeRequire.resolve }) };
    assert.equal(name, 'child_process');
    return { spawnSync: (binary, args, options) => {
      commands.push({ binary, args: Array.from(args), env: options.env });
      return { status: commands.length === failure ? 1 : 0 };
    } };
  };
  fakeRequire.resolve = (name) => path.join(root, 'node_modules', name);
  let error;
  try {
    vm.runInNewContext(source, {
      __dirname, require: fakeRequire, console: { log: () => {} },
      process: { execPath: 'node.exe', platform, arch: 'x64', env: {
        Path: 'compiler-path', PATH: 'duplicate-path', BRUNO_WIN7_SPECTRE_LIB_DIR: spectre
      } }
    });
  } catch (caught) { error = caught; }
  return { commands, error };
};

test('default preparation rebuilds for Electron 22 and removes duplicate Windows environment keys', () => {
  const { commands, error } = simulate();
  assert.equal(error, undefined);
  assert.equal(commands.length, 3);
  assert.ok(commands[1].args.includes('electron'));
  assert.ok(commands[2].args.includes('rebuild'));
  assert.ok(commands[2].args.includes('--target=22.3.27'));
  for (const { env } of commands) {
    const keys = Object.keys(env).map((key) => key.toUpperCase());
    assert.equal(new Set(keys).size, keys.length);
  }
});

test('explicit Spectre libraries are passed to MSBuild without disabling mitigation', () => {
  const { commands, error } = simulate({ spectre: '.cache/spectre/x64' });
  assert.equal(error, undefined);
  assert.ok(commands[2].args.includes('configure'));
  assert.equal(commands[3].binary, 'MSBuild.exe');
  assert.ok(commands[3].args.some((arg) => arg.startsWith('/p:VC_LibraryPath_VC_Desktop_CurrentPlatform_spectre=')));
  assert.ok(commands[3].args.every((arg) => !arg.includes('SpectreMitigation=false')));
});

test('missing libraries fail before configuring or compiling WinPTY', () => {
  const result = simulate({ spectre: '.cache/spectre/x64', missing: 'libcmt.lib' });
  assert.match(result.error.message, /Missing Spectre library/);
  assert.equal(result.commands.length, 2);
});

test('missing WinPTY artifacts are rejected even if build commands report success', () => {
  assert.match(simulate({ missing: 'winpty-agent.exe' }).error.message, /Missing WinPTY artifact/);
});

test('the modern Windows ConPTY backend is also required', () => {
  assert.match(simulate({ missing: 'conpty.node' }).error.message, /Missing WinPTY artifact/);
});

test('explicit library paths cannot inject additional MSBuild properties', () => {
  const result = simulate({ spectre: '.cache/spectre;SpectreMitigation=false' });
  assert.match(result.error.message, /property separator/);
  assert.equal(result.commands.length, 2);
});

test('native preparation stops on child failures', () => {
  const result = simulate({ failure: 2 });
  assert.match(result.error.message, /failed with exit code 1/);
  assert.equal(result.commands.length, 2);
});

test('non-Windows hosts are rejected without launching builds', () => {
  const result = simulate({ platform: 'linux' });
  assert.match(result.error.message, /modern Windows x64/);
  assert.equal(result.commands.length, 0);
});
