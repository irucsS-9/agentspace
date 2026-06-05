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
