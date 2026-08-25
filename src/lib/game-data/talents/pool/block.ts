// Talent definitions for keyword: block.
import { Wind, ShieldCheck, Sun, Zap, Anchor, Weight, Flame, ChevronsUp, Droplets, FlaskConical } from "lucide-react";
import type { TalentDefinition } from "../types";
import { setEffect, addEffect } from "../types";

export const blockTalents: TalentDefinition[] = [
  {
    id: "block-depleted-heal",
    keywordId: "block",
    name: "Second Wind",
    description: "When Block is depleted, restore 2 Health",
    icon: Wind,
    effects: [setEffect("blockDepletedHeal", 2)],
  },
  {
    id: "block-absorb-physical",
    keywordId: "block",
    name: "Reinforce",
    description: "Block absorbs 20% more Physical damage",
    icon: ShieldCheck,
    effects: [setEffect("blockAbsorbPhysicalBonus", 20)],
  },
  {
    id: "block-to-holy",
    keywordId: "block",
    name: "Sacred Shield",
    description: "Increase Holy damage by half your Block",
    icon: Sun,
    effects: [setEffect("blockToHolyDamage", true)],
  },
  {
    id: "block-to-stun",
    keywordId: "block",
    name: "Impact Guard",
    description: "Stun damage is increased by 30% of your Block",
    icon: Zap,
    effects: [setEffect("blockToStunDamage", true)],
  },
  {
    id: "block-prevent-stun",
    keywordId: "block",
    name: "Grounding",
    description: "Block prevents receiving Stun buildup",
    icon: Anchor,
    effects: [setEffect("blockPreventsStun", true)],
  },
  {
    id: "block-to-physical",
    keywordId: "block",
    name: "Weighted Guard",
    description: "Physical damage is increased by 30% of your Block",
    icon: Weight,
    effects: [addEffect("blockToPhysicalDamageMultiplier", 0.3)],
  },
  {
    id: "block-reduce-burn",
    keywordId: "block",
    name: "Fireproof",
    description: "Block reduces Burn damage by 1",
    icon: Flame,
    effects: [setEffect("blockReduceBurnDamage", 1)],
  },
  {
    id: "block-start",
    keywordId: "block",
    name: "Footwork",
    description: "When you Dodge, gain Block equal to the dodged attack",
    icon: ChevronsUp,
    effects: [setEffect("blockOnDodgeEqualToAttack", true)],
  },
  {
    id: "block-prevent-bleed",
    keywordId: "block",
    name: "Coagulate",
    description: "Block prevents receiving Bleed status effects",
    icon: Droplets,
    effects: [setEffect("blockPreventsBleed", true)],
  },
  {
    id: "block-prevent-poison",
    keywordId: "block",
    name: "Detoxify",
    description: "Block prevents receiving Poison status effects",
    icon: FlaskConical,
    effects: [setEffect("blockPreventsPoison", true)],
  },
];
