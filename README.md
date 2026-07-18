# Website Audit Tool

A Node.js and TypeScript CLI that audits public business websites and turns technical evidence into prioritized, client-ready findings.

## Requirements

- Node.js 22 or newer
- pnpm 11

## Development

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The audit CLI, crawler, scanners, scoring engine, and report generators are implemented in later features. See `context/feature_list_in_order.md` for the ordered roadmap.

## Safety

The tool must not submit forms, perform invasive security testing, leave the configured target scope, or retain sensitive data by default. See `context/conding_standards.md` for the complete engineering requirements.
