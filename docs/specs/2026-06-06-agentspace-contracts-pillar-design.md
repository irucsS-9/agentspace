# agentspace — Contracts Pillar Design Spec (Plan 3)

_Date: 2026-06-06_
_Status: Approved (design phase) — pending implementation plan_
_Builds on: the shipped v1 core + v2 enforcement pillar._

## Summary

The **contracts pillar** is the opt-in pillar that scaffolds a cross-repo
contract layer — a generalized `openspec/` directory that fights contract drift
across repos. It is the last of the four pillars. agentspace **scaffolds the
structure** (a shape-aware `project.md` + empty `specs/`/`changes/`) as pure
generated files and **delegates** the `/opsx:*` slash commands and validation to
the user's `openspec` CLI.

### Decision reversed from the v2 spec (important)

The v2 core spec said the contracts pillar would "invoke `openspec init` as a
pinned subprocess." **This plan reverses that**: agentspace generates the
`openspec/` structure itself as pure `GeneratedFile[]` and does **not** shell out
during generation. Rationale: the subprocess approach breaks the pure-generator
/ snapshot-parity model the whole codebase is built on, makes generation
impure/async, requires the `openspec` CLI installed at `init` time (a hard gate),
and produces version-stamped output that would have to be excluded from parity.
Scaffold-and-delegate keeps the architecture clean, removes the install gate, and
keeps every emitted file under agentspace's control (parity stays exact). The
`/opsx:*` commands come from the user running `openspec update` (documented in
post-init output and the generated `project.md`); `doctor` warns if the CLI is
absent.

## Goals (measurable)

- **G1.** Selecting the contracts pillar emits a valid `openspec/` structure: a
  `project.md` plus tracked-but-empty `specs/` and `changes/`. _Verify: fixture
  asserts the file set; `project.md` is non-empty and shape-appropriate._
- **G2.** The contract layer is **shape-gated**: emitted only for contract-linked
  shapes; suppressed (with no error) on single-repo/unrelated even if selected.
  _Verify: single-repo + contracts fixture → no `openspec/`._
- **G3.** No hard dependency at `init` time. Generation never shells out and
  never fails for a missing `openspec` CLI. _Verify: generator is pure
  `GeneratedFile[]`; no child-process calls in the generation path._
- **G4.** `project.md` is generalized, not cork-crm-specific: the dependency-order
  clause appears only when an order was declared. _Verify: one-product fixture
  has the clause; peer-services fixture does not._

## Non-Goals (Plan 3)

- **No subprocess / no vendoring of `/opsx:*` commands.** Those are
  openspec-owned; the user installs them via `openspec update`.
- **No bundled `openspec` CLI.** It's an external tool the user installs; `doctor`
  only checks for its presence.
- **No second tool adapter, no `update`/`add-repo`** (still deferred).
- **No seeded specs.** `specs/` and `changes/` start empty (`.gitkeep` only); we
  never fabricate a contract spec the wizard can't know.

## Key Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | OpenSpec integration | **Scaffold + delegate** (reverses v2 "subprocess"); pure generation |
| 2 | Pillar selection | Opt-in wizard confirm, default off |
| 3 | Shape gating | Emitted only for contract-linked shapes; suppressed otherwise |
| 4 | `project.md` | Generalized from cork-crm; dependency-order clause only when declared |
| 5 | Commands | `/opsx:*` delegated to the user's `openspec` CLI (not generated) |
| 6 | `doctor` | Warn (never error) if `openspec` CLI absent, only when contracts present |
| 7 | Lint channel | `doctor --lint` emits `{"findings":[]}` for a clean workspace |
| 8 | Cross-pillar wiring | `crossAppContracts.md` banner cites openspec specs only when both wiki + contracts selected |

## Pillar Gating & Wizard

- **Wizard:** after the enforcement confirm, add one confirm — *"Include the
  cross-repo contract layer (OpenSpec)?"* Default **off**, with a one-line note
  that it uses the external `openspec` CLI for commands/validation. When yes,
  `pillars` includes `"contracts"` and `WorkspaceConfig` carries no extra config
  (the layer is structural).
- **Shape gating:** the `contracts` generator emits nothing when the workspace is
  not contract-linked (`isContractLinked` false — single-repo, unrelated, or <2
  repos), even if the pillar was selected. `init` surfaces a one-line note that
  the contract layer was skipped for the shape.

## The `contracts` Generator (pure)

`src/generators/contracts.ts` → `generateContracts(ctx: ContractsContext): GeneratedFile[]`.
Returns `[]` when `!ctx.contractLinked`. Otherwise emits:

- **`openspec/project.md`** — generalized from cork-crm's `project.md`:
  - **Scope rule:** a capability belongs in `specs/` only if it's a contract
    *between* repos; per-repo internals stay in that repo.
  - **Repo table:** rendered from the wizard's repos (name · role).
  - **What belongs in `specs/` vs `changes/`** (HTTP endpoints, shared payloads,
    auth flows, cross-repo events — phrased generically).
  - **Lifecycle:** propose → apply → **archive on deploy**.
  - **Dependency order:** the "order is mandatory (producer ships first)" clause
    is rendered **only when `ctx.dependencyOrder` is non-null**; peer-services
    gets a "peers; no global order — name affected repos per change" framing.
  - **`/opsx:*` command + `openspec` CLI reference** (documentation of the
    external tool; agentspace does not generate the commands).
  - **Relationship to the memory bank** (OpenSpec = *what the contract is*;
    memory-bank = *why*).
- **`openspec/README.md`** — short: what this dir is, and "run `openspec update`
  to install the `/opsx:*` commands."
- **`openspec/specs/.gitkeep`**, **`openspec/changes/.gitkeep`**,
  **`openspec/changes/archive/.gitkeep`** — tracked, empty.

A new `ContractsContext` slice: `{ workspaceName, shape, contractLinked, repos,
dependencyOrder }`, built in `buildContext` when the pillar is selected.

## doctor

- **OpenSpec presence check** (only when the workspace has an `openspec/` dir):
  is the `openspec` CLI resolvable on PATH? If not → a single `warn` finding with
  install guidance. Never an `error` (the layer is useful as docs without the
  CLI). Implemented via a presence check that's mockable in tests (inject the
  resolver).
- **Clean-findings fix (Plan 2 reviewer note):** in `--lint` mode, omit the
  synthetic `info` "No issues found." row so a clean workspace yields
  `{"findings":[]}`. The human (non-`--lint`) output keeps a friendly "No issues
  found." line.

## Post-init Guidance & Cross-pillar Wiring

- **Post-init console:** when contracts is selected and not shape-suppressed,
  `init` prints: *"Contracts: run `openspec update` to install the `/opsx:*`
  commands (install the `openspec` CLI first if needed)."*
- **Root `CLAUDE.md`:** for contract-linked shapes with the contracts pillar, a
  one-line pointer to `openspec/project.md` for cross-repo contract changes. (Owned
  by the manifest generator, conditional on a `hasContracts` view flag.)
- **`crossAppContracts.md` ↔ openspec citation:** when **both** the wiki and
  contracts pillars are selected, the wiki's seeded `crossAppContracts.md` banner
  gains a line: *"Cite the matching `openspec/specs/<capability>/spec.md` for each
  contract."* Implemented by passing a `hasContracts` flag into the wiki context;
  the wiki generator stays the single owner of that file.

## Data Flow (additions)

```
config (pillars includes "contracts")
   │
buildContext ──► ContractsContext (workspaceName, shape, contractLinked, repos, dependencyOrder)
   │                         │  + hasContracts flag threaded into WikiContext + ManifestContext
generateWorkspace ──► generateContracts(ctx) → GeneratedFile[]  (or [] when not contract-linked)
   └──────────────► writeTree
```

## Error Handling

- **Contracts selected on a non-contract shape** → generator returns `[]`; `init`
  prints a skip note; no error.
- **`openspec` CLI absent** → `doctor` warn only; `init` unaffected.
- **No new failure modes in the generation path** (pure, no I/O, no subprocess).

## Testing Strategy

- **`contracts.ts`:** contract-linked → correct file set incl. `project.md` +
  three `.gitkeep`s; non-contract-linked → `[]`. `project.md` contains the repo
  table and the dependency-order clause **iff** order declared; no leftover `{{`.
- **buildContext:** `ContractsContext` present only when the pillar is selected;
  `hasContracts` flag threaded to wiki/manifest contexts.
- **Cross-pillar:** wiki `crossAppContracts.md` gains the openspec-citation line
  only when both pillars selected.
- **doctor:** openspec-presence check (inject a resolver → present vs absent);
  `doctor --lint` clean workspace → `{"findings":[]}`; human output keeps the
  friendly line.
- **Multi-shape fixtures extended:** `oneProductContracts`,
  `peerServicesContracts`, `singleRepoContracts` (the last asserts `openspec/`
  **absent**). Parity asserts shape-gated emission.
- **Coverage:** 80%+, concentrated on `contracts.ts`, the shape gate, and the
  `project.md` template.

## Open Questions (for the plan, not blocking)

- Exact PATH-resolution mechanism for the `openspec` presence check (e.g. a
  `which`/`command -v` probe vs spawning `openspec --version`) — pick the most
  mockable, no-op-safe option during implementation.
- Whether `project.md` should link the workspace's `memory-bank/00-core/crossAppContracts.md`
  by relative path (yes if the wiki pillar is also on) — minor templating detail.

## Provenance

Generalizes the cork-crm `openspec/` setup — chiefly `openspec/project.md`
(scope rules, repo table, specs-vs-changes rules, lifecycle, dependency order,
memory-bank relationship). The `/opsx:*` commands and the `openspec` CLI remain
external (OpenSpec, observed at v1.3.1); agentspace scaffolds around them.
