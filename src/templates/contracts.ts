export const PROJECT_MD = `# Project Context — {{workspaceName}} (cross-repo contracts)

> **Scope:** this OpenSpec instance covers **cross-repo contracts only** — things
> consumed by more than one repo in this workspace. Per-repo internals do not
> belong here; they stay in that repo.

## Repos
| Repo | Role |
|---|---|
{{#repos}}| \`{{name}}/\` | {{role}} |
{{/repos}}
## What belongs in \`specs/\`
A capability lives here only if it's a contract **between** repos:
- HTTP endpoints consumed by another repo
- Shared data shapes / payloads
- Auth flows
- Webhook payloads that cross repos
- Cross-repo events

It does **not** belong here if it only describes the inside of one repo.

## What belongs in \`changes/\`
Any proposal that mutates a cross-repo contract, before implementation (adding a
field consumers read, changing an auth response, deprecating an endpoint).
{{#hasOrder}}Each change names the affected repos and orders tasks in
**dependency order: {{#order}}{{.}} → {{/order}}done**. The producer defines the
contract; consumers follow.{{/hasOrder}}{{^hasOrder}}These repos are **peers** with
no global dependency order — each change names the affected repos and the contract
between them.{{/hasOrder}}

## Working with this instance
The \`/opsx:*\` slash commands are installed by the external **\`openspec\` CLI** —
run \`openspec update\` in this workspace to install them. CLI: \`openspec list\`,
\`openspec validate\`, \`openspec show <name>\`, \`openspec view\`.

| Command | Purpose |
|---|---|
| \`/opsx:propose <idea>\` | Scaffold \`changes/<name>/{proposal,design,tasks}.md\` |
| \`/opsx:apply <name>\` | Implement a change task-by-task |
| \`/opsx:archive <name>\` | Fold a shipped change into \`specs/\` (archive on deploy) |

## Relationship to the memory bank
OpenSpec holds *what the contract is* (specs) and *what's changing* (proposals).
\`memory-bank/\` holds *why* (decisions, history).{{#hasWiki}} The wiki's
\`00-core/crossAppContracts.md\` should cite the matching
\`openspec/specs/<capability>/spec.md\`.{{/hasWiki}}
`;

export const OPENSPEC_README = `# openspec/ — {{workspaceName}} cross-repo contracts

Prescriptive contract layer for this workspace. Read \`project.md\` for scope and
lifecycle.

- \`specs/\` — current cross-repo capabilities (the truth).
- \`changes/\` — proposals in flight; \`changes/archive/\` — shipped.

The \`/opsx:*\` commands and validation come from the external **\`openspec\` CLI**.
Run \`openspec update\` to install the slash commands; \`openspec validate\` to check.
`;
