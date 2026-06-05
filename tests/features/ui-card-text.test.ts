import { describe, expect, it } from "vitest";
import { getCorruptedValueOffsets, splitCorruptedNumericParts } from "@/features/alchemy/shared/ui/card-text";

describe("card text helpers", () => {
  it("splits numeric fragments and marks corrupted offsets", () => {
    expect(splitCorruptedNumericParts("Deal 12 and gain 3", 0, new Set([5]))).toEqual([
      { text: "Deal ", corrupted: false },
      { text: "12", corrupted: true },
      { text: " and gain ", corrupted: false },
      { text: "3", corrupted: false },
    ]);
  });

  it("preserves text with no numbers", () => {
    expect(splitCorruptedNumericParts("Consume", 0, new Set())).toEqual([{ text: "Consume", corrupted: false }]);
  });

  it("extracts corrupted offsets for one description line", () => {
    const offsets = getCorruptedValueOffsets(
      {
        corruptedValuePositions: [
          { lineIndex: 0, matchIndex: 5 },
          { lineIndex: 1, matchIndex: 8 },
        ],
      },
      1,
    );

    expect([...offsets]).toEqual([8]);
  });
});
