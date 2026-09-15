import { describe, expect, it, vi } from "vitest";
import { createPlasmaLifecycle, resolvePlasmaBackingScale } from "@/lib/animation/keyword-plasma-lifecycle";

describe("keyword-plasma-lifecycle", () => {
  it("resolves plasma backing scale within bounds", () => {
    const scale = resolvePlasmaBackingScale(200, 200);
    expect(scale).toBeGreaterThanOrEqual(0.25);
    expect(scale).toBeLessThanOrEqual(2.0);
  });

  it("creates a plasma lifecycle that drives frame callbacks", () => {
    const parent = document.createElement("div");
    Object.defineProperty(parent, "clientWidth", { value: 100, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 100, configurable: true });
    const canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    document.body.appendChild(parent);

    const onFrame = vi.fn();
    const lifecycle = createPlasmaLifecycle({
      canvas,
      active: () => true,
      onFrame,
    });

    expect(lifecycle.logicalWidth).toBe(100);
    expect(lifecycle.logicalHeight).toBe(100);
    lifecycle.dispose();
    document.body.replaceChildren();
  });
});
