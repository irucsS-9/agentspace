import { expect, test } from "vitest";
import { generateManifest } from "../src/generators/manifest";
import type { ManifestContext } from "../src/types";

const ctx: ManifestContext = {
  workspaceName: "cork",
  shape: "one-product",
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: null, stack: "nextjs", role: "frontend" },
  ],
  contractLinked: false,
  enforcement: null,
};

test("emits the expected file set", () => {
  const files = generateManifest(ctx);
  const paths = files.map((f) => f.path).sort();
  expect(paths).toEqual(
    [".gitignore", "CLAUDE.md", "README.md", "clone-repos.sh", "manifest.yaml"].sort(),
  );
});

test("manifest lists each repo with local-only remote blank", () => {
  const yaml = generateManifest(ctx).find((f) => f.path === "manifest.yaml")!.contents;
  expect(yaml).toContain("- name: api");
  expect(yaml).toContain("remote: git@x:api.git");
  expect(yaml).toContain("- name: web");
  expect(yaml).toContain("remote: \n");
});

test("clone script inlines repos and gitignore excludes repo dirs + local settings", () => {
  const files = generateManifest(ctx);
  const sh = files.find((f) => f.path === "clone-repos.sh")!.contents;
  expect(sh).toContain('"api\tgit@x:api.git"');
  expect(sh).toContain('"web\t"'); // local-only, empty remote
  const ignore = files.find((f) => f.path === ".gitignore")!.contents;
  expect(ignore).toContain("api/");
  expect(ignore).toContain("web/");
  expect(ignore).toContain("**/.claude/settings.local.json");
});

test("clone script uses resilient clone (reports FAILED and continues on error)", () => {
  const files = generateManifest(ctx);
  const sh = files.find((f) => f.path === "clone-repos.sh")!.contents;
  expect(sh).toContain("FAILED");
});
