const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script with npm run build:win7');
const buildEnv = { ...process.env, ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE || path.join(root, '.cache/electron-builder') };
const run = (args) => {
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: root, env: buildEnv, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed with exit code ${result.status}`);
};
run(['run', 'test:win7:baseline']);
run(['run', 'test:win7:build']);
run(['run', 'setup:win7']);
for (const script of ['build:schema-types', 'build:graphql-docs', 'build:bruno-query', 'build:bruno-common',
  'build:bruno-converters', 'build:bruno-requests', 'build:bruno-filestore', 'build:bruno-sqlite']) run(['run', script]);
run(['run', 'sandbox:bundle-libraries', '--workspace=packages/bruno-js']);
run(['run', 'test:win7:ipc']);
run(['run', 'test:win7:runtime']);
run(['run', 'test:win7:sqlite']);
run(['run', 'test:win7:native']);
run(['run', 'build:web']);

const web = path.join(root, 'packages/bruno-electron/web');
if (path.dirname(web) !== path.join(root, 'packages/bruno-electron')) throw new Error('Unexpected web output path');
fs.rmSync(web, { recursive: true, force: true });
fs.cpSync(path.join(root, 'packages/bruno-app/dist'), web, { recursive: true });
const rewrite = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) rewrite(file);
    else if (entry.name.endsWith('.html')) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\/static/g, './static'));
    else if (entry.name.endsWith('.css')) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\/static\/font/g, '../../static/font'));
  }
};
rewrite(web);
run(['run', 'test:win7:gui']);
run(['run', 'test:win7:app']);
run(['run', 'dist:win', '--workspace=packages/bruno-electron', '--', '--x64', '--config.npmRebuild=false',
  ...(process.argv.includes('--dir') ? ['--dir'] : [])]);
run(['run', 'test:win7:package', '--', 'packages/bruno-electron/out/win-unpacked', '--gui']);
