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

export const peerServices: WorkspaceConfig = {
  workspaceName: "fleet",
  shape: "peer-services",
  repos: [
    { name: "svc-a", remote: "git@x:svc-a.git", stack: "generic", role: "service A" },
    { name: "svc-b", remote: "git@x:svc-b.git", stack: "generic", role: "service B" },
    { name: "svc-c", remote: "git@x:svc-c.git", stack: "generic", role: "service C" },
    { name: "svc-d", remote: null, stack: "generic", role: "service D" },
  ],
  dependencyOrder: null,
  pillars: ["manifest", "wiki"],
};

export const libraryConsumers: WorkspaceConfig = {
  workspaceName: "lib-workspace",
  shape: "library-consumers",
  repos: [
    { name: "core-lib", remote: "git@x:core-lib.git", stack: "generic", role: "shared library" },
    { name: "app-one", remote: "git@x:app-one.git", stack: "generic", role: "consumer app one" },
    { name: "app-two", remote: "git@x:app-two.git", stack: "generic", role: "consumer app two" },
  ],
  dependencyOrder: ["core-lib", "app-one", "app-two"],
  pillars: ["manifest", "wiki"],
};
