import { expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";

it.each([
  { enemyHealth: 1, restoredHealth: 1 },
  { enemyHealth: 10, restoredHealth: 2 },
])(
  "Venom Fangs Leech caps restoration at Poison Health loss with $enemyHealth enemy Health",
  ({ enemyHealth, restoredHealth }) => {
    const card = cardById["venom-fangs"]!;
    const state = patchBattleState({
      hand: [card],
      enemyHealth,
      playerHealth: 10,
      gearEffects: { flatPoisonDamage: 3 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.enemyHealth).toBe(Math.max(0, enemyHealth - 4));
    expect(result.playerHealth).toBe(10 + restoredHealth);
  },
);
