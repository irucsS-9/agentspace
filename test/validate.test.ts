import { describe, expect, test } from "vitest";
import {
  validateRepoName,
  validateRemote,
  validateWorkspaceName,
  validateUniqueNames,
} from "../src/wizard/validate";

describe("validateRepoName", () => {
  test("accepts safe names", () => {
    expect(validateRepoName("corkcrm-upgraded")).toBeNull();
    expect(validateRepoName("api_v2")).toBeNull();
  });
  test("rejects empty and unsafe names", () => {
    expect(validateRepoName("")).toMatch(/required/i);
    expect(validateRepoName("../etc")).toMatch(/letters/i);
    expect(validateRepoName("has space")).toMatch(/letters/i);
  });
});

describe("validateRemote", () => {
  test("empty is allowed (local-only)", () => {
    expect(validateRemote("")).toBeNull();
  });
  test("accepts ssh and https git URLs", () => {
    expect(validateRemote("git@github.com:org/repo.git")).toBeNull();
    expect(validateRemote("https://github.com/org/repo.git")).toBeNull();
  });
  test("rejects obvious non-URLs", () => {
    expect(validateRemote("not a url")).toMatch(/valid git remote/i);
  });
});

describe("validateWorkspaceName", () => {
  test("requires a non-empty name", () => {
    expect(validateWorkspaceName("")).toMatch(/required/i);
    expect(validateWorkspaceName("my-product")).toBeNull();
  });
});

describe("validateUniqueNames", () => {
  test("flags duplicates", () => {
    expect(validateUniqueNames(["a", "b", "a"])).toMatch(/duplicate/i);
    expect(validateUniqueNames(["a", "b"])).toBeNull();
  });
  test("detects duplicate when a new name matches an already-collected repo name", () => {
    // Simulates the wizard pattern: existing repos ["api", "web"], candidate = "api"
    const existingNames = ["api", "web"];
    const candidateName = "api";
    const error = validateUniqueNames([...existingNames, candidateName]);
    expect(error).toMatch(/duplicate/i);
    expect(error).toContain("api");
  });
  test("allows a unique new name to be added to existing repos", () => {
    const existingNames = ["api", "web"];
    const candidateName = "mobile";
    expect(validateUniqueNames([...existingNames, candidateName])).toBeNull();
  });
});
