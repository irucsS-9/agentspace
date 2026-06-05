# agentspace v1 Core (CLI + default pillars) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working `npx agentspace init` that interactively scaffolds a topology-aware multi-repo workspace with the two default pillars — `manifest` (always) and `memory-bank` wiki (default-on) — plus a mechanical `doctor` command, with shape-gated output proven by multi-shape fixtures.

**Architecture:** A single Node + TypeScript (ESM) npm package, Approach A. Pure generators return `GeneratedFile[]` (no filesystem side effects) so they're unit- and parity-testable; one `writeTree` module performs all disk writes (temp-tree + atomic rename, non-empty-dir clobber guard). Templates live as exported string constants in `src/templates/*` (bundling- and test-friendly; this is the concrete form of the spec's "templates tree"). Mustache renders with HTML-escaping disabled (we emit code/paths, not HTML). Workspace **shape** is a first-class field that gates which artifacts each generator emits.

**Tech Stack:** TypeScript (ESM, Node 18+), `tsup` (build), `vitest` (test), `@clack/prompts` (wizard), `mustache` (templating), `yaml` (manifest read in `doctor`).

**Scope note:** This plan covers the `manifest` + `memory-bank` pillars, `init`, `doctor`, and the test harness. The opt-in `contracts` (OpenSpec) and `enforcement` (agents/hooks/adapter/stack-agents) pillars are Plans 2 and 3. `init`'s pillar layer is built so those generators slot in without rework.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` | Project config |
| `src/types.ts` | Shared types: `WorkspaceShape`, `Pillar`, `RepoInput`, `WorkspaceConfig`, `GeneratedFile`, context slices |
| `src/shape.ts` | Pure shape-gating predicates (`shapeHasContracts`, `shapeHasDependencyOrder`, `isContractLinked`) |
| `src/budgets.ts` | Single source of memory-bank size budgets (used by `doctor`, later by `/lint`) |
| `src/renderer/render.ts` | Mustache wrapper (escaping disabled) |
| `src/templates/manifest.ts` | Template strings for the manifest pillar |
| `src/templates/memoryBank.ts` | Template strings for the wiki pillar |
| `src/context/build.ts` | `buildContext(config, today)` → typed slices |
| `src/wizard/validate.ts` | Pure input validators |
| `src/wizard/assemble.ts` | `assembleConfig(answers)` → `WorkspaceConfig` (pure) |
| `src/wizard/run.ts` | Thin interactive prompt layer (`@clack/prompts`) → `WorkspaceConfig` |
| `src/generators/manifest.ts` | `generateManifest(ctx)` → `GeneratedFile[]` |
| `src/generators/memoryBank.ts` | `generateMemoryBank(ctx)` → `GeneratedFile[]` |
| `src/fs/writeTree.ts` | `writeTree(files, targetDir, opts)` — clobber guard, temp-tree, atomic move |
| `src/commands/init.ts` | Orchestrates wizard → context → generators → writeTree |
| `src/commands/doctor.ts` | `runChecks(dir, today)` → `DoctorFinding[]`, plus printing |
| `src/cli.ts` | Arg parsing + dispatch + `--version`/`--help`; bin entry (shebang) |
| `test/**` | Unit tests + multi-shape fixture/parity tests |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.gitignore`
- Create: `src/version.ts`, `test/version.test.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "agentspace",
  "version": "0.1.0",
  "description": "Scaffold an agent-native multi-repo workspace",
  "type": "module",
  "bin": { "agentspace": "dist/cli.js" },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "mustache": "^4.2.0",
    "yaml": "^2.4.0"
  },
  "devDependencies": {
    "@types/mustache": "^4.2.5",
    "@types/node": "^20.11.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `tsup.config.ts`** (bundles the CLI with a shebang)

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node18",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 6: Create `src/version.ts`**

```ts
export const VERSION = "0.1.0";
```

- [ ] **Step 7: Write the failing test `test/version.test.ts`**

```ts
import { expect, test } from "vitest";
import { VERSION } from "../src/version";

test("VERSION matches package.json", () => {
  expect(VERSION).toBe("0.1.0");
});
```

- [ ] **Step 8: Install deps and run the test**

Run: `npm install && npm test`
Expected: 1 passing test.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold agentspace TypeScript CLI project"
```

---

### Task 2: Core types + shape gating

**Files:**
- Create: `src/types.ts`, `src/shape.ts`
- Test: `test/shape.test.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export type WorkspaceShape =
  | "single-repo"
  | "one-product"
  | "peer-services"
  | "library-consumers"
  | "unrelated";

export type Pillar = "manifest" | "wiki" | "contracts" | "enforcement";

export interface RepoInput {
  /** Directory name; filesystem-safe and unique within the workspace. */
  name: string;
  /** Git remote URL, or null for a local-only repo. */
  remote: string | null;
  /** Stack id (resolves to a stack-agent later) or "generic". */
  stack: string;
  /** Free-text role, e.g. "backend system of record". */
  role: string;
}

export interface WorkspaceConfig {
  workspaceName: string;
  shape: WorkspaceShape;
  repos: RepoInput[];
  /** Ordered repo names (producer first), or null when the shape has no order. */
  dependencyOrder: string[] | null;
  /** Selected pillars. "manifest" is always present. */
  pillars: Pillar[];
}

/** A file to write, path relative to the workspace root. Generators are pure. */
export interface GeneratedFile {
  path: string;
  contents: string;
}

export interface ManifestContext {
  workspaceName: string;
  shape: WorkspaceShape;
  repos: RepoInput[];
}

export interface WikiContext {
  workspaceName: string;
  shape: WorkspaceShape;
  isOneProduct: boolean;
  /** True when the shape implies ≥2 contract-linked repos. */
  contractLinked: boolean;
  repos: RepoInput[];
  dependencyOrder: string[] | null;
  /** ISO date (YYYY-MM-DD) injected for deterministic output. */
  today: string;
}

export interface WorkspaceContext {
  config: WorkspaceConfig;
  manifest: ManifestContext;
  wiki: WikiContext;
}
```

- [ ] **Step 2: Write the failing test `test/shape.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import {
  shapeHasContracts,
  shapeHasDependencyOrder,
  isContractLinked,
} from "../src/shape";
import type { WorkspaceConfig } from "../src/types";

const base: WorkspaceConfig = {
  workspaceName: "demo",
  shape: "one-product",
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: "git@x:web.git", stack: "nextjs", role: "frontend" },
  ],
  dependencyOrder: ["api", "web"],
  pillars: ["manifest", "wiki"],
};

describe("shape predicates", () => {
  test("single-repo has no contracts or order", () => {
    expect(shapeHasContracts("single-repo")).toBe(false);
    expect(shapeHasDependencyOrder("single-repo")).toBe(false);
  });

  test("one-product has contracts and order", () => {
    expect(shapeHasContracts("one-product")).toBe(true);
    expect(shapeHasDependencyOrder("one-product")).toBe(true);
  });

  test("peer-services has contracts but no global order", () => {
    expect(shapeHasContracts("peer-services")).toBe(true);
    expect(shapeHasDependencyOrder("peer-services")).toBe(false);
  });

  test("unrelated has neither", () => {
    expect(shapeHasContracts("unrelated")).toBe(false);
    expect(shapeHasDependencyOrder("unrelated")).toBe(false);
  });

  test("isContractLinked requires a contract shape AND >=2 repos", () => {
    expect(isContractLinked(base)).toBe(true);
    expect(isContractLinked({ ...base, repos: [base.repos[0]] })).toBe(false);
    expect(isContractLinked({ ...base, shape: "unrelated" })).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/shape.test.ts`
Expected: FAIL — cannot find module `../src/shape`.

- [ ] **Step 4: Create `src/shape.ts`**

```ts
import type { WorkspaceConfig, WorkspaceShape } from "./types";

const CONTRACT_SHAPES: ReadonlySet<WorkspaceShape> = new Set([
  "one-product",
  "peer-services",
  "library-consumers",
]);

const ORDERED_SHAPES: ReadonlySet<WorkspaceShape> = new Set([
  "one-product",
  "library-consumers",
]);

export function shapeHasContracts(shape: WorkspaceShape): boolean {
  return CONTRACT_SHAPES.has(shape);
}

export function shapeHasDependencyOrder(shape: WorkspaceShape): boolean {
  return ORDERED_SHAPES.has(shape);
}

/** A workspace earns cross-app artifacts only with a contract shape and ≥2 repos. */
export function isContractLinked(config: WorkspaceConfig): boolean {
  return shapeHasContracts(config.shape) && config.repos.length >= 2;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/shape.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/shape.ts test/shape.test.ts
git commit -m "feat: core types and shape-gating predicates"
```

---

### Task 3: Renderer (mustache, escaping disabled)

**Files:**
- Create: `src/renderer/render.ts`
- Test: `test/render.test.ts`

- [ ] **Step 1: Write the failing test `test/render.test.ts`**

```ts
import { expect, test } from "vitest";
import { render } from "../src/renderer/render";

test("renders without HTML-escaping (paths and code survive)", () => {
  const out = render("path: {{dir}} & flag {{flag}}", {
    dir: "../estimates-new",
    flag: "a && b",
  });
  expect(out).toBe("path: ../estimates-new & flag a && b");
});

test("renders sections over arrays", () => {
  const out = render("{{#repos}}- {{name}}\n{{/repos}}", {
    repos: [{ name: "api" }, { name: "web" }],
  });
  expect(out).toBe("- api\n- web\n");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/render.test.ts`
Expected: FAIL — cannot find module `../src/renderer/render`.

- [ ] **Step 3: Create `src/renderer/render.ts`**

```ts
import Mustache from "mustache";

// We generate code, paths, and markdown — never HTML. Disable escaping so
// characters like &, <, ", / pass through verbatim.
Mustache.escape = (text: string) => text;

export function render(template: string, view: Record<string, unknown>): string {
  return Mustache.render(template, view);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/render.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/render.ts test/render.test.ts
git commit -m "feat: mustache renderer with HTML-escaping disabled"
```

---

### Task 4: Wizard input validation

**Files:**
- Create: `src/wizard/validate.ts`
- Test: `test/validate.test.ts`

- [ ] **Step 1: Write the failing test `test/validate.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import {
  validateRepoName,
  validateRemote,
  validateWorkspaceName,
  validateUniqueNames,
} from "../src/wizard/validate";

describe("validateRepoName", () => {
  test("accepts safe names", () => {
    expect(validateRepoName("corkcrm-upgraded")).toBeNull();
    expect(validateRepoName("api_v2")).toBeNull();
  });
  test("rejects empty and unsafe names", () => {
    expect(validateRepoName("")).toMatch(/required/i);
    expect(validateRepoName("../etc")).toMatch(/letters/i);
    expect(validateRepoName("has space")).toMatch(/letters/i);
  });
});

describe("validateRemote", () => {
  test("empty is allowed (local-only)", () => {
    expect(validateRemote("")).toBeNull();
  });
  test("accepts ssh and https git URLs", () => {
    expect(validateRemote("git@github.com:org/repo.git")).toBeNull();
    expect(validateRemote("https://github.com/org/repo.git")).toBeNull();
  });
  test("rejects obvious non-URLs", () => {
    expect(validateRemote("not a url")).toMatch(/valid git remote/i);
  });
});

describe("validateWorkspaceName", () => {
  test("requires a non-empty name", () => {
    expect(validateWorkspaceName("")).toMatch(/required/i);
    expect(validateWorkspaceName("my-product")).toBeNull();
  });
});

describe("validateUniqueNames", () => {
  test("flags duplicates", () => {
    expect(validateUniqueNames(["a", "b", "a"])).toMatch(/duplicate/i);
    expect(validateUniqueNames(["a", "b"])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/validate.test.ts`
Expected: FAIL — cannot find module `../src/wizard/validate`.

- [ ] **Step 3: Create `src/wizard/validate.ts`**

```ts
const FS_SAFE = /^[A-Za-z0-9._-]+$/;

export function validateWorkspaceName(name: string): string | null {
  if (!name.trim()) return "Workspace name is required.";
  return null;
}

export function validateRepoName(name: string): string | null {
  if (!name.trim()) return "Repo name is required.";
  if (!FS_SAFE.test(name)) {
    return "Use only letters, numbers, dots, dashes, underscores.";
  }
  return null;
}

export function validateRemote(remote: string): string | null {
  if (remote.trim() === "") return null; // local-only
  const ok =
    /^git@[^:]+:.+\.git$/.test(remote) ||
    /^https?:\/\/.+/.test(remote) ||
    /^ssh:\/\/.+/.test(remote);
  return ok ? null : "Enter a valid git remote URL, or leave blank for local-only.";
}

export function validateUniqueNames(names: string[]): string | null {
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n)) return `Duplicate repo name: ${n}`;
    seen.add(n);
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/wizard/validate.ts test/validate.test.ts
git commit -m "feat: wizard input validators"
```

---

### Task 5: Context builder

**Files:**
- Create: `src/context/build.ts`
- Test: `test/context.test.ts`

- [ ] **Step 1: Write the failing test `test/context.test.ts`**

```ts
import { expect, test } from "vitest";
import { buildContext } from "../src/context/build";
import type { WorkspaceConfig } from "../src/types";

const config: WorkspaceConfig = {
  workspaceName: "cork",
  shape: "one-product",
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: null, stack: "nextjs", role: "frontend" },
  ],
  dependencyOrder: ["api", "web"],
  pillars: ["manifest", "wiki"],
};

test("builds typed slices with injected date", () => {
  const ctx = buildContext(config, "2026-06-05");
  expect(ctx.manifest.repos).toHaveLength(2);
  expect(ctx.wiki.isOneProduct).toBe(true);
  expect(ctx.wiki.contractLinked).toBe(true);
  expect(ctx.wiki.today).toBe("2026-06-05");
});

test("unrelated shape is not contract-linked and not one-product", () => {
  const ctx = buildContext(
    { ...config, shape: "unrelated", dependencyOrder: null },
    "2026-06-05",
  );
  expect(ctx.wiki.isOneProduct).toBe(false);
  expect(ctx.wiki.contractLinked).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/context.test.ts`
Expected: FAIL — cannot find module `../src/context/build`.

- [ ] **Step 3: Create `src/context/build.ts`**

```ts
import { isContractLinked } from "../shape";
import type { WorkspaceConfig, WorkspaceContext } from "../types";

export function buildContext(
  config: WorkspaceConfig,
  today: string,
): WorkspaceContext {
  return {
    config,
    manifest: {
      workspaceName: config.workspaceName,
      shape: config.shape,
      repos: config.repos,
    },
    wiki: {
      workspaceName: config.workspaceName,
      shape: config.shape,
      isOneProduct: config.shape === "one-product",
      contractLinked: isContractLinked(config),
      repos: config.repos,
      dependencyOrder: config.dependencyOrder,
      today,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/context.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/context/build.ts test/context.test.ts
git commit -m "feat: context builder with typed slices and injected date"
```

---

### Task 6: Manifest pillar templates + generator

**Files:**
- Create: `src/templates/manifest.ts`, `src/generators/manifest.ts`
- Test: `test/generators.manifest.test.ts`

- [ ] **Step 1: Create `src/templates/manifest.ts`**

```ts
export const MANIFEST_YAML = `# {{workspaceName}} — workspace manifest (source of truth for sub-repos)
workspace: {{workspaceName}}
shape: {{shape}}
repos:
{{#repos}}  - name: {{name}}
    remote: {{remote}}
    stack: {{stack}}
    role: {{role}}
{{/repos}}`;

// Repo list inlined as a bash array — no runtime YAML parsing (robust).
export const CLONE_REPOS_SH = `#!/usr/bin/env bash
set -euo pipefail
# Reconstructs the workspace from the inlined repo list below.
# Skips repos that already exist (idempotent) and local-only repos (no remote).

# Format per line: "<name>\\t<remote>"  (empty remote = local-only)
REPOS=(
{{#repos}}  "{{name}}	{{remoteOrEmpty}}"
{{/repos}})

for entry in "\${REPOS[@]}"; do
  name="\${entry%%	*}"
  remote="\${entry#*	}"
  if [[ -d "\$name" ]]; then
    echo "skip   \$name (already present)"
  elif [[ -z "\$remote" ]]; then
    echo "skip   \$name (local-only, no remote)"
  else
    echo "clone  \$name"
    git clone "\$remote" "\$name"
  fi
done
`;

export const GITIGNORE = `# Sub-repos are independent git repositories, not tracked here.
{{#repos}}{{name}}/
{{/repos}}# Machine-local Claude Code settings.
**/.claude/settings.local.json
.DS_Store
`;

export const ROOT_CLAUDE = `# CLAUDE.md — {{workspaceName}}

This is an agentspace workspace: a coordination layer above {{repoCount}} sibling repos.
Work inside the relevant sub-repo; read that repo's own CLAUDE.md for stack details.

## Repos
{{#repos}}- \`{{name}}/\` — {{role}} ({{stack}})
{{/repos}}

## Source of truth
- \`manifest.yaml\` — canonical repo list. Run \`./clone-repos.sh\` to reconstruct.
- \`memory-bank/\` — cross-repo knowledge wiki (read \`memory-bank/README.md\`).
`;

export const ROOT_README = `# {{workspaceName}}

Coordination workspace for {{repoCount}} sibling repositories, scaffolded by agentspace.

## Repositories
| Dir | Role | Stack |
|---|---|---|
{{#repos}}| \`{{name}}/\` | {{role}} | {{stack}} |
{{/repos}}

## Getting started
\`\`\`bash
./clone-repos.sh   # clone any missing sub-repos (idempotent)
\`\`\`

Sub-repos are independent git repositories and are git-ignored by this workspace.
`;
```

- [ ] **Step 2: Write the failing test `test/generators.manifest.test.ts`**

```ts
import { expect, test } from "vitest";
import { generateManifest } from "../src/generators/manifest";
import type { ManifestContext } from "../src/types";

const ctx: ManifestContext = {
  workspaceName: "cork",
  shape: "one-product",
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: null, stack: "nextjs", role: "frontend" },
  ],
};

test("emits the expected file set", () => {
  const files = generateManifest(ctx);
  const paths = files.map((f) => f.path).sort();
  expect(paths).toEqual(
    [".gitignore", "CLAUDE.md", "README.md", "clone-repos.sh", "manifest.yaml"].sort(),
  );
});

test("manifest lists each repo with local-only remote blank", () => {
  const yaml = generateManifest(ctx).find((f) => f.path === "manifest.yaml")!.contents;
  expect(yaml).toContain("- name: api");
  expect(yaml).toContain("remote: git@x:api.git");
  expect(yaml).toContain("- name: web");
  expect(yaml).toContain("remote: \n");
});

test("clone script inlines repos and gitignore excludes repo dirs + local settings", () => {
  const files = generateManifest(ctx);
  const sh = files.find((f) => f.path === "clone-repos.sh")!.contents;
  expect(sh).toContain('"api\tgit@x:api.git"');
  expect(sh).toContain('"web\t"'); // local-only, empty remote
  const ignore = files.find((f) => f.path === ".gitignore")!.contents;
  expect(ignore).toContain("api/");
  expect(ignore).toContain("web/");
  expect(ignore).toContain("**/.claude/settings.local.json");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/generators.manifest.test.ts`
Expected: FAIL — cannot find module `../src/generators/manifest`.

- [ ] **Step 4: Create `src/generators/manifest.ts`**

```ts
import { render } from "../renderer/render";
import {
  CLONE_REPOS_SH,
  GITIGNORE,
  MANIFEST_YAML,
  ROOT_CLAUDE,
  ROOT_README,
} from "../templates/manifest";
import type { GeneratedFile, ManifestContext } from "../types";

export function generateManifest(ctx: ManifestContext): GeneratedFile[] {
  const repos = ctx.repos.map((r) => ({
    ...r,
    remote: r.remote ?? "",
    remoteOrEmpty: r.remote ?? "",
  }));
  const view = {
    workspaceName: ctx.workspaceName,
    shape: ctx.shape,
    repoCount: ctx.repos.length,
    repos,
  };
  return [
    { path: "manifest.yaml", contents: render(MANIFEST_YAML, view) },
    { path: "clone-repos.sh", contents: render(CLONE_REPOS_SH, view) },
    { path: ".gitignore", contents: render(GITIGNORE, view) },
    { path: "CLAUDE.md", contents: render(ROOT_CLAUDE, view) },
    { path: "README.md", contents: render(ROOT_README, view) },
  ];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/generators.manifest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/templates/manifest.ts src/generators/manifest.ts test/generators.manifest.test.ts
git commit -m "feat: manifest pillar generator"
```

---

### Task 7: Memory-bank pillar templates + generator

**Files:**
- Create: `src/templates/memoryBank.ts`, `src/generators/memoryBank.ts`
- Test: `test/generators.memoryBank.test.ts`

- [ ] **Step 1: Create `src/templates/memoryBank.ts`**

The conventions README is universal content with ONE shape-conditional block (the
"product-level only" scope rule). The numbered folders are created via `.gitkeep`.

```ts
export const WIKI_FOLDERS = [
  "00-core",
  "01-active",
  "02-architecture",
  "03-patterns",
  "04-business",
  "05-sessions",
  "06-learnings",
  "07-reference",
  "08-history",
  "09-research",
  "10-archive",
];

export const WIKI_README = `# Memory Bank — {{workspaceName}} Wiki

An LLM-curated knowledge base (Karpathy LLM Wiki pattern): entity/concept pages,
an \`index.md\` catalog, an append-only \`log.md\`, and operations (ingest / query / lint).

## Scope
{{#isOneProduct}}**Cross-app / product-level only.** Per-repo architecture stays in each
sub-repo's own CLAUDE.md — do not duplicate it here (duplication drifts).
{{/isOneProduct}}{{^isOneProduct}}Cross-repo knowledge that spans more than one repository.
Per-repo detail stays in each sub-repo's own CLAUDE.md.
{{/isOneProduct}}

## Folders (lower number = higher reading priority)
| Dir | Holds |
|---|---|
| 00-core/ | Foundational, slow-changing |
| 01-active/ | Current focus, status, next steps |
| 04-business/ | Domain/feature pages |
| 06-learnings/ | Lessons, postmortems |
| 10-archive/ | Superseded material (archive, don't delete) |

## Page conventions
- Scannable, not exhaustive. Bullets/tables. Reference \`file:line\`, don't duplicate code.
- Every entity page ends with \`_Last verified: YYYY-MM-DD_\`.
- Every factual claim about code cites \`file:line\`. Without citations, drift is invisible.

## Size budgets
\`agentspace doctor\` enforces these mechanically (single source of truth):
| File / pattern | Hard cap (lines) |
|---|---|
| log.md | 500 |
| 00-core/*.md | 800 |
| 01-active/currentWork.md | 150 |
| 04-business/*.md | 800 |
`;

export const WIKI_INDEX = `# Index

Catalog of wiki pages by category. Updated on every \`/ingest\`.

_(empty — add pages as you ingest)_
`;

export const WIKI_LOG = `# Log

Append-only activity journal. One line per action: \`## [YYYY-MM-DD] <action> | <slug>\`.
`;

export const PROJECT_OVERVIEW = `# Project Overview — {{workspaceName}}

{{#isOneProduct}}One product across {{repoCount}} repositories.{{/isOneProduct}}{{^isOneProduct}}{{repoCount}} repositories coordinated in one workspace.{{/isOneProduct}}

## Repos
{{#repos}}- \`{{name}}/\` — {{role}} ({{stack}})
{{/repos}}

---
_Last verified: {{today}}_
`;

// Only emitted for contract-linked workspaces. Deliberately empty — the wizard has
// no code to cite, so it must NOT fabricate entries or a premature verified date.
export const CROSS_APP_CONTRACTS = `# Cross-App Contracts — {{workspaceName}}

> No contracts recorded yet. Populate this after your first cross-repo change.
> Every entry must cite \`file:line\` and end the page with a \`_Last verified:_\` date.

{{#dependencyOrder.length}}**Dependency order:** {{#dependencyOrder}}{{.}} → {{/dependencyOrder}}(done)
{{/dependencyOrder.length}}
`;
```

- [ ] **Step 2: Write the failing test `test/generators.memoryBank.test.ts`**

```ts
import { expect, test } from "vitest";
import { generateMemoryBank } from "../src/generators/memoryBank";
import type { WikiContext } from "../src/types";

function ctx(overrides: Partial<WikiContext> = {}): WikiContext {
  return {
    workspaceName: "cork",
    shape: "one-product",
    isOneProduct: true,
    contractLinked: true,
    repos: [
      { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
      { name: "web", remote: null, stack: "nextjs", role: "frontend" },
    ],
    dependencyOrder: ["api", "web"],
    today: "2026-06-05",
    ...overrides,
  };
}

test("emits folders, README, index, log, overview", () => {
  const paths = generateMemoryBank(ctx()).map((f) => f.path);
  expect(paths).toContain("memory-bank/README.md");
  expect(paths).toContain("memory-bank/index.md");
  expect(paths).toContain("memory-bank/log.md");
  expect(paths).toContain("memory-bank/00-core/projectOverview.md");
  expect(paths).toContain("memory-bank/00-core/.gitkeep");
  expect(paths).toContain("memory-bank/10-archive/.gitkeep");
});

test("one-product README carries the product-level scope rule", () => {
  const readme = generateMemoryBank(ctx()).find(
    (f) => f.path === "memory-bank/README.md",
  )!.contents;
  expect(readme).toContain("product-level only");
});

test("non-product README drops the product-level scope rule", () => {
  const readme = generateMemoryBank(
    ctx({ shape: "unrelated", isOneProduct: false, contractLinked: false }),
  ).find((f) => f.path === "memory-bank/README.md")!.contents;
  expect(readme).not.toContain("product-level only");
});

test("crossAppContracts stub appears only when contract-linked", () => {
  const linked = generateMemoryBank(ctx()).map((f) => f.path);
  expect(linked).toContain("memory-bank/00-core/crossAppContracts.md");

  const unlinked = generateMemoryBank(
    ctx({ shape: "unrelated", isOneProduct: false, contractLinked: false }),
  ).map((f) => f.path);
  expect(unlinked).not.toContain("memory-bank/00-core/crossAppContracts.md");
});

test("crossAppContracts stub never fabricates a Last verified date", () => {
  const stub = generateMemoryBank(ctx()).find(
    (f) => f.path === "memory-bank/00-core/crossAppContracts.md",
  )!.contents;
  expect(stub).not.toMatch(/_Last verified:/);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/generators.memoryBank.test.ts`
Expected: FAIL — cannot find module `../src/generators/memoryBank`.

- [ ] **Step 4: Create `src/generators/memoryBank.ts`**

```ts
import { render } from "../renderer/render";
import {
  CROSS_APP_CONTRACTS,
  PROJECT_OVERVIEW,
  WIKI_FOLDERS,
  WIKI_INDEX,
  WIKI_LOG,
  WIKI_README,
} from "../templates/memoryBank";
import type { GeneratedFile, WikiContext } from "../types";

export function generateMemoryBank(ctx: WikiContext): GeneratedFile[] {
  const view = {
    workspaceName: ctx.workspaceName,
    isOneProduct: ctx.isOneProduct,
    repoCount: ctx.repos.length,
    repos: ctx.repos,
    dependencyOrder: ctx.dependencyOrder ?? [],
    today: ctx.today,
  };

  const files: GeneratedFile[] = [];

  // Numbered folders need a tracked placeholder (git ignores empty dirs).
  for (const folder of WIKI_FOLDERS) {
    files.push({ path: `memory-bank/${folder}/.gitkeep`, contents: "" });
  }

  files.push(
    { path: "memory-bank/README.md", contents: render(WIKI_README, view) },
    { path: "memory-bank/index.md", contents: render(WIKI_INDEX, view) },
    { path: "memory-bank/log.md", contents: render(WIKI_LOG, view) },
    {
      path: "memory-bank/00-core/projectOverview.md",
      contents: render(PROJECT_OVERVIEW, view),
    },
  );

  if (ctx.contractLinked) {
    files.push({
      path: "memory-bank/00-core/crossAppContracts.md",
      contents: render(CROSS_APP_CONTRACTS, view),
    });
  }

  return files;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/generators.memoryBank.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/templates/memoryBank.ts src/generators/memoryBank.ts test/generators.memoryBank.test.ts
git commit -m "feat: memory-bank pillar generator with shape-gated stubs"
```

---

### Task 8: writeTree (clobber guard + temp-tree + atomic move)

**Files:**
- Create: `src/fs/writeTree.ts`
- Test: `test/writeTree.test.ts`

- [ ] **Step 1: Write the failing test `test/writeTree.test.ts`**

```ts
import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeTree } from "../src/fs/writeTree";
import type { GeneratedFile } from "../src/types";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentspace-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const files: GeneratedFile[] = [
  { path: "manifest.yaml", contents: "workspace: x\n" },
  { path: "memory-bank/00-core/.gitkeep", contents: "" },
  { path: "memory-bank/README.md", contents: "# wiki\n" },
];

test("writes a nested tree into an empty target", async () => {
  const target = join(dir, "ws");
  await writeTree(files, target, { force: false });
  expect(await readFile(join(target, "manifest.yaml"), "utf8")).toBe("workspace: x\n");
  expect(await readFile(join(target, "memory-bank/README.md"), "utf8")).toBe("# wiki\n");
});

test("refuses a non-empty target without force", async () => {
  const target = join(dir, "ws");
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "existing.txt"), "keep");
  await expect(writeTree(files, target, { force: false })).rejects.toThrow(/not empty/i);
  // existing file untouched
  expect(await readFile(join(target, "existing.txt"), "utf8")).toBe("keep");
});

test("with force, writes into a non-empty target and preserves unrelated files", async () => {
  const target = join(dir, "ws");
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "existing.txt"), "keep");
  await writeTree(files, target, { force: true });
  expect(await readFile(join(target, "existing.txt"), "utf8")).toBe("keep");
  expect(await readFile(join(target, "manifest.yaml"), "utf8")).toBe("workspace: x\n");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/writeTree.test.ts`
Expected: FAIL — cannot find module `../src/fs/writeTree`.

- [ ] **Step 3: Create `src/fs/writeTree.ts`**

```ts
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import type { GeneratedFile } from "../types";

export interface WriteOptions {
  force: boolean;
}

async function isNonEmptyDir(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.length > 0;
  } catch {
    return false; // does not exist → treated as empty
  }
}

/**
 * Writes all files first into a sibling temp dir (same filesystem, so the final
 * move is atomic), then promotes it into place. If anything throws during the
 * write phase, the temp dir is removed and the target is left untouched.
 */
export async function writeTree(
  files: GeneratedFile[],
  targetDir: string,
  opts: WriteOptions,
): Promise<void> {
  if (!opts.force && (await isNonEmptyDir(targetDir))) {
    throw new Error(
      `Target directory is not empty: ${targetDir}. Re-run with --force to write anyway.`,
    );
  }

  const parent = dirname(targetDir);
  await mkdir(parent, { recursive: true });
  const temp = await mkdtemp(join(parent, ".agentspace-tmp-"));

  try {
    for (const file of files) {
      const dest = join(temp, file.path);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, file.contents);
    }

    if (opts.force) {
      // Merge into existing dir, preserving unrelated files.
      await cp(temp, targetDir, { recursive: true, force: true });
      await rm(temp, { recursive: true, force: true });
    } else if (await isNonEmptyDir(targetDir)) {
      // Empty dir may exist (e.g. cwd). Merge then drop temp.
      await cp(temp, targetDir, { recursive: true, force: true });
      await rm(temp, { recursive: true, force: true });
    } else {
      await rm(targetDir, { recursive: true, force: true }).catch(() => {});
      await rename(temp, targetDir);
    }
  } catch (err) {
    await rm(temp, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/writeTree.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/fs/writeTree.ts test/writeTree.test.ts
git commit -m "feat: writeTree with clobber guard and temp-tree promotion"
```

---

### Task 9: Wizard config assembly (pure) + thin interactive runner

**Files:**
- Create: `src/wizard/assemble.ts`, `src/wizard/run.ts`
- Test: `test/assemble.test.ts`

- [ ] **Step 1: Write the failing test `test/assemble.test.ts`**

```ts
import { expect, test } from "vitest";
import { assembleConfig, type WizardAnswers } from "../src/wizard/assemble";

const answers: WizardAnswers = {
  workspaceName: "cork",
  shape: "one-product",
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: "", stack: "nextjs", role: "frontend" },
  ],
  dependencyOrder: ["api", "web"],
  enableWiki: true,
};

test("assembles a config, mapping empty remote to null", () => {
  const cfg = assembleConfig(answers);
  expect(cfg.repos[1].remote).toBeNull();
  expect(cfg.pillars).toEqual(["manifest", "wiki"]);
});

test("drops dependency order for shapes without one", () => {
  const cfg = assembleConfig({ ...answers, shape: "unrelated", dependencyOrder: ["api", "web"] });
  expect(cfg.dependencyOrder).toBeNull();
});

test("omits wiki pillar when disabled", () => {
  const cfg = assembleConfig({ ...answers, enableWiki: false });
  expect(cfg.pillars).toEqual(["manifest"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/assemble.test.ts`
Expected: FAIL — cannot find module `../src/wizard/assemble`.

- [ ] **Step 3: Create `src/wizard/assemble.ts`**

```ts
import { shapeHasDependencyOrder } from "../shape";
import type { Pillar, WorkspaceConfig, WorkspaceShape } from "../types";

export interface WizardAnswers {
  workspaceName: string;
  shape: WorkspaceShape;
  repos: { name: string; remote: string; stack: string; role: string }[];
  dependencyOrder: string[];
  enableWiki: boolean;
}

export function assembleConfig(answers: WizardAnswers): WorkspaceConfig {
  const pillars: Pillar[] = ["manifest"];
  if (answers.enableWiki) pillars.push("wiki");

  return {
    workspaceName: answers.workspaceName.trim(),
    shape: answers.shape,
    repos: answers.repos.map((r) => ({
      name: r.name.trim(),
      remote: r.remote.trim() === "" ? null : r.remote.trim(),
      stack: r.stack,
      role: r.role.trim(),
    })),
    dependencyOrder: shapeHasDependencyOrder(answers.shape)
      ? answers.dependencyOrder
      : null,
    pillars,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/assemble.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create `src/wizard/run.ts`** (thin interactive layer — not unit-tested; logic lives in `assemble`/`validate`)

```ts
import * as p from "@clack/prompts";
import { assembleConfig, type WizardAnswers } from "./assemble";
import { shapeHasDependencyOrder } from "../shape";
import {
  validateRemote,
  validateRepoName,
  validateWorkspaceName,
} from "./validate";
import type { WorkspaceConfig, WorkspaceShape } from "../types";

function cancel(value: unknown): asserts value is string {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(1);
  }
}

export async function runWizard(): Promise<WorkspaceConfig> {
  p.intro("agentspace init");

  const workspaceName = await p.text({
    message: "Workspace name",
    validate: (v) => validateWorkspaceName(v) ?? undefined,
  });
  cancel(workspaceName);

  const shape = (await p.select({
    message: "Workspace shape",
    options: [
      { value: "single-repo", label: "Single repo" },
      { value: "one-product", label: "Multi-repo, one product (backend + clients)" },
      { value: "peer-services", label: "Multi-repo, peer services (no global order)" },
      { value: "library-consumers", label: "Multi-repo, library + consumers" },
      { value: "unrelated", label: "Multi-repo, unrelated" },
    ],
  })) as WorkspaceShape;
  cancel(shape);

  const repos: WizardAnswers["repos"] = [];
  let addMore = true;
  while (addMore) {
    const name = await p.text({
      message: `Repo #${repos.length + 1} directory name`,
      validate: (v) => validateRepoName(v) ?? undefined,
    });
    cancel(name);
    const remote = await p.text({
      message: "Git remote URL (blank = local-only)",
      validate: (v) => validateRemote(v) ?? undefined,
    });
    cancel(remote);
    const stack = await p.text({ message: "Stack id (or 'generic')", placeholder: "generic" });
    cancel(stack);
    const role = await p.text({ message: "Role (one line)" });
    cancel(role);
    repos.push({ name, remote, stack: stack || "generic", role });

    if (shape === "single-repo") break;
    const more = await p.confirm({ message: "Add another repo?" });
    cancel(more as unknown as string);
    addMore = more === true;
  }

  let dependencyOrder: string[] = [];
  if (shapeHasDependencyOrder(shape) && repos.length > 1) {
    p.note(
      "Dependency order: which repo defines contracts the others consume (producer first).",
    );
    const remaining = repos.map((r) => r.name);
    while (dependencyOrder.length < remaining.length) {
      const pick = await p.select({
        message: `Position ${dependencyOrder.length + 1}`,
        options: remaining
          .filter((n) => !dependencyOrder.includes(n))
          .map((n) => ({ value: n, label: n })),
      });
      cancel(pick);
      dependencyOrder.push(pick as string);
    }
  }

  const enableWiki = await p.confirm({ message: "Include the memory-bank wiki?", initialValue: true });
  cancel(enableWiki as unknown as string);

  p.outro("Generating workspace…");
  return assembleConfig({
    workspaceName,
    shape,
    repos,
    dependencyOrder,
    enableWiki: enableWiki === true,
  });
}
```

- [ ] **Step 6: Run the full suite (assemble tested; run.ts compiles)**

Run: `npm run typecheck && npx vitest run test/assemble.test.ts`
Expected: typecheck clean; assemble tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/wizard/assemble.ts src/wizard/run.ts test/assemble.test.ts
git commit -m "feat: wizard config assembly and interactive runner"
```

---

### Task 10: `init` command (orchestration)

**Files:**
- Create: `src/commands/init.ts`
- Test: `test/init.test.ts`

- [ ] **Step 1: Write the failing test `test/init.test.ts`** (tests the pure orchestration via injected config, not the TTY)

```ts
import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateWorkspace, runInit } from "../src/commands/init";
import type { WorkspaceConfig } from "../src/types";

const config: WorkspaceConfig = {
  workspaceName: "cork",
  shape: "one-product",
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: null, stack: "nextjs", role: "frontend" },
  ],
  dependencyOrder: ["api", "web"],
  pillars: ["manifest", "wiki"],
};

test("generateWorkspace emits manifest + wiki files for selected pillars", () => {
  const files = generateWorkspace(config, "2026-06-05");
  const paths = files.map((f) => f.path);
  expect(paths).toContain("manifest.yaml");
  expect(paths).toContain("memory-bank/README.md");
});

test("generateWorkspace omits wiki when not selected", () => {
  const files = generateWorkspace({ ...config, pillars: ["manifest"] }, "2026-06-05");
  expect(files.some((f) => f.path.startsWith("memory-bank/"))).toBe(false);
});

test("runInit writes the tree to disk", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agentspace-init-"));
  const target = join(dir, "ws");
  try {
    await runInit(config, target, { force: false, today: "2026-06-05" });
    expect(await readFile(join(target, "manifest.yaml"), "utf8")).toContain("workspace: cork");
    expect(await readFile(join(target, "memory-bank/00-core/projectOverview.md"), "utf8"))
      .toContain("_Last verified: 2026-06-05_");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/init.test.ts`
Expected: FAIL — cannot find module `../src/commands/init`.

- [ ] **Step 3: Create `src/commands/init.ts`**

```ts
import { buildContext } from "../context/build";
import { generateManifest } from "../generators/manifest";
import { generateMemoryBank } from "../generators/memoryBank";
import { writeTree } from "../fs/writeTree";
import { runWizard } from "../wizard/run";
import type { GeneratedFile, WorkspaceConfig } from "../types";

/** Pure: config → files, honoring pillar selection. */
export function generateWorkspace(
  config: WorkspaceConfig,
  today: string,
): GeneratedFile[] {
  const ctx = buildContext(config, today);
  const files: GeneratedFile[] = [];
  // "manifest" is always present.
  files.push(...generateManifest(ctx.manifest));
  if (config.pillars.includes("wiki")) {
    files.push(...generateMemoryBank(ctx.wiki));
  }
  // contracts/enforcement pillars are added in Plans 2 and 3.
  return files;
}

export interface RunInitOptions {
  force: boolean;
  today: string;
}

export async function runInit(
  config: WorkspaceConfig,
  targetDir: string,
  opts: RunInitOptions,
): Promise<void> {
  const files = generateWorkspace(config, opts.today);
  await writeTree(files, targetDir, { force: opts.force });
}

/** Interactive entry used by the CLI. */
export async function initCommand(opts: { force: boolean; today: string }): Promise<void> {
  const config = await runWizard();
  await runInit(config, process.cwd(), opts);
  console.log(`\n✓ Created ${config.workspaceName} (${config.pillars.join(", ")}).`);
  console.log("  Next: ./clone-repos.sh");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/init.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/init.ts test/init.test.ts
git commit -m "feat: init command orchestration (pillar-aware)"
```

---

### Task 11: `doctor` command (mechanical checks)

**Files:**
- Create: `src/budgets.ts`, `src/commands/doctor.ts`
- Test: `test/doctor.test.ts`

- [ ] **Step 1: Create `src/budgets.ts`** (single source of truth for size budgets)

```ts
/** Hard caps (lines). Matched against memory-bank paths by suffix/glob intent. */
export interface Budget {
  /** Match function over a workspace-relative path. */
  match: (path: string) => boolean;
  cap: number;
  label: string;
}

export const SIZE_BUDGETS: Budget[] = [
  { label: "log.md", cap: 500, match: (p) => p === "memory-bank/log.md" },
  {
    label: "01-active/currentWork.md",
    cap: 150,
    match: (p) => p === "memory-bank/01-active/currentWork.md",
  },
  {
    label: "00-core/*.md",
    cap: 800,
    match: (p) => /^memory-bank\/00-core\/.+\.md$/.test(p),
  },
  {
    label: "04-business/*.md",
    cap: 800,
    match: (p) => /^memory-bank\/04-business\/.+\.md$/.test(p),
  },
];

export const STALE_DAYS = 30;
```

- [ ] **Step 2: Write the failing test `test/doctor.test.ts`**

```ts
import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runChecks } from "../src/commands/doctor";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentspace-doctor-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(rel: string, contents: string) {
  const full = join(dir, rel);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, contents);
}

test("errors when manifest is missing", async () => {
  const findings = await runChecks(dir, "2026-06-05");
  expect(findings.some((f) => f.level === "error" && /manifest/i.test(f.message))).toBe(true);
});

test("warns on an over-budget page", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  const big = Array.from({ length: 801 }, (_, i) => `line ${i}`).join("\n");
  await write("memory-bank/00-core/projectOverview.md", big);
  const findings = await runChecks(dir, "2026-06-05");
  expect(findings.some((f) => f.level === "warn" && /800/.test(f.message))).toBe(true);
});

test("warns on a stale Last verified footer", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  await write(
    "memory-bank/00-core/projectOverview.md",
    "# Overview\n\n_Last verified: 2026-01-01_\n",
  );
  const findings = await runChecks(dir, "2026-06-05");
  expect(findings.some((f) => f.level === "warn" && /stale/i.test(f.message))).toBe(true);
});

test("clean workspace yields no errors", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  await write(
    "memory-bank/00-core/projectOverview.md",
    "# Overview\n\n_Last verified: 2026-06-01_\n",
  );
  const findings = await runChecks(dir, "2026-06-05");
  expect(findings.some((f) => f.level === "error")).toBe(false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/doctor.test.ts`
Expected: FAIL — cannot find module `../src/commands/doctor`.

- [ ] **Step 4: Create `src/commands/doctor.ts`**

```ts
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { parse } from "yaml";
import { SIZE_BUDGETS, STALE_DAYS } from "../budgets";

export interface DoctorFinding {
  level: "error" | "warn" | "info";
  message: string;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.floor((to - from) / 86_400_000);
}

export async function runChecks(
  workspaceDir: string,
  today: string,
): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  // 1. Manifest validity.
  try {
    const raw = await readFile(join(workspaceDir, "manifest.yaml"), "utf8");
    const doc = parse(raw) as { repos?: unknown[] } | null;
    if (!doc || !Array.isArray(doc.repos) || doc.repos.length === 0) {
      findings.push({ level: "error", message: "manifest.yaml has no repos." });
    }
  } catch {
    findings.push({ level: "error", message: "manifest.yaml is missing or unparseable." });
  }

  // 2. Memory-bank size budgets + staleness.
  const mbDir = join(workspaceDir, "memory-bank");
  const files = await walk(mbDir);
  for (const full of files) {
    const rel = relative(workspaceDir, full).split("\\").join("/");
    if (!rel.endsWith(".md")) continue;
    const contents = await readFile(full, "utf8");
    const lineCount = contents.split("\n").length;

    const budget = SIZE_BUDGETS.find((b) => b.match(rel));
    if (budget && lineCount > budget.cap) {
      findings.push({
        level: "warn",
        message: `${rel}: ${lineCount} lines exceeds cap of ${budget.cap} (${budget.label}). Split or archive.`,
      });
    }

    const match = contents.match(/_Last verified:\s*(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const age = daysBetween(match[1], today);
      if (age > STALE_DAYS) {
        findings.push({
          level: "warn",
          message: `${rel}: stale — last verified ${age} days ago (> ${STALE_DAYS}). Re-verify.`,
        });
      }
    }
  }

  if (findings.length === 0) {
    findings.push({ level: "info", message: "No issues found." });
  }
  return findings;
}

export async function doctorCommand(workspaceDir: string, today: string): Promise<number> {
  const findings = await runChecks(workspaceDir, today);
  for (const f of findings) {
    const tag = f.level === "error" ? "✗" : f.level === "warn" ? "!" : "·";
    console.log(`${tag} ${f.message}`);
  }
  return findings.some((f) => f.level === "error") ? 1 : 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/doctor.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/budgets.ts src/commands/doctor.ts test/doctor.test.ts
git commit -m "feat: doctor mechanical checks (manifest, size budgets, staleness)"
```

---

### Task 12: CLI entry + dispatch

**Files:**
- Create: `src/cli.ts`
- Test: `test/cli.test.ts`

- [ ] **Step 1: Write the failing test `test/cli.test.ts`**

```ts
import { expect, test } from "vitest";
import { parseArgs } from "../src/cli";

test("parses init with --force", () => {
  expect(parseArgs(["init", "--force"])).toEqual({ command: "init", force: true });
});

test("parses doctor with default dir", () => {
  expect(parseArgs(["doctor"])).toEqual({ command: "doctor", force: false });
});

test("parses version and help flags", () => {
  expect(parseArgs(["--version"])).toEqual({ command: "version", force: false });
  expect(parseArgs(["--help"])).toEqual({ command: "help", force: false });
  expect(parseArgs([])).toEqual({ command: "help", force: false });
});

test("unknown command falls back to help", () => {
  expect(parseArgs(["wat"])).toEqual({ command: "help", force: false });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cli.test.ts`
Expected: FAIL — cannot find module `../src/cli` (or no `parseArgs` export).

- [ ] **Step 3: Create `src/cli.ts`**

```ts
import { initCommand } from "./commands/init";
import { doctorCommand } from "./commands/doctor";
import { VERSION } from "./version";

export interface ParsedArgs {
  command: "init" | "doctor" | "version" | "help";
  force: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const force = argv.includes("--force");
  const first = argv[0];
  if (first === "init") return { command: "init", force };
  if (first === "doctor") return { command: "doctor", force };
  if (first === "--version" || first === "-v") return { command: "version", force };
  return { command: "help", force };
}

const HELP = `agentspace — scaffold an agent-native multi-repo workspace

Usage:
  agentspace init [--force]   Interactively scaffold a workspace in the current dir
  agentspace doctor           Run mechanical health checks on a workspace
  agentspace --version        Print version
  agentspace --help           Show this help
`;

function todayIso(): string {
  // Single allowed Date() call site, kept out of all pure modules for testability.
  return new Date().toISOString().slice(0, 10);
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  switch (args.command) {
    case "init":
      await initCommand({ force: args.force, today: todayIso() });
      return 0;
    case "doctor":
      return doctorCommand(process.cwd(), todayIso());
    case "version":
      console.log(VERSION);
      return 0;
    case "help":
    default:
      console.log(HELP);
      return 0;
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/cli.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Build and smoke-test the binary**

Run:
```bash
npm run build
node dist/cli.js --version
node dist/cli.js --help
```
Expected: prints `0.1.0`, then the help text.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts test/cli.test.ts
git commit -m "feat: CLI entry, arg parsing, and command dispatch"
```

---

### Task 13: Multi-shape fixture / parity harness

**Files:**
- Create: `test/fixtures/shapes.ts`, `test/parity.test.ts`

This is the generalization-correctness safety net: assert the *right* pillars appear
per shape, and — critically — that cross-app artifacts are **absent** where the shape
doesn't warrant them.

- [ ] **Step 1: Create `test/fixtures/shapes.ts`**

```ts
import type { WorkspaceConfig } from "../../src/types";

export const singleRepo: WorkspaceConfig = {
  workspaceName: "solo",
  shape: "single-repo",
  repos: [{ name: "app", remote: "git@x:app.git", stack: "generic", role: "the app" }],
  dependencyOrder: null,
  pillars: ["manifest", "wiki"],
};

export const oneProduct: WorkspaceConfig = {
  workspaceName: "cork",
  shape: "one-product",
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: "git@x:web.git", stack: "nextjs", role: "frontend" },
    { name: "mobile", remote: null, stack: "expo", role: "mobile" },
  ],
  dependencyOrder: ["api", "web", "mobile"],
  pillars: ["manifest", "wiki"],
};

export const unrelated: WorkspaceConfig = {
  workspaceName: "misc",
  shape: "unrelated",
  repos: [
    { name: "blog", remote: "git@x:blog.git", stack: "generic", role: "blog" },
    { name: "tool", remote: "git@x:tool.git", stack: "go", role: "cli tool" },
  ],
  dependencyOrder: null,
  pillars: ["manifest", "wiki"],
};
```

- [ ] **Step 2: Write the failing test `test/parity.test.ts`**

```ts
import { expect, test } from "vitest";
import { generateWorkspace } from "../src/commands/init";
import { oneProduct, singleRepo, unrelated } from "./fixtures/shapes";

const at = (files: { path: string }[]) => files.map((f) => f.path);

test("one-product emits crossAppContracts stub", () => {
  const paths = at(generateWorkspace(oneProduct, "2026-06-05"));
  expect(paths).toContain("memory-bank/00-core/crossAppContracts.md");
});

test("single-repo does NOT emit crossAppContracts (not contract-linked)", () => {
  const paths = at(generateWorkspace(singleRepo, "2026-06-05"));
  expect(paths).not.toContain("memory-bank/00-core/crossAppContracts.md");
});

test("unrelated does NOT emit crossAppContracts and README drops product scope", () => {
  const files = generateWorkspace(unrelated, "2026-06-05");
  expect(at(files)).not.toContain("memory-bank/00-core/crossAppContracts.md");
  const readme = files.find((f) => f.path === "memory-bank/README.md")!.contents;
  expect(readme).not.toContain("product-level only");
});

test("output is deterministic for a fixed date (parity on owned files)", () => {
  const a = generateWorkspace(oneProduct, "2026-06-05");
  const b = generateWorkspace(oneProduct, "2026-06-05");
  expect(a).toEqual(b);
});

test("every emitted path is unique", () => {
  const paths = at(generateWorkspace(oneProduct, "2026-06-05"));
  expect(new Set(paths).size).toBe(paths.length);
});
```

- [ ] **Step 3: Run test to verify it fails (then passes — no new impl needed)**

Run: `npx vitest run test/parity.test.ts`
Expected: PASS — these assert behavior already built in Tasks 6–10. If any fail, fix the relevant generator (do not weaken the test).

- [ ] **Step 4: Run the FULL suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: all tests across all files PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add test/fixtures/shapes.ts test/parity.test.ts
git commit -m "test: multi-shape parity harness asserting shape-gated output"
```

---

### Task 14: README + end-to-end manual verification

**Files:**
- Create: `README.md` (package root — the published readme)

- [ ] **Step 1: Create `README.md`**

````markdown
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
````

- [ ] **Step 2: End-to-end manual smoke test in a scratch dir**

Run:
```bash
npm run build
mkdir -p /tmp/agentspace-e2e && cd /tmp/agentspace-e2e
node <path-to-repo>/dist/cli.js doctor   # expect: error about missing manifest.yaml
```
Expected: `✗ manifest.yaml is missing or unparseable.` and exit code 1.

(Interactive `init` is exercised manually: run `node <path-to-repo>/dist/cli.js init`,
answer the prompts, and confirm `manifest.yaml` + `memory-bank/` appear.)

- [ ] **Step 3: Final full verification**

Run: `cd <repo> && npm run typecheck && npm test && npm run build`
Expected: typecheck clean, all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: package README and v1 usage"
```

---

## Self-Review (completed during authoring)

**Spec coverage (v1 scope):**
- Manifest pillar (always) → Task 6. ✓
- Memory-bank pillar (default-on, shape-gated stubs, conditional scope rule) → Task 7. ✓
- Topology/shape gating → Tasks 2, 5, 7, 13. ✓ (single source: `src/shape.ts`)
- Pillar selection → Tasks 9, 10. ✓
- `init` (non-empty-dir clobber guard, temp-tree atomic move, `--force`) → Tasks 8, 10, 12. ✓
- `doctor` (mechanical: manifest, size budgets via single-source `budgets.ts`, staleness) → Task 11. ✓
- Robust `clone-repos.sh` (inlined array, no awk) + local-only remotes → Task 6. ✓
- `settings.local.json` git-ignored; no `agents.md` → Task 6. ✓
- Parity = owned deterministic files, date injected (no `Date.now` in pure code) → Tasks 5, 13. ✓
- Multi-shape fixtures asserting *absence* of cross-app artifacts → Task 13. ✓
- Two-mechanism rendering: plain-text via mustache (escaping off) → Task 3. ✓ (enforcement static-asset mechanism is Plan 2)

**Deferred to Plans 2/3 (intentional, noted in scope):** contracts pillar (OpenSpec
subprocess), enforcement pillar (intents + claude-code adapter + stack-agents +
Stop hook + `/ingest /query /lint`), `doctor --lint` bridge.

**Placeholder scan:** none — every step contains runnable code or an exact command.

**Type consistency:** `WorkspaceConfig`, `RepoInput` (`remote: string | null`),
`GeneratedFile`, `ManifestContext`, `WikiContext`, `DoctorFinding`, `WizardAnswers`,
`ParsedArgs` are defined once and used consistently. `generateWorkspace(config, today)`,
`runInit(config, dir, opts)`, `runChecks(dir, today)`, `parseArgs(argv)`, `render(tpl, view)`
keep stable signatures across tasks.
````
