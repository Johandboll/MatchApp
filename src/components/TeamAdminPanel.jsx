import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const roleLabel = {
  owner: "Ägare",
  admin: "Admin",
  member: "Medlem"
};

export default function TeamAdminPanel({ open, team, currentUser, onClose, onToast, onPlayersChanged }) {
  const [tab, setTab] = useState("players");
  const [members, setMembers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [email, setEmail] = useState("");
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

  const addMember = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    setError("");

    const { data, error: mutationError } = await supabase.rpc("add_team_member_by_email", {
      target_team_id: team.onlineId,
      member_email: email,
      member_role: role
    });

    if (mutationError) {
      setError(mutationError.message);
      setBusy(false);
      return;
    }

    setMembers(data || []);
    setEmail("");
    setRole("member");
    setBusy(false);
    onToast?.("Medlem tillagd");
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
    if (!window.confirm(`Ta bort ${member.email} från ${team.name}?`)) return;

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
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Lagadmin</div>
            <h2 className="text-xl font-extrabold text-slate-900">{team?.name || "Lag"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Stäng
          </button>
        </div>

        <div className="border-b border-slate-200 px-4 pt-3">
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setTab("players")}
              className={`px-4 py-2 text-sm font-bold ${tab === "players" ? "bg-sky-600 text-white" : "bg-white text-slate-700"}`}
            >
              Spelare
            </button>
            <button
              type="button"
              onClick={() => setTab("members")}
              className={`px-4 py-2 text-sm font-bold ${tab === "members" ? "bg-sky-600 text-white" : "bg-white text-slate-700"}`}
            >
              Medlemmar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "members" && (
          <>
          <section className="mb-5">
            <h3 className="mb-2 text-base font-bold text-slate-900">Medlemmar</h3>

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

                  return (
                    <div
                      key={member.user_id}
                      className="flex flex-col gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {member.email}
                        </div>
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
                          disabled={busy || isOwner}
                          onChange={(event) => changeRole(member, event.target.value)}
                          className="rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
                        >
                          <option value="owner">Ägare</option>
                          <option value="admin">Admin</option>
                          <option value="member">Medlem</option>
                        </select>
                        <button
                          type="button"
                          disabled={busy || isOwner || isCurrentUser}
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
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="E-postadress"
                className="rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                required
              />
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-base"
              >
                <option value="member">Medlem</option>
                <option value="admin">Admin</option>
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
                <h3 className="mb-2 text-base font-bold text-slate-900">Spelare</h3>

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
                        className={`flex flex-col gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center ${player.active ? "bg-white" : "bg-slate-50"}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-semibold ${player.active ? "text-slate-900" : "text-slate-500"}`}>
                            #{Number(player.shirt_number)} {player.name}
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

              <section>
                <h3 className="mb-2 text-base font-bold text-slate-900">
                  {playerForm.id ? "Ändra spelare" : "Lägg till spelare"}
                </h3>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
