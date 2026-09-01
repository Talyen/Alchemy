import { z } from "zod";
import { companionLibrary } from "../companions";
import { DAMAGE_TYPES, type CompanionId } from "../types";

export const DamageTypeSchema = z.enum(DAMAGE_TYPES);
export const EnemyStatusIdSchema = z.enum(["burn", "poison", "bleed", "freeze", "stun", "onAttackBleed"]);

export const PositiveAmountSchema = z.number().int().min(1).max(999);

const COMPANION_IDS = Object.keys(companionLibrary) as [CompanionId, ...CompanionId[]];
export const CompanionIdSchema = z.enum(COMPANION_IDS);

export const AmountSchema = z.number().int().min(0).max(999);
