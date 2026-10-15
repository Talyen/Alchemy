import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import languages from "../../src/lib/localization/locales/languages.json" with { type: "json" };
import packed from "../../src/lib/localization/locales/runtime.json" with { type: "json" };
import { unpackCatalogs } from "../../src/lib/localization/catalog-format.mjs";
import { FONTTOOLS_VERSION, FONT_REQUIREMENTS, requiredFontText, missingGlyphs } from "./font.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--source-dir"))
  throw new Error("Usage: npm run i18n:fonts -- [--source-dir <original-font-directory>]");
const python = process.env.ALCHEMY_FONT_PYTHON ?? "python3";
const version = execFileSync(python, ["-c", "import fontTools; print(fontTools.__version__)"], {
  encoding: "utf8",
}).trim();
if (version !== FONTTOOLS_VERSION) throw new Error(`Font regeneration requires fonttools==${FONTTOOLS_VERSION}`);
const cache = args[1] ? path.resolve(args[1]) : path.join(root, "reports/localization-font-sources");
fs.mkdirSync(cache, { recursive: true });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-fonts-"));
try {
  const catalogs = unpackCatalogs(packed);
  const generated = [];
  for (const requirement of FONT_REQUIREMENTS) {
    const source = path.join(cache, requirement.file);
    if (!fs.existsSync(source) && !args[1]) {
      const response = await fetch(requirement.url);
      if (!response.ok) throw new Error(`Font source download failed: ${response.status}`);
      fs.writeFileSync(source, Buffer.from(await response.arrayBuffer()));
    }
    const bytes = fs.readFileSync(source);
    if (createHash("sha256").update(bytes).digest("hex") !== requirement.sha256)
      throw new Error(`Font source digest differs: ${source}`);
    const text = requiredFontText(catalogs, languages, requirement);
    const absent = missingGlyphs(bytes, text, requirement.pattern);
    if (absent.length) throw new Error(`Upstream ${requirement.file} lacks: ${absent.join("")}`);
    // Retain Latin, punctuation, symbols and every catalog/native-name script glyph.
    // Variable axes, hinting and all layout features remain available at every UI size.
    const unicodes = [
      "U+0000-024F",
      "U+2000-206F",
      "U+20A0-20CF",
      "U+2190-21FF",
      ...[...text].map((character) => "U+" + character.codePointAt(0).toString(16)),
    ].join(",");
    const output = path.join(temporary, requirement.file);
    execFileSync(
      python,
      [
        "-m",
        "fontTools.subset",
        source,
        `--output-file=${output}`,
        `--unicodes=${unicodes}`,
        "--layout-features=*",
        "--name-IDs=*",
        "--name-languages=*",
        "--notdef-outline",
        "--no-recalc-timestamp",
        "--canonical-order",
      ],
      { stdio: "inherit" },
    );
    const subset = fs.readFileSync(output);
    if (missingGlyphs(subset, text, requirement.pattern).length)
      throw new Error(`Subset lost glyphs: ${requirement.file}`);
    generated.push({ file: requirement.file, subset, originalSize: bytes.length });
  }
  // All source and glyph validation succeeds before replacing either bundled font.
  for (const { file, subset, originalSize } of generated) {
    fs.writeFileSync(path.join(root, "public/fonts", file), subset);
    console.log(`${file}: ${originalSize.toLocaleString("en")} → ${subset.length.toLocaleString("en")} bytes`);
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
