/**
 * Release an `HTMLAudioElement` source so a discarded element (stopped SFX,
 * stalled preload) cannot keep a fetch attached. Callers clear their own
 * event handlers first; handler sets differ per module.
 */
export function releaseAudioElement(el: Pick<HTMLAudioElement, "pause" | "removeAttribute" | "load">): void {
  try {
    el.pause();
  } catch {}
  try {
    el.removeAttribute("src");
  } catch {}
  try {
    el.load();
  } catch {}
}
