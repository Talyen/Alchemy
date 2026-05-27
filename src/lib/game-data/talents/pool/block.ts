// Talent definitions for keyword: block.
import type { TalentDefinition } from "../types";
import { setEffect } from "../types";

export const blockTalents: TalentDefinition[] = [
  {
    id: "block-depleted-heal",
    keywordId: "block",
    name: "Second Wind",
    description: "When Block is depleted, Restore 2 Health",
    effects: [setEffect("blockDepletedHeal", 2)],
  },
  {
    id: "block-absorb-physical",
    keywordId: "block",
    name: "Reinforce",
    description: "Block absorbs 20% more Physical damage",
    effects: [setEffect("blockAbsorbPhysicalBonus", 20)],
  },
  {
    id: "block-to-holy",
    keywordId: "block",
    name: "Sacred Shield",
    description: "Increase Holy damage by half your Block",
    effects: [setEffect("blockToHolyDamage", true)],
  },
  {
    id: "block-to-stun",
    keywordId: "block",
    name: "Impact Guard",
    description: "Increase Stun damage by half your Block",
    effects: [setEffect("blockToStunDamage", true)],
  },
  {
    id: "block-prevent-stun",
    keywordId: "block",
    name: "Grounding",
    description: "Block prevents receiving Stun buildup",
    effects: [setEffect("blockPreventsStun", true)],
  },
  {
    id: "block-to-physical",
    keywordId: "block",
    name: "Weighted Guard",
    description: "Increase Physical damage by half your Block",
    effects: [setEffect("blockToPhysicalDamage", true)],
  },
  {
    id: "block-reduce-burn",
    keywordId: "block",
    name: "Fireproof",
    description: "Block reduces Burn damage by 1",
    effects: [setEffect("blockReduceBurnDamage", 1)],
  },
  {
    id: "block-start",
    keywordId: "block",
    name: "Fortify",
    description: "Start each combat with 10 Block",
    effects: [setEffect("startBlock", 10)],
  },
  {
    id: "block-prevent-bleed",
    keywordId: "block",
    name: "Coagulate",
    description: "Block prevents receiving Bleed status effects",
    effects: [setEffect("blockPreventsBleed", true)],
  },
  {
    id: "block-prevent-poison",
    keywordId: "block",
    name: "Detoxify",
    description: "Block prevents receiving Poison status effects",
    effects: [setEffect("blockPreventsPoison", true)],
  },

  // --- Forge ---
];
