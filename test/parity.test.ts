import { expect, test } from "vitest";
import { generateWorkspace } from "../src/commands/init";
import { oneProduct, singleRepo, unrelated } from "./fixtures/shapes";

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
