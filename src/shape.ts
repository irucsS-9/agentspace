import type { WorkspaceConfig, WorkspaceShape } from "./types";

const CONTRACT_SHAPES: ReadonlySet<WorkspaceShape> = new Set([
  "one-product",
  "peer-services",
  "library-consumers",
]);

const ORDERED_SHAPES: ReadonlySet<WorkspaceShape> = new Set([
  "one-product",
  "library-consumers",
]);

export function shapeHasContracts(shape: WorkspaceShape): boolean {
  return CONTRACT_SHAPES.has(shape);
}

export function shapeHasDependencyOrder(shape: WorkspaceShape): boolean {
  return ORDERED_SHAPES.has(shape);
}

/** A workspace earns cross-app artifacts only with a contract shape and ≥2 repos. */
export function isContractLinked(config: WorkspaceConfig): boolean {
  return shapeHasContracts(config.shape) && config.repos.length >= 2;
}
