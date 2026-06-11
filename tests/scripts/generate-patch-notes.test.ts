import { describe, expect, it } from "vitest";
import { buildPatchNotesMarkdown, parseConventionalCommit } from "../../scripts/lib/patch-notes-core.mjs";

describe("generate-patch-notes", () => {
  it("includes player-facing conventional commits only", () => {
    const markdown = buildPatchNotesMarkdown("1.2.3", [
      "feat(cards): add meteor shower",
      "fix(save): repair corrupt deck",
      "chore: update deps",
      "balance: reduce goblin HP",
    ]);
    expect(markdown).toContain("add meteor shower");
    expect(markdown).toContain("repair corrupt deck");
    expect(markdown).toContain("reduce goblin HP");
    expect(markdown).not.toContain("update deps");
    expect(markdown).toContain("## Known issues");
  });

  it("parses conventional commit headers", () => {
    const parsed = parseConventionalCommit("feat(steam): enable cloud saves");
    expect(parsed.type).toBe("feat");
    expect(parsed.scope).toBe("steam");
    expect(parsed.include).toBe(true);
  });
});
