// Screen route renderer for the root app shell.
import { renderAlchemyScreenRoute } from "@/app/screen-routes";
import type { RenderAlchemyScreenProps } from "@/app/render-screen-props";

export type { RenderAlchemyScreenProps } from "@/app/render-screen-props";

export function RenderAlchemyScreen({
  screen,
  run,
  battleBindings,
  onOpenBattleMenu,
  onClearSaveData,
  onUnlockAllDevMode,
  onBackFromOptions,
}: RenderAlchemyScreenProps) {
  return renderAlchemyScreenRoute({
    screen,
    run,
    battleBindings,
    onOpenBattleMenu,
    onClearSaveData,
    onUnlockAllDevMode,
    onBackFromOptions,
  });
}
