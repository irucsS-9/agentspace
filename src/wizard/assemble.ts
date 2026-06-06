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
  enableContracts: boolean;
}

// @clack/prompts returns `undefined` for an empty text submission with no
// default, so every text field is coalesced before use — an empty answer must
// never crash generation.
const str = (v: string | undefined): string => (v ?? "").trim();

export function assembleConfig(answers: WizardAnswers): WorkspaceConfig {
  const pillars: Pillar[] = ["manifest"];
  if (answers.enableWiki) pillars.push("wiki");
  if (answers.enableEnforcement) pillars.push("enforcement");
  if (answers.enableContracts) pillars.push("contracts");

  return {
    workspaceName: str(answers.workspaceName),
    shape: answers.shape,
    repos: answers.repos.map((r) => {
      const remote = str(r.remote);
      return {
        name: str(r.name),
        remote: remote === "" ? null : remote,
        stack: str(r.stack) || "generic",
        role: str(r.role),
      };
    }),
    dependencyOrder: shapeHasDependencyOrder(answers.shape)
      ? answers.dependencyOrder
      : null,
    pillars,
    enforcement: answers.enableEnforcement ? { ...DEFAULT_ENFORCEMENT } : null,
  };
}
