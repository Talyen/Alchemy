import { HamburgerTrigger, ScreenHeader } from "../../../shared/ui/shared-ui";
import type { ArmoryScreenProps } from "./armory-screen-types";

export function ArmoryScreenHeader({ onOpenMenu }: { onOpenMenu: ArmoryScreenProps["onOpenMenu"] }) {
  return (
    <div className="relative flex min-h-10 w-full items-center justify-center px-12">
      <ScreenHeader title="Armory" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2">
        <HamburgerTrigger onClick={onOpenMenu} label="Open armory menu" />
      </div>
    </div>
  );
}
