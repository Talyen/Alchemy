// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolvePlasmaBackingScale } from "@/lib/animation/keyword-plasma-lifecycle";
import { startKeywordPlasma } from "@/lib/animation/keyword-plasma";

describe("resolvePlasmaBackingScale", () => {
  beforeEach(() => {
    vi.stubGlobal("devicePixelRatio", 1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("caps backing scale for large surfaces", () => {
    const scale = resolvePlasmaBackingScale(1920, 1080);
    expect(scale).toBeLessThanOrEqual(0.75);
    expect(scale).toBeGreaterThan(0);
  });
});

describe("startKeywordPlasma", () => {
  beforeEach(() => {
    vi.stubGlobal("devicePixelRatio", 1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns noop cleanup when canvas has no parent", () => {
    const canvas = document.createElement("canvas");
    const colorsRef = { current: { primary: "#ff0000", secondary: "#0000ff" } };
    const cleanup = startKeywordPlasma("canvas", {
      canvas,
      colorsRef,
      focalYOffset: 75,
      active: () => true,
    });
    expect(() => cleanup()).not.toThrow();
  });

  it("starts and stops canvas renderer without throwing", () => {
    const parent = document.createElement("div");
    Object.defineProperty(parent, "clientWidth", { value: 800, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 600, configurable: true });
    const canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    document.body.appendChild(parent);

    const colorsRef = { current: { primary: "#ff8040", secondary: "#4080ff" } };
    const cleanup = startKeywordPlasma("canvas", {
      canvas,
      colorsRef,
      focalYOffset: 75,
      active: () => true,
    });

    expect(() => cleanup()).not.toThrow();
    parent.remove();
  });

  it("does not schedule frames when animations are disabled", () => {
    localStorage.setItem("alchemy-disable-animations", "true");
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);

    const parent = document.createElement("div");
    Object.defineProperty(parent, "clientWidth", { value: 800, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 600, configurable: true });
    const canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    document.body.appendChild(parent);

    const cleanup = startKeywordPlasma("canvas", {
      canvas,
      colorsRef: { current: { primary: "#ff8040", secondary: "#4080ff" } },
      focalYOffset: 75,
      active: () => true,
    });

    expect(raf).not.toHaveBeenCalled();
    cleanup();
    parent.remove();
    localStorage.removeItem("alchemy-disable-animations");
  });

  it("starts and stops webgl renderer (falling back gracefully without throwing in jsdom)", () => {
    const parent = document.createElement("div");
    Object.defineProperty(parent, "clientWidth", { value: 800, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 600, configurable: true });
    const canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    document.body.appendChild(parent);

    const colorsRef = { current: { primary: "#ff8040", secondary: "#4080ff" } };
    const cleanup = startKeywordPlasma("webgl", {
      canvas,
      colorsRef,
      focalYOffset: 75,
      active: () => true,
    });

    expect(() => cleanup()).not.toThrow();
    parent.remove();
  });
});
