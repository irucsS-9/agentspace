import { render } from "../renderer/render";
import { INGEST, LINT, QUERY } from "../templates/commands";
import { engineerToolList, resolveStackId } from "../stackAgents/loader";
import type {
  AgentDefinition,
  CommandDef,
  EnforcementContext,
  EnforcementIntents,
  HookRule,
} from "../types";

const REVIEWER_TOOLS = ["Read", "Grep", "Glob", "Bash"];

export function generateEnforcementIntents(ctx: EnforcementContext): EnforcementIntents {
  const agents: AgentDefinition[] = ctx.repos.map((repo) => ({
    name: `${repo.name}-engineer`,
    repoDir: repo.name,
    role: repo.role,
    stack: resolveStackId(repo.stack),
    boundaryRule: `You only edit files inside \`${repo.name}/\`. Never touch another repo or \`memory-bank/\` (except read-only).`,
    toolList: engineerToolList(),
    isReviewer: false,
  }));

  if (ctx.contractLinked) {
    agents.push({
      name: "cross-app-reviewer",
      repoDir: "",
      role: "read-only cross-repo reviewer",
      stack: "generic",
      boundaryRule: "Read-only. You never edit any file.",
      toolList: REVIEWER_TOOLS,
      isReviewer: true,
    });
  }

  const view = { workspaceName: ctx.workspaceName, folders: ctx.folders };
  const commands: CommandDef[] = [
    { name: "ingest", body: render(INGEST, view) },
    { name: "query", body: render(QUERY, view) },
    { name: "lint", body: render(LINT, view) },
  ];

  const hook: HookRule | null = ctx.contractLinked
    ? {
        enabled: true,
        mode: ctx.config.mode,
        warmPages: ctx.config.warmPages,
        warmSessions: ctx.config.warmSessions,
        subRepos: ctx.repos.map((r) => r.name),
      }
    : null;

  return { agents, commands, hook };
}
