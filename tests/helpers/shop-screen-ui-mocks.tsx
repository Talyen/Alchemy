/* eslint-disable react-refresh/only-export-components -- test mock helper exports */
import type { ReactNode } from "react";
import { vi } from "vitest";
import type { BattleCard } from "@/lib/game-data";

export function PurchasableCardItem() {
  return <div>Shop offer</div>;
}

export function SelectableShopCard({ onSelect }: { onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect}>
      Select shop card
    </button>
  );
}

export function CardSelectionGrid({
  items,
  renderItem,
}: {
  items: Array<{ card: BattleCard; index: number }>;
  renderItem: (item: { card: BattleCard; index: number }) => ReactNode;
}) {
  return (
    <div>
      {items.map((item) => (
        <div key={item.index}>{renderItem(item)}</div>
      ))}
    </div>
  );
}

export function ShopBrowseShell({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export function RefreshShopServiceButton({ label = "Refresh" }: { label?: string }) {
  return <button type="button">{label}</button>;
}

export function ShopBrowseOfferings({ children, services }: { children: ReactNode; services: ReactNode }) {
  return (
    <div>
      {services}
      {children}
    </div>
  );
}

export function installShopScreenIntersectionObserver() {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
}
