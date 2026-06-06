import { expect, test } from "vitest";
import { assembleConfig, type WizardAnswers } from "../src/wizard/assemble";

// @clack/prompts returns `undefined` for an empty text submission with no
// default. These simulate that to guard against the "Cannot read properties of
// undefined (reading 'trim')" crash.

test("undefined role/stack do not crash; sensible defaults applied", () => {
  const answers = {
    workspaceName: "ws",
    shape: "one-product",
    repos: [
      { name: "api", remote: "git@x:api.git", stack: undefined, role: undefined },
    ],
    dependencyOrder: ["api"],
    enableWiki: true,
    enableEnforcement: false,
    enableContracts: false,
  } as unknown as WizardAnswers;

  const cfg = assembleConfig(answers);
  expect(cfg.repos[0].role).toBe("");
  expect(cfg.repos[0].stack).toBe("generic");
  expect(cfg.repos[0].remote).toBe("git@x:api.git");
});

test("undefined remote becomes local-only (null)", () => {
  const answers = {
    workspaceName: "ws",
    shape: "single-repo",
    repos: [{ name: "app", remote: undefined, stack: "go", role: "the app" }],
    dependencyOrder: [],
    enableWiki: true,
    enableEnforcement: false,
    enableContracts: false,
  } as unknown as WizardAnswers;

  expect(assembleConfig(answers).repos[0].remote).toBeNull();
});

test("undefined workspace name coalesces to empty string, does not throw", () => {
  const answers = {
    workspaceName: undefined,
    shape: "single-repo",
    repos: [{ name: "app", remote: "", stack: "go", role: "x" }],
    dependencyOrder: [],
    enableWiki: false,
    enableEnforcement: false,
    enableContracts: false,
  } as unknown as WizardAnswers;

  expect(() => assembleConfig(answers)).not.toThrow();
  expect(assembleConfig(answers).workspaceName).toBe("");
});
