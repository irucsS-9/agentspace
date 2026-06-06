import { expect, test } from "vitest";
import { buildContext } from "../src/context/build";
import type { WorkspaceConfig } from "../src/types";
import { WIKI_FOLDERS } from "../src/templates/memoryBank";

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
