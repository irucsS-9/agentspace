import type { WorkspaceConfig } from "../../src/types";

export const singleRepo: WorkspaceConfig = {
  workspaceName: "solo",
  shape: "single-repo",
  repos: [{ name: "app", remote: "git@x:app.git", stack: "generic", role: "the app" }],
  dependencyOrder: null,
  pillars: ["manifest", "wiki"],
};

export const oneProduct: WorkspaceConfig = {
  workspaceName: "cork",
  shape: "one-product",
  repos: [
    { name: "api", remote: "git@x:api.git", stack: "rails", role: "backend" },
    { name: "web", remote: "git@x:web.git", stack: "nextjs", role: "frontend" },
    { name: "mobile", remote: null, stack: "expo", role: "mobile" },
  ],
  dependencyOrder: ["api", "web", "mobile"],
  pillars: ["manifest", "wiki"],
};

export const unrelated: WorkspaceConfig = {
  workspaceName: "misc",
  shape: "unrelated",
  repos: [
    { name: "blog", remote: "git@x:blog.git", stack: "generic", role: "blog" },
    { name: "tool", remote: "git@x:tool.git", stack: "go", role: "cli tool" },
  ],
  dependencyOrder: null,
  pillars: ["manifest", "wiki"],
};
