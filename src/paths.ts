import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locate the installed package root by walking up from this module until a
 * directory containing package.json is found. Works in dev (src/…) and in the
 * bundled dist (dist/cli.js), and after npm install (node_modules/agentspace).
 */
export function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("agentspace: could not locate package root from " + import.meta.url);
}

export function packageDir(name: string): string {
  return join(packageRoot(), name);
}
