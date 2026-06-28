import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const roleLabel = {
  owner: "Ägare",
  admin: "Admin",
  member: "Medlem"
};

const normalizeNameKey = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const playerShirtNumber = (player) => {
  const number = Number(player?.shirtNumber ?? player?.nr ?? player?.shirt_number);
  return Number.isFinite(number) ? number : "";
};

export default function TeamAdminPanel({
  open,
  team,
  currentUser,
  onClose,
  onToast,
  onPlayersChanged,
  onConfirm,
  matches = [],
  currentUserRole,
  onOpenPrivacyNotice
}) {
  const [tab, setTab] = useState("players");
  const [members, setMembers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [email, setEmail] = useState("");
  const [memberCandidates, setMemberCandidates] = useState([]);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [role, setRole] = useState("member");
  const [playerForm, setPlayerForm] = useState({
    id: null,
    shirtNumber: "",
    name: "",
    role: "field"
  });
  const [loading, setLoading] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playerError, setPlayerError] = useState("");
  const isCurrentUserOwner = currentUserRole === "owner";

  const canLoad = open && supabase && team?.onlineId;

  const loadMembers = useCallback(async () => {
    if (!canLoad) return;

    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase.rpc("list_team_members", {
      target_team_id: team.onlineId
    });

    if (queryError) {
      setError(queryError.message);
      setMembers([]);
      setLoading(false);
      return;
    }

    setMembers(data || []);
    setLoading(false);
  }, [canLoad, team]);

  const loadPlayers = useCallback(async () => {
    if (!canLoad) return;

    setPlayersLoading(true);
    setPlayerError("");

    const { data, error: queryError } = await supabase.rpc("list_team_players", {
      target_team_id: team.onlineId
    });

    if (queryError) {
      setPlayerError(queryError.message);
      setPlayers([]);
      setPlayersLoading(false);
      return;
    }

    setPlayers(data || []);
    setPlayersLoading(false);
  }, [canLoad, team]);

  useEffect(() => {
    if (!open) return;
    setTab("players");
    loadMembers();
    loadPlayers();
  }, [loadMembers, loadPlayers, open]);

  useEffect(() => {
    if (!canLoad || tab !== "members") return;

    const searchText = email.trim();
    if (selectedCandidate?.email === searchText || searchText.length < 2) {
      setMemberCandidates([]);
      setMemberSearchLoading(false);
      return;
    }

    let cancelled = false;
    setMemberSearchLoading(true);

    const timer = window.setTimeout(async () => {
      const { data, error: queryError } = await supabase.rpc("search_team_member_candidates", {
        target_team_id: team.onlineId,
        search_text: searchText
      });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setMemberCandidates([]);
      } else {
        setMemberCandidates(data || []);
      }

      setMemberSearchLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canLoad, email, selectedCandidate, tab, team]);

  const addMember = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    setError("");

    const requestedRole = isCurrentUserOwner ? role : "member";

    const { data, error: mutationError } = await supabase.rpc("add_team_member_by_email", {
      target_team_id: team.onlineId,
      member_email: email,
      member_role: requestedRole
    });

    if (mutationError) {
      setError(mutationError.message);
      setBusy(false);
      return;
    }

    setMembers(data || []);
    setEmail("");
    setMemberCandidates([]);
    setSelectedCandidate(null);
    setRole("member");
    setBusy(false);
    onToast?.("Medlem tillagd");
  };

  const updateMemberSearch = (value) => {
    setEmail(value);
    setSelectedCandidate(null);
  };

  const chooseCandidate = (candidate) => {
    if (candidate.existing_role) return;

    setEmail(candidate.email);
    setSelectedCandidate(candidate);
    setMemberCandidates([]);
  };

  const changeRole = async (member, nextRole) => {
    setBusy(true);
    setError("");

    const { data, error: mutationError } = await supabase.rpc("update_team_member_role", {
      target_team_id: team.onlineId,
      target_user_id: member.user_id,
      member_role: nextRole
    });

    if (mutationError) {
      setError(mutationError.message);
      setBusy(false);
      return;
    }

    setMembers(data || []);
    setBusy(false);
    onToast?.("Roll uppdaterad");
  };

  const removeMember = async (member) => {
    onConfirm?.({
      title: "Ta bort medlem?",
      message: `${member.email} tas bort från ${team.name}.`,
      confirmText: "Ta bort",
      cancelText: "Avbryt",
      variant: "danger",
      onConfirm: () => removeMemberConfirmed(member)
    });
  };

  const removeMemberConfirmed = async (member) => {
    setBusy(true);
    setError("");

    const { data, error: mutationError } = await supabase.rpc("remove_team_member", {
      target_team_id: team.onlineId,
      target_user_id: member.user_id
    });

    if (mutationError) {
      setError(mutationError.message);
      setBusy(false);
      return;
    }

    setMembers(data || []);
    setBusy(false);
    onToast?.("Medlem borttagen");
  };

  const resetPlayerForm = () => {
    setPlayerForm({ id: null, shirtNumber: "", name: "", role: "field" });
  };

  const playersFromMatches = useMemo(() => {
    const existingNames = new Set((players || []).map((player) => normalizeNameKey(player.name)));
    const candidates = new Map();

    (matches || []).forEach((match) => {
      (match.playerRoster || []).forEach((player) => {
        const name = String(player?.name || "").trim();
        const key = normalizeNameKey(name);
        if (!key || existingNames.has(key)) return;

        const shirtNumber = playerShirtNumber(player);
        const current = candidates.get(key);
        if (!current) {
          candidates.set(key, {
            name,
            shirtNumber,
            role: player.role === "goalkeeper" ? "goalkeeper" : "field",
            appearances: 1
          });
          return;
        }

        current.appearances += 1;
        if (!current.shirtNumber && shirtNumber) current.shirtNumber = shirtNumber;
        if (player.role === "goalkeeper") current.role = "goalkeeper";
      });
    });

    const sorted = [...candidates.values()].sort((left, right) => {
      const leftNumber = Number(left.shirtNumber);
      const rightNumber = Number(right.shirtNumber);
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      return left.name.localeCompare(right.name, "sv");
    });

    const ready = [];
    const conflicts = [];
    sorted.forEach((player) => {
      const numberKey = String(player.shirtNumber);
      const validNumber = numberKey && Number.isFinite(Number(player.shirtNumber));
      if (!validNumber) {
        conflicts.push({ ...player, reason: "saknar nummer" });
      } else {
        ready.push(player);
      }
    });

    return { ready, conflicts };
  }, [matches, players]);

  const missingPlayersFromMatches = playersFromMatches.ready;
  const blockedPlayersFromMatches = playersFromMatches.conflicts;

  const addMissingPlayersFromMatches = async () => {
    if (missingPlayersFromMatches.length === 0) {
      onToast?.("Inga saknade spelare hittades");
      return;
    }

    setBusy(true);
    setPlayerError("");

    let latestPlayers = players;
    for (const player of missingPlayersFromMatches) {
      const { data, error: mutationError } = await supabase.rpc("upsert_team_player", {
        target_team_id: team.onlineId,
        player_id: null,
        new_shirt_number: Number(player.shirtNumber),
        player_name: player.name,
        player_role: player.role
      });

      if (mutationError) {
        setPlayerError(mutationError.message);
        setBusy(false);
        return;
      }

      latestPlayers = data || latestPlayers;
    }

    setPlayers(latestPlayers || []);
    onPlayersChanged?.(latestPlayers || []);
    setBusy(false);
    onToast?.(`Lade till ${missingPlayersFromMatches.length} spelare från matcherna`);
  };

  const editPlayer = (player) => {
    setPlayerForm({
      id: player.id,
      shirtNumber: String(player.shirt_number),
      name: player.name,
      role: player.role || "field"
    });
  };

  const savePlayer = async (event) => {
    event.preventDefault();
    setBusy(true);
    setPlayerError("");

    const { data, error: mutationError } = await supabase.rpc("upsert_team_player", {
      target_team_id: team.onlineId,
      player_id: playerForm.id,
      new_shirt_number: Number(playerForm.shirtNumber),
      player_name: playerForm.name,
      player_role: playerForm.role
    });

    if (mutationError) {
      setPlayerError(mutationError.message);
      setBusy(false);
      return;
    }

    setPlayers(data || []);
    onPlayersChanged?.(data || []);
    resetPlayerForm();
    setBusy(false);
    onToast?.("Spelare sparad");
  };

  const setPlayerActive = async (player, active) => {
    setBusy(true);
    setPlayerError("");

    const { data, error: mutationError } = await supabase.rpc("set_team_player_active", {
      target_team_id: team.onlineId,
      player_id: player.id,
      is_active: active
    });

    if (mutationError) {
      setPlayerError(mutationError.message);
      setBusy(false);
      return;
    }

    setPlayers(data || []);
    onPlayersChanged?.(data || []);
    setBusy(false);
    onToast?.(active ? "Spelare aktiverad" : "Spelare inaktiverad");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 p-3 sm:p-6">
      <div className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Lagadmin</div>
            <h2 className="text-xl font-extrabold text-slate-900">{team?.name || "Lag"}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenPrivacyNotice}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Integritet
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Stäng
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-4 pt-3">
          <div className="grid max-w-md grid-cols-2 overflow-hidden rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setTab("players")}
              className={`px-4 py-2 text-sm font-bold ${tab === "players" ? "bg-sky-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              Spelare
            </button>
            <button
              type="button"
              onClick={() => setTab("members")}
              className={`px-4 py-2 text-sm font-bold ${tab === "members" ? "bg-sky-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              Medlemmar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "members" && (
          <>
          <section className="mb-5">
            <div className="mb-3">
              <h3 className="text-lg font-extrabold text-slate-900">Medlemmar</h3>
            </div>

            {error && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200">
              {loading ? (
                <div className="px-3 py-4 text-sm text-slate-500">Hämtar medlemmar...</div>
              ) : members.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500">Inga medlemmar hittades.</div>
              ) : (
                members.map((member) => {
                  const isOwner = member.role === "owner";
                  const isCurrentUser = member.user_id === currentUser?.id;
                  const displayName = (member.display_name || "").trim();

                  return (
                    <div
                      key={member.user_id}
                      className="flex flex-col gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {displayName || member.email}
                        </div>
                        {displayName && (
                          <div className="mt-0.5 truncate text-xs text-slate-500">
                            {member.email}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {roleLabel[member.role] || member.role}
                          </span>
                          {isCurrentUser && (
                            <span className="text-xs font-medium text-slate-500">Du</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={member.role}
                          disabled={busy || isOwner || !isCurrentUserOwner}
                          onChange={(event) => changeRole(member, event.target.value)}
                          className="rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
                        >
                          {isOwner && <option value="owner">Ägare</option>}
                          <option value="admin">Admin</option>
                          <option value="member">Medlem</option>
                        </select>
                        <button
                          type="button"
                          disabled={busy || isOwner || isCurrentUser || !isCurrentUserOwner}
                          onClick={() => removeMember(member)}
                          className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Ta bort
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-base font-bold text-slate-900">Lägg till person</h3>
            <form onSubmit={addMember} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_150px_auto]">
              <div className="relative">
                <input
                  type="text"
                  value={email}
                  onChange={(event) => updateMemberSearch(event.target.value)}
                  placeholder="Sök namn eller e-postadress"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  required
                />
                {(memberSearchLoading || memberCandidates.length > 0) && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    {memberSearchLoading ? (
                      <div className="px-3 py-2 text-sm text-slate-500">Söker...</div>
                    ) : (
                      memberCandidates.map((candidate) => {
                        const name = (candidate.display_name || "").trim();
                        const alreadyMember = Boolean(candidate.existing_role);

                        return (
                          <button
                            key={candidate.user_id}
                            type="button"
                            disabled={alreadyMember}
                            onClick={() => chooseCandidate(candidate)}
                            className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-900">
                                {name || candidate.email}
                              </span>
                              {name && (
                                <span className="block truncate text-xs text-slate-500">
                                  {candidate.email}
                                </span>
                              )}
                            </span>
                            {alreadyMember && (
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                Redan medlem
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={!isCurrentUserOwner}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-base disabled:opacity-60"
              >
                <option value="member">Medlem</option>
                {isCurrentUserOwner && <option value="admin">Admin</option>}
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Lägg till
              </button>
            </form>
          </section>
          </>
          )}

          {tab === "players" && (
            <>
              <section className="mb-5">
                <div className="mb-3">
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {playerForm.id ? "Ändra spelare" : "Lägg till spelare"}
                  </h3>
                </div>
                <form onSubmit={savePlayer} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[120px_1fr_170px_auto]">
                  <input
                    type="number"
                    step="0.1"
                    value={playerForm.shirtNumber}
                    onChange={(event) =>
                      setPlayerForm((prev) => ({ ...prev, shirtNumber: event.target.value }))
                    }
                    placeholder="Nr"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    required
                  />
                  <input
                    type="text"
                    value={playerForm.name}
                    onChange={(event) =>
                      setPlayerForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Namn"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    required
                  />
                  <select
                    value={playerForm.role}
                    onChange={(event) =>
                      setPlayerForm((prev) => ({ ...prev, role: event.target.value }))
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-base"
                  >
                    <option value="field">Utespelare</option>
                    <option value="goalkeeper">Målvakt</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {playerForm.id ? "Spara" : "Lägg till"}
                    </button>
                    {playerForm.id && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={resetPlayerForm}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
                      >
                        Avbryt
                      </button>
                    )}
                  </div>
                </form>
              </section>

              {(missingPlayersFromMatches.length > 0 || blockedPlayersFromMatches.length > 0) && (
                <section className="mb-5 rounded-xl border border-sky-100 bg-sky-50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Spelare från importerade matcher
                      </h3>
                      <p className="text-sm text-slate-600">
                        Namn som finns i matcherna men saknas i truppen.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || playersLoading || missingPlayersFromMatches.length === 0}
                      onClick={addMissingPlayersFromMatches}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Lägg till {missingPlayersFromMatches.length}
                    </button>
                  </div>

                  {missingPlayersFromMatches.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {missingPlayersFromMatches.map((player) => (
                        <span
                          key={`${player.name}-${player.shirtNumber}`}
                          className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-sky-100"
                        >
                          #{player.shirtNumber} {player.name}
                          {player.role === "goalkeeper" ? " (MV)" : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {blockedPlayersFromMatches.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Behöver kollas manuellt:{" "}
                      {blockedPlayersFromMatches
                        .map((player) => `#${player.shirtNumber || "?"} ${player.name} (${player.reason})`)
                        .join(", ")}
                    </div>
                  )}
                </section>
              )}

              <section className="mb-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900">Trupp</h3>
                  <div className="text-sm font-semibold text-slate-500">
                    {players.filter((player) => player.active).length} aktiva
                  </div>
                </div>

                {playerError && (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {playerError}
                  </div>
                )}

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  {playersLoading ? (
                    <div className="px-3 py-4 text-sm text-slate-500">Hämtar spelare...</div>
                  ) : players.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500">Inga spelare tillagda ännu.</div>
                  ) : (
                    players.map((player) => (
                      <div
                        key={player.id}
                        className={`grid grid-cols-1 gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center ${player.active ? "bg-white" : "bg-slate-50"}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className={`flex items-center gap-2 text-sm font-semibold ${player.active ? "text-slate-900" : "text-slate-500"}`}>
                            <span className="inline-flex min-w-10 justify-center rounded-lg bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-700">
                              #{Number(player.shirt_number)}
                            </span>
                            <span className="truncate">{player.name}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              {player.role === "goalkeeper" ? "Målvakt" : "Utespelare"}
                            </span>
                            {!player.active && (
                              <span className="text-xs font-medium text-slate-500">Inaktiv</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => editPlayer(player)}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                          >
                            Ändra
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPlayerActive(player, !player.active)}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                          >
                            {player.active ? "Inaktivera" : "Aktivera"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
