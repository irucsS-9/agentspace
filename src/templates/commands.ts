export const INGEST = `---
description: Ingest a source into the {{workspaceName}} memory-bank (LLM Wiki pattern)
---

You are operating in **INGEST mode** for the {{workspaceName}} memory-bank.

Source to ingest: $ARGUMENTS

## No-ingest gate (apply first)
Skip the ingest and tell the user if any are true:
- The content is derivable from \`git log\` / \`grep\` / reading code directly.
- You can't name **two future questions** the page would answer.
- It's one-off setup chatter, not durable cross-repo knowledge.

## Steps
1. **Read the source** (file, URL, or pasted content).
2. **Discuss takeaways** briefly (3–5 bullets) so the user can correct course.
3. **Classify and pick a folder** under \`memory-bank/\`:
{{#folders}}   - \`{{.}}/\`
{{/folders}}
4. **Write a concise page** — bullets, tables, citations. ≤ 150 lines.
5. **Cite \`file:line\`** for every factual claim about the codebase.
6. **Last-verified footer:** end with \`_Last verified: YYYY-MM-DD_\`.
7. **Cross-link** related pages with \`[[slug]]\`.
8. **Update \`memory-bank/index.md\`** — add an entry under the right category.
9. **Append to \`memory-bank/log.md\`:** \`## [YYYY-MM-DD] ingest | <slug>\`
10. **Report what changed.**

## Rules
Reference, don't duplicate — point at \`file:line\` rather than copying code.
Scannable beats comprehensive.
`;

export const QUERY = `---
description: Query the {{workspaceName}} memory-bank; file useful answers back
---

You are operating in **QUERY mode** for the {{workspaceName}} memory-bank.

Question: $ARGUMENTS

## Steps
1. **Read \`memory-bank/index.md\`** first — see what pages exist.
2. **Read relevant pages** — \`00-core/\` first for constraints, then concept
   pages. Walk \`[[cross-links]]\` as needed.
3. **Classify the question:**
   - **Behavioral** (what the code does / returns) → wiki is a hint; **verify the
     cited \`file:line\` against the code** before answering.
   - **Decision / history** (why we chose Y) → wiki answer stands.
4. **Synthesize with citations** — link pages with \`[[slug]]\`, cite repo
   evidence as \`file:line\`.
5. **If a page's \`Last verified\` is > 30 days old** and you used it for a
   behavioral answer, call it out.
6. **If the wiki lacks the answer**, search the repos, then ask:
   _"Found in \`<source>\`. Worth filing in \`memory-bank/<folder>/<slug>.md\`? (y/n)"_
7. **Append to \`memory-bank/log.md\`:** \`## [YYYY-MM-DD] query | <topic>\`

## Rules
Wiki is a hint, code is truth for behavioral claims. Always cite. Never fabricate.
`;

export const LINT = `---
description: Lint the {{workspaceName}} memory-bank for staleness, drift, and scope violations
---

You are operating in **LINT mode** for the {{workspaceName}} memory-bank.

## Step 1 — mechanical checks (run the tool)
Run \`agentspace doctor --lint\` and read its JSON findings. These cover size
budgets, \`_Last verified:_\` staleness, and orphan/citation-path checks — the
single source of truth for mechanical rules. Do not re-derive them by hand.

## Step 2 — judgment checks (only the LLM can do these)
Sweep the wiki for:
1. **Broken citations** — a \`file:line\` whose line no longer matches the claim
   (spot-check ≥3 per page).
2. **Contradictions** — two pages making incompatible claims.
3. **Stale state** — "in progress" work that's shipped; SHAs that don't exist.
4. **Out-of-scope content** — per-repo detail that belongs in a repo's CLAUDE.md.
5. **Broken cross-links** — \`[[slug]]\` pointing at non-existent pages.

## Report
Output a table: \`Severity | File | Issue | Suggested fix\`. Merge the tool's
mechanical findings with your judgment findings. **Do NOT fix automatically** —
ask the user which to act on. Then append to \`memory-bank/log.md\`:
\`## [YYYY-MM-DD] lint | <H high · M med · L low — short summary>\`
`;
