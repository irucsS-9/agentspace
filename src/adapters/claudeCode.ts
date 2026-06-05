import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../renderer/render";
import { REVIEWER_AGENT } from "../templates/agents";
import { loadStackBody } from "../stackAgents/loader";
import { packageDir } from "../paths";
import type {
  AgentDefinition,
  EnforcementContext,
  EnforcementIntents,
  GeneratedFile,
} from "../types";

const HOOK_ASSET = "memory-bank-stop.cjs";

function renderAgent(agent: AgentDefinition, workspaceName: string): string {
  if (agent.isReviewer) {
    return render(REVIEWER_AGENT, { workspaceName });
  }
  const body = loadStackBody(agent.stack);
  return render(body, {
    repoName: agent.repoDir,
    repoDir: agent.repoDir,
    role: agent.role,
    boundaryRule: agent.boundaryRule,
  });
}

export function claudeCodeAdapter(
  intents: EnforcementIntents,
  ctx: EnforcementContext,
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  for (const agent of intents.agents) {
    files.push({
      path: `.claude/agents/${agent.name}.md`,
      contents: renderAgent(agent, ctx.workspaceName),
    });
  }

  for (const cmd of intents.commands) {
    files.push({ path: `.claude/commands/${cmd.name}.md`, contents: cmd.body });
  }

  if (intents.hook) {
    const hookSource = readFileSync(join(packageDir("assets"), HOOK_ASSET), "utf8");
    files.push({ path: `.claude/hooks/${HOOK_ASSET}`, contents: hookSource });
    files.push({
      path: ".claude/agentspace-hook.json",
      contents: JSON.stringify(
        {
          mode: intents.hook.mode,
          warmPages: intents.hook.warmPages,
          warmSessions: intents.hook.warmSessions,
          subRepos: intents.hook.subRepos,
        },
        null,
        2,
      ) + "\n",
    });
    files.push({
      path: ".claude/settings.json",
      contents: JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                matcher: "*",
                hooks: [
                  {
                    type: "command",
                    command: `node "$CLAUDE_PROJECT_DIR/.claude/hooks/${HOOK_ASSET}"`,
                    timeout: 10,
                    statusMessage: "Checking memory bank...",
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ) + "\n",
    });
  }

  return files;
}
