# Windows 7 candidate: build-host acceptance

## Status (2026-10-10)

- Current-host packaged smoke acceptance: **passed** on Windows 10.0.26200 x64.
- Target: Windows 7 SP1 x64; Electron 22.3.27 / Node 16.17.1 / ABI 110.
- Windows 7 OS, installer lifecycle and full feature acceptance: **pending**.
- Validated source/tooling commit: `152e1c2c7f353ef8e60856a815ba184359c7085a`.
- Upstream target: `001e2b914772825cc50c502a16dabf996793828b`; all 801 upstream
  commits retained. The fork's existing package version remains `2.0.0`.

## Deliverables

Directory: `packages/bruno-electron/out/win7-candidate/` (ignored build output).

| Artifact | Size | SHA256 |
| --- | --- | --- |
| `bruno_2.0.0_x64_win7.exe` | 98.7 MiB | `712894ec324c561e4708032dcb1f561e393ff143c1ba8245638b716b7894ebf0` |
| `bruno_2.0.0_x64_win7_unpacked.zip` | 136.0 MiB | `789c92b5f123e247b6ef2b7b23ca197ed8934a62ca6e8dcd07be33647e72b9e5` |

`win-unpacked/Bruno.exe` is the directly tested application. The ZIP contains
that directory, not a separate portable-profile implementation. The NSIS
installer is built with `--prepackaged out/win7-candidate/win-unpacked`, so it
does not rebuild or replace the validated runtime. The installer is unsigned.

`win7-acceptance.json` contains current-host results, tested runtime payload
hashes and PE header information. `SHA256SUMS.txt` covers the transfer artifacts.
The ASAR SHA256 is
`11be0aa6f3349fd0d8d544d58139d341d42c0c33c10f87409795a6ccd01cd4b0`.

## Evidence

- User-run normal PowerShell packaged gate returned successfully with archive,
  runtime, forced WinPTY and GUI checks passed. Startup completed sample
  collection onboarding, renderer-ready IPC and isolated preload initialization.
- Actual package dependencies passed SQLite migrations/all prepared statements,
  dynamic Faker generation, repeated/async QuickJS and Node VM scripts,
  BRU/YAML filestore workers, file/Postman import workers, registry-addon loading,
  and local AI generation/streaming fixtures.
- Real preview protocol passed secure context, guest origin isolation, updates
  and 404 checks in a normal PowerShell on the same host.
- Regression suites: 28 build/tooling tests; 41 Electron compatibility/security/
  lifecycle tests; 62 SQLite tests on Electron 22 (2 upstream skips); 8 EdgeGrid
  tests. IPC AST coverage: 326 static channels and 9 reviewed dynamic callsites.
- Shared/common and production frontend rebuilds passed. Upstream type/bundler
  warnings remain; they were not hidden or converted to passing runtime checks.
- Installer and ZIP archive integrity checks passed. All 333 payload files in
  each artifact match the unpacked distribution by SHA256. Runtime and forced
  WinPTY checks also passed using the extracted installer payload. The installer stub
  is ia32/PE32 with OS/subsystem 4.0; application/native target images are x64
  with headers compatible with Win7. Headers alone do not certify OS support.

Replay packaged acceptance from a modern Windows build host:

```powershell
node scripts/check-win7-package.js packages/bruno-electron/out/win7-candidate/win-unpacked --gui
```

The restricted agent executor cannot create Chromium child sandbox tokens.
User-run normal PowerShell GUI results are therefore the authoritative live
GUI evidence. No sandbox bypass, permanent ACL changes or release source hooks
were used. Test profiles and Documents paths are temporary and isolated.

## Transfer and Windows 7 acceptance

1. Copy the installer, unpacked ZIP and `SHA256SUMS.txt` to Windows 7 SP1 x64.
   Verify hashes with `certutil -hashfile <filename> SHA256`.
2. Extract the entire ZIP and launch `win-unpacked/Bruno.exe`; do not copy only
   the executable. No separately installed modern Node is needed to launch it.
3. Check first-launch sample collection, restart, workspace reopen, themes,
   Unicode/space-containing paths, file selection and drag-and-drop.
4. Exercise HTTP/GraphQL/gRPC/WebSocket/SSE, scripts/runner, SQLite persistence,
   import/export, terminal WinPTY, preview, proxy/TLS/OAuth and any used AI/mock
   server features with controlled endpoints. Record errors and reproduction.
5. Test clean NSIS installation, installed launch, restart, upgrade and uninstall.
   Installation/upgrade/uninstall were not run against the existing build-host
   installation to avoid modifying the user's application/profile/registry state.

Do not label this candidate a verified Windows 7 release until those checks pass.
See `docs/win7-upstream-sync.md` for build prerequisites and cache workarounds.
