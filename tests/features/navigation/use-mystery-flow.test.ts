// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMysteryFlow } from "@/features/alchemy/navigation/use-mystery-flow";
import { resetScreenStores } from "@/features/alchemy/stores/screen-store";
import { useAppStore } from "@/features/alchemy/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/stores/homestead-store";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
} from "../../helpers/run-domain-store-test";

beforeEach(() => {
  resetScreenStores();
  resetRunProgressSlice();
  useAppStore.setState(useAppStore.getInitialState());
  useHomesteadStore.setState(useHomesteadStore.getInitialState());
});

describe("useMysteryFlow", () => {
  it("beginMysteryEvent stores an event and navigates", () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useMysteryFlow({ advanceToNextDestination: vi.fn() }));

    act(() => {
      result.current.beginMysteryEvent(navigate);
    });

    expect(getRunSessionStoreView().mysteryEvent).not.toBeNull();
    expect(getRunSessionStoreView().mysteryCardChoices).toBeNull();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("handleMysteryChoice applies heal effects without follow-up", () => {
    const advance = vi.fn();
    const { result } = renderHook(() => useMysteryFlow({ advanceToNextDestination: advance }));
    const healthBefore = getRunProgressStoreView().runPlayerHealth;

    act(() => {
      result.current.handleMysteryChoice({
        label: "Rest",
        effects: [{ kind: "healHealth", amount: 5 }],
      });
    });

    expect(getRunProgressStoreView().runPlayerHealth).toBe(Math.min(getRunProgressStoreView().runMaxHealth, healthBefore + 5));
    expect(advance).not.toHaveBeenCalled();
  });

  it("handleMysteryChoice stops when chooseCard requires follow-up UI", () => {
    const { result } = renderHook(() => useMysteryFlow({ advanceToNextDestination: vi.fn() }));

    act(() => {
      result.current.handleMysteryChoice({
        label: "Browse",
        effects: [{ kind: "chooseCard" }],
      });
    });

    expect(getRunSessionStoreView().mysteryCardChoices).not.toBeNull();
  });
});
