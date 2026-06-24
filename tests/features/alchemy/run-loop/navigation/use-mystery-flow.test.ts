// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMysteryFlow } from "@/features/alchemy/run-loop/navigation/use-mystery-flow";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
} from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetTransientRunUi();
  resetRunProgressSlice();
  useAppStore.setState(useAppStore.getInitialState());
});

describe("useMysteryFlow", () => {
  it("beginMysteryEvent stores an event and navigates", () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useMysteryFlow());

    act(() => {
      result.current.beginMysteryEvent(navigate);
    });

    expect(getRunSessionStoreView().mysteryEvent).not.toBeNull();
    expect(getRunSessionStoreView().mysteryCardChoices).toBeNull();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("handleMysteryChoice applies heal effects without follow-up", () => {
    const { result } = renderHook(() => useMysteryFlow());
    const healthBefore = getRunProgressStoreView().runPlayerHealth;

    act(() => {
      result.current.handleMysteryChoice({
        label: "Rest",
        effects: [{ kind: "healHealth", amount: 5 }],
      });
    });

    expect(getRunProgressStoreView().runPlayerHealth).toBe(
      Math.min(getRunProgressStoreView().runMaxHealth, healthBefore + 5),
    );
  });

  it("handleMysteryChoice stops when chooseCard requires follow-up UI", () => {
    const { result } = renderHook(() => useMysteryFlow());

    act(() => {
      result.current.handleMysteryChoice({
        label: "Browse",
        effects: [{ kind: "chooseCard" }],
      });
    });

    expect(getRunSessionStoreView().mysteryCardChoices).not.toBeNull();
  });
});
