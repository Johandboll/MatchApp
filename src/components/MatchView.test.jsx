import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import MatchView from "./MatchView";

const players = [
  { id: "gk-1", nr: 1, shirtNumber: 1, name: "Målvakten", role: "goalkeeper" },
  { id: "field-1", nr: 9, shirtNumber: 9, name: "Utespelaren" }
];

const openPlayer = (name) => fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));

test("mobile goalkeeper has both save and wide outcomes", () => {
  const increment = jest.fn();
  render(<MatchView allPlayers={players} selectedPlayers={["gk-1"]} stats={{}} increment={increment} />);

  openPlayer("Målvakten");
  fireEvent.click(screen.getAllByRole("button", { name: /Utanför/ })[0]);

  expect(increment).toHaveBeenCalledWith("gk-1", "miss");
});

test("mobile field player has both saved and wide shot outcomes", () => {
  const increment = jest.fn();
  render(<MatchView allPlayers={players} selectedPlayers={["field-1"]} stats={{}} increment={increment} />);

  openPlayer("Utespelaren");
  fireEvent.click(screen.getByRole("button", { name: /Räddning/ }));

  expect(increment).toHaveBeenCalledWith("field-1", "save");
});

test("mobile field player keeps technical error inside More", () => {
  const increment = jest.fn();
  render(<MatchView allPlayers={players} selectedPlayers={["field-1"]} stats={{}} increment={increment} />);

  openPlayer("Utespelaren");
  expect(screen.queryByRole("button", { name: "Tekn. fel" })).not.toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: /Mer/ })[0]);
  const technicalErrorButtons = screen.getAllByRole("button", { name: "Tekn. fel" });
  expect(technicalErrorButtons).toHaveLength(2);
  fireEvent.click(technicalErrorButtons[0]);

  expect(increment).toHaveBeenCalledWith("field-1", "turnover");
});
