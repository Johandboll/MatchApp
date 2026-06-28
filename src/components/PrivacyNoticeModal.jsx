import React from "react";

export const PRIVACY_NOTICE_VERSION = "2026-06-25";

export default function PrivacyNoticeModal({ open, onClose, requireAcknowledge = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
      <div className="mx-auto my-4 max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Integritet
          </div>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">
            Integritet och personuppgifter i MatchApp
          </h2>
        </div>

        <div className="space-y-5 px-5 py-4 text-sm leading-6 text-slate-700">
          <p>
            MatchApp används för att registrera och följa upp handbollsmatcher, lag och
            spelarstatistik. Eftersom appen innehåller namn, lag, matcher och statistik
            innebär det att personuppgifter behandlas.
          </p>

          <section>
            <h3 className="mb-2 text-base font-bold text-slate-900">Vilka uppgifter kan sparas?</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>spelarens namn</li>
              <li>lag och spelartrupp</li>
              <li>matchdatum, motståndare och resultat</li>
              <li>matchhändelser och statistik</li>
              <li>användarkonto för ledare/admin</li>
            </ul>
            <p className="mt-2">
              Appen ska inte användas för att spara känsliga personuppgifter, till exempel
              hälsa, personnummer, kontaktuppgifter eller privata anteckningar om spelare.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-bold text-slate-900">Varför sparas uppgifterna?</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>föra matchstatistik</li>
              <li>följa upp matcher och säsonger</li>
              <li>analysera lagets och spelarnas utveckling</li>
              <li>administrera spelartrupp och matcher</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-base font-bold text-slate-900">Vem kan se uppgifterna?</h3>
            <p>
              Uppgifter i MatchApp ska endast vara tillgängliga för behöriga personer, till
              exempel ledare, tränare eller administratörer kopplade till laget.
            </p>
            <p className="mt-2">
              Användare ska inte dela inloggning eller ge obehöriga tillgång till appen.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-bold text-slate-900">Ansvar vid användning</h3>
            <p>
              Den som använder MatchApp ansvarar för att bara lägga in uppgifter som behövs
              för lagets match- och statistikhantering. Skriv inte in information som inte
              behövs för appens syfte.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-bold text-slate-900">Lagring och radering</h3>
            <p>
              Matchdata och spelaruppgifter sparas så länge de behövs för lagets verksamhet
              och uppföljning. Om en uppgift är felaktig eller behöver tas bort ska lagets
              ansvariga administratör kontaktas.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-bold text-slate-900">Kontakt</h3>
            <p>
              Vid frågor om personuppgifter i MatchApp, kontakta lagets ansvariga administratör
              eller föreningens ansvariga person för laget.
            </p>
          </section>

          {requireAcknowledge && (
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
              Genom att fortsätta använda MatchApp bekräftar du att du har tagit del av
              informationen om hur personuppgifter hanteras i appen.
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700"
          >
            {requireAcknowledge ? "Jag har tagit del av informationen" : "Stäng"}
          </button>
        </div>
      </div>
    </div>
  );
}
