export const WIKI_FOLDERS = [
  "00-core",
  "01-active",
  "02-architecture",
  "03-patterns",
  "04-business",
  "05-sessions",
  "06-learnings",
  "07-reference",
  "08-history",
  "09-research",
  "10-archive",
];

export const WIKI_README = `# Memory Bank — {{workspaceName}} Wiki

An LLM-curated knowledge base (Karpathy LLM Wiki pattern): entity/concept pages,
an \`index.md\` catalog, an append-only \`log.md\`, and operations (ingest / query / lint).

## Scope
{{#isOneProduct}}**Cross-app / product-level only.** Per-repo architecture stays in each
sub-repo's own CLAUDE.md — do not duplicate it here (duplication drifts).
{{/isOneProduct}}{{^isOneProduct}}Cross-repo knowledge that spans more than one repository.
Per-repo detail stays in each sub-repo's own CLAUDE.md.
{{/isOneProduct}}

## Folders (lower number = higher reading priority)
| Dir | Holds |
|---|---|
| 00-core/ | Foundational, slow-changing |
| 01-active/ | Current focus, status, next steps |
| 04-business/ | Domain/feature pages |
| 06-learnings/ | Lessons, postmortems |
| 10-archive/ | Superseded material (archive, don't delete) |

## Page conventions
- Scannable, not exhaustive. Bullets/tables. Reference \`file:line\`, don't duplicate code.
- Every entity page ends with \`_Last verified: YYYY-MM-DD_\`.
- Every factual claim about code cites \`file:line\`. Without citations, drift is invisible.

## Size budgets
\`agentspace doctor\` enforces these mechanically (single source of truth):
| File / pattern | Hard cap (lines) |
|---|---|
| log.md | 500 |
| 00-core/*.md | 800 |
| 01-active/currentWork.md | 150 |
| 04-business/*.md | 800 |
`;

export const WIKI_INDEX = `# Index

Catalog of wiki pages by category. Updated on every \`/ingest\`.

_(empty — add pages as you ingest)_
`;

export const WIKI_LOG = `# Log

Append-only activity journal. One line per action: \`## [YYYY-MM-DD] <action> | <slug>\`.
`;

export const PROJECT_OVERVIEW = `# Project Overview — {{workspaceName}}

{{#isOneProduct}}One product across {{repoCount}} repositories.{{/isOneProduct}}{{^isOneProduct}}{{repoCount}} repositories coordinated in one workspace.{{/isOneProduct}}

## Repos
{{#repos}}- \`{{name}}/\` — {{role}} ({{stack}})
{{/repos}}

---
_Last verified: {{today}}_
`;

// Only emitted for contract-linked workspaces. Deliberately empty — the wizard has
// no code to cite, so it must NOT fabricate entries or a premature verified date.
export const CROSS_APP_CONTRACTS = `# Cross-App Contracts — {{workspaceName}}

> No contracts recorded yet. Populate this after your first cross-repo change.
> Every entry must cite \`file:line\` and end the page with a verified date footer.
{{#hasContracts}}> Cite the matching \`openspec/specs/<capability>/spec.md\` for each contract recorded here.
{{/hasContracts}}

{{#dependencyOrder.length}}**Dependency order:** {{#dependencyOrder}}{{.}} → {{/dependencyOrder}}(done)
{{/dependencyOrder.length}}
`;
