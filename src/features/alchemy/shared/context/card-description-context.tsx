import { createContext, useContext } from "react";
import type { CardDescriptionContext } from "@/lib/game-data";

const CardDescriptionContextValue = createContext<CardDescriptionContext>({});

export function CardDescriptionProvider({
  cardDescriptionContext,
  children,
}: {
  cardDescriptionContext: CardDescriptionContext;
  children: React.ReactNode;
}) {
  return <CardDescriptionContextValue value={cardDescriptionContext}>{children}</CardDescriptionContextValue>;
}

export function useCardDescriptionContext(): CardDescriptionContext {
  return useContext(CardDescriptionContextValue);
}
