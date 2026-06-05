// Shared Zod enums for battle card effect schemas.
import { z } from "zod";
import { companionLibrary } from "../companions";
import { DAMAGE_TYPES, type CompanionId, type DamageType } from "../types";

const DAMAGE_TYPE_VALUES = DAMAGE_TYPES as unknown as [DamageType, ...DamageType[]];

export const DamageTypeSchema = z.enum(DAMAGE_TYPE_VALUES);
export const EnemyStatusIdSchema = z.enum(["burn", "poison", "bleed", "freeze", "stun"]);

const COMPANION_IDS = Object.keys(companionLibrary) as [CompanionId, ...CompanionId[]];
export const CompanionIdSchema = z.enum(COMPANION_IDS);
