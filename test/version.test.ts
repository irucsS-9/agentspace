import { expect, test } from "vitest";
import { VERSION } from "../src/version";

test("VERSION matches package.json", () => {
  expect(VERSION).toBe("0.1.0");
});
