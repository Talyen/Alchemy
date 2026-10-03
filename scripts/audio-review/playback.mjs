// Isolated audition playback. It has no imports from Alchemy's runtime or stores.
export function createReviewPlayer({ createAudio, schedule, cancel, onStatus, readVolume }) {
  let generation = 0;
  const active = new Set();
  const waits = new Set();

  function dispose(audio) {
    if (!active.delete(audio)) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  function stop() {
    generation++;
    for (const wait of waits) {
      cancel(wait.timer);
      wait.resolve();
    }
    waits.clear();
    for (const audio of [...active]) dispose(audio);
    onStatus("Stopped");
  }

  function syncVolume() {
    const volume = Math.max(0, Math.min(1, readVolume()));
    for (const audio of active) audio.volume = volume;
  }

  function start(url, title, token) {
    if (token !== generation) return;
    let audio;
    try {
      audio = createAudio(url);
      active.add(audio);
      syncVolume();
      const failed = () => {
        if (token !== generation || !active.has(audio)) return;
        dispose(audio);
        onStatus(`Could not play ${title}. Check the prepared media and replay.`);
      };
      audio.onerror = failed;
      audio.onended = () => {
        if (token !== generation || !active.has(audio)) return;
        dispose(audio);
        if (!active.size) onStatus(`Finished: ${title}`);
      };
      onStatus(`Playing: ${title}`);
      Promise.resolve(audio.play()).catch(failed);
    } catch {
      if (audio) dispose(audio);
      if (token === generation) onStatus(`Could not initialize ${title}.`);
    }
  }

  function wait(ms) {
    return new Promise((resolve) => {
      const pending = { resolve, timer: null };
      pending.timer = schedule(() => {
        waits.delete(pending);
        resolve();
      }, ms);
      waits.add(pending);
    });
  }

  async function sequence(steps, repetitions = 1) {
    stop();
    const token = generation;
    if (!steps.length) {
      onStatus("This sequence has no audible cues in this mode.");
      return;
    }
    const ordered = [...steps].sort((a, b) => a.at - b.at);
    const end = Math.max(...ordered.map((step) => step.at + step.duration));
    for (let iteration = 0; iteration < repetitions; iteration++) {
      let previous = 0;
      for (const step of ordered) {
        await wait(Math.max(0, (step.at - previous) * 1000));
        if (token !== generation) return;
        start(step.url, step.title, token);
        previous = step.at;
      }
      await wait(Math.max(0, (end - previous) * 1000) + 500);
      if (token !== generation) return;
      for (const audio of [...active]) dispose(audio);
    }
    onStatus("Sequence finished");
  }

  return {
    stop,
    syncVolume,
    sequence,
    play(url, title) {
      stop();
      start(url, title, generation);
    },
  };
}
