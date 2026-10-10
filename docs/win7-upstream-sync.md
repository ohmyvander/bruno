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
Prepare native dependencies and generate SQLite artifacts before testing:

```powershell
npm ci --ignore-scripts --legacy-peer-deps
npm run setup:win7
npm run build:bruno-sqlite
npm run test:win7:sqlite
```

Ignoring install scripts avoids compiling legacy addons against build-host
Node. `setup:win7` installs Electron, downloads the ABI 110 SQLite prebuild and
builds node-pty 1.0.0 (including WinPTY) against Electron 22 headers. It requires
Python, VS 2022 C++ x64 build tools, a Windows SDK and the matching MSVC Spectre
libraries. It does not disable Spectre mitigation to bypass missing libraries.

`npm run build:win7` builds shared packages, sandbox libraries and the frontend,
then creates the x64 installer. `npm run build:win7 -- --dir` creates an unpacked
distribution instead. It runs runtime, SQLite, forced-WinPTY and live GUI gates
first, fails on errors, retains previous `out` artifacts, and unpacks native
modules from asar. Passing these build-host gates does not replace Win7 acceptance.
Optional mirrors: `ELECTRON_MIRROR`, `ELECTRON_HEADERS_MIRROR`, and
`npm_config_better_sqlite3_binary_host_mirror`.

`npm run test:win7:native` explicitly exercises WinPTY on the real Electron
binary, even on newer Windows where ConPTY would normally be selected.
`npm run test:win7:gui` checks a hidden renderer and the real guest protocol.
`npm run test:win7:app` checks main-process startup, renderer mounting and the
isolated preload after preparing `packages/bruno-electron/web`. GUI tests use
temporary userData and Documents paths, not the user's application profile.

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
- Electron 22 runtime: Web APIs, AWS/parser loading, AI generation and streaming
  pass. Version pins are compatibility choices, not a security-update guarantee.
- Built requests/JS packages and every dynamic faker function load and execute
  on Electron 22. Repeated QuickJS expressions, asynchronous scripts with crypto,
  and Node VM scripts using Cheerio pass the runtime smoke test.
- Worker compatibility: CPU-count fallback replaces Node 18-only parallelism;
  file-parsing and Postman-import workers initialize their own Web Crypto globals.
  Both worker flows pass on Electron 22; worker-pool fallback tests pass (3 tests).
- SQLite: native backend retained on modern Node; Electron 22 uses better-sqlite3
  8.7.0 with ABI 110. Both backends pass 62 tests in 7 suites (2 upstream tests
  remain skipped). Built-package migrations and all 19 statements also pass.
- IPC coverage: 326 static channel/method pairs and 9 reviewed dynamic callsites
  pass the AST check (`npm run test:win7:ipc`). AI helper calls are included;
  no renderer-wide or datastore-wide wildcard is permitted. Obsolete gRPC helper
  channel names now use the registered handlers and expected payloads.
- App-preview protocol: Electron 22 stream-protocol fallback retains the guest
  partition, secure scheme, per-owner origin, live HTML updates and 404 behavior.
- Node adapters/protocol/storage IPC/worker pool/preload/URL/constants: 38 tests
  in 8 suites pass on the build host. gRPC renderer helpers: 2 tests pass (unbuilt optional canvas was
  temporarily excluded from non-canvas jsdom tests). The protocol Jest suite
  exits with 0x80000003 in Electron 22's VM environment; live GUI verification
  remains separate from these mocked protocol tests.
- Frontend: build targets Chromium 108 with usage polyfills; runtime styled CSS
  uses alpha colors rather than unsupported color-mix. All 22 themes pass style
  tests. Theme/startup/Swagger/method-selector tests pass (15 tests in 4 suites).
- QuickJS: CommonJS loader plus upstream teardown/trap/lifecycle regression
  tests pass (38 tests in 4 suites). Node 16 crypto uses webcrypto explicitly.
- Production frontend and shared packages build. Requests uses TypeScript 5.7.3
  to parse Faker's declarations; other upstream type and bundler warnings remain.
- Build orchestration: prerequisite ordering and fail-closed packaging are covered
  by `npm run test:win7:build` (9 tests).
- Terminal dependency: ConPTY-only @lydell/node-pty replaced with node-pty 1.0.0,
  which retains WinPTY. No silent terminal disablement or stream-to-pipe fallback.
- Native packaging gate: currently fails with MSB8040 because the local VS 2022
  installation lacks MSVC v143 x64 Spectre libraries. WinPTY addon validation
  cannot pass until that component is installed and `setup:win7` succeeds.
- Live GUI gate: even the minimal control document fails because this execution
  environment cannot launch the renderer (launch-failed, exitCode 49), with GPU
  child-process status -1073741515. No sandbox bypass was used to hide the failure.
- Installer/unpacked distribution and packaged startup checks: not completed;
  do not publish this branch as a verified Win7 release yet.
- Windows 7 acceptance: pending; this workspace is not a Windows 7 test host.
