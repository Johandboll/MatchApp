import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import HelpModal from "./HelpModal";

test("explains season rollover and all-season statistics", () => {
  render(<HelpModal open onClose={jest.fn()} />);

  expect(screen.getByRole("heading", { name: "Så fungerar MatchApp" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Föra laget till en ny säsong" })).toBeVisible();
  expect(screen.getByText(/Alla säsonger/)).toBeVisible();
});
