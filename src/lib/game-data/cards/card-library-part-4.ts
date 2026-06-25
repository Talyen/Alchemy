import type { BattleCard } from "../types";
import {
  bearCompanion,
  blackjack,
  bloodthorn,
  burningBlade,
  cauterize,
  cinderbloom,
  graspingVines,
  holyRadiance,
  pantherCompanion,
  phoenixCompanion,
  plateMail,
  sanctifiedPlate,
  shieldBash,
  steal,
  sunburst,
  venomFangs,
} from "../assets";
import {
  damageCard,
  dualDamageCard,
  healThenDamageCard,
  playerStatThenScaledDamageCard,
  playerStatusCard,
  summonCompanionCard,
} from "./card-builders";

export const cardLibraryPart4: BattleCard[] = [
  summonCompanionCard({ id: "bear-companion", art: bearCompanion, companionId: "bear" }),
  summonCompanionCard({
    id: "panther-companion",
    art: pantherCompanion,
    companionId: "panther",
  }),
  summonCompanionCard({
    id: "phoenix-companion",
    art: phoenixCompanion,
    companionId: "phoenix",
  }),
  playerStatusCard({ id: "plate-mail", art: plateMail, status: "armor", amount: 2 }),
  playerStatThenScaledDamageCard({
    id: "sanctified-plate",
    art: sanctifiedPlate,
    damageType: "holy",
    scaleFrom: "armor",
    playerStat: { status: "armor", amount: 1 },
  }),
  {
    id: "shield-bash",
    title: "Shield Bash",
    descriptionLines: ["Deal 2 Stun damage", "Gain 2 Block"],
    art: shieldBash,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "stun", amount: 2 },
      { kind: "player-status", status: "block", amount: 2 },
    ],
  },
  {
    id: "steal",
    title: "Steal",
    descriptionLines: ["Steal 4 Gold"],
    art: steal,
    cost: 1,
    effects: [{ kind: "gain-gold", amount: 4 }],
  },
  dualDamageCard({
    id: "burning-blade",
    art: burningBlade,
    hits: [
      { damageType: "physical", amount: 2 },
      { damageType: "burn", amount: 2 },
    ],
  }),
  // Effect order invariant: remove-harmful-status before self-damage (see card-effect-ordering.test.ts)
  {
    id: "cauterize",
    title: "Cauterize",
    descriptionLines: ["Remove 2 harmful status effects", "Receive 1 Burn damage"],
    art: cauterize,
    cost: 1,
    effects: [
      { kind: "remove-harmful-status", amount: 2 },
      { kind: "self-damage", damageType: "burn", amount: 1 },
    ],
  },
  {
    id: "blackjack",
    title: "Blackjack",
    descriptionLines: ["Deal 2 Stun damage", "Steal 2 Gold"],
    art: blackjack,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "stun", amount: 2 },
      { kind: "gain-gold", amount: 2 },
    ],
  },
  healThenDamageCard({
    id: "sunburst",
    art: sunburst,
    heal: 2,
    damageType: "burn",
    damage: 2,
  }),
  healThenDamageCard({
    id: "holy-radiance",
    art: holyRadiance,
    heal: 2,
    damageType: "holy",
    damage: 2,
  }),
  damageCard({
    id: "venom-fangs",
    art: venomFangs,
    damageType: "poison",
    amount: 2,
    lifesteal: true,
  }),
  damageCard({
    id: "bloodthorn",
    art: bloodthorn,
    damageType: "nature",
    amount: 4,
    lifesteal: true,
  }),
  dualDamageCard({
    id: "cinderbloom",
    art: cinderbloom,
    hits: [
      { damageType: "nature", amount: 2 },
      { damageType: "burn", amount: 2 },
    ],
  }),
  dualDamageCard({
    id: "grasping-vines",
    art: graspingVines,
    hits: [
      { damageType: "nature", amount: 2 },
      { damageType: "stun", amount: 2 },
    ],
  }),
];
