# agentspace

Scaffold an agent-native multi-repo workspace — a coordination layer that keeps
sibling repositories coherent for AI coding agents.

```bash
npx agentspace init     # interactive wizard → manifest + memory-bank wiki
npx agentspace doctor   # mechanical health checks on a workspace
```

## What it generates (v1)

- **`manifest.yaml` + `clone-repos.sh`** — declarative repo list + idempotent reconstruction.
- **`memory-bank/`** — an LLM-curated wiki (Karpathy pattern), shape-aware: a
  one-product workspace gets cross-app scaffolding; unrelated repos don't.

Output is **topology-aware**: the wizard asks your workspace shape and only emits
artifacts that shape warrants.

## Roadmap

- Enforcement pillar (boundary-enforced agents, warm-until-warm Stop hook, `/ingest /query /lint`).
- Contracts pillar (OpenSpec wrapper).

## Development

```bash
npm install
npm test          # vitest
npm run typecheck
npm run build     # tsup → dist/cli.js
```
