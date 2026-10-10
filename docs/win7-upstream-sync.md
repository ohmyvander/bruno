# Windows 7 upstream synchronization

## Scope

- Compatibility baseline: `e97c0135169ee3cf3b05c0507eab0e4a50973e45`.
- Upstream target: `001e2b914772825cc50c502a16dabf996793828b` (2026-10-10).
- Working branch: `win7-upstream-sync`; preserve upstream history, do not squash.
- Runtime: Electron 22.3.27, Windows 7 SP1 x64. Build on a modern OS and Node.
- Preserve the existing isolation, IPC allowlist, URL policy, file-path fallback,
  theme validation, startup assets and QuickJS loading guarantees.
- Do not silently remove existing working features to obtain a passing build.

## Commit milestones

1. Compatibility baseline and verification commands.
2. Upstream merge and conflict reconciliation.
3. Node/runtime dependencies and API compatibility.
4. SQLite backend adapter and behavioral tests.
5. Electron protocol and IPC compatibility, with security boundaries retained.
6. Frontend and QuickJS compatibility.
7. Packaging and regression checks.

Each milestone may contain several focused commits. An intermediate merge is
not a release candidate until all runtime adapters and acceptance tests pass.

## Validation

`npm run test:win7:baseline` checks source/configuration invariants without
installing dependencies. It is not an OS compatibility certification.

`npm run test:win7:runtime` launches the pinned Electron binary in Node mode,
including local HTTP fixtures for AI generation and streaming. Install Electron
before running it. This tests the real embedded Node, not the build host's Node.

`npm run test:win7:sqlite` runs the SQLite behavioral suite on Electron 22.
First generate SQLite artifacts and install the better-sqlite3 8.7.0 prebuild
for Electron ABI 110, win32-x64 (not a build-host Node ABI). For example:

```powershell
npm ci --ignore-scripts --legacy-peer-deps
node packages/bruno-electron/node_modules/electron/install.js
Push-Location node_modules/better-sqlite3
node ../prebuild-install/bin.js --runtime electron --target 22.3.27 --arch x64
Pop-Location
npm run build:bruno-sqlite
npm run test:win7:sqlite
```

Ignoring install scripts avoids compiling this legacy addon against modern
build-host Node. Other native dependencies must also be rebuilt for Electron
before packaging; this snippet is only the SQLite validation prerequisite.

Windows 7 acceptance must use the installed, packaged application, not just
Node or a modern browser. Verify:

- Clean installation, launch, restart, upgrade and uninstall.
- Collections/workspaces, theme, file pickers and drag-and-drop paths.
- HTTP, GraphQL, redirects, multipart, proxy/PAC and TLS/client certificates.
- OAuth2 (system browser and embedded window), AWS authentication and cookies.
- gRPC, WebSockets, SSE and cancellation.
- Node and QuickJS scripts, assertions and repeated collection runs.
- SQLite migrations, runner payloads, file index, reopen and cleanup.
- Import/export, OpenAPI references, Swagger, PDF and visual diffs.
- Terminal/native modules, Mock Server, AI streaming and application previews.
- Rejection of unknown IPC channels, unsafe external URLs and guest Node access.

## Progress

- Baseline: source/configuration check passes.
- Upstream merge: all 801 upstream commits included; conflicts reconciled while
  retaining the Electron pin, IPC restrictions, URL policy, frontend fixes and
  CommonJS QuickJS loader. Lockfile regenerated with npm.
- Node adapters: Web APIs installed before application imports. AWS credential
  provider and reference parser pinned to Node 16-compatible versions; Cheerio
  retained without its Node 18-only fetch dependency. AI SDK declares Node 18,
  but generation and streaming pass with the compatibility layer on the actual
  Electron 22 / Node 16.17.1 runtime. Other providers still need acceptance tests.
- Node adapter and existing preload/URL/constants tests: 4 suites, 8 tests pass.
- Electron 22 runtime: Web APIs, AWS/parser loading, AI generation and streaming
  pass. Version pins are compatibility choices, not a security-update guarantee.
- Built requests/JS packages and every dynamic faker function load and execute
  on Electron 22. Repeated QuickJS expressions, asynchronous scripts with crypto,
  and Node VM scripts using Cheerio pass the runtime smoke test.
- SQLite: native backend retained on modern Node; Electron 22 uses better-sqlite3
  8.7.0 with ABI 110. Both backends pass 62 tests in 7 suites (2 upstream tests
  remain skipped). Built-package migrations and all 19 statements also pass.
- IPC coverage: 326 static channel/method pairs and 9 reviewed dynamic callsites
  pass the AST check (`npm run test:win7:ipc`). AI helper calls are included;
  no renderer-wide or datastore-wide wildcard is permitted. Obsolete gRPC helper
  channel names now use the registered handlers and expected payloads.
- App-preview protocol: Electron 22 stream-protocol fallback retains the guest
  partition, secure scheme, per-owner origin, live HTML updates and 404 behavior.
- Protocol/storage IPC/preload/URL/constants: 33 tests in 6 suites pass on the
  build host. gRPC renderer helpers: 2 tests pass (unbuilt optional canvas was
  temporarily excluded from non-canvas jsdom tests). The protocol Jest suite
  crashes in Electron 22's VM environment; a real GUI protocol test is pending.
- Frontend: build targets Chromium 108 with usage polyfills; runtime styled CSS
  uses alpha colors rather than unsupported color-mix. All 22 themes pass style
  tests. Theme/startup/Swagger/method-selector tests pass (15 tests in 4 suites).
- QuickJS: CommonJS loader plus upstream teardown/trap/lifecycle regression
  tests pass (38 tests in 4 suites). Node 16 crypto uses webcrypto explicitly.
- Production frontend and all shared packages build; requests currently emits
  upstream TypeScript/Faker declaration warnings, to be addressed in build tools.
- Packaged Electron 22 checks: pending.
- Windows 7 acceptance: pending; this workspace is not a Windows 7 test host.
