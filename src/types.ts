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
  /** Enforcement config when the pillar is selected, else null. */
  enforcement: EnforcementConfig | null;
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
  contractLinked: boolean;
  enforcement: EnforcementConfig | null;
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
  enforcement: EnforcementContext | null;
}

export type HookMode = "auto" | "warn" | "block";

export interface EnforcementConfig {
  mode: HookMode;
  warmPages: number;
  warmSessions: number;
}

export const DEFAULT_ENFORCEMENT: EnforcementConfig = {
  mode: "auto",
  warmPages: 5,
  warmSessions: 10,
};

export interface AgentDefinition {
  name: string; // "<repo>-engineer" or "cross-app-reviewer"
  repoDir: string; // "" for the cross-repo reviewer
  role: string;
  stack: string; // stack id or "generic"
  boundaryRule: string;
  toolList: string[];
  isReviewer: boolean;
}

export interface CommandDef {
  name: string; // "ingest" | "query" | "lint"
  body: string;
}

export interface HookRule {
  enabled: boolean;
  mode: HookMode;
  warmPages: number;
  warmSessions: number;
  subRepos: string[];
}

export interface EnforcementIntents {
  agents: AgentDefinition[];
  commands: CommandDef[];
  hook: HookRule | null; // null for non-contract shapes
}

export interface EnforcementContext {
  workspaceName: string;
  shape: WorkspaceShape;
  contractLinked: boolean;
  repos: RepoInput[];
  config: EnforcementConfig;
  folders: string[]; // wiki folder names, for command injection
}
