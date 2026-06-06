import { buildContext } from "../context/build";
import { generateManifest } from "../generators/manifest";
import { generateMemoryBank } from "../generators/memoryBank";
import { generateEnforcementIntents } from "../generators/enforcement";
import { generateContracts } from "../generators/contracts";
import { claudeCodeAdapter } from "../adapters/claudeCode";
import { writeTree } from "../fs/writeTree";
import { runWizard } from "../wizard/run";
import { isContractLinked } from "../shape";
import type { GeneratedFile, WorkspaceConfig } from "../types";

/** Pure: config → files, honoring pillar selection. */
export function generateWorkspace(
  config: WorkspaceConfig,
  today: string,
): GeneratedFile[] {
  const ctx = buildContext(config, today);
  const files: GeneratedFile[] = [];
  // "manifest" is always present.
  files.push(...generateManifest(ctx.manifest));
  if (config.pillars.includes("wiki")) {
    files.push(...generateMemoryBank(ctx.wiki));
  }
  if (config.pillars.includes("enforcement") && ctx.enforcement) {
    const intents = generateEnforcementIntents(ctx.enforcement);
    files.push(...claudeCodeAdapter(intents, ctx.enforcement));
  }
  if (config.pillars.includes("contracts") && ctx.contracts) {
    files.push(...generateContracts(ctx.contracts));
  }
  return files;
}

export interface RunInitOptions {
  force: boolean;
  today: string;
}

export async function runInit(
  config: WorkspaceConfig,
  targetDir: string,
  opts: RunInitOptions,
): Promise<void> {
  const files = generateWorkspace(config, opts.today);
  await writeTree(files, targetDir, { force: opts.force });
}

/** Interactive entry used by the CLI. */
export async function initCommand(opts: { force: boolean; today: string }): Promise<void> {
  const config = await runWizard();
  await runInit(config, process.cwd(), opts);
  console.log(`\n✓ Created ${config.workspaceName} (${config.pillars.join(", ")}).`);
  console.log("  Next: ./clone-repos.sh");
  if (config.pillars.includes("contracts") && isContractLinked(config)) {
    console.log(
      "  Contracts: run `openspec update` to install the /opsx:* commands (install the openspec CLI first if needed).",
    );
  }
}
