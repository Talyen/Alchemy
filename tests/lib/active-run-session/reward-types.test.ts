import { describe, expect, it } from "vitest";
import {
  createEmptyRewardState,
  getRewardChoiceId,
  resolveRewardChoice,
  type BoonRewardState,
  type CardRewardState,
  type GearRewardState,
  type TrinketRewardState,
} from "@/lib/active-run-session";
import { cardLibrary, trinketLibrary } from "@/lib/game-data";
import { createGearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear/definitions";

describe("reward-types", () => {
  const card = cardLibrary[0]!;
  const trinket = trinketLibrary[0]!;
  const gearInstance = createGearInstance(gearDefinitions["leather-armor-basic"]);

  describe("getRewardChoiceId", () => {
    it("returns .id for cards and trinkets", () => {
      expect(getRewardChoiceId(card)).toBe(card.id);
      expect(getRewardChoiceId(trinket)).toBe(trinket.id);
    });

    it("returns .instanceId for gear instances", () => {
      expect(getRewardChoiceId(gearInstance)).toBe(gearInstance.instanceId);
    });
  });

  describe("resolveRewardChoice", () => {
    it("returns null when selectedId is null or empty", () => {
      const cardState: CardRewardState = {
        ...createEmptyRewardState(),
        choices: [card],
        selectedId: null,
      };
      expect(resolveRewardChoice(cardState)).toBeNull();
      expect(resolveRewardChoice(cardState, "")).toBeNull();
    });

    it("resolves card reward choices", () => {
      const cardState: CardRewardState = {
        ...createEmptyRewardState(),
        choices: [card],
        selectedId: card.id,
      };
      expect(resolveRewardChoice(cardState)).toEqual({
        rewardType: "card",
        choice: card,
      });
      expect(resolveRewardChoice(cardState, "non-existent-id")).toBeNull();
    });

    it("resolves boon reward choices", () => {
      const boonState: BoonRewardState = {
        ...createEmptyRewardState(),
        rewardType: "boon",
        choices: [trinket],
        selectedId: trinket.id,
      };
      expect(resolveRewardChoice(boonState)).toEqual({
        rewardType: "boon",
        choice: trinket,
      });
      expect(resolveRewardChoice(boonState, "non-existent-id")).toBeNull();
    });

    it("resolves trinket reward choices", () => {
      const trinketState: TrinketRewardState = {
        ...createEmptyRewardState(),
        rewardType: "trinket",
        choices: [trinket],
        selectedId: trinket.id,
      };
      expect(resolveRewardChoice(trinketState)).toEqual({
        rewardType: "trinket",
        choice: trinket,
      });
      expect(resolveRewardChoice(trinketState, "non-existent-id")).toBeNull();
    });

    it("resolves gear reward choices by instanceId", () => {
      const gearState: GearRewardState = {
        ...createEmptyRewardState(),
        rewardType: "gear",
        choices: [gearInstance],
        selectedId: gearInstance.instanceId,
      };
      expect(resolveRewardChoice(gearState)).toEqual({
        rewardType: "gear",
        choice: gearInstance,
      });
      expect(resolveRewardChoice(gearState, "non-existent-instance-id")).toBeNull();
    });
  });

  describe("createEmptyRewardState", () => {
    it("creates an empty card reward state by default", () => {
      const empty = createEmptyRewardState();
      expect(empty.rewardType).toBe("card");
      expect(empty.choices).toEqual([]);
      expect(empty.gold).toBe(0);
      expect(empty.destinations).toEqual([]);
      expect(empty.selectedId).toBeNull();
    });

    it("accepts custom destinations", () => {
      const destinations = ["Campfire", "Card Shop"] as const;
      const state = createEmptyRewardState([...destinations]);
      expect(state.destinations).toEqual(["Campfire", "Card Shop"]);
    });
  });
});
