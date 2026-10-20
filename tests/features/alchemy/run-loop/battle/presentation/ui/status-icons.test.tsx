import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import catalogs from "@/lib/localization/locales/runtime.json";
import { installCatalogs, localization } from "@/lib/localization/runtime";

import { StatusIcon } from "@/features/alchemy/run-loop/battle/presentation/ui/status-icons";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { getEnemyStatusChips, getPlayerStatusChips } from "@/features/alchemy/shared/utils/battle";
import { dealDamage, makeTestCard, patchBattleState } from "../../../../../../fixtures/battle";
import { installFocusInputForTests } from "../../../../../../helpers/focus-input-test";

installFocusInputForTests(true);

describe("StatusIcon", () => {
  beforeAll(() => installCatalogs(catalogs));
  afterEach(async () => {
    cleanup();
    await localization.changeLanguage("en");
  });

  it.each(["stun", "freeze"] as const)("describes the full duration of an extended %s", async (status) => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { [status]: 50 },
      talentEffects: { stunDurationExtension: 1 },
      trinketEffects: { freezeDurationExtension: 1 },
    });
    const controlled = status === "stun" ? resolveStunTrigger(state, []) : tryTriggerEnemyFreeze(state, state, []);
    const chip = getEnemyStatusChips(controlled).find(
      (entry) => entry.id === (status === "stun" ? "stunned" : "frozen"),
    )!;
    expect(chip.value).toBe(2);
    const { rerender } = render(<StatusIcon chip={chip} />);
    const trigger = screen.getByRole("button", { name: status === "stun" ? "Stunned" : "Frozen" });
    fireEvent.focus(trigger);
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel")?.textContent).toContain(
        `${status === "stun" ? "Stunned" : "Frozen"} combatants skip their next 2 turns.`,
      ),
    );
    await act(async () => {
      await localization.changeLanguage("ru");
    });
    const keyword = status === "stun" ? "Оглушённые" : "Замороженные";
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel")?.textContent).toContain(
        `${keyword} бойцы пропускают следующие 2 хода.`,
      ),
    );
    rerender(<StatusIcon chip={{ ...chip, value: 5 }} />);
    await waitFor(() => {
      const tooltip = document.querySelector(".hover-popup-panel");
      expect(tooltip?.textContent).toContain(`${keyword} бойцы пропускают следующие 5 ходов.`);
      expect(tooltip?.querySelector(".font-semibold")?.textContent).toBe(keyword);
    });
    expect(screen.getByRole("button")).toBe(trigger);
  });

  it("shows Riposte after a Dodge, preserves it through Holy damage, and spends it on Physical damage", async () => {
    const dodged = applyEnemyAbility(
      patchBattleState({
        talentEffects: computeTalentEffects({ physical: ["physical-brute-force"] }),
        flags: { dodgeNextAttack: true },
        rng: () => 0.99,
      }),
      cardById.slash!,
      [],
    );
    const holy = dealDamage(dodged, makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 1 }] }));
    const chip = getPlayerStatusChips(holy).find((entry) => entry.id === "nextPhysicalCrit");
    expect(chip).toEqual({ id: "nextPhysicalCrit", value: 1, hideValue: true });
    render(<StatusIcon chip={chip!} />);
    fireEvent.focus(screen.getByRole("button", { name: "Riposte" }));
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain(
        "Riposte makes your next Physical attack a Critical Hit.",
      ),
    );
    const hit = dealDamage(holy, cardById.slash!);
    expect(getPlayerStatusChips(hit).some((entry) => entry.id === "nextPhysicalCrit")).toBe(false);
  });

  it("describes the armed Parting Cut as half damage, matching the talent earned on Dodge", async () => {
    const state = patchBattleState({
      talentEffects: computeTalentEffects({ bleed: ["bleed-physical-bonus"] }),
      flags: { dodgeNextAttack: true },
      rng: () => 0.99,
    });
    const dodged = applyEnemyAbility(state, cardById.slash!, []);
    const chip = getPlayerStatusChips(dodged).find((entry) => entry.id === "nextPhysicalDealsBleed")!;
    render(<StatusIcon chip={chip} />);
    fireEvent.focus(screen.getByRole("button", { name: "Parting Cut" }));
    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel")?.textContent).toContain(
        "Your next Physical hit deals half its damage as extra Bleed damage.",
      );
    });
  });

  it("presents Control Immunity without a numeric badge", async () => {
    render(<StatusIcon chip={{ id: "ccImmunity", value: 2, hideValue: true }} />);

    const trigger = screen.getByRole("button", { name: "Control Immunity" });
    fireEvent.mouseEnter(trigger);

    expect(screen.getByText("Control Immunity")).toBeTruthy();
    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
    });
    expect(screen.queryByText("2")).toBeNull();
  });

  it("allows keyboard inspection of a counted keyword status", async () => {
    render(<StatusIcon chip={{ id: "thorns", value: 2, hideValue: true }} />);

    fireEvent.focus(screen.getByRole("button", { name: "Thorns 2" }));

    await waitFor(() => {
      const tooltip = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
      expect(tooltip?.textContent).toContain("Thorns are Consumed when hit, dealing Nature damage to the attacker.");
    });
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("keeps Haste's remaining turns visible when other armed effects hide their values", async () => {
    render(<StatusIcon chip={{ id: "haste", value: 3, hideValue: true }} />);
    fireEvent.focus(screen.getByRole("button", { name: "Haste 3" }));
    await waitFor(() => expect(screen.getByText("3")).toBeTruthy());
    expect(screen.getByText("Haste grants an extra turn before enemies act.")).toBeTruthy();
  });

  it("presents Phoenix Feather as a status without a numeric badge", async () => {
    render(<StatusIcon chip={{ id: "phoenixFeather", value: 1, hideValue: true }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Phoenix Feather" }));

    await waitFor(() => {
      const tooltip = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
      expect(tooltip?.textContent).toContain("Phoenix Feather revives you once at 30% of max Health.");
    });
    expect(screen.queryByText("1")).toBeNull();
  });

  it("translates generated Incoming damage tooltips in place", async () => {
    render(<StatusIcon chip={{ id: "pending-burn", value: 12 }} />);
    const trigger = screen.getByRole("button", { name: "Incoming Burn 12" });
    fireEvent.focus(trigger);
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel")?.textContent).toContain(
        "Burn damage hits this enemy at the start of your next turn.",
      ),
    );
    await act(async () => {
      await localization.changeLanguage("de");
    });
    expect(screen.getByRole("button", { name: "Eingehender Brandschaden 12" })).toBe(trigger);
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel")?.textContent).toContain(
        "Brandschaden trifft diesen Gegner zu Beginn deines nächsten Zuges.",
      ),
    );
  });
});
