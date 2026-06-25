import type { GearBaseItemDefinition } from "./base-items/types";
import { baseItemGroup1 } from "./base-items/base-item-group-1";
import { baseItemGroup2 } from "./base-items/base-item-group-2";
import { baseItemGroup3 } from "./base-items/base-item-group-3";

export type { GearBaseItemDefinition } from "./base-items/types";

export const gearBaseItems = {
  ...baseItemGroup1,
  ...baseItemGroup2,
  ...baseItemGroup3,
} satisfies Record<string, GearBaseItemDefinition>;

export type GearBaseItemId = keyof typeof gearBaseItems;

export const gearBaseItemList = Object.values(gearBaseItems);
