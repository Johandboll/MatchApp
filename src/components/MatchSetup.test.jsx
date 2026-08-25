import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import MatchSetup from "./MatchSetup";

const renderSetup = (overrides = {}) => render(
  <MatchSetup
    teamName="Testlaget"
    matchInfo={{ date: "2026-03-15", opponent: "Motstånd", location: "Hemma" }}
    onMatchInfoChange={jest.fn()}
    playersForUI={[]}
    selectedPlayers={[]}
    onTogglePlayer={jest.fn()}
    cupPanelOpen={false}
    setCupPanelOpen={jest.fn()}
    setCupEnabled={jest.fn()}
    cupName=""
    setCupName={jest.fn()}
    cupPhase=""
    setCupPhase={jest.fn()}
    onStartMatch={jest.fn()}
    canStartMatch={false}
    appVersion="2.0.4-test"
    changelogTooltip=""
    matchSeason="2025/2026"
    isPastSeason
    {...overrides}
  />
);

test("clearly shows when a match will be saved in an earlier season", () => {
  renderSetup();

  expect(screen.getByText("Matchen sparas i en tidigare säsong: 2025/2026.")).toBeVisible();
});

test("does not show the warning for the current season", () => {
  renderSetup({ matchSeason: "2026/2027", isPastSeason: false });

  expect(screen.queryByText(/Matchen sparas i en tidigare säsong/)).not.toBeInTheDocument();
});
