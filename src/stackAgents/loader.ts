import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { packageDir } from "../paths";

interface Registry {
  stacks: { id: string; displayName: string; aliases: string[] }[];
  engineerTools: string[];
}

function stacksDir(): string {
  return packageDir("stack-agents");
}

let cached: Registry | null = null;
function registry(): Registry {
  if (!cached) {
    cached = parse(readFileSync(join(stacksDir(), "stacks.yaml"), "utf8")) as Registry;
  }
  return cached;
}

export function engineerToolList(): string[] {
  return registry().engineerTools;
}

/** Map a wizard stack input to a stack id, or "_generic" if unknown. */
export function resolveStackId(input: string): string {
  const norm = input.trim().toLowerCase();
  if (norm === "" || norm === "generic" || norm === "_generic") return "_generic";
  for (const s of registry().stacks) {
    if (s.id === norm || s.aliases.includes(norm)) return s.id;
  }
  return "_generic";
}

/** Load a stack body by id; falls back to _generic.md (with a warning) if missing. */
export function loadStackBody(input: string): string {
  const id = resolveStackId(input);
  const file = join(stacksDir(), `${id}.md`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  // Registered id with no backing file — should be caught by tests, but fall back.
  console.warn(`agentspace: stack file ${id}.md missing; using _generic`);
  return readFileSync(join(stacksDir(), "_generic.md"), "utf8");
}
