import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TiltSurface } from "@/features/alchemy/shared/ui/tilt-surface";

describe("TiltSurface", () => {
  afterEach(cleanup);

  it("keeps pointer tilt disabled by default", () => {
    render(<TiltSurface testId="surface">Art</TiltSurface>);

    const surface = screen.getByTestId("surface");
    fireEvent.mouseMove(surface, { clientX: 20, clientY: 20 });

    expect(surface.getAttribute("data-tilt-strength")).toBeNull();
    expect(surface.style.getPropertyValue("--tilt-rotate-x")).toBe("");
    expect(surface.style.getPropertyValue("--tilt-rotate-y")).toBe("");
  });

  it("exposes pointer tilt only when explicitly enabled", () => {
    render(
      <TiltSurface testId="surface" tiltEnabled>
        Logo
      </TiltSurface>,
    );

    expect(screen.getByTestId("surface").getAttribute("data-tilt-strength")).toBe("15");
  });
});
