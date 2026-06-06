# agentspace

[![CI](https://github.com/irucsS-9/agentspace/actions/workflows/ci.yml/badge.svg)](https://github.com/irucsS-9/agentspace/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/@shawaze/agentspace.svg)](https://www.npmjs.com/package/@shawaze/agentspace)

**Scaffold an agent-native multi-repo workspace** — a coordination layer that sits
above your sibling repositories and keeps them coherent for AI coding agents.

```bash
npx @shawaze/agentspace init     # interactive wizard → scaffold a workspace
npx @shawaze/agentspace doctor   # mechanical health checks on a workspace
```

---

## Why agentspace

If you run a product as **several separate repositories** (a backend, a web app, a
mobile client, shared libraries) — a *polyrepo*, not a monorepo — AI coding agents
have a blind spot: an agent that changes an API in one repo can't see the consumers
it just broke in another, and every session re-derives the same cross-repo context
from scratch.

agentspace is **not** a monorepo tool (Nx, Turborepo, pnpm workspaces). Those unify
repos under one build. agentspace does the opposite: it leaves your repos
independent and adds a thin **coordination layer above them** — a declarative
manifest, an LLM-curated knowledge wiki, cross-repo contracts, and
boundary-enforced agents — so the *set* of repos stays coherent for an agent
without a human babysitting drift.

## What it gives you

| Pillar | What it does |
|---|---|
| **Workspace reconstruction** | A declarative `manifest.yaml` + an idempotent `clone-repos.sh` that rebuilds the whole workspace on any machine. |
| **LLM wiki** (`memory-bank/`) | A [Karpathy-pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) knowledge base the agent curates as it works — citation discipline, staleness/size budgets, and `/ingest` `/query` `/lint` operations. |
| **Cross-repo contracts** (`openspec/`) | A prescriptive contract layer with a propose → apply → archive lifecycle that fights contract drift across repos. |
| **Agents & enforcement** (`.claude/`) | Boundary-enforced per-repo agents, a read-only cross-app reviewer, and a Stop hook that nudges you to keep the wiki current. |

The value isn't any single pillar — it's the **integrated discipline** where they
reinforce each other. Pick the ones you want; the manifest is always included and
the wiki is on by default.

## Topology-aware

`init` asks your **workspace shape** and only emits artifacts that shape warrants.
A single repo, four peer microservices, a library + consumers, and a
backend-plus-clients product all get *different* output:

- A **one-product** workspace gets the cross-repo contract layer, a cross-app
  reviewer, and a blocking Stop hook.
- A **single repo** or set of **unrelated repos** does **not** — because none of
  that applies.

You never get a pile of scaffolding that doesn't fit your project.

## Requirements

- **Node.js 18+** (to run the CLI).
- **[Claude Code](https://claude.ai/code)** — to use the generated `.claude/`
  enforcement pack (agents, hook, slash commands). The other pillars are plain
  files usable with any agent or none.
- **[OpenSpec CLI](https://github.com/Fission-AI/OpenSpec)** *(optional)* — only
  if you enable the contracts pillar and want the `/opsx:*` slash commands and
  validation. agentspace scaffolds the `openspec/` structure either way.

## Usage

### `agentspace init`

Runs an interactive wizard, then writes the workspace into the current directory.
It asks:

1. **Workspace name**
2. **Shape** — single-repo · one product (backend + clients) · peer services ·
   library + consumers · unrelated
3. **Per repo** — directory name, git remote (or local-only), stack, and role
4. **Dependency order** — for ordered shapes (which repo defines contracts others
   consume)
5. **Pillars** — the wiki, the enforcement pack, and the contract layer are each
   opt-in (the manifest is always written)

```bash
npx @shawaze/agentspace init
./clone-repos.sh   # clone any sub-repos not yet on disk (idempotent)
```

It refuses to write into a non-empty directory unless you pass `--force`, and
`--dry-run` prints what it would write without touching disk.

**Non-interactive** (CI / reproducible scaffolding): skip the wizard and pass a
JSON config.

```bash
npx @shawaze/agentspace init --config workspace.json
```

```jsonc
// workspace.json
{
  "workspaceName": "my-product",
  "shape": "one-product",
  "repos": [
    { "name": "api", "remote": "https://github.com/me/api.git", "stack": "rails", "role": "backend" },
    { "name": "web", "remote": "https://github.com/me/web.git", "stack": "nextjs", "role": "frontend" }
  ],
  "dependencyOrder": ["api", "web"],
  "pillars": ["manifest", "wiki", "enforcement", "contracts"],
  "enforcement": { "mode": "auto", "warmPages": 5, "warmSessions": 10 }
}
```

### `agentspace doctor`

Mechanical health checks on a generated workspace — manifest validity,
memory-bank size budgets, `_Last verified:_` staleness, and (when the contracts
pillar is present) whether the `openspec` CLI is installed.

```bash
npx @shawaze/agentspace doctor          # human-readable
npx @shawaze/agentspace doctor --lint    # machine-readable JSON (used by /lint)
```

## What gets generated

A full-featured workspace looks like this:

```
my-workspace/
├── manifest.yaml            # source of truth for the repos
├── clone-repos.sh           # rebuild the workspace anywhere
├── CLAUDE.md · README.md    # routers/overview
├── .gitignore               # sub-repos are independent git repos, ignored here
├── memory-bank/             # the LLM wiki (numbered priority folders + conventions)
├── openspec/                # contracts pillar — project.md + specs/ + changes/
└── .claude/                 # enforcement pillar
    ├── agents/              # one <repo>-engineer per repo + cross-app-reviewer
    ├── commands/            # /ingest /query /lint
    ├── hooks/               # the Stop hook
    └── settings.json
```

Each generated `<repo>-engineer` agent has a **hard path boundary** (it may only
edit its own repo) and stack-tailored guidance, with a "project specifics" section
for you to fill in. The cross-app reviewer is read-only.

## Configuring the Stop hook

When the enforcement pillar is on, the Stop hook keeps your wiki current on
genuine cross-repo work. It is configured in `manifest.yaml`:

```yaml
enforcement:
  mode: auto        # auto | warn | block
  warmPages: 5      # "warm" once the wiki has more than N real pages …
  warmSessions: 10  # … OR after M sessions
```

It only acts when a session edits **two or more** contract-linked repos **without**
updating `memory-bank/`. In `auto` mode it **warns** until the workspace is "warm"
(you've invested in the wiki), then **blocks**. `warn` always warns; `block`
always blocks. It fails open — a misconfigured or missing setup never blocks you.

## The contract layer

If you enable the contracts pillar, agentspace writes a shape-aware
`openspec/project.md` (scope rules, your repo table, the contract lifecycle, and a
dependency order when one applies) plus empty `specs/` and `changes/`. The
`/opsx:*` slash commands and validation come from the external `openspec` CLI:

```bash
openspec update     # installs the /opsx:* commands into .claude/
openspec validate   # check specs/changes
```

## The stack-agent library

Generated engineer agents are built from a library of stack templates
(`stack-agents/`): Rails, Next.js, Expo, Go, Django, Spring Boot, plus a generic
fallback for anything else. Adding support for a new stack is **one markdown file +
one registry row** — see [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and PRs
welcome.

## Development

```bash
git clone https://github.com/irucsS-9/agentspace.git
cd agentspace
npm install
npm test          # vitest
npm run typecheck
npm run build     # tsup → dist/cli.js
```

## License

[MIT](./LICENSE) © Shawaze Ahmer
