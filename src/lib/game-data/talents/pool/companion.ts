// Talent definitions for keyword: companion.
import { Bone, Trash, HeartPulse, Link2, Eye, Hand, HeartHandshake, ShieldAlert, Ban, Bell } from "lucide-react";
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const companionTalents: TalentDefinition[] = [
  {
    id: "companion-damage",
    keywordId: "companion",
    name: "Feral Strength",
    description: "Increase Companion damage by 1",
    icon: Bone,
    effects: [addEffect("companionDamage", 1)],
  },
  {
    id: "companion-gold-find",
    keywordId: "companion",
    name: "Scavenger",
    description: "Companions sometimes find Gold after combat",
    icon: Trash,
    effects: [setEffect("companionGoldFindActive", true)],
  },
  {
    id: "companion-leech",
    keywordId: "companion",
    name: "Leech Companion",
    description: "Companions have a 10% chance to Leech",
    icon: HeartPulse,
    effects: [setEffect("companionLeechChance", 10)],
  },
  {
    id: "companion-hunters-bond",
    keywordId: "companion",
    name: "Hunter's Bond",
    description: "When you play a Companion card, draw a card",
    icon: Link2,
    effects: [setEffect("drawOnCompanionCard", 1)],
  },
  {
    id: "companion-predator-instinct",
    keywordId: "companion",
    name: "Predator's Instinct",
    description: "Companions deal double damage against enemies below 30% Health",
    icon: Eye,
    effects: [setEffect("companionDoubledVsLowHealth", true)],
  },
  {
    id: "companion-tame",
    keywordId: "companion",
    name: "Tame",
    description: "Companions deal 1 additional damage each turn",
    icon: Hand,
    effects: [addEffect("companionDamage", 1)],
  },
  {
    id: "companion-loyal",
    keywordId: "companion",
    name: "Loyal",
    description: "If you have a Companion, you take 1 less damage",
    icon: HeartHandshake,
    effects: [setEffect("damageReductionWithCompanion", 1)],
  },
  {
    id: "companion-watchdog",
    keywordId: "companion",
    name: "Watchdog",
    description: "When your Companion deals damage, gain 2 Block",
    icon: ShieldAlert,
    effects: [setEffect("blockOnCompanionDamage", 2)],
  },
  {
    id: "companion-takedown",
    keywordId: "companion",
    name: "Takedown",
    description: "Companions have a 10% chance to Stun",
    icon: Ban,
    effects: [setEffect("companionStunChance", 10)],
  },
  {
    id: "companion-whistle",
    keywordId: "companion",
    name: "Whistle",
    description: "Your first Companion card each combat is free",
    icon: Bell,
    effects: [setEffect("firstCompanionCardFree", true)],
  },
];
