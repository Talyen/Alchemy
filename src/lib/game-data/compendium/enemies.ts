import * as assetRefs from "../assets";
import { defineEnemy, trait } from "../compendium-builders";

// Shared wording stays consistent while each enemy keeps its own catalog object.
const sharedWeaknesses = {
  coldShocked: trait("minor-freeze-vulnerability", "Cold-Shocked", "Receives 30% more Freeze damage.", "negative"),
  thawing: trait("burn-vulnerability", "Thawing", "Receives 30% more Burn damage.", "negative"),
  kindling: trait("burn-vulnerability", "Kindling", "Receives 30% more Burn damage.", "negative"),
  profane: trait("holy-vulnerability", "Profane", "Receives 30% more Holy damage.", "negative"),
  cowardly: trait("cowardly", "Cowardly", "Deals 1 less damage below half Health.", "negative"),
  frail: trait("frail", "Frail", "Receives 30% more Physical damage.", "negative"),
  corrodible: trait("corrodible", "Corrodible", "Receives 30% more Poison damage.", "negative"),
  lumbering: trait("lumbering", "Lumbering", "Receives 30% more Stun damage.", "negative"),
  flickering: trait("flickering", "Flickering", "Losing Health reduces its next attack’s damage by 1.", "negative"),
  selfSacrifice: trait("self-sacrifice", "Self-Sacrifice", "Loses 1 Health after each attack hit.", "negative"),
  reckless: trait("reckless", "Reckless", "Receives 30% more Physical damage.", "negative"),
  faultLines: trait("fault-lines", "Fault Lines", "Receives 30% more Stun damage.", "negative"),
};

export const enemyBestiary = [
  defineEnemy({
    id: "forge-golem",
    title: "The Forge Golem",
    art: assetRefs.theForgeGolem,
    enemyType: "boss",
    traits: [
      trait("rusting-carapace", "Stoke the Forge", "Gains 1 Forge every other turn."),
      { ...sharedWeaknesses.coldShocked },
    ],
    abilityIds: ["sunder", "bash", "molten-bulwark"],
  }),
  defineEnemy({
    id: "frostwarden",
    title: "The Frostwarden",
    art: assetRefs.theFrostwarden,
    enemyType: "boss",
    traits: [
      trait("glacial-shell", "Glacial Surge", "Deals 1 additional Freeze damage. Receives half Freeze damage."),
      { ...sharedWeaknesses.thawing },
    ],
    abilityIds: ["frostbolt", "cold-snap", "glacial-ward"],
  }),
  defineEnemy({
    id: "blight-treant",
    title: "The Blight Treant",
    art: assetRefs.theBlightTreant,
    enemyType: "boss",
    traits: [
      trait("regeneration", "Rotting Regrowth", "Restores 1 Health each turn."),
      trait("brittle-bark", "Brittle Bark", "Receives 30% more Burn damage and 30% more Stun damage.", "negative"),
    ],
    abilityIds: ["grasping-vines", "bloodthorn", "thorn-whip"],
  }),
  defineEnemy({
    id: "skeleton",
    title: "Skeleton",
    enemyType: "normal",
    traits: [trait("hollow-frame", "Hollow Frame", "Cannot be Leeched."), { ...sharedWeaknesses.profane }],
    abilityIds: ["slash", "bash", "block"],
  }),
  defineEnemy({
    id: "goblin",
    title: "Goblin",
    enemyType: "normal",
    traits: [trait("pilfer", "Pilfer", "Steals 1 Block before each attack hit."), { ...sharedWeaknesses.cowardly }],
    abilityIds: ["stab", "slash", "block"],
  }),
  defineEnemy({
    id: "mimic",
    title: "Mimic",
    enemyType: "elite",
    traits: [trait("snap-shut", "Snap Shut", "Gains 1 Block after each attack hit."), { ...sharedWeaknesses.kindling }],
    abilityIds: ["fangs", "bash", "block"],
  }),
  defineEnemy({
    id: "mud-elemental",
    title: "Mud Elemental",
    enemyType: "elite",
    traits: [trait("regeneration", "Reform", "Restores 1 Health each turn."), { ...sharedWeaknesses.coldShocked }],
    abilityIds: ["caustic-jab", "grasping-vines", "block"],
  }),
  defineEnemy({
    id: "necromancer",
    title: "Necromancer",
    enemyType: "elite",
    traits: [
      trait("soul-harvest", "Soul Harvest", "Below half Health, attack hits randomly Purge or Leech."),
      { ...sharedWeaknesses.profane },
    ],
    abilityIds: ["fangs", "bloodthorn", "rend"],
  }),
  defineEnemy({
    id: "plague-doctor",
    title: "Plague Doctor",
    enemyType: "elite",
    traits: [
      trait("contagion", "Contagion", "Restores 1 Health whenever an opponent takes Poison damage."),
      { ...sharedWeaknesses.frail },
    ],
    abilityIds: ["caustic-jab", "venom-fangs", "rend"],
  }),
  defineEnemy({
    id: "living-armor",
    title: "Living Armor",
    enemyType: "elite",
    traits: [
      trait("living-armor", "Animated Plate", "Starts combat with 4 Armor."),
      { ...sharedWeaknesses.corrodible },
    ],
    abilityIds: ["slash", "shield-bash", "plate-mail"],
  }),
  defineEnemy({
    id: "iron-bear",
    title: "The Iron Bear",
    enemyType: "boss",
    traits: [trait("iron-hide", "Iron Hide", "Gains 1 Armor every other turn."), { ...sharedWeaknesses.lumbering }],
    abilityIds: ["maul", "burning-blade", "pounce"],
  }),
  defineEnemy({
    id: "fire-elemental",
    title: "Fire Elemental",
    enemyType: "elite",
    traits: [
      trait("cinder-skin", "Cinder Skin", "Retaliates with 1 Burn damage every other turn."),
      { ...sharedWeaknesses.coldShocked },
    ],
    abilityIds: ["fireball", "cinderbloom", "molten-bulwark"],
  }),
  defineEnemy({
    id: "frost-elemental",
    title: "Frost Elemental",
    enemyType: "elite",
    traits: [
      trait("frost-elemental", "Deep Cold", "Deals 1 additional Freeze damage."),
      { ...sharedWeaknesses.thawing },
    ],
    abilityIds: ["frostbolt", "cold-snap", "glacial-ward"],
  }),
  defineEnemy({
    id: "slime",
    title: "Slime",
    enemyType: "normal",
    traits: [
      trait("amorphous", "Gelatinous Body", "Receives 20% less Physical damage."),
      { ...sharedWeaknesses.coldShocked },
    ],
    abilityIds: ["venom-fangs", "caustic-jab", "block"],
  }),
  defineEnemy({
    id: "will-o-wisp",
    title: "Will-o-Wisp",
    enemyType: "elite",
    traits: [
      trait("will-o-wisp", "Incorporeal", "Receives 30% less Physical damage."),
      { ...sharedWeaknesses.flickering },
    ],
    abilityIds: ["frostbolt", "lightning-bolt", "glacial-ward"],
  }),
  defineEnemy({
    id: "bandit",
    title: "Bandit",
    enemyType: "normal",
    traits: [trait("bandit", "Ambush", "Its first landed hit deals double damage."), { ...sharedWeaknesses.cowardly }],
    abilityIds: ["slash", "serrated-edge", "block"],
  }),
  defineEnemy({
    id: "ogre",
    title: "Ogre",
    enemyType: "elite",
    traits: [
      trait("ogre", "Brute Force", "Physical attacks deal double damage to Block."),
      { ...sharedWeaknesses.lumbering },
    ],
    abilityIds: ["bash", "sunder", "maul"],
  }),
  defineEnemy({
    id: "fire-imp",
    title: "Fire Imp",
    enemyType: "normal",
    traits: [trait("fire-imp", "Cinder Touch", "Attack hits inflict 1 Burn."), { ...sharedWeaknesses.coldShocked }],
    abilityIds: ["fireball", "bellows-blast", "molten-bulwark"],
  }),
  defineEnemy({
    id: "hellhound",
    title: "Hellhound",
    enemyType: "elite",
    traits: [
      trait("hellhound", "Feed the Flames", "Deals 25% more damage against Burning heroes."),
      { ...sharedWeaknesses.coldShocked },
    ],
    abilityIds: ["fangs", "burning-blade", "pounce"],
  }),
  defineEnemy({
    id: "pyromancer",
    title: "Pyromancer",
    enemyType: "elite",
    traits: [
      trait("pyromancer", "Pyromancy", "Deals 1 additional Burn damage against heroes who are not Burning."),
      { ...sharedWeaknesses.frail },
    ],
    abilityIds: ["fireball", "cinderbloom", "sunburst"],
  }),
  defineEnemy({
    id: "giant-spider",
    title: "Giant Spider",
    enemyType: "normal",
    traits: [trait("giant-spider", "Venomous Bite", "Attack hits inflict 1 Poison."), { ...sharedWeaknesses.kindling }],
    abilityIds: ["venom-fangs", "pounce", "caustic-jab"],
  }),
  defineEnemy({
    id: "giant-snake",
    title: "Giant Snake",
    enemyType: "elite",
    traits: [
      trait("giant-snake", "Corrosive Venom", "Poison removes 1 additional Block before damaging Health."),
      trait("cold-blooded", "Cold-Blooded", "Receives 30% more Freeze damage.", "negative"),
    ],
    abilityIds: ["venom-fangs", "caustic-jab", "rend"],
  }),
  defineEnemy({
    id: "blood-cultist",
    title: "Blood Cultist",
    enemyType: "elite",
    traits: [
      trait("blood-cultist", "Blood Frenzy", "Deals 1 additional Bleed damage against Bleeding heroes."),
      { ...sharedWeaknesses.selfSacrifice },
    ],
    abilityIds: ["rend", "serrated-edge", "bloodthorn"],
  }),
  defineEnemy({
    id: "dire-wolf",
    title: "Dire Wolf",
    enemyType: "normal",
    traits: [
      trait("dire-wolf", "Scent of Blood", "Deals 1 additional damage against Bleeding heroes."),
      { ...sharedWeaknesses.reckless },
    ],
    abilityIds: ["fangs", "rend", "pounce"],
  }),
  defineEnemy({
    id: "vampire",
    title: "Vampire",
    enemyType: "elite",
    traits: [
      trait("vampire", "Blood Scent", "Attack hits deal 1 additional Bleed damage against heroes below half Health."),
      { ...sharedWeaknesses.profane },
    ],
    abilityIds: ["fangs", "rend", "bloodthorn"],
  }),
  defineEnemy({
    id: "blood-countess",
    title: "The Blood Countess",
    art: assetRefs.theBloodCountess,
    enemyType: "boss",
    traits: [
      trait("crimson-pulse", "Crimson Pulse", "Deals 1 Bleed damage every third turn."),
      trait("blood-countess", "Profane Blood", "Takes 1 Holy damage whenever the hero restores Health.", "negative"),
    ],
    abilityIds: ["fangs", "rend", "bloodthorn"],
  }),
  defineEnemy({
    id: "zealot",
    title: "Zealot",
    enemyType: "normal",
    traits: [trait("zealot-enemy", "Fervor", "Holy hits grant 1 Forge."), { ...sharedWeaknesses.selfSacrifice }],
    abilityIds: ["slash", "smite", "judgment"],
  }),
  defineEnemy({
    id: "cleric",
    title: "Cleric",
    enemyType: "elite",
    traits: [trait("cleric", "Restoring Light", "Holy hits restore 1 Health."), { ...sharedWeaknesses.frail }],
    abilityIds: ["judgment", "holy-radiance", "smite"],
  }),
  defineEnemy({
    id: "inquisitor",
    title: "Inquisitor",
    enemyType: "normal",
    traits: [
      trait("inquisitor", "Condemn", "Attack hits deal 1 additional Holy damage against heroes below half Health."),
      { ...sharedWeaknesses.reckless },
    ],
    abilityIds: ["sunder", "judgment", "smite"],
  }),
  defineEnemy({
    id: "paladin",
    title: "Paladin",
    enemyType: "elite",
    traits: [
      trait("paladin", "Sacred Bulwark", "Holy and Stun hits grant 1 Block."),
      { ...sharedWeaknesses.corrodible },
    ],
    abilityIds: ["judgment", "shield-bash", "holy-radiance"],
  }),
  defineEnemy({
    id: "seraph",
    title: "The Seraph",
    art: assetRefs.theSeraph,
    enemyType: "boss",
    traits: [
      trait("radiant-judgment", "Radiant Judgment", "Deals 1 Holy damage every other turn."),
      trait(
        "cracked-halo",
        "Cracked Halo",
        "Receives 2 additional damage from the second attack hit each turn.",
        "negative",
      ),
    ],
    abilityIds: ["smite", "judgment", "holy-radiance"],
  }),
  defineEnemy({
    id: "winter-wolf",
    title: "Winter Wolf",
    enemyType: "normal",
    traits: [
      trait("winter-wolf", "Winter’s Bite", "Attack hits deal 1 additional Freeze damage."),
      { ...sharedWeaknesses.thawing },
    ],
    abilityIds: ["fangs", "pounce", "frostbolt"],
  }),
  defineEnemy({
    id: "ice-wraith",
    title: "Ice Wraith",
    enemyType: "elite",
    traits: [
      trait("ice-wraith", "Cold Embrace", "Restores 3 Health whenever the hero becomes Frozen."),
      { ...sharedWeaknesses.profane },
    ],
    abilityIds: ["frostbolt", "cold-snap", "glacial-ward"],
  }),
  defineEnemy({
    id: "yeti",
    title: "Yeti",
    enemyType: "elite",
    traits: [
      trait("yeti", "Rimeguard", "Gains 1 Block whenever the hero becomes Frozen."),
      { ...sharedWeaknesses.thawing },
    ],
    abilityIds: ["maul", "frostbolt", "glacial-ward"],
  }),
  defineEnemy({
    id: "banshee",
    title: "Banshee",
    enemyType: "normal",
    traits: [
      trait("banshee", "Dread Wail", "Attack hits Purge a random beneficial effect."),
      { ...sharedWeaknesses.profane },
    ],
    abilityIds: ["bash", "frostbolt", "cold-snap"],
  }),
  defineEnemy({
    id: "brawler",
    title: "Brawler",
    enemyType: "elite",
    traits: [
      trait("concussion", "Concussion", "Stun weakens the hero’s next attack by 25%."),
      trait("brawler", "Seeing Stars", "Its next attack deals half damage after recovering from Stun.", "negative"),
    ],
    abilityIds: ["bash", "pounce", "block"],
  }),
  defineEnemy({
    id: "stone-golem",
    title: "Stone Golem",
    enemyType: "elite",
    traits: [
      trait("stone-golem", "Bulwark Force", "Deals 1 additional damage while it has Block."),
      { ...sharedWeaknesses.faultLines },
    ],
    abilityIds: ["bash", "shield-bash", "plate-mail"],
  }),
  defineEnemy({
    id: "earth-elemental",
    title: "Earth Elemental",
    enemyType: "normal",
    traits: [
      trait("earth-elemental", "Crushing Force", "Breaking hero Block deals 1 Physical damage."),
      { ...sharedWeaknesses.faultLines },
    ],
    abilityIds: ["bash", "grasping-vines", "block"],
  }),
  defineEnemy({
    id: "stone-titan",
    title: "The Stone Titan",
    art: assetRefs.theStoneTitan,
    enemyType: "boss",
    traits: [
      trait("stone-titan", "Hardening Blows", "Stun hits grant 1 Armor."),
      trait("loose-rubble", "Loose Rubble", "Losing Health reduces its next attack’s damage by 1.", "negative"),
    ],
    abilityIds: ["bash", "sunder", "shield-bash"],
  }),
];
