import { expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const dir = join(process.cwd(), "stack-agents");

test("every registered stack id has a backing .md file", () => {
  const reg = parse(readFileSync(join(dir, "stacks.yaml"), "utf8")) as {
    stacks: { id: string }[];
  };
  for (const s of reg.stacks) {
    const file = join(dir, `${s.id}.md`);
    expect(() => readFileSync(file, "utf8")).not.toThrow();
  }
});

test("_generic.md exists and all stack files have frontmatter + verified footer", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  expect(files).toContain("_generic.md");
  for (const f of files) {
    const body = readFileSync(join(dir, f), "utf8");
    expect(body.startsWith("---\n")).toBe(true);
    expect(body).toMatch(/_Last verified: \d{4}-\d{2}-\d{2}_/);
    expect(body).toContain("{{repoName}}");
    expect(body).toContain("{{boundaryRule}}");
  }
});
