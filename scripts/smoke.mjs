#!/usr/bin/env node
/**
 * Packaged-binary smoke test.
 *
 * Builds + packs the tarball, installs it into a throwaway project, and drives
 * the REAL installed binary through its bin **symlink** — the exact path `npx`
 * and global installs use, which the unit tests cannot exercise. Catches:
 *   - the symlink entry-guard bug (bin did nothing via npx)
 *   - generation side-effects (cwd inode preserved, clone-repos.sh executable)
 *   - asset resolution from an installed package (stack-agents, the hook .cjs)
 *
 * Run: `npm run smoke`. Exits non-zero on any failure.
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
let work;
let tgz;

function run(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function fail(msg) {
  console.error("\n✗ SMOKE FAIL: " + msg);
  process.exit(1);
}
function step(msg) {
  console.log("• " + msg);
}

try {
  step("build + pack");
  run("npm run build", root);
  const packLines = run("npm pack", root).trim().split("\n").filter(Boolean);
  tgz = join(root, packLines[packLines.length - 1].trim());
  if (!existsSync(tgz)) fail("npm pack produced no tarball: " + tgz);

  work = mkdtempSync(join(tmpdir(), "agentspace-smoke-"));
  step("install tarball into " + work);
  run("npm init -y", work);
  run(`npm install "${tgz}"`, work);

  const bin = join(work, "node_modules", ".bin", "agentspace");
  if (!existsSync(bin)) fail("bin symlink not installed at " + bin);

  step("run `agentspace --version` through the symlink (the npx path)");
  const version = run(`"${bin}" --version`, work).trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail("--version printed nothing/garbage (symlink entry bug?): " + JSON.stringify(version));
  }
  console.log("  version: " + version);

  step("non-interactive `init --config` into a pre-existing empty dir");
  const ws = join(work, "ws");
  mkdirSync(ws);
  const inoBefore = statSync(ws).ino;
  const cfg = {
    workspaceName: "smoke",
    shape: "one-product",
    repos: [
      { name: "api", remote: "https://example.com/api.git", stack: "rails", role: "backend" },
      { name: "web", remote: null, stack: "nextjs", role: "frontend" },
    ],
    dependencyOrder: ["api", "web"],
    pillars: ["manifest", "wiki", "enforcement", "contracts"],
    enforcement: { mode: "auto", warmPages: 5, warmSessions: 10 },
  };
  const cfgPath = join(work, "cfg.json");
  writeFileSync(cfgPath, JSON.stringify(cfg));
  run(`"${bin}" init --config "${cfgPath}"`, ws);

  if (statSync(ws).ino !== inoBefore) {
    fail("workspace dir inode changed — a shell cd'd here would be orphaned");
  }
  for (const f of [
    "manifest.yaml",
    "clone-repos.sh",
    "memory-bank/README.md",
    ".claude/agents/api-engineer.md",
    ".claude/hooks/memory-bank-stop.cjs",
    "openspec/project.md",
  ]) {
    if (!existsSync(join(ws, f))) fail("missing generated file: " + f);
  }
  if ((statSync(join(ws, "clone-repos.sh")).mode & 0o111) === 0) {
    fail("clone-repos.sh is not executable");
  }
  console.log("  generated workspace OK (dir preserved, clone-repos.sh executable)");

  step("run `agentspace doctor` through the symlink");
  const doctorOut = run(`"${bin}" doctor`, ws);
  if (!/No issues found|openspec/.test(doctorOut)) {
    fail("doctor output unexpected: " + doctorOut);
  }

  console.log("\n✓ SMOKE PASSED");
} finally {
  if (work) rmSync(work, { recursive: true, force: true });
  if (tgz) rmSync(tgz, { force: true });
}
