import { isContractLinked } from "../shape";
import { WIKI_FOLDERS } from "../templates/memoryBank";
import type { WorkspaceConfig, WorkspaceContext } from "../types";

export function buildContext(
  config: WorkspaceConfig,
  today: string,
): WorkspaceContext {
  const pillars = config.pillars;
  const contractLinked = isContractLinked(config);
  const hasContracts = pillars.includes("contracts") && contractLinked;

  return {
    config,
    manifest: {
      workspaceName: config.workspaceName,
      shape: config.shape,
      repos: config.repos,
      contractLinked,
      enforcement: config.enforcement,
      hasContracts,
    },
    wiki: {
      workspaceName: config.workspaceName,
      shape: config.shape,
      isOneProduct: config.shape === "one-product",
      contractLinked,
      repos: config.repos,
      dependencyOrder: config.dependencyOrder,
      today,
      hasContracts,
    },
    enforcement: config.enforcement
      ? {
          workspaceName: config.workspaceName,
          shape: config.shape,
          contractLinked,
          repos: config.repos,
          config: { ...config.enforcement },
          folders: WIKI_FOLDERS,
        }
      : null,
    contracts: pillars.includes("contracts")
      ? {
          workspaceName: config.workspaceName,
          shape: config.shape,
          contractLinked,
          repos: config.repos,
          dependencyOrder: config.dependencyOrder,
          hasWiki: pillars.includes("wiki"),
        }
      : null,
  };
}
