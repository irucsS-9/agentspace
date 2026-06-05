import { expect, test } from "vitest";
import { resolveStackId, loadStackBody, engineerToolList } from "../src/stackAgents/loader";

test("resolves a known id and its aliases", () => {
  expect(resolveStackId("rails")).toBe("rails");
  expect(resolveStackId("ror")).toBe("rails");
  expect(resolveStackId("golang")).toBe("go");
});

test("unknown stack falls back to _generic", () => {
  expect(resolveStackId("cobol")).toBe("_generic");
  expect(resolveStackId("generic")).toBe("_generic");
});

test("loadStackBody returns frontmatter+body for a known stack", () => {
  const body = loadStackBody("rails");
  expect(body).toContain("Rails engineer");
  expect(body).toContain("{{repoName}}");
});

test("loadStackBody falls back to _generic for unknown", () => {
  const body = loadStackBody("cobol");
  expect(body).toContain("{{repoName}}-engineer");
});

test("engineerToolList comes from the registry", () => {
  expect(engineerToolList()).toEqual(["Read", "Write", "Edit", "MultiEdit", "Bash", "Grep", "Glob"]);
});
