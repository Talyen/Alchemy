import "../../../helpers/mock-audio";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMysteryEventNavigation } from "@/features/alchemy/run-loop/navigation/mystery-event-navigation";
import { resetAllTestStores, resetProfileForTest } from "../../../helpers/run-domain-store-test";
import { setRunProgress, setRunSession } from "../../../helpers/run-domain-store-test";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import {
  readActiveRun,
  readRunProfile,
  readRunRevision,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { findMysteryEvent, type MysteryChoice, type MysteryEffect } from "@/lib/mystery";
import { playGoldGain, playGoldSpend, playUISound } from "@/lib/audio";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { emptyHydratedMysteryVisit, hydrateMysteryVisit, readActivityData } from "@/lib/active-run-session";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
function renderMysteryNav(navigateTo = vi.fn((_screen: Screen, onCommit?: () => void) => onCommit?.())) {
  const hook = renderHook(() => createMysteryEventNavigation({ navigateTo }));
  return { ...hook, navigateTo };
}

function offerChoices(choices: MysteryChoice[]): MysteryChoice[] {
  setRunSession({
    activity: {
      kind: "mystery",
      data: {
        ...emptyHydratedMysteryVisit(),
        mysteryEvent: { id: "test-mystery", title: "Test Mystery", art: "", narrative: "", choices },
      },
    },
  });
  return readActivityData(readRunSession().activity, "mystery").mysteryEvent!.choices;
}

beforeEach(() => {
  resetAllTestStores();
  resetProfileForTest();
  setRunSession({ activity: { kind: "mystery", data: emptyHydratedMysteryVisit() } });
});

describe("createMysteryEventNavigation", () => {
  it("records the Herbs actually awarded, including the Homestead find bonus", () => {
    setRunProgress({ effects: { ...defaultHomesteadEffects, herbFindBonus: 0.5 } });
    const before = readRunProfile().materialInventory.herbs;
    const { result } = renderMysteryNav();
    const choice = offerChoices([
      {
        label: "Gather Herbs",
        effects: [{ kind: "gainMaterial" as const, material: "herbs" as const, amount: 3 }],
      },
    ])[0]!;

    act(() => result.current.handleMysteryChoice(choice));

    expect(readRunProfile().materialInventory.herbs - before).toBe(5);
    expect(readActivityData(readRunSession().activity, "mystery").mysteryChosenChoice?.effects).toEqual([
      { kind: "gainMaterial", material: "herbs", amount: 5 },
    ]);
    expect(choice.effects[0]).toEqual({ kind: "gainMaterial", material: "herbs", amount: 3 });
  });

  it("beginMysteryEvent stores an event and navigates", () => {
    const { result, navigateTo } = renderMysteryNav();

    act(() => {
      result.current.beginMysteryEvent();
    });

    expect(readActivityData(readRunSession().activity, "mystery").mysteryEvent).not.toBeNull();
    expect(readActivityData(readRunSession().activity, "mystery").mysteryCardChoices).toBeNull();
    expect(readActivityData(readRunSession().activity, "mystery").mysteryGrantedTrinketIds).toEqual([]);
    expect(readActivityData(readRunSession().activity, "mystery").mysteryGrantedGearInstances).toEqual([]);
    expect(readActivityData(readRunSession().activity, "mystery").mysteryChosenCardId).toBeNull();
    expect(readActivityData(readRunSession().activity, "mystery").mysteryChosenChoice).toBeNull();
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.MYSTERY, undefined);
    expect(playUISound).toHaveBeenCalledWith("musicBoxMystery");
  });

  it("awards and records Wildwood mystery Materials", () => {
    setRunProgress({ contentSystemType: "wildwood" });
    const before = readRunProfile().materialInventory.wood;
    const { result } = renderMysteryNav();
    const choice = offerChoices([
      {
        label: "Gather Wood",
        effects: [{ kind: "gainMaterial" as const, material: "wood" as const, amount: 3 }],
      },
    ])[0]!;

    act(() => result.current.handleMysteryChoice(choice));

    expect(readRunProfile().materialInventory.wood).toBe(before + 3);
    expect(readActivityData(readRunSession().activity, "mystery").mysteryChosenChoice?.effects).toEqual([
      { kind: "gainMaterial", material: "wood", amount: 3 },
    ]);
  });

  it("plays gold sounds only after the choice commits", () => {
    setRunProgress({ gold: 20 });
    const { result } = renderMysteryNav();
    const commits: number[] = [];
    vi.mocked(playGoldGain).mockImplementationOnce(() => {
      expect(readRunProfile().gold).toBe(25);
    });
    vi.mocked(playGoldSpend).mockImplementationOnce(() => {
      expect(readRunProfile().gold).toBe(25);
    });

    const choice = offerChoices([
      {
        label: "Trade",
        effects: [
          { kind: "gainGold", amount: 10 },
          { kind: "loseGold", amount: 5 },
        ],
      },
    ])[0]!;
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    act(() => {
      result.current.handleMysteryChoice(choice);
    });
    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(playGoldGain).toHaveBeenCalledOnce();
    expect(playGoldSpend).toHaveBeenCalledOnce();
  });

  it("handleMysteryChoice ignores a second call after the choice commits", () => {
    setRunProgress({ gold: 20 });
    const { result } = renderMysteryNav();
    const [choice, otherChoice] = offerChoices([
      { label: "Take", effects: [{ kind: "gainGold", amount: 10 }] },
      { label: "Take again", effects: [{ kind: "gainGold", amount: 10 }] },
    ]);

    act(() => {
      result.current.handleMysteryChoice(choice!);
      result.current.handleMysteryChoice(otherChoice!);
    });

    expect(readRunProfile().gold).toBe(30);
    expect(readActivityData(readRunSession().activity, "mystery").mysteryChosenChoice?.label).toBe("Take");
  });

  it("rejects invented choices without a commit, reward, RNG draw, or sound", () => {
    const { result } = renderMysteryNav();
    const offered = offerChoices([{ label: "Take", effects: [{ kind: "gainGold", amount: 10 }] }])[0]!;
    const beforeRevision = readRunRevision();
    const beforeRng = readActiveRun().rng;
    const beforeGold = readRunProfile().gold;

    act(() => {
      result.current.handleMysteryChoice({ ...offered, effects: [...offered.effects] });
    });

    expect(readRunRevision()).toBe(beforeRevision);
    expect(readActiveRun().rng).toEqual(beforeRng);
    expect(readRunProfile().gold).toBe(beforeGold);
    expect(readActivityData(readRunSession().activity, "mystery").mysteryChosenChoice).toBeNull();
    expect(playGoldGain).not.toHaveBeenCalled();
  });

  it("rejects a choice held from an earlier visit even when the event id repeats", () => {
    const { result } = renderMysteryNav();
    const oldChoice = offerChoices([{ label: "Take", effects: [{ kind: "gainGold", amount: 10 }] }])[0]!;
    const currentChoice = offerChoices([{ label: "Take", effects: [{ kind: "gainGold", amount: 10 }] }])[0]!;
    const beforeRevision = readRunRevision();

    act(() => result.current.handleMysteryChoice(oldChoice));
    expect(readRunRevision()).toBe(beforeRevision);
    expect(readRunProfile().gold).toBe(0);

    act(() => result.current.handleMysteryChoice(currentChoice));
    expect(readRunProfile().gold).toBe(10);
  });

  it("accepts the offered choice from a hydrated Mystery visit", () => {
    const visit = hydrateMysteryVisit({
      event: findMysteryEvent("fairy-ring")!,
      chosenChoice: null,
      cardChoices: null,
      grantedTrinketIds: [],
      grantedGear: [],
      chosenCardId: null,
    });
    setRunSession({ activity: { kind: "mystery", data: visit } });
    const choice = readActivityData(readRunSession().activity, "mystery").mysteryEvent!.choices[0]!;
    const { result } = renderMysteryNav();

    act(() => result.current.handleMysteryChoice(choice));

    expect(readRunProfile().gold).toBe(20);
    expect(readActivityData(readRunSession().activity, "mystery").mysteryChosenChoice?.label).toBe("Take the Gold");
  });

  it("handleMysteryChooseCard ignores a second pick", async () => {
    const { result } = renderMysteryNav();

    const { dispatchRunSessionCommand } = await import("@/features/alchemy/shared/stores/run-session-command");
    const { setMysteryCardChoices } = await import("@/features/alchemy/shared/stores/run-session-write-port");
    const { cardById } = await import("@/lib/game-data");
    act(() => {
      dispatchRunSessionCommand((draft) => {
        setMysteryCardChoices(draft, [cardById["slash"], cardById["block"]].filter(Boolean) as never);
      });
    });

    act(() => {
      result.current.handleMysteryChooseCard("slash");
      result.current.handleMysteryChooseCard("block");
    });

    expect(readActivityData(readRunSession().activity, "mystery").mysteryChosenCardId).toBe("slash");
  });

  it("rolls back state and skips gold sounds when a later effect throws", () => {
    setRunProgress({ gold: 20 });
    const { result } = renderMysteryNav();
    const choice = offerChoices([
      {
        label: "Broken",
        effects: [{ kind: "gainGold", amount: 10 }, { kind: "unknown-kind" } as unknown as MysteryEffect],
      },
    ])[0]!;

    expect(() =>
      act(() => {
        result.current.handleMysteryChoice(choice);
      }),
    ).toThrow(/Unhandled mystery effect kind/);

    expect(readRunProfile().gold).toBe(20);
    expect(playGoldGain).not.toHaveBeenCalled();
    expect(playGoldSpend).not.toHaveBeenCalled();
  });
});
