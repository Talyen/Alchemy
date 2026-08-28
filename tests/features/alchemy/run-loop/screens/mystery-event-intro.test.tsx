import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MysteryEventIntro } from "@/features/alchemy/run-loop/screens/mystery/mystery-event-intro";
import type { MysteryEvent } from "@/lib/mystery";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const sampleEvent: MysteryEvent = {
  id: "sacred-grove",
  title: "Sacred Grove",
  art: "sacred-grove-art",
  narrative: "Sunlight breaks through the canopy in golden rays.",
  choices: [
    { label: "Bask in the Light", effects: [{ kind: "healHealth", amount: 12 }] },
    { label: "Search the Area", effects: [{ kind: "gainTrinket", trinketId: "groves-favor" }] },
  ],
};

describe("MysteryEventIntro", () => {
  installDisabledAnimationsForTests();

  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders event art above the narrative", () => {
    render(
      <MysteryEventIntro
        event={sampleEvent}
        findCard={() => undefined}
        findTrinket={() => undefined}
        onPick={vi.fn()}
      />,
    );

    const art = screen.getByTestId("mystery-event-art");
    const artSurface = screen.getByTestId("mystery-event-art-surface");
    expect(art.getAttribute("src")).toBe("sacred-grove-art");
    expect(art.getAttribute("alt")).toBe("Sacred Grove");
    expect(artSurface.classList.contains("card-interactive-glow")).toBe(true);
    expect(artSurface.classList.contains("border")).toBe(true);
    expect(artSurface.getAttribute("data-tilt-strength")).toBeNull();
    expect(artSurface.querySelector(".card-shimmer-sweep")).toBeTruthy();
    expect(screen.getByLabelText(sampleEvent.narrative).classList.contains("text-center")).toBe(true);
  });
});
