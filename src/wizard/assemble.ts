import { shapeHasDependencyOrder } from "../shape";
import type { Pillar, WorkspaceConfig, WorkspaceShape } from "../types";

export interface WizardAnswers {
  workspaceName: string;
  shape: WorkspaceShape;
  repos: { name: string; remote: string; stack: string; role: string }[];
  dependencyOrder: string[];
  enableWiki: boolean;
}

export function assembleConfig(answers: WizardAnswers): WorkspaceConfig {
  const pillars: Pillar[] = ["manifest"];
  if (answers.enableWiki) pillars.push("wiki");

  return {
    workspaceName: answers.workspaceName.trim(),
    shape: answers.shape,
    repos: answers.repos.map((r) => ({
      name: r.name.trim(),
      remote: r.remote.trim() === "" ? null : r.remote.trim(),
      stack: r.stack,
      role: r.role.trim(),
    })),
    dependencyOrder: shapeHasDependencyOrder(answers.shape)
      ? answers.dependencyOrder
      : null,
    pillars,
  };
}
