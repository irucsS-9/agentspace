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
