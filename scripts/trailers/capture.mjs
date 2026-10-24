import fs from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { nativeMusicOffsets } from "./model.mjs";
import { installCaptureRuntime, sampleVisualTime } from "./browser-runtime.mjs";
import { hashFile, hashValue, probe, startEncoder, writeJson } from "./media.mjs";

function locatorFor(page, target) {
  const locator = target.role
    ? page.getByRole(target.role, { name: target.name, exact: true })
    : target.testId
      ? page.getByTestId(target.testId)
      : page.locator(target.selector);
  return locator.nth(target.index);
}

async function prepareAction(page, action) {
  if (action.kind === "move-away") return { point: { x: 20, y: 80 }, kind: action.kind };
  let locator;
  if (action.kind === "play-card" && !action.target) {
    const cards = page.locator("[aria-label^='Play ']");
    // Prefer the card the player just inspected, then another playable card.
    const candidates = await cards.all();
    const hovered = [];
    const remaining = [];
    for (const card of candidates) {
      if (await card.evaluate((element) => element.closest("[data-hand-slot]")?.hasAttribute("data-hovered")))
        hovered.push(card);
      else remaining.push(card);
    }
    for (const card of [...hovered, ...remaining])
      if (
        (await card.isEnabled()) &&
        (await card.isVisible()) &&
        (await card.evaluate((element) => !element.classList.contains("hand-card-unplayable")))
      ) {
        locator = card;
        break;
      }
    if (!locator) throw new Error("No playable card at the directed moment; adjust the shot's inputs");
  } else locator = locatorFor(page, action.target);
  if (!(await locator.isVisible()) || (action.kind !== "hover" && !(await locator.isEnabled())))
    throw new Error(`Unavailable action target: ${JSON.stringify(action)}`);
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error("Action target has no bounds");
  const label = (await locator.getAttribute("aria-label")) ?? (await locator.textContent());
  const hand = await locator.evaluate((element) => {
    const slot = element.closest("[data-hand-slot]");
    if (!slot) return null;
    const bounds = slot.getBoundingClientRect();
    return {
      key: slot.getAttribute("data-hand-slot"),
      x: bounds.x + bounds.width / 2,
      y: Math.min(globalThis.innerHeight - 20, bounds.bottom - 20),
    };
  });
  const point = hand ? { x: hand.x, y: hand.y } : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  if (
    !(await locator.evaluate(
      (element, { point, hand }) => {
        const hit = globalThis.document.elementFromPoint(point.x, point.y);
        return (
          hit &&
          !hit.closest("[inert]") &&
          (hand ? Boolean(hit.closest("[data-hand-slot]")) : element === hit || element.contains(hit))
        );
      },
      { point, hand },
    ))
  )
    throw new Error(`Action target is covered: ${label}`);
  if (action.kind === "play-card" && !hand?.key) throw new Error("Play-card target is not in the hand");
  return {
    kind: action.kind,
    label,
    bounds,
    point,
    ...(hand?.key ? { inspectedCardKey: hand.key } : {}),
    ...(action.kind === "play-card" ? { cardKey: hand.key } : {}),
  };
}

async function performAction(page, prepared) {
  if (prepared.kind === "hover" || prepared.kind === "move-away") return;
  await page.mouse.click(prepared.point.x, prepared.point.y);
}

async function captureClip({ browser, scenarios, clip, settings, origin, out, root, draft, music }) {
  const output = path.join(out, `${clip.id}.mp4`);
  const receiptFile = path.join(out, `${clip.id}.json`);
  // A partial capture is diagnostic evidence, never a reusable successful clip.
  if (fs.existsSync(output) || fs.existsSync(receiptFile))
    throw new Error(`Capture already exists: ${clip.id}. Choose a fresh bundle or use render.`);
  const checkpoint = clip.checkpoint
    ? JSON.parse(fs.readFileSync(path.resolve(root, clip.checkpoint), "utf8"))
    : undefined;
  const context = await browser.newContext({
    baseURL: origin,
    viewport: settings.viewport,
    deviceScaleFactor: draft ? 1 : settings.scale,
    reducedMotion: "no-preference",
    locale: "en-US",
  });
  let encoder;
  let page;
  const errors = [];
  const browserLog = [];
  try {
    page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      browserLog.push(message.text());
      if (browserLog.length > 40) browserLog.shift();
    });
    await page.addInitScript(installCaptureRuntime);
    await page.clock.install({ time: new Date("2026-01-01T00:00:00.000Z") });
    await scenarios.openTrailerScene(page, { ...clip, lyrics: music !== null }, checkpoint);
    // Leave room for protocol travel while the staging clock is still running.
    // A one-millisecond margin can already be in the past on the next command.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.context().storageState({ path: path.join(out, `${clip.id}.storage.json`) });
    const startState = await page
      .locator("[data-testid='player-health'],[data-testid='enemy-health'],[data-testid='mana-panel']")
      .allTextContents();
    await page.addStyleTag({ content: "*, *::before, *::after { cursor: none !important; }" });
    await page.mouse.move(20, 80);
    const videoFrameRates = {};
    const videoDirectory = path.join(root, "src/assets/boss-idles");
    for (const file of fs
      .readdirSync(videoDirectory)
      .filter((file) => clip.boss && file.startsWith(`${clip.boss}-idle-`) && file.endsWith(".mp4"))) {
      const video = probe(path.join(videoDirectory, file)).streams.find((stream) => stream.codec_type === "video");
      if (video?.r_frame_rate === video?.avg_frame_rate) {
        const [numerator, denominator] = video.r_frame_rate.split("/").map(Number);
        if (numerator > 0 && denominator > 0)
          videoFrameRates[`/src/assets/boss-idles/${file}`] = numerator / denominator;
      }
    }
    await page.evaluate(
      ({ music, videoFrameRates }) => {
        globalThis.__trailerCapture.start = globalThis.performance.now();
        globalThis.__trailerCapture.music = music;
        globalThis.__trailerCapture.videoFrameRates = videoFrameRates;
      },
      { music, videoFrameRates },
    );
    await page.evaluate(sampleVisualTime, 0);
    const width = settings.viewport.width * (draft ? 1 : settings.scale);
    const height = settings.viewport.height * (draft ? 1 : settings.scale);
    encoder = startEncoder(output, { width, height, fps: settings.fps });
    const actions = [...clip.actions].sort((a, b) => a.at - b.at);
    const performed = [];
    const frameCount = Math.round(clip.duration * settings.fps);
    let priorTime = 0;
    let actionIndex = 0;
    const sampled = [];
    const costs = { clock: 0, input: 0, visuals: 0, screenshot: 0, encode: 0 };
    const presentation = [];
    let pointer = { x: 20, y: 80 };
    let pending = null;
    for (let frame = 0; frame < frameCount; frame++) {
      let phaseStart = performance.now();
      const mark = (phase) => {
        const now = performance.now();
        costs[phase] += now - phaseStart;
        phaseStart = now;
      };
      const time = Math.round((frame * 1000) / settings.fps);
      if (time > priorTime) await page.clock.runFor(time - priorTime);
      priorTime = time;
      mark("clock");
      const seconds = frame / settings.fps;
      const next = actions[actionIndex];
      if (!pending && next && seconds >= Math.max(0, next.at - next.moveDuration))
        pending = {
          input: await prepareAction(page, next),
          from: { ...pointer },
          start: seconds,
          end: next.at,
          moveFrames: 0,
        };
      if (pending) {
        const progress =
          seconds >= pending.end ? 1 : Math.max(0, (seconds - pending.start) / (pending.end - pending.start));
        const eased = progress * progress * (3 - 2 * progress);
        pointer = {
          x: pending.from.x + (pending.input.point.x - pending.from.x) * eased,
          y: pending.from.y + (pending.input.point.y - pending.from.y) * eased,
        };
        await page.mouse.move(pointer.x, pointer.y);
        pending.moveFrames++;
        if (seconds >= pending.end) {
          await performAction(page, pending.input);
          performed.push({
            at: seconds,
            movementFrom: pending.start,
            moveFrames: pending.moveFrames,
            ...pending.input,
          });
          pending = null;
          actionIndex++;
        }
      }
      mark("input");
      await page.evaluate(sampleVisualTime, time);
      for (const input of performed.filter((input) => input.cardKey && input.acceptedAt === undefined)) {
        const stillInHand = await page.evaluate(
          (key) =>
            [...globalThis.document.querySelectorAll("[data-hand-slot]")].some(
              (slot) => slot.getAttribute("data-hand-slot") === key && !slot.hasAttribute("data-hand-hidden"),
            ),
          input.cardKey,
        );
        if (!stillInHand) input.acceptedAt = frame / settings.fps;
        else if (frame / settings.fps - input.at > 0.75) throw new Error(`Card input was not accepted: ${input.label}`);
      }
      mark("visuals");
      // The general screenshot API waits for stable frames and encodes compact
      // PNGs. Direct capture preserves the sampled frame and uses fast lossless
      // compression; image quality and timing are unchanged.
      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
        optimizeForSpeed: true,
      });
      const png = Buffer.from(data, "base64");
      mark("screenshot");
      await encoder.frame(png);
      mark("encode");
      if (frame === 0 || frame === Math.floor(frameCount / 2) || frame === frameCount - 1) {
        const name = `${clip.id}-${frame}.png`;
        fs.writeFileSync(path.join(out, name), png);
        sampled.push({ frame, sha256: hashFile(path.join(out, name)), file: name });
      }
      if (frame % settings.fps === 0) {
        presentation.push(
          await page.evaluate(
            (at) => ({
              at,
              battle: Boolean(globalThis.document.querySelector("[data-testid='battle-scene']")),
              lyrics: globalThis.document.querySelector("[data-testid='boss-lyrics']")?.textContent ?? null,
              lyricBounds: (() => {
                const rect = globalThis.document.querySelector("[data-testid='boss-lyrics']")?.getBoundingClientRect();
                return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
              })(),
              videos: [...globalThis.document.querySelectorAll("video")].map((video) => ({
                src: new URL(video.src).pathname,
                time: video.currentTime,
                playing: globalThis.__trailerCapture.videos.get(video)?.playing ?? false,
              })),
            }),
            frame / settings.fps,
          ),
        );
        console.log(
          `Capture ${clip.id}: ${frame / settings.fps}/${clip.duration}s (${width}×${height}, ${settings.fps} fps)`,
        );
      }
      if (errors.length) throw new Error(`Renderer error: ${errors.join("; ")}`);
    }
    if (actionIndex !== actions.length) throw new Error("Not all directed actions were executed");
    if (performed.some((input) => input.cardKey && input.acceptedAt === undefined))
      throw new Error("Clip ended before the last card play was accepted");
    await encoder.finish();
    encoder = null;
    const sounds = await page.evaluate(
      (duration) => globalThis.__trailerCapture.sounds.map((sound) => ({ ...sound, end: sound.end ?? duration })),
      clip.duration,
    );
    if (sounds.some((sound) => sound.at < 0 || sound.at >= clip.duration || sound.end < sound.at))
      throw new Error("Sound cue clock diverged from the captured frame timeline");
    if (clip.actions.some((action) => action.kind === "play-card") && !sounds.length)
      throw new Error("No sound cues observed for directed card plays");
    const metadata = probe(output);
    const video = metadata.streams.find((stream) => stream.codec_type === "video");
    if (
      Number(video?.nb_read_frames) !== frameCount ||
      video.width !== width ||
      video.height !== height ||
      video.r_frame_rate !== `${settings.fps}/1`
    )
      throw new Error("Capture frame count, dimensions, or frame rate mismatch");
    if (clip.scene === "boss" && presentation.some((sample) => !sample.battle))
      throw new Error("Directed battle left the battle screen during capture");
    if (music?.expectLyrics && !presentation.some((sample) => sample.lyrics?.trim()))
      throw new Error("Native battle lyrics were not observed; check the selected soundtrack interval");
    const endState = await page
      .locator("[data-testid='player-health'],[data-testid='enemy-health'],[data-testid='mana-panel']")
      .allTextContents();
    const receipt = {
      version: 1,
      id: clip.id,
      recipeHash: hashValue(clip),
      checkpointHash: checkpoint ? hashValue(checkpoint) : null,
      file: path.basename(output),
      sha256: hashFile(output),
      settings: { width, height, fps: settings.fps },
      frameCount,
      elapsedPhaseMs: costs,
      method: "offline-js-css-video-sampling",
      startState,
      endState,
      actions: performed,
      nativeMusic: music,
      presentation,
      sounds,
      sampled,
      metadata,
    };
    writeJson(receiptFile, receipt);
    return receipt;
  } catch (error) {
    if (encoder) await encoder.abort();
    if (page) await page.screenshot({ path: path.join(out, `${clip.id}.failure.png`), timeout: 5000 }).catch(() => {});
    writeJson(path.join(out, `${clip.id}.failure.json`), {
      error: error.stack ?? String(error),
      url: page?.url(),
      rendererErrors: errors,
      browserLog,
    });
    throw error;
  } finally {
    await context.close();
  }
}

export async function captureRecipe({ root, recipe, out, draft = false, source }) {
  fs.mkdirSync(path.join(out, "clips"), { recursive: true });
  const dependencies = Object.keys(
    JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).dependencies,
  ).filter((name) => !["@sentry/electron", "steamworks.js"].includes(name));
  const server = await createServer({
    root,
    cacheDir: path.join(root, "scratch/trailer-vite-cache"),
    // A recording is pinned to its starting source. File changes and lazy
    // dependency optimization must not hot-reload an in-progress encounter.
    server: { host: "127.0.0.1", port: 0, strictPort: true, open: false, hmr: false, watch: null },
    optimizeDeps: {
      noDiscovery: true,
      include: [...dependencies, "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "motion/react"],
    },
    logLevel: "warn",
  });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer.address();
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({
      channel: "chromium",
      headless: true,
      args: ["--autoplay-policy=no-user-gesture-required"],
    });
    const scenarios = await server.ssrLoadModule("/tests/trailers/scenarios.ts");
    const assets = scenarios.trailerAssets(recipe.music.boss);
    const musicSource = path.resolve(root, assets.music);
    const lyricsSource = path.resolve(root, `src/lib/audio/lyrics/${recipe.music.boss}.json`);
    const lyrics = JSON.parse(fs.readFileSync(lyricsSource, "utf8"));
    if (lyrics.audioSha256 !== hashFile(musicSource))
      throw new Error("Lyric snapshot does not match soundtrack recording");
    fs.mkdirSync(path.join(out, "assets"), { recursive: true });
    fs.copyFileSync(musicSource, path.join(out, "assets/music.mp3"));
    fs.copyFileSync(path.resolve(root, `.${assets.logo}`), path.join(out, "assets/logo.webp"));
    fs.copyFileSync(path.join(root, "public/fonts/Inter.woff2"), path.join(out, "assets/Inter.woff2"));
    writeJson(path.join(out, "assets/lyrics.json"), lyrics);
    const offsets = nativeMusicOffsets(recipe);
    const clips = {};
    for (const clip of recipe.clips)
      clips[clip.id] = await captureClip({
        browser,
        scenarios,
        clip,
        settings: recipe.capture,
        origin,
        out: path.join(out, "clips"),
        root,
        draft,
        music:
          offsets[clip.id] === undefined
            ? null
            : {
                offset: offsets[clip.id],
                expectLyrics: lyrics.lines.some(
                  (line) =>
                    line.timings[0] < offsets[clip.id] + clip.duration && line.timings.at(-1) > offsets[clip.id],
                ),
                src: new URL(assets.music.replace(/^public/u, ""), origin).pathname,
              },
      });
    for (const clip of Object.values(clips)) {
      for (const sound of clip.sounds) {
        const relative = decodeURIComponent(sound.src).replace(/^\//u, "");
        const src = path.resolve(root, "public", relative);
        if (!src.startsWith(path.resolve(root, "public/sounds") + path.sep))
          throw new Error(`Invalid SFX path ${sound.src}`);
        const dest = path.join(out, "assets/sfx", path.basename(src));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        sound.file = path.relative(out, dest);
      }
      writeJson(path.join(out, "clips", `${clip.id}.json`), clip);
    }
    const bundle = {
      version: 1,
      recipe,
      draft,
      source,
      browserVersion: browser.version(),
      clips,
      music: { file: "assets/music.mp3", sha256: hashFile(musicSource), duration: lyrics.audioDuration },
      lyrics,
      assets: { logo: "assets/logo.webp", font: "assets/Inter.woff2" },
    };
    writeJson(path.join(out, "capture.json"), bundle);
    return bundle;
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}
