# agentspace — Design Spec

_Date: 2026-06-05_
_Status: Approved (design phase, v2 post-review) — pending implementation plan_
_Revision: v2 — incorporates findings from a four-angle adversarial review
(architecture, generalization-correctness, product/adoption, consistency)._

## Summary

`agentspace` is a scaffolding CLI that generates an **agent-native multi-repo
workspace**: a coordination layer that sits above N sibling repositories and
keeps them coherent for AI coding agents (Claude Code first). It is the
generalization of the hand-built `cork-crm/` meta-workspace — turning a proven
methodology into a reusable open-source tool.

The product is **the integrated discipline**, but v1 ships it as a
**pillar-selectable, topology-aware** scaffold so a user only ever receives
the parts their workspace actually warrants. Four pillars:

1. **Workspace reconstruction** — declarative `manifest.yaml` + a robust
   `clone-repos.sh`. _(Always emitted.)_
2. **The LLM Wiki** (`memory-bank/`) — a Karpathy-pattern curated knowledge
   base with `/ingest`, `/query`, `/lint`, numbered priority folders,
   citation discipline, staleness/size budgets. _(Default on.)_
3. **Cross-app contract layer** (`openspec/`) — prescriptive specs + a
   propose/apply/archive lifecycle that fights contract drift. Wraps the
   external OpenSpec tool. _(Opt-in; auto-suppressed when the workspace has no
   cross-repo contracts.)_
4. **Agent + enforcement layer** — stack-specialist agents with hard repo
   boundaries, a Stop hook that nudges memory-bank updates, a read-only
   cross-app reviewer. _(Opt-in; the cross-app reviewer + blocking hook only
   apply to multi-repo, contract-linked workspaces.)_

`npx agentspace init` runs an interactive wizard and emits the selected
pillars, parameterized to the user's repo list **and workspace shape**.

### What changed in v2 (and why)

The review found the v1 design over-claimed in three places. v2 corrects them:

- **Topology is now a first-class input** (was: only the repo *list* was
  parameterized). Without it the tool emitted a cork-crm-shaped contract layer,
  cross-app reviewer, and blocking hook for workspaces where none of that
  applies (1 repo, peer microservices, unrelated repos). _Minimal_ modelling: a
  workspace-shape question gates whole pillars on/off; we do **not** build a
  full edge-typed contract graph in v1.
- **"Parity = correctness" is redefined** (was: byte-for-byte reproduce the
  whole cork-crm tree). That is impossible — large parts of `.claude/` are
  emitted by OpenSpec's own `openspec init` (version-stamped), `settings.local.json`
  is machine-local, and the real agents are hand-written prose, not templates.
  Parity now means **agentspace-owned deterministic files match**, with an
  explicit exclusion manifest.
- **Enforcement artifacts are static curated assets, not logic-less templates**
  (was: everything is a mustache template). The Stop hook is real JS; agent
  frontmatter encodes per-role tool contracts; command bodies embed fixed
  taxonomies. These ship as static files with a thin parameter-injection pass.

## Goals (measurable)

- **G1.** Reproduce the cork-crm workspace's value for a *configurable repo
  shape*, not just a fixed 3-app product. _Verify: shape-specific fixtures
  (below) each generate a sensible, internally-consistent workspace._
- **G2.** Portable core artifacts (manifest, wiki, contracts) usable with any
  agent tool or none; **Claude Code** gets the live enforcement pack now.
  _Verify: the portable pillars contain no Claude-Code-specific files._
- **G3.** Lower day-1 friction: a default `init` (manifest + wiki) requires no
  second install and emits nothing that blocks the user's first session.
  _Verify: default-pillar output contains no OpenSpec dependency and no
  block-mode hook._
- **G4.** Make per-stack agent guidance an additive contribution surface (drop a
  markdown file + one registry line, no code change). _Verify: adding a stack
  is one `.md` + one `stacks.yaml` row; CI lints frontmatter + required
  sections + a `_Last verified:_` footer._
- **G5.** Agentspace-owned files are deterministically reproducible. _Verify:
  the parity test (owned-files-only) passes for every shape fixture._

## Non-Goals (v1)

- **No `add-repo` command.** The review showed it is the deferred `update`
  command in disguise (in-place patching of hand-edited files). The manual
  "add a sub-repo" flow is documented instead. Revisit once the
  tool-owned/user-owned file split is designed.
- **No `update`/migration command.** Regenerating an existing workspace safely
  is hard; defer.
- **No full edge-typed contract graph.** v1 models workspace *shape* (a small
  enum) that gates pillars; per-edge contract typing is a v2 concern.
- **No monorepo-sub-package isolation.** A repo that is itself a monorepo gets
  one stack + one boundary + the `_generic` agent; documented limitation.
- **No GitHub/remote API integration.** The user supplies remote URLs (or marks
  a repo local-only); cloning is `clone-repos.sh`'s job.
- **No second tool adapter** (Cursor/Windsurf) and **no published-package
  monorepo** (Approach B). Single package, clean internal seams.
- **No TUI dashboard.**

## Key Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Form factor | Scaffolding CLI (`npx`), portable output |
| 2 | Tool coupling | Claude-Code-first, portable core; adapter-ready |
| 3 | v1 scope | **Pillar-selectable** (was: all four mandatory). Manifest always; wiki default-on; contracts + enforcement opt-in |
| 4 | Init flow | Interactive wizard; **may pre-fill a detected stack as the default choice** when a repo is already on disk (user confirms/overrides) — no silent auto-detection |
| 5 | Agents | Curated per-stack *body* + project-specifics TODO stub; generic fallback |
| 6 | Contract layer | Wrap OpenSpec, invoked as a pinned subprocess; **opt-in pillar** |
| 7 | Project architecture | Approach A — monolithic CLI, clean internal modules |
| 8 | Runtime / dist | Node + TypeScript, npm, run via `npx` |
| 9 | Name | `agentspace` |
| 10 | Topology | **Minimal:** a workspace-shape enum gates pillars; no full contract graph in v1 |
| 11 | Enforcement ramp | Stop hook **warn-until-warm** (warns until memory-bank is warm, then enforces); mode is config-overridable |
| 12 | Enforcement artifacts | **Static curated assets + thin injection**, not logic-less templates |
| 13 | Parity definition | **Owned deterministic files only**, with an explicit exclusion manifest |

## Workspace Shape & Pillar Activation (the core generalization fix)

The wizard asks one **workspace-shape** question early. The answer is stored on
the context and **gates which pillars and artifacts are emitted**. This is the
variable v1 was missing — every pillar is now a function of *shape*, not just
of the repo list.

| Shape | Cross-app contracts? | Dependency order? | Emits contract pillar / cross-app reviewer / blocking hook? |
|---|---|---|---|
| **Single repo** | n/a | n/a | No. (Wizard suggests a plain `CLAUDE.md` may suffice, but proceeds if asked.) |
| **Multi-repo, one product** (cork-crm shape) | Yes | Yes (producer→consumers) | Yes, if the user opts into those pillars |
| **Multi-repo, peer services** | Maybe | No global order | Contract pillar only if user declares contracts; **no forced linear order**; hook gates on shared edges, not raw count |
| **Multi-repo, library + consumers** | Yes (the lib's API) | Partial | Contract pillar optional; reviewer scoped to lib↔consumer |
| **Multi-repo, unrelated** | No | No | No contract pillar; wiki scope rule drops "product-level only"; hook does not block |

Concrete consequences (each was a review finding):

- **Dependency order is optional.** "Peer / no order" is a first-class answer.
  The generated `openspec/project.md` only contains the "dependency order is
  mandatory" clause when an order was actually declared.
- **The Stop hook gates on shared edges, not a hardcoded count of 2.** For
  shapes with no declared contracts, the hook does not block at all (warn-only
  or omitted). The threshold is derived, not the literal `> 1`.
- **The seeded `crossAppContracts.md` is only created for shapes with ≥2
  contract-linked repos**, and even then it is an *explicitly empty* template
  with a "no contracts recorded yet — populate after first cross-repo change"
  banner and **no fabricated entries and no premature `_Last verified:_` line**
  (the wizard has no code to cite, so it must not pretend to).
- **The memory-bank scope rule is conditional.** "Cross-app / product-level
  only" is emitted only for the one-product shape; multi-product and unrelated
  shapes get a README without that restriction.

## Architecture (Approach A)

Single npm package, focused internal modules:

```
agentspace/
├── src/
│   ├── cli.ts                 # arg parsing, command dispatch
│   ├── commands/
│   │   ├── init.ts            # wizard + selected-pillar generation
│   │   └── doctor.ts          # mechanical health checks on a workspace
│   ├── wizard/                # prompts: shape, per-repo, pillar selection
│   ├── context/
│   │   ├── build.ts           # builds the context once from wizard answers
│   │   └── slices.ts          # typed per-generator slices (no god-object)
│   ├── renderer/              # mustache wrapper for RENDERED output only
│   ├── assets/                # static curated files (hook .js, command bodies, agent bodies)
│   ├── generators/
│   │   ├── manifest.ts        # manifest.yaml, clone-repos.sh, .gitignore, root CLAUDE.md + README
│   │   ├── memory-bank.ts     # wiki skeleton + conventions README + conditional stubs
│   │   ├── contracts.ts       # opt-in: shells out to `openspec init`, writes project.md
│   │   └── enforcement.ts     # produces tool-neutral intents (AgentDefinition[], EnforcementRule[], Command[])
│   ├── adapters/
│   │   ├── adapter.ts         # interface: consumes intents → emits tool-specific files
│   │   └── claude-code.ts     # the one adapter: intents → .claude/ pack + settings.json
│   ├── openspec/              # subprocess wrapper (version check, invoke, parity-exclude)
│   └── stack-agents/          # data: per-stack agent bodies + stacks.yaml registry
├── assets/                    # mirror of static curated files (source of truth)
├── templates/                 # mustache templates for the PLAIN-TEXT artifacts only
└── test/                      # multi-shape fixtures + owned-files parity
```

**Revised invariants (the v1 versions were contradicted by the review):**

- **"Renderer writes only *rendered template output*."** Two other writers are
  explicitly carved out and named: (a) **temp-tree promotion** (the atomic
  `rename` into place), and (b) the **OpenSpec subprocess** (`openspec init`
  writes its own `.claude/` + `openspec/` files into the temp tree). The
  renderer is not the only thing that touches the FS; it is the only thing that
  renders templates.
- **No god-context.** `context/build.ts` builds one object; each generator
  consumes a typed *slice* (`ManifestContext`, `WikiContext`,
  `ContractContext`, `EnforcementContext`) so a wizard-field change doesn't
  ripple to all four.
- **The adapter consumes tool-neutral intents.** `enforcement.ts` produces
  `AgentDefinition[]` (name, repoDir, boundary, role, stack, toolList),
  `EnforcementRule[]` (e.g. "nudge memory-bank update when ≥2 contract-linked
  repos touched"), and `Command[]`. `claude-code.ts` turns those into
  `.claude/agents/*.md`, `.claude/hooks/*`, `.claude/commands/*`, and
  `settings.json`. A future Cursor adapter consumes the *same* intents. If we
  can't name what a second adapter consumes, the seam isn't real — so the
  intent types are the seam.

## CLI Command Surface

| Command | Purpose |
|---|---|
| `init` | The wizard. Collects: workspace name → **workspace shape** → per-repo (name, remote URL or local-only, stack, role) → optional dependency order (only for ordered shapes) → **pillar selection**. Generates the selected pillars into the current dir. Refuses to write into a **non-empty** dir unless `--force` (not merely "manifest present"). Supports `--dry-run`. |
| `doctor` | **Mechanical** health checks on a workspace: validate `manifest.yaml`, verify `.claude/` pack intact, check every `stacks.yaml` id has a backing `.md`, report memory-bank size-budget overflows (`wc -l` vs caps) and `_Last verified:_` age, detect orphan pages, and **verify `file:line` citation paths exist**. Flags a missing OpenSpec install **only when the contract pillar is present**. Exposes `--lint` for the slash command to call (single source of truth — see below). |
| `--version` / `--help` | Standard. |

## The Generators

Run in order; `manifest` feeds the rest. Each consumes a typed context slice
and writes via the renderer (plain artifacts) or via the adapter / subprocess
(enforcement, contracts).

### 1. `manifest` (always)
Writes `manifest.yaml` (name, remote-or-local-only, stack, role per repo) and a
**robust `clone-repos.sh`** — the repo list is emitted as an **inlined bash
array**, not parsed from YAML at runtime (the cork-crm `awk` parser is brittle
and is not propagated). Local-only repos are emitted with a printed
"local-only, skipped" notice rather than silently dropped. Also `.gitignore`
(repo dirs + `**/.claude/settings.local.json`), root `CLAUDE.md` router, and
`README.md` overview — templated from the repo list. (No `agents.md`: it was an
empty cork-crm placeholder and is excluded.)

### 2. `memory-bank` (default on)
Writes the wiki **structure**: numbered folders (`00-core/` … `10-archive/`),
empty `index.md` and `log.md`, and the **conventions `README.md` generated
verbatim** (hardening rules, citation discipline, size budgets). Clarification
the review demanded: "skeleton, not content" refers to the **entity pages**
being empty — the conventions README *is* full content because it's universal
conventions, not per-workspace data. The size-budget table lives in **one
place** and `/lint`/`doctor` reference it (no duplicated budget tables).
Conditional stubs per shape: `projectOverview.md` always (shape-appropriate
framing); `crossAppContracts.md` **only for ≥2 contract-linked repos**, and
empty-with-banner as described above.

### 3. `contracts` (opt-in; auto-suppressed when shape has no contracts)
When selected: the `openspec/` `/opsx:*` commands and `openspec-*` skills are
produced by **invoking `openspec init` as a pinned subprocess** — agentspace
does **not** author or vendor them (the review proved they're upstream,
`generatedBy`-stamped output). agentspace then writes its own
`openspec/project.md` (scope rules + dependency order **only if declared**),
templated from shape. OpenSpec is a **hard dependency of this pillar** (not the
tool); if absent, `init` prints install guidance and skips the pillar rather
than failing. The subprocess's output is excluded from the parity snapshot and
pinned to a known-good version range.

### 4. `enforcement` (opt-in) → claude-code adapter
Produces tool-neutral intents; the adapter emits the `.claude/` pack:
- **Agents:** one per repo, **named `<repo>-engineer.md`** (repo-role naming,
  matching the reference — not `<stack-id>.md`). Body = the stack-generic agent
  from `stack-agents/<id>.md` (or `_generic`), plus a **`## Project specifics
  (fill me in)` TODO block** the wizard cannot populate. Frontmatter carries the
  role-appropriate `tools` list (the read-only `cross-app-reviewer` gets no
  `Write`), sourced from data, not template conditionals.
- **Cross-app reviewer:** emitted only for multi-repo contract-linked shapes.
- **Commands** `/ingest` `/query` `/lint`: static curated bodies with a thin
  folder-list injection. `/lint` calls `agentspace doctor --lint` for the
  mechanical checks and adds the LLM-only judgment checks (contradictions,
  scope violations, citation *correctness*) on top — so the mechanical rules
  have a single definition.
- **Stop hook:** shipped as a **static `.js` asset** that reads the repo list
  and shape from `manifest.yaml` at runtime (no array baked into source, so the
  snapshot is stable and there's nothing to re-patch). Runs **warn-until-warm**:
  warns until the memory-bank is "warm" (configurable threshold of pages /
  sessions), then enforces; `settings`-overridable to `warn` or `block`.
- **`settings.json`** (hook wiring) is adapter-owned; `settings.local.json` is
  never generated and is git-ignored.

## Template & Rendering Model

Two distinct mechanisms, because the review showed one size does not fit:

1. **Plain-text artifacts** (manifest, README/CLAUDE routers, wiki conventions,
   `project.md`, stubs) → **logic-less mustache** over `templates/`. Logic stays
   in generators; templates read as near-final artifacts.
2. **Enforcement artifacts** (Stop hook JS, command bodies, agent bodies) →
   **static curated files in `assets/` + a thin injection pass** (inject the
   folder list / repo boundary / tool list). These are code and structured
   documents, not fill-in-the-blank text; treating them as templates leaks logic
   into mustache and makes snapshots fragile.

`--dry-run` prints the would-write tree (rendered + static + adapter outputs;
the OpenSpec subprocess is described, not executed, under dry-run).

## Per-Stack Agent Library Format

- **`stack-agents/<stack-id>.md`** — stack-generic guidance only (e.g. "Rails
  apps: check for N+1, use strong params"). **No project-specific facts** (the
  reference agents' value — `acts_as_tenant`, the auth file path — is
  project-specific and lives in the per-repo TODO block, not here, so a shared
  template never poisons another user's repo).
- **`stack-agents/_generic.md`** — fallback for unknown/unselected stacks.
- **`stack-agents/stacks.yaml`** — registry: `stack-id → { displayName,
  aliases, toolList }`. The wizard shows `displayName`s as a pick-list; the
  chosen id resolves directly to `<stack-id>.md`. "Unknown / other" → `_generic`
  with no penalty. `doctor` and CI assert every id has a backing `.md`.
- **Frontmatter** (`name`, `description`, `tools`) matches Claude Code's agent
  format. Each stack file carries a `_Last verified: <date>_` footer; CI flags
  stale ones (mirrors the wiki's own convention — the contribution rubric is
  defined in `CONTRIBUTING.md`, with 6–8 seeded quality examples).

**Generated agents are validated structurally, not by byte-parity:** valid
frontmatter, correct boundary path, correct tool list, project-specifics TODO
present. Byte-parity is *not* claimed for agent bodies (they're partly
hand-authored prose downstream).

## OpenSpec Integration

- Invoked as a **subprocess** (`openspec init`) by the contracts generator;
  output (`/opsx:*` commands, `openspec-*` skills) is **upstream-owned**.
- **Version-pinned** to a known-good range; CI snapshot-tests against it.
- **Excluded from the parity manifest** (it's not agentspace-owned).
- **Opt-in pillar**, auto-suppressed when the shape has no cross-repo contracts.
- Documented swap/vendor seam in case OpenSpec is abandoned.

## doctor vs `/lint` (single source of truth)

- **`doctor` (mechanical, TS):** size budgets, `_Last verified:_` age, orphans,
  citation *path existence*, `stacks.yaml`↔`.md` integrity, pack integrity.
- **`/lint` (LLM, slash command):** calls `agentspace doctor --lint` for the
  mechanical set, then adds judgment checks it can't do mechanically —
  contradictions, scope violations, citation *correctness* (does the cited line
  still say what we claim). No rule is defined in two places.

## Parity & Testing Strategy

- **Parity = agentspace-owned, deterministic files match byte-for-byte**, via an
  explicit **exclusion manifest** that omits: OpenSpec subprocess output
  (`generatedBy`-stamped), `settings.local.json` and any machine-local file,
  agent *bodies* (hand-authored prose downstream), and any date-bearing line
  (dates are injected via context and asserted separately or normalized).
- **Multi-shape fixtures** (not just cork-crm): `single-repo`,
  `peer-4-services-no-contracts`, `library+2-consumers`, `multi-product`, and
  the `cork-crm` one-product reference. Each asserts the *right* pillars appear
  and — critically — that cross-app artifacts are **absent** where the shape
  doesn't warrant them.
- **Unit:** wizard validation, shape→pillar gating, stack→`.md` resolution
  (known → its file; unknown → `_generic`), tool-list-by-role, hook
  warm-threshold logic, enforcement-intent → adapter-file mapping.
- **Coverage:** 80%+, concentrated on generators, context slices, and shape
  gating (the correctness-critical core).

## Error Handling

- **Wizard validation at the boundary:** unique filesystem-safe repo names;
  remote URL valid **or** explicitly "local-only" (empty allowed, surfaced in
  `clone-repos.sh`); stack from registry **or** "unknown" → `_generic` (no
  penalty); shape required.
- **Clobber protection:** refuse a **non-empty target dir** unless `--force`;
  with `--force`, write per-file with collision reporting (don't blind-overwrite
  a user's existing `README.md`/`CLAUDE.md`).
- **Partial-write safety:** render + run subprocess into a temp tree, then
  atomic `rename` into place; a mid-run failure leaves nothing half-written.
- **Missing OpenSpec:** only relevant when the contract pillar is selected;
  prints install guidance and skips the pillar — never a hard `init` failure.
- **Registry/template integrity:** a `stacks.yaml` id with no `.md` → `doctor`
  failure + runtime fall back to `_generic` with a warning.

## Data Flow

```
wizard ─► context/build.ts ─► { workspaceName, shape, repos[], dependencyOrder?, pillars[] }
                                   │  (typed slices below)
        ┌──────────────┬──────────┴───────────┬─────────────────────┐
        ▼              ▼                      ▼                     ▼
   ManifestCtx     WikiCtx            ContractCtx           EnforcementCtx
   manifest.ts     memory-bank.ts     contracts.ts          enforcement.ts
        │              │                 │  └─► openspec init     │ produces intents
        │              │                 │     (subprocess)       ▼
        │              │                 │                  adapters/claude-code.ts
        └──────────────┴───────► renderer (mustache, plain text) ─┤
                       static assets/  ──────────────────────────►┤
                                                                   ▼
                                                  temp tree ─(atomic rename)─► workspace/
```

## Open Questions (for the implementation plan, not blocking)

- Prompt library (`@clack/prompts` vs `inquirer`).
- The exact "warm" threshold for the hook (page count vs session count) and how
  it's persisted.
- OpenSpec version range to pin, and the CI matrix around it.
- The `CONTRIBUTING.md` rubric specifics for stack-agent quality.
- Reserve `agentspace` on npm + GitHub before first publish.

## Provenance

This design generalizes the existing `cork-crm/` workspace (`README.md`,
`memory-bank/README.md`, `openspec/`, `.claude/`). That workspace is the
`one-product` reference fixture. The v2 revision is the result of a four-angle
adversarial review (architecture / generalization / adoption / consistency);
the findings and their resolutions are recorded inline above.
