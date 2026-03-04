import React, { useEffect, useMemo, useState } from "react";

export default function SeasonCenter({
  open,
  selectedTeam,
  seasonKpis,
  onExportBackup,
  onClose,
  seasonSummary,
  matches,
  onDeleteMatch,
  onClearSeason
}) {
  const [seasonTab, setSeasonTab] = useState("overview");
  const [seasonSearchPlayers, setSeasonSearchPlayers] = useState("");
  const [seasonSearchMatches, setSeasonSearchMatches] = useState("");
  const [showPlayersSearch, setShowPlayersSearch] = useState(false);
  const [showMatchesSearch, setShowMatchesSearch] = useState(false);
  const [seasonDangerOpen, setSeasonDangerOpen] = useState(false);
  const [seasonDangerText, setSeasonDangerText] = useState("");
  const [seasonMatchDetail, setSeasonMatchDetail] = useState(null);
  const [seasonPlayerDetail, setSeasonPlayerDetail] = useState(null);
  const [seasonMatchPlayerFocus, setSeasonMatchPlayerFocus] = useState(null);

  useEffect(() => {
    if (!open) {
      setSeasonTab("overview");
      setSeasonSearchPlayers("");
      setSeasonSearchMatches("");
      setSeasonDangerOpen(false);
      setSeasonDangerText("");
      setSeasonMatchDetail(null);
      setShowPlayersSearch(false);
      setShowMatchesSearch(false);
      setSeasonMatchPlayerFocus(null);
    }
  }, [open]);

  // Normalize string: lowercase, trim, collapse spaces, remove accents/diacritics
  const norm = (v) =>
    String(v ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  // Clear player search query when search bar closes
  useEffect(() => {
    if (!showPlayersSearch && seasonSearchPlayers) setSeasonSearchPlayers("");
  }, [showPlayersSearch, seasonSearchPlayers]);

  // Clear matches search query when search bar closes
  useEffect(() => {
    if (!showMatchesSearch && seasonSearchMatches) setSeasonSearchMatches("");
  }, [showMatchesSearch, seasonSearchMatches]);

  const filteredFieldPlayers = useMemo(() => {
    const query = norm(seasonSearchPlayers);
    return seasonSummary.fieldPlayers
      .filter((row) => {
        if (!query) return true;
        return String(row.nr).includes(query) || norm(row.name).includes(query);
      })
      .sort((a, b) => {
        const na = Number(a.nr);
        const nb = Number(b.nr);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a.nr).localeCompare(String(b.nr), "sv");
      });
  }, [seasonSearchPlayers, seasonSummary.fieldPlayers]);

  const filteredGoalkeepers = useMemo(() => {
    const query = norm(seasonSearchPlayers);
    return seasonSummary.goalkeepers
      .filter((row) => {
        if (!query) return true;
        return String(row.nr).includes(query) || norm(row.name).includes(query);
      })
      .sort((a, b) => {
        const na = Number(a.nr);
        const nb = Number(b.nr);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a.nr).localeCompare(String(b.nr), "sv");
      });
  }, [seasonSearchPlayers, seasonSummary.goalkeepers]);

  const filteredMatches = useMemo(() => {
    const query = norm(seasonSearchMatches);
    return [...matches]
      .reverse()
      .filter((match) => {
        if (!query) return true;
        const date = norm(match.matchInfo?.date);
        const opponent = norm(match.matchInfo?.opponent);
        const location = norm(match.matchInfo?.location);
        const score = `${match.result?.home ?? 0}-${match.result?.away ?? 0}`;
        const scoreN = norm(score);
        return (
          date.includes(query) ||
          opponent.includes(query) ||
          location.includes(query) ||
          scoreN.includes(query)
        );
      });
  }, [matches, seasonSearchMatches]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">MatchApp – Säsongscenter</div>
            <div className="text-lg font-extrabold truncate">
              {selectedTeam?.name ? `Säsong: ${selectedTeam.name}` : "Säsong"}
            </div>
            <div className="text-xs text-slate-500">
              Matcher: {seasonKpis.matchCount} • Mål: {seasonKpis.ourGoals} • Insläppta:{" "}
              {seasonKpis.oppGoals}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExportBackup}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold"
              title="Ladda ner säsong som JSON"
            >
              ⬇️ Backup
            </button>

            <button
              type="button"
              onClick={() => {
                setSeasonDangerOpen(true);
                setSeasonDangerText("");
              }}
              className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold"
              title="Rensa säsong"
            >
              ⚠️ Rensa
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
            >
              Tillbaka
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-3">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSeasonTab("overview")}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold ${
                seasonTab === "overview" ? "bg-white shadow" : "text-slate-700"
              }`}
            >
              Översikt
            </button>
            <button
              type="button"
              onClick={() => setSeasonTab("players")}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold ${
                seasonTab === "players" ? "bg-white shadow" : "text-slate-700"
              }`}
            >
              Spelare
            </button>
            <button
              type="button"
              onClick={() => setSeasonTab("matches")}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold ${
                seasonTab === "matches" ? "bg-white shadow" : "text-slate-700"
              }`}
            >
              Matcher
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 overflow-auto h-[calc(100vh-140px)]">
        {seasonTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border rounded-2xl p-4">
                <div className="text-xs text-slate-500">Matcher</div>
                <div className="text-3xl font-extrabold">{seasonKpis.matchCount}</div>
              </div>
              <div className="bg-white border rounded-2xl p-4">
                <div className="text-xs text-slate-500">Mål (för)</div>
                <div className="text-3xl font-extrabold">{seasonKpis.ourGoals}</div>
              </div>
              <div className="bg-white border rounded-2xl p-4">
                <div className="text-xs text-slate-500">Mål (emot)</div>
                <div className="text-3xl font-extrabold">{seasonKpis.oppGoals}</div>
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-4">
              <div className="text-sm font-semibold mb-2">Topplista – mål</div>
              {seasonKpis.top3.length === 0 ? (
                <div className="text-sm text-slate-500">Inga data ännu.</div>
              ) : (
                <div className="space-y-2">
                  {seasonKpis.top3.map((player, index) => (
                    <div
                      key={player.key}
                      className="flex items-center justify-between border rounded-xl p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"} #{player.nr}{" "}
                          {player.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          Matcher: {player.matches} • Avslut: {player.attempts}
                        </div>
                      </div>
                      <div className="text-2xl font-extrabold">{player.goals}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border rounded-2xl p-4">
              <div className="text-sm font-semibold mb-2">Snabbguide</div>
              <ol className="list-decimal ml-5 text-sm text-slate-700 space-y-1">
                <li>Spela match.</li>
                <li>
                  Tryck <span className="font-semibold">Starta ny match</span> och välj{" "}
                  <span className="font-semibold">Spara matchen</span>.
                </li>
                <li>Här ser du totalsiffror, spelare och matcher för säsongen.</li>
              </ol>
            </div>
          </div>
        )}

        {seasonTab === "players" && (
          <div className="space-y-4">
            <div className="bg-white border rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm font-semibold">Totalsummering per spelare</div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowPlayersSearch((v) => !v)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold border border-black/10"
                    aria-label="Sök spelare"
                    title="Sök spelare"
                  >
                    {showPlayersSearch ? "Dölj sök" : "Visa sök"}
                  </button>
                  {showPlayersSearch && (
                    <input
                      type="text"
                      value={seasonSearchPlayers}
                      onChange={(e) => setSeasonSearchPlayers(e.target.value)}
                      placeholder="Sök # eller namn"
                      className="border rounded-xl px-2 py-1 text-sm w-full sm:w-72 h-9"
                      autoFocus
                    />
                  )}
                </div>
              </div>
              {showPlayersSearch && (
                <div className="text-xs text-slate-500 mt-2">Tips: Du kan söka på nummer eller namn.</div>
              )}

              {filteredGoalkeepers.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-semibold mb-2">Målvakter</div>
                  <div className="overflow-auto">
                    <table className="w-full text-sm border">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-2 border">#</th>
                          <th className="text-left p-2 border">Målvakt</th>
                          <th className="text-right p-2 border">Matcher</th>
                          <th className="text-right p-2 border">Rädd</th>
                          <th className="text-right p-2 border">Insläppt</th>
                          <th className="text-right p-2 border">Rädd%</th>
                          <th className="text-right p-2 border">7m Insl</th>
                          <th className="text-right p-2 border">7m Rädd</th>
                          <th className="text-right p-2 border">MV mål</th>
                          <th className="text-right p-2 border">2 min</th>
                          <th className="text-right p-2 border">Gult</th>
                          <th className="text-right p-2 border">Rött</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGoalkeepers.map((row) => {
                          const denom = row.gkSaves + row.gkConceded;
                          const pct = denom > 0 ? Math.round((row.gkSaves / denom) * 100) : 0;
                          return (
                            <tr
                              key={row.key}
                              onClick={() => setSeasonPlayerDetail({ ...row, type: "gk" })}
                              className="cursor-pointer hover:bg-slate-50"
                            >
                              <td className="p-2 border">{row.nr}</td>
                              <td className="p-2 border">{row.name}</td>
                              <td className="p-2 border text-right">{row.matches}</td>
                              <td className="p-2 border text-right">{row.gkSaves}</td>
                              <td className="p-2 border text-right">{row.gkConceded}</td>
                              <td className="p-2 border text-right">{pct}%</td>
                              <td className="p-2 border text-right">{row.sevenGoal ?? 0}</td>
                              <td className="p-2 border text-right">{row.sevenMiss ?? 0}</td>
                              <td className="p-2 border text-right">{row.gkScored ?? 0}</td>
                              <td className="p-2 border text-right">{row.twoMin ?? 0}</td>
                              <td className="p-2 border text-right">{row.yellowCard ?? 0}</td>
                              <td className="p-2 border text-right">{row.redCard ?? 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2 border">#</th>
                      <th className="text-left p-2 border">Spelare</th>
                      <th className="text-right p-2 border">Matcher</th>
                      <th className="text-right p-2 border">Mål</th>
                      <th className="text-right p-2 border">Assist</th>
                      <th className="text-right p-2 border">Tek.fel</th>
                      <th className="text-right p-2 border">Utanför</th>
                      <th className="text-right p-2 border">Ribba</th>
                      <th className="text-right p-2 border">7m mål</th>
                      <th className="text-right p-2 border">7m miss</th>
                      <th className="text-right p-2 border">Avslut</th>
                      <th className="text-right p-2 border">Skott%</th>
                      <th className="text-right p-2 border">2 min</th>
                      <th className="text-right p-2 border">Gult</th>
                      <th className="text-right p-2 border">Rött</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFieldPlayers.map((row) => {
                      const pct = row.attempts > 0 ? Math.round((row.goals / row.attempts) * 100) : 0;
                      const sevenAtt = Math.max(row.sevenAttempts, row.sevenGoals);
                      return (
                        <tr
                          key={row.key}
                          onClick={() => setSeasonPlayerDetail({ ...row, type: "fp" })}
                          className="cursor-pointer hover:bg-slate-50"
                        >
                          <td className="p-2 border">{row.nr}</td>
                          <td className="p-2 border">{row.name}</td>
                          <td className="p-2 border text-right">{row.matches}</td>
                          <td className="p-2 border text-right">{row.goals}</td>
                          <td className="p-2 border text-right">{row.assist ?? 0}</td>
                          <td className="p-2 border text-right">{row.turnover ?? 0}</td>
                          <td className="p-2 border text-right">{row.miss ?? 0}</td>
                          <td className="p-2 border text-right">{row.post ?? 0}</td>
                          <td className="p-2 border text-right">{row.sevenGoals}</td>
                          <td className="p-2 border text-right">{row.sevenMiss ?? 0}</td>
                          <td className="p-2 border text-right">{row.attempts}</td>
                          <td className="p-2 border text-right">{pct}%</td>
                          <td className="p-2 border text-right">{row.twoMin ?? 0}</td>
                          <td className="p-2 border text-right">{row.yellowCard ?? 0}</td>
                          <td className="p-2 border text-right">{row.redCard ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {seasonTab === "matches" && (
          <div className="space-y-4">
            <div className="bg-white border rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm font-semibold">Matcher</div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowMatchesSearch((v) => !v)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold border border-black/10"
                    aria-label="Sök matcher"
                    title="Sök matcher"
                  >
                    {showMatchesSearch ? "Dölj sök" : "Visa sök"}
                  </button>
                  {showMatchesSearch && (
                    <input
                      type="text"
                      value={seasonSearchMatches}
                      onChange={(e) => setSeasonSearchMatches(e.target.value)}
                      placeholder="Sök datum, motståndare, hemma/borta, resultat"
                      className="border rounded-xl px-2 py-1 text-sm w-full sm:w-96 h-9"
                      autoFocus
                    />
                  )}
                </div>
              </div>
              {showMatchesSearch && (
                <div className="text-xs text-slate-500 mt-2">Tips: Du kan söka på datum, motståndare, hemma/borta eller resultat (t.ex. 23-21).</div>
              )}

              {matches.length === 0 ? (
                <div className="text-sm text-slate-500 mt-3">Inga sparade matcher ännu.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {filteredMatches.map((match) => (
                    <div
                      key={match.id}
                      onClick={() => {
                        setSeasonMatchPlayerFocus(null);
                        setSeasonMatchDetail(match);
                      }}
                      className="border rounded-2xl p-3 flex items-center justify-between gap-3 bg-white cursor-pointer hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">
                          {match.matchInfo?.date || "-"} • {match.matchInfo?.location || "-"}
                        </div>
                        <div className="font-semibold truncate">
                          {match.matchInfo?.opponent || "Okänd motståndare"}
                        </div>
                        <div className="text-sm">
                          Resultat: {match.result?.home ?? 0} – {match.result?.away ?? 0}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Ta bort denna match från säsongen?")) {
                            onDeleteMatch(match.id);
                          }
                        }}
                        className="shrink-0 px-2 py-2 rounded-lg bg-red-50 hover:bg-red-100"
                        aria-label="Ta bort match"
                        title="Ta bort"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {seasonPlayerDetail && (
        <div className="fixed inset-0 z-[58] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSeasonPlayerDetail(null)}
            aria-label="Stäng"
          />
          <div className="relative bg-white w-full max-w-3xl rounded-2xl border shadow-2xl p-4 max-h-[85vh] overflow-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">Spelardetalj – säsong</div>
                <div className="text-lg font-extrabold">
                  #{seasonPlayerDetail.nr} {seasonPlayerDetail.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSeasonPlayerDetail(null)}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
              >
                Stäng
              </button>
            </div>

            {(() => {
              const toN = (v) => {
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
              };

              const normKey = (v) => String(v ?? "").toLowerCase().trim();

              const playerNr = String(seasonPlayerDetail?.nr ?? "").trim();
              const playerName = String(seasonPlayerDetail?.name ?? "").trim();
              const isGk = seasonPlayerDetail?.type === "gk";

              const getPlayerStatsFromMatch = (m) => {
                const roster = Array.isArray(m?.playerRoster) ? m.playerRoster : [];
                const statsMap = m?.stats || {};

                const rosterHit = roster.find((p) => {
                  const nr = String(p?.nr ?? "").trim();
                  const name = String(p?.name ?? "").trim();
                  return (playerNr && nr === playerNr) || (playerName && name === playerName);
                });

                const id = rosterHit?.id;
                const idStr = id != null ? String(id) : "";
                const nrStr = rosterHit?.nr != null ? String(rosterHit.nr) : playerNr;
                const nameStr = (rosterHit?.name || playerName || "").trim();

                if (Array.isArray(statsMap)) {
                  const hit =
                    (idStr ? statsMap.find((x) => String(x?.id ?? "") === idStr) : null) ||
                    (idStr ? statsMap.find((x) => String(x?.playerId ?? "") === idStr) : null) ||
                    (nrStr ? statsMap.find((x) => String(x?.nr ?? "") === nrStr) : null) ||
                    (nameStr ? statsMap.find((x) => String(x?.name ?? "").trim() === nameStr) : null);
                  return hit?.stats || hit || {};
                }

                const obj = statsMap || {};
                return (
                  (id != null ? obj[id] : null) ||
                  (idStr ? obj[idStr] : null) ||
                  (nrStr ? obj[nrStr] : null) ||
                  (nameStr ? obj[nameStr] : null) ||
                  (obj.players && ((idStr ? obj.players[idStr] : null) || (id != null ? obj.players[id] : null))) ||
                  {}
                );
              };

              const playerMatchRows = (matches || [])
                .map((m) => {
                  const s = getPlayerStatsFromMatch(m);

                  const goal = toN(s.goal);
                  const save = toN(s.save);
                  const wide = toN(s.wide);
                  const post = toN(s.post);
                  const suspension = toN(s.suspension);
                  const sevenGoal = toN(s.sevenGoal);
                  const sevenMiss = toN(s.sevenMiss);
                  const gkScored = toN(s.gkScored);

                  const attempts = goal + save + wide + post + sevenGoal + sevenMiss;
                  const totalGoals = goal + sevenGoal;
                  const shotPct = attempts > 0 ? Math.round((totalGoals / attempts) * 100) : 0;

                  return {
                    match: m,
                    date: m?.matchInfo?.date || "",
                    opponent: m?.matchInfo?.opponent || "",
                    location: m?.matchInfo?.location || "",
                    score: `${m?.result?.home ?? 0}-${m?.result?.away ?? 0}`,
                    goal,
                    totalGoals,
                    save,
                    wide,
                    post,
                    suspension,
                    sevenGoal,
                    sevenMiss,
                    gkScored,
                    attempts,
                    shotPct
                  };
                })
                .filter((r) => {
                  const hasAny =
                    r.goal || r.save || r.wide || r.post || r.suspension || r.sevenGoal || r.sevenMiss || r.gkScored;
                  if (hasAny) return true;

                  const roster = Array.isArray(r.match?.playerRoster) ? r.match.playerRoster : [];
                  return roster.some((p) => {
                    const nr = normKey(p?.nr);
                    const name = normKey(p?.name);
                    return (playerNr && nr === normKey(playerNr)) || (playerName && name === normKey(playerName));
                  });
                })
                .sort((a, b) => String(a.date).localeCompare(String(b.date), "sv"));

              const totals = playerMatchRows.reduce(
                (acc, r) => {
                  acc.matches += 1;
                  acc.goal += r.goal;
                  acc.totalGoals += r.totalGoals;
                  acc.save += r.save;
                  acc.wide += r.wide;
                  acc.post += r.post;
                  acc.suspension += r.suspension;
                  acc.sevenGoal += r.sevenGoal;
                  acc.sevenMiss += r.sevenMiss;
                  acc.gkScored += r.gkScored;
                  acc.attempts += r.attempts;
                  return acc;
                },
                {
                  matches: 0,
                  goal: 0,
                  totalGoals: 0,
                  save: 0,
                  wide: 0,
                  post: 0,
                  suspension: 0,
                  sevenGoal: 0,
                  sevenMiss: 0,
                  gkScored: 0,
                  attempts: 0
                }
              );

              const shotPct = totals.attempts > 0 ? Math.round((totals.totalGoals / totals.attempts) * 100) : 0;
              const gkDenom = totals.save + totals.goal;
              const gkPct = gkDenom > 0 ? Math.round((totals.save / gkDenom) * 100) : 0;

              return (
                <div className="mt-4 space-y-4">
                  <div className="bg-slate-50 rounded-xl p-3 text-sm">
                    <div>
                      Matcher: <strong>{totals.matches}</strong>
                    </div>

                    {isGk ? (
                      <>
                        <div>
                          Rädd: <strong>{totals.save}</strong>
                        </div>
                        <div>
                          Insläppt: <strong>{totals.goal}</strong>
                        </div>
                        <div>
                          Rädd%: <strong>{gkPct}%</strong>
                        </div>
                        <div>
                          Utvisningar: <strong>{totals.suspension}</strong>
                        </div>
                        <div>
                          7m mål: <strong>{totals.sevenGoal}</strong> • 7m miss: <strong>{totals.sevenMiss}</strong>
                        </div>
                        <div>
                          GK mål: <strong>{totals.gkScored}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          Mål (inkl 7m): <strong>{totals.totalGoals}</strong>
                        </div>
                        <div>
                          Avslut: <strong>{totals.attempts}</strong> • Skott%: <strong>{shotPct}%</strong>
                        </div>
                        <div>
                          Rädd: <strong>{totals.save}</strong> • Utanför: <strong>{totals.wide}</strong> • Stolpe: <strong>{totals.post}</strong>
                        </div>
                        <div>
                          7m mål: <strong>{totals.sevenGoal}</strong> • 7m miss: <strong>{totals.sevenMiss}</strong>
                        </div>
                        <div>
                          Utvisningar: <strong>{totals.suspension}</strong>
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-semibold mb-2">Per match (klicka för matchdetalj)</div>
                    <div className="overflow-auto relative">
                      <table className="w-full text-sm border">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left p-2 border">Datum</th>
                            <th className="text-left p-2 border">Motståndare</th>
                            <th className="text-left p-2 border">H/B</th>
                            <th className="text-right p-2 border">Resultat</th>
                            {isGk ? (
                              <>
                                <th className="text-right p-2 border">Rädd</th>
                                <th className="text-right p-2 border">Insläppt</th>
                                <th className="text-right p-2 border">Rädd%</th>
                                <th className="text-right p-2 border">Utvisn</th>
                                <th className="text-right p-2 border">7m mål</th>
                                <th className="text-right p-2 border">7m miss</th>
                                <th className="text-right p-2 border">GK mål</th>
                              </>
                            ) : (
                              <>
                                <th className="text-right p-2 border">Mål</th>
                                <th className="text-right p-2 border">Rädd</th>
                                <th className="text-right p-2 border">Utanför</th>
                                <th className="text-right p-2 border">Stolpe</th>
                                <th className="text-right p-2 border">7m mål</th>
                                <th className="text-right p-2 border">7m miss</th>
                                <th className="text-right p-2 border">Utvisn</th>
                                <th className="text-right p-2 border">Avslut</th>
                                <th className="text-right p-2 border">Skott%</th>
                              </>
                            )}
                            <th className="text-right p-2 border sticky right-0 bg-slate-50">Stat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerMatchRows.map((r) => {
                            const m = r.match;
                            const gkDen = r.save + r.goal;
                            const gkP = gkDen > 0 ? Math.round((r.save / gkDen) * 100) : 0;
                            return (
                          <tr
                            key={m.id}
                            onClick={() => {
                              // Flow A: open full match (all players)
                              setSeasonPlayerDetail(null);
                              setSeasonMatchPlayerFocus(null);
                              setSeasonMatchDetail(m);
                            }}
                            className="cursor-pointer hover:bg-slate-50"
                          >
                                <td className="p-2 border">{r.date || "-"}</td>
                                <td className="p-2 border">{r.opponent || "-"}</td>
                                <td className="p-2 border">{r.location || "-"}</td>
                                <td className="p-2 border text-right">{r.score}</td>

                                {isGk ? (
                                  <>
                                    <td className="p-2 border text-right">{r.save}</td>
                                    <td className="p-2 border text-right">{r.goal}</td>
                                    <td className="p-2 border text-right">{gkP}%</td>
                                    <td className="p-2 border text-right">{r.suspension}</td>
                                    <td className="p-2 border text-right">{r.sevenGoal}</td>
                                    <td className="p-2 border text-right">{r.sevenMiss}</td>
                                    <td className="p-2 border text-right">{r.gkScored}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2 border text-right">{r.totalGoals}</td>
                                    <td className="p-2 border text-right">{r.save}</td>
                                    <td className="p-2 border text-right">{r.wide}</td>
                                    <td className="p-2 border text-right">{r.post}</td>
                                    <td className="p-2 border text-right">{r.sevenGoal}</td>
                                    <td className="p-2 border text-right">{r.sevenMiss}</td>
                                    <td className="p-2 border text-right">{r.suspension}</td>
                                    <td className="p-2 border text-right">{r.attempts}</td>
                                    <td className="p-2 border text-right">{r.shotPct}%</td>
                                  </>
                                )}
                                <td className="p-2 border text-right min-w-[72px] sticky right-0 bg-white">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Open same match directly in player focus
                                      setSeasonPlayerDetail(null);
                                      setSeasonMatchPlayerFocus({
                                        nr: seasonPlayerDetail?.nr,
                                        name: seasonPlayerDetail?.name,
                                        type: seasonPlayerDetail?.type
                                      });
                                      setSeasonMatchDetail(m);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold w-full"
                                    title="Visa spelarens matchstatistik"
                                    aria-label="Visa spelarens matchstatistik"
                                  >
                                    Stat
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {seasonMatchDetail && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setSeasonMatchDetail(null);
              setSeasonMatchPlayerFocus(null);
            }}
            aria-label="Stäng"
          />
          <div className="relative bg-white w-full max-w-4xl rounded-2xl border shadow-2xl p-4 max-h-[85vh] overflow-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Match</div>
                <div className="text-lg font-extrabold truncate">
                  {seasonMatchDetail?.matchInfo?.date || "-"} • {seasonMatchDetail?.matchInfo?.location || "-"} • {seasonMatchDetail?.matchInfo?.opponent || "Okänd motståndare"}
                </div>
                <div className="text-sm text-slate-700 mt-1">
                  Resultat: {seasonMatchDetail?.result?.home ?? 0} – {seasonMatchDetail?.result?.away ?? 0}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSeasonMatchDetail(null);
                  setSeasonMatchPlayerFocus(null);
                }}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
              >
                Stäng
              </button>
            </div>

            {(() => {
              const roster = Array.isArray(seasonMatchDetail?.playerRoster)
                ? seasonMatchDetail.playerRoster
                : [];
              const statsMap = seasonMatchDetail?.stats || {};

              const toN = (v) => {
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
              };

              const normKey = (v) => String(v ?? "").toLowerCase().trim();

              // Build a set of known goalkeepers.
              // 1) Prefer team lineup (selectedTeam) since it is the authoritative roster used in MatchView/export.
              // 2) Fallback to seasonSummary.goalkeepers.
              const knownGkKeys = new Set();

              const addGk = (nr, name) => {
                const key = `${normKey(nr)}|${normKey(name)}`;
                if (key !== "|" && key !== "") knownGkKeys.add(key);
              };

              // From team data: common shapes
              const teamGks =
                selectedTeam?.goalkeepers ||
                selectedTeam?.keepers ||
                selectedTeam?.gks ||
                [];

              if (Array.isArray(teamGks)) {
                teamGks.forEach((g) => addGk(g?.nr, g?.name));
              }

              // Also support a single unified players list where GK is marked by position/isGoalkeeper
              const teamPlayers =
                selectedTeam?.players ||
                selectedTeam?.roster ||
                selectedTeam?.playerRoster ||
                [];

              if (Array.isArray(teamPlayers)) {
                teamPlayers.forEach((p) => {
                  const pos = String(p?.position || "").toUpperCase();
                  const isGK = pos === "GK" || pos === "G" || p?.isGoalkeeper === true;
                  if (isGK) addGk(p?.nr, p?.name);
                });
              }

              // Fallback: whatever season has learned as goalkeepers
              (seasonSummary?.goalkeepers || []).forEach((g) => addGk(g?.nr, g?.name));

              const isGkByRoster = (p) => {
                const pos = String(p?.position || "").toUpperCase();
                return pos === "GK" || pos === "G" || p?.isGoalkeeper === true;
              };

              const isKnownGk = (p) => {
                const key = `${normKey(p?.nr)}|${normKey(p?.name)}`;
                return knownGkKeys.has(key);
              };

              const isGoalkeeperForMatch = (p) => isGkByRoster(p) || isKnownGk(p);

              // Helper to find the correct stats object for a player
              const getPlayerStats = (p) => {
                if (!p) return {};

                // Common identifiers
                const id = p.id;
                const idStr = id != null ? String(id) : "";
                const nrStr = p.nr != null ? String(p.nr) : "";
                const nameStr = (p.name || "").trim();

                // If statsMap is an array of entries, try to find a matching entry.
                if (Array.isArray(statsMap)) {
                  const hit =
                    statsMap.find((x) => String(x?.id ?? "") === idStr) ||
                    statsMap.find((x) => String(x?.playerId ?? "") === idStr) ||
                    (nrStr ? statsMap.find((x) => String(x?.nr ?? "") === nrStr) : null) ||
                    (nameStr ? statsMap.find((x) => String(x?.name ?? "").trim() === nameStr) : null);
                  return hit?.stats || hit || {};
                }

                // If statsMap is an object, try multiple key variants.
                const obj = statsMap || {};
                return (
                  obj[id] ||
                  (idStr ? obj[idStr] : null) ||
                  (nrStr ? obj[nrStr] : null) ||
                  (nameStr ? obj[nameStr] : null) ||
                  // Some shapes may nest under `players`
                  (obj.players && (obj.players[id] || (idStr ? obj.players[idStr] : null))) ||
                  {}
                );
              };

              const rows = roster.map((p) => {
                const s = getPlayerStats(p);

                const goals = toN(s.goal);
                const saves = toN(s.save);
                const wide = toN(s.wide);
                const post = toN(s.post);
                const suspension = toN(s.suspension);
                const sevenGoal = toN(s.sevenGoal);
                const sevenMiss = toN(s.sevenMiss);
                const gkScored = toN(s.gkScored);

                // Avslut-definition (utespelare): mål + rädd + utanför + stolpe + 7m mål + 7m miss
                const attempts = goals + saves + wide + post + sevenGoal + sevenMiss;
                // Totala mål för utespelare inkluderar 7m-mål
                const totalGoals = goals + sevenGoal;

                const isGoalkeeper = isGoalkeeperForMatch(p);

                return {
                  id: p?.id,
                  nr: p?.nr ?? "",
                  name: p?.name ?? "",
                  position: p?.position,
                  goals,
                  totalGoals,
                  saves,
                  wide,
                  post,
                  suspension,
                  sevenGoal,
                  sevenMiss,
                  gkScored,
                  attempts,
                  isGoalkeeper
                };
              });

              // --- PLAYER FOCUS LOGIC ---
              const focus = seasonMatchPlayerFocus;
              const focusKey = focus ? `${normKey(focus.nr)}|${normKey(focus.name)}` : null;

              const matchFocusRow = focus
                ? rows.find((r) => `${normKey(r.nr)}|${normKey(r.name)}` === focusKey)
                : null;

              if (focus && matchFocusRow) {
                const r = matchFocusRow;
                const isGK = r.isGoalkeeper;
                const gkDen = r.saves + r.goals;
                const gkPct = gkDen > 0 ? Math.round((r.saves / gkDen) * 100) : 0;
                const fpPct = r.attempts > 0 ? Math.round((r.totalGoals / r.attempts) * 100) : 0;

                return (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Spelare – match</div>
                      <button
                        type="button"
                        onClick={() => setSeasonMatchPlayerFocus(null)}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold"
                      >
                        Visa alla
                      </button>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 text-sm">
                      <div className="font-semibold">#{r.nr} {r.name}{isGK ? " (Målvakt)" : ""}</div>

                      {isGK ? (
                        <div className="mt-3 overflow-auto">
                          <table className="w-full text-sm border bg-white">
                            <tbody>
                              <tr>
                                <td className="p-2 border">Rädd</td>
                                <td className="p-2 border text-right"><strong>{r.saves}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Insläppt</td>
                                <td className="p-2 border text-right"><strong>{r.goals}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Rädd%</td>
                                <td className="p-2 border text-right"><strong>{gkPct}%</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Utvisningar</td>
                                <td className="p-2 border text-right"><strong>{r.suspension}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">7m mål</td>
                                <td className="p-2 border text-right"><strong>{r.sevenGoal}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">7m miss</td>
                                <td className="p-2 border text-right"><strong>{r.sevenMiss}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">GK mål</td>
                                <td className="p-2 border text-right"><strong>{r.gkScored}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Utanför</td>
                                <td className="p-2 border text-right"><strong>{r.wide}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Stolpe</td>
                                <td className="p-2 border text-right"><strong>{r.post}</strong></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="mt-3 overflow-auto">
                          <table className="w-full text-sm border bg-white">
                            <tbody>
                              <tr>
                                <td className="p-2 border">Mål (spel)</td>
                                <td className="p-2 border text-right"><strong>{r.goals}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">7m mål</td>
                                <td className="p-2 border text-right"><strong>{r.sevenGoal}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">7m miss</td>
                                <td className="p-2 border text-right"><strong>{r.sevenMiss}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Totala mål</td>
                                <td className="p-2 border text-right"><strong>{r.totalGoals}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Avslut</td>
                                <td className="p-2 border text-right"><strong>{r.attempts}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Skott%</td>
                                <td className="p-2 border text-right"><strong>{fpPct}%</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Rädd (skott räddat)</td>
                                <td className="p-2 border text-right"><strong>{r.saves}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Utanför</td>
                                <td className="p-2 border text-right"><strong>{r.wide}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Stolpe</td>
                                <td className="p-2 border text-right"><strong>{r.post}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Utvisningar</td>
                                <td className="p-2 border text-right"><strong>{r.suspension}</strong></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // --- END PLAYER FOCUS LOGIC ---

              const gks = rows
                .filter((r) => r.isGoalkeeper)
                .map((r) => {
                  const denom = r.saves + r.goals; // goals = insläppta för målvakt
                  const pct = denom > 0 ? Math.round((r.saves / denom) * 100) : 0;
                  return {
                    ...r,
                    gkSaves: r.saves,
                    gkConceded: r.goals,
                    gkPct: pct
                  };
                })
                .sort((a, b) => b.gkSaves - a.gkSaves || b.gkPct - a.gkPct);

              const fps = rows
                .filter((r) => !r.isGoalkeeper)
                .map((r) => {
                  const pct = r.attempts > 0 ? Math.round((r.totalGoals / r.attempts) * 100) : 0;
                  const sevenAtt = r.sevenGoal + r.sevenMiss;
                  return { ...r, shotPct: pct, sevenAtt };
                })
                .sort((a, b) =>
                  b.totalGoals - a.totalGoals ||
                  b.attempts - a.attempts ||
                  String(a.nr).localeCompare(String(b.nr), "sv") ||
                  String(a.name).localeCompare(String(b.name), "sv")
                );

              return (
                <div className="mt-4 space-y-5">
                  {gks.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold mb-2">Målvakter – match (alla stats)</div>
                      <div className="overflow-auto">
                        <table className="w-full text-sm border">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left p-2 border">#</th>
                              <th className="text-left p-2 border">Målvakt</th>
                              <th className="text-right p-2 border">Rädd</th>
                              <th className="text-right p-2 border">Insläppt</th>
                              <th className="text-right p-2 border">Rädd%</th>
                              <th className="text-right p-2 border">Utvisn</th>
                              <th className="text-right p-2 border">7m mål</th>
                              <th className="text-right p-2 border">7m miss</th>
                              <th className="text-right p-2 border">GK mål</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gks.map((r) => (
                              <tr
                                key={r.id || r.name}
                                onClick={() => setSeasonMatchPlayerFocus({ nr: r.nr, name: r.name, type: "gk" })}
                                className="cursor-pointer hover:bg-slate-50"
                              >
                                <td className="p-2 border">{r.nr}</td>
                                <td className="p-2 border">{r.name}</td>
                                <td className="p-2 border text-right">{r.gkSaves}</td>
                                <td className="p-2 border text-right">{r.gkConceded}</td>
                                <td className="p-2 border text-right">{r.gkPct}%</td>
                                <td className="p-2 border text-right">{r.suspension}</td>
                                <td className="p-2 border text-right">{r.sevenGoal}</td>
                                <td className="p-2 border text-right">{r.sevenMiss}</td>
                                <td className="p-2 border text-right">{r.gkScored}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-sm font-semibold mb-2">Utespelare – match (alla stats)</div>
                    <div className="overflow-auto">
                      <table className="w-full text-sm border">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left p-2 border">#</th>
                            <th className="text-left p-2 border">Spelare</th>
                            <th className="text-right p-2 border">Mål</th>
                            <th className="text-right p-2 border">Rädd</th>
                            <th className="text-right p-2 border">Utanför</th>
                            <th className="text-right p-2 border">Stolpe</th>
                            <th className="text-right p-2 border">7m mål</th>
                            <th className="text-right p-2 border">7m miss</th>
                            <th className="text-right p-2 border">Utvisn</th>
                            <th className="text-right p-2 border">Avslut</th>
                            <th className="text-right p-2 border">Skott%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fps.map((r) => (
                            <tr
                              key={r.id || r.name}
                              onClick={() => setSeasonMatchPlayerFocus({ nr: r.nr, name: r.name, type: "fp" })}
                              className="cursor-pointer hover:bg-slate-50"
                            >
                              <td className="p-2 border">{r.nr}</td>
                              <td className="p-2 border">{r.name}</td>
                              <td className="p-2 border text-right">{r.totalGoals}</td>
                              <td className="p-2 border text-right">{r.saves}</td>
                              <td className="p-2 border text-right">{r.wide}</td>
                              <td className="p-2 border text-right">{r.post}</td>
                              <td className="p-2 border text-right">{r.sevenGoal}</td>
                              <td className="p-2 border text-right">{r.sevenMiss}</td>
                              <td className="p-2 border text-right">{r.suspension}</td>
                              <td className="p-2 border text-right">{r.attempts}</td>
                              <td className="p-2 border text-right">{r.shotPct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {seasonDangerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSeasonDangerOpen(false)}
            aria-label="Stäng"
          />
          <div className="relative bg-white w-full max-w-lg rounded-2xl border shadow-2xl p-4">
            <div className="text-lg font-extrabold text-red-700">Rensa säsong</div>
            <div className="mt-2 text-sm text-slate-700">
              Detta tar bort alla sparade matcher för denna säsong (för valt lag). Det går inte att ångra.
            </div>

            <div className="mt-3 text-sm font-semibold">
              Skriv <span className="font-mono">RADERA</span> för att bekräfta
            </div>
            <input
              type="text"
              value={seasonDangerText}
              onChange={(e) => setSeasonDangerText(e.target.value)}
              placeholder="RADERA"
              className="mt-2 w-full border rounded-xl px-3 py-2"
            />

            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSeasonDangerOpen(false)}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-semibold"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={seasonDangerText.trim().toUpperCase() !== "RADERA"}
                onClick={() => {
                  onClearSeason();
                  setSeasonDangerOpen(false);
                }}
                className={`px-3 py-2 rounded-xl font-semibold text-white ${
                  seasonDangerText.trim().toUpperCase() === "RADERA"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-red-300 cursor-not-allowed"
                }`}
              >
                Rensa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
