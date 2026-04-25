import { IconHome } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { characters } from '@/shared/content/characters';
import { AnimatedScreenTitle } from '@/shared/ui/AnimatedScreenTitle';

export function CharacterSelectScreen() {
  const navigate = useNavigate();
  const { beginRun, unlockedCharacterIds } = useGame();
  const orderedCharacters = useMemo(() => {
    const knight = characters.find((character) => character.id === 'knight');
    const others = characters.filter((character) => character.id !== 'knight');

    return knight ? [others[0], knight, others[1]].filter(Boolean) : characters;
  }, []);

  return (
    <div className="h-full px-6 py-8" data-testid="screen-character-select">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-muted-foreground">
              New Run
            </p>
            <AnimatedScreenTitle>Choose Your Alchemist</AnimatedScreenTitle>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Knight uses the current full art asset; Rogue and Wizard remain placeholders until their art lands.
            </p>
          </div>

          <Button onClick={() => navigate('/')} variant="outline">
            <IconHome size={18} />
            Main Menu
          </Button>
        </div>

        <div className="grid flex-1 gap-4 md:grid-cols-3">
          {orderedCharacters.map((character) => (
            <div key={character.id}>
              {(() => {
                const unlocked = unlockedCharacterIds.includes(character.id);

                return (
              <Card className="flex h-full min-h-0 flex-col p-5">
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <div className="flex h-[clamp(220px,34vh,360px)] items-center justify-center">
                      {character.artPath ? (
                        <img alt={character.name} className="h-full w-full object-contain" src={character.artPath} />
                      ) : (
                        <Card
                          className="flex h-full w-full items-center justify-center border-dashed border-white/15 bg-white/[0.03] p-6"
                        >
                          <div className="space-y-2 text-center">
                            <h3 className="text-2xl font-semibold text-muted-foreground">
                              {character.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Full character art placeholder
                            </p>
                          </div>
                        </Card>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: character.accent }}>
                          {character.role}
                        </span>
                        {!unlocked ? (
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Locked
                          </span>
                        ) : null}
                      </div>
                      <h2 className="text-3xl font-semibold tracking-tight">{character.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {character.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {character.maxHealth} Health, {character.maxMana} Mana Crystals per battle
                      </p>
                    </div>
                  </div>

                  <Button
                    disabled={!unlocked}
                    onClick={() => {
                      if (!unlocked) {
                        return;
                      }

                      beginRun(character.id);
                      navigate('/battle');
                    }}
                    className="mt-auto w-full"
                    data-testid={`begin-run-${character.id}`}
                    size="default"
                  >
                    {unlocked ? `Begin run as ${character.name}` : `${character.name} is locked`}
                  </Button>
                </div>
              </Card>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}