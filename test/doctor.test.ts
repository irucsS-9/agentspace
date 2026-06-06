import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runChecks, formatLintJson } from "../src/commands/doctor";

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

test("formatLintJson emits a findings document", () => {
  const out = formatLintJson([{ level: "warn", message: "x too big" }]);
  expect(JSON.parse(out)).toEqual({ findings: [{ level: "warn", message: "x too big" }] });
});

test("warns when openspec/ exists but the openspec CLI is absent", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  await write("openspec/project.md", "# contracts\n");
  const findings = await runChecks(dir, "2026-06-06", { openspecAvailable: () => false });
  expect(findings.some((f) => f.level === "warn" && /openspec/i.test(f.message))).toBe(true);
});

test("no openspec warning when the CLI is present", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  await write("openspec/project.md", "# contracts\n");
  const findings = await runChecks(dir, "2026-06-06", { openspecAvailable: () => true });
  expect(findings.some((f) => /openspec/i.test(f.message))).toBe(false);
});

test("no openspec warning when there is no openspec/ dir", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  const findings = await runChecks(dir, "2026-06-06", { openspecAvailable: () => false });
  expect(findings.some((f) => /openspec/i.test(f.message))).toBe(false);
});

test("formatLintJson on a clean workspace yields empty findings", async () => {
  await write("manifest.yaml", "workspace: x\nrepos:\n  - name: a\n");
  await write("memory-bank/00-core/projectOverview.md", "# o\n\n_Last verified: 2026-06-01_\n");
  const findings = await runChecks(dir, "2026-06-06", { openspecAvailable: () => true });
  expect(JSON.parse(formatLintJson(findings))).toEqual({ findings: [] });
});
