import type { CardKeywordId } from '@/entities/cards/types';

export const keywordColorPalette = {
  armor: '#f39b2e',
  block: '#52a6ff',
  forge: '#f39b2e',
  health: '#ff5d6a',
  physical: '#9fa6b2',
  burn: '#ff6a1a',
  gold: '#d9b247',
  wish: '#c792ea',
  ailment: '#b04fbf',
  consume: '#888888',
  mana: '#74c6ff',
  poison: '#7ecb5a',
  bleed: '#e05c5c',
  leech: '#b04fbf',
  freeze: '#9dd9f3',
  stun: '#f2d56b',
  twice: '#d7d0ff',
} as const;

export const effectColorPalette = {
  gold: '#d9b247',
  targetArmor: keywordColorPalette.armor,
  targetBlock: keywordColorPalette.block,
  targetForge: keywordColorPalette.forge,
  targetHostile: keywordColorPalette.health,
  targetRestore: '#72d38c',
} as const;

export const keywordDefinitions: Record<
  CardKeywordId,
  { color: string; description: string; id: CardKeywordId; label: string }
> = {
  armor: {
    color: keywordColorPalette.armor,
    description: 'Each stack of Armor decreases damage taken by 1 and removes a stack',
    id: 'armor',
    label: 'Armor',
  },
  block: {
    color: keywordColorPalette.block,
    description: 'Block absorbs damage taken before health and decreases by half each turn',
    id: 'block',
    label: 'Block',
  },
  forge: {
    color: keywordColorPalette.forge,
    description: 'Each stack of Forge increases your Physical damage dealt by 1',
    id: 'forge',
    label: 'Forge',
  },
  health: {
    color: keywordColorPalette.health,
    description: 'If Health reaches 0, your run ends',
    id: 'health',
    label: 'Health',
  },
  physical: {
    color: keywordColorPalette.physical,
    description: 'Physical damage type',
    id: 'physical',
    label: 'Physical',
  },
  burn: {
    color: keywordColorPalette.burn,
    description: 'Burn deals damage and reduces by half each turn',
    id: 'burn',
    label: 'Burn',
  },
  gold: {
    color: keywordColorPalette.gold,
    description: 'Gold is used to purchase items at the merchant',
    id: 'gold',
    label: 'Gold',
  },
  wish: {
    color: keywordColorPalette.wish,
    description: 'Choose one of three cards to add to your hand',
    id: 'wish',
    label: 'Wish',
  },
  ailment: {
    color: keywordColorPalette.ailment,
    description: 'Ailments are harmful status effects',
    id: 'ailment',
    label: 'Ailment',
  },
  consume: {
    color: keywordColorPalette.consume,
    description: 'Consumed cards are removed from your deck for the remainder of the battle',
    id: 'consume',
    label: 'Consume',
  },
  mana: {
    color: keywordColorPalette.mana,
    description: 'Mana is used to play cards',
    id: 'mana',
    label: 'Mana',
  },
  poison: {
    color: keywordColorPalette.poison,
    description: 'Poison deals damage each turn',
    id: 'poison',
    label: 'Poison',
  },
  bleed: {
    color: keywordColorPalette.bleed,
    description: 'Bleed deals damage once, and then twice as much next turn',
    id: 'bleed',
    label: 'Bleed',
  },
  leech: {
    color: keywordColorPalette.leech,
    description: 'Lifesteal heals you for the amount of damage dealt',
    id: 'leech',
    label: 'Leech',
  },
  freeze: {
    color: keywordColorPalette.freeze,
    description: 'Freeze damage causes the enemy to lose their turn if it accumulates to half their remaining HP',
    id: 'freeze',
    label: 'Freeze',
  },
  stun: {
    color: keywordColorPalette.stun,
    description: 'Stun damage causes the enemy to lose a turn when it reaches more than half the remaining HP',
    id: 'stun',
    label: 'Stun',
  },
  twice: {
    color: keywordColorPalette.twice,
    description: 'This card is played a second time for free',
    id: 'twice',
    label: 'Twice',
  },
};
