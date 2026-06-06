# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.3] - 2026-06-06

### Fixed
- `init` crashed with "Cannot read properties of undefined (reading 'trim')"
  when a text answer (e.g. a repo's role) was left blank — `@clack/prompts`
  returns `undefined` for an empty submission. All wizard text answers are now
  coalesced before use, so blank inputs are safe.

## [0.3.2] - 2026-06-06

### Fixed
- The CLI did nothing when run via `npx` or a global install: the entry-point
  guard compared the bin **symlink** path against the resolved module path and
  never matched, so `main()` never ran. The symlink is now resolved with
  `realpathSync` before comparison.

## [0.3.1] - 2026-06-06

### Changed
- Reframed the README as product documentation (install, requirements, usage,
  hook configuration, and the contract/stack-agent workflows); removed the
  version-history and roadmap framing.

## [0.3.0] - 2026-06-06

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
- **Contracts pillar (opt-in):** scaffolds a shape-aware `openspec/` cross-repo
  contract layer (`project.md` + empty `specs/`/`changes/`), shape-gated to
  contract-linked workspaces; `agentspace doctor` warns if the external
  `openspec` CLI is absent. agentspace scaffolds and delegates — the `/opsx:*`
  commands come from `openspec update`, not from agentspace.

[Unreleased]: https://github.com/irucsS-9/agentspace/compare/v0.3.3...HEAD
[0.3.3]: https://github.com/irucsS-9/agentspace/releases/tag/v0.3.3
[0.3.2]: https://github.com/irucsS-9/agentspace/releases/tag/v0.3.2
[0.3.1]: https://github.com/irucsS-9/agentspace/releases/tag/v0.3.1
[0.3.0]: https://github.com/irucsS-9/agentspace/releases/tag/v0.3.0
