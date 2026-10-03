import { playUISound } from "@/lib/audio";
import { IS_DEMO } from "@/lib/game-edition";
import { openFullGameWishlist } from "@/lib/platform";
import { isDesktop, quitDesktopApp } from "@/lib/platform";
import { menuLogo } from "@/lib/game-data";
import { useMenuBadges } from "@/app/app-screen-chrome-context";
import {
  CollectionScreen,
  GameModeSelectScreen,
  HomesteadScreen,
  MenuScreen,
  TalentsScreen,
  ArmoryScreen,
} from "@/features/alchemy/meta/screens";
import {
  useFinishedRunCharacters,
  useProfileCollectionSlice,
  useProfileDiscoverySlice,
} from "@/features/alchemy/shared/stores/profile-store";
import { createRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  bondCompanion,
  completeResearch,
  constructBuilding,
  handleCollectionTabChange,
  plantFarm,
  setCollectionPage,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  useBondedCompanions,
  useHomesteadProgressSlice,
  useHasActiveRun,
  useTalentProgressSlice,
} from "@/features/alchemy/shared/stores/run-reads";
import type { MetaRouteCtx } from "./route-ctx";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";

const setCollectionPageCommand = createRunSessionCommand(setCollectionPage);
const handleCollectionTabChangeCommand = createRunSessionCommand(handleCollectionTabChange);
const constructBuildingCommand = createRunSessionCommand(constructBuilding);
const plantFarmCommand = createRunSessionCommand(plantFarm);
const completeResearchCommand = createRunSessionCommand(completeResearch);
const bondCompanionCommand = createRunSessionCommand(bondCompanion);

function MenuScreenRoute({ routeCommands }: MetaRouteCtx) {
  const commands = routeCommands.meta;
  const { hasUnspentTalents, hasAffordableHomestead } = useMenuBadges();
  const hasActiveRun = useHasActiveRun();
  const finishedRunCharacters = useFinishedRunCharacters();
  return (
    <MenuScreen
      {...(IS_DEMO && isDesktop() ? { onWishlist: openFullGameWishlist } : {})}
      hasActiveRun={hasActiveRun}
      onPlay={hasActiveRun ? commands.resumeRun : () => commands.goToScreen("game-mode-select")}
      onCollection={() => commands.goToScreen("collection")}
      onOptions={() => commands.goToScreen("options")}
      onHomestead={() => commands.goToScreen("homestead")}
      onTalents={() => commands.goToScreen("talents")}
      onArmory={() => commands.goToScreen("armory")}
      {...(isDesktop()
        ? {
            onQuit: () => {
              playUISound("destructiveConfirm");
              quitDesktopApp();
            },
          }
        : {})}
      logoSrc={menuLogo}
      hasUnspentTalents={hasUnspentTalents}
      hasAffordableHomestead={hasAffordableHomestead}
      finishedRunCharacters={finishedRunCharacters}
    />
  );
}

function ArmoryScreenRoute({ onBack, onOpenGameMenu }: MetaRouteCtx) {
  const controller = useArmoryController();
  return <ArmoryScreen {...controller} onBack={onBack} onMenu={onOpenGameMenu} />;
}

function GameModeSelectScreenRoute({ routeCommands, onBack, onOpenGameMenu }: MetaRouteCtx) {
  const commands = routeCommands.meta;
  const finishedRunCharacters = useFinishedRunCharacters();
  return (
    <GameModeSelectScreen
      finishedRunCharacters={finishedRunCharacters}
      onSelectCampaign={commands.beginCampaign}
      onSelectLabyrinth={commands.beginLabyrinth}
      onSelectWildwood={commands.beginWildwood}
      onBack={onBack ?? (() => commands.goToScreen("menu"))}
      onMenu={onOpenGameMenu}
    />
  );
}

function CollectionScreenRoute({ onBack, onOpenGameMenu }: MetaRouteCtx) {
  const profile = useProfileCollectionSlice();
  const bondedCompanions = useBondedCompanions();
  const finishedRunCharacters = useFinishedRunCharacters();

  return (
    <CollectionScreen
      {...profile}
      onSelectTab={handleCollectionTabChangeCommand}
      onPageChange={setCollectionPageCommand}
      bondedCompanions={bondedCompanions}
      finishedRunCharacters={finishedRunCharacters}
      onBack={onBack}
      onMenu={onOpenGameMenu}
    />
  );
}

function HomesteadScreenRoute({ onBack, onOpenGameMenu }: MetaRouteCtx) {
  const homesteadValues = useHomesteadProgressSlice();
  const { discoveredCardIds } = useProfileDiscoverySlice();

  return (
    <HomesteadScreen
      {...homesteadValues}
      discoveredCardIds={discoveredCardIds}
      onConstructBuilding={constructBuildingCommand}
      onPlantFarm={plantFarmCommand}
      onCompleteResearch={completeResearchCommand}
      onBondCompanion={bondCompanionCommand}
      onBack={onBack}
      onMenu={onOpenGameMenu}
    />
  );
}

function TalentsScreenRoute({ routeCommands, onBack, onOpenGameMenu }: MetaRouteCtx) {
  const commands = routeCommands.meta;
  const talentProgress = useTalentProgressSlice();

  return (
    <TalentsScreen
      {...talentProgress}
      onUnlockTalent={commands.unlockTalent}
      onResetTalents={commands.resetUnlockedTalents}
      onBack={onBack}
      onMenu={onOpenGameMenu}
    />
  );
}

export const metaScreenRoutes = {
  menu: MenuScreenRoute,
  "game-mode-select": GameModeSelectScreenRoute,
  collection: CollectionScreenRoute,
  homestead: HomesteadScreenRoute,
  talents: TalentsScreenRoute,
  armory: ArmoryScreenRoute,
};
