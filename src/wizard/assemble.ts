import { shapeHasDependencyOrder } from "../shape";
import { DEFAULT_ENFORCEMENT } from "../types";
import type { Pillar, WorkspaceConfig, WorkspaceShape } from "../types";

export interface WizardAnswers {
  workspaceName: string;
  shape: WorkspaceShape;
  repos: { name: string; remote: string; stack: string; role: string }[];
  dependencyOrder: string[];
  enableWiki: boolean;
  enableEnforcement: boolean;
}

export function assembleConfig(answers: WizardAnswers): WorkspaceConfig {
  const pillars: Pillar[] = ["manifest"];
  if (answers.enableWiki) pillars.push("wiki");
  if (answers.enableEnforcement) pillars.push("enforcement");

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
    enforcement: answers.enableEnforcement ? { ...DEFAULT_ENFORCEMENT } : null,
  };
}
