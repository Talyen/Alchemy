import { afterEach, expect, it } from "vitest";
import { createGameSession, type GameSession } from "@/features/alchemy/shared/stores/game-session";
import { dispatchRunSessionCommand, rejectCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { resolveDraftAvailableDestinations } from "@/features/alchemy/shared/stores/destination-offer-command";
import {
  setCompletedDestinations,
  setCurrentAct,
  setDestinationIndexInAct,
  setGold,
  setRunMaxHealth,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import { trinketLibrary } from "@/lib/game-data";
import { DESTINATIONS } from "@/lib/routing";

const sessions: GameSession[] = [];
afterEach(async () => {
  await Promise.all(sessions.splice(0).map((session) => session.dispose()));
});

it("derives every destination rule from live transaction values and rolls them back on rejection", () => {
  const session = createGameSession();
  sessions.push(session);
  const before = readGameplayState(session);
  const eligible = dispatchRunSessionCommand(
    (draft) => {
      setCurrentAct(draft, 2);
      setDestinationIndexInAct(draft, 1);
      setCompletedDestinations(draft, [DESTINATIONS.CORRUPTION]);
      setRunMaxHealth(draft, 30);
      setRunPlayerHealth(draft, 10);
      setGold(draft, 100);
      // Owning one Trinket enables the Gear shop; owning all disables the Trinket shop.
      mutateGearWithRunHealthSync(draft, { mutate: (gear) => gear.addTrinket(trinketLibrary[0]!.id) });
      const withTrinket = resolveDraftAvailableDestinations(draft);
      expect(withTrinket).toContain(DESTINATIONS.GEAR_SHOP);
      expect(withTrinket).toContain(DESTINATIONS.TRINKET_SHOP);
      mutateGearWithRunHealthSync(draft, {
        mutate: (gear) => {
          for (const trinket of trinketLibrary) gear.addTrinket(trinket.id);
        },
      });
      const completedCollection = resolveDraftAvailableDestinations(draft);
      expect(completedCollection).not.toContain(DESTINATIONS.TRINKET_SHOP);
      setDestinationIndexInAct(draft, 7);
      expect(resolveDraftAvailableDestinations(draft)).toEqual([DESTINATIONS.BOSS_COMBAT]);
      return rejectCommand("exercise rollback", completedCollection);
    },
    undefined,
    session,
  );
  expect(new Set(eligible)).toEqual(
    new Set([
      DESTINATIONS.NORMAL_COMBAT,
      DESTINATIONS.CARD_SHOP,
      DESTINATIONS.CAMPFIRE,
      DESTINATIONS.MYSTERY,
      DESTINATIONS.ALCHEMIST_SHOP,
      DESTINATIONS.TRANSMUTATION,
      DESTINATIONS.GEAR_SHOP,
    ]),
  );
  expect(readGameplayState(session)).toBe(before);
});
