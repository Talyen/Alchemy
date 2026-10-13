import "../../../helpers/mock-audio";
import { initializeMysteryForTest } from "../../../helpers/visit-initialization";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMysteryEventNavigation } from "@/features/alchemy/run-loop/navigation/mystery-event-navigation";
import {
  mutateRunForTest,
  resetAllTestStores,
  resetProfileForTest,
  setRunProgress,
  setRunSession,
} from "../../../helpers/run-domain-store-test";
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
import { defaultGameSession } from "@/app/application-session";
function createMysteryNav(navigateTo = vi.fn((_screen: Screen, onCommit?: () => void) => onCommit?.())) {
  const nav = createMysteryEventNavigation({ navigateTo }, defaultGameSession);
  return { nav, navigateTo };
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
  return readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryEvent!.choices;
}

beforeEach(() => {
  resetAllTestStores();
  resetProfileForTest();
  setRunSession({ activity: { kind: "mystery", data: emptyHydratedMysteryVisit() } });
});

describe("createMysteryEventNavigation", () => {
  it("a stale Mystery initializer cannot navigate away from another activity", () => {
    const { nav, navigateTo } = createMysteryNav();
    setRunSession({ activity: { kind: "destination" } });
    const activity = readRunSession(defaultGameSession).activity;
    const revision = readRunRevision(defaultGameSession);
    nav.beginMysteryEvent();
    expect(readRunSession(defaultGameSession).activity).toBe(activity);
    expect(readRunRevision(defaultGameSession)).toBe(revision);
    expect(navigateTo).not.toHaveBeenCalled();
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("reinitializing a claimed Mystery preserves its offer, claim, and RNG", () => {
    const { nav } = createMysteryNav();
    const choice = offerChoices([{ label: "Take Gold", effects: [{ kind: "gainGold", amount: 10 }] }])[0]!;
    expect(nav.handleMysteryChoice(choice)).toBe(true);
    const activity = readRunSession(defaultGameSession).activity;
    const rng = readActiveRun(defaultGameSession).rng;
    const revision = readRunRevision(defaultGameSession);

    nav.beginMysteryEvent();

    expect(readRunSession(defaultGameSession).activity).toBe(activity);
    expect(readActiveRun(defaultGameSession).rng).toEqual(rng);
    expect(readRunRevision(defaultGameSession)).toBe(revision);
    expect(nav.handleMysteryChoice(choice)).toBe(false);
  });

  it("records the Herbs actually awarded, including the Homestead find bonus", () => {
    setRunProgress({ effects: { ...defaultHomesteadEffects, herbFindBonus: 0.5 } });
    const before = readRunProfile(defaultGameSession).materialInventory.herbs;
    const { nav } = createMysteryNav();
    const choice = offerChoices([
      {
        label: "Gather Herbs",
        effects: [{ kind: "gainMaterial" as const, material: "herbs" as const, amount: 3 }],
      },
    ])[0]!;

    expect(nav.handleMysteryChoice(choice)).toBe(true);

    expect(readRunProfile(defaultGameSession).materialInventory.herbs - before).toBe(5);
    expect(
      readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenChoice?.effects,
    ).toEqual([{ kind: "gainMaterial", material: "herbs", amount: 5 }]);
    expect(choice.effects[0]).toEqual({ kind: "gainMaterial", material: "herbs", amount: 3 });
  });

  it("presents an initialized event without changing its committed state", () => {
    initializeMysteryForTest(defaultGameSession);
    const before = readRunRevision(defaultGameSession);
    const { nav, navigateTo } = createMysteryNav();

    nav.beginMysteryEvent();

    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryEvent).not.toBeNull();
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryCardChoices).toBeNull();
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryGrantedTrinketIds).toEqual(
      [],
    );
    expect(
      readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryGrantedGearInstances,
    ).toEqual([]);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenCardId).toBeNull();
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenChoice).toBeNull();
    expect(readRunRevision(defaultGameSession)).toBe(before);
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.MYSTERY, undefined);
    expect(playUISound).toHaveBeenCalledWith("musicBoxMystery");
  });

  it("awards and records Wildwood mystery Materials", () => {
    setRunProgress({ contentSystemType: "wildwood" });
    const before = readRunProfile(defaultGameSession).materialInventory.wood;
    const { nav } = createMysteryNav();
    const choice = offerChoices([
      {
        label: "Gather Wood",
        effects: [{ kind: "gainMaterial" as const, material: "wood" as const, amount: 3 }],
      },
    ])[0]!;

    nav.handleMysteryChoice(choice);

    expect(readRunProfile(defaultGameSession).materialInventory.wood).toBe(before + 3);
    expect(
      readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenChoice?.effects,
    ).toEqual([{ kind: "gainMaterial", material: "wood", amount: 3 }]);
  });

  it("plays gold sounds only after the choice commits", () => {
    setRunProgress({ gold: 20 });
    const { nav } = createMysteryNav();
    const commits: number[] = [];
    vi.mocked(playGoldGain).mockImplementationOnce(() => {
      expect(readRunProfile(defaultGameSession).gold).toBe(25);
    });
    vi.mocked(playGoldSpend).mockImplementationOnce(() => {
      expect(readRunProfile(defaultGameSession).gold).toBe(25);
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
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision), defaultGameSession);

    nav.handleMysteryChoice(choice);
    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(playGoldGain).toHaveBeenCalledOnce();
    expect(playGoldSpend).toHaveBeenCalledOnce();
  });

  it("handleMysteryChoice ignores a second call after the choice commits", () => {
    setRunProgress({ gold: 20 });
    const { nav } = createMysteryNav();
    const [choice, otherChoice] = offerChoices([
      { label: "Take", effects: [{ kind: "gainGold", amount: 10 }] },
      { label: "Take again", effects: [{ kind: "gainGold", amount: 10 }] },
    ]);

    nav.handleMysteryChoice(choice!);
    nav.handleMysteryChoice(otherChoice!);

    expect(readRunProfile(defaultGameSession).gold).toBe(30);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenChoice?.label).toBe(
      "Take",
    );
  });

  it("rejects invented choices without a commit, reward, RNG draw, or sound", () => {
    const { nav } = createMysteryNav();
    const offered = offerChoices([{ label: "Take", effects: [{ kind: "gainGold", amount: 10 }] }])[0]!;
    const beforeRevision = readRunRevision(defaultGameSession);
    const beforeRng = readActiveRun(defaultGameSession).rng;
    const beforeGold = readRunProfile(defaultGameSession).gold;

    nav.handleMysteryChoice({ ...offered, effects: [...offered.effects] });

    expect(readRunRevision(defaultGameSession)).toBe(beforeRevision);
    expect(readActiveRun(defaultGameSession).rng).toEqual(beforeRng);
    expect(readRunProfile(defaultGameSession).gold).toBe(beforeGold);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenChoice).toBeNull();
    expect(playGoldGain).not.toHaveBeenCalled();
  });

  it("rejects a choice held from an earlier visit even when the event id repeats", () => {
    const { nav } = createMysteryNav();
    const oldChoice = offerChoices([{ label: "Take", effects: [{ kind: "gainGold", amount: 10 }] }])[0]!;
    const currentChoice = offerChoices([{ label: "Take", effects: [{ kind: "gainGold", amount: 10 }] }])[0]!;
    const beforeRevision = readRunRevision(defaultGameSession);

    expect(nav.handleMysteryChoice(oldChoice)).toBe(false);
    expect(readRunRevision(defaultGameSession)).toBe(beforeRevision);
    expect(readRunProfile(defaultGameSession).gold).toBe(0);

    expect(nav.handleMysteryChoice(currentChoice)).toBe(true);
    expect(readRunProfile(defaultGameSession).gold).toBe(10);
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
    const choice = readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryEvent!.choices[0]!;
    const { nav } = createMysteryNav();

    nav.handleMysteryChoice(choice);

    expect(readRunProfile(defaultGameSession).gold).toBe(20);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenChoice?.label).toBe(
      "Take the Gold",
    );
  });

  it("handleMysteryChooseCard ignores a second pick", async () => {
    const { nav } = createMysteryNav();

    const { dispatchRunSessionCommand } = await import("@/features/alchemy/shared/stores/run-session-command");
    const { setMysteryCardChoices } = await import("@/features/alchemy/shared/stores/run-session-write-port");
    const { cardById } = await import("@/lib/game-data");
    mutateRunForTest((draft) => {
      setMysteryCardChoices(draft, [cardById["slash"], cardById["block"]].filter(Boolean) as never);
    });

    nav.handleMysteryChooseCard("slash");
    nav.handleMysteryChooseCard("block");

    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenCardId).toBe("slash");
  });

  it("rolls back state and skips gold sounds when a later effect throws", () => {
    setRunProgress({ gold: 20 });
    const { nav } = createMysteryNav();
    const choice = offerChoices([
      {
        label: "Broken",
        effects: [{ kind: "gainGold", amount: 10 }, { kind: "unknown-kind" } as unknown as MysteryEffect],
      },
    ])[0]!;

    expect(() => nav.handleMysteryChoice(choice)).toThrow(/Unhandled mystery effect kind/);

    expect(readRunProfile(defaultGameSession).gold).toBe(20);
    expect(playGoldGain).not.toHaveBeenCalled();
    expect(playGoldSpend).not.toHaveBeenCalled();
  });

  it("awards trailing material rewards even when choice triggers card selection", () => {
    const { nav } = createMysteryNav();
    const beforeWood = readRunProfile(defaultGameSession).materialInventory.wood;
    const choice = offerChoices([
      {
        label: "Study and Gather",
        effects: [
          { kind: "chooseCard" as const },
          { kind: "gainMaterial" as const, material: "wood" as const, amount: 3 },
        ],
      },
    ])[0]!;

    nav.handleMysteryChoice(choice);

    expect(readRunProfile(defaultGameSession).materialInventory.wood).toBe(beforeWood + 3);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryCardChoices).not.toBeNull();
  });
});
