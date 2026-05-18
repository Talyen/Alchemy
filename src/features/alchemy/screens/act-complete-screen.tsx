// Act complete screen — shown after defeating an act boss before advancing.
import { Button } from "@/components/ui/button";
import { ACTS_PER_RUN } from "@/lib/game-constants";

import { ScreenHeader } from "../ui/shared-ui";

export function ActCompleteScreen({
  currentAct,
  onContinue,
  onMainMenu,
}: {
  currentAct: number;
  onContinue: () => void;
  onMainMenu: () => void;
}) {
  const isFinalAct = currentAct >= ACTS_PER_RUN;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <ScreenHeader title={isFinalAct ? "Final Act Complete" : `Act ${currentAct} Complete`} />
        <p className="mt-3 text-sm text-muted-foreground">
          {isFinalAct
            ? "The final boss lies ahead. Prepare for the ultimate challenge."
            : `The path to Act ${currentAct + 1} opens before you.`}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" variant="outline" className="min-w-44" onClick={onMainMenu}>
          Return to Menu
        </Button>
        <Button size="lg" className="min-w-44" onClick={onContinue}>
          {isFinalAct ? "Enter Final Battle" : `Enter Act ${currentAct + 1}`}
        </Button>
      </div>
    </div>
  );
}
