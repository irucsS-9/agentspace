import { expect, test } from "vitest";
import { claudeCodeAdapter } from "../src/adapters/claudeCode";
import { generateEnforcementIntents } from "../src/generators/enforcement";
import type { EnforcementContext } from "../src/types";

const ctx: EnforcementContext = {
  workspaceName: "cork",
  shape: "one-product",
  contractLinked: true,
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: null, stack: "nextjs", role: "frontend" },
  ],
  config: { mode: "auto", warmPages: 5, warmSessions: 10 },
  folders: ["00-core", "04-business"],
};

test("emits agents, commands, hook, sidecar, settings", () => {
  const files = claudeCodeAdapter(generateEnforcementIntents(ctx), ctx);
  const paths = files.map((f) => f.path);
  expect(paths).toContain(".claude/agents/api-engineer.md");
  expect(paths).toContain(".claude/agents/cross-app-reviewer.md");
  expect(paths).toContain(".claude/commands/ingest.md");
  expect(paths).toContain(".claude/hooks/memory-bank-stop.cjs");
  expect(paths).toContain(".claude/agentspace-hook.json");
  expect(paths).toContain(".claude/settings.json");
});

test("rails engineer agent is rendered from the rails stack with injected boundary", () => {
  const files = claudeCodeAdapter(generateEnforcementIntents(ctx), ctx);
  const agent = files.find((f) => f.path === ".claude/agents/api-engineer.md")!.contents;
  expect(agent).toContain("name: api-engineer");
  expect(agent).toContain("Rails engineer");
  expect(agent).toContain("api/"); // boundary injected
  expect(agent).not.toContain("{{"); // no unresolved placeholders
});

test("reviewer agent has no Write tool", () => {
  const files = claudeCodeAdapter(generateEnforcementIntents(ctx), ctx);
  const reviewer = files.find((f) => f.path === ".claude/agents/cross-app-reviewer.md")!.contents;
  expect(reviewer).toMatch(/tools: Read, Grep, Glob, Bash/);
});

test("sidecar carries the hook config; settings wires the hook", () => {
  const files = claudeCodeAdapter(generateEnforcementIntents(ctx), ctx);
  const sidecar = JSON.parse(files.find((f) => f.path === ".claude/agentspace-hook.json")!.contents);
  expect(sidecar.subRepos).toEqual(["api", "web"]);
  expect(sidecar.mode).toBe("auto");
  const settings = JSON.parse(files.find((f) => f.path === ".claude/settings.json")!.contents);
  expect(JSON.stringify(settings)).toContain("memory-bank-stop.cjs");
  expect(JSON.stringify(settings)).toContain("$CLAUDE_PROJECT_DIR");
});

test("non-contract shape: no hook, sidecar, reviewer, or settings", () => {
  const single = { ...ctx, shape: "single-repo" as const, contractLinked: false, repos: [ctx.repos[0]] };
  const files = claudeCodeAdapter(generateEnforcementIntents(single), single);
  const paths = files.map((f) => f.path);
  expect(paths).toContain(".claude/agents/api-engineer.md");
  expect(paths.some((p) => p.includes("hooks/"))).toBe(false);
  expect(paths).not.toContain(".claude/agentspace-hook.json");
  expect(paths).not.toContain(".claude/settings.json");
  expect(paths.some((p) => p.includes("cross-app-reviewer"))).toBe(false);
});
