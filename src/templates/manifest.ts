export const MANIFEST_YAML = `# {{workspaceName}} — workspace manifest (source of truth for sub-repos)
workspace: {{workspaceName}}
shape: {{shape}}
repos:
{{#repos}}  - name: {{name}}
    remote: {{remote}}
    stack: {{stack}}
    role: {{role}}
{{/repos}}`;

// Repo list inlined as a bash array — no runtime YAML parsing (robust).
export const CLONE_REPOS_SH = `#!/usr/bin/env bash
set -euo pipefail
# Reconstructs the workspace from the inlined repo list below.
# Skips repos that already exist (idempotent) and local-only repos (no remote).

# Format per line: "<name>\\t<remote>"  (empty remote = local-only)
REPOS=(
{{#repos}}  "{{name}}	{{remoteOrEmpty}}"
{{/repos}})

for entry in "\${REPOS[@]}"; do
  name="\${entry%%	*}"
  remote="\${entry#*	}"
  if [[ -d "\$name" ]]; then
    echo "skip   \$name (already present)"
  elif [[ -z "\$remote" ]]; then
    echo "skip   \$name (local-only, no remote)"
  else
    echo "clone  \$name"
    if ! git clone "\$remote" "\$name"; then
      echo "FAILED \$name (continuing)"
    fi
  fi
done
`;

export const GITIGNORE = `# Sub-repos are independent git repositories, not tracked here.
{{#repos}}{{name}}/
{{/repos}}# Machine-local Claude Code settings.
**/.claude/settings.local.json
.DS_Store
`;

export const ROOT_CLAUDE = `# CLAUDE.md — {{workspaceName}}

This is an agentspace workspace: a coordination layer above {{repoCount}} sibling repos.
Work inside the relevant sub-repo; read that repo's own CLAUDE.md for stack details.

## Repos
{{#repos}}- \`{{name}}/\` — {{role}} ({{stack}})
{{/repos}}

## Source of truth
- \`manifest.yaml\` — canonical repo list. Run \`./clone-repos.sh\` to reconstruct.
- \`memory-bank/\` — cross-repo knowledge wiki (read \`memory-bank/README.md\`).
`;

export const ROOT_README = `# {{workspaceName}}

Coordination workspace for {{repoCount}} sibling repositories, scaffolded by agentspace.

## Repositories
| Dir | Role | Stack |
|---|---|---|
{{#repos}}| \`{{name}}/\` | {{role}} | {{stack}} |
{{/repos}}

## Getting started
\`\`\`bash
./clone-repos.sh   # clone any missing sub-repos (idempotent)
\`\`\`

Sub-repos are independent git repositories and are git-ignored by this workspace.
`;
