import { expect, test } from "vitest";
import { render } from "../src/renderer/render";

test("renders without HTML-escaping (paths and code survive)", () => {
  const out = render("path: {{dir}} & flag {{flag}}", {
    dir: "../estimates-new",
    flag: "a && b",
  });
  expect(out).toBe("path: ../estimates-new & flag a && b");
});

test("renders sections over arrays", () => {
  const out = render("{{#repos}}- {{name}}\n{{/repos}}", {
    repos: [{ name: "api" }, { name: "web" }],
  });
  expect(out).toBe("- api\n- web\n");
});
