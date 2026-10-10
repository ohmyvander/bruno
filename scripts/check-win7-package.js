const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const asar = require('@electron/asar');

const inspectPE = (bytes) => {
  assert.ok(bytes.length >= 64 && bytes.toString('ascii', 0, 2) === 'MZ', 'Missing DOS header');
  const pe = bytes.readUInt32LE(60);
  const optional = pe + 24;
  assert.ok(optional + 52 <= bytes.length, 'Truncated PE header');
  assert.equal(bytes.readUInt32LE(pe), 0x4550, 'Missing PE signature');
  assert.equal(bytes.readUInt16LE(pe + 4), 0x8664, 'Expected an x64 PE image');
  assert.equal(bytes.readUInt16LE(optional), 0x20b, 'Expected a PE32+ image');
  const osVersion = [bytes.readUInt16LE(optional + 40), bytes.readUInt16LE(optional + 42)];
  const subsystemVersion = [bytes.readUInt16LE(optional + 48), bytes.readUInt16LE(optional + 50)];
  for (const version of [osVersion, subsystemVersion]) {
    assert.ok(version[0] < 6 || (version[0] === 6 && version[1] <= 1), `PE requires Windows ${version.join('.')}`);
  }
  return { machine: 'x64', osVersion: osVersion.join('.'), subsystemVersion: subsystemVersion.join('.') };
};

const checkPackage = (directory, gui = false) => {
  assert.equal(process.platform, 'win32', 'Run package acceptance on Windows');
  const root = path.resolve(__dirname, '..');
  const binary = path.join(directory, 'Bruno.exe');
  const archive = path.join(directory, 'resources/app.asar');
  const reportFile = path.join(path.dirname(directory), 'win7-acceptance.json');
  const report = {
    target: 'Windows 7 SP1 x64', testedHost: `${os.platform()} ${os.release()}`,
    testedAt: new Date().toISOString(), directory,
    checks: { archive: 'pending', runtime: 'pending', winpty: 'pending', gui: 'not-run', windows7: 'pending' },
    hashes: {}, pe: {}
  };
  const hash = (name, bytes) => { report.hashes[name] = crypto.createHash('sha256').update(bytes).digest('hex'); };
  const read = (name) => asar.extractFile(archive, path.normalize(name));
  const json = (name) => JSON.parse(read(name).toString('utf8'));
  try {
    for (const file of [binary, archive, path.join(directory, 'resources/data/sample-collection.json')]) {
      assert.ok(fs.existsSync(file), `Missing release file: ${file}`);
      hash(path.relative(directory, file), fs.readFileSync(file));
    }
    report.pe['Bruno.exe'] = inspectPE(fs.readFileSync(binary));
    const metadata = json('package.json');
    assert.equal(metadata.main, 'src/index.js');
    assert.equal(metadata.dependencies['node-pty'], '1.0.0');
    assert.equal(metadata.devDependencies, undefined, 'Development dependencies must not ship');
    report.version = metadata.version;
    report.build = metadata.brunoBuild;
    assert.equal(json('node_modules/better-sqlite3/package.json').version, '8.7.0');
    assert.equal(json('node_modules/node-pty/package.json').version, '1.0.0');
    for (const file of ['web/index.html', 'src/compat/node.js', 'src/services/pool/worker.js',
      'node_modules/@usebruno/filestore/dist/cjs/workers/worker-script.js']) assert.ok(read(file).length > 0, file);
    const entries = asar.listPackage(archive).map((file) => file.replace(/\\/g, '/'));
    assert.equal(entries.some((file) => file.startsWith('/out/')), false, 'Previous distributions leaked into ASAR');
    for (const name of ['node_modules/better-sqlite3/build/Release/better_sqlite3.node',
      'node_modules/node-pty/build/Release/pty.node', 'node_modules/node-pty/build/Release/conpty.node',
      'node_modules/node-pty/build/Release/conpty_console_list.node',
      'node_modules/node-pty/build/Release/winpty.dll', 'node_modules/node-pty/build/Release/winpty-agent.exe']) {
      assert.equal(asar.statFile(archive, path.normalize(name)).unpacked, true, `Native artifact must be unpacked: ${name}`);
      const bytes = fs.readFileSync(path.join(`${archive}.unpacked`, name));
      hash(name, bytes);
      report.pe[name] = inspectPE(bytes);
    }
    const registry = 'node_modules/native-reg/prebuilds/win32-x64/node.napi.node';
    hash(registry, read(registry));
    report.pe[registry] = inspectPE(read(registry));
    report.checks.archive = 'passed';
    console.log('ASAR contents, native unpacking and x64/Win7 PE headers passed.');
    const env = { ...process.env, BRUNO_WIN7_APP_ROOT: archive, BRUNO_WIN7_ELECTRON_BINARY: binary };
    for (const [name, script, args] of [
      ['runtime', 'check-win7-runtime.js', []], ['winpty', 'check-win7-native.js', []],
      ...(gui ? [['gui', 'check-win7-gui.js', ['--app']]] : [])
    ]) {
      const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
        cwd: root, env, stdio: 'inherit', windowsHide: true, timeout: 120000
      });
      report.checks[name] = result.status === 0 && !result.error ? 'passed' : 'failed';
      if (result.error) throw result.error;
      assert.equal(result.status, 0, `Packaged ${name} gate failed`);
    }
    console.log(gui ? 'Current-host packaged acceptance passed; Windows 7 OS acceptance remains pending.'
      : 'Packaged runtime passed; rerun with --gui for GUI acceptance. Windows 7 OS acceptance remains pending.');
  } catch (error) {
    report.error = error.stack;
    throw error;
  } finally {
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Acceptance report: ${reportFile}`);
  }
  return report;
};

if (require.main === module) {
  const directory = process.argv[2];
  assert.ok(directory && !directory.startsWith('--'), 'Usage: node scripts/check-win7-package.js <win-unpacked> [--gui]');
  assert.ok(process.argv.slice(3).every((arg) => arg === '--gui'), 'Only --gui is supported after the directory');
  assert.ok(fs.statSync(directory).isDirectory(), 'Expected a win-unpacked directory');
  checkPackage(path.resolve(directory), process.argv.includes('--gui'));
}

module.exports = { inspectPE, checkPackage };
