import { HamburgerTrigger, ScreenHeaderRow } from "../../../shared/ui/shared-ui";
import type { ArmoryScreenProps } from "./armory-screen-types";

export function ArmoryScreenHeader({ onOpenMenu }: { onOpenMenu: ArmoryScreenProps["onOpenMenu"] }) {
  return (
    <ScreenHeaderRow
      className="min-h-10 px-12"
      title="Armory"
      trailing={<HamburgerTrigger onClick={onOpenMenu} label="Open armory menu" />}
    />
  );
}
