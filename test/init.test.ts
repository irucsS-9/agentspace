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
