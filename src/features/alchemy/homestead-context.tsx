// React context that makes Homestead card-description bonuses available to card-rendering
// components without threading props through every screen and shop.
import { createContext, useContext } from "react";
import type { CardDescriptionContext } from "./utils/card-description";

const HomesteadContext = createContext<CardDescriptionContext>({});

export function HomesteadProvider({
  cardDescriptionContext,
  children,
}: {
  cardDescriptionContext: CardDescriptionContext;
  children: React.ReactNode;
}) {
  return <HomesteadContext.Provider value={cardDescriptionContext}>{children}</HomesteadContext.Provider>;
}

export function useCardDescriptionContext(): CardDescriptionContext {
  return useContext(HomesteadContext);
}
