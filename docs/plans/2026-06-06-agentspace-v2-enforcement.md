# agentspace v2 — Enforcement Pillar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the opt-in enforcement pillar to `agentspace init` — generating a real Claude Code `.claude/` pack (boundary-enforced per-repo agents, `/ingest /query /lint` commands, a warm-until-warm Stop hook, a cross-app reviewer, `settings.json`) plus a loose-`.md` stack-agent library, all shape-gated.

**Architecture:** Follows the shipped v1 patterns — pure functions returning `GeneratedFile[]`, typed context slices, `render()` for injection, `writeTree` as the only writer. `enforcement.ts` builds tool-neutral intents (`AgentDefinition[]` / `CommandDef[]` / `HookRule`); `adapters/claudeCode.ts` turns intents into `.claude/` files. Stack agents are loose `.md` files resolved by a package-root loader. The Stop hook ships as a static `.cjs` asset whose decision logic is a pure, directly-tested function; it reads a dep-free `.claude/agentspace-hook.json` sidecar (projected from the manifest `enforcement:` block) at runtime.

**Tech Stack:** TypeScript (ESM, Node 18+), vitest, mustache, yaml — same as v1.

**Builds on:** the merged v1 core (`src/types.ts`, `src/shape.ts`, `src/context/build.ts`, `src/generators/{manifest,memoryBank}.ts`, `src/commands/{init,doctor}.ts`, `src/renderer/render.ts`, `src/wizard/*`). All paths are under `/Volumes/externalssd/agentspace`. Shell cwd may reset between bash calls — `cd` into the repo each time. Create a branch `feat/v2-enforcement` before Task 1.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/types.ts` (modify) | Add `HookMode`, `EnforcementConfig`, `DEFAULT_ENFORCEMENT`, `AgentDefinition`, `CommandDef`, `HookRule`, `EnforcementIntents`, `EnforcementContext`; extend `WorkspaceConfig`, `WorkspaceContext`, `ManifestContext` |
| `src/paths.ts` (create) | `packageRoot()` — locate the package root from `import.meta.url` |
| `src/stackAgents/loader.ts` (create) | Parse `stacks.yaml`, resolve a stack id, load a stack `.md` body (fallback `_generic`) |
| `stack-agents/*.md`, `stack-agents/stacks.yaml` (create) | The loose stack-agent library (contribution surface) |
| `src/templates/commands.ts` (create) | `/ingest /query /lint` bodies (generalized from cork-crm) |
| `src/templates/agents.ts` (create) | The cross-app reviewer agent body |
| `src/generators/enforcement.ts` (create) | `generateEnforcementIntents(ctx)` → `EnforcementIntents` |
| `assets/memory-bank-stop.cjs` (create) | Static Stop hook; exports pure `decideStop`/`isWarm`/`countRealPages` |
| `src/adapters/claudeCode.ts` (create) | Intents + hook asset + stack loader → `GeneratedFile[]` |
| `src/generators/manifest.ts` (modify) | Emit `enforcement:` block, `.agentspace/state.json` ignore, CLAUDE.md parallel-agents section |
| `src/context/build.ts` (modify) | Build `EnforcementContext` slice |
| `src/wizard/{assemble,run}.ts` (modify) | `enableEnforcement` answer → pillar + config |
| `src/commands/init.ts` (modify) | Wire enforcement into `generateWorkspace` |
| `src/commands/doctor.ts`, `src/cli.ts` (modify) | `doctor --lint` machine-readable output |
| `package.json` (modify) | `files`: add `stack-agents`, `assets` |
| `test/**` | One test file per module |

---

### Task 1: Enforcement types

**Files:**
- Modify: `src/types.ts`
- Test: `test/enforcementTypes.test.ts`

- [ ] **Step 1: Write the failing test `test/enforcementTypes.test.ts`**

```ts
import { expect, test } from "vitest";
import { DEFAULT_ENFORCEMENT } from "../src/types";

test("default enforcement config", () => {
  expect(DEFAULT_ENFORCEMENT).toEqual({ mode: "auto", warmPages: 5, warmSessions: 10 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/enforcementTypes.test.ts`
Expected: FAIL — `DEFAULT_ENFORCEMENT` not exported.

- [ ] **Step 3: Append to `src/types.ts`**

```ts
export type HookMode = "auto" | "warn" | "block";

export interface EnforcementConfig {
  mode: HookMode;
  warmPages: number;
  warmSessions: number;
}

export const DEFAULT_ENFORCEMENT: EnforcementConfig = {
  mode: "auto",
  warmPages: 5,
  warmSessions: 10,
};

export interface AgentDefinition {
  name: string; // "<repo>-engineer" or "cross-app-reviewer"
  repoDir: string; // "" for the cross-repo reviewer
  role: string;
  stack: string; // stack id or "generic"
  boundaryRule: string;
  toolList: string[];
  isReviewer: boolean;
}

export interface CommandDef {
  name: string; // "ingest" | "query" | "lint"
  body: string;
}

export interface HookRule {
  enabled: boolean;
  mode: HookMode;
  warmPages: number;
  warmSessions: number;
  subRepos: string[];
}

export interface EnforcementIntents {
  agents: AgentDefinition[];
  commands: CommandDef[];
  hook: HookRule | null; // null for non-contract shapes
}

export interface EnforcementContext {
  workspaceName: string;
  shape: WorkspaceShape;
  contractLinked: boolean;
  repos: RepoInput[];
  config: EnforcementConfig;
  folders: string[]; // wiki folder names, for command injection
}
```

Then extend the existing interfaces. In `WorkspaceConfig` add:

```ts
  /** Enforcement config when the pillar is selected, else null. */
  enforcement: EnforcementConfig | null;
```

In `WorkspaceContext` add:

```ts
  enforcement: EnforcementContext | null;
```

In `ManifestContext` add:

```ts
  contractLinked: boolean;
  enforcement: EnforcementConfig | null;
```

- [ ] **Step 4: Update existing call sites so the project still typechecks**

`src/context/build.ts` `buildContext` currently constructs `manifest` without `contractLinked`/`enforcement`, and the returned object lacks `enforcement`. Add to the `manifest` slice `contractLinked: isContractLinked(config)` and `enforcement: config.enforcement`, and add a top-level `enforcement: null` (Task 3 fills this in properly). In `src/wizard/assemble.ts`, add `enforcement: null` to the returned config (Task 2 fills this in). These keep the build green until later tasks.

Run: `cd /Volumes/externalssd/agentspace && npm run typecheck`
Expected: clean (fix any missing-field errors the compiler reports by adding the fields above).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/enforcementTypes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/types.ts src/context/build.ts src/wizard/assemble.ts test/enforcementTypes.test.ts
git commit -m "feat: enforcement pillar types and context slice"
```

---

### Task 2: Wizard — enforcement opt-in

**Files:**
- Modify: `src/wizard/assemble.ts`, `src/wizard/run.ts`
- Test: `test/assemble.test.ts` (extend)

- [ ] **Step 1: Add failing assertions to `test/assemble.test.ts`**

Append these tests (keep the existing ones):

```ts
import { DEFAULT_ENFORCEMENT } from "../src/types";

test("enforcement pillar + default config when enabled", () => {
  const cfg = assembleConfig({ ...answers, enableEnforcement: true });
  expect(cfg.pillars).toContain("enforcement");
  expect(cfg.enforcement).toEqual(DEFAULT_ENFORCEMENT);
});

test("no enforcement pillar or config when disabled", () => {
  const cfg = assembleConfig({ ...answers, enableEnforcement: false });
  expect(cfg.pillars).not.toContain("enforcement");
  expect(cfg.enforcement).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/assemble.test.ts`
Expected: FAIL — `enableEnforcement` not on `WizardAnswers`; `enforcement` not set.

- [ ] **Step 3: Update `src/wizard/assemble.ts`**

Add `enableEnforcement: boolean;` to the `WizardAnswers` interface. In `assembleConfig`, after the wiki pillar push, add enforcement:

```ts
  if (answers.enableEnforcement) pillars.push("enforcement");
```

And set the `enforcement` field on the returned config (replace the temporary `enforcement: null` from Task 1):

```ts
    enforcement: answers.enableEnforcement ? { ...DEFAULT_ENFORCEMENT } : null,
```

Add the import: `import { DEFAULT_ENFORCEMENT } from "../types";` (alongside the existing type imports).

- [ ] **Step 4: Update `src/wizard/run.ts`** (interactive layer — not unit-tested)

After the existing `enableWiki` confirm, add:

```ts
  const enableEnforcement = await p.confirm({
    message: "Include the Claude Code enforcement pack (agents, Stop hook, commands)?",
    initialValue: false,
  });
  cancel(enableEnforcement as unknown as string);
```

Then pass `enableEnforcement: enableEnforcement === true` into the `assembleConfig({...})` call.

- [ ] **Step 5: Run tests + typecheck**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/assemble.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/wizard/assemble.ts src/wizard/run.ts test/assemble.test.ts
git commit -m "feat: wizard enforcement pillar opt-in"
```

---

### Task 3: Context — build the EnforcementContext slice

**Files:**
- Modify: `src/context/build.ts`
- Test: `test/context.test.ts` (extend)

- [ ] **Step 1: Add failing assertions to `test/context.test.ts`**

```ts
import { WIKI_FOLDERS } from "../src/templates/memoryBank";

test("enforcement context present when config set", () => {
  const ctx = buildContext({ ...config, enforcement: { mode: "auto", warmPages: 5, warmSessions: 10 }, pillars: ["manifest", "wiki", "enforcement"] }, "2026-06-05");
  expect(ctx.enforcement).not.toBeNull();
  expect(ctx.enforcement!.contractLinked).toBe(true);
  expect(ctx.enforcement!.folders).toEqual(WIKI_FOLDERS);
});

test("enforcement context null when no config", () => {
  const ctx = buildContext({ ...config, enforcement: null }, "2026-06-05");
  expect(ctx.enforcement).toBeNull();
});
```

(`config` in this file already has the v1 shape — add `enforcement: null` to it if the compiler complains.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/context.test.ts`
Expected: FAIL — `ctx.enforcement` is `null`/undefined.

- [ ] **Step 3: Update `src/context/build.ts`**

Add imports:

```ts
import { isContractLinked } from "../shape";
import { WIKI_FOLDERS } from "../templates/memoryBank";
```

Replace the temporary top-level `enforcement: null` with a real slice:

```ts
    enforcement: config.enforcement
      ? {
          workspaceName: config.workspaceName,
          shape: config.shape,
          contractLinked: isContractLinked(config),
          repos: config.repos,
          config: config.enforcement,
          folders: WIKI_FOLDERS,
        }
      : null,
```

- [ ] **Step 4: Run test + typecheck**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/context.test.ts && npm run typecheck`
Expected: PASS; clean.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/context/build.ts test/context.test.ts
git commit -m "feat: build EnforcementContext slice"
```

---

### Task 4: Stack-agent library (loose files)

**Files:**
- Create: `stack-agents/stacks.yaml`, `stack-agents/_generic.md`, `stack-agents/rails.md`, `stack-agents/nextjs.md`, `stack-agents/expo.md`, `stack-agents/go.md`, `stack-agents/django.md`, `stack-agents/spring-boot.md`
- Modify: `package.json` (`files`)
- Test: `test/stackLibrary.test.ts`

- [ ] **Step 1: Create `stack-agents/stacks.yaml`**

```yaml
# Registry: stack id -> display metadata. Adding a stack = one .md file + one row here.
stacks:
  - id: rails
    displayName: Ruby on Rails
    aliases: [rails, ruby, ror]
  - id: nextjs
    displayName: Next.js
    aliases: [nextjs, next, react]
  - id: expo
    displayName: Expo / React Native
    aliases: [expo, react-native, rn]
  - id: go
    displayName: Go
    aliases: [go, golang]
  - id: django
    displayName: Django
    aliases: [django, python]
  - id: spring-boot
    displayName: Spring Boot
    aliases: [spring-boot, spring, java]
# Default tool list for engineer agents (the reviewer uses a fixed read-only set).
engineerTools: [Read, Write, Edit, MultiEdit, Bash, Grep, Glob]
```

- [ ] **Step 2: Create `stack-agents/_generic.md`** (the fallback)

```markdown
---
name: {{repoName}}-engineer
description: Engineer for the {{repoName}} repository. Owns only {{repoDir}}.
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
---

You are the engineer for **{{repoName}}** ({{role}}).

## Scope (hard boundary)

{{boundaryRule}} If a task requires edits in another repo, stop and report
`STATUS: needs-input` — that is the orchestrator's job to fan out.

## Discipline

- **Cite `file:line`** for every behavioral claim about the codebase.
- **Wiki is a hint, code is truth.** Verify a cited line still says what a
  memory-bank page claims before relying on it.
- Read `{{repoDir}}`'s own `CLAUDE.md` (if present) for authoritative commands
  and architecture before making changes.

## Project specifics (fill me in)

> agentspace can't know your project's internals. Record the load-bearing facts
> a new engineer needs: key models/modules, background-job system, auth flow,
> testing command, and anything surprising. Cite `file:line`.

- TODO:
```

- [ ] **Step 3: Create the six stack files.** Each uses the same frontmatter/scope/discipline/TODO skeleton as `_generic.md` but with a stack-specific **"Stack you know"** section. Create them with this content:

`stack-agents/rails.md`:

```markdown
---
name: {{repoName}}-engineer
description: Rails engineer for {{repoName}}. Owns only {{repoDir}}.
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
---

You are the **Rails engineer** for **{{repoName}}** ({{role}}).

## Scope (hard boundary)

{{boundaryRule}} If a task needs edits elsewhere, stop and report `STATUS: needs-input`.

## Stack you know

- Convention over configuration; fat models / skinny controllers.
- ActiveRecord: watch for N+1 (use `includes`/`preload`); use scopes; prefer
  `find_each` for large sets.
- Strong Parameters for mass-assignment safety; validations on the model.
- Background work via Active Job (Sidekiq/Delayed Job) — never block requests.
- RSpec/Minitest; use factories; test at the model and request level.
- Migrations are forward-only in practice; never edit a shipped migration.

## Discipline

- **Cite `file:line`** for behavioral claims. **Wiki is a hint, code is truth.**
- Read `{{repoDir}}/CLAUDE.md` for authoritative commands before changing things.

## Project specifics (fill me in)

> Record this repo's models of record, job backend, auth flow, multitenancy
> approach, and test command. Cite `file:line`.

- TODO:
```

`stack-agents/nextjs.md`:

```markdown
---
name: {{repoName}}-engineer
description: Next.js engineer for {{repoName}}. Owns only {{repoDir}}.
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
---

You are the **Next.js engineer** for **{{repoName}}** ({{role}}).

## Scope (hard boundary)

{{boundaryRule}} If a task needs edits elsewhere, stop and report `STATUS: needs-input`.

## Stack you know

- App Router vs Pages Router — confirm which this repo uses before adding routes.
- Server Components by default; mark Client Components with `"use client"`.
- Data fetching: server components / route handlers; avoid leaking secrets to client.
- TypeScript strictness; prefer typed API boundaries.
- Watch hydration mismatches and `useEffect` overuse.
- Tests via Jest/Vitest + React Testing Library; E2E via Playwright.

## Discipline

- **Cite `file:line`** for behavioral claims. **Wiki is a hint, code is truth.**
- Read `{{repoDir}}/CLAUDE.md` for authoritative commands before changing things.

## Project specifics (fill me in)

> Record this repo's router style, state management, API client, and auth flow.
> Cite `file:line`.

- TODO:
```

`stack-agents/expo.md`:

```markdown
---
name: {{repoName}}-engineer
description: Expo / React Native engineer for {{repoName}}. Owns only {{repoDir}}.
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
---

You are the **Expo / React Native engineer** for **{{repoName}}** ({{role}}).

## Scope (hard boundary)

{{boundaryRule}} If a task needs edits elsewhere, stop and report `STATUS: needs-input`.

## Stack you know

- Expo SDK + Expo Router (file-based). Confirm SDK version and New Architecture status.
- Platform splits: iOS / Android / web — test the surfaces the repo targets.
- Avoid native-only APIs on web; guard with `Platform.select`.
- Keep the JS bundle lean; watch list performance (`FlatList`, memoization).
- Tests via Jest + React Native Testing Library.

## Discipline

- **Cite `file:line`** for behavioral claims. **Wiki is a hint, code is truth.**
- Read `{{repoDir}}/CLAUDE.md` for authoritative commands before changing things.

## Project specifics (fill me in)

> Record this repo's navigation, design system, API client, and auth/session flow.
> Cite `file:line`.

- TODO:
```

`stack-agents/go.md`:

```markdown
---
name: {{repoName}}-engineer
description: Go engineer for {{repoName}}. Owns only {{repoDir}}.
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
---

You are the **Go engineer** for **{{repoName}}** ({{role}}).

## Scope (hard boundary)

{{boundaryRule}} If a task needs edits elsewhere, stop and report `STATUS: needs-input`.

## Stack you know

- Idiomatic Go: explicit error handling (`if err != nil`), small interfaces.
- Concurrency via goroutines + channels; guard shared state; respect `context.Context`.
- Standard layout; keep packages cohesive; avoid cyclic imports.
- Table-driven tests with the standard `testing` package; `go vet` and `gofmt` clean.

## Discipline

- **Cite `file:line`** for behavioral claims. **Wiki is a hint, code is truth.**
- Read `{{repoDir}}/CLAUDE.md` for authoritative commands before changing things.

## Project specifics (fill me in)

> Record this repo's entrypoints, key packages, datastore, and auth approach.
> Cite `file:line`.

- TODO:
```

`stack-agents/django.md`:

```markdown
---
name: {{repoName}}-engineer
description: Django engineer for {{repoName}}. Owns only {{repoDir}}.
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
---

You are the **Django engineer** for **{{repoName}}** ({{role}}).

## Scope (hard boundary)

{{boundaryRule}} If a task needs edits elsewhere, stop and report `STATUS: needs-input`.

## Stack you know

- Apps/models/views/urls structure; the ORM — watch N+1 (`select_related`/`prefetch_related`).
- Migrations are generated; never hand-edit a shipped migration.
- DRF for APIs (serializers, viewsets) if present; permissions on the view.
- Settings split by environment; never commit secrets.
- Tests via pytest-django or Django's `TestCase`; use factories.

## Discipline

- **Cite `file:line`** for behavioral claims. **Wiki is a hint, code is truth.**
- Read `{{repoDir}}/CLAUDE.md` for authoritative commands before changing things.

## Project specifics (fill me in)

> Record this repo's apps, auth flow, async/task backend, and test command.
> Cite `file:line`.

- TODO:
```

`stack-agents/spring-boot.md`:

```markdown
---
name: {{repoName}}-engineer
description: Spring Boot engineer for {{repoName}}. Owns only {{repoDir}}.
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
---

You are the **Spring Boot engineer** for **{{repoName}}** ({{role}}).

## Scope (hard boundary)

{{boundaryRule}} If a task needs edits elsewhere, stop and report `STATUS: needs-input`.

## Stack you know

- Layered: controller / service / repository. Constructor injection over field injection.
- JPA/Hibernate — watch N+1 and lazy-loading traps; use DTOs at the boundary.
- Bean validation (`@Valid`); centralized exception handling.
- Profiles for environments; externalized config; never commit secrets.
- Tests via JUnit 5 + Mockito; slice tests (`@WebMvcTest`, `@DataJpaTest`).

## Discipline

- **Cite `file:line`** for behavioral claims. **Wiki is a hint, code is truth.**
- Read `{{repoDir}}/CLAUDE.md` for authoritative commands before changing things.

## Project specifics (fill me in)

> Record this repo's modules, persistence, security config, and build/test command.
> Cite `file:line`.

- TODO:
```

- [ ] **Step 4: Add a `_Last verified:` footer to every stack file.** Append this exact block to the end of each of the seven `.md` files (`_generic.md` and the six stacks):

```markdown

---
_Last verified: 2026-06-06_
```

- [ ] **Step 5: Update `package.json` `files`**

Change `"files": ["dist"],` to:

```json
  "files": ["dist", "stack-agents", "assets"],
```

- [ ] **Step 6: Write the failing test `test/stackLibrary.test.ts`**

```ts
import { expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const dir = join(process.cwd(), "stack-agents");

test("every registered stack id has a backing .md file", () => {
  const reg = parse(readFileSync(join(dir, "stacks.yaml"), "utf8")) as {
    stacks: { id: string }[];
  };
  for (const s of reg.stacks) {
    const file = join(dir, `${s.id}.md`);
    expect(() => readFileSync(file, "utf8")).not.toThrow();
  }
});

test("_generic.md exists and all stack files have frontmatter + verified footer", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  expect(files).toContain("_generic.md");
  for (const f of files) {
    const body = readFileSync(join(dir, f), "utf8");
    expect(body.startsWith("---\n")).toBe(true);
    expect(body).toMatch(/_Last verified: \d{4}-\d{2}-\d{2}_/);
    expect(body).toContain("{{repoName}}");
    expect(body).toContain("{{boundaryRule}}");
  }
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/stackLibrary.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add stack-agents package.json test/stackLibrary.test.ts
git commit -m "feat: seed stack-agent library (generic + 6 stacks)"
```

---

### Task 5: Package-root resolver + stack loader

**Files:**
- Create: `src/paths.ts`, `src/stackAgents/loader.ts`
- Test: `test/loader.test.ts`

- [ ] **Step 1: Write the failing test `test/loader.test.ts`**

```ts
import { expect, test } from "vitest";
import { resolveStackId, loadStackBody, engineerToolList } from "../src/stackAgents/loader";

test("resolves a known id and its aliases", () => {
  expect(resolveStackId("rails")).toBe("rails");
  expect(resolveStackId("ror")).toBe("rails");
  expect(resolveStackId("golang")).toBe("go");
});

test("unknown stack falls back to _generic", () => {
  expect(resolveStackId("cobol")).toBe("_generic");
  expect(resolveStackId("generic")).toBe("_generic");
});

test("loadStackBody returns frontmatter+body for a known stack", () => {
  const body = loadStackBody("rails");
  expect(body).toContain("Rails engineer");
  expect(body).toContain("{{repoName}}");
});

test("loadStackBody falls back to _generic for unknown", () => {
  const body = loadStackBody("cobol");
  expect(body).toContain("{{repoName}}-engineer");
});

test("engineerToolList comes from the registry", () => {
  expect(engineerToolList()).toEqual(["Read", "Write", "Edit", "MultiEdit", "Bash", "Grep", "Glob"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/loader.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/paths.ts`**

```ts
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locate the installed package root by walking up from this module until a
 * directory containing package.json is found. Works in dev (src/…) and in the
 * bundled dist (dist/cli.js), and after npm install (node_modules/agentspace).
 */
export function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("agentspace: could not locate package root from " + import.meta.url);
}

export function packageDir(name: string): string {
  return join(packageRoot(), name);
}
```

- [ ] **Step 4: Create `src/stackAgents/loader.ts`**

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { packageDir } from "../paths";

interface Registry {
  stacks: { id: string; displayName: string; aliases: string[] }[];
  engineerTools: string[];
}

function stacksDir(): string {
  return packageDir("stack-agents");
}

let cached: Registry | null = null;
function registry(): Registry {
  if (!cached) {
    cached = parse(readFileSync(join(stacksDir(), "stacks.yaml"), "utf8")) as Registry;
  }
  return cached;
}

export function engineerToolList(): string[] {
  return registry().engineerTools;
}

/** Map a wizard stack input to a stack id, or "_generic" if unknown. */
export function resolveStackId(input: string): string {
  const norm = input.trim().toLowerCase();
  if (norm === "" || norm === "generic" || norm === "_generic") return "_generic";
  for (const s of registry().stacks) {
    if (s.id === norm || s.aliases.includes(norm)) return s.id;
  }
  return "_generic";
}

/** Load a stack body by id; falls back to _generic.md (with a warning) if missing. */
export function loadStackBody(input: string): string {
  const id = resolveStackId(input);
  const file = join(stacksDir(), `${id}.md`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  // Registered id with no backing file — should be caught by tests, but fall back.
  console.warn(`agentspace: stack file ${id}.md missing; using _generic`);
  return readFileSync(join(stacksDir(), "_generic.md"), "utf8");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/loader.test.ts && npm run typecheck`
Expected: PASS; clean.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/paths.ts src/stackAgents/loader.ts test/loader.test.ts
git commit -m "feat: package-root resolver and stack-agent loader"
```

---

### Task 6: Command + reviewer templates

**Files:**
- Create: `src/templates/commands.ts`, `src/templates/agents.ts`
- Test: `test/commandTemplates.test.ts`

- [ ] **Step 1: Create `src/templates/commands.ts`** (generalized from the cork-crm command bodies; `{{folderList}}` and `{{workspaceName}}` are injected)

```ts
export const INGEST = `---
description: Ingest a source into the {{workspaceName}} memory-bank (LLM Wiki pattern)
---

You are operating in **INGEST mode** for the {{workspaceName}} memory-bank.

Source to ingest: $ARGUMENTS

## No-ingest gate (apply first)
Skip the ingest and tell the user if any are true:
- The content is derivable from \`git log\` / \`grep\` / reading code directly.
- You can't name **two future questions** the page would answer.
- It's one-off setup chatter, not durable cross-repo knowledge.

## Steps
1. **Read the source** (file, URL, or pasted content).
2. **Discuss takeaways** briefly (3–5 bullets) so the user can correct course.
3. **Classify and pick a folder** under \`memory-bank/\`:
{{#folders}}   - \`{{.}}/\`
{{/folders}}
4. **Write a concise page** — bullets, tables, citations. ≤ 150 lines.
5. **Cite \`file:line\`** for every factual claim about the codebase.
6. **Last-verified footer:** end with \`_Last verified: YYYY-MM-DD_\`.
7. **Cross-link** related pages with \`[[slug]]\`.
8. **Update \`memory-bank/index.md\`** — add an entry under the right category.
9. **Append to \`memory-bank/log.md\`:** \`## [YYYY-MM-DD] ingest | <slug>\`
10. **Report what changed.**

## Rules
Reference, don't duplicate — point at \`file:line\` rather than copying code.
Scannable beats comprehensive.
`;

export const QUERY = `---
description: Query the {{workspaceName}} memory-bank; file useful answers back
---

You are operating in **QUERY mode** for the {{workspaceName}} memory-bank.

Question: $ARGUMENTS

## Steps
1. **Read \`memory-bank/index.md\`** first — see what pages exist.
2. **Read relevant pages** — \`00-core/\` first for constraints, then concept
   pages. Walk \`[[cross-links]]\` as needed.
3. **Classify the question:**
   - **Behavioral** (what the code does / returns) → wiki is a hint; **verify the
     cited \`file:line\` against the code** before answering.
   - **Decision / history** (why we chose Y) → wiki answer stands.
4. **Synthesize with citations** — link pages with \`[[slug]]\`, cite repo
   evidence as \`file:line\`.
5. **If a page's \`Last verified\` is > 30 days old** and you used it for a
   behavioral answer, call it out.
6. **If the wiki lacks the answer**, search the repos, then ask:
   _"Found in \`<source>\`. Worth filing in \`memory-bank/<folder>/<slug>.md\`? (y/n)"_
7. **Append to \`memory-bank/log.md\`:** \`## [YYYY-MM-DD] query | <topic>\`

## Rules
Wiki is a hint, code is truth for behavioral claims. Always cite. Never fabricate.
`;

export const LINT = `---
description: Lint the {{workspaceName}} memory-bank for staleness, drift, and scope violations
---

You are operating in **LINT mode** for the {{workspaceName}} memory-bank.

## Step 1 — mechanical checks (run the tool)
Run \`agentspace doctor --lint\` and read its JSON findings. These cover size
budgets, \`_Last verified:_\` staleness, and orphan/citation-path checks — the
single source of truth for mechanical rules. Do not re-derive them by hand.

## Step 2 — judgment checks (only the LLM can do these)
Sweep the wiki for:
1. **Broken citations** — a \`file:line\` whose line no longer matches the claim
   (spot-check ≥3 per page).
2. **Contradictions** — two pages making incompatible claims.
3. **Stale state** — "in progress" work that's shipped; SHAs that don't exist.
4. **Out-of-scope content** — per-repo detail that belongs in a repo's CLAUDE.md.
5. **Broken cross-links** — \`[[slug]]\` pointing at non-existent pages.

## Report
Output a table: \`Severity | File | Issue | Suggested fix\`. Merge the tool's
mechanical findings with your judgment findings. **Do NOT fix automatically** —
ask the user which to act on. Then append to \`memory-bank/log.md\`:
\`## [YYYY-MM-DD] lint | <H high · M med · L low — short summary>\`
`;
```

- [ ] **Step 2: Create `src/templates/agents.ts`** (the cross-app reviewer body)

```ts
export const REVIEWER_AGENT = `---
name: cross-app-reviewer
description: Read-only reviewer that catches cross-repo breakage in {{workspaceName}}. Use when a change touches an API, shared data shape, or auth flow across repos.
tools: Read, Grep, Glob, Bash
---

You are the **Cross-app reviewer** for the {{workspaceName}} workspace.

## Scope (hard boundary)
**Read-only.** You never edit any file. If the user asks for a fix, report
findings and stop — the relevant repo's engineer applies the change.

## What you do
For a given change (diff, PR, or spec), check whether it breaks any contract
between the repos:
1. **Read \`memory-bank/00-core/crossAppContracts.md\` first** — that's your map.
2. **Identify what the change touches** — API routes, shared payload shapes,
   auth flow, client API code.
3. **For each touched contract:** is the wiki entry still accurate (cite wiki
   \`file:line\` and code \`file:line\`)? Does any consumer break (grep across
   client repos)? Is the change additive (safe) or breaking?
4. **Report** a table: \`severity · what changed · who breaks · suggested fix\`.

## Severity
- **CRITICAL** — breaks a current consumer or the auth contract.
- **HIGH** — a likely break or an undocumented contract change.
- **MEDIUM/LOW** — additive change; doc drift.
`;
```

- [ ] **Step 3: Write the failing test `test/commandTemplates.test.ts`**

```ts
import { expect, test } from "vitest";
import { render } from "../src/renderer/render";
import { INGEST, LINT } from "../src/templates/commands";
import { REVIEWER_AGENT } from "../src/templates/agents";

test("ingest injects workspace name and folder list", () => {
  const out = render(INGEST, { workspaceName: "demo", folders: ["00-core", "04-business"] });
  expect(out).toContain("demo memory-bank");
  expect(out).toContain("`00-core/`");
  expect(out).toContain("`04-business/`");
  expect(out).not.toContain("{{");
});

test("lint delegates mechanical checks to doctor --lint", () => {
  const out = render(LINT, { workspaceName: "demo", folders: [] });
  expect(out).toContain("agentspace doctor --lint");
});

test("reviewer agent has read-only frontmatter (no Write)", () => {
  const out = render(REVIEWER_AGENT, { workspaceName: "demo" });
  expect(out).toMatch(/tools: Read, Grep, Glob, Bash/);
  expect(out).not.toMatch(/tools:.*Write/);
});
```

- [ ] **Step 4: Run test to verify it fails, then passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/commandTemplates.test.ts`
Expected: FAIL (module missing) → after Steps 1–2 exist, PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/templates/commands.ts src/templates/agents.ts test/commandTemplates.test.ts
git commit -m "feat: command and reviewer templates (generalized from cork-crm)"
```

---

### Task 7: Enforcement generator (intents)

**Files:**
- Create: `src/generators/enforcement.ts`
- Test: `test/enforcement.test.ts`

- [ ] **Step 1: Write the failing test `test/enforcement.test.ts`**

```ts
import { expect, test } from "vitest";
import { generateEnforcementIntents } from "../src/generators/enforcement";
import type { EnforcementContext } from "../src/types";

function ctx(overrides: Partial<EnforcementContext> = {}): EnforcementContext {
  return {
    workspaceName: "cork",
    shape: "one-product",
    contractLinked: true,
    repos: [
      { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
      { name: "web", remote: null, stack: "nextjs", role: "frontend" },
    ],
    config: { mode: "auto", warmPages: 5, warmSessions: 10 },
    folders: ["00-core", "04-business"],
    ...overrides,
  };
}

test("one engineer agent per repo with a hard boundary", () => {
  const { agents } = generateEnforcementIntents(ctx());
  const engineers = agents.filter((a) => !a.isReviewer);
  expect(engineers.map((a) => a.name)).toEqual(["api-engineer", "web-engineer"]);
  expect(engineers[0].repoDir).toBe("api");
  expect(engineers[0].boundaryRule).toContain("api");
  expect(engineers[0].toolList).toContain("Write");
});

test("contract-linked shape adds a read-only reviewer and a hook", () => {
  const intents = generateEnforcementIntents(ctx());
  const reviewer = intents.agents.find((a) => a.isReviewer);
  expect(reviewer).toBeTruthy();
  expect(reviewer!.toolList).not.toContain("Write");
  expect(intents.hook).not.toBeNull();
  expect(intents.hook!.subRepos).toEqual(["api", "web"]);
});

test("non-contract shape: agents but no reviewer and no hook", () => {
  const intents = generateEnforcementIntents(
    ctx({ shape: "single-repo", contractLinked: false, repos: [ctx().repos[0]] }),
  );
  expect(intents.agents.every((a) => !a.isReviewer)).toBe(true);
  expect(intents.hook).toBeNull();
});

test("commands are always generated", () => {
  const { commands } = generateEnforcementIntents(ctx());
  expect(commands.map((c) => c.name).sort()).toEqual(["ingest", "lint", "query"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/enforcement.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/generators/enforcement.ts`**

```ts
import { render } from "../renderer/render";
import { INGEST, LINT, QUERY } from "../templates/commands";
import { engineerToolList, resolveStackId } from "../stackAgents/loader";
import type {
  AgentDefinition,
  CommandDef,
  EnforcementContext,
  EnforcementIntents,
  HookRule,
} from "../types";

const REVIEWER_TOOLS = ["Read", "Grep", "Glob", "Bash"];

export function generateEnforcementIntents(ctx: EnforcementContext): EnforcementIntents {
  const agents: AgentDefinition[] = ctx.repos.map((repo) => ({
    name: `${repo.name}-engineer`,
    repoDir: repo.name,
    role: repo.role,
    stack: resolveStackId(repo.stack),
    boundaryRule: `You only edit files inside \`${repo.name}/\`. Never touch another repo or \`memory-bank/\` (except read-only).`,
    toolList: engineerToolList(),
    isReviewer: false,
  }));

  if (ctx.contractLinked) {
    agents.push({
      name: "cross-app-reviewer",
      repoDir: "",
      role: "read-only cross-repo reviewer",
      stack: "generic",
      boundaryRule: "Read-only. You never edit any file.",
      toolList: REVIEWER_TOOLS,
      isReviewer: true,
    });
  }

  const view = { workspaceName: ctx.workspaceName, folders: ctx.folders };
  const commands: CommandDef[] = [
    { name: "ingest", body: render(INGEST, view) },
    { name: "query", body: render(QUERY, view) },
    { name: "lint", body: render(LINT, view) },
  ];

  const hook: HookRule | null = ctx.contractLinked
    ? {
        enabled: true,
        mode: ctx.config.mode,
        warmPages: ctx.config.warmPages,
        warmSessions: ctx.config.warmSessions,
        subRepos: ctx.repos.map((r) => r.name),
      }
    : null;

  return { agents, commands, hook };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/enforcement.test.ts && npm run typecheck`
Expected: PASS (4 tests); clean.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/generators/enforcement.ts test/enforcement.test.ts
git commit -m "feat: enforcement generator builds tool-neutral intents"
```

---

### Task 8: Stop hook asset (.cjs) with pure, tested decision logic

**Files:**
- Create: `assets/memory-bank-stop.cjs`
- Test: `test/hook.test.ts`

The hook ships verbatim into the user's workspace and runs with bare `node`
(no deps). It is `.cjs` so Node always treats it as CommonJS regardless of the
user's `package.json`. Its pure helpers are exported when required, so the test
runs them directly.

- [ ] **Step 1: Write the failing test `test/hook.test.ts`**

```ts
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "vitest";

const require = createRequire(import.meta.url);
const hook = require(join(process.cwd(), "assets/memory-bank-stop.cjs"));

test("decideStop: allow when not a cross-app mutation", () => {
  expect(hook.decideStop({ mode: "auto", warm: true, crossAppMutation: false, memoryBankUpdated: false })).toBe("allow");
});

test("decideStop: allow when memory bank was updated", () => {
  expect(hook.decideStop({ mode: "auto", warm: true, crossAppMutation: true, memoryBankUpdated: true })).toBe("allow");
});

test("decideStop auto: warn before warm, block after", () => {
  const base = { mode: "auto", crossAppMutation: true, memoryBankUpdated: false } as const;
  expect(hook.decideStop({ ...base, warm: false })).toBe("warn");
  expect(hook.decideStop({ ...base, warm: true })).toBe("block");
});

test("decideStop mode overrides: warn always warns, block always blocks", () => {
  const g = { crossAppMutation: true, memoryBankUpdated: false, warm: true } as const;
  expect(hook.decideStop({ ...g, mode: "warn" })).toBe("warn");
  expect(hook.decideStop({ ...g, mode: "block", warm: false })).toBe("block");
});

test("isWarm: true on either pages OR sessions", () => {
  expect(hook.isWarm({ pages: 6, sessions: 0, warmPages: 5, warmSessions: 10 })).toBe(true);
  expect(hook.isWarm({ pages: 0, sessions: 10, warmPages: 5, warmSessions: 10 })).toBe(true);
  expect(hook.isWarm({ pages: 2, sessions: 2, warmPages: 5, warmSessions: 10 })).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/hook.test.ts`
Expected: FAIL — asset file does not exist.

- [ ] **Step 3: Create `assets/memory-bank-stop.cjs`**

```js
#!/usr/bin/env node
/**
 * agentspace Stop hook — keeps the memory bank current on cross-repo work.
 * Dep-free (runs with bare node). Reads .claude/agentspace-hook.json for config.
 * Pure helpers are exported when required (for tests); the file runs when executed.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MUTATING_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SEED_PAGES = new Set(['README.md', 'index.md', 'log.md', 'projectOverview.md', 'crossAppContracts.md']);

/** Pure decision: allow | warn | block. */
function decideStop({ mode, warm, crossAppMutation, memoryBankUpdated }) {
  if (!crossAppMutation || memoryBankUpdated) return 'allow';
  if (mode === 'warn') return 'warn';
  if (mode === 'block') return 'block';
  return warm ? 'block' : 'warn'; // auto
}

/** Pure: warm when pages OR sessions cross their thresholds. */
function isWarm({ pages, sessions, warmPages, warmSessions }) {
  return pages > warmPages || sessions >= warmSessions;
}

/** Count real (non-seed) memory-bank .md pages, recursively. */
function countRealPages(mbDir) {
  let count = 0;
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md') && !SEED_PAGES.has(e.name)) count++;
    }
  }
  walk(mbDir);
  return count;
}

function readState(stateFile) {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return { sessions: 0 }; }
}

function writeState(stateFile, state) {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state));
  } catch { /* best effort */ }
}

function main() {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
  if (input.stop_hook_active) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const mbDir = path.join(projectDir, 'memory-bank');
  if (!fs.existsSync(mbDir)) process.exit(0);

  const configFile = path.join(projectDir, '.claude', 'agentspace-hook.json');
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch { process.exit(0); }
  const subRepos = Array.isArray(cfg.subRepos) ? cfg.subRepos : [];

  // Count this session (every Stop on a configured workspace).
  const stateFile = path.join(projectDir, '.agentspace', 'state.json');
  const state = readState(stateFile);
  state.sessions = (state.sessions || 0) + 1;
  writeState(stateFile, state);

  // Inspect the transcript for mutating tool uses.
  let mutationCount = 0;
  const touched = new Set();
  let memoryBankUpdated = false;
  const tp = input.transcript_path;
  if (tp && fs.existsSync(tp)) {
    for (const line of fs.readFileSync(tp, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let evt; try { evt = JSON.parse(line); } catch { continue; }
      const content = evt && evt.message && evt.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!block || block.type !== 'tool_use' || !MUTATING_TOOLS.has(block.name)) continue;
        mutationCount++;
        const raw = (block.input && (block.input.file_path || block.input.notebook_path)) || '';
        const rel = raw.startsWith(projectDir) ? raw.slice(projectDir.length + 1) : raw;
        if (rel.startsWith('memory-bank/')) memoryBankUpdated = true;
        for (const sub of subRepos) { if (rel.startsWith(sub + '/')) { touched.add(sub); break; } }
      }
    }
  }

  const crossAppMutation = mutationCount > 0 && touched.size >= 2;
  const warm = isWarm({
    pages: countRealPages(mbDir),
    sessions: state.sessions,
    warmPages: cfg.warmPages,
    warmSessions: cfg.warmSessions,
  });
  const decision = decideStop({ mode: cfg.mode, warm, crossAppMutation, memoryBankUpdated });

  if (decision === 'allow') process.exit(0);

  const list = [...touched].sort().join(', ');
  const reason = [
    `Cross-repo activity detected (${list}) — update the memory bank before ending.`,
    '1. Refresh memory-bank/01-active/currentWork.md (date + status).',
    '2. Append one line to memory-bank/log.md: `## [YYYY-MM-DD] <action> | <slug>`.',
    '3. If a cross-repo contract was touched, record it in memory-bank/00-core/crossAppContracts.md (cite `file:line`).',
  ].join('\n');

  if (decision === 'block') {
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  } else {
    // warn: surface a note but allow the stop.
    process.stdout.write(JSON.stringify({ systemMessage: reason }));
  }
  process.exit(0);
}

if (require.main === module) {
  main();
} else {
  module.exports = { decideStop, isWarm, countRealPages, readState, writeState };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/hook.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add assets/memory-bank-stop.cjs test/hook.test.ts
git commit -m "feat: static Stop hook asset with pure tested decision logic"
```

---

### Task 9: claude-code adapter

**Files:**
- Create: `src/adapters/claudeCode.ts`
- Test: `test/adapter.test.ts`

- [ ] **Step 1: Write the failing test `test/adapter.test.ts`**

```ts
import { expect, test } from "vitest";
import { claudeCodeAdapter } from "../src/adapters/claudeCode";
import { generateEnforcementIntents } from "../src/generators/enforcement";
import type { EnforcementContext } from "../src/types";

const ctx: EnforcementContext = {
  workspaceName: "cork",
  shape: "one-product",
  contractLinked: true,
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: null, stack: "nextjs", role: "frontend" },
  ],
  config: { mode: "auto", warmPages: 5, warmSessions: 10 },
  folders: ["00-core", "04-business"],
};

test("emits agents, commands, hook, sidecar, settings", () => {
  const files = claudeCodeAdapter(generateEnforcementIntents(ctx), ctx);
  const paths = files.map((f) => f.path);
  expect(paths).toContain(".claude/agents/api-engineer.md");
  expect(paths).toContain(".claude/agents/cross-app-reviewer.md");
  expect(paths).toContain(".claude/commands/ingest.md");
  expect(paths).toContain(".claude/hooks/memory-bank-stop.cjs");
  expect(paths).toContain(".claude/agentspace-hook.json");
  expect(paths).toContain(".claude/settings.json");
});

test("rails engineer agent is rendered from the rails stack with injected boundary", () => {
  const files = claudeCodeAdapter(generateEnforcementIntents(ctx), ctx);
  const agent = files.find((f) => f.path === ".claude/agents/api-engineer.md")!.contents;
  expect(agent).toContain("name: api-engineer");
  expect(agent).toContain("Rails engineer");
  expect(agent).toContain("api/"); // boundary injected
  expect(agent).not.toContain("{{"); // no unresolved placeholders
});

test("reviewer agent has no Write tool", () => {
  const files = claudeCodeAdapter(generateEnforcementIntents(ctx), ctx);
  const reviewer = files.find((f) => f.path === ".claude/agents/cross-app-reviewer.md")!.contents;
  expect(reviewer).toMatch(/tools: Read, Grep, Glob, Bash/);
});

test("sidecar carries the hook config; settings wires the hook", () => {
  const files = claudeCodeAdapter(generateEnforcementIntents(ctx), ctx);
  const sidecar = JSON.parse(files.find((f) => f.path === ".claude/agentspace-hook.json")!.contents);
  expect(sidecar.subRepos).toEqual(["api", "web"]);
  expect(sidecar.mode).toBe("auto");
  const settings = JSON.parse(files.find((f) => f.path === ".claude/settings.json")!.contents);
  expect(JSON.stringify(settings)).toContain("memory-bank-stop.cjs");
});

test("non-contract shape: no hook, sidecar, reviewer, or settings", () => {
  const single = { ...ctx, shape: "single-repo" as const, contractLinked: false, repos: [ctx.repos[0]] };
  const files = claudeCodeAdapter(generateEnforcementIntents(single), single);
  const paths = files.map((f) => f.path);
  expect(paths).toContain(".claude/agents/api-engineer.md");
  expect(paths.some((p) => p.includes("hooks/"))).toBe(false);
  expect(paths).not.toContain(".claude/agentspace-hook.json");
  expect(paths).not.toContain(".claude/settings.json");
  expect(paths.some((p) => p.includes("cross-app-reviewer"))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/adapter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/adapters/claudeCode.ts`**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../renderer/render";
import { REVIEWER_AGENT } from "../templates/agents";
import { loadStackBody } from "../stackAgents/loader";
import { packageDir } from "../paths";
import type {
  AgentDefinition,
  EnforcementContext,
  EnforcementIntents,
  GeneratedFile,
} from "../types";

const HOOK_ASSET = "memory-bank-stop.cjs";

function renderAgent(agent: AgentDefinition, workspaceName: string): string {
  if (agent.isReviewer) {
    return render(REVIEWER_AGENT, { workspaceName });
  }
  const body = loadStackBody(agent.stack);
  return render(body, {
    repoName: agent.repoDir,
    repoDir: agent.repoDir,
    role: agent.role,
    boundaryRule: agent.boundaryRule,
  });
}

export function claudeCodeAdapter(
  intents: EnforcementIntents,
  ctx: EnforcementContext,
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  for (const agent of intents.agents) {
    files.push({
      path: `.claude/agents/${agent.name}.md`,
      contents: renderAgent(agent, ctx.workspaceName),
    });
  }

  for (const cmd of intents.commands) {
    files.push({ path: `.claude/commands/${cmd.name}.md`, contents: cmd.body });
  }

  if (intents.hook) {
    const hookSource = readFileSync(join(packageDir("assets"), HOOK_ASSET), "utf8");
    files.push({ path: `.claude/hooks/${HOOK_ASSET}`, contents: hookSource });
    files.push({
      path: ".claude/agentspace-hook.json",
      contents: JSON.stringify(
        {
          mode: intents.hook.mode,
          warmPages: intents.hook.warmPages,
          warmSessions: intents.hook.warmSessions,
          subRepos: intents.hook.subRepos,
        },
        null,
        2,
      ) + "\n",
    });
    files.push({
      path: ".claude/settings.json",
      contents: JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                matcher: "*",
                hooks: [
                  {
                    type: "command",
                    command: `node "$CLAUDE_PROJECT_DIR/.claude/hooks/${HOOK_ASSET}"`,
                    timeout: 10,
                    statusMessage: "Checking memory bank...",
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ) + "\n",
    });
  }

  return files;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/adapter.test.ts && npm run typecheck`
Expected: PASS (5 tests); clean.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/adapters/claudeCode.ts test/adapter.test.ts
git commit -m "feat: claude-code adapter (intents -> .claude pack)"
```

---

### Task 10: Manifest generator updates

**Files:**
- Modify: `src/templates/manifest.ts`, `src/generators/manifest.ts`
- Test: `test/generators.manifest.test.ts` (extend)

- [ ] **Step 1: Add failing assertions to `test/generators.manifest.test.ts`**

```ts
test("emits enforcement block and ignores state file when enforcement set", () => {
  const files = generateManifest({
    ...ctx,
    contractLinked: true,
    enforcement: { mode: "auto", warmPages: 5, warmSessions: 10 },
  });
  const yaml = files.find((f) => f.path === "manifest.yaml")!.contents;
  expect(yaml).toContain("enforcement:");
  expect(yaml).toContain("mode: auto");
  const ignore = files.find((f) => f.path === ".gitignore")!.contents;
  expect(ignore).toContain(".agentspace/state.json");
});

test("contract-linked CLAUDE.md includes the parallel-agents section", () => {
  const files = generateManifest({ ...ctx, contractLinked: true, enforcement: { mode: "auto", warmPages: 5, warmSessions: 10 } });
  const claude = files.find((f) => f.path === "CLAUDE.md")!.contents;
  expect(claude).toContain("Parallel agents");
});

test("no enforcement block when enforcement is null", () => {
  const yaml = generateManifest({ ...ctx, contractLinked: false, enforcement: null })
    .find((f) => f.path === "manifest.yaml")!.contents;
  expect(yaml).not.toContain("enforcement:");
});
```

The existing `ctx` in that file is a `ManifestContext`; add `contractLinked: false` and `enforcement: null` to it so the prior tests still compile.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/generators.manifest.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/templates/manifest.ts`**

Append an enforcement section to `MANIFEST_YAML` (after the repos loop):

```ts
// add to MANIFEST_YAML, after the {{/repos}} block:
`{{#enforcement}}
enforcement:
  mode: {{mode}}
  warmPages: {{warmPages}}
  warmSessions: {{warmSessions}}
{{/enforcement}}`
```

Concretely, change the `MANIFEST_YAML` export so its end is:

```ts
{{/repos}}{{#enforcement}}enforcement:
  mode: {{enforcement.mode}}
  warmPages: {{enforcement.warmPages}}
  warmSessions: {{enforcement.warmSessions}}
{{/enforcement}}`;
```

Add `.agentspace/state.json` to `GITIGNORE` (conditional on enforcement):

```ts
// in GITIGNORE, after the repo loop and before settings.local.json:
{{#enforcement}}.agentspace/state.json
{{/enforcement}}
```

Add a parallel-agents block to `ROOT_CLAUDE` (conditional on contractLinked):

```ts
// append to ROOT_CLAUDE:
{{#parallelAgents}}

## Parallel agents

For features spanning repos, work in dependency order. One git worktree per
repo; dispatch that repo's \`<repo>-engineer\` agent in each; finish with the
\`cross-app-reviewer\` on the combined diff. Two parallel agents is comfortable;
cap around 3–5 before human review becomes the bottleneck.
{{/parallelAgents}}
```

- [ ] **Step 4: Update `src/generators/manifest.ts`**

Extend the `view` with the new conditionals:

```ts
  const view = {
    workspaceName: ctx.workspaceName,
    shape: ctx.shape,
    repoCount: ctx.repos.length,
    repos,
    enforcement: ctx.enforcement, // mustache section: truthy object renders the block
    parallelAgents: ctx.contractLinked && ctx.repos.length > 1,
  };
```

(`ctx.enforcement` being `null` makes the `{{#enforcement}}` section render nothing; being an object exposes `.mode` etc.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/generators.manifest.test.ts && npm run typecheck`
Expected: PASS; clean.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/templates/manifest.ts src/generators/manifest.ts test/generators.manifest.test.ts
git commit -m "feat: manifest emits enforcement block, state ignore, parallel-agents note"
```

---

### Task 11: Wire enforcement into init

**Files:**
- Modify: `src/commands/init.ts`
- Test: `test/init.test.ts` (extend)

- [ ] **Step 1: Add failing assertions to `test/init.test.ts`**

```ts
test("enforcement pillar emits the .claude pack", () => {
  const files = generateWorkspace(
    {
      ...config,
      pillars: ["manifest", "wiki", "enforcement"],
      enforcement: { mode: "auto", warmPages: 5, warmSessions: 10 },
    },
    "2026-06-05",
  );
  const paths = files.map((f) => f.path);
  expect(paths).toContain(".claude/agents/api-engineer.md");
  expect(paths).toContain(".claude/hooks/memory-bank-stop.cjs");
  expect(paths).toContain(".claude/commands/lint.md");
});

test("no .claude pack when enforcement not selected", () => {
  const files = generateWorkspace({ ...config, enforcement: null }, "2026-06-05");
  expect(files.some((f) => f.path.startsWith(".claude/"))).toBe(false);
});
```

(Add `enforcement: null` to the file's existing `config` literal so prior tests compile; rename its repo to `api` if needed so the path assertion matches — or assert on the actual first repo name.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/init.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/commands/init.ts`**

Add imports:

```ts
import { generateEnforcementIntents } from "../generators/enforcement";
import { claudeCodeAdapter } from "../adapters/claudeCode";
```

In `generateWorkspace`, after the wiki block:

```ts
  if (config.pillars.includes("enforcement") && ctx.enforcement) {
    const intents = generateEnforcementIntents(ctx.enforcement);
    files.push(...claudeCodeAdapter(intents, ctx.enforcement));
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/init.test.ts && npm run typecheck`
Expected: PASS; clean.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/commands/init.ts test/init.test.ts
git commit -m "feat: wire enforcement pillar into generateWorkspace"
```

---

### Task 12: `doctor --lint` machine-readable output

**Files:**
- Modify: `src/cli.ts`, `src/commands/doctor.ts`
- Test: `test/cli.test.ts`, `test/doctor.test.ts` (extend)

- [ ] **Step 1: Add failing assertions**

To `test/cli.test.ts`:

```ts
test("parses doctor --lint", () => {
  expect(parseArgs(["doctor", "--lint"])).toEqual({ command: "doctor", force: false, lint: true });
});

test("doctor without --lint has lint:false", () => {
  expect(parseArgs(["doctor"])).toEqual({ command: "doctor", force: false, lint: false });
});
```

To `test/doctor.test.ts` (the `runChecks` already returns findings; add a formatting test):

```ts
import { formatLintJson } from "../src/commands/doctor";

test("formatLintJson emits a findings document", () => {
  const out = formatLintJson([{ level: "warn", message: "x too big" }]);
  expect(JSON.parse(out)).toEqual({ findings: [{ level: "warn", message: "x too big" }] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/cli.test.ts test/doctor.test.ts`
Expected: FAIL (lint field missing; `formatLintJson` not exported).

- [ ] **Step 3: Update `src/cli.ts`**

Add `lint: boolean;` to `ParsedArgs`. In `parseArgs`, compute `const lint = argv.includes("--lint");` and include `lint` in every returned object (e.g. `return { command: "doctor", force, lint };`, and `lint: false` semantics fall out naturally since `lint` is computed from argv for all). Simplest: compute `lint` once and spread it into each return. Update the `doctor` dispatch in `main`:

```ts
    case "doctor":
      return doctorCommand(process.cwd(), todayIso(), { lint: args.lint });
```

- [ ] **Step 4: Update `src/commands/doctor.ts`**

Add the formatter and extend `doctorCommand`:

```ts
export function formatLintJson(findings: DoctorFinding[]): string {
  return JSON.stringify({ findings });
}

export async function doctorCommand(
  workspaceDir: string,
  today: string,
  opts: { lint?: boolean } = {},
): Promise<number> {
  const findings = await runChecks(workspaceDir, today);
  if (opts.lint) {
    console.log(formatLintJson(findings));
  } else {
    for (const f of findings) {
      const tag = f.level === "error" ? "✗" : f.level === "warn" ? "!" : "·";
      console.log(`${tag} ${f.message}`);
    }
  }
  return findings.some((f) => f.level === "error") ? 1 : 0;
}
```

- [ ] **Step 5: Run tests + build smoke**

Run:
```bash
cd /Volumes/externalssd/agentspace && npx vitest run test/cli.test.ts test/doctor.test.ts && npm run build
node dist/cli.js doctor --lint 2>/dev/null || true
```
Expected: tests PASS; `doctor --lint` in a non-workspace prints a JSON `{"findings":[...]}` with the missing-manifest error.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/cli.ts src/commands/doctor.ts test/cli.test.ts test/doctor.test.ts
git commit -m "feat: doctor --lint machine-readable output"
```

---

### Task 13: Multi-shape enforcement fixtures + parity

**Files:**
- Modify: `test/fixtures/shapes.ts`, `test/parity.test.ts`

- [ ] **Step 1: Add enforcement to fixtures in `test/fixtures/shapes.ts`**

Add `enforcement: null` to every existing fixture (so they typecheck against the new `WorkspaceConfig`). Then add two enforcement fixtures:

```ts
export const oneProductEnforced: WorkspaceConfig = {
  ...oneProduct,
  pillars: ["manifest", "wiki", "enforcement"],
  enforcement: { mode: "auto", warmPages: 5, warmSessions: 10 },
};

export const singleRepoEnforced: WorkspaceConfig = {
  ...singleRepo,
  pillars: ["manifest", "wiki", "enforcement"],
  enforcement: { mode: "auto", warmPages: 5, warmSessions: 10 },
};
```

- [ ] **Step 2: Add failing assertions to `test/parity.test.ts`**

```ts
import { oneProductEnforced, singleRepoEnforced } from "./fixtures/shapes";

test("one-product enforced: full .claude pack incl. hook + reviewer", () => {
  const paths = at(generateWorkspace(oneProductEnforced, "2026-06-05"));
  expect(paths).toContain(".claude/agents/cross-app-reviewer.md");
  expect(paths).toContain(".claude/hooks/memory-bank-stop.cjs");
  expect(paths).toContain(".claude/agentspace-hook.json");
});

test("single-repo enforced: agents but NO hook or reviewer", () => {
  const paths = at(generateWorkspace(singleRepoEnforced, "2026-06-05"));
  expect(paths.some((p) => p.startsWith(".claude/agents/"))).toBe(true);
  expect(paths.some((p) => p.includes("hooks/"))).toBe(false);
  expect(paths.some((p) => p.includes("cross-app-reviewer"))).toBe(false);
});

test("enforced output has no unresolved mustache artifacts", () => {
  for (const f of generateWorkspace(oneProductEnforced, "2026-06-05")) {
    expect(f.contents.includes("{{")).toBe(false);
  }
});
```

- [ ] **Step 3: Run tests**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/parity.test.ts`
Expected: PASS. If the no-`{{` test fails, the offending template has an unresolved placeholder — fix the template, not the test.

- [ ] **Step 4: Run the FULL suite + typecheck + build**

Run: `cd /Volumes/externalssd/agentspace && npm run typecheck && npm test && npm run build`
Expected: all tests pass; typecheck clean; build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add test/fixtures/shapes.ts test/parity.test.ts
git commit -m "test: enforcement multi-shape parity fixtures"
```

---

### Task 14: Docs + final verification

**Files:**
- Modify: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`

- [ ] **Step 1: Update `README.md`** — flip the roadmap table: change the "Agents + enforcement" pillar status from `🚧 roadmap` to `✅ v0.2`, and under "What `init` generates today" add a bullet:

```markdown
- (enforcement pillar, opt-in) a `.claude/` pack: per-repo boundary-enforced
  agents, `/ingest` `/query` `/lint` commands, a warm-until-warm Stop hook, and
  a cross-app reviewer (contract-linked shapes).
```

- [ ] **Step 2: Update `CONTRIBUTING.md`** — in the "per-stack agent library" section, change "Once the enforcement pillar lands" wording to present tense and confirm the path is `stack-agents/<id>.md` + a `stacks.yaml` row, matching the shipped library.

- [ ] **Step 3: Update `CHANGELOG.md`** — under `## [Unreleased]` → `### Added`, append:

```markdown
- **Enforcement pillar (opt-in):** generates a Claude Code `.claude/` pack —
  per-repo boundary-enforced agents from a stack-agent library, `/ingest`
  `/query` `/lint` commands, a warm-until-warm Stop hook (`.cjs`), and a
  cross-app reviewer; shape-gated (hook + reviewer only for contract-linked
  workspaces). `agentspace doctor --lint` emits machine-readable findings.
```

- [ ] **Step 4: Final verification**

Run: `cd /Volumes/externalssd/agentspace && npm run typecheck && npm test && npm run build`
Expected: typecheck clean, all tests pass, build succeeds.

- [ ] **Step 5: End-to-end smoke — generate an enforced workspace and inspect**

Run a throwaway node check that the published `dist` + assets resolve correctly:
```bash
cd /Volumes/externalssd/agentspace && npm run build
node -e "import('./dist/cli.js')" 2>/dev/null || true   # bundle loads
ls assets/memory-bank-stop.cjs stack-agents/stacks.yaml  # shipped assets present
```
Expected: the asset files exist. (Generation itself is proven by the passing init/parity tests, which exercise `generateWorkspace` with the enforcement pillar against the real asset files.)

- [ ] **Step 6: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add README.md CONTRIBUTING.md CHANGELOG.md
git commit -m "docs: enforcement pillar shipped (README, CONTRIBUTING, CHANGELOG)"
```

---

## Self-Review (completed during authoring)

**Spec coverage:**
- Wizard opt-in + `manifest.yaml` enforcement block → Tasks 2, 10. ✓
- Intent seam (`AgentDefinition`/`CommandDef`/`HookRule`) + adapter → Tasks 1, 7, 9. ✓
- Stop hook: static `.cjs`, hybrid warm, pure `decideStop`, shape-gated → Task 8 (logic), 7 (gating), 9 (emission). ✓
- Sidecar config (`.claude/agentspace-hook.json`) reconciling "single source" with a dep-free hook → Tasks 9, 8. ✓ (refinement of spec decision #2; manifest stays human source, sidecar is its projection)
- Stack-agent library: loose `.md`, 6 stacks + generic, loader, resolution → Tasks 4, 5. ✓
- Agents `<repo>-engineer.md`, generic body + project-specifics TODO, per-role tools → Tasks 4, 7, 9. ✓
- Commands ported & generalized, `/lint` → `doctor --lint` bridge → Tasks 6, 12. ✓
- Parallel-agents note in root `CLAUDE.md` (contract-linked) → Task 10. ✓
- `doctor --lint` machine-readable → Task 12. ✓
- Shape gating throughout (agents always; hook + reviewer only contract-linked) → Tasks 7, 9, 13. ✓
- Multi-shape fixtures asserting absence where unwarranted → Task 13. ✓

**Deviations from the spec (deliberate, noted):**
- Hook reads a `.claude/agentspace-hook.json` **sidecar** (dep-free JSON), not `manifest.yaml` directly, because a standalone hook can't robustly parse YAML. The manifest block remains the human source of truth; the adapter projects it. Hook ships as `.cjs` (not `.js`) for CJS-correctness in any workspace + direct unit-testability.
- Stack-`.md`↔registry integrity is enforced by a **unit test** (Task 4) rather than the user-facing `doctor`, since it validates the agentspace package, not a user workspace.

**Placeholder scan:** none — every step has runnable code or an exact command. The `## Project specifics (fill me in)` block is a generated-artifact feature, not a plan placeholder.

**Type consistency:** `EnforcementConfig`, `AgentDefinition`, `CommandDef`, `HookRule`, `EnforcementIntents`, `EnforcementContext`, `generateEnforcementIntents(ctx)`, `claudeCodeAdapter(intents, ctx)`, `resolveStackId`/`loadStackBody`/`engineerToolList`, `decideStop`/`isWarm`, `formatLintJson`, `ParsedArgs.lint` are defined once and used consistently across tasks. The hook asset is `memory-bank-stop.cjs` everywhere (Tasks 8, 9, 11, 13).
