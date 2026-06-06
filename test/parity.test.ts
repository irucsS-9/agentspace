import { expect, test } from "vitest";
import { generateWorkspace } from "../src/commands/init";
import { oneProduct, singleRepo, unrelated, peerServices, libraryConsumers, oneProductEnforced, singleRepoEnforced, oneProductContracts, peerServicesContracts, singleRepoContracts } from "./fixtures/shapes";

const at = (files: { path: string }[]) => files.map((f) => f.path);

test("one-product emits crossAppContracts stub", () => {
  const paths = at(generateWorkspace(oneProduct, "2026-06-05"));
  expect(paths).toContain("memory-bank/00-core/crossAppContracts.md");
});

test("single-repo does NOT emit crossAppContracts (not contract-linked)", () => {
  const paths = at(generateWorkspace(singleRepo, "2026-06-05"));
  expect(paths).not.toContain("memory-bank/00-core/crossAppContracts.md");
});

test("unrelated does NOT emit crossAppContracts and README drops product scope", () => {
  const files = generateWorkspace(unrelated, "2026-06-05");
  expect(at(files)).not.toContain("memory-bank/00-core/crossAppContracts.md");
  const readme = files.find((f) => f.path === "memory-bank/README.md")!.contents;
  expect(readme).not.toContain("product-level only");
});

test("output is deterministic for a fixed date (parity on owned files)", () => {
  const a = generateWorkspace(oneProduct, "2026-06-05");
  const b = generateWorkspace(oneProduct, "2026-06-05");
  expect(a).toEqual(b);
});

test("every emitted path is unique", () => {
  const paths = at(generateWorkspace(oneProduct, "2026-06-05"));
  expect(new Set(paths).size).toBe(paths.length);
});

test("peer-services emits crossAppContracts stub", () => {
  const paths = at(generateWorkspace(peerServices, "2026-06-05"));
  expect(paths).toContain("memory-bank/00-core/crossAppContracts.md");
});

test("library-consumers emits crossAppContracts stub", () => {
  const paths = at(generateWorkspace(libraryConsumers, "2026-06-05"));
  expect(paths).toContain("memory-bank/00-core/crossAppContracts.md");
});

test("peer-services output contains no unresolved Mustache artifacts", () => {
  const files = generateWorkspace(peerServices, "2026-06-05");
  for (const file of files) {
    expect(file.contents, `${file.path} has unresolved {{`).not.toMatch(/\{\{/);
  }
});

test("library-consumers output contains no unresolved Mustache artifacts", () => {
  const files = generateWorkspace(libraryConsumers, "2026-06-05");
  for (const file of files) {
    expect(file.contents, `${file.path} has unresolved {{`).not.toMatch(/\{\{/);
  }
});

test("one-product enforced: full .claude pack incl. hook + reviewer", () => {
  const paths = at(generateWorkspace(oneProductEnforced, "2026-06-05"));
  expect(paths).toContain(".claude/agents/cross-app-reviewer.md");
  expect(paths).toContain(".claude/hooks/memory-bank-stop.cjs");
  expect(paths).toContain(".claude/agentspace-hook.json");
});

test("single-repo enforced: agents but NO hook or reviewer", () => {
  const paths = at(generateWorkspace(singleRepoEnforced, "2026-06-05"));
  expect(paths.some((p) => p.startsWith(".claude/agents/"))).toBe(true);
  expect(paths.some((p) => p.includes("hooks/"))).toBe(false);
  expect(paths.some((p) => p.includes("cross-app-reviewer"))).toBe(false);
});

test("enforced output has no unresolved mustache artifacts", () => {
  for (const f of generateWorkspace(oneProductEnforced, "2026-06-05")) {
    expect(f.contents.includes("{{")).toBe(false);
  }
});

test("one-product contracts: emits openspec/ with project.md", () => {
  const paths = at(generateWorkspace(oneProductContracts, "2026-06-06"));
  expect(paths).toContain("openspec/project.md");
  expect(paths).toContain("openspec/changes/archive/.gitkeep");
});

test("peer-services contracts: openspec/ present, peer-framed (no dependency order clause)", () => {
  const md = generateWorkspace(peerServicesContracts, "2026-06-06")
    .find((f) => f.path === "openspec/project.md")!.contents;
  expect(md).toContain("peers");
  expect(md).not.toContain("dependency order:");
});

test("single-repo contracts: NO openspec/ (shape-suppressed)", () => {
  const paths = at(generateWorkspace(singleRepoContracts, "2026-06-06"));
  expect(paths.some((p) => p.startsWith("openspec/"))).toBe(false);
});

test("contracts output has no unresolved mustache artifacts", () => {
  for (const f of generateWorkspace(oneProductContracts, "2026-06-06")) {
    expect(f.contents.includes("{{")).toBe(false);
  }
});
