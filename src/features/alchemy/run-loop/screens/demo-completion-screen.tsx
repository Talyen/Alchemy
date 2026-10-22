import { useGameTranslation } from "@/components/use-game-translation";

import { demoFeatureShowcaseByLocale } from "@/lib/game-data";
import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { focusControl } from "../../shared/ui/focus-navigation";

export function DemoCompletionScreen({ onWishlist, onMainMenu }: { onWishlist?: () => void; onMainMenu: () => void }) {
  const i18n = useGameTranslation();
  const artwork = Object.hasOwn(demoFeatureShowcaseByLocale, i18n.locale)
    ? demoFeatureShowcaseByLocale[i18n.locale as keyof typeof demoFeatureShowcaseByLocale]
    : demoFeatureShowcaseByLocale.en;
  const wishlist = useRef<HTMLButtonElement>(null);
  const mainMenu = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    focusControl(wishlist.current ?? mainMenu.current);
  }, []);
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-6 bg-background px-8 py-8">
      <header className="flex shrink-0 flex-col items-center gap-1 text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          {i18n.text("demo-completion.act-complete", "Act I Complete")}
        </p>
        <h1 className="text-3xl font-bold tracking-wide text-balance text-gold-pale sm:text-4xl">
          {i18n.text("ui.demo-completion-screen.1", "The Journey Continues")}
        </h1>
      </header>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center py-4">
        <img
          src={artwork}
          width={2752}
          height={1536}
          alt={i18n.text(
            "ui.demo-completion-screen.2",
            "More Bosses; Wildwood Draft; The Labyrinth; More Heroes; 200+ Talents; Trinkets & Uniques; Build a Homestead",
          )}
          data-testid="demo-marketing-image"
          decoding="async"
          className="h-auto max-h-full w-auto max-w-full object-contain"
        />
      </div>
      <div className="flex w-full shrink-0 flex-col items-center gap-3 pb-8">
        {onWishlist ? (
          <Button ref={wishlist} size="lg" variant="primary" className="min-w-56" onClick={onWishlist}>
            {i18n.text("ui.demo-completion-screen.3", "Wishlist on Steam")}
          </Button>
        ) : null}
        <Button ref={mainMenu} variant="outline" className="h-11 min-w-44" onClick={onMainMenu}>
          {i18n.text("ui.demo-completion-screen.4", "Main Menu")}
        </Button>
      </div>
    </div>
  );
}
