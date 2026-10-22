import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RECEIPT,
  requiresVisualReview,
  runVisualReview,
  validateVisualReview,
  visualSourceDigest,
} from "../../scripts/visual-review.mjs";

describe("local visual acceptance gate", () => {
  let root: string;
  const selected = ["src/view.tsx"];
  function write(file: string, value: string) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), value);
  }
  function receipt() {
    return {
      version: 1,
      source: visualSourceDigest(root),
      paths: selected,
      kind: "visual",
      acceptance: "passed",
      majorRedesign: false,
      task: "Compare the upgrade cost and choose whether to buy.",
      references: ["Approved portrait reference: large silhouette and quiet surround."],
      comparisons: [
        {
          state: "Homestead, same fixture, English, mute on",
          viewport: [12, 8],
          viewportReason: "Small generated test images",
          before: "reports/before.png",
          after: "reports/after.png",
        },
      ],
      appearance: "Purchase price previously competed with the title; corrected emphasis.",
      copy: "Removed redundant upgrade explanation; no new explanatory text.",
      interaction: "Pointer and keyboard purchase update the resource and tier; focus remains usable.",
      artwork: "No art or framing changed; not applicable.",
    };
  }
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-visual-review-"));
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    write(".gitignore", "reports/\n");
    write(selected[0]!, "export const View = () => null;");
    fs.mkdirSync(path.join(root, "reports"), { recursive: true });
    for (const [name, color] of [
      ["before", "red"],
      ["after", "blue"],
    ]) {
      await sharp({ create: { width: 12, height: 8, channels: 3, background: color! } })
        .png()
        .toFile(path.join(root, `reports/${name}.png`));
    }
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("blocks missing, pending, uncovered and incomplete review evidence", async () => {
    await expect(runVisualReview(selected, root)).rejects.toThrow("Missing reports/visual-review");
    await runVisualReview(["--init", ...selected], root);
    await expect(runVisualReview(selected, root)).rejects.toThrow("Missing player decision");
    await expect(runVisualReview(["--init", ...selected], root)).rejects.toThrow("EEXIST");
    const value = receipt();
    await expect(validateVisualReview(root, selected, { ...value, paths: ["src/other.tsx"] })).rejects.toThrow(
      "does not cover",
    );
    await expect(validateVisualReview(root, selected, { ...value, copy: "" })).rejects.toThrow("Missing copy");
    await expect(validateVisualReview(root, selected, { ...value, acceptance: "pending" })).rejects.toThrow(
      "acceptance remains pending",
    );
    write(RECEIPT, JSON.stringify(value));
    await expect(runVisualReview(selected, root)).resolves.toBeUndefined();
  });

  it("invalidates evidence when an unselected runtime dependency, locale, or artwork changes", async () => {
    for (const file of ["src/model.ts", "src/locales/de.json", "src/assets/art.webp", "package-lock.json"]) {
      const value = receipt();
      write(file, "changed");
      await expect(validateVisualReview(root, selected, value)).rejects.toThrow("stale");
    }
  });

  it("preserves content identity through commits, including file deletion", () => {
    write("src/retired.ts", "old");
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root });
    const commit = () => {
      git("add", ".");
      git(
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "--quiet",
        "-m",
        "test",
      );
    };
    const initial = visualSourceDigest(root);
    commit();
    expect(visualSourceDigest(root)).toBe(initial);
    fs.unlinkSync(path.join(root, "src/retired.ts"));
    const deleted = visualSourceDigest(root);
    expect(deleted).not.toBe(initial);
    commit();
    expect(visualSourceDigest(root)).toBe(deleted);
  });

  it("rejects missing, invalid, mismatched and duplicated screenshot evidence", async () => {
    const value = receipt();
    const after = path.join(root, "reports/after.png");
    fs.copyFileSync(path.join(root, "reports/before.png"), after);
    await expect(validateVisualReview(root, selected, value)).rejects.toThrow("reason unchanged screenshot pixels");
    write("reports/after.png", "not an image");
    await expect(validateVisualReview(root, selected, value)).rejects.toThrow();
    fs.unlinkSync(after);
    await expect(validateVisualReview(root, selected, value)).rejects.toThrow();
    await sharp({ create: { width: 13, height: 8, channels: 3, background: "green" } })
      .png()
      .toFile(after);
    await expect(validateVisualReview(root, selected, value)).rejects.toThrow("matching its comparison viewport");
  });

  it("requires rendered composition alternatives and a selection for major redesigns", async () => {
    const value = { ...receipt(), majorRedesign: true, alternatives: ["reports/before.png"], selection: "" };
    await expect(validateVisualReview(root, selected, value)).rejects.toThrow("two composition alternatives");
    value.alternatives.push("reports/after.png");
    await expect(validateVisualReview(root, selected, value)).rejects.toThrow("composition selection");
    value.selection = "User chose B for the clearer purchase hierarchy.";
    await expect(validateVisualReview(root, selected, value)).resolves.toBeUndefined();
  });

  it("requires a scoped rationale for nonvisual changes and explicit waivers", async () => {
    const value = { version: 1, source: visualSourceDigest(root), paths: selected, kind: "nonvisual", reason: "" };
    await expect(validateVisualReview(root, selected, value)).rejects.toThrow("specific reason");
    value.reason = "Internal save serialization changes only; no screen, text or interaction behavior changes.";
    await expect(validateVisualReview(root, selected, value)).resolves.toBeUndefined();
    value.kind = "waived";
    value.reason = "";
    await expect(validateVisualReview(root, selected, value)).rejects.toThrow("explicit user waiver");
  });

  it("covers behavior, copy and art paths while leaving process docs and tests outside the gate", () => {
    for (const file of [
      "src/view.tsx",
      "src/controller.ts",
      "src/style.css",
      "src/locales/de.json",
      "index.html",
      "public/icon.png",
      "scripts/assets/card-assets.mjs",
    ])
      expect(requiresVisualReview(file)).toBe(true);
    for (const file of ["Docs/UI.md", "src/storage/MIGRATIONS.md", "tests/view.test.tsx", "scripts/check.mjs"])
      expect(requiresVisualReview(file)).toBe(false);
  });
});
