import { expect, test } from "vitest";
import { assembleConfig, type WizardAnswers } from "../src/wizard/assemble";

const answers: WizardAnswers = {
  workspaceName: "cork",
  shape: "one-product",
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: "", stack: "nextjs", role: "frontend" },
  ],
  dependencyOrder: ["api", "web"],
  enableWiki: true,
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
