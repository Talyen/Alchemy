import { mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets", "Music");
const outputDir = path.join(rootDir, "public", "Music");

async function fileIsFresh(sourcePath, outputPath) {
  try {
    const [sourceInfo, outputInfo] = await Promise.all([stat(sourcePath), stat(outputPath)]);
    return outputInfo.mtimeMs >= sourceInfo.mtimeMs;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const files = ["Menu 1.mp3", "Menu 2.mp3", "Menu 3.mp3", "Menu 4.mp3", "Battle 1.mp3", "Battle 2.mp3", "Battle 3.mp3", "Battle 4.mp3", "Battle 5.mp3"];

  const results = [];
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const outputPath = path.join(outputDir, file);

    try {
      const isFresh = await fileIsFresh(sourcePath, outputPath);
      if (isFresh) {
        results.push(`${file} already up to date`);
        continue;
      }
      await copyFile(sourcePath, outputPath);
      results.push(`${file} copied`);
    } catch (error) {
      results.push(`FAILED ${file}: ${error.message}`);
    }
  }

  console.log(`Processed ${results.length} music files.`);
  for (const result of results) {
    console.log(`- ${result}`);
  }
}

main().catch((error) => {
  console.error("Music optimization failed.");
  console.error(error);
  process.exitCode = 1;
});
