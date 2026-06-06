import { render } from "../renderer/render";
import { OPENSPEC_README, PROJECT_MD } from "../templates/contracts";
import type { ContractsContext, GeneratedFile } from "../types";

export function generateContracts(ctx: ContractsContext): GeneratedFile[] {
  if (!ctx.contractLinked) return [];

  const view = {
    workspaceName: ctx.workspaceName,
    repos: ctx.repos,
    hasOrder: ctx.dependencyOrder !== null && ctx.dependencyOrder.length > 0,
    order: ctx.dependencyOrder ?? [],
    hasWiki: ctx.hasWiki,
  };

  return [
    { path: "openspec/project.md", contents: render(PROJECT_MD, view) },
    { path: "openspec/README.md", contents: render(OPENSPEC_README, view) },
    { path: "openspec/specs/.gitkeep", contents: "" },
    { path: "openspec/changes/.gitkeep", contents: "" },
    { path: "openspec/changes/archive/.gitkeep", contents: "" },
  ];
}
