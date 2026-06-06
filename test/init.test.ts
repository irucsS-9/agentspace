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
  enforcement: null,
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
