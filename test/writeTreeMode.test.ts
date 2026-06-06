import { afterEach, beforeEach, expect, test } from "vitest";
import { existsSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeTree } from "../src/fs/writeTree";
import { generateManifest } from "../src/generators/manifest";
import type { GeneratedFile, ManifestContext } from "../src/types";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentspace-mode-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("writeTree applies an executable file mode", async () => {
  const files: GeneratedFile[] = [
    { path: "run.sh", contents: "#!/bin/sh\necho hi\n", mode: 0o755 },
  ];
  const target = join(dir, "ws");
  await writeTree(files, target, { force: false });
  const mode = statSync(join(target, "run.sh")).mode & 0o777;
  expect(mode & 0o111).toBeTruthy(); // at least one executable bit set
});

test("writeTree into a pre-existing empty dir preserves the directory (inode)", async () => {
  const target = join(dir, "ws");
  await mkdir(target); // the dir already exists (e.g. the user's cwd)
  const before = statSync(target).ino;
  await writeTree(
    [{ path: "manifest.yaml", contents: "workspace: x\n" }],
    target,
    { force: false },
  );
  // Same directory inode → a shell cd'd here still sees the new files.
  expect(statSync(target).ino).toBe(before);
  expect(existsSync(join(target, "manifest.yaml"))).toBe(true);
});

test("generateManifest marks clone-repos.sh executable (0o755)", () => {
  const ctx: ManifestContext = {
    workspaceName: "x",
    shape: "one-product",
    repos: [{ name: "a", remote: null, stack: "go", role: "x" }],
    contractLinked: false,
    enforcement: null,
    hasContracts: false,
  };
  const clone = generateManifest(ctx).find((f) => f.path === "clone-repos.sh");
  expect(clone?.mode).toBe(0o755);
});
