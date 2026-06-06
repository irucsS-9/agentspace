import { expect, test } from "vitest";
import { parseArgs } from "../src/cli";

test("parses init with --force", () => {
  expect(parseArgs(["init", "--force"])).toEqual({ command: "init", force: true, lint: false });
});

test("parses doctor with default dir", () => {
  expect(parseArgs(["doctor"])).toEqual({ command: "doctor", force: false, lint: false });
});

test("parses version and help flags", () => {
  expect(parseArgs(["--version"])).toEqual({ command: "version", force: false, lint: false });
  expect(parseArgs(["--help"])).toEqual({ command: "help", force: false, lint: false });
  expect(parseArgs([])).toEqual({ command: "help", force: false, lint: false });
});

test("unknown command falls back to help", () => {
  expect(parseArgs(["wat"])).toEqual({ command: "help", force: false, lint: false });
});

test("parses doctor --lint", () => {
  expect(parseArgs(["doctor", "--lint"])).toEqual({ command: "doctor", force: false, lint: true });
});

test("doctor without --lint has lint:false", () => {
  expect(parseArgs(["doctor"])).toEqual({ command: "doctor", force: false, lint: false });
});
