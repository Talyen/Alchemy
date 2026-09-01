import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderUnlockMessage } from "@/features/alchemy/shared/ui/unlock-text";

describe("renderUnlockMessage", () => {
  afterEach(() => {
    cleanup();
  });
  it("bolds hero names and Run in standard unlock messages", () => {
    render(<p data-testid="msg">{renderUnlockMessage("Finish a Run as the Knight to unlock")}</p>);
    const msg = screen.getByTestId("msg");
    const strongs = msg.querySelectorAll("strong");
    expect(strongs).toHaveLength(2);
    expect(strongs[0]?.textContent).toBe("Run");
    expect(strongs[1]?.textContent).toBe("Knight");
  });

  it("bolds all hero names across classes", () => {
    const heroes = ["Knight", "Rogue", "Wizard", "Ranger", "Alchemist", "Warlock", "Druid", "Wildcard"];
    for (const hero of heroes) {
      const { unmount } = render(
        <p data-testid={`msg-${hero}`}>{renderUnlockMessage(`Finish a Run as the ${hero} to unlock`)}</p>,
      );
      const msg = screen.getByTestId(`msg-${hero}`);
      const strongs = msg.querySelectorAll("strong");
      expect(strongs).toHaveLength(2);
      expect(strongs[0]?.textContent).toBe("Run");
      expect(strongs[1]?.textContent).toBe(hero);
      unmount();
    }
  });

  it("bolds Gear in Armory unlock message", () => {
    render(<p data-testid="msg">{renderUnlockMessage("Find Gear to unlock")}</p>);
    const msg = screen.getByTestId("msg");
    const strongs = msg.querySelectorAll("strong");
    expect(strongs).toHaveLength(1);
    expect(strongs[0]?.textContent).toBe("Gear");
  });

  it("bolds Difficulty in difficulty select tooltip", () => {
    render(<p data-testid="msg">{renderUnlockMessage("Clear previous Difficulty to unlock")}</p>);
    const msg = screen.getByTestId("msg");
    const strongs = msg.querySelectorAll("strong");
    expect(strongs).toHaveLength(1);
    expect(strongs[0]?.textContent).toBe("Difficulty");
  });

  it("bolds Companion and Run in companion unlock tooltip", () => {
    render(<p data-testid="msg">{renderUnlockMessage("Discover this Companion during a Run to reveal it here.")}</p>);
    const msg = screen.getByTestId("msg");
    const strongs = msg.querySelectorAll("strong");
    expect(strongs).toHaveLength(2);
    expect(strongs[0]?.textContent).toBe("Companion");
    expect(strongs[1]?.textContent).toBe("Run");
  });

  it("bolds action tooltip warning terms like Gold, Resources, Potions", () => {
    const cases = [
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
