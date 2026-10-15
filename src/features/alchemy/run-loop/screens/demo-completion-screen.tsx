import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText } from "@/lib/localization/runtime";
import { demoFeatureShowcase } from "@/lib/game-data";
import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { focusControl } from "../../shared/ui/focus-navigation";
import { ScreenHeader } from "../../shared/ui/layout-components";

export function DemoCompletionScreen({ onWishlist, onMainMenu }: { onWishlist?: () => void; onMainMenu: () => void }) {
  useGameTranslation();
  const wishlist = useRef<HTMLButtonElement>(null);
  const mainMenu = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    focusControl(wishlist.current ?? mainMenu.current);
  }, []);
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-3 px-5 py-7">
      <ScreenHeader title={gameText("ui.demo-completion-screen.1", "The Journey Continues")} />
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <img
          src={demoFeatureShowcase}
          width={2752}
          height={1536}
          alt={gameText(
            "ui.demo-completion-screen.2",
            "More Bosses; Wildwood Draft; The Labyrinth; More Heroes; 200+ Talents; Trinkets & Uniques; Build a Homestead",
          )}
          data-testid="demo-marketing-image"
          decoding="async"
          className="h-auto max-h-full w-auto max-w-full object-contain"
        />
      </div>
      <div className="flex shrink-0 flex-wrap justify-center gap-3">
        {onWishlist ? (
          <Button ref={wishlist} size="lg" variant="primary" onClick={onWishlist}>
            {gameText("ui.demo-completion-screen.3", "Wishlist on Steam")}
          </Button>
        ) : null}
        <Button ref={mainMenu} size="lg" variant="outline" onClick={onMainMenu}>
          {gameText("ui.demo-completion-screen.4", "Main Menu")}
        </Button>
      </div>
    </div>
  );
}
