import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderUnlockMessage } from "@/features/alchemy/shared/ui/unlock-text";

describe("renderUnlockMessage", () => {
  afterEach(() => {
    cleanup();
  });
  it("bolds representative implicit unlock terms", () => {
    const cases = [
      { text: "Finish a Run as the Knight to unlock", expected: ["Run", "Knight"] },
      { text: "Find Gear to unlock", expected: ["Gear"] },
      { text: "Clear previous Difficulty to unlock", expected: ["Difficulty"] },
      { text: "Discover this Companion during a Run to reveal it here.", expected: ["Companion", "Run"] },
      { text: "Not Enough Gold", expected: ["Gold"] },
      { text: "Not Enough Resources", expected: ["Resources"] },
      { text: "Not Enough Potions to Mix", expected: ["Potions"] },
    ];
    for (const { text, expected } of cases) {
      const { unmount } = render(<p data-testid="msg">{renderUnlockMessage(text)}</p>);
      const msg = screen.getByTestId("msg");
      const strongs = Array.from(msg.querySelectorAll("strong")).map((el) => el.textContent);
      expect(strongs).toEqual(expected);
      unmount();
    }
  });

  it("supports explicit markdown double asterisks bolding", () => {
    render(<p data-testid="msg">{renderUnlockMessage("Must reach **Level 10** first")}</p>);
    const msg = screen.getByTestId("msg");
    const strongs = msg.querySelectorAll("strong");
    expect(strongs).toHaveLength(1);
    expect(strongs[0]?.textContent).toBe("Level 10");
  });
});
