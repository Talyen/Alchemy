import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FoundResourcesRow } from "@/features/alchemy/shared/ui/found-resources-row";

describe("FoundResourcesRow", () => {
  it("renders standalone pills without a grouped wallet panel", () => {
    const { container } = render(<FoundResourcesRow gold={12} materials={{ herbs: 2 }} className="reward-wallet" />);

    const row = container.firstElementChild;
    expect(row?.classList.contains("rounded-shell-card")).toBe(false);
    expect(row?.classList.contains("reward-wallet")).toBe(true);
    expect(row?.querySelectorAll(":scope > div")).toHaveLength(2);
  });
});
