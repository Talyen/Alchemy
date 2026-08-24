import { describe, expect, it } from "vitest";
import {
  checkContributingE2ePaths,
  checkDocumentedNpmScripts,
  checkDurableDocumentReachability,
  checkInlineRepositoryPaths,
  checkLocalMarkdownLinks,
  checkMarkdownHeadingAnchors,
} from "../../scripts/check-documentation-contract.mjs";

describe("documentation contracts", () => {
  it("keeps local Markdown link targets valid", () => {
    expect(checkLocalMarkdownLinks()).toEqual([]);
  });

  it("keeps inline backtick repository paths valid", () => {
    expect(checkInlineRepositoryPaths()).toEqual([]);
  });

  it("documents only existing npm run scripts", () => {
    expect(checkDocumentedNpmScripts()).toEqual([]);
  });

  it("keeps Markdown heading anchors valid", () => {
    expect(checkMarkdownHeadingAnchors()).toEqual([]);
  });

  it("keeps CONTRIBUTING backtick E2E spec paths existent", () => {
    expect(checkContributingE2ePaths()).toEqual([]);
  });

  it("keeps every durable document reachable from a documented entry point", () => {
    expect(checkDurableDocumentReachability()).toEqual([]);
  });
});
