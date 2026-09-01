import { render, screen } from "@testing-library/react";
import StartupSplash from "./StartupSplash";

test("shows the MatchApp logo and an accessible startup status", () => {
  render(<StartupSplash />);

  expect(screen.getByRole("status", { name: "MatchApp startar" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "MatchApp" }).getAttribute("src"))
    .toContain("/icons/icon-192.png");
});
