import { pathToFileURL } from "node:url";
import { initCommand } from "./commands/init";
import { doctorCommand } from "./commands/doctor";
import { VERSION } from "./version";

export interface ParsedArgs {
  command: "init" | "doctor" | "version" | "help";
  force: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const force = argv.includes("--force");
  const first = argv[0];
  if (first === "init") return { command: "init", force };
  if (first === "doctor") return { command: "doctor", force };
  if (first === "--version" || first === "-v") return { command: "version", force };
  return { command: "help", force };
}

const HELP = `agentspace — scaffold an agent-native multi-repo workspace

Usage:
  agentspace init [--force]   Interactively scaffold a workspace in the current dir
  agentspace doctor           Run mechanical health checks on a workspace
  agentspace --version        Print version
  agentspace --help           Show this help
`;

function todayIso(): string {
  // Single allowed Date() call site, kept out of all pure modules for testability.
  return new Date().toISOString().slice(0, 10);
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  switch (args.command) {
    case "init":
      await initCommand({ force: args.force, today: todayIso() });
      return 0;
    case "doctor":
      return doctorCommand(process.cwd(), todayIso());
    case "version":
      console.log(VERSION);
      return 0;
    case "help":
    default:
      console.log(HELP);
      return 0;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
