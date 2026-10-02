import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Layers } from "lucide-react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companionLibrary } from "@/lib/game-data";
import { CompanionPanel } from "@/features/alchemy/run-loop/battle/presentation/ui/companion-panel";
import { ServiceButton } from "@/features/alchemy/run-loop/shop/ui/service-button";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { KeywordTag } from "@/features/alchemy/shared/ui/keyword-tag";
import { LockedMenuItem } from "@/features/alchemy/shared/ui/locked-menu-item";
import { TabBar } from "@/features/alchemy/shared/ui/tab-bar";
import { PortaledTooltip } from "@/features/alchemy/shared/ui/tooltips/portaled-tooltip";
import { useInteractiveCard } from "@/features/alchemy/shared/ui/use-interactive-card";

beforeEach(() => useUiStore.getState().clearCardHover());
afterEach(() => cleanup());

describe("inspection through keyboard and Steam Input focus", () => {
  it("shows a locked menu entry's unlock reason on focus without activating it", async () => {
    const onSelect = vi.fn();
    render(
      <LockedMenuItem
        title="Armory"
        message="Finish a run to unlock the Armory"
        locked
        onSelect={onSelect}
        icon={<Layers />}
      >
        Armory
      </LockedMenuItem>,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Armory" }));
    expect(await screen.findByText("Finish a run to unlock the Armory")).toBeTruthy();
    expect(document.activeElement?.getAttribute("aria-describedby")).toBe(screen.getByRole("tooltip").id);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("lets keyboard users inspect the active Companion's actions", async () => {
    render(<CompanionPanel companion={companionLibrary.wolf} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Inspect Wolf Companion" }));
    expect(await screen.findByText("Wolf Companion")).toBeTruthy();
    expect(document.body.textContent).toContain("damage");
  });

  it("lets keyboard users inspect the hero's keyword pills", async () => {
    const { container } = render(<KeywordTag keywordId="burn" pill showTooltip />);
    await userEvent.tab();
    expect(document.activeElement).toBe(container.firstElementChild);
    await waitFor(() => expect(document.body.textContent).toContain("reduces by half each turn"));
  });

  it("explains an unavailable shop service on focus without allowing a purchase", async () => {
    const onClick = vi.fn();
    render(
      <ServiceButton
        icon={Layers}
        label="Mix Potions"
        cost={10}
        disabled
        disabledMessage="Not Enough Potions to Mix"
        used={false}
        soldOutText="Sold Out"
        onClick={onClick}
      />,
    );
    await userEvent.tab();
    expect(document.activeElement).not.toBe(document.body);
    await waitFor(() => expect(screen.getByRole("tooltip").textContent).toBe("Not Enough Potions to Mix"));
    await userEvent.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });
});

it("announces which Collection or Armory tab is selected", () => {
  const tabs = [
    { id: "cards", label: "Cards", icon: Layers },
    { id: "bestiary", label: "Bestiary", icon: Layers },
  ];
  const { rerender } = render(<TabBar tabs={tabs} activeTab="cards" onSelectTab={() => {}} />);
  expect(screen.getByRole("button", { name: "Cards" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Bestiary" }).getAttribute("aria-pressed")).toBe("false");
  rerender(<TabBar tabs={tabs} activeTab="bestiary" onSelectTab={() => {}} />);
  expect(screen.getByRole("button", { name: "Cards" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "Bestiary" }).getAttribute("aria-pressed")).toBe("true");
});

it("removes a card's hover when pagination unmounts it, preserving another card's hover", () => {
  const first = renderHook(() => useInteractiveCard("collection", "fireball"));
  act(() => first.result.current.onHoverStart());
  first.unmount();
  expect(useUiStore.getState().hoveredCardId).toBeNull();
  const old = renderHook(() => useInteractiveCard("collection", "fireball"));
  act(() => useUiStore.getState().setHoveredCardId("collection-frostbolt"));
  old.unmount();
  expect(useUiStore.getState().hoveredCardId).toBe("collection-frostbolt");
});

it("associates visible tooltip descriptions with their trigger and preserves existing descriptions", () => {
  function TooltipHarness({ visible }: { visible: boolean }) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    return (
      <>
        <span id="existing-description">Existing description</span>
        <button ref={triggerRef} aria-describedby="existing-description">
          Inspect
        </button>
        <PortaledTooltip triggerRef={triggerRef} visible={visible}>
          Additional inspection information
        </PortaledTooltip>
      </>
    );
  }
  const { rerender } = render(<TooltipHarness visible />);
  const trigger = screen.getByRole("button", { name: "Inspect" });
  const ids = trigger.getAttribute("aria-describedby")?.split(/\s+/) ?? [];
  expect(ids).toHaveLength(2);
  expect(ids).toContain("existing-description");
  const tooltip = screen.getByRole("tooltip");
  expect(ids).toContain(tooltip.id);
  expect(tooltip.textContent).toContain("Additional inspection information");
  fireEvent.focus(trigger);
  rerender(<TooltipHarness visible={false} />);
  expect(trigger.getAttribute("aria-describedby")).toBe("existing-description");
});
