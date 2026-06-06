import { afterEach, beforeEach, expect, test } from "vitest";
import { realpathSync } from "node:fs";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isDirectInvocation } from "../src/cli";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentspace-entry-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("matches when argv path is a SYMLINK to the module (the npx/global-bin case)", async () => {
  const real = join(dir, "cli.js");
  await writeFile(real, "// module");
  const link = join(dir, "bin-symlink");
  await symlink(real, link);
  // Node sets import.meta.url to the fully realpath-resolved module path; argv[1]
  // is the symlink. isDirectInvocation must resolve the symlink to match.
  const moduleUrl = pathToFileURL(realpathSync(real)).href;
  expect(isDirectInvocation(moduleUrl, link)).toBe(true);
});

test("false for a different module url", async () => {
  const real = join(dir, "cli.js");
  await writeFile(real, "// module");
  const link = join(dir, "bin-symlink");
  await symlink(real, link);
  expect(isDirectInvocation("file:///somewhere/else.js", link)).toBe(false);
});

test("false when argv path is undefined (imported, not executed)", () => {
  expect(isDirectInvocation("file:///x.js", undefined)).toBe(false);
});

test("false when argv path does not exist (realpath throws → fail safe)", () => {
  expect(isDirectInvocation("file:///x.js", "/no/such/path")).toBe(false);
});
