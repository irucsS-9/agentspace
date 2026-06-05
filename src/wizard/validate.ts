const FS_SAFE = /^[A-Za-z0-9._-]+$/;

export function validateWorkspaceName(name: string): string | null {
  if (!name.trim()) return "Workspace name is required.";
  return null;
}

export function validateRepoName(name: string): string | null {
  if (!name.trim()) return "Repo name is required.";
  if (!FS_SAFE.test(name)) {
    return "Use only letters, numbers, dots, dashes, underscores.";
  }
  return null;
}

export function validateRemote(remote: string): string | null {
  if (remote.trim() === "") return null; // local-only
  const ok =
    /^git@[^:]+:.+\.git$/.test(remote) ||
    /^https?:\/\/.+/.test(remote) ||
    /^ssh:\/\/.+/.test(remote);
  return ok ? null : "Enter a valid git remote URL, or leave blank for local-only.";
}

export function validateUniqueNames(names: string[]): string | null {
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n)) return `Duplicate repo name: ${n}`;
    seen.add(n);
  }
  return null;
}
