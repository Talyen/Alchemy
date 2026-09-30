import { demoFeatureShowcase } from "@/lib/game-data";
import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { focusControl } from "../../shared/ui/focus-navigation";
import { ScreenHeader } from "../../shared/ui/layout-components";

export function DemoCompletionScreen({ onWishlist, onMainMenu }: { onWishlist?: () => void; onMainMenu: () => void }) {
  const wishlist = useRef<HTMLButtonElement>(null);
  const mainMenu = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    focusControl(wishlist.current ?? mainMenu.current);
  }, []);
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-3 px-5 py-7">
      <ScreenHeader title="The Journey Continues" />
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <img
          src={demoFeatureShowcase}
          width={2752}
          height={1536}
          alt="More Bosses; Wildwood Draft; The Labyrinth; More Heroes; 200+ Talents; Trinkets & Uniques; Build a Homestead"
          data-testid="demo-marketing-image"
          className="h-auto max-h-full w-auto max-w-full object-contain"
        />
      </div>
      <div className="flex shrink-0 flex-wrap justify-center gap-3">
        {onWishlist ? (
          <Button ref={wishlist} size="lg" variant="primary" onClick={onWishlist}>
            Wishlist on Steam
          </Button>
        ) : null}
        <Button ref={mainMenu} size="lg" variant="outline" onClick={onMainMenu}>
          Main Menu
        </Button>
      </div>
    </div>
  );
}
