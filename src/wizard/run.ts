import * as p from "@clack/prompts";
import { assembleConfig, type WizardAnswers } from "./assemble";
import { shapeHasDependencyOrder } from "../shape";
import {
  validateRemote,
  validateRepoName,
  validateUniqueNames,
  validateWorkspaceName,
} from "./validate";
import type { WorkspaceConfig, WorkspaceShape } from "../types";

function cancel(value: unknown): asserts value is string {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(1);
  }
}

export async function runWizard(): Promise<WorkspaceConfig> {
  p.intro("agentspace init");

  const workspaceName = await p.text({
    message: "Workspace name",
    validate: (v) => validateWorkspaceName(v) ?? undefined,
  });
  cancel(workspaceName);

  const shape = (await p.select({
    message: "Workspace shape",
    options: [
      { value: "single-repo", label: "Single repo" },
      { value: "one-product", label: "Multi-repo, one product (backend + clients)" },
      { value: "peer-services", label: "Multi-repo, peer services (no global order)" },
      { value: "library-consumers", label: "Multi-repo, library + consumers" },
      { value: "unrelated", label: "Multi-repo, unrelated" },
    ],
  })) as WorkspaceShape;
  cancel(shape);

  const repos: WizardAnswers["repos"] = [];
  let addMore = true;
  while (addMore) {
    let name: string;
    while (true) {
      const nameInput = await p.text({
        message: `Repo #${repos.length + 1} directory name`,
        validate: (v) => validateRepoName(v) ?? undefined,
      });
      cancel(nameInput);
      const dupError = validateUniqueNames([...repos.map((r) => r.name), nameInput.trim()]);
      if (dupError) {
        p.log.error(dupError);
        continue;
      }
      name = nameInput;
      break;
    }
    const remote = await p.text({
      message: "Git remote URL (blank = local-only)",
      validate: (v) => validateRemote(v) ?? undefined,
    });
    cancel(remote);
    const stack = await p.text({ message: "Stack id (or 'generic')", placeholder: "generic" });
    cancel(stack);
    const role = await p.text({ message: "Role (one line)" });
    cancel(role);
    repos.push({ name, remote, stack: stack || "generic", role });

    if (shape === "single-repo") break;
    const more = await p.confirm({ message: "Add another repo?" });
    cancel(more as unknown as string);
    addMore = more === true;
  }

  let dependencyOrder: string[] = [];
  if (shapeHasDependencyOrder(shape) && repos.length > 1) {
    p.note(
      "Dependency order: which repo defines contracts the others consume (producer first).",
    );
    const remaining = repos.map((r) => r.name);
    while (dependencyOrder.length < remaining.length) {
      const pick = await p.select({
        message: `Position ${dependencyOrder.length + 1}`,
        options: remaining
          .filter((n) => !dependencyOrder.includes(n))
          .map((n) => ({ value: n, label: n })),
      });
      cancel(pick);
      dependencyOrder.push(pick as string);
    }
  }

  const enableWiki = await p.confirm({ message: "Include the memory-bank wiki?", initialValue: true });
  cancel(enableWiki as unknown as string);

  p.outro("Generating workspace…");
  return assembleConfig({
    workspaceName,
    shape,
    repos,
    dependencyOrder,
    enableWiki: enableWiki === true,
  });
}
