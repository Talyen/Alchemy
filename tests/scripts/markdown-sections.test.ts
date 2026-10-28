import { temporaryDirectories } from "../helpers/script-fixtures";
import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { checkDurableDocumentReachability } from "../../scripts/check-documentation-contract.mjs";
import { extractMarkdownLinkTargets, headingSlugs } from "../../scripts/lib/agent/markdown-sections.mjs";

const createTemporaryDirectory = temporaryDirectories();

it("checks live links without treating fenced or inline examples as maintained paths", () => {
  const source = [
    "````md",
    "[example](missing.md)",
    "```",
    "[still an example](also-missing.md)",
    "````",
    "~~~md",
    "[tilde example](missing-again.md)",
    "~~~",
    "`[inline 🎨](missing-inline.md)` and `` `[nested](missing-nested.md)` ``",
    String.raw`\[escaped](missing-escaped.md)`,
    "[Read `README.md`](README.md#develop)",
  ].join("\r\n");
  expect(extractMarkdownLinkTargets(source)).toEqual([{ target: "README.md#develop", index: source.indexOf("[Read") }]);
});

it("resolves full, collapsed and shortcut references using the first case-insensitive definition", () => {
  const source = [
    "[Guide][Shared Owner] [Shared Owner][] [Shared Owner] [unresolved]",
    '[shared  owner]: ./Docs/ARCHITECTURE.md "Owner"',
    "[SHARED OWNER]: wrong.md",
    "[unused]: unused.md",
  ].join("\n");
  const links = extractMarkdownLinkTargets(source);
  expect(links.map(({ target }) => target)).toEqual(Array(3).fill("./Docs/ARCHITECTURE.md"));
  expect(links.map(({ index }) => source.slice(index, index + 1))).toEqual(["[", "[", "["]);
});

it("retains complete destinations with spaces, balanced parentheses, escapes and optional titles", () => {
  const source = String.raw`[Spaced](<Docs/Owner Guide.md#heading> "Owner")
[Parentheses](Docs/Owner(v2(nested)).md 'Owner')
[Escaped](Docs/Owner\(v2\).md)
[Image](images/diagram.svg "[Shared Owner]")
[Shared Owner]: wrong.md
[Broken](Docs/unbalanced(.md)`;
  expect(extractMarkdownLinkTargets(source).map(({ target }) => target)).toEqual([
    "Docs/Owner Guide.md#heading",
    "Docs/Owner(v2(nested)).md",
    "Docs/Owner(v2).md",
    "images/diagram.svg",
  ]);
});

it("allocates unique heading anchors when an authored suffix collides with a repeated heading", () => {
  expect([...headingSlugs("## Topic\n## Topic-1\n## Topic\n## Topic-1\n```md\n## Example\n```\n## Topic")]).toEqual([
    "topic",
    "topic-1",
    "topic-2",
    "topic-1-1",
    "topic-3",
  ]);
});

it("follows reference-style owner links for reachability while leaving example-only documents orphaned", () => {
  const root = createTemporaryDirectory("alchemy-doc-links-");

  fs.writeFileSync(
    path.join(root, "README.md"),
    "[Owner][guide]\n\n[guide]: <Owner Guide.md>\n\n```md\n[Example](Orphan.md)\n```\n",
  );
  fs.writeFileSync(path.join(root, "Owner Guide.md"), "# Owner\n");
  fs.writeFileSync(path.join(root, "Orphan.md"), "# Orphan\n");
  expect(checkDurableDocumentReachability(root)).toEqual(["Orphan.md"]);
});
