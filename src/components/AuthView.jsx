import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthView({ appVersion }) {
  const [mode, setMode] = useState("signIn");
  const [displayName, setDisplayName] = useState("");
  const [clubName, setClubName] = useState("");
  const [organizationRole, setOrganizationRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const redirectTo = `${window.location.origin}${process.env.PUBLIC_URL || ""}`;

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    if (hash.get("type") === "recovery" || query.get("type") === "recovery") {
      setRecoveryMode(true);
      setMessage("Välj ett nytt lösenord.");
    }
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const cleanEmail = email.trim();
    const cleanDisplayName = displayName.trim();
    const cleanClubName = clubName.trim();
    const cleanOrganizationRole = organizationRole.trim();

    const { error } =
      mode === "signUp"
        ? await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              emailRedirectTo: redirectTo,
              data: {
                display_name: cleanDisplayName,
                club_name: cleanClubName,
                organization_role: cleanOrganizationRole
              }
            }
          })
        : await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password
          });

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setMessage(
      mode === "signUp"
        ? "Kontot är skapat. Kontrollera din e-post om Supabase kräver bekräftelse."
        : "Inloggad."
    );
    setBusy(false);
  };

  const resetPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setMessage("Fyll i din e-postadress först.");
      return;
    }

    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo
    });

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setMessage("Vi har skickat en länk för att återställa lösenordet.");
    setBusy(false);
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setMessage("Lösenordet är uppdaterat. Du kan fortsätta in i MatchApp.");
    setNewPassword("");
    setRecoveryMode(false);
    window.history.replaceState({}, "", redirectTo);
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">MatchApp</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
            {recoveryMode ? "Nytt lösenord" : "Logga in"}
          </h1>
        </div>

        {!recoveryMode && (
          <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMode("signIn");
                setMessage("");
              }}
              className={`px-3 py-2 text-sm font-semibold ${mode === "signIn" ? "bg-sky-600 text-white" : "bg-white text-slate-700"}`}
            >
              Logga in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signUp");
                setMessage("");
              }}
              className={`px-3 py-2 text-sm font-semibold ${mode === "signUp" ? "bg-sky-600 text-white" : "bg-white text-slate-700"}`}
            >
              Skapa konto
            </button>
          </div>
        )}

        {recoveryMode ? (
          <form onSubmit={updatePassword} className="space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Nytt lösenord</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            {message && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Vänta..." : "Spara nytt lösenord"}
            </button>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-3">
          {mode === "signUp" && (
            <>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Namn</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Klubb/förening</span>
                <input
                  type="text"
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                  autoComplete="organization"
                  required
                  placeholder="Ex. BK Heid"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Roll/funktion</span>
                <input
                  type="text"
                  value={organizationRole}
                  onChange={(event) => setOrganizationRole(event.target.value)}
                  autoComplete="organization-title"
                  required
                  placeholder="Ex. huvudtränare P18/P16/P14"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            </>
          )}

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">E-post</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </label>

          <label className="block">
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-700">Lösenord</span>
              {mode === "signIn" && (
                <button
                  type="button"
                  onClick={resetPassword}
                  disabled={busy}
                  className="text-sm font-semibold text-sky-700 hover:text-sky-800 disabled:opacity-60"
                >
                  Glömt lösenord?
                </button>
              )}
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              minLength={6}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </label>

          {message && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Vänta..." : mode === "signUp" ? "Skapa konto" : "Logga in"}
          </button>
          </form>
        )}

        <div className="mt-4 text-center text-xs text-slate-500">Version: {appVersion}</div>
      </div>
    </div>
  );
}
