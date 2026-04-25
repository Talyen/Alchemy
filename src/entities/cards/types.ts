export type CardTemplateId =
  | 'void'
  | 'nature'
  | 'arcane'
  | 'fire'
  | 'frost'
  | 'mechanical'
  | 'holy'
  | 'death';

export type ManaType = 'arcane';

export type ManaPool = Record<ManaType, number>;

export const manaTypes = ['arcane'] as const satisfies readonly ManaType[];

export type CardKeywordId =
  | 'physical'
  | 'block'
  | 'forge'
  | 'armor'
  | 'health'
  | 'burn'
  | 'gold'
  | 'wish'
  | 'ailment'
  | 'consume'
  | 'mana'
  | 'poison'
  | 'bleed'
  | 'leech'
  | 'freeze'
  | 'stun'
  | 'twice';

export type CardDefinition = {
  id: string;
  title: string;
  description: string;
  artKey: string;
  templateId: CardTemplateId;
  category: 'attack' | 'skill' | 'item';
  keywords: CardKeywordId[];
};
