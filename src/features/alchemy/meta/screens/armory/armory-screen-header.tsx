import { ScreenHeaderRow } from "../../../shared/ui/shared-ui";

export function ArmoryScreenHeader({
  onBack,
  onMenu,
}: {
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
}) {
  return <ScreenHeaderRow className="min-h-10 px-12" title="Armory" onBack={onBack} onMenu={onMenu} />;
}
