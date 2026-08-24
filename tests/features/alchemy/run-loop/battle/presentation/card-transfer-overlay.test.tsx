// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CardTransferOverlay } from "@/features/alchemy/run-loop/battle/presentation/card-transfer-overlay";
import type { CardTransfer } from "@/features/alchemy/shared/types";

const transfer: CardTransfer = {
  id: "draw-1",
  card: {
    id: "slash",
    title: "Slash",
    descriptionLines: ["Deal damage."],
    art: "slash.png",
    cost: 1,
    effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    uid: 1,
  },
  from: { x: 0, y: 0, width: 160, height: 214 },
  to: { x: 100, y: 100, width: 160, height: 214 },
  fromScale: 0.5,
  toScale: 1,
  fromRotation: 0,
  toRotation: 4.2,
  rotateY: [180, 90, 0],
  duration: 0.5,
};

describe("CardTransferOverlay", () => {
  afterEach(cleanup);

  it("uses the same one-pixel frame as a resting hand card", () => {
    const { container } = render(<CardTransferOverlay transfer={transfer} />);
    const faces = container.querySelectorAll("[data-flying-card] img");

    expect(faces).toHaveLength(2);
    for (const face of faces) {
      expect(face.classList.contains("border")).toBe(true);
      expect(face.classList.contains("border-border/80")).toBe(true);
    }
  });
});
