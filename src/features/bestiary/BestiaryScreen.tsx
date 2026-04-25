import { EnemyGalleryGrid } from '@/features/bestiary/EnemyGalleryGrid';
import { AnimatedScreenTitle } from '@/shared/ui/AnimatedScreenTitle';

export function BestiaryScreen() {
  return (
    <div className="h-full px-6 py-8" data-testid="screen-bestiary">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-8">
        <AnimatedScreenTitle ta="center">Bestiary</AnimatedScreenTitle>
        <EnemyGalleryGrid />
      </div>
    </div>
  );
}
