import { describe, expect, it } from "vitest";
import { getCardRect } from "@/features/alchemy/shared/utils/dom";

describe("getCardRect", () => {
  it("transforms a DOMRect to a CardRect", () => {
    const rect = {
      x: 10,
      y: 20,
      width: 100,
      height: 150,
      top: 20,
      right: 110,
      bottom: 170,
      left: 10,
      toJSON() {},
    } as DOMRect;
    const cardRect = getCardRect(rect);
    expect(cardRect).toEqual({ x: 10, y: 20, width: 100, height: 150 });
  });
});
