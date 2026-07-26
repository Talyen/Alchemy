// Blocking screen shown when a local save requires newer game data than this build supports.
// Depends only on the shared Button primitive so unsupported saves cannot enter normal game UI.
import { Button } from "@/components/ui/button";

export function UnsupportedSaveVersionScreen({ canQuit, onQuit }: { canQuit: boolean; onQuit: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8 text-center">
      <section className="alchemy-shell relative max-w-2xl rounded-shell-dialog border border-border/80 px-8 py-10">
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">Save Protected</p>
          <h1 className="text-3xl font-bold text-amber-100/75">Newer Save Data Detected</h1>
          <p className="text-base leading-relaxed text-foreground">
            This save was created with a newer version of Alchemy or newer game content than this build can read.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your progress is safe and has not been changed. Please update the game to continue.
          </p>
          {canQuit ? (
            <Button size="lg" className="mt-3 min-w-40" onClick={onQuit}>
              Exit
            </Button>
          ) : (
            <p className="pt-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              You can close this window after updating the game.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
