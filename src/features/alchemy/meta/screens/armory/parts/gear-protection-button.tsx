import { Lock, LockOpen } from "lucide-react";
import { getGearInstanceTitle, type GearInstance } from "@/lib/gear";

export function GearProtectionButton({
  instance,
  editable,
  onSetProtected,
}: {
  instance: GearInstance;
  editable: boolean;
  onSetProtected: (instanceId: string, protectedItem: boolean) => boolean;
}) {
  const Icon = instance.protected ? Lock : LockOpen;
  const label = `${instance.protected ? "Unlock" : "Protect"} ${getGearInstanceTitle(instance)}`;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={Boolean(instance.protected)}
      title={`${label}. Protected items cannot be salvaged or crafted`}
      disabled={!editable}
      className="absolute right-2 bottom-2 z-30 flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 bg-black/80 text-amber-100 transition-colors hover:bg-stone-700 focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-50"
      onClick={(event) => {
        event.stopPropagation();
        onSetProtected(instance.instanceId, !instance.protected);
      }}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
