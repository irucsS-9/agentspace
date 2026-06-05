# agentspace — Enforcement Pillar Design Spec (Plan 2)

_Date: 2026-06-06_
_Status: Approved (design phase) — pending implementation plan_
_Builds on: `2026-06-05-agentspace-design.md` (v2 core) and the shipped v1 core._

## Summary

The **enforcement pillar** is the opt-in pillar that makes a generated workspace
*enforce itself* for Claude Code, instead of being passive docs. It extends
`agentspace init` to emit a real `.claude/` pack — boundary-enforced per-repo
agents, the `/ingest` `/query` `/lint` slash commands, a warm-until-warm Stop
hook, a cross-app reviewer, and `settings.json` — all generalized from the
hand-built cork-crm workspace.

**Layering reminder (important):** agentspace is a TypeScript scaffolder. Its
*output* is native Claude Code artifacts (markdown agents, markdown slash
commands, a JS hook, `CLAUDE.md`, the `memory-bank/` wiki). The TypeScript only
runs the wizard, decides which artifacts the workspace shape warrants, and fills
in the user's repo names/paths/stacks. No Claude Code primitive is replaced by
TypeScript. Stack agents are stored as loose `.md` files specifically to stay
native and keep the "add a stack = drop a markdown file" contribution promise.

This pillar realizes the **tool-neutral intent seam** the v2 spec promised (and
the final v1 reviewer flagged as not-yet-existing): a future Cursor/Windsurf
adapter consumes the same intents.

## Goals (measurable)

- **G1.** Selecting the enforcement pillar emits a valid Claude Code `.claude/`
  pack: agents with valid frontmatter, working slash commands, a wired Stop
  hook. _Verify: generated agent/command files parse; `settings.json` references
  the hook; fixtures assert the file set._
- **G2.** Enforcement output is **shape-gated**: agents always (one per repo),
  but the cross-app reviewer and the blocking hook only for contract-linked
  shapes. _Verify: single-repo fixture → agents only, no hook/reviewer;
  one-product fixture → full pack._
- **G3.** Adding a stack is **one `.md` file + one `stacks.yaml` row**, no code
  change. _Verify: CI/`doctor` asserts every registry id has a backing file and
  a `_Last verified:` footer; the loader resolves a new file with no code edit._
- **G4.** The warm/gate decision is a **pure, unit-tested function**; the hook
  file is a thin I/O wrapper. _Verify: decision-function tests cover all modes
  and warm paths without touching the filesystem._
- **G5.** Mechanical lint rules have **one definition**: `/lint` calls
  `agentspace doctor --lint`. _Verify: no size-budget/staleness rule is
  re-implemented in the slash-command body._

## Non-Goals (Plan 2)

- **No contracts/OpenSpec pillar** — that is Plan 3. The `/opsx:*` commands are
  out of scope here.
- **No second tool adapter** (Cursor/Windsurf). The intent seam is built so one
  can be added later; we ship only `claude-code`.
- **No team/orchestration runtime.** agentspace generates the boundary-enforced
  agents that *enable* the parallel-worktree pattern; it does not run an
  orchestrator. A short workflow note is emitted into the root `CLAUDE.md`
  (contract-linked multi-repo shapes only); nothing executable.
- **No `update`/`add-repo`** (still deferred from v1).
- **No curated project-specific agent lore.** Stack files carry only
  stack-generic guidance; project specifics are a `TODO` block the user fills.

## Key Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Pillar selection | Opt-in wizard confirm, default **off**; Claude-Code-specific note |
| 2 | Config location | A new `enforcement:` block in `manifest.yaml` (single source the hook reads) |
| 3 | Warm metric | **Hybrid:** warm when `pages > warmPages` OR `sessions >= warmSessions` |
| 4 | Session state | `.agentspace/state.json` (git-ignored, local), incremented per Stop |
| 5 | Modes | `auto` (warn→block at warm), `warn` (always warn), `block` (always block) |
| 6 | Hook shape-gating | Emitted only for contract-linked shapes; omitted for single-repo/unrelated |
| 7 | Intent seam | `AgentDefinition[]` / `CommandDef[]` / `HookRule` consumed by the adapter |
| 8 | Stack seeds | `rails, nextjs, expo, go, django, spring-boot` + `_generic` |
| 9 | Stack storage | **Loose `.md` files** + `stacks.yaml` + a runtime loader |
| 10 | Agent naming | `<repo>-engineer.md`; stack-generic body + project-specifics TODO |
| 11 | Commands | `/ingest /query /lint` ported & generalized from cork-crm; static bodies + thin injection |
| 12 | Lint bridge | `/lint` calls `agentspace doctor --lint` (machine-readable) for mechanical checks |

## Wizard & Config

- **Wizard:** after the existing wiki confirm, add one confirm — *"Include the
  Claude Code enforcement pack (boundary-enforced agents, Stop hook, commands)?"*
  Default **off**, with a one-line note that it targets Claude Code. When yes,
  `pillars` includes `"enforcement"`.
- **Config block** (owned by the `manifest` generator, emitted only when
  enforcement is selected — keeps `manifest.yaml` single-owned):
  ```yaml
  enforcement:
    mode: auto        # auto | warn | block
    warmPages: 5      # warm when memory-bank has > N real (non-stub) pages
    warmSessions: 10  # OR warm after M sessions
  ```

## Intent Seam & Adapter

A new typed `EnforcementContext` slice feeds `src/generators/enforcement.ts`,
which produces **tool-neutral intents** (no Claude Code knowledge):

```ts
interface AgentDefinition {
  name: string;        // "<repo>-engineer" or "cross-app-reviewer"
  repoDir: string;     // boundary path; "" for the cross-repo reviewer
  role: string;
  stack: string;       // stack id or "generic"
  boundaryRule: string;
  toolList: string[];  // role-appropriate (reviewer has no Write)
  isReviewer: boolean;
}
interface CommandDef { name: string; body: string; }  // static body + injected folders
interface HookRule {
  enabled: boolean;
  mode: "auto" | "warn" | "block";
  warmPages: number;
  warmSessions: number;
  subRepos: string[];
}
interface EnforcementIntents {
  agents: AgentDefinition[];
  commands: CommandDef[];
  hook: HookRule | null;  // null for non-contract shapes
}
```

`src/adapters/claude-code.ts` turns intents → `GeneratedFile[]`:
`.claude/agents/*.md`, `.claude/commands/*.md`,
`.claude/hooks/memory-bank-stop.js` (static asset, copied verbatim),
`.claude/settings.json`. `enforcement.ts` produces intents; the adapter produces
files. If we can't name what a second adapter consumes, the seam isn't real —
so the intent types are the seam.

`generateWorkspace` (the v1 slot-in point) gains: when `pillars` includes
`"enforcement"`, build `EnforcementContext`, call `enforcement.ts`, pass the
intents to the claude-code adapter, and append its files.

## The Stop Hook

Shipped as a **static `.js` asset** copied verbatim (not templated — it is real
program logic, not fill-in text). At runtime it reads `manifest.yaml` for the
repo list, shape, and the `enforcement:` block.

- **Gating** (generalized from cork-crm's hook): blocks only when the session did
  cross-app mutating work — ≥2 contract-linked repos touched via a mutating tool
  (`Edit`/`Write`/`MultiEdit`/`NotebookEdit`) — **without** updating
  `memory-bank/`. Loop-guarded via `stop_hook_active`; fails open on any parse
  error or missing memory bank (never blocks spuriously).
- **Warm (hybrid):** `pages > warmPages` OR `sessions >= warmSessions`. Page
  count is computed statelessly from real memory-bank pages (excluding
  `README.md`, `index.md`, `log.md`, seeded stubs, `.gitkeep`). Session count is
  read/incremented in `.agentspace/state.json`.
- **Modes:** `auto` → warn before warm, block after; `warn` → always warn-only;
  `block` → always block (when gated).
- **Shape gating:** the hook (and `settings.json` Stop wiring) is emitted only
  for contract-linked shapes. Single-repo and unrelated workspaces get agents
  but no hook.

**The decision logic** — `decideStop({ mode, warm, crossAppMutation,
memoryBankUpdated }) → "allow" | "warn" | "block"` — is a **pure function** in
its own module, unit-tested exhaustively. The `.js` hook asset is a thin wrapper
that gathers inputs (stdin, transcript, FS) and calls it.

## Stack-Agent Library

Ships as loose files in the published package (`package.json` `files` includes
`stack-agents`):

```
stack-agents/
  _generic.md  rails.md  nextjs.md  expo.md  go.md  django.md  spring-boot.md
  stacks.yaml      # id → { displayName, aliases, toolList }
```

- Each `.md`: frontmatter (`name` with `{{repoName}}` placeholder, `description`,
  `tools`) + **stack-generic** body + a `## Project specifics (fill me in)`
  TODO block. No project-specific facts (those would poison other users' repos).
- A **loader** (`src/stackAgents/loader.ts`) resolves the `stack-agents/` dir at
  runtime relative to the binary via `import.meta.url`, with a dev fallback
  (walk up to the package root). Unit-tested against both layouts.
- **Resolution:** wizard stack id → `stacks.yaml` lookup → `<id>.md`; unknown id
  → `_generic.md` with no penalty.
- The adapter renders `<repo>-engineer.md` by injecting `repoName`, `repoDir`,
  `boundaryRule`, `role` into the matched stack `.md` (thin injection via the
  existing `render`). `toolList` comes from `stacks.yaml` (engineers) or a fixed
  read-only set (the reviewer).
- **Integrity:** `doctor` and CI assert every `stacks.yaml` id has a backing
  `.md` and each file has a `_Last verified:` footer. Contribution rubric in
  `CONTRIBUTING.md` (already present; extend with the stack-agent section).

## Commands & the doctor↔lint Bridge

- `/ingest`, `/query`, `/lint` bodies are **ported and generalized** from the
  cork-crm command files: same proven structure, with the fixed 3-app folder
  list / naming replaced by thin injection of the workspace's folder set and
  name.
- **`/lint`** delegates mechanical checks to **`agentspace doctor --lint`** (size
  budgets, staleness, orphans, citation-path existence — already implemented in
  v1, single source of truth), then adds the LLM-only judgment checks
  (contradictions, scope violations, citation *correctness*).
- **`doctor --lint`** emits machine-readable findings (one JSON object per line,
  or a `{ findings: [...] }` document) the slash command consumes; `doctor`'s
  human output stays the default with no flag.
- `settings.json` (Stop hook wiring) is adapter-owned. `.gitignore` gains
  `.agentspace/state.json`.

## Root CLAUDE.md addition

For contract-linked multi-repo shapes, the generated root `CLAUDE.md` gains a
short **"Parallel agents"** section describing the worktree-per-repo dispatch
pattern (generalized from cork-crm): one worktree per repo, dispatch that repo's
`<repo>-engineer` agent, end with the `cross-app-reviewer` on the combined diff.
Documentation only — nothing executable.

## Data Flow (additions to v1)

```
config (pillars includes "enforcement")
   │
buildContext ──► EnforcementContext (repos, shape, contractLinked, enforcement config)
   │
generators/enforcement.ts ──► EnforcementIntents { agents, commands, hook }
   │                                   │
   │                          adapters/claude-code.ts
   │                                   │  + stackAgents/loader (reads stack-agents/*.md)
   ▼                                   ▼
manifest.ts (emits enforcement: block)   .claude/{agents,commands,hooks}/*, settings.json
   └──────────────► writeTree ◄──────────────┘
```

## Error Handling

- **Unknown stack** → `_generic.md`, no failure (already the v1 wizard rule).
- **Missing `<id>.md` for a registered id** → `doctor` failure + adapter falls
  back to `_generic` with a warning.
- **Loader can't find `stack-agents/`** (broken install) → clear error naming the
  expected location; `init` aborts the enforcement pillar rather than emitting
  empty agents.
- **Hook runtime:** any malformed stdin / missing manifest / missing memory bank
  → exit 0 (fail open, never block). `stop_hook_active` short-circuits to prevent
  re-prompt loops.
- **Non-contract shape + enforcement selected** → agents emitted, `hook: null`,
  no reviewer; no error.

## Testing Strategy

- **Pure `decideStop`** — all `mode` × `warm` × `crossAppMutation` ×
  `memoryBankUpdated` combinations.
- **Warm computation** — page-count (stateless) and session-count (state file)
  helpers tested independently.
- **Stack loader + resolution** — known→its file, unknown→`_generic`,
  missing-`.md`→error; both dist and dev path layouts.
- **`enforcement.ts` intents** — shape gating (single-repo → agents only,
  `hook:null`, no reviewer; one-product/peer/library → full pack), correct
  per-role tool lists.
- **claude-code adapter** — intents → exact `.claude/` file set; agent
  frontmatter valid; `settings.json` wires the hook; reviewer has no `Write`.
- **`doctor --lint`** — machine-readable output shape asserted; parity with
  human output's findings.
- **Multi-shape fixtures extended** for enforcement; assert absence of
  hook/reviewer where the shape doesn't warrant them.
- **Coverage:** 80%+, concentrated on `enforcement.ts`, the adapter, the loader,
  and `decideStop`.

## Open Questions (for the plan, not blocking)

- Exact default thresholds (`warmPages: 5`, `warmSessions: 10`) — confirm during
  implementation; trivially tunable.
- `doctor --lint` output format detail (NDJSON vs single JSON doc).
- Whether `_generic.md` alone (all-unknown-stack workspace) should still emit a
  reviewer for contract-linked shapes (current answer: yes — boundary + role are
  real even without stack lore).

## Provenance

Generalizes the cork-crm `.claude/` pack: `hooks/memory-bank-stop.js`,
`commands/{ingest,query,lint}.md`, `agents/{rails,estimates,mobile}-engineer.md`
and `cross-app-reviewer.md`, `settings.json`. Those are the reference for the
ported command bodies, the static hook, and the stack-agent seeds.
