// Blocking screen shown when a local save requires a newer game schema than this build supports.
// Depends only on the shared Button primitive so unsupported saves cannot enter normal game UI.
import { Button } from "@/components/ui/button";

export function UnsupportedSaveVersionScreen({ canQuit, onQuit }: { canQuit: boolean; onQuit: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8 text-center">
      <section className="relative max-w-2xl rounded-[2rem] border border-amber-700/50 bg-stone-950/90 px-8 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-3 rounded-[1.5rem] border border-amber-500/10" />
        <div className="relative space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-300/70">Save Protected</p>
          <h1 className="text-3xl font-bold text-amber-100">Newer Save Version Detected</h1>
          <p className="text-base leading-relaxed text-stone-200">
            This save was created by a newer version of Alchemy than this build can read.
          </p>
          <p className="text-sm leading-relaxed text-stone-300">
            Your progress is safe and has not been changed. Please update the game to continue.
          </p>
          {canQuit ? (
            <Button size="lg" className="mt-3 min-w-40" onClick={onQuit}>Exit</Button>
          ) : (
            <p className="pt-2 text-xs uppercase tracking-[0.22em] text-stone-500">You can close this window after updating the game.</p>
          )}
        </div>
      </section>
    </div>
  );
}
