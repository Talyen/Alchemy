import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShineText } from "@/features/alchemy/shared/ui/shine-text";
import { REACTION_DEFINITIONS } from "@/lib/battle";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";

describe("ShineText glyph rendering", () => {
  it.each(Object.values(REACTION_DEFINITIONS))(
    "keeps $text readable inside an outlined parent without losing its keyword shine",
    ({ text, keywords }) => {
      const { container } = render(
        <div style={{ WebkitTextStroke: "1.5px black" }}>
          <ShineText colors={getKeywordTextShineColors(keywords)}>{text}</ShineText>
        </div>,
      );
      const glyphs = container.querySelector("span")!;
      expect(glyphs.style.webkitTextStroke).toBe("0px");
      expect(glyphs.style.backgroundImage).toContain("rgb(255, 255, 255)");
      expect(glyphs.textContent).toBe(text);
    },
  );
});
