import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "vitest";

const require = createRequire(import.meta.url);
const hook = require(join(process.cwd(), "assets/memory-bank-stop.cjs"));

test("decideStop: allow when not a cross-app mutation", () => {
  expect(hook.decideStop({ mode: "auto", warm: true, crossAppMutation: false, memoryBankUpdated: false })).toBe("allow");
});

test("decideStop: allow when memory bank was updated", () => {
  expect(hook.decideStop({ mode: "auto", warm: true, crossAppMutation: true, memoryBankUpdated: true })).toBe("allow");
});

test("decideStop auto: warn before warm, block after", () => {
  const base = { mode: "auto", crossAppMutation: true, memoryBankUpdated: false } as const;
  expect(hook.decideStop({ ...base, warm: false })).toBe("warn");
  expect(hook.decideStop({ ...base, warm: true })).toBe("block");
});

test("decideStop mode overrides: warn always warns, block always blocks", () => {
  const g = { crossAppMutation: true, memoryBankUpdated: false, warm: true } as const;
  expect(hook.decideStop({ ...g, mode: "warn" })).toBe("warn");
  expect(hook.decideStop({ ...g, mode: "block", warm: false })).toBe("block");
});

test("isWarm: true on either pages OR sessions", () => {
  expect(hook.isWarm({ pages: 6, sessions: 0, warmPages: 5, warmSessions: 10 })).toBe(true);
  expect(hook.isWarm({ pages: 0, sessions: 10, warmPages: 5, warmSessions: 10 })).toBe(true);
  expect(hook.isWarm({ pages: 2, sessions: 2, warmPages: 5, warmSessions: 10 })).toBe(false);
});
