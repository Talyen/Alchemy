import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("merges simple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes via clsx", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("resolves conflicting tailwind classes (last wins)", () => {
    expect(cn("px-4", "px-2")).toBe("px-2");
  });

  it("resolves padding conflicts correctly", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("merges non-conflicting classes correctly", () => {
    expect(cn("text-lg", "font-bold")).toBe("text-lg font-bold");
  });
});
