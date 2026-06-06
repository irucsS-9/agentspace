import { execSync } from "node:child_process";

/** True when the external `openspec` CLI is resolvable on PATH. */
export function openspecAvailable(): boolean {
  try {
    execSync("command -v openspec", { stdio: "ignore", shell: "/bin/sh" });
    return true;
  } catch {
    return false;
  }
}
