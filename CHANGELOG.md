# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `agentspace init` — interactive, topology-aware wizard that scaffolds a
  multi-repo workspace.
- **Workspace reconstruction pillar:** `manifest.yaml` + resilient
  `clone-repos.sh`, `.gitignore`, root `CLAUDE.md` and `README.md`.
- **Memory-bank wiki pillar:** numbered priority folders, conventions README,
  and shape-gated seed stubs (`projectOverview.md`, conditional
  `crossAppContracts.md`).
- Workspace-shape gating (`single-repo`, `one-product`, `peer-services`,
  `library-consumers`, `unrelated`) so only the artifacts a shape warrants are
  emitted.
- `agentspace doctor` — mechanical health checks (manifest validity,
  memory-bank size budgets, last-verified staleness).
- Pillar-selectable generation (manifest always; wiki default-on).
- **Enforcement pillar (opt-in):** generates a Claude Code `.claude/` pack —
  per-repo boundary-enforced agents from a stack-agent library, `/ingest`
  `/query` `/lint` commands, a warm-until-warm Stop hook (`.cjs`), and a
  cross-app reviewer; shape-gated (hook + reviewer only for contract-linked
  workspaces). `agentspace doctor --lint` emits machine-readable findings.

### Notes
- Contracts (OpenSpec) pillar is not yet implemented; see the roadmap in the
  README.

[Unreleased]: https://github.com/shawazeahmer/agentspace/commits/main
