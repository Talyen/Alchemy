import fs from "node:fs";
import path from "node:path";
import type { Page, Response } from "@playwright/test";

const TRANSPARENT_GIF_PREFIX = "data:image/gif";
const MIN_PAINT_PX = 40;

export interface BattleArtImageDump {
  role: string;
  srcTail: string;
  isGifOrEmpty: boolean;
  naturalWidth: number;
  naturalHeight: number;
  clientWidth: number;
  clientHeight: number;
  opacity: string;
  testId: string | null;
}

export interface BattleArtDiagnostics {
  timestamp: string;
  layout: {
    vrStageTransform: string | null;
    vrStageSize: { width: number; height: number } | null;
    battleSceneSize: { width: number; height: number } | null;
  };
  images: BattleArtImageDump[];
  failedAssetRequests: Array<{ url: string; status: number }>;
  failures: string[];
}

/** Track failed image asset responses for the duration of setup. */
export function trackFailedAssetRequests(page: Page): {
  failures: Array<{ url: string; status: number }>;
  dispose: () => void;
} {
  const failures: Array<{ url: string; status: number }> = [];
  const onResponse = (response: Response) => {
    const url = response.url();
    if (!/\.(webp|png|jpe?g|gif|svg)(\?|$)/i.test(url)) return;
    if (response.status() >= 400) {
      failures.push({ url, status: response.status() });
    }
  };
  page.on("response", onResponse);
  return {
    failures,
    dispose: () => page.off("response", onResponse),
  };
}

export async function collectBattleArtDiagnostics(
  page: Page,
  failedAssetRequests: Array<{ url: string; status: number }> = [],
): Promise<BattleArtDiagnostics> {
  const payload = await page.evaluate((minPaint) => {
    function dump(
      role: string,
      img: HTMLImageElement | null,
    ): {
      role: string;
      srcTail: string;
      isGifOrEmpty: boolean;
      naturalWidth: number;
      naturalHeight: number;
      clientWidth: number;
      clientHeight: number;
      opacity: string;
      testId: string | null;
    } | null {
      if (!img) return null;
      const src = img.currentSrc || img.src || "";
      const rect = img.getBoundingClientRect();
      return {
        role,
        srcTail: src.slice(-80),
        isGifOrEmpty: !src || src.startsWith("data:image/gif"),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        clientWidth: Math.round(rect.width),
        clientHeight: Math.round(rect.height),
        opacity: getComputedStyle(img).opacity,
        testId: img.closest("[data-testid]")?.getAttribute("data-testid") ?? null,
      };
    }

    const player = document.querySelector<HTMLImageElement>('[data-testid="battle-player-art-panel"] img');
    const enemy = document.querySelector<HTMLImageElement>('[data-testid="battle-enemy-art-panel"] img');
    const handImgs = Array.from(document.querySelectorAll<HTMLImageElement>('[aria-label^="Play "] img')).slice(0, 5);

    const images = [
      dump("player", player),
      dump("enemy", enemy),
      ...handImgs.map((img, i) => dump(`hand-${i}`, img)),
    ].filter(Boolean);

    const playerPanel = document.querySelector<HTMLElement>('[data-testid="battle-player-art-panel"]');
    const chain: Array<{
      tag: string;
      testId: string | null;
      className: string;
      cw: number;
      ch: number;
      width: string;
      cqh: string;
    }> = [];
    let el: HTMLElement | null = playerPanel;
    while (el && chain.length < 12) {
      const cs = getComputedStyle(el);
      chain.push({
        tag: el.tagName.toLowerCase(),
        testId: el.getAttribute("data-testid"),
        className: (el.className || "").toString().slice(0, 80),
        cw: el.clientWidth,
        ch: el.clientHeight,
        width: cs.width,
        cqh: cs.getPropertyValue("width"),
      });
      el = el.parentElement;
    }

    const vr = document.querySelector<HTMLElement>('[data-testid="vr-stage"]');
    const scene = document.querySelector<HTMLElement>('[data-testid="battle-scene"]');
    let cqInfo: Record<string, string | number | null> = {};
    if (scene) {
      const cs = getComputedStyle(scene);
      cqInfo = {
        containerType: cs.containerType,
        width: cs.width,
        height: cs.height,
        clientWidth: scene.clientWidth,
        clientHeight: scene.clientHeight,
      };
    }

    const failures: string[] = [];
    for (const img of images) {
      if (!img) continue;
      if (img.isGifOrEmpty) failures.push(`${img.role}: empty or transparent GIF src (${img.srcTail})`);
      if (img.naturalWidth <= 0) failures.push(`${img.role}: naturalWidth=0`);
      if (img.clientWidth < minPaint || img.clientHeight < minPaint) {
        failures.push(`${img.role}: painted size ${img.clientWidth}×${img.clientHeight} < ${minPaint}px`);
      }
    }
    if (!player || !enemy) failures.push("missing player or enemy art panel img");
    if (handImgs.length === 0) failures.push("no hand card images");
    if (scene && scene.clientHeight < minPaint) {
      failures.push(`battle-scene height ${scene.clientHeight}px too small`);
    }

    return {
      layout: {
        vrStageTransform: vr ? getComputedStyle(vr).transform : null,
        vrStageSize: vr ? { width: vr.clientWidth, height: vr.clientHeight } : null,
        battleSceneSize: scene ? { width: scene.clientWidth, height: scene.clientHeight } : null,
        battleSceneContainer: cqInfo,
        playerPanelAncestorChain: chain,
      },
      images,
      failures,
    };
  }, MIN_PAINT_PX);

  const failedAssets = [...failedAssetRequests];
  const failures = [...payload.failures];
  for (const asset of failedAssets) {
    failures.push(`asset HTTP ${asset.status}: ${asset.url}`);
  }

  return {
    timestamp: new Date().toISOString(),
    layout: payload.layout,
    images: payload.images as BattleArtImageDump[],
    failedAssetRequests: failedAssets,
    failures,
  };
}

export async function writeBattleArtDiagnostics(
  page: Page,
  options: {
    outDir?: string;
    failedAssetRequests?: Array<{ url: string; status: number }>;
  } = {},
): Promise<{ dir: string; diagnostics: BattleArtDiagnostics; ok: boolean }> {
  const dir = options.outDir ?? path.join(process.cwd(), "test-results", "perf-battle-art");
  fs.mkdirSync(dir, { recursive: true });
  const diagnostics = await collectBattleArtDiagnostics(page, options.failedAssetRequests ?? []);
  fs.writeFileSync(path.join(dir, "diagnostics.json"), JSON.stringify(diagnostics, null, 2));
  await page.screenshot({ path: path.join(dir, "perf-battle-art.png"), fullPage: true });
  return { dir, diagnostics, ok: diagnostics.failures.length === 0 };
}

export function formatArtDiagnosticFailure(diagnostics: BattleArtDiagnostics, dir: string): string {
  return [
    "Battle art diagnostic failed:",
    ...diagnostics.failures.map((f) => `  - ${f}`),
    `Dump: ${path.join(dir, "diagnostics.json")}`,
    `Screenshot: ${path.join(dir, "perf-battle-art.png")}`,
  ].join("\n");
}

export { TRANSPARENT_GIF_PREFIX, MIN_PAINT_PX };
