import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useDocumentScrollLock } from "../hooks/useDocumentScrollLock";

const STATUS_LABELS = {
  pending: "Väntar",
  approved: "Godkänd",
  blocked: "Blockerad"
};

export default function SystemAdminPanel({ open, currentUser, onClose, onToast, onChanged }) {
  useDocumentScrollLock(open);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingUserId, setSavingUserId] = useState(null);

  const loadUsers = useCallback(async () => {
    if (!open || !supabase) return;

    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase.rpc("list_system_users");

    if (queryError) {
      setError(queryError.message);
      setUsers([]);
      setLoading(false);
      return;
    }

    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [open]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  if (!open) return null;

  const updateUser = async (user, changes) => {
    const nextStatus = changes.account_status ?? user.account_status;
    const nextLimit = Number(changes.team_create_limit ?? user.team_create_limit ?? 0);

    setSavingUserId(user.user_id);
    setError("");

    const { error: mutationError } = await supabase.rpc("update_system_user_access", {
      target_user_id: user.user_id,
      new_account_status: nextStatus,
      new_team_create_limit: nextLimit
    });

    if (mutationError) {
      setError(mutationError.message);
      setSavingUserId(null);
      return;
    }

    onToast?.("Användaren uppdaterad");
    onChanged?.();
    await loadUsers();
    setSavingUserId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overscroll-contain overflow-y-auto bg-slate-900/50 p-3 sm:p-6">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Systemadmin</div>
            <h2 className="text-xl font-extrabold text-slate-900">Användaråtkomst</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Stäng
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-600">
              Hämtar användare...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Användare</th>
                    <th className="px-3 py-2">Klubb/förening</th>
                    <th className="px-3 py-2">Roll/funktion</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Laggräns</th>
                    <th className="px-3 py-2">Skapade lag</th>
                    <th className="px-3 py-2">Systemadmin</th>
                    <th className="px-3 py-2 text-right">Åtgärd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {users.map((user) => {
                    const isSaving = savingUserId === user.user_id;
                    const isCurrentUser = currentUser?.id === user.user_id;
                    return (
                      <tr key={user.user_id}>
                        <td className="min-w-[16rem] px-3 py-3">
                          <div className="font-semibold text-slate-900">{user.display_name || "Namnlös"}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </td>
                        <td className="min-w-[11rem] px-3 py-3 text-slate-700">
                          {user.club_name || "-"}
                        </td>
                        <td className="min-w-[10rem] px-3 py-3 text-slate-700">
                          {user.organization_role || "-"}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={user.account_status || "pending"}
                            disabled={isSaving || isCurrentUser}
                            onChange={(event) => updateUser(user, { account_status: event.target.value })}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                          >
                            <option value="pending">Väntar</option>
                            <option value="approved">Godkänd</option>
                            {!isCurrentUser && <option value="blocked">Blockerad</option>}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            max="999"
                            defaultValue={Number(user.team_create_limit || 0)}
                            disabled={isSaving}
                            onBlur={(event) => {
                              const nextLimit = Number(event.target.value || 0);
                              if (nextLimit !== Number(user.team_create_limit || 0)) {
                                updateUser(user, { team_create_limit: nextLimit });
                              }
                            }}
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-3 text-slate-700">{Number(user.created_team_count || 0)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                            user.is_system_admin ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {user.is_system_admin ? "Ja" : "Nej"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-xs font-semibold text-slate-500">
                            {isSaving
                              ? "Sparar..."
                              : isCurrentUser
                                ? "Du"
                                : STATUS_LABELS[user.account_status] || "Väntar"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {users.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-sm text-slate-500" colSpan={8}>
                        Inga användare hittades.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
