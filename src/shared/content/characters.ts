import { characterArt } from '@/shared/assets/registry';

export type CharacterId = 'knight' | 'rogue' | 'wizard';

export type CharacterDefinition = {
  accent: string;
  artPath?: string;
  description: string;
  id: CharacterId;
  maxHealth: number;
  maxMana: number;
  name: string;
  role: string;
};

export const characters: CharacterDefinition[] = [
  {
    accent: 'alchemy.6',
    artPath: characterArt.knight,
    description: 'A durable frontliner who starts with the most health and is ready to showcase armor and forge synergies first.',
    id: 'knight',
    maxHealth: 60,
    maxMana: 3,
    name: 'Knight',
    role: 'Vanguard',
  },
  {
    accent: 'verdigris.6',
    description: 'Placeholder class slot for fast, opportunistic physical play and future crit or evade mechanics.',
    id: 'rogue',
    maxHealth: 48,
    maxMana: 3,
    name: 'Rogue',
    role: 'Skirmisher',
  },
  {
    accent: 'ember.6',
    description: 'Placeholder class slot for future spell-heavy decks and resource conversion effects.',
    id: 'wizard',
    maxHealth: 42,
    maxMana: 3,
    name: 'Wizard',
    role: 'Arcanist',
  },
];

export const charactersById = Object.fromEntries(characters.map((character) => [character.id, character])) as Record<
  CharacterId,
  CharacterDefinition
>;
