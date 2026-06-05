export type WorkspaceShape =
  | "single-repo"
  | "one-product"
  | "peer-services"
  | "library-consumers"
  | "unrelated";

export type Pillar = "manifest" | "wiki" | "contracts" | "enforcement";

export interface RepoInput {
  /** Directory name; filesystem-safe and unique within the workspace. */
  name: string;
  /** Git remote URL, or null for a local-only repo. */
  remote: string | null;
  /** Stack id (resolves to a stack-agent later) or "generic". */
  stack: string;
  /** Free-text role, e.g. "backend system of record". */
  role: string;
}

export interface WorkspaceConfig {
  workspaceName: string;
  shape: WorkspaceShape;
  repos: RepoInput[];
  /** Ordered repo names (producer first), or null when the shape has no order. */
  dependencyOrder: string[] | null;
  /** Selected pillars. "manifest" is always present. */
  pillars: Pillar[];
}

/** A file to write, path relative to the workspace root. Generators are pure. */
export interface GeneratedFile {
  path: string;
  contents: string;
}

export interface ManifestContext {
  workspaceName: string;
  shape: WorkspaceShape;
  repos: RepoInput[];
}

export interface WikiContext {
  workspaceName: string;
  shape: WorkspaceShape;
  isOneProduct: boolean;
  /** True when the shape implies ≥2 contract-linked repos. */
  contractLinked: boolean;
  repos: RepoInput[];
  dependencyOrder: string[] | null;
  /** ISO date (YYYY-MM-DD) injected for deterministic output. */
  today: string;
}

export interface WorkspaceContext {
  config: WorkspaceConfig;
  manifest: ManifestContext;
  wiki: WikiContext;
}
