/**
 * Release an `HTMLAudioElement` source so a discarded element (stopped SFX,
 * stalled preload) cannot keep a fetch attached. Callers clear their own
 * event handlers first; handler sets differ per module.
 */
export function releaseAudioElement(el: HTMLAudioElement): void {
  try {
    el.pause();
    el.removeAttribute("src");
    el.load();
  } catch {}
}
