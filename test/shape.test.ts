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
  enforcement: null,
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
