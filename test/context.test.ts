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
