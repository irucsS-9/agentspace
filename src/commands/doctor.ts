import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { parse } from "yaml";
import { SIZE_BUDGETS, STALE_DAYS } from "../budgets";

export interface DoctorFinding {
  level: "error" | "warn" | "info";
  message: string;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.floor((to - from) / 86_400_000);
}

export async function runChecks(
  workspaceDir: string,
  today: string,
): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  // 1. Manifest validity.
  try {
    const raw = await readFile(join(workspaceDir, "manifest.yaml"), "utf8");
    const doc = parse(raw) as { repos?: unknown[] } | null;
    if (!doc || !Array.isArray(doc.repos) || doc.repos.length === 0) {
      findings.push({ level: "error", message: "manifest.yaml has no repos." });
    }
  } catch {
    findings.push({ level: "error", message: "manifest.yaml is missing or unparseable." });
  }

  // 2. Memory-bank size budgets + staleness.
  const mbDir = join(workspaceDir, "memory-bank");
  const files = await walk(mbDir);
  for (const full of files) {
    const rel = relative(workspaceDir, full).split("\\").join("/");
    if (!rel.endsWith(".md")) continue;
    const contents = await readFile(full, "utf8");
    const lineCount = contents.split("\n").length;

    const budget = SIZE_BUDGETS.find((b) => b.match(rel));
    if (budget && lineCount > budget.cap) {
      findings.push({
        level: "warn",
        message: `${rel}: ${lineCount} lines exceeds cap of ${budget.cap} (${budget.label}). Split or archive.`,
      });
    }

    const match = contents.match(/_Last verified:\s*(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const age = daysBetween(match[1], today);
      if (age > STALE_DAYS) {
        findings.push({
          level: "warn",
          message: `${rel}: stale — last verified ${age} days ago (> ${STALE_DAYS}). Re-verify.`,
        });
      }
    }
  }

  if (findings.length === 0) {
    findings.push({ level: "info", message: "No issues found." });
  }
  return findings;
}

export async function doctorCommand(workspaceDir: string, today: string): Promise<number> {
  const findings = await runChecks(workspaceDir, today);
  for (const f of findings) {
    const tag = f.level === "error" ? "✗" : f.level === "warn" ? "!" : "·";
    console.log(`${tag} ${f.message}`);
  }
  return findings.some((f) => f.level === "error") ? 1 : 0;
}
