import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { CampfireScreen } from "@/features/alchemy/run-loop/screens/campfire-screen";
import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { cardById } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
vi.mock("@/features/alchemy/shared/ui/cards/selectable-card", () => ({
  SelectableCard: ({ card, onSelect }: { card: { title: string }; onSelect: () => void }) => (
    <button onClick={onSelect}>{card.title}</button>
  ),
}));
vi.mock(
  "@/features/alchemy/shared/ui/cards/card-selection-grid",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
afterEach(() => {
  cleanup();
  resetEscapeStackForTests();
});
const offers = [cardById["health-potion"]!, cardById["mana-potion"]!, cardById["stoneskin-potion"]!];
function props() {
  return {
    playerHealth: 20,
    maxHealth: 100,
    healFraction: 0.3,
    runDeck: [],
    visit: { ...emptyAlchemyVisit(), offers },
    potency: 0,
    onRest: vi.fn(() => true),
    onBrew: vi.fn(() => null),
    onContinue: vi.fn(),
  };
}
describe("Campfire Rest or Brew", () => {
  installDisabledAnimationsForTests();
  it("offers three cards without a preview and grants on selection, with concise failure feedback", () => {
    const p = props();
    render(<CampfireScreen {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Brew Potion" }));
    expect(screen.getByRole("heading", { name: "Choose a Potion" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByLabelText("Brew preview")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Health Potion" }));
    expect(p.onBrew).toHaveBeenCalledExactlyOnceWith({ kind: "new", offerIndex: 0 });
    expect(screen.getByRole("alert").textContent).toBe("This Potion is no longer available.");
    expect(p.onRest).not.toHaveBeenCalled();
  });
  it("Escape returns from Potion choice to Rest without spending the visit", () => {
    const p = props();
    render(<CampfireScreen {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Brew Potion" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Rest" })).toBeTruthy();
    expect(p.onBrew).not.toHaveBeenCalled();
    expect(p.onRest).not.toHaveBeenCalled();
  });
  it("opens mixing automatically and confirms two ingredients without a price", () => {
    const p = props();
    render(<CampfireScreen {...p} runDeck={offers.slice(0, 2)} />);
    fireEvent.click(screen.getByRole("button", { name: "Brew Potion" }));
    expect(screen.getByRole("heading", { name: "Mix Potion" })).toBeTruthy();
    expect(screen.queryByText("Choose a Potion")).toBeNull();
    expect(screen.queryByRole("button", { name: "Strengthen" })).toBeNull();
    const mix = screen.getByRole("button", { name: "Mix" }) as HTMLButtonElement;
    expect(mix.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Health Potion" }));
    fireEvent.click(screen.getByRole("button", { name: "Mana Potion" }));
    expect(screen.getByLabelText("Brew preview")).toBeTruthy();
    fireEvent.click(mix);
    expect(p.onBrew).toHaveBeenCalledExactlyOnceWith({ kind: "combine", indices: [0, 1] });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Rest" })).toBeTruthy();
  });
  it("shows the restored result and Continue without allowing another action", () => {
    const p = props();
    render(<CampfireScreen {...p} visit={{ ...p.visit, completed: true, result: offers[0]! }} />);
    expect(screen.getByRole("button", { name: "Health Potion" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Brew Potion" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rest" })).toBeNull();
    expect(screen.queryByText(/Potion brewed/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(p.onContinue).toHaveBeenCalledOnce();
  });
});
