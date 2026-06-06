import { expect, test } from "vitest";
import { assembleConfig, type WizardAnswers } from "../src/wizard/assemble";
import { DEFAULT_ENFORCEMENT } from "../src/types";

const answers: WizardAnswers = {
  workspaceName: "cork",
  shape: "one-product",
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: "", stack: "nextjs", role: "frontend" },
  ],
  dependencyOrder: ["api", "web"],
  enableWiki: true,
  enableEnforcement: false,
  enableContracts: false,
};

test("assembles a config, mapping empty remote to null", () => {
  const cfg = assembleConfig(answers);
  expect(cfg.repos[1].remote).toBeNull();
  expect(cfg.pillars).toEqual(["manifest", "wiki"]);
});

test("drops dependency order for shapes without one", () => {
  const cfg = assembleConfig({ ...answers, shape: "unrelated", dependencyOrder: ["api", "web"] });
  expect(cfg.dependencyOrder).toBeNull();
});

test("omits wiki pillar when disabled", () => {
  const cfg = assembleConfig({ ...answers, enableWiki: false });
  expect(cfg.pillars).toEqual(["manifest"]);
});

test("enforcement pillar + default config when enabled", () => {
  const cfg = assembleConfig({ ...answers, enableEnforcement: true });
  expect(cfg.pillars).toContain("enforcement");
  expect(cfg.enforcement).toEqual(DEFAULT_ENFORCEMENT);
});

test("no enforcement pillar or config when disabled", () => {
  const cfg = assembleConfig({ ...answers, enableEnforcement: false });
  expect(cfg.pillars).not.toContain("enforcement");
  expect(cfg.enforcement).toBeNull();
});

test("contracts pillar when enabled", () => {
  const cfg = assembleConfig({ ...answers, enableContracts: true });
  expect(cfg.pillars).toContain("contracts");
});

test("no contracts pillar when disabled", () => {
  const cfg = assembleConfig({ ...answers, enableContracts: false });
  expect(cfg.pillars).not.toContain("contracts");
});
