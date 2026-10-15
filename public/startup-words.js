(() => {
  try {
    const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const disableAnimations = document.documentElement.classList.contains("alchemy-disable-animations");
    if (prefersReduced || disableAnimations) return;

    const words = [
      "Adventure awaits",
      "Polishing trinkets",
      "Shuffling decks",
      "Waking monsters",
      "Brewing potions",
      "Gathering crystals",
      "Sharpening blades",
      "Mapping labyrinth",
      "Attuning relics",
      "Consulting oracle",
      "Enchanting baubles",
      "Counting loot",
      "Training companions",
      "Building homestead",
      "Restocking shops",
    ];
    const phrase = document.getElementById("startup-splash-phrase");
    if (!phrase) return;
    let index = 0;
    window.__alchemySplashWordTimer = window.setInterval(() => {
      index = (index + 1) % words.length;
      phrase.textContent = words[index] + "...";
      phrase.style.animation = "none";
      void phrase.offsetHeight;
      phrase.style.animation = "";
    }, 750);
  } catch {}
})();
