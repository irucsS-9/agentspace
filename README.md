# agentspace

[![CI](https://github.com/shawazeahmer/agentspace/actions/workflows/ci.yml/badge.svg)](https://github.com/shawazeahmer/agentspace/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/agentspace.svg)](https://www.npmjs.com/package/agentspace)

**Scaffold an agent-native multi-repo workspace** — a coordination layer that sits
above your sibling repositories and keeps them coherent for AI coding agents.

```bash
npx agentspace init     # interactive wizard → scaffold the workspace
npx agentspace doctor   # mechanical health checks on a workspace
```

> Status: **v0.2.** Workspace reconstruction, the memory-bank wiki, and the
> opt-in enforcement pack work today. The cross-app contract pillar is on the
> roadmap below.

---

## Why this exists

If you run a product as **several separate repositories** (a backend, a web app, a
mobile client, shared libraries) — a *polyrepo*, not a monorepo — AI coding agents
have a blind spot: an agent that changes an API in one repo can't see the consumers
it just broke in another, and every session re-derives the same cross-repo context
from scratch.

`agentspace` is **not** a monorepo tool (Nx, Turborepo, pnpm workspaces). Those
unify repos under one build. agentspace does the opposite: it leaves your repos
independent and adds a thin **coordination layer above them** — a declarative
manifest, an LLM-curated knowledge wiki, cross-repo contracts, and
boundary-enforced agents — so the *set* of repos stays coherent for an agent
without a human babysitting drift.

It is the generalization of a hand-built workspace methodology into a reusable tool.

## The four pillars

| Pillar | What it gives you | Status |
|---|---|---|
| **Workspace reconstruction** | A declarative `manifest.yaml` + an idempotent `clone-repos.sh` that rebuilds the whole workspace on any machine. | ✅ v0.1 |
| **LLM Wiki** (`memory-bank/`) | A [Karpathy-pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) knowledge base the agent curates as it works — citation discipline, staleness/size budgets, ingest/query/lint operations. | ✅ v0.1 (structure) |
| **Cross-app contracts** (`openspec/`) | A prescriptive contract layer + propose/apply/archive lifecycle that fights contract drift across repos. | 🚧 roadmap |
| **Agents + enforcement** | Boundary-enforced per-repo agents, a warm-until-warm Stop hook, a read-only cross-app reviewer. | ✅ v0.2 |

The point isn't any single pillar — it's the **integrated discipline** where they
reinforce each other.

## Topology-aware by design

`agentspace init` asks your **workspace shape** and only emits artifacts that shape
warrants. A single repo, four peer microservices, a library + consumers, and a
one-product/backend+clients workspace all get *different* output:

- A **one-product** workspace gets cross-app contract scaffolding and a
  product-scoped wiki.
- A **single repo** or set of **unrelated repos** does **not** get a cross-app
  contract layer, a cross-app reviewer, or a blocking hook — because none of that
  applies.

You never get a pile of cork-shaped scaffolding that doesn't fit your project.

## What `init` generates today (v0.2)

- `manifest.yaml` + a resilient `clone-repos.sh`
- a `.gitignore` (sub-repos are independent git repos, ignored by the workspace)
- a root `CLAUDE.md` router + `README.md`
- a shape-aware `memory-bank/` wiki: numbered priority folders, a conventions
  README, and seeded overview/contract stubs appropriate to your shape
- (enforcement pillar, opt-in) a `.claude/` pack: per-repo boundary-enforced
  agents, `/ingest` `/query` `/lint` commands, a warm-until-warm Stop hook, and
  a cross-app reviewer (contract-linked shapes).

## Quick start

```bash
npx agentspace init
# answer: workspace name → shape → repos (name, remote, stack, role) → pillars
./clone-repos.sh         # pull any sub-repos that aren't on disk yet
npx agentspace doctor    # check workspace health (size budgets, staleness, manifest)
```

## Roadmap

- **Contracts pillar** — a wrapper around [OpenSpec](https://github.com/Fission-AI/OpenSpec)
  for the cross-app contract lifecycle.
- More tool adapters (Cursor, Windsurf, …) via the same intent seam.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). The per-stack agent library is designed
so adding support for a new stack is a single markdown file — issues and PRs welcome.

## Development

```bash
npm install
npm test          # vitest
npm run typecheck
npm run build     # tsup → dist/cli.js
```

## License

[MIT](./LICENSE) © Shawaze Ahmer
