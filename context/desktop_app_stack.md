# Desktop Application Stack

## Status

Approved direction for PRD-2.

## Platform Decision

Website Audit Tool will be a desktop application, initially optimized and packaged for Windows.
It must not require the user to install or operate a local web server, PostgreSQL, Redis, Node.js,
Chrome, or other development tooling separately.

The existing command-line interface remains supported and the audit engine remains independent
from desktop presentation code.

## Approved Stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Desktop runtime | Electron | Native desktop window, lifecycle, operating-system integration, and bundled Node.js runtime |
| UI renderer | React and TypeScript | Clients, prospects, website pages, audit progress, and report workflows |
| UI design | Project-local Impeccable skill | Mandatory design, implementation, accessibility, state, polish, and visual-QA workflow |
| Bundling | Electron Forge with the TypeScript and Webpack template | Development, packaging, native-module handling, and installer generation |
| Local database | SQLite | Embedded transactional storage with no external database service |
| Database access | Prisma ORM using the SQLite connector | Typed queries, schema migrations, and test database workflows |
| Runtime validation | Zod | Validation for IPC messages, settings, database boundaries, provider results, and persisted contracts |
| Background work | Electron `utilityProcess` | Isolated execution of crawling, Lighthouse, Playwright, audits, report generation, and business discovery |
| Desktop bridge | Electron preload and `contextBridge` | Narrow typed APIs between the sandboxed renderer and privileged main process |
| Logging | Pino | Structured local operational logs with redaction |
| Unit and integration testing | Vitest | Domain, persistence, IPC, lifecycle, and adapter testing |
| Component testing | React Testing Library | Accessible renderer behavior and interaction states |
| Desktop end-to-end testing | Playwright Electron automation | Packaged-like workflows, windows, IPC, audit progress, and report actions |
| Windows packaging | Electron Forge Squirrel.Windows | User-friendly Windows installer and update-compatible artifacts |
| Updates | Electron `autoUpdater` | Signed application updates when release hosting is configured |

## Process Architecture

```text
Electron Main Process
  |
  +-- Application and window lifecycle
  +-- SQLite and Prisma ownership
  +-- Settings and artifact paths
  +-- Audit job coordination
  +-- Secure IPC handlers
  |
  +-- Preload / contextBridge
  |       |
  |       v
  |   Sandboxed React Renderer
  |       +-- Overview
  |       +-- Clients and website pages
  |       +-- Page selection
  |       +-- Audits and reports
  |       +-- Prospects and campaigns
  |
  +-- Electron Utility Process
          +-- Existing crawler
          +-- Existing audit orchestrator
          +-- Playwright and Lighthouse
          +-- Existing report generators
          +-- Approved discovery-provider adapters
```

## Ownership Boundaries

### Renderer Process

- Owns presentation and local interaction state only.
- Must not access Node.js, the filesystem, SQLite, Prisma, shell commands, or environment secrets.
- Requests capabilities through narrow typed preload methods.
- Treats all displayed website, provider, client, and report content as untrusted text.

### Preload Process

- Exposes one purpose-specific method per approved capability through `contextBridge`.
- Must not expose raw `ipcRenderer`, generic channels, filesystem access, or arbitrary command
  execution.
- Uses shared TypeScript contracts while validating requests again in the main process.

### Main Process

- Owns application lifecycle, windows, menus, safe dialogs, database connections, file locations,
  report export, and worker coordination.
- Validates every IPC sender, channel, argument, state transition, identifier, and resolved path.
- Must remain responsive and must not execute full audits in the main event loop.

### Utility Process

- Runs long-lived, resource-intensive, or crash-prone audit and discovery work.
- Communicates through typed messages and persisted job state.
- Must support bounded work, progress, cancellation, timeout, failure classification, and cleanup.
- Must close every browser, page, context, Chrome process, and temporary resource after completion,
  failure, cancellation, or application shutdown.

## Local Storage

- Store the SQLite database under Electron's operating-system application-data directory.
- Store reports, screenshots, logs, and temporary files under validated application-owned
  directories unless the user explicitly exports a report elsewhere.
- Never store writable application data inside packaged application resources.
- Resolve and verify every file path before access.
- Use atomic writes where practical.
- Add database migration, backup, restore, corruption-recovery, and retention workflows before
  production release.
- Persist audit jobs so progress and recoverable state survive renderer reloads and application
  restarts where possible.

## Desktop Security Defaults

- `nodeIntegration` must remain disabled in renderer windows.
- `contextIsolation` and renderer sandboxing must remain enabled.
- Use a restrictive Content Security Policy and packaged local UI assets.
- Do not load audited websites or provider pages inside a privileged application renderer.
- Disable or restrict arbitrary navigation, new windows, permissions, downloads, and external URL
  opening.
- Validate every IPC sender and message with an allowlisted contract.
- Store provider secrets outside renderer-accessible state.
- Preserve crawler SSRF, target-scope, private-network, timeout, and resource limits.
- Do not expose raw filesystem paths to renderer-controlled operations.
- Apply Electron security fuses and code signing before production distribution.

## UI Implementation Rules

- The project-local Impeccable skill is mandatory for the whole renderer UI.
- Use a restrained desktop application shell with compact tables and predictable navigation.
- Use CSS Modules and centralized design tokens for project-owned styling.
- Use accessible headless primitives only when they remove meaningful interaction complexity.
- Do not introduce a generic component framework that dictates the product's visual identity
  without explicit review.
- Support keyboard operation, visible focus, zoom, high-DPI rendering, and resizable window states.
- Verify representative compact, standard, and wide desktop window sizes.
- Implement loading, empty, partial, error, disabled, success, permission, and destructive states
  relevant to each workflow.

## Packaging and Distribution

### Initial Target

- Windows 10 and Windows 11 on supported 64-bit hardware.
- Squirrel.Windows installer generated by Electron Forge.
- Application data retained separately from installed program files.

### Production Requirements

- Code-sign the application and installer.
- Verify packaged Playwright, Lighthouse, Chromium, Prisma, and report generation on a clean Windows
  machine.
- Verify installation, upgrade, rollback expectations, uninstallation, and retained user data.
- Configure signed automatic updates only after release hosting and recovery behavior are tested.
- Generate software inventory and dependency-security evidence for releases.

## Explicitly Excluded From the Initial Desktop Stack

- Browser-hosted web application.
- Local HTTP API between the renderer and main process.
- PostgreSQL or another separately installed database service.
- Redis or an external queue service.
- Tauri and a separately packaged Node.js sidecar.
- Node.js integration in the React renderer.
- Remote UI code loaded at runtime.
- Multi-tenant SaaS authentication, billing, and hosting infrastructure.

These choices may be reconsidered only through a documented architecture decision if the product
later requires cloud synchronization, concurrent multi-user access, or hosted operation.
