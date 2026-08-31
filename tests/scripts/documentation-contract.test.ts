import { describe, expect, it } from "vitest";
import {
  checkBacktickedCurrentFileReferences,
  checkContributingE2ePaths,
  checkDocumentedNpmScripts,
  checkDurableDocumentReachability,
  checkInlineRepositoryPaths,
  checkLocalMarkdownLinks,
  checkMarkdownHeadingAnchors,
  checkSkillIndexCompleteness,
} from "../../scripts/check-documentation-contract.mjs";

describe("documentation contracts", () => {
  it("keeps local Markdown link targets valid", () => {
    expect(checkLocalMarkdownLinks()).toEqual([]);
  });

  it("keeps inline backtick repository paths valid", () => {
    expect(checkInlineRepositoryPaths()).toEqual([]);
  });

  it("keeps current backticked file references valid", () => {
    expect(checkBacktickedCurrentFileReferences()).toEqual([]);
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

  it("routes every local skill and resolves every routed skill", () => {
    expect(checkSkillIndexCompleteness()).toEqual([]);
  });
});
