import { render } from "../renderer/render";
import {
  CROSS_APP_CONTRACTS,
  PROJECT_OVERVIEW,
  WIKI_FOLDERS,
  WIKI_INDEX,
  WIKI_LOG,
  WIKI_README,
} from "../templates/memoryBank";
import type { GeneratedFile, WikiContext } from "../types";

export function generateMemoryBank(ctx: WikiContext): GeneratedFile[] {
  const view = {
    workspaceName: ctx.workspaceName,
    isOneProduct: ctx.isOneProduct,
    repoCount: ctx.repos.length,
    repos: ctx.repos,
    dependencyOrder: ctx.dependencyOrder ?? [],
    today: ctx.today,
    hasContracts: ctx.hasContracts,
  };

  const files: GeneratedFile[] = [];

  // Numbered folders need a tracked placeholder (git ignores empty dirs).
  for (const folder of WIKI_FOLDERS) {
    files.push({ path: `memory-bank/${folder}/.gitkeep`, contents: "" });
  }

  files.push(
    { path: "memory-bank/README.md", contents: render(WIKI_README, view) },
    { path: "memory-bank/index.md", contents: render(WIKI_INDEX, view) },
    { path: "memory-bank/log.md", contents: render(WIKI_LOG, view) },
    {
      path: "memory-bank/00-core/projectOverview.md",
      contents: render(PROJECT_OVERVIEW, view),
    },
  );

  if (ctx.contractLinked) {
    files.push({
      path: "memory-bank/00-core/crossAppContracts.md",
      contents: render(CROSS_APP_CONTRACTS, view),
    });
  }

  return files;
}
