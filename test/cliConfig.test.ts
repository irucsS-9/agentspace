import { expect, test } from "vitest";
import { parseArgs } from "../src/cli";

test("parses init --config <path>", () => {
  const a = parseArgs(["init", "--config", "cfg.json"]);
  expect(a.command).toBe("init");
  expect(a.configPath).toBe("cfg.json");
});

test("init without --config has undefined configPath", () => {
  expect(parseArgs(["init"]).configPath).toBeUndefined();
});

test("--config combines with --force", () => {
  const a = parseArgs(["init", "--config", "c.json", "--force"]);
  expect(a.force).toBe(true);
  expect(a.configPath).toBe("c.json");
});
