import { expect, test } from "vitest";
import { validateConfig } from "../src/config";

test("a complete valid config passes through", () => {
  const cfg = validateConfig({
    workspaceName: "ws",
    shape: "one-product",
    repos: [{ name: "api", remote: "https://x/a", stack: "rails", role: "backend" }],
    dependencyOrder: ["api"],
    pillars: ["manifest", "wiki", "enforcement"],
    enforcement: { mode: "block", warmPages: 3, warmSessions: 7 },
  });
  expect(cfg.workspaceName).toBe("ws");
  expect(cfg.enforcement).toEqual({ mode: "block", warmPages: 3, warmSessions: 7 });
});

test("defaults: empty remote → null, missing stack → generic, missing pillars → manifest+wiki", () => {
  const cfg = validateConfig({
    workspaceName: "ws",
    shape: "single-repo",
    repos: [{ name: "app", remote: "", role: "the app" }],
  });
  expect(cfg.repos[0].remote).toBeNull();
  expect(cfg.repos[0].stack).toBe("generic");
  expect(cfg.pillars).toEqual(["manifest", "wiki"]);
  expect(cfg.enforcement).toBeNull();
});

test("enforcement pillar without an enforcement object uses defaults", () => {
  const cfg = validateConfig({
    workspaceName: "ws",
    shape: "one-product",
    repos: [{ name: "a", role: "x" }, { name: "b", role: "y" }],
    pillars: ["manifest", "enforcement"],
  });
  expect(cfg.enforcement).toEqual({ mode: "auto", warmPages: 5, warmSessions: 10 });
});

test("always ensures the manifest pillar is present and first", () => {
  const cfg = validateConfig({
    workspaceName: "w",
    shape: "single-repo",
    repos: [{ name: "a", role: "x" }],
    pillars: ["wiki"],
  });
  expect(cfg.pillars[0]).toBe("manifest");
});

test("rejects missing workspaceName, bad shape, and empty repos", () => {
  expect(() => validateConfig({ shape: "one-product", repos: [{ name: "a" }] })).toThrow(/workspaceName/);
  expect(() => validateConfig({ workspaceName: "w", shape: "nope", repos: [{ name: "a" }] })).toThrow(/shape/);
  expect(() => validateConfig({ workspaceName: "w", shape: "one-product", repos: [] })).toThrow(/repos/);
  expect(() => validateConfig("not an object")).toThrow(/JSON object/);
});
