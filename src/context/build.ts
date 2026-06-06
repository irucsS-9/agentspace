import { isContractLinked } from "../shape";
import { WIKI_FOLDERS } from "../templates/memoryBank";
import type { WorkspaceConfig, WorkspaceContext } from "../types";

export function buildContext(
  config: WorkspaceConfig,
  today: string,
): WorkspaceContext {
  const pillars = config.pillars;
  const hasContracts = pillars.includes("contracts") && isContractLinked(config);

  return {
    config,
    manifest: {
      workspaceName: config.workspaceName,
      shape: config.shape,
      repos: config.repos,
      contractLinked: isContractLinked(config),
      enforcement: config.enforcement,
      hasContracts,
    },
    wiki: {
      workspaceName: config.workspaceName,
      shape: config.shape,
      isOneProduct: config.shape === "one-product",
      contractLinked: isContractLinked(config),
      repos: config.repos,
      dependencyOrder: config.dependencyOrder,
      today,
      hasContracts,
    },
    enforcement: config.enforcement
      ? {
          workspaceName: config.workspaceName,
          shape: config.shape,
          contractLinked: isContractLinked(config),
          repos: config.repos,
          config: { ...config.enforcement },
          folders: WIKI_FOLDERS,
        }
      : null,
    contracts: pillars.includes("contracts")
      ? {
          workspaceName: config.workspaceName,
          shape: config.shape,
          contractLinked: isContractLinked(config),
          repos: config.repos,
          dependencyOrder: config.dependencyOrder,
          hasWiki: pillars.includes("wiki"),
        }
      : null,
  };
}
