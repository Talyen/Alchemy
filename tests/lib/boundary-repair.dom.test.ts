import { expect, it, vi } from "vitest";
import { CloudSaveMirror } from "@/lib/cloud-save-mirror";
import { effectsForAffixRolls, getGearAffixTooltipEntries, normalizeAffixRolls } from "@/lib/gear";
import { createNumericManifest } from "@/lib/manifest-utils";
import { waitForImage } from "@/lib/preload/image-readiness";
import { deferred } from "../helpers/deferred";

it("retries the newest queued mirror after a failed clear", async () => {
  const mirror = new CloudSaveMirror();
  const active = deferred<boolean>();
  const retried = deferred<void>();
  const order: string[] = [];
  mirror.enqueue("primary", () => {
    order.push("active");
    return active.promise;
  });
  mirror.enqueue("primary", async () => {
    order.push("obsolete");
    return true;
  });
  mirror.enqueue("primary", async () => {
    order.push("latest");
    retried.resolve();
    return true;
  });
  const clearing = mirror.clear(async () => {
    order.push("clear");
    throw new Error("failed");
  });
  active.resolve(true);
  await expect(clearing).rejects.toThrow("failed");
  await retried.promise;
  expect(order).toEqual(["active", "clear", "latest"]);
});

it("does not restore suspended uploads if any overlapping clear succeeds", async () => {
  const mirror = new CloudSaveMirror();
  const active = deferred<boolean>();
  const failure = deferred<void>();
  const write = vi.fn(async () => true);
  mirror.enqueue("primary", () => active.promise);
  mirror.enqueue("primary", write);
  const first = mirror.clear(async () => {
    await failure.promise;
    throw new Error("failed");
  });
  const second = mirror.clear(async () => true);
  active.resolve(true);
  await second;
  failure.resolve();
  await expect(first).rejects.toThrow("failed");
  await Promise.resolve();
  expect(write).not.toHaveBeenCalled();
});

it("starts only one image decode while an earlier decode is pending", async () => {
  const decoded = deferred<void>();
  const image = document.createElement("img");
  Object.defineProperty(image, "complete", { configurable: true, value: true });
  Object.defineProperty(image, "decode", { configurable: true, value: vi.fn(() => decoded.promise) });
  const ready = waitForImage(image);
  image.dispatchEvent(new Event("load"));
  expect(image.decode).toHaveBeenCalledTimes(1);
  decoded.resolve();
  await expect(ready).resolves.toBe(true);
});

it("does not retain zero-valued affixes after rounding without a rarity", () => {
  const roll = { id: "flat-physical", value: 0.1 } as const;
  expect(normalizeAffixRolls([roll])).toEqual([]);
  expect(getGearAffixTooltipEntries([roll])).toEqual([]);
  expect(effectsForAffixRolls([roll]).flatPhysicalDamage).toBe(0);
  expect(normalizeAffixRolls([roll], "basic")).toEqual([{ id: "flat-physical", value: 1 }]);
});

it("creates own numeric entries for prototype-named manifest keys", () => {
  const manifest = createNumericManifest(["__proto__", "constructor", "ordinary"] as const);
  expect(Object.keys(manifest)).toEqual(["__proto__", "constructor", "ordinary"]);
  expect(Object.getPrototypeOf(manifest)).toBe(Object.prototype);
  expect(manifest.__proto__).toBe(0);
  expect(manifest.constructor).toBe(0);
});
