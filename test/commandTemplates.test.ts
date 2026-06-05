import { expect, test } from "vitest";
import { render } from "../src/renderer/render";
import { INGEST, LINT, QUERY } from "../src/templates/commands";
import { REVIEWER_AGENT } from "../src/templates/agents";

test("ingest injects workspace name and folder list", () => {
  const out = render(INGEST, { workspaceName: "demo", folders: ["00-core", "04-business"] });
  expect(out).toContain("demo memory-bank");
  expect(out).toContain("`00-core/`");
  expect(out).toContain("`04-business/`");
  expect(out).not.toContain("{{");
});

test("lint delegates mechanical checks to doctor --lint", () => {
  const out = render(LINT, { workspaceName: "demo", folders: [] });
  expect(out).toContain("agentspace doctor --lint");
});

test("reviewer agent has read-only frontmatter (no Write)", () => {
  const out = render(REVIEWER_AGENT, { workspaceName: "demo" });
  expect(out).toMatch(/tools: Read, Grep, Glob, Bash/);
  expect(out).not.toMatch(/tools:.*Write/);
});

test("query injects workspace name with no leftover placeholders", () => {
  const out = render(QUERY, { workspaceName: "demo", folders: [] });
  expect(out).toContain("demo memory-bank");
  expect(out).not.toContain("{{");
});
