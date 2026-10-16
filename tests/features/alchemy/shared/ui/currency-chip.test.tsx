import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CurrencyChip } from "@/features/alchemy/shared/ui/currency-chip";
import { CRAFTING_CURRENCY_LIST } from "@/lib/gear";

import { installCatalogs, localization } from "@/lib/localization/runtime";
import catalogs from "@/lib/localization/locales/runtime.json";

afterEach(async () => {
  cleanup();
  await localization.changeLanguage("en");
});

it("acknowledges stock changes once and keeps disabled crafting from selecting a currency", async () => {
  const currency = CRAFTING_CURRENCY_LIST[0]!;
  const onSelect = vi.fn();
  const chip = (count: number, disabled = false) => (
    <StrictMode>
      <CurrencyChip currency={currency} count={count} disabled={disabled} onSelect={onSelect} />
    </StrictMode>
  );
  const { rerender } = render(chip(3));
  const button = () => screen.getByRole("button", { name: `${currency.displayName}, 3 available` });
  const initialCount = screen.getByText("3");
  fireEvent.click(button());
  expect(onSelect).toHaveBeenCalledOnce();
  rerender(chip(3, true));
  fireEvent.click(button());
  expect(onSelect).toHaveBeenCalledOnce();
  expect(screen.getByText("3")).toBe(initialCount);
  rerender(chip(2));
  const changedCount = screen.getByText("2");
  expect(changedCount).not.toBe(initialCount);
  expect(changedCount.classList.contains("armory-count-feedback")).toBe(true);
  rerender(chip(2));
  expect(screen.getByText("2")).toBe(changedCount);
  const control = screen.getByRole("button");
  expect(control.getAttribute("aria-label")).toBe(`${currency.displayName}, 2 available`);
  control.focus();
  installCatalogs(catalogs);
  await act(async () => {
    await localization.changeLanguage("ru");
  });
  expect(screen.getByRole("button", { name: "Кости раздора, доступно: 2" })).toBe(control);
  expect(document.activeElement).toBe(control);
  expect(screen.getByText("2")).toBe(changedCount);
});
