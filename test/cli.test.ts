import { expect, test } from "vitest";
import { parseArgs } from "../src/cli";

test("parses init with --force", () => {
  expect(parseArgs(["init", "--force"])).toEqual({ command: "init", force: true });
});

test("parses doctor with default dir", () => {
  expect(parseArgs(["doctor"])).toEqual({ command: "doctor", force: false });
});

test("parses version and help flags", () => {
  expect(parseArgs(["--version"])).toEqual({ command: "version", force: false });
  expect(parseArgs(["--help"])).toEqual({ command: "help", force: false });
  expect(parseArgs([])).toEqual({ command: "help", force: false });
});

test("unknown command falls back to help", () => {
  expect(parseArgs(["wat"])).toEqual({ command: "help", force: false });
});
