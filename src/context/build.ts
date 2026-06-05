import { isContractLinked } from "../shape";
import type { WorkspaceConfig, WorkspaceContext } from "../types";

export function buildContext(
  config: WorkspaceConfig,
  today: string,
): WorkspaceContext {
  return {
    config,
    manifest: {
      workspaceName: config.workspaceName,
      shape: config.shape,
      repos: config.repos,
    },
    wiki: {
      workspaceName: config.workspaceName,
      shape: config.shape,
      isOneProduct: config.shape === "one-product",
      contractLinked: isContractLinked(config),
      repos: config.repos,
      dependencyOrder: config.dependencyOrder,
      today,
    },
  };
}
