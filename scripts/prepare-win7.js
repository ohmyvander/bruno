const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(root, 'packages/bruno-electron/package.json'));
const buildEnv = {
  ...process.env,
  npm_config_cache: process.env.npm_config_cache || path.join(root, '.cache/npm'),
  ELECTRON_CACHE: process.env.ELECTRON_CACHE || path.join(root, '.cache/electron')
};
// MSBuild's .NET environment dictionary rejects duplicate Path/PATH entries.
const seen = new Set();
for (const name of Object.keys(buildEnv)) {
  const key = name.toUpperCase();
  if (seen.has(key)) delete buildEnv[name];
  else seen.add(key);
}
const runBinary = (binary, args, cwd = root) => {
  const result = spawnSync(binary, args, { cwd, env: buildEnv, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${binary} failed with exit code ${result.status}`);
};
const run = (script, args = [], cwd = root, env = buildEnv) => {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}`);
};

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build Win7 on a modern Windows x64 host');
run(appRequire.resolve('electron/install.js'));
const sqliteDir = path.dirname(appRequire.resolve('better-sqlite3/package.json'));
run(require.resolve('prebuild-install/bin.js'), ['--runtime', 'electron', '--target', '22.3.27', '--arch', 'x64'], sqliteDir);
const ptyDir = path.dirname(appRequire.resolve('node-pty/package.json'));
const gyp = require.resolve('node-gyp/bin/node-gyp.js');
const gypArgs = [
  '--target=22.3.27', '--arch=x64',
  `--dist-url=${process.env.ELECTRON_HEADERS_MIRROR || 'https://electronjs.org/headers'}`,
  `--devdir=${path.join(root, '.cache/electron-headers')}`
];
if (process.env.BRUNO_WIN7_SPECTRE_LIB_DIR) {
  const libs = path.resolve(process.env.BRUNO_WIN7_SPECTRE_LIB_DIR);
  if (libs.includes(';')) throw new Error('Spectre library path must not contain an MSBuild property separator');
  for (const file of ['libcmt.lib', 'libcpmt.lib', 'vcruntime.lib']) {
    if (!fs.existsSync(path.join(libs, file))) throw new Error(`Missing Spectre library: ${file}`);
  }
  run(gyp, ['configure', ...gypArgs], ptyDir);
  const config = JSON.parse(fs.readFileSync(path.join(ptyDir, 'build/config.gypi'), 'utf8').replace(/^#.*\r?\n/gm, ''));
  runBinary(config.variables.msbuild_path, [
    path.join(ptyDir, 'build/binding.sln'), '/p:Configuration=Release;Platform=x64',
    `/p:VC_LibraryPath_VC_Desktop_CurrentPlatform_spectre=${libs}`,
    `/p:VC_LibraryPath_VC_x64_Desktop_spectre=${libs}`,
    '/nodeReuse:false', '/m:2', '/nologo', '/clp:Verbosity=minimal'
  ], ptyDir);
} else {
  run(gyp, ['rebuild', ...gypArgs], ptyDir);
}
for (const file of ['pty.node', 'winpty.dll', 'winpty-agent.exe', 'conpty.node', 'conpty_console_list.node']) {
  if (!fs.existsSync(path.join(ptyDir, 'build/Release', file))) throw new Error(`Missing WinPTY artifact: ${file}`);
}
console.log('Electron 22 / ABI 110 SQLite and WinPTY prerequisites prepared.');
