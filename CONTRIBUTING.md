# Contributing to agentspace

Thanks for your interest! agentspace is early, and contributions — bug reports,
ideas, and PRs — are welcome.

## Development setup

```bash
git clone https://github.com/shawazeahmer/agentspace.git
cd agentspace
npm install
```

Common commands:

```bash
npm test          # run the vitest suite
npm run test:watch
npm run typecheck # tsc --noEmit
npm run build     # tsup → dist/cli.js
```

All three (`typecheck`, `test`, `build`) must pass before a PR is merged; CI runs
them on every push and pull request.

## Project conventions

- **TypeScript, ESM, Node 18+.**
- **Test-driven.** New behavior comes with a test. Generators are pure functions
  that return `GeneratedFile[]` (no filesystem side effects) so they're easy to
  unit-test; the single `writeTree` module performs all disk writes.
- **Small, focused files.** One responsibility per file.
- **Conventional Commits** for commit messages: `feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `chore:`, `perf:`.
- **Shape gating lives in one place** (`src/shape.ts`). Don't re-derive
  topology rules elsewhere.

## How `init` is structured

`wizard → assembleConfig → buildContext → generators → writeTree`. Each generator
consumes a typed slice of the context and emits files for one pillar. If you're
adding a pillar, it slots into `generateWorkspace` in `src/commands/init.ts`.

## The per-stack agent library (coming with the enforcement pillar)

The biggest planned contribution surface is the per-stack agent library. Once the
enforcement pillar lands, adding support for a new stack (Rails, Next.js, Go,
Django, Spring Boot, …) will be:

1. Add `stack-agents/<stack-id>.md` — **stack-generic** guidance only (no
   project-specific facts; those belong in a per-repo TODO block the user fills in).
2. Add one row to `stack-agents/stacks.yaml` mapping the id to a display name.
3. Include a `_Last verified: YYYY-MM-DD_` footer; CI flags stale stack agents.

No code change required — just a markdown file and a registry line.

## Reporting bugs

Open an issue with: what you ran, what you expected, what happened, and your
Node/OS versions. A minimal reproduction (the wizard answers or a `manifest.yaml`)
helps enormously.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By
participating, you agree to uphold it.
