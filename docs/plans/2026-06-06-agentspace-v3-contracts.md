# agentspace v3 — Contracts Pillar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the opt-in contracts pillar to `agentspace init` — a pure generator that scaffolds a shape-aware `openspec/` structure (a generalized `project.md` + empty `specs/`/`changes/`), shape-gated to contract-linked workspaces, plus a `doctor` openspec-presence check and the `doctor --lint` clean-findings fix.

**Architecture:** Follows the v1/v2 patterns — a pure `generateContracts(ctx)` returns `GeneratedFile[]` (returns `[]` when the shape isn't contract-linked), templates as TS string constants rendered with mustache, `writeTree` as the only writer. agentspace **scaffolds and delegates**: it generates the `openspec/` files but does NOT shell out; the `/opsx:*` slash commands come from the user's external `openspec` CLI (`openspec update`), and `doctor` only *warns* if that CLI is absent. A `hasContracts` flag is threaded into the wiki + manifest contexts for cross-pillar wiring.

**Tech Stack:** TypeScript (ESM, Node 18+), vitest, mustache — same as v1/v2.

**Builds on:** the merged v1 core + v2 enforcement pillar. All paths under `/Volumes/externalssd/agentspace`. Shell cwd may reset between bash calls — `cd` each time. Create branch `feat/v3-contracts` before Task 1.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/types.ts` (modify) | Add `ContractsContext`; extend `WorkspaceContext` (`contracts`), `WikiContext` (`hasContracts`), `ManifestContext` (`hasContracts`) |
| `src/context/build.ts` (modify) | Build `ContractsContext`; thread `hasContracts` into wiki + manifest slices |
| `src/wizard/{assemble,run}.ts` (modify) | `enableContracts` answer → `"contracts"` pillar |
| `src/templates/contracts.ts` (create) | `PROJECT_MD`, `OPENSPEC_README` templates |
| `src/generators/contracts.ts` (create) | `generateContracts(ctx)` → `GeneratedFile[]` |
| `src/openspec.ts` (create) | `openspecAvailable()` — PATH probe for the openspec CLI (mockable) |
| `src/commands/init.ts` (modify) | Wire contracts pillar into `generateWorkspace`; post-init note |
| `src/commands/doctor.ts` (modify) | openspec-presence warn; `--lint` clean → `{"findings":[]}` |
| `src/templates/manifest.ts`, `src/generators/manifest.ts` (modify) | `hasContracts` → CLAUDE.md openspec pointer |
| `src/templates/memoryBank.ts`, `src/generators/memoryBank.ts` (modify) | `hasContracts` → crossAppContracts citation line |
| `test/**` | One test file per module |

---

### Task 1: Types + context slice

**Files:**
- Modify: `src/types.ts`, `src/context/build.ts`
- Test: `test/context.test.ts` (extend)

- [ ] **Step 1: Append to `src/types.ts`**

```ts
export interface ContractsContext {
  workspaceName: string;
  shape: WorkspaceShape;
  contractLinked: boolean;
  repos: RepoInput[];
  dependencyOrder: string[] | null;
  hasWiki: boolean;
}
```

Extend `WorkspaceContext` with:

```ts
  contracts: ContractsContext | null;
```

Add to `WikiContext`:

```ts
  hasContracts: boolean;
```

Add to `ManifestContext`:

```ts
  hasContracts: boolean;
```

- [ ] **Step 2: Add failing assertions to `test/context.test.ts`**

```ts
test("contracts context present + hasContracts threaded when pillar selected on contract-linked shape", () => {
  const ctx = buildContext(
    { ...config, pillars: ["manifest", "wiki", "contracts"], enforcement: null },
    "2026-06-06",
  );
  expect(ctx.contracts).not.toBeNull();
  expect(ctx.contracts!.contractLinked).toBe(true);
  expect(ctx.wiki.hasContracts).toBe(true);
  expect(ctx.manifest.hasContracts).toBe(true);
});

test("no contracts context + hasContracts false when pillar absent", () => {
  const ctx = buildContext({ ...config, pillars: ["manifest", "wiki"] }, "2026-06-06");
  expect(ctx.contracts).toBeNull();
  expect(ctx.wiki.hasContracts).toBe(false);
  expect(ctx.manifest.hasContracts).toBe(false);
});

test("hasContracts false on a non-contract shape even if pillar selected", () => {
  const ctx = buildContext(
    { ...config, shape: "single-repo", repos: [config.repos[0]], dependencyOrder: null, pillars: ["manifest", "contracts"] },
    "2026-06-06",
  );
  expect(ctx.wiki.hasContracts).toBe(false);
});
```

(`config` in this file already carries `enforcement: null` from v2; keep it.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/context.test.ts`
Expected: FAIL — `ctx.contracts` undefined, `hasContracts` missing.

- [ ] **Step 4: Update `src/context/build.ts`**

At the top of `buildContext`, compute the flag (after the existing imports; `isContractLinked` is already imported):

```ts
  const pillars = config.pillars;
  const hasContracts = pillars.includes("contracts") && isContractLinked(config);
```

Add `hasContracts` to the `wiki` slice and the `manifest` slice (alongside their existing fields):

```ts
      hasContracts,
```

Add the top-level `contracts` slice:

```ts
    contracts: pillars.includes("contracts")
      ? {
          workspaceName: config.workspaceName,
          shape: config.shape,
          contractLinked: isContractLinked(config),
          repos: config.repos,
          dependencyOrder: config.dependencyOrder,
          hasWiki: pillars.includes("wiki"),
        }
      : null,
```

- [ ] **Step 5: Run test + typecheck**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/context.test.ts && npm run typecheck`
Expected: the context tests PASS, but typecheck will now FAIL in the manifest/memoryBank generators and their tests because `WikiContext`/`ManifestContext` gained a mandatory `hasContracts`. Fix those by adding `hasContracts: false` to the relevant test fixtures (`test/generators.manifest.test.ts` ctx, `test/generators.memoryBank.test.ts` ctx factory) and confirm the generators don't yet read it (they will in Task 5). Re-run `npm test && npm run typecheck` until clean.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/types.ts src/context/build.ts test/context.test.ts test/generators.manifest.test.ts test/generators.memoryBank.test.ts
git commit -m "feat: contracts context slice and hasContracts threading"
```

---

### Task 2: Wizard — contracts opt-in

**Files:**
- Modify: `src/wizard/assemble.ts`, `src/wizard/run.ts`
- Test: `test/assemble.test.ts` (extend)

- [ ] **Step 1: Add failing assertions to `test/assemble.test.ts`**

```ts
test("contracts pillar when enabled", () => {
  const cfg = assembleConfig({ ...answers, enableContracts: true });
  expect(cfg.pillars).toContain("contracts");
});

test("no contracts pillar when disabled", () => {
  const cfg = assembleConfig({ ...answers, enableContracts: false });
  expect(cfg.pillars).not.toContain("contracts");
});
```

(The existing `answers` literal will need `enableContracts` added — but the test above passes it via spread; also add `enableContracts: false` to the base `answers` object so the other tests still typecheck.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/assemble.test.ts`
Expected: FAIL — `enableContracts` not on `WizardAnswers`.

- [ ] **Step 3: Update `src/wizard/assemble.ts`**

Add `enableContracts: boolean;` to `WizardAnswers`. In `assembleConfig`, after the enforcement push:

```ts
  if (answers.enableContracts) pillars.push("contracts");
```

- [ ] **Step 4: Update `src/wizard/run.ts`**

After the `enableEnforcement` confirm, add:

```ts
  const enableContracts = await p.confirm({
    message: "Include the cross-repo contract layer (OpenSpec)?",
    initialValue: false,
  });
  cancel(enableContracts as unknown as string);
```

Pass `enableContracts: enableContracts === true` into the `assembleConfig({...})` call.

- [ ] **Step 5: Run tests + typecheck**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/assemble.test.ts && npm run typecheck`
Expected: PASS; clean.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/wizard/assemble.ts src/wizard/run.ts test/assemble.test.ts
git commit -m "feat: wizard contracts pillar opt-in"
```

---

### Task 3: Contracts templates + generator

**Files:**
- Create: `src/templates/contracts.ts`, `src/generators/contracts.ts`
- Test: `test/contracts.test.ts`

- [ ] **Step 1: Create `src/templates/contracts.ts`**

```ts
export const PROJECT_MD = `# Project Context — {{workspaceName}} (cross-repo contracts)

> **Scope:** this OpenSpec instance covers **cross-repo contracts only** — things
> consumed by more than one repo in this workspace. Per-repo internals do not
> belong here; they stay in that repo.

## Repos
| Repo | Role |
|---|---|
{{#repos}}| \`{{name}}/\` | {{role}} |
{{/repos}}

## What belongs in \`specs/\`
A capability lives here only if it's a contract **between** repos:
- HTTP endpoints consumed by another repo
- Shared data shapes / payloads
- Auth flows
- Webhook payloads that cross repos
- Cross-repo events

It does **not** belong here if it only describes the inside of one repo.

## What belongs in \`changes/\`
Any proposal that mutates a cross-repo contract, before implementation (adding a
field consumers read, changing an auth response, deprecating an endpoint).
{{#hasOrder}}Each change names the affected repos and orders tasks in
**dependency order: {{#order}}{{.}} → {{/order}}done**. The producer defines the
contract; consumers follow.{{/hasOrder}}{{^hasOrder}}These repos are **peers** with
no global dependency order — each change names the affected repos and the contract
between them.{{/hasOrder}}

## Working with this instance
The \`/opsx:*\` slash commands are installed by the external **\`openspec\` CLI** —
run \`openspec update\` in this workspace to install them. CLI: \`openspec list\`,
\`openspec validate\`, \`openspec show <name>\`, \`openspec view\`.

| Command | Purpose |
|---|---|
| \`/opsx:propose <idea>\` | Scaffold \`changes/<name>/{proposal,design,tasks}.md\` |
| \`/opsx:apply <name>\` | Implement a change task-by-task |
| \`/opsx:archive <name>\` | Fold a shipped change into \`specs/\` (archive on deploy) |

## Relationship to the memory bank
OpenSpec holds *what the contract is* (specs) and *what's changing* (proposals).
\`memory-bank/\` holds *why* (decisions, history).{{#hasWiki}} The wiki's
\`00-core/crossAppContracts.md\` should cite the matching
\`openspec/specs/<capability>/spec.md\`.{{/hasWiki}}
`;

export const OPENSPEC_README = `# openspec/ — {{workspaceName}} cross-repo contracts

Prescriptive contract layer for this workspace. Read \`project.md\` for scope and
lifecycle.

- \`specs/\` — current cross-repo capabilities (the truth).
- \`changes/\` — proposals in flight; \`changes/archive/\` — shipped.

The \`/opsx:*\` commands and validation come from the external **\`openspec\` CLI**.
Run \`openspec update\` to install the slash commands; \`openspec validate\` to check.
`;
```

- [ ] **Step 2: Write the failing test `test/contracts.test.ts`**

```ts
import { expect, test } from "vitest";
import { generateContracts } from "../src/generators/contracts";
import type { ContractsContext } from "../src/types";

function ctx(overrides: Partial<ContractsContext> = {}): ContractsContext {
  return {
    workspaceName: "cork",
    shape: "one-product",
    contractLinked: true,
    repos: [
      { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
      { name: "web", remote: null, stack: "nextjs", role: "frontend" },
    ],
    dependencyOrder: ["api", "web"],
    hasWiki: true,
    ...overrides,
  };
}

test("emits project.md, openspec README, and tracked empty dirs", () => {
  const paths = generateContracts(ctx()).map((f) => f.path).sort();
  expect(paths).toEqual(
    [
      "openspec/project.md",
      "openspec/README.md",
      "openspec/specs/.gitkeep",
      "openspec/changes/.gitkeep",
      "openspec/changes/archive/.gitkeep",
    ].sort(),
  );
});

test("project.md has the repo table and the dependency-order clause when ordered", () => {
  const md = generateContracts(ctx()).find((f) => f.path === "openspec/project.md")!.contents;
  expect(md).toContain("`api/`");
  expect(md).toContain("dependency order: api → web → done");
  expect(md).not.toContain("{{");
});

test("peer shape gets peer framing, not a dependency order", () => {
  const md = generateContracts(ctx({ shape: "peer-services", dependencyOrder: null }))
    .find((f) => f.path === "openspec/project.md")!.contents;
  expect(md).toContain("peers");
  expect(md).not.toContain("dependency order:");
});

test("hasWiki false drops the crossAppContracts citation line", () => {
  const md = generateContracts(ctx({ hasWiki: false }))
    .find((f) => f.path === "openspec/project.md")!.contents;
  expect(md).not.toContain("crossAppContracts.md");
});

test("returns [] when not contract-linked", () => {
  expect(generateContracts(ctx({ contractLinked: false }))).toEqual([]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/contracts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `src/generators/contracts.ts`**

```ts
import { render } from "../renderer/render";
import { OPENSPEC_README, PROJECT_MD } from "../templates/contracts";
import type { ContractsContext, GeneratedFile } from "../types";

export function generateContracts(ctx: ContractsContext): GeneratedFile[] {
  if (!ctx.contractLinked) return [];

  const view = {
    workspaceName: ctx.workspaceName,
    repos: ctx.repos,
    hasOrder: ctx.dependencyOrder !== null && ctx.dependencyOrder.length > 0,
    order: ctx.dependencyOrder ?? [],
    hasWiki: ctx.hasWiki,
  };

  return [
    { path: "openspec/project.md", contents: render(PROJECT_MD, view) },
    { path: "openspec/README.md", contents: render(OPENSPEC_README, view) },
    { path: "openspec/specs/.gitkeep", contents: "" },
    { path: "openspec/changes/.gitkeep", contents: "" },
    { path: "openspec/changes/archive/.gitkeep", contents: "" },
  ];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/contracts.test.ts && npm run typecheck`
Expected: PASS (5 tests); clean.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/templates/contracts.ts src/generators/contracts.ts test/contracts.test.ts
git commit -m "feat: contracts generator scaffolds shape-aware openspec/"
```

---

### Task 4: Wire contracts into init + post-init note

**Files:**
- Modify: `src/commands/init.ts`
- Test: `test/init.test.ts` (extend)

- [ ] **Step 1: Add failing assertions to `test/init.test.ts`**

```ts
test("contracts pillar emits openspec/ for a contract-linked shape", () => {
  const files = generateWorkspace(
    { ...config, pillars: ["manifest", "wiki", "contracts"], enforcement: null },
    "2026-06-06",
  );
  const paths = files.map((f) => f.path);
  expect(paths).toContain("openspec/project.md");
  expect(paths).toContain("openspec/changes/archive/.gitkeep");
});

test("contracts pillar emits nothing for a single-repo shape", () => {
  const files = generateWorkspace(
    { ...config, shape: "single-repo", repos: [config.repos[0]], dependencyOrder: null, pillars: ["manifest", "contracts"], enforcement: null },
    "2026-06-06",
  );
  expect(files.some((f) => f.path.startsWith("openspec/"))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/init.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/commands/init.ts`**

Add the import:

```ts
import { generateContracts } from "../generators/contracts";
```

In `generateWorkspace`, after the enforcement block:

```ts
  if (config.pillars.includes("contracts") && ctx.contracts) {
    files.push(...generateContracts(ctx.contracts));
  }
```

In `initCommand`, after the success line, add the post-init note (only when contracts was selected and produced files):

```ts
  if (config.pillars.includes("contracts")) {
    console.log(
      "  Contracts: run `openspec update` to install the /opsx:* commands (install the openspec CLI first if needed).",
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/init.test.ts && npm run typecheck`
Expected: PASS; clean.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/commands/init.ts test/init.test.ts
git commit -m "feat: wire contracts pillar into generateWorkspace + post-init note"
```

---

### Task 5: Cross-pillar wiring (CLAUDE.md pointer + crossAppContracts citation)

**Files:**
- Modify: `src/templates/manifest.ts`, `src/generators/manifest.ts`, `src/templates/memoryBank.ts`, `src/generators/memoryBank.ts`
- Test: `test/generators.manifest.test.ts`, `test/generators.memoryBank.test.ts` (extend)

- [ ] **Step 1: Add failing assertions**

To `test/generators.manifest.test.ts`:

```ts
test("CLAUDE.md points at openspec/project.md when hasContracts", () => {
  const claude = generateManifest({ ...ctx, contractLinked: true, hasContracts: true })
    .find((f) => f.path === "CLAUDE.md")!.contents;
  expect(claude).toContain("openspec/project.md");
});

test("CLAUDE.md has no openspec pointer when hasContracts false", () => {
  const claude = generateManifest({ ...ctx, hasContracts: false })
    .find((f) => f.path === "CLAUDE.md")!.contents;
  expect(claude).not.toContain("openspec/project.md");
});
```

To `test/generators.memoryBank.test.ts`:

```ts
test("crossAppContracts cites openspec specs when hasContracts", () => {
  const stub = generateMemoryBank(ctx({ hasContracts: true })).find(
    (f) => f.path === "memory-bank/00-core/crossAppContracts.md",
  )!.contents;
  expect(stub).toContain("openspec/specs/");
});

test("crossAppContracts has no openspec citation when hasContracts false", () => {
  const stub = generateMemoryBank(ctx({ hasContracts: false })).find(
    (f) => f.path === "memory-bank/00-core/crossAppContracts.md",
  )!.contents;
  expect(stub).not.toContain("openspec/specs/");
});
```

(Add `hasContracts: false` to the `ctx` factory default in the memoryBank test and to the manifest test `ctx`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/generators.manifest.test.ts test/generators.memoryBank.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/templates/manifest.ts`** — append to `ROOT_CLAUDE`:

```ts
{{#hasContracts}}

## Cross-repo contracts

Before changing any API or shared shape across repos, read \`openspec/project.md\`
and propose the change there (\`/opsx:propose\`).
{{/hasContracts}}
```

- [ ] **Step 4: Update `src/generators/manifest.ts`** — add `hasContracts` to the `view`:

```ts
    hasContracts: ctx.hasContracts,
```

- [ ] **Step 5: Update `src/templates/memoryBank.ts`** — in `CROSS_APP_CONTRACTS`, add a conditional citation line after the banner:

```ts
{{#hasContracts}}> Cite the matching \`openspec/specs/<capability>/spec.md\` for each contract recorded here.
{{/hasContracts}}
```

- [ ] **Step 6: Update `src/generators/memoryBank.ts`** — add `hasContracts` to the `view`:

```ts
    hasContracts: ctx.hasContracts,
```

- [ ] **Step 7: Run tests + typecheck**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/generators.manifest.test.ts test/generators.memoryBank.test.ts && npm run typecheck`
Expected: PASS; clean.

- [ ] **Step 8: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/templates/manifest.ts src/generators/manifest.ts src/templates/memoryBank.ts src/generators/memoryBank.ts test/generators.manifest.test.ts test/generators.memoryBank.test.ts
git commit -m "feat: cross-pillar wiring for contracts (CLAUDE.md + crossAppContracts citation)"
```

---

### Task 6: doctor — openspec presence check + clean-findings fix

**Files:**
- Create: `src/openspec.ts`
- Modify: `src/commands/doctor.ts`
- Test: `test/doctor.test.ts` (extend)

- [ ] **Step 1: Create `src/openspec.ts`**

```ts
import { execSync } from "node:child_process";

/** True when the external `openspec` CLI is resolvable on PATH. */
export function openspecAvailable(): boolean {
  try {
    execSync("command -v openspec", { stdio: "ignore", shell: "/bin/sh" });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add failing assertions to `test/doctor.test.ts`**

```ts
test("warns when openspec/ exists but the openspec CLI is absent", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  await write("openspec/project.md", "# contracts\n");
  const findings = await runChecks(dir, "2026-06-06", { openspecAvailable: () => false });
  expect(findings.some((f) => f.level === "warn" && /openspec/i.test(f.message))).toBe(true);
});

test("no openspec warning when the CLI is present", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  await write("openspec/project.md", "# contracts\n");
  const findings = await runChecks(dir, "2026-06-06", { openspecAvailable: () => true });
  expect(findings.some((f) => /openspec/i.test(f.message))).toBe(false);
});

test("no openspec warning when there is no openspec/ dir", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  const findings = await runChecks(dir, "2026-06-06", { openspecAvailable: () => false });
  expect(findings.some((f) => /openspec/i.test(f.message))).toBe(false);
});

test("formatLintJson on a clean workspace yields empty findings", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  await write("memory-bank/00-core/projectOverview.md", "# o\n\n_Last verified: 2026-06-01_\n");
  const findings = await runChecks(dir, "2026-06-06", { openspecAvailable: () => true });
  expect(JSON.parse(formatLintJson(findings))).toEqual({ findings: [] });
});
```

Add `formatLintJson` to the import from `../src/commands/doctor` if not already there.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/doctor.test.ts`
Expected: FAIL — `runChecks` doesn't accept deps; clean workspace still emits the synthetic info row.

- [ ] **Step 4: Update `src/commands/doctor.ts`**

Add the import:

```ts
import { existsSync } from "node:fs";
import { openspecAvailable as realOpenspecAvailable } from "../openspec";
```

Change `runChecks` to accept an injectable dependency, add the openspec check, and **remove** the synthetic "No issues found." push:

```ts
export interface DoctorDeps {
  openspecAvailable?: () => boolean;
}

export async function runChecks(
  workspaceDir: string,
  today: string,
  deps: DoctorDeps = {},
): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];
  const isOpenspecAvailable = deps.openspecAvailable ?? realOpenspecAvailable;

  // ... keep the existing manifest + memory-bank checks unchanged ...

  // OpenSpec presence (only when a contract layer was scaffolded).
  if (existsSync(join(workspaceDir, "openspec")) && !isOpenspecAvailable()) {
    findings.push({
      level: "warn",
      message:
        "openspec/ is present but the `openspec` CLI was not found on PATH. Install it (https://github.com/Fission-AI/OpenSpec) and run `openspec update`.",
    });
  }

  return findings; // no synthetic "No issues found." row
}
```

Update `doctorCommand` so the human branch shows the friendly empty message but `--lint` stays pure:

```ts
export async function doctorCommand(
  workspaceDir: string,
  today: string,
  opts: { lint?: boolean } = {},
): Promise<number> {
  const findings = await runChecks(workspaceDir, today);
  if (opts.lint) {
    console.log(formatLintJson(findings));
  } else if (findings.length === 0) {
    console.log("· No issues found.");
  } else {
    for (const f of findings) {
      const tag = f.level === "error" ? "✗" : f.level === "warn" ? "!" : "·";
      console.log(`${tag} ${f.message}`);
    }
  }
  return findings.some((f) => f.level === "error") ? 1 : 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Volumes/externalssd/agentspace && npx vitest run test/doctor.test.ts && npm run typecheck`
Expected: PASS; clean. (If the old Plan 1 "clean workspace yields no errors" test asserted a non-empty findings array, update it to assert `findings.every((f) => f.level !== "error")` — it should already only check for absence of errors.)

- [ ] **Step 6: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add src/openspec.ts src/commands/doctor.ts test/doctor.test.ts
git commit -m "feat: doctor openspec-presence check and clean --lint findings"
```

---

### Task 7: Multi-shape contracts fixtures + parity

**Files:**
- Modify: `test/fixtures/shapes.ts`, `test/parity.test.ts`

- [ ] **Step 1: Add fixtures to `test/fixtures/shapes.ts`**

```ts
export const oneProductContracts: WorkspaceConfig = {
  ...oneProduct,
  pillars: ["manifest", "wiki", "contracts"],
  enforcement: null,
};

export const peerServicesContracts: WorkspaceConfig = {
  ...peerServices,
  pillars: ["manifest", "wiki", "contracts"],
  enforcement: null,
};

export const singleRepoContracts: WorkspaceConfig = {
  ...singleRepo,
  pillars: ["manifest", "wiki", "contracts"],
  enforcement: null,
};
```

- [ ] **Step 2: Add failing assertions to `test/parity.test.ts`**

```ts
import { oneProductContracts, peerServicesContracts, singleRepoContracts } from "./fixtures/shapes";

test("one-product contracts: emits openspec/ with project.md", () => {
  const paths = at(generateWorkspace(oneProductContracts, "2026-06-06"));
  expect(paths).toContain("openspec/project.md");
  expect(paths).toContain("openspec/changes/archive/.gitkeep");
});

test("peer-services contracts: openspec/ present, peer-framed (no dependency order clause)", () => {
  const md = generateWorkspace(peerServicesContracts, "2026-06-06")
    .find((f) => f.path === "openspec/project.md")!.contents;
  expect(md).toContain("peers");
  expect(md).not.toContain("dependency order:");
});

test("single-repo contracts: NO openspec/ (shape-suppressed)", () => {
  const paths = at(generateWorkspace(singleRepoContracts, "2026-06-06"));
  expect(paths.some((p) => p.startsWith("openspec/"))).toBe(false);
});

test("contracts output has no unresolved mustache artifacts", () => {
  for (const f of generateWorkspace(oneProductContracts, "2026-06-06")) {
    expect(f.contents.includes("{{")).toBe(false);
  }
});
```

- [ ] **Step 3: Run the suite + typecheck + build**

Run: `cd /Volumes/externalssd/agentspace && npm run typecheck && npm test && npm run build`
Expected: all PASS; clean; build OK. If the peer-services fixture lacks `dependencyOrder: null`, confirm `peerServices` already sets it (it does, from v1 Task 13).

- [ ] **Step 4: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add test/fixtures/shapes.ts test/parity.test.ts
git commit -m "test: contracts multi-shape parity fixtures"
```

---

### Task 8: Docs + final verification

**Files:**
- Modify: `README.md`, `CHANGELOG.md`

- [ ] **Step 1: Update `README.md`**

- Change the version line near the top from `**v0.2.**` to `**v0.3.**` and update its sentence to: "Workspace reconstruction, the memory-bank wiki, the enforcement pack, and the cross-repo contract layer all work today."
- In the four-pillars table, change the **Cross-app contracts** row status from `🚧 roadmap` to `✅ v0.3`.
- In "What `init` generates today" change the heading to `(v0.3)` and add a bullet:

```markdown
- (contracts pillar, opt-in) an `openspec/` cross-repo contract layer — a
  shape-aware `project.md` + `specs/`/`changes/`; the `/opsx:*` commands come
  from the external `openspec` CLI (`openspec update`).
```

- In the Roadmap section, delete the `**Contracts pillar**` bullet (it shipped); keep the "More tool adapters" bullet.

- [ ] **Step 2: Update `CHANGELOG.md`** — under `## [Unreleased]` → `### Added`, append:

```markdown
- **Contracts pillar (opt-in):** scaffolds a shape-aware `openspec/` cross-repo
  contract layer (`project.md` + empty `specs/`/`changes/`), shape-gated to
  contract-linked workspaces; `agentspace doctor` warns if the external
  `openspec` CLI is absent. agentspace scaffolds and delegates — the `/opsx:*`
  commands come from `openspec update`, not from agentspace.
```

And update the `### Notes` section: remove the "Contracts (OpenSpec) pillar is not yet implemented" line (all four pillars now ship).

- [ ] **Step 3: Final verification**

Run: `cd /Volumes/externalssd/agentspace && npm run typecheck && npm test && npm run build`
Expected: typecheck clean, all tests pass, build succeeds.

- [ ] **Step 4: End-to-end smoke**

Run:
```bash
cd /Volumes/externalssd/agentspace && npm run build
mkdir -p /tmp/agentspace-v3 && cd /tmp/agentspace-v3
echo "workspace: x" > manifest.yaml && mkdir -p openspec && echo "# c" > openspec/project.md
node /Volumes/externalssd/agentspace/dist/cli.js doctor 2>&1 | head -5
```
Expected: doctor runs; if the `openspec` CLI is installed it prints no openspec warning, otherwise it prints the openspec-missing warning. Clean up `/tmp/agentspace-v3` after.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/externalssd/agentspace
git add README.md CHANGELOG.md
git commit -m "docs: contracts pillar shipped (README, CHANGELOG)"
```

---

## Self-Review (completed during authoring)

**Spec coverage:**
- Scaffold + delegate (no subprocess; pure generator) → Task 3. ✓
- Opt-in wizard confirm → Task 2. ✓
- Shape gating (returns `[]` / suppressed for non-contract shapes) → Tasks 3, 4, 7. ✓
- Generalized `project.md` (repo table; dependency-order clause only when declared; peer framing) → Task 3. ✓
- `/opsx:*` delegated to the external CLI; documented in `project.md`/`README` → Task 3. ✓
- `doctor` openspec-presence warn (only when `openspec/` present; never error) → Task 6. ✓
- `doctor --lint` clean → `{"findings":[]}` → Task 6. ✓
- Cross-pillar wiring (CLAUDE.md pointer; crossAppContracts citation, both only when applicable) → Task 5. ✓
- `hasContracts` threaded into wiki + manifest contexts → Tasks 1, 5. ✓
- Multi-shape fixtures asserting absence where unwarranted → Task 7. ✓
- Post-init guidance → Task 4. ✓

**Placeholder scan:** none — every step has runnable code or an exact command. The `.gitkeep` empty files and the `{{#...}}` mustache sections are intended artifacts, not plan placeholders.

**Type consistency:** `ContractsContext` (with `hasWiki`), `WorkspaceContext.contracts`, `WikiContext.hasContracts`, `ManifestContext.hasContracts`, `generateContracts(ctx)`, `openspecAvailable()`, `DoctorDeps`, `runChecks(dir, today, deps)`, `WizardAnswers.enableContracts` are defined once and used consistently. The doctor `--lint` empty-findings behavior is handled in `doctorCommand` (presentation), not `runChecks` (data) — consistent across Task 6.

**Note on a v1 behavior change:** Task 6 removes the synthetic "No issues found." finding from `runChecks` and moves that message to `doctorCommand`'s human branch. Any test asserting `runChecks` returns a non-empty array for a clean workspace must be updated to assert absence-of-errors instead (the Plan 1 doctor test only checks for no error-level finding, so it remains valid).
