import { readFileSync } from "node:fs";
import { DEFAULT_ENFORCEMENT } from "./types";
import type { HookMode, Pillar, WorkspaceConfig, WorkspaceShape } from "./types";

const SHAPES: WorkspaceShape[] = [
  "single-repo",
  "one-product",
  "peer-services",
  "library-consumers",
  "unrelated",
];
const PILLARS: Pillar[] = ["manifest", "wiki", "contracts", "enforcement"];
const MODES: HookMode[] = ["auto", "warn", "block"];

/**
 * Validate and normalize a plain object into a WorkspaceConfig. Used by the
 * non-interactive `init --config <file>` path (and the smoke test). Lenient on
 * optional fields, strict on the ones generation depends on.
 */
export function validateConfig(raw: unknown): WorkspaceConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("config must be a JSON object");
  }
  const o = raw as Record<string, unknown>;

  const workspaceName =
    typeof o.workspaceName === "string" ? o.workspaceName.trim() : "";
  if (!workspaceName) throw new Error("config.workspaceName is required");

  if (typeof o.shape !== "string" || !SHAPES.includes(o.shape as WorkspaceShape)) {
    throw new Error(`config.shape must be one of: ${SHAPES.join(", ")}`);
  }
  const shape = o.shape as WorkspaceShape;

  if (!Array.isArray(o.repos) || o.repos.length === 0) {
    throw new Error("config.repos must be a non-empty array");
  }
  const repos = o.repos.map((r, i) => {
    const rr = (r ?? {}) as Record<string, unknown>;
    const name = typeof rr.name === "string" ? rr.name.trim() : "";
    if (!name) throw new Error(`config.repos[${i}].name is required`);
    const remote =
      typeof rr.remote === "string" && rr.remote.trim() !== ""
        ? rr.remote.trim()
        : null;
    const stack =
      typeof rr.stack === "string" && rr.stack.trim() ? rr.stack.trim() : "generic";
    const role = typeof rr.role === "string" ? rr.role.trim() : "";
    return { name, remote, stack, role };
  });

  let pillars: Pillar[] = Array.isArray(o.pillars)
    ? o.pillars.filter((p): p is Pillar => PILLARS.includes(p as Pillar))
    : ["manifest", "wiki"];
  if (pillars.length === 0) pillars = ["manifest", "wiki"];
  if (!pillars.includes("manifest")) pillars = ["manifest", ...pillars];

  const dependencyOrder = Array.isArray(o.dependencyOrder)
    ? o.dependencyOrder.filter((s): s is string => typeof s === "string")
    : null;

  let enforcement: WorkspaceConfig["enforcement"] = null;
  if (pillars.includes("enforcement")) {
    const e = (o.enforcement ?? {}) as Record<string, unknown>;
    enforcement = {
      mode: MODES.includes(e.mode as HookMode)
        ? (e.mode as HookMode)
        : DEFAULT_ENFORCEMENT.mode,
      warmPages:
        typeof e.warmPages === "number" ? e.warmPages : DEFAULT_ENFORCEMENT.warmPages,
      warmSessions:
        typeof e.warmSessions === "number"
          ? e.warmSessions
          : DEFAULT_ENFORCEMENT.warmSessions,
    };
  }

  return { workspaceName, shape, repos, dependencyOrder, pillars, enforcement };
}

/** Read + validate a JSON config file into a WorkspaceConfig. */
export function loadConfig(path: string): WorkspaceConfig {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Cannot read config file: ${path}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`config file is not valid JSON: ${path}`);
  }
  return validateConfig(parsed);
}
