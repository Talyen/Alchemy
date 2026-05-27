import { describe, expect, it, vi } from "vitest";
import { createTransferCancelRegistry } from "@/features/alchemy/battle/transfer-lifecycle";

describe("createTransferCancelRegistry", () => {
  it("unregisters callbacks so cancelAll skips them", () => {
    const registry = createTransferCancelRegistry();
    const callback = vi.fn();
    const unregister = registry.register(callback);
    unregister();
    registry.cancelAll();
    expect(callback).not.toHaveBeenCalled();
  });

  it("invokes all registered callbacks on cancelAll", () => {
    const registry = createTransferCancelRegistry();
    const first = vi.fn();
    const second = vi.fn();
    registry.register(first);
    registry.register(second);
    registry.cancelAll();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    const third = vi.fn();
    registry.register(third);
    registry.cancelAll();
    expect(third).toHaveBeenCalledOnce();
  });
});
