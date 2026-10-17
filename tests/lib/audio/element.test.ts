import { expect, it, vi } from "vitest";
import { releaseAudioElement } from "@/lib/audio/element";

it.each(["pause", "removeAttribute"] as const)("still releases the source if %s throws", (operation) => {
  const element = { pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() };
  element[operation].mockImplementationOnce(() => {
    throw new Error("media failure");
  });
  expect(() => releaseAudioElement(element)).not.toThrow();
  expect(element.pause).toHaveBeenCalledOnce();
  expect(element.removeAttribute).toHaveBeenCalledWith("src");
  expect(element.load).toHaveBeenCalledOnce();
});
