import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameplayStateStore } from "./gameplay-state-store";
import { deriveGearCombatRestrictions } from "../session/gear-combat-restrictions";
import { selectHasAnyOwnedGear, type GearArmorySlice } from "../session/gear-store";

export function useGearCombatRestrictions() {
  const selection = useGameplayStateStore(
    useShallow((s) => ({
      activityKind: s.session.activity.kind,
      characterId: s.run.activeRun.characterId,
      contentSystemType: s.run.activeRun.contentSystemType,
      loadouts: s.gear.loadouts,
      equippedTrinkets: s.gear.equippedTrinkets,
    })),
  );
  return useMemo(
    () =>
      deriveGearCombatRestrictions({
        session: { activity: { kind: selection.activityKind } },
        run: { activeRun: { characterId: selection.characterId, contentSystemType: selection.contentSystemType } },
        gear: { loadouts: selection.loadouts, equippedTrinkets: selection.equippedTrinkets },
      }),
    [selection],
  );
}

export function useGearArmorySlice(): GearArmorySlice {
  return useGameplayStateStore((state) => state.gear);
}

export function useArmoryIntroductionPending(): boolean {
  return useGameplayStateStore((state) => !state.profile.hasSeenArmory && selectHasAnyOwnedGear(state.gear));
}
