import fs from "node:fs";
import path from "node:path";
import babel from "@babel/core";
import { withReportServer } from "../lib/vite-report-server.mjs";
import { ordered, digest, tags, relatedTerms } from "./catalog.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function walk(node, callback, parent) {
  if (!node || typeof node !== "object" || callback(node, parent) === false) return;
  for (const key of babel.types.VISITOR_KEYS[node.type] ?? []) {
    const children = node[key];
    if (Array.isArray(children)) children.forEach((child) => walk(child, callback, node));
    else walk(children, callback, node);
  }
}
function parse(code, filename) {
  return babel.parseSync(code, {
    filename,
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
  });
}
const sourceFiles = () =>
  fs
    .readdirSync(path.join(ROOT, "src"), { recursive: true })
    .filter((file) => /\.[jt]sx?$/.test(file) && !file.startsWith("lib/localization/"))
    .sort();
const isTextAttribute = (name) =>
  ["title", "aria-label", "ariaLabel", "label", "description", "alt", "placeholder"].includes(name) ||
  /(?:Label|Text|Message|Reason)$/.test(name);
function hasVisibleLiteral(node) {
  if (!node) return false;
  if (node.type === "StringLiteral") return /[a-zA-Z]{2}/.test(node.value);
  if (node.type === "TemplateLiteral") return node.quasis.some((part) => /[a-zA-Z]{2}/.test(part.value.cooked));
  if (node.type === "ConditionalExpression")
    return hasVisibleLiteral(node.consequent) || hasVisibleLiteral(node.alternate);
  if (node.type === "LogicalExpression") return hasVisibleLiteral(node.right);
  if (node.type === "ArrayExpression") return node.elements.some(hasVisibleLiteral);
  return false;
}
const textProperties = new Set([
  "title",
  "label",
  "description",
  "displayName",
  "name",
  "subtitle",
  "headerTitle",
  "flavorText",
  "requirement",
  "descriptionLines",
  "lockedReason",
  "emptyMessage",
  "message",
  "narrative",
  "summary",
  "body",
  "helpText",
  "tooltip",
  "tooltipEffect",
  "text",
  "benefitDescription",
  "nonCombatBenefitDescription",
]);
export async function extractMessages() {
  const messages = {};
  const issues = [];
  function add(id, text, context) {
    if (!/[a-zA-Z]{2}/.test(text) || /\.(?:webp|png|jpg|mp3|wav)$|^[\w/-]+\/$/.test(text)) return;
    if (messages[id] && messages[id].text !== text) throw new Error(`Conflicting English message: ${id}`);
    messages[id] = { text, context };
  }
  for (const file of sourceFiles()) {
    if (
      file.startsWith("lib/balance/") ||
      file.startsWith("lib/validation/") ||
      file.includes("/effects/") ||
      file.includes("balance-report") ||
      file.startsWith("app/playthrough/") ||
      file === "lib/battle/battle-setup-defaults.ts"
    )
      continue;
    const code = fs.readFileSync(path.join(ROOT, "src", file), "utf8");
    const ast = parse(code, file);
    const globalReaders = new Set(
      ast.program.body
        .filter((node) => node.type === "ImportDeclaration" && /localization\/runtime$/.test(node.source.value))
        .flatMap((node) =>
          node.specifiers
            .filter((specifier) => ["text", "displayText"].includes(specifier.imported?.name))
            .map((specifier) => specifier.local.name),
        ),
    );
    if (globalReaders.size)
      babel.traverse(ast, {
        CallExpression(call) {
          if (call.node.callee.type !== "Identifier" || !globalReaders.has(call.node.callee.name)) return;
          for (let fn = call.getFunctionParent(); fn; fn = fn.getFunctionParent()) {
            const name =
              fn.node.id?.name ??
              (fn.parentPath.isVariableDeclarator()
                ? fn.parentPath.node.id.name
                : fn.parentPath.isCallExpression() && fn.parentPath.parentPath.isVariableDeclarator()
                  ? fn.parentPath.parentPath.node.id.name
                  : undefined);
            if (
              name &&
              ((/^[A-Z]/.test(name) && file.endsWith(".tsx")) || /^use[A-Z]/.test(name)) &&
              call.node.start >= fn.node.body.start
            ) {
              issues.push(
                `${file}:${call.node.loc.start.line}: use the bound useGameTranslation() reader inside React`,
              );
              break;
            }
          }
        },
      });
    walk(ast, (node, parent) => {
      if (
        node.type === "CallExpression" &&
        ["text", "gameText"].includes(
          node.callee.name ?? (node.callee.type === "MemberExpression" ? node.callee.property.name : undefined),
        ) &&
        node.arguments[0]?.type === "StringLiteral" &&
        node.arguments[1]?.type === "StringLiteral"
      ) {
        const id = node.arguments[0].value;
        add(id, node.arguments[1].value, file);
        if (messages[id] && node.arguments[2]?.type === "ObjectExpression")
          messages[id].parameters = Object.fromEntries(
            node.arguments[2].properties
              .filter((property) => property.type === "ObjectProperty")
              .map((property) => [
                property.key.name ?? property.key.value,
                code.slice(property.value.start, property.value.end),
              ]),
          );
        return false;
      }
      if (node.type === "JSXOpeningElement" && node.name.name === "GameMessage") {
        const attribute = (key) =>
          node.attributes.find((attribute) => attribute.type === "JSXAttribute" && attribute.name.name === key)?.value;
        const id = attribute("id");
        const value = attribute("defaultValue");
        if (id?.type === "StringLiteral" && value?.type === "StringLiteral") {
          add(id.value, value.value, file);
          const parts = attribute("parts");
          if (parts?.type !== "JSXExpressionContainer" || parts.expression.type !== "ObjectExpression")
            issues.push(`${file}:${node.loc.start.line}: GameMessage needs explicit named parts`);
          else {
            const slots = Object.fromEntries(
              parts.expression.properties
                .filter((property) => property.type === "ObjectProperty")
                .map((property) => [
                  property.key.name ?? property.key.value,
                  code.slice(property.value.start, property.value.end),
                ]),
            );
            messages[id.value].slots = slots;
            if (JSON.stringify([...new Set(tags(value.value))].sort()) !== JSON.stringify(Object.keys(slots).sort()))
              issues.push(`${file}:${node.loc.start.line}: message tags and part bindings differ`);
          }
        }
      }
      if (
        node.type === "JSXExpressionContainer" &&
        (parent?.type !== "JSXAttribute" || isTextAttribute(parent.name.name)) &&
        hasVisibleLiteral(node.expression)
      )
        issues.push(`${file}:${node.loc.start.line}: wrap visible literals in text() or GameMessage`);
      if (node.type === "JSXText" && /[a-zA-Z]{2}/.test(node.value))
        issues.push(`${file}:${node.loc.start.line}: hardcoded JSX text`);
      if (
        node.type === "JSXAttribute" &&
        isTextAttribute(node.name.name) &&
        node.value?.type === "StringLiteral" &&
        /[a-zA-Z]{2}/.test(node.value.value)
      )
        issues.push(`${file}:${node.loc.start.line}: hardcoded ${node.name.name}`);
      if (node.type === "ObjectProperty" && !node.computed && textProperties.has(node.key.name ?? node.key.value)) {
        const values = node.value.type === "ArrayExpression" ? node.value.elements : [node.value];
        for (const value of values)
          if (value?.type === "StringLiteral")
            add(
              `content.${file.replace(/\.[^.]+$/, "").replaceAll("/", ".")}.${node.key.name ?? node.key.value}.${digest(value.value).slice(0, 12)}`,
              value.value,
              `${file}: ${node.key.name ?? node.key.value}`,
            );
      }
      // Label tables and conditional UI labels also remain English in data.
      if (
        node.type === "StringLiteral" &&
        (file.endsWith(".tsx") ||
          /^(?:features\/(?!.*(?:stores|storage|commands|battle-playback))|lib\/(?:gear|homestead|content-systems|mystery|game-constants)\/)/.test(
            file,
          )) &&
        /^[A-Z][A-Za-z '(]/.test(node.value) &&
        !/[#{}]|^[a-z]+:/.test(node.value) &&
        node.value.length < 400 &&
        parent.type !== "ImportDeclaration" &&
        parent.type !== "ExportNamedDeclaration" &&
        parent.type !== "JSXAttribute" &&
        (parent.type !== "ObjectProperty" || parent.value === node) &&
        parent.type !== "BinaryExpression" &&
        parent.type !== "NewExpression" &&
        !(
          parent.type === "CallExpression" &&
          /error|warn|assert|report/i.test(parent.callee.name ?? parent.callee.property?.name ?? "")
        )
      ) {
        add(
          `labels.${file.replace(/\.[^.]+$/, "").replaceAll("/", ".")}.${digest(node.value).slice(0, 12)}`,
          node.value,
          file,
        );
      }
    });
  }
  let keywordAliases = [];
  await withReportServer(async (server) => {
    const data = await server.ssrLoadModule("/src/lib/game-data/index.ts");
    keywordAliases = (await server.ssrLoadModule("/src/lib/keyword-text.ts")).keywordAliases;
    for (const hero of Object.values(data.characters)) {
      const message = data.getCharacterUnlockMessage(hero.id);
      if (message) add(`catalog.unlock.${hero.id}`, message, "Character unlock requirement");
    }
    const routing = await server.ssrLoadModule("/src/lib/routing/run-phase-presence.ts");
    for (const [screen, label] of Object.entries(routing.STEAM_SCREEN_LABELS))
      add(`steam.presence.alchemy_screen_${screen.replaceAll("-", "_")}`, label, "Steam friend presence");
    add("steam.presence.alchemy_menu", "In Menu", "Steam friend presence");
    add(
      "steam.presence.alchemy_battle",
      "Fighting as {#hero_%hero%}",
      "Steam friend presence; keep the nested hero token unchanged",
    );
    add("steam.presence.alchemy_victory", "Run Victory", "Steam friend presence");
    add("steam.presence.alchemy_run_ended", "Run Ended", "Steam friend presence");
    for (const hero of Object.values(data.characters))
      add(`steam.presence.hero_${hero.id}`, hero.name, "Steam localized hero name");
    const gear = await server.ssrLoadModule("/src/lib/gear/index.ts");
    const descriptionMessages = await server.ssrLoadModule("/src/lib/game-data/description-message.ts");
    function addDescription(message, context) {
      const previous = messages[message.id]?.slotTypes;
      add(message.id, message.template, context);
      messages[message.id].slotTypes = Object.fromEntries(
        Object.entries(message.slots).map(([name, slot]) => [
          name,
          "magnitudeId" in slot ? { kind: "magnitude" } : slot,
        ]),
      );
      if (previous && JSON.stringify(previous) !== JSON.stringify(messages[message.id].slotTypes))
        throw new Error(`Conflicting semantic bindings: ${message.id}`);
    }

    const model = await server.ssrLoadModule("/src/lib/game-data/card-description-model.ts");
    // Finite state alternatives can yield a single-type range even when the
    // authored effect was fixed damage. These are native presentation forms.
    for (const damageType of data.DAMAGE_TYPES) {
      const effects = [{ kind: "random-damage", minAmount: 1, maxAmount: 3, damageTypePool: [damageType] }];
      for (const line of model.renderCardDescription(effects, data.createEffectDescription(effects)).localizedLines)
        addDescription(line, "Battle card known-modifier preview");
    }
    for (const card of data.cardLibrary) {
      if (!card.description) continue;
      for (const line of model.renderCardDescription(card.effects, card.description).localizedLines) {
        addDescription(line, "Card effect description");
      }
    }
    // Runtime inspection can split shared literals or show finite ranges. Extract
    // those native templates too, including all existing cards as Mixed Potions.
    const previews = await server.ssrLoadModule("/src/lib/battle/card-damage-inspection.ts");
    const battleDefaults = await server.ssrLoadModule("/src/lib/battle/battle-setup-defaults.ts");
    const mixer = await server.ssrLoadModule("/src/lib/alchemist/potion-mixer.ts");
    const previewState = battleDefaults.defaultBattleState();
    Object.assign(previewState, {
      playerHealth: 40,
      playerMaxHealth: 100,
      enemyHealth: 10000,
      enemyMaxHealth: 10000,
      mana: 20,
      maxMana: 50,
      activeCompanion: data.companionLibrary.wolf,
    });
    Object.assign(previewState.playerStatuses, { forge: 4, block: 3, armor: 2 });
    Object.assign(previewState.enemyStatuses, { bleed: 3 });
    Object.assign(previewState.talentEffects, { potionPotency: 3, forgeBlockPercent: 25 });
    Object.assign(previewState.gearEffects, {
      flatPhysicalDamage: 2,
      flatBleedDamage: 1,
      flatFreezeDamage: 1,
      flatBlockGained: 2,
      flatArmorGained: 1,
      goldGainPercent: 50,
    });
    // A restored modified Shield Bash can retain another single damage type.
    // Its migrated clause and known-damage form need the same shipped coverage.
    const shieldBash = data.cardById["shield-bash"];
    const restoredBashVariants = data.DAMAGE_TYPES.filter((type) => type !== "stun").map((damageType) => {
      const effects = shieldBash.effects.map((effect) =>
        effect.kind === "damage" && effect.spendBlock ? { ...effect, damageType } : effect,
      );
      return model.withCardDescription({ ...shieldBash, effects }, data.createEffectDescription(effects));
    });
    for (const source of [...data.cardLibrary, ...restoredBashVariants]) {
      for (const line of model.renderCardDescription(source.effects, source.description).localizedLines)
        addDescription(line, "Card effect description");
      for (const card of [source, mixer.createMixedPotion(source, data.cardById["mana-potion"])]) {
        const inspected = previews.getBattleCardDescriptionInspection(card, { ...previewState, hand: [card] });
        for (const line of model.renderCardDescription(inspected.effects, inspected.description).localizedLines)
          addDescription(line, "Battle card known-modifier preview");
      }
    }
    const materialTypes = await server.ssrLoadModule("/src/lib/homestead/types.ts");
    for (const [id, label] of Object.entries(materialTypes.materialLabels))
      add(`catalog.material.${id}`, label, "Material name");
    const companions = await server.ssrLoadModule("/src/lib/game-data/cards/companion-turn-description.ts");
    for (const companion of Object.values(data.companionLibrary))
      for (const bond of [0, 1, 2, 3]) {
        for (const [index, line] of companions.getCompanionDescriptionLines(companion, bond).entries())
          add(`catalog.companion.${companion.id}.${bond}.${index}`, line, "Companion action with Bond bonuses");
      }
    const prefixes = await server.ssrLoadModule("/src/lib/game-constants/transmutation.ts");
    for (const [id, prefix] of Object.entries(prefixes.TRANSMUTATION_PREFIXES))
      add(
        `card.transmuted.${id}`,
        `<modifier>${prefix}</modifier> {{name}}`,
        "Transmuted card title; name is the localized base title",
      );
    const seen = new WeakSet();
    function enumerate(value, key) {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      for (const [field, entry] of Object.entries(value)) {
        if (
          typeof entry === "string" &&
          (textProperties.has(field) || (field === "role" && key.startsWith("characters")))
        )
          add(`catalog.${key}.${field}`, entry, `Game catalog: ${key}.${field}`);
        else if (field === "descriptionLines" && Array.isArray(entry))
          entry.forEach((line, i) => {
            if (typeof line === "string") add(`catalog.${key}.line${i}`, line, `Game catalog: ${key} description`);
          });
        else if (typeof entry === "object") enumerate(entry, `${key}.${entry?.id ?? field}`);
      }
    }
    for (const [key, value] of Object.entries({ ...data, ...gear })) enumerate(value, key);
    for (const module of [
      "/src/lib/homestead/data.ts",
      "/src/lib/content-systems/encounter-traits.ts",
      "/src/lib/mystery/pool.ts",
      "/src/features/alchemy/shared/config/phoenix-feather-status.ts",
      "/src/features/alchemy/shared/augment-definitions.ts",
    ]) {
      const catalog = await server.ssrLoadModule(module);
      for (const [key, value] of Object.entries(catalog)) enumerate(value, key);
    }
    for (const definition of Object.values(gear.gearAffixCatalog)) {
      const value = gear.formatAffixDescription(definition.descriptionTemplate, 1);
      const message = descriptionMessages.buildDescriptionMessage([{ text: value }]);
      addDescription(message, "Gear affix description");
    }
    // Explicitly enumerate presentation templates rather than discovering text
    // from playthroughs; changed catalog entries are checked without playing.
    for (const message of Object.values(messages)) {
      const semantic = descriptionMessages.buildDescriptionMessage([{ text: message.text }]);
      if (semantic.template !== message.text && !message.text.includes("{{") && !message.text.includes("<")) {
        addDescription(semantic, "Catalog description");
        message.aliasOf = semantic.id;
        message.values = semantic.values;
      }
    }
    for (const message of Object.values(messages)) {
      if (!/benefitDescription|nonCombatBenefitDescription/.test(message.context) || message.text.includes("<"))
        continue;
      // Homestead nodes present each benefit line independently, with local slot numbering.
      for (const line of message.text.split("\n")) {
        const semanticLine = descriptionMessages.buildDescriptionMessage([{ text: line }], true);
        if (!messages[semanticLine.id]) addDescription(semanticLine, "Homestead benefit line with resource slots");
      }
      const semantic = descriptionMessages.buildDescriptionMessage([{ text: message.text }], true);
      addDescription(semantic, "Homestead benefit with resource slots");
      if (semantic.template !== message.text) {
        message.aliasOf = semantic.id;
        message.values = semantic.values;
      }
    }
    for (const card of data.cardLibrary) {
      if (!card.description) continue;
      for (const value of [1, 2, 3]) {
        const effects = globalThis.structuredClone(card.effects);
        for (const line of card.description)
          for (const part of line.parts) {
            if (typeof part === "string") continue;
            for (const reference of part.references) {
              const effect = model.getCardEffect(effects, reference);
              if (effect) effect[reference.field] = value * (reference.multiplier ?? 1);
            }
          }
        for (const line of model.renderCardDescription(effects, card.description).localizedLines)
          addDescription(line, "Card effect description");
      }
    }
  });
  const storeCopy = JSON.parse(fs.readFileSync(path.join(ROOT, "steam/store-copy.source.json"), "utf8"));
  for (const [edition, fields] of Object.entries(storeCopy))
    for (const [field, value] of Object.entries(fields))
      add(`steam.store.${edition}.${field}`, value, `Steam ${edition} ${field}`);
  const extras = JSON.parse(fs.readFileSync(path.join(ROOT, "src/lib/localization/extra-messages.json"), "utf8"));
  for (const [id, entry] of Object.entries(extras)) {
    add(id, entry.text, entry.context);
    if (entry.plural) {
      messages[id].plural = true;
      messages[id].forms = entry.forms;
    }
  }
  const glossary = JSON.parse(fs.readFileSync(path.join(ROOT, "src/lib/localization/locales/glossary.json"), "utf8"));
  const terms = [...new Set(Object.values(glossary).flatMap((entries) => Object.keys(entries)))];
  for (const message of Object.values(messages)) message.terms = relatedTerms(message.text, terms, keywordAliases);
  const canonical = new Map();
  for (const [id, message] of Object.entries(ordered(messages))) {
    if (message.aliasOf || message.plural) continue;
    const previous = canonical.get(message.text);
    if (previous) message.aliasOf = previous;
    else canonical.set(message.text, id);
  }
  return { messages: ordered(messages), issues };
}
