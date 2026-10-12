import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TalentOverviewGrid } from "@/features/alchemy/meta/talents/talent-overview-grid";

afterEach(cleanup);

it("announces unspent Talent Points and clears the indicator after spending", () => {
  const { rerender } = render(
    <TalentOverviewGrid
      keywordIds={["burn"]}
      unspentByKeyword={new Map([["burn", true]])}
      onSelectKeyword={() => {}}
    />,
  );
  const button = screen.getByRole("button", { name: "Select Burn Talents", description: "Unspent Talent Points" });
  expect(button).toBeTruthy();
  rerender(<TalentOverviewGrid keywordIds={["burn"]} unspentByKeyword={new Map()} onSelectKeyword={() => {}} />);
  expect(screen.getByRole("button", { name: "Select Burn Talents", description: "" })).toBe(button);
});
