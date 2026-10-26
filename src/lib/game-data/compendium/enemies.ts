import * as assetRefs from "../assets";
import { defineEnemy, trait } from "../compendium-builders";

export const enemyBestiary = [
  defineEnemy({
    id: "forge-golem",
    title: "The Forge Golem",
    art: assetRefs.theForgeGolem,
    enemyType: "boss",
    traits: [
      trait("rusting-carapace", "Stoke the Forge", "Gains 1 Forge every other turn."),
      trait("minor-freeze-vulnerability", "Cold-Shocked", "Receives 30% more Freeze damage.", "negative"),
    ],
    abilityIds: ["sunder", "bash", "molten-bulwark"],
  }),
  defineEnemy({
    id: "frostwarden",
    title: "The Frostwarden",
    art: assetRefs.theFrostwarden,
    enemyType: "boss",
    traits: [
      trait("glacial-shell", "Glacial Surge", "Deals 1 additional Freeze damage."),
      trait("burn-vulnerability", "Thawing", "Receives 30% more Burn damage.", "negative"),
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
      trait("burn-vulnerability", "Kindling", "Receives 30% more Burn damage.", "negative"),
    ],
    abilityIds: ["grasping-vines", "bloodthorn", "thorn-whip"],
  }),
  defineEnemy({
    id: "skeleton",
    title: "Skeleton",
    enemyType: "normal",
    traits: [
      trait("hollow-frame", "Hollow Frame", "Cannot be Leeched."),
      trait("holy-vulnerability", "Profane", "Receives 30% more Holy damage.", "negative"),
    ],
    abilityIds: ["slash", "bash", "block"],
  }),
  defineEnemy({
    id: "goblin",
    title: "Goblin",
    enemyType: "normal",
    traits: [
      trait("pilfer", "Pilfer", "Steals 1 Block before each attack hit."),
      trait("cowardly", "Cowardly", "Deals 1 less damage below half Health.", "negative"),
    ],
    abilityIds: ["stab", "slash", "block"],
  }),
  defineEnemy({
    id: "mimic",
    title: "Mimic",
    enemyType: "elite",
    traits: [
      trait("snap-shut", "Snap Shut", "Gains 1 Block after each attack hit."),
      trait("burn-vulnerability", "Kindling", "Receives 30% more Burn damage.", "negative"),
    ],
    abilityIds: ["fangs", "bash", "block"],
  }),
  defineEnemy({
    id: "mud-elemental",
    title: "Mud Elemental",
    enemyType: "elite",
    traits: [
      trait("regeneration", "Reform", "Restores 1 Health each turn."),
      trait("minor-freeze-vulnerability", "Cold-Shocked", "Receives 30% more Freeze damage.", "negative"),
    ],
    abilityIds: ["caustic-jab", "grasping-vines", "block"],
  }),
  defineEnemy({
    id: "necromancer",
    title: "Necromancer",
    enemyType: "elite",
    traits: [
      trait("soul-harvest", "Soul Harvest", "Below half Health, attack hits randomly Purge or Leech."),
      trait("holy-vulnerability", "Profane", "Receives 30% more Holy damage.", "negative"),
    ],
    abilityIds: ["fangs", "bloodthorn", "rend"],
  }),
  defineEnemy({
    id: "plague-doctor",
    title: "Plague Doctor",
    enemyType: "elite",
    traits: [
      trait("contagion", "Contagion", "Restores 1 Health whenever an opponent takes Poison damage."),
      trait("frail", "Frail", "Receives 30% more Physical damage.", "negative"),
    ],
    abilityIds: ["caustic-jab", "venom-fangs", "rend"],
  }),
  defineEnemy({
    id: "living-armor",
    title: "Living Armor",
    enemyType: "elite",
    traits: [
      trait("living-armor", "Animated Plate", "Starts combat with 4 Armor."),
      trait("corrodible", "Corrodible", "Receives 30% more Poison damage.", "negative"),
    ],
    abilityIds: ["slash", "shield-bash", "plate-mail"],
  }),
  defineEnemy({
    id: "iron-bear",
    title: "The Iron Bear",
    enemyType: "boss",
    traits: [
      trait("iron-hide", "Iron Hide", "Gains 1 Armor every other turn."),
      trait("lumbering", "Lumbering", "Receives 30% more Stun damage.", "negative"),
    ],
    abilityIds: ["maul", "burning-blade", "pounce"],
  }),
  defineEnemy({
    id: "fire-elemental",
    title: "Fire Elemental",
    enemyType: "elite",
    traits: [
      trait("cinder-skin", "Cinder Skin", "Retaliates with 1 Burn damage every other turn."),
      trait("minor-freeze-vulnerability", "Cold-Shocked", "Receives 30% more Freeze damage.", "negative"),
    ],
    abilityIds: ["fireball", "cinderbloom", "molten-bulwark"],
  }),
  defineEnemy({
    id: "frost-elemental",
    title: "Frost Elemental",
    enemyType: "elite",
    traits: [
      trait("frost-elemental", "Deep Cold", "Deals 1 additional Freeze damage."),
      trait("burn-vulnerability", "Thawing", "Receives 30% more Burn damage.", "negative"),
    ],
    abilityIds: ["frostbolt", "cold-snap", "glacial-ward"],
  }),
  defineEnemy({
    id: "slime",
    title: "Slime",
    enemyType: "normal",
    traits: [
      trait("amorphous", "Gelatinous Body", "Receives 20% less Physical damage."),
      trait("minor-freeze-vulnerability", "Cold-Shocked", "Receives 30% more Freeze damage.", "negative"),
    ],
    abilityIds: ["venom-fangs", "caustic-jab", "block"],
  }),
  defineEnemy({
    id: "will-o-wisp",
    title: "Will-o-Wisp",
    enemyType: "elite",
    traits: [
      trait("will-o-wisp", "Incorporeal", "Receives 30% less Physical damage."),
      trait("flickering", "Flickering", "Losing Health reduces its next attack’s damage by 1.", "negative"),
    ],
    abilityIds: ["frostbolt", "lightning-bolt", "glacial-ward"],
  }),
  defineEnemy({
    id: "bandit",
    title: "Bandit",
    enemyType: "normal",
    traits: [
      trait("bandit", "Ambush", "Its first landed hit deals double damage."),
      trait("cowardly", "Cowardly", "Deals 1 less damage below half Health.", "negative"),
    ],
    abilityIds: ["slash", "serrated-edge", "block"],
  }),
  defineEnemy({
    id: "ogre",
    title: "Ogre",
    enemyType: "elite",
    traits: [
      trait("ogre", "Brute Force", "Physical attacks deal double damage to Block."),
      trait("lumbering", "Lumbering", "Receives 30% more Stun damage.", "negative"),
    ],
    abilityIds: ["bash", "sunder", "maul"],
  }),
  defineEnemy({
    id: "fire-imp",
    title: "Fire Imp",
    enemyType: "normal",
    traits: [
      trait("fire-imp", "Cinder Touch", "Attack hits inflict 1 Burn."),
      trait("minor-freeze-vulnerability", "Cold-Shocked", "Receives 30% more Freeze damage.", "negative"),
    ],
    abilityIds: ["fireball", "bellows-blast", "molten-bulwark"],
  }),
  defineEnemy({
    id: "hellhound",
    title: "Hellhound",
    enemyType: "elite",
    traits: [
      trait("hellhound", "Feed the Flames", "Deals 25% more damage against Burning heroes."),
      trait("minor-freeze-vulnerability", "Cold-Shocked", "Receives 30% more Freeze damage.", "negative"),
    ],
    abilityIds: ["fangs", "burning-blade", "pounce"],
  }),
  defineEnemy({
    id: "pyromancer",
    title: "Pyromancer",
    enemyType: "elite",
    traits: [
      trait("pyromancer", "Pyromancy", "Deals 1 additional Burn damage against heroes who are not Burning."),
      trait("frail", "Frail", "Receives 30% more Physical damage.", "negative"),
    ],
    abilityIds: ["fireball", "cinderbloom", "sunburst"],
  }),
  defineEnemy({
    id: "giant-spider",
    title: "Giant Spider",
    enemyType: "normal",
    traits: [
      trait("giant-spider", "Venomous Bite", "Attack hits inflict 1 Poison."),
      trait("burn-vulnerability", "Kindling", "Receives 30% more Burn damage.", "negative"),
    ],
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
      trait("self-sacrifice", "Self-Sacrifice", "Loses 1 Health after each attack hit.", "negative"),
    ],
    abilityIds: ["rend", "serrated-edge", "bloodthorn"],
  }),
  defineEnemy({
    id: "dire-wolf",
    title: "Dire Wolf",
    enemyType: "normal",
    traits: [
      trait("dire-wolf", "Scent of Blood", "Deals 1 additional damage against Bleeding heroes."),
      trait("reckless", "Reckless", "Receives 30% more Physical damage.", "negative"),
    ],
    abilityIds: ["fangs", "rend", "pounce"],
  }),
  defineEnemy({
    id: "vampire",
    title: "Vampire",
    enemyType: "elite",
    traits: [
      trait("vampire", "Blood Scent", "Attack hits deal 1 additional Bleed damage against heroes below half Health."),
      trait("holy-vulnerability", "Profane", "Receives 30% more Holy damage.", "negative"),
    ],
    abilityIds: ["fangs", "rend", "bloodthorn"],
  }),
  defineEnemy({
    id: "blood-countess",
    title: "The Blood Countess",
    art: assetRefs.theBloodCountess,
    enemyType: "boss",
    traits: [
      trait("crimson-pulse", "Crimson Pulse", "Deals 1 Bleed damage every other turn."),
      trait("blood-countess", "Profane Blood", "Takes 1 Holy damage whenever the hero restores Health.", "negative"),
    ],
    abilityIds: ["fangs", "rend", "bloodthorn"],
  }),
  defineEnemy({
    id: "zealot",
    title: "Zealot",
    enemyType: "normal",
    traits: [
      trait("zealot-enemy", "Fervor", "Holy hits grant 1 Forge."),
      trait("self-sacrifice", "Self-Sacrifice", "Loses 1 Health after each attack hit.", "negative"),
    ],
    abilityIds: ["slash", "smite", "judgment"],
  }),
  defineEnemy({
    id: "cleric",
    title: "Cleric",
    enemyType: "elite",
    traits: [
      trait("cleric", "Restoring Light", "Holy hits restore 1 Health."),
      trait("frail", "Frail", "Receives 30% more Physical damage.", "negative"),
    ],
    abilityIds: ["judgment", "holy-radiance", "smite"],
  }),
  defineEnemy({
    id: "inquisitor",
    title: "Inquisitor",
    enemyType: "normal",
    traits: [
      trait("inquisitor", "Condemn", "Attack hits deal 1 additional Holy damage against heroes below half Health."),
      trait("reckless", "Reckless", "Receives 30% more Physical damage.", "negative"),
    ],
    abilityIds: ["sunder", "judgment", "smite"],
  }),
  defineEnemy({
    id: "paladin",
    title: "Paladin",
    enemyType: "elite",
    traits: [
      trait("paladin", "Sacred Bulwark", "Holy and Stun hits grant 1 Block."),
      trait("corrodible", "Corrodible", "Receives 30% more Poison damage.", "negative"),
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
      trait("flickering", "Flickering", "Losing Health reduces its next attack’s damage by 1.", "negative"),
    ],
    abilityIds: ["smite", "judgment", "holy-radiance"],
  }),
  defineEnemy({
    id: "winter-wolf",
    title: "Winter Wolf",
    enemyType: "normal",
    traits: [
      trait("winter-wolf", "Winter’s Bite", "Attack hits deal 1 additional Freeze damage."),
      trait("burn-vulnerability", "Thawing", "Receives 30% more Burn damage.", "negative"),
    ],
    abilityIds: ["fangs", "pounce", "frostbolt"],
  }),
  defineEnemy({
    id: "ice-wraith",
    title: "Ice Wraith",
    enemyType: "elite",
    traits: [
      trait("ice-wraith", "Cold Embrace", "Restores 3 Health whenever the hero becomes Frozen."),
      trait("holy-vulnerability", "Profane", "Receives 30% more Holy damage.", "negative"),
    ],
    abilityIds: ["frostbolt", "cold-snap", "glacial-ward"],
  }),
  defineEnemy({
    id: "yeti",
    title: "Yeti",
    enemyType: "elite",
    traits: [
      trait("yeti", "Rimeguard", "Gains 1 Block whenever the hero becomes Frozen."),
      trait("burn-vulnerability", "Thawing", "Receives 30% more Burn damage.", "negative"),
    ],
    abilityIds: ["maul", "frostbolt", "glacial-ward"],
  }),
  defineEnemy({
    id: "banshee",
    title: "Banshee",
    enemyType: "normal",
    traits: [
      trait("banshee", "Dread Wail", "Attack hits Purge a random beneficial effect."),
      trait("holy-vulnerability", "Profane", "Receives 30% more Holy damage.", "negative"),
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
      trait("fault-lines", "Fault Lines", "Receives 30% more Stun damage.", "negative"),
    ],
    abilityIds: ["bash", "shield-bash", "plate-mail"],
  }),
  defineEnemy({
    id: "earth-elemental",
    title: "Earth Elemental",
    enemyType: "normal",
    traits: [
      trait("earth-elemental", "Crushing Force", "Breaking hero Block deals 1 Physical damage."),
      trait("fault-lines", "Fault Lines", "Receives 30% more Stun damage.", "negative"),
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
