import { afterEach, describe, expect, it } from "vitest";
import { applyInitialAnimationPreference } from "@/startup";

const FLAG = "alchemy-disable-animations";
const CLASS = "alchemy-disable-animations";

describe("applyInitialAnimationPreference", () => {
  afterEach(() => {
    localStorage.removeItem(FLAG);
    document.documentElement.classList.remove(CLASS);
  });

  it("adds the animation-disable class when the flag is set", () => {
    localStorage.setItem(FLAG, "true");
    applyInitialAnimationPreference();
    expect(document.documentElement.classList.contains(CLASS)).toBe(true);
  });

  it("leaves the class off without the flag", () => {
    applyInitialAnimationPreference();
    expect(document.documentElement.classList.contains(CLASS)).toBe(false);
  });
});
