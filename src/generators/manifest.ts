import { render } from "../renderer/render";
import {
  CLONE_REPOS_SH,
  GITIGNORE,
  MANIFEST_YAML,
  ROOT_CLAUDE,
  ROOT_README,
} from "../templates/manifest";
import type { GeneratedFile, ManifestContext } from "../types";

export function generateManifest(ctx: ManifestContext): GeneratedFile[] {
  const repos = ctx.repos.map((r) => ({
    ...r,
    remote: r.remote ?? "",
    remoteOrEmpty: r.remote ?? "",
  }));
  const view = {
    workspaceName: ctx.workspaceName,
    shape: ctx.shape,
    repoCount: ctx.repos.length,
    repos,
  };
  return [
    { path: "manifest.yaml", contents: render(MANIFEST_YAML, view) },
    { path: "clone-repos.sh", contents: render(CLONE_REPOS_SH, view) },
    { path: ".gitignore", contents: render(GITIGNORE, view) },
    { path: "CLAUDE.md", contents: render(ROOT_CLAUDE, view) },
    { path: "README.md", contents: render(ROOT_README, view) },
  ];
}
