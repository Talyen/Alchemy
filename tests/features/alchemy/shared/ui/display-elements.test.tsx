import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CurrencyAmount } from "@/features/alchemy/shared/ui/display-elements";

describe("display elements", () => {
  afterEach(cleanup);

  it("renders formatted currency amount with suffix", () => {
    render(<CurrencyAmount amount={1500} suffix=" Gold" />);
    expect(screen.getByText("1,500 Gold")).toBeTruthy();
  });
});
