import { enemyGallery } from '@/shared/content/enemies';

type EnemyGalleryGridProps = {
  filterText?: string;
};

export function EnemyGalleryGrid({ filterText = '' }: EnemyGalleryGridProps) {
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredEnemies = enemyGallery.filter((enemy) => enemy.name.toLowerCase().includes(normalizedFilter));

  if (filteredEnemies.length === 0) {
    return (
      <p className="text-center text-muted-foreground">
        No enemies match that filter.
      </p>
    );
  }

  return (
    <div className="grid w-full gap-7 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
      {filteredEnemies.map((enemy) => (
        <div className="flex flex-col items-center gap-3" key={enemy.id}>
          <img alt={enemy.name} className="h-[250px] w-full object-contain" src={enemy.artPath} />
          <p className="text-center font-semibold">
            {enemy.name}
          </p>
        </div>
      ))}
    </div>
  );
}
