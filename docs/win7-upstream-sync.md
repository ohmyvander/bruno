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

- Baseline: source/configuration check passes; no dependencies installed yet.
- Upstream merge and runtime adapters: pending.
- Packaged Electron 22 checks: pending.
- Windows 7 acceptance: pending; this workspace is not a Windows 7 test host.
