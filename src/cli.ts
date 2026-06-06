import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { initCommand } from "./commands/init";
import { doctorCommand } from "./commands/doctor";
import { VERSION } from "./version";

export interface ParsedArgs {
  command: "init" | "doctor" | "version" | "help";
  force: boolean;
  lint: boolean;
  configPath?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const force = argv.includes("--force");
  const lint = argv.includes("--lint");
  const ci = argv.indexOf("--config");
  const configPath = ci >= 0 ? argv[ci + 1] : undefined;
  const first = argv[0];
  if (first === "init") return { command: "init", force, lint, configPath };
  if (first === "doctor") return { command: "doctor", force, lint, configPath };
  if (first === "--version" || first === "-v") return { command: "version", force, lint, configPath };
  return { command: "help", force, lint, configPath };
}

const HELP = `agentspace — scaffold an agent-native multi-repo workspace

Usage:
  agentspace init [--force]            Interactively scaffold a workspace in the current dir
  agentspace init --config <file>      Scaffold non-interactively from a JSON config
  agentspace doctor [--lint]           Run mechanical health checks (--lint = JSON output)
  agentspace --version                 Print version
  agentspace --help                    Show this help
`;

function todayIso(): string {
  // Single allowed Date() call site, kept out of all pure modules for testability.
  return new Date().toISOString().slice(0, 10);
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  switch (args.command) {
    case "init":
      await initCommand({ force: args.force, today: todayIso(), configPath: args.configPath });
      return 0;
    case "doctor":
      return doctorCommand(process.cwd(), todayIso(), { lint: args.lint });
    case "version":
      console.log(VERSION);
      return 0;
    case "help":
    default:
      console.log(HELP);
      return 0;
  }
}

/**
 * True when this module is the process entry point. `process.argv[1]` is the
 * path as typed/symlinked (npm/npx install the bin as a symlink), so it must be
 * resolved to its real path before comparing — otherwise a symlinked invocation
 * (every `npx`/global-install run) never matches and `main()` never fires.
 */
export function isDirectInvocation(
  moduleUrl: string,
  argvPath: string | undefined,
): boolean {
  if (!argvPath) return false;
  try {
    return moduleUrl === pathToFileURL(realpathSync(argvPath)).href;
  } catch {
    return false;
  }
}

if (isDirectInvocation(import.meta.url, process.argv[1])) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
