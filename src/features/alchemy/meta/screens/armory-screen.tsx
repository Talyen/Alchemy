import { useMemo, useState } from "react";
import { Lock, Shield, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { characters, characterArt, type CharacterId } from "@/lib/game-data";
import {
  GEAR_SLOTS,
  applyGearModifiers,
  canSalvageGear,
  formatSalvageValue,
  gearDefinitions,
  getEquippedCharacterIds,
  getEquippedGearEffects,
  isGearCompatibleWithSlot,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { ConfirmationDialog, HamburgerTrigger, ScreenHeader } from "../../shared/ui/shared-ui";

const SLOT_LABELS: Record<GearSlot, string> = {
  body: "Body",
  helm: "Helm",
  boots: "Boots",
  gloves: "Gloves",
  belt: "Belt",
  "main-hand": "Main Hand",
  "off-hand": "Off-Hand",
  "left-ring": "Left Ring",
  "right-ring": "Right Ring",
  amulet: "Amulet",
};
const UNLOCK_PREVIOUS: Record<CharacterId, CharacterId | null> = {
  knight: null,
  rogue: "knight",
  wizard: "rogue",
  ranger: "wizard",
  alchemist: "ranger",
  warlock: "alchemist",
  druid: "warlock",
  wildcard: "druid",
};

type Props = {
  inventory: GearInstance[];
  loadouts: GearLoadouts;
  finishedRunCharacters: CharacterId[];
  browseOnly: boolean;
  onOpenMenu: (rect?: DOMRect) => void;
  onEquip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onSalvage: (instanceId: string) => void;
};

export function ArmoryScreen({
  inventory,
  loadouts,
  finishedRunCharacters,
  browseOnly,
  onOpenMenu,
  onEquip,
  onUnequip,
  onSalvage,
}: Props) {
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const [selectedSlot, setSelectedSlot] = useState<GearSlot>("body");
  const [salvageTarget, setSalvageTarget] = useState<GearInstance | null>(null);
  const byId = useMemo(() => new Map(inventory.map((item) => [item.instanceId, item])), [inventory]);
  const loadout = loadouts[characterId];
  const required = UNLOCK_PREVIOUS[characterId];
  const locked = required !== null && !finishedRunCharacters.includes(required);
  const editable = !browseOnly && !locked;
  const effects = getEquippedGearEffects(characterId, inventory, loadouts);
  const compatible = inventory.filter((instance) =>
    isGearCompatibleWithSlot(gearDefinitions[instance.definitionId], selectedSlot),
  );

  return (
    <div className="flex h-full w-full flex-col px-5 py-4">
      <div className="flex items-center justify-between">
        <ScreenHeader title="Armory" />
        <HamburgerTrigger onClick={onOpenMenu} label="Open armory menu" />
      </div>
      {browseOnly ? (
        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
          Equipment can be changed after combat.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {(Object.keys(characters) as CharacterId[]).map((id) => {
          const previous = UNLOCK_PREVIOUS[id];
          const isLocked = previous !== null && !finishedRunCharacters.includes(previous);
          return (
            <Button
              key={id}
              size="sm"
              variant={id === characterId ? "default" : "outline"}
              className={cn(isLocked && "opacity-50")}
              disabled={isLocked}
              onClick={() => {
                if (!isLocked) setCharacterId(id);
              }}
              aria-label={`${characters[id].name}${isLocked ? " (Locked)" : ""}`}
            >
              {isLocked ? <Lock className="h-3.5 w-3.5" /> : null}
              {characters[id].name}
            </Button>
          );
        })}
      </div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(12rem,1fr)_minmax(18rem,1.5fr)_minmax(14rem,1fr)] gap-4">
        <section className="alchemy-shell min-h-0 overflow-auto rounded-shell-dialog border border-border/80 p-4">
          <h2 className="font-display text-lg text-amber-100">Inventory</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {compatible.length} compatible item{compatible.length === 1 ? "" : "s"}
          </p>
          <div className="mt-3 grid gap-2">
            {compatible.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No Gear for this slot yet.</p>
            ) : (
              compatible.map((instance) => {
                const definition = gearDefinitions[instance.definitionId];
                const instanceEffects = applyGearModifiers({ ...definition.effects }, instance.modifiers);
                const shared = getEquippedCharacterIds(loadouts, instance.instanceId);
                const equippedHere = Object.values(loadout).includes(instance.instanceId);
                return (
                  <div
                    key={instance.instanceId}
                    className={cn(
                      "rounded-lg border p-2",
                      equippedHere ? "border-primary bg-primary/10" : "border-border/70",
                    )}
                  >
                    <button
                      className="flex w-full items-center gap-3 text-left"
                      disabled={!editable}
                      onClick={() => onEquip(characterId, selectedSlot, instance)}
                    >
                      <img src={definition.art} alt="" className="h-12 w-12 rounded-md object-cover" />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{definition.title}</strong>
                        <span className="text-xs text-muted-foreground">
                          {instanceEffects.flatPhysicalDamage > 0
                            ? `+${instanceEffects.flatPhysicalDamage} Physical damage`
                            : definition.descriptionLines[0]}
                        </span>
                        {shared.length > 0 ? (
                          <span className="mt-1 flex items-center gap-1 text-xs text-amber-200">
                            <Users className="h-3 w-3" /> {shared.map((id) => characters[id].name).join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {canSalvageGear(loadouts, instance.instanceId) && !browseOnly ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 w-full text-red-300"
                        onClick={() => setSalvageTarget(instance)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {formatSalvageValue(definition.salvageValue)}
                      </Button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
        <section className="alchemy-shell relative flex min-h-0 flex-col items-center rounded-shell-dialog border border-border/80 p-4">
          <div className="relative grid h-full w-full grid-cols-2 content-between gap-2">
            {GEAR_SLOTS.slice(0, 5).map((slot) => (
              <SlotButton
                key={slot}
                slot={slot}
                selected={selectedSlot === slot}
                instance={loadout[slot] ? byId.get(loadout[slot]!) : undefined}
                onSelect={setSelectedSlot}
                onUnequip={editable && loadout[slot] ? () => onUnequip(characterId, slot) : undefined}
              />
            ))}
            <img
              src={characterArt[characterId]}
              alt={characters[characterId].name}
              className={cn(
                "pointer-events-none absolute left-1/2 top-1/2 h-[62%] -translate-x-1/2 -translate-y-1/2 object-contain",
                locked && "grayscale opacity-40",
              )}
            />
            {GEAR_SLOTS.slice(5).map((slot) => (
              <SlotButton
                key={slot}
                slot={slot}
                selected={selectedSlot === slot}
                instance={loadout[slot] ? byId.get(loadout[slot]!) : undefined}
                onSelect={setSelectedSlot}
                onUnequip={editable && loadout[slot] ? () => onUnequip(characterId, slot) : undefined}
              />
            ))}
          </div>
          {locked ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-shell-dialog bg-black/55">
              <div className="text-center">
                <Lock className="mx-auto h-8 w-8" />
                <p className="mt-2 font-semibold">Finish a Run as the {characters[required!].name} to unlock</p>
              </div>
            </div>
          ) : null}
        </section>
        <section className="alchemy-shell rounded-shell-dialog border border-border/80 p-4">
          <h2 className="font-display text-lg text-amber-100">Loadout Effects</h2>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border/70 p-3">
            <Shield className="h-5 w-5 text-amber-300" />
            <div>
              <strong>Physical Damage</strong>
              <p className="text-sm text-muted-foreground">+{effects.flatPhysicalDamage}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Select a slot, then choose compatible Gear from the shared inventory. The same item can be used by multiple
            classes.
          </p>
        </section>
      </div>
      {salvageTarget ? (
        <ConfirmationDialog
          title="Salvage Gear?"
          description={`Permanently salvage ${gearDefinitions[salvageTarget.definitionId].title}. ${formatSalvageValue(gearDefinitions[salvageTarget.definitionId].salvageValue)}.`}
          confirmLabel="Salvage"
          onCancel={() => setSalvageTarget(null)}
          onConfirm={() => {
            onSalvage(salvageTarget.instanceId);
            setSalvageTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SlotButton({
  slot,
  selected,
  instance,
  onSelect,
  onUnequip,
}: {
  slot: GearSlot;
  selected: boolean;
  instance: GearInstance | undefined;
  onSelect: (slot: GearSlot) => void;
  onUnequip: (() => void) | undefined;
}) {
  const definition = instance ? gearDefinitions[instance.definitionId] : null;
  return (
    <div
      className={cn(
        "relative z-10 flex min-h-20 items-center gap-2 rounded-lg border p-2",
        selected ? "border-primary bg-primary/10" : "border-border/70 bg-background/75",
      )}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onSelect(slot)}
        aria-label={`Select ${SLOT_LABELS[slot]} slot`}
      >
        {definition ? (
          <img src={definition.art} alt="" className="h-10 w-10 rounded object-cover" />
        ) : (
          <div className="h-10 w-10 rounded border border-dashed border-border" />
        )}
        <span className="min-w-0">
          <strong className="block text-xs">{SLOT_LABELS[slot]}</strong>
          <span className="block truncate text-xs text-muted-foreground">{definition?.title ?? "Empty"}</span>
        </span>
      </button>
      {onUnequip ? (
        <button className="text-xs text-red-300" onClick={onUnequip}>
          Unequip
        </button>
      ) : null}
    </div>
  );
}
