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
    hasContracts: false,
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
