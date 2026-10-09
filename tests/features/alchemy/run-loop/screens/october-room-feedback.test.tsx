import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CampfireScreen } from "@/features/alchemy/run-loop/screens/campfire-screen";
import { LabyrinthNodeInspector } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-node-inspector";
import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { enemyById } from "@/lib/game-data";
import { gridLabyrinthMapFixture } from "../../../../fixtures/labyrinth-map";

afterEach(cleanup);

it("Hidden Purse acknowledges its Gold after a resumed Rest completion", () => {
  const props = {
    playerHealth: 100,
    maxHealth: 100,
    healFraction: 0.3,
    runDeck: [],
    potency: 0,
    onRest: vi.fn(() => true),
    onBrew: vi.fn(() => null),
    onContinue: vi.fn(),
    modifiers: ["hidden-purse" as const],
  };
  render(<CampfireScreen {...props} visit={{ ...emptyAlchemyVisit(), completed: true }} />);
  expect(screen.getByText("15 Gold added to your purse.")).toBeTruthy();
});

it("Herbal Hearth acknowledges the Potion added by Rest without calling it a brew", () => {
  render(
    <CampfireScreen
      playerHealth={100}
      maxHealth={100}
      healFraction={0.3}
      runDeck={[]}
      potency={0}
      visit={{ ...emptyAlchemyVisit(), completed: true }}
      modifiers={["herbal-hearth"]}
      onRest={() => true}
      onBrew={() => null}
      onContinue={() => {}}
    />,
  );
  expect(screen.getByText("A random Potion was added to your run deck.")).toBeTruthy();
  expect(screen.queryByText(/Potion brewed/)).toBeNull();
});

it("Labyrinth inspection shows native enemy traits alongside room modifiers before entry", () => {
  const map = gridLabyrinthMapFixture();
  const node = { ...map.nodes["labyrinth-floor-1-n0"]!, enemyId: "bandit", modifiers: ["braced" as const] };
  render(<LabyrinthNodeInspector node={node} map={map} onEnter={() => {}} onDescend={() => {}} />);
  for (const trait of enemyById.bandit.traits)
    expect(document.querySelector(`[data-trait="${trait.id}"]`)).not.toBeNull();
  expect(document.querySelector('[data-trait="braced"]')).not.toBeNull();
});
