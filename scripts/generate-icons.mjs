// Generates web, desktop, and Apple platform icon assets from Raw Assets/Icons/Alchemy Icon Master.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const masterPath = path.join(root, "Raw Assets", "Icons", "Alchemy Icon Master.png");
const publicDir = path.join(root, "public");
const desktopIconsDir = path.join(root, "desktop", "icons");

if (!fs.existsSync(masterPath)) {
  throw new Error(`Master icon not found at: ${masterPath}`);
}

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(desktopIconsDir, { recursive: true });

function createIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(count, 4);

  let offset = 6 + 16 * count;
  const dirEntries = [];
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // palette colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...images.map((img) => img.buffer)]);
}

async function generate() {
  console.log("Generating icon assets from:", masterPath);

  // 1. Resized PNG buffers with sharp
  const sizes = [16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024];
  const pngBuffers = {};

  for (const size of sizes) {
    pngBuffers[size] = await sharp(masterPath)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  // 2. Web PNG favicons
  await fs.promises.writeFile(path.join(publicDir, "favicon-16x16.png"), pngBuffers[16]);
  await fs.promises.writeFile(path.join(publicDir, "favicon-32x32.png"), pngBuffers[32]);
  await fs.promises.writeFile(path.join(publicDir, "favicon-48x48.png"), pngBuffers[48]);
  console.log("Wrote public/favicon-{16x16,32x32,48x48}.png");

  // 3. Web favicon.ico (16, 32, 48)
  const webIco = createIco([
    { width: 16, height: 16, buffer: pngBuffers[16] },
    { width: 32, height: 32, buffer: pngBuffers[32] },
    { width: 48, height: 48, buffer: pngBuffers[48] },
  ]);
  await fs.promises.writeFile(path.join(publicDir, "favicon.ico"), webIco);
  console.log("Wrote public/favicon.ico");

  // 4. Apple Touch Icon (180x180 on theme background #120d0a with subtle safe padding)
  const appleInnerSize = 152;
  const applePaddedEmblem = await sharp(masterPath)
    .resize(appleInnerSize, appleInnerSize, { fit: "contain" })
    .png()
    .toBuffer();
  const appleTouchIcon = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 18, g: 13, b: 10, alpha: 1 }, // #120d0a
    },
  })
    .composite([{ input: applePaddedEmblem, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.promises.writeFile(path.join(publicDir, "apple-touch-icon.png"), appleTouchIcon);
  console.log("Wrote public/apple-touch-icon.png");

  // 5. Web App Manifest Icons (192 & 512 transparent + maskable)
  await fs.promises.writeFile(path.join(publicDir, "icon-192.png"), pngBuffers[192]);
  await fs.promises.writeFile(path.join(publicDir, "icon-512.png"), pngBuffers[512]);

  // Maskable icons (80% safe zone on theme background #120d0a)
  for (const size of [192, 512]) {
    const innerSize = Math.round(size * 0.8);
    const innerBuffer = await sharp(masterPath).resize(innerSize, innerSize, { fit: "contain" }).png().toBuffer();
    const maskableBuffer = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 18, g: 13, b: 10, alpha: 1 },
      },
    })
      .composite([{ input: innerBuffer, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toBuffer();
    await fs.promises.writeFile(path.join(publicDir, `icon-maskable-${size}.png`), maskableBuffer);
  }
  console.log("Wrote public/icon-{192,512}.png and icon-maskable-{192,512}.png");

  // 6. Remove legacy favicon.svg if present
  if (fs.existsSync(path.join(publicDir, "favicon.svg"))) {
    fs.unlinkSync(path.join(publicDir, "favicon.svg"));
  }

  // 7. Web Manifest (site.webmanifest)
  const manifest = {
    name: "Alchemy",
    short_name: "Alchemy",
    description: "Alchemy is a fantasy roguelite deckbuilder game.",
    start_url: "/",
    display: "fullscreen",
    background_color: "#120d0a",
    theme_color: "#120d0a",
    icons: [
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
  await fs.promises.writeFile(
    path.join(publicDir, "site.webmanifest"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log("Wrote public/site.webmanifest");

  // 8. Desktop App Icons (desktop/icons/)
  const desktopIco = createIco([
    { width: 16, height: 16, buffer: pngBuffers[16] },
    { width: 24, height: 24, buffer: pngBuffers[24] },
    { width: 32, height: 32, buffer: pngBuffers[32] },
    { width: 48, height: 48, buffer: pngBuffers[48] },
    { width: 64, height: 64, buffer: pngBuffers[64] },
    { width: 128, height: 128, buffer: pngBuffers[128] },
    { width: 256, height: 256, buffer: pngBuffers[256] },
  ]);
  await fs.promises.writeFile(path.join(desktopIconsDir, "icon.ico"), desktopIco);
  await fs.promises.writeFile(path.join(desktopIconsDir, "icon.png"), pngBuffers[512]);
  await fs.promises.writeFile(path.join(desktopIconsDir, "icon-1024.png"), pngBuffers[1024]);
  console.log("Wrote desktop/icons/icon.ico, desktop/icons/icon.png, desktop/icons/icon-1024.png");

  console.log("All icons generated successfully!");
}

generate().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
