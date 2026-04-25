import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const artTargets = [
  {
    directory: path.resolve('public/assets/card-art'),
    outputExtension: '.webp',
    webp: {
      alphaQuality: 100,
      effort: 6,
      quality: 84,
      smartSubsample: true,
    },
  },
  {
    directory: path.resolve('public/assets/templates/frames'),
    outputExtension: '.webp',
    webp: {
      alphaQuality: 100,
      effort: 6,
      quality: 90,
      smartSubsample: true,
    },
  },
  {
    directory: path.resolve('public/assets/characters'),
    outputExtension: '.webp',
    webp: {
      alphaQuality: 100,
      effort: 6,
      quality: 88,
      smartSubsample: true,
    },
  },
];

async function optimizeDirectory(target) {
  const entries = await readdir(target.directory, { withFileTypes: true });
  const pngFiles = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'));

  await mkdir(target.directory, { recursive: true });

  const results = [];

  for (const entry of pngFiles) {
    const inputPath = path.join(target.directory, entry.name);
    const outputPath = path.join(target.directory, `${path.parse(entry.name).name}${target.outputExtension}`);
    const image = sharp(inputPath, { animated: false });
    const metadata = await image.metadata();

    await image.webp(target.webp).toFile(outputPath);

    results.push({
      file: entry.name,
      height: metadata.height ?? 0,
      output: path.basename(outputPath),
      width: metadata.width ?? 0,
    });
  }

  return results;
}

async function main() {
  const summaries = [];

  for (const target of artTargets) {
    const results = await optimizeDirectory(target);
    summaries.push({ directory: target.directory, results });
  }

  for (const summary of summaries) {
    console.log(`Optimized ${summary.results.length} assets in ${path.relative(process.cwd(), summary.directory)}`);

    for (const result of summary.results) {
      console.log(`  ${result.file} -> ${result.output} (${result.width}x${result.height})`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});