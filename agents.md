# Website Audit Tool - Electron, Node.js, and TypeScript

A professional desktop application and CLI that crawls public business websites, runs evidence-based quality checks, manages clients and prospects, and produces structured results and client-ready reports.

## Project Context

- `context/PRD.md`
- `context/PRD-2.md`
- `context/desktop_app_stack.md`
- `context/feature_list_in_order.md`
- `context/current_feature.md`
- `context/conding_standards.md`
- `context/prospect_retention_policy.md`
- `context/dataforseo_provider_policy.md`
- `context/ai-interaction.md`

Read the context files before implementing a feature. Keep the active feature documented in `context/current_feature.md`.

## Development Commands

| Command             | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `pnpm build`        | Compile production TypeScript                 |
| `pnpm typecheck`    | Run strict TypeScript checks without emitting |
| `pnpm lint`         | Run ESLint with zero warnings allowed         |
| `pnpm format:check` | Verify formatting                             |
| `pnpm test`         | Run the test suite once                       |

## Non-Negotiable Safety

- Never submit forms unless the user explicitly enables it.
- Never perform invasive security testing.
- Keep crawling within the validated target scope.
- Block private and sensitive network targets by default.
- Bound concurrency, retries, redirects, and timeouts.
- Redact secrets, cookies, authorization data, and personal information.
- Always close browser and Chrome processes after success, failure, or cancellation.

## Workflow

- Use one feature or fix branch per change.
- Keep changes inside the documented feature scope.
- Use the project-local Impeccable skill for every UI design, generation, audit, or polish task.
- Run all quality checks before requesting a commit.
- Never commit, merge, or delete a branch without explicit user permission.
