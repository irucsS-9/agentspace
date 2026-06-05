import { expect, test } from "vitest";
import { DEFAULT_ENFORCEMENT } from "../src/types";

test("default enforcement config", () => {
  expect(DEFAULT_ENFORCEMENT).toEqual({ mode: "auto", warmPages: 5, warmSessions: 10 });
});
