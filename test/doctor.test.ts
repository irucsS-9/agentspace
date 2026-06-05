import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runChecks } from "../src/commands/doctor";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentspace-doctor-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(rel: string, contents: string) {
  const full = join(dir, rel);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, contents);
}

test("errors when manifest is missing", async () => {
  const findings = await runChecks(dir, "2026-06-05");
  expect(findings.some((f) => f.level === "error" && /manifest/i.test(f.message))).toBe(true);
});

test("warns on an over-budget page", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  const big = Array.from({ length: 801 }, (_, i) => `line ${i}`).join("\n");
  await write("memory-bank/00-core/projectOverview.md", big);
  const findings = await runChecks(dir, "2026-06-05");
  expect(findings.some((f) => f.level === "warn" && /800/.test(f.message))).toBe(true);
});

test("warns on a stale Last verified footer", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  await write(
    "memory-bank/00-core/projectOverview.md",
    "# Overview\n\n_Last verified: 2026-01-01_\n",
  );
  const findings = await runChecks(dir, "2026-06-05");
  expect(findings.some((f) => f.level === "warn" && /stale/i.test(f.message))).toBe(true);
});

test("clean workspace yields no errors", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  await write(
    "memory-bank/00-core/projectOverview.md",
    "# Overview\n\n_Last verified: 2026-06-01_\n",
  );
  const findings = await runChecks(dir, "2026-06-05");
  expect(findings.some((f) => f.level === "error")).toBe(false);
});
