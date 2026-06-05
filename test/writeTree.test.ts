import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeTree } from "../src/fs/writeTree";
import type { GeneratedFile } from "../src/types";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentspace-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const files: GeneratedFile[] = [
  { path: "manifest.yaml", contents: "workspace: x\n" },
  { path: "memory-bank/00-core/.gitkeep", contents: "" },
  { path: "memory-bank/README.md", contents: "# wiki\n" },
];

test("writes a nested tree into an empty target", async () => {
  const target = join(dir, "ws");
  await writeTree(files, target, { force: false });
  expect(await readFile(join(target, "manifest.yaml"), "utf8")).toBe("workspace: x\n");
  expect(await readFile(join(target, "memory-bank/README.md"), "utf8")).toBe("# wiki\n");
});

test("refuses a non-empty target without force", async () => {
  const target = join(dir, "ws");
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "existing.txt"), "keep");
  await expect(writeTree(files, target, { force: false })).rejects.toThrow(/not empty/i);
  // existing file untouched
  expect(await readFile(join(target, "existing.txt"), "utf8")).toBe("keep");
});

test("with force, writes into a non-empty target and preserves unrelated files", async () => {
  const target = join(dir, "ws");
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "existing.txt"), "keep");
  await writeTree(files, target, { force: true });
  expect(await readFile(join(target, "existing.txt"), "utf8")).toBe("keep");
  expect(await readFile(join(target, "manifest.yaml"), "utf8")).toBe("workspace: x\n");
});
