// Run victory screen — shown after defeating the Act III boss.
import { Button } from "@/components/ui/button";

import { ScreenHeader } from "../ui/shared-ui";

export function RunVictoryScreen({
  onMainMenu,
}: {
  onMainMenu: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <ScreenHeader title="Victory" />
        <p className="mt-3 text-lg text-muted-foreground">
          The primordial evils have been vanquished. Alchemy is saved.
        </p>
      </div>

      <Button size="lg" className="min-w-44" onClick={onMainMenu}>
        Return to Main Menu
      </Button>
    </div>
  );
}
