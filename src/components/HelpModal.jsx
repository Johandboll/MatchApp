import React from "react";
import { useDocumentScrollLock } from "../hooks/useDocumentScrollLock";

const sections = [
  {
    title: "Starta och registrera en match",
    text: "Välj datum, motståndare, hemma eller borta och vilka spelare som deltar. Matchdatumet avgör automatiskt vilken säsong matchen tillhör."
  },
  {
    title: "Föra laget till en ny säsong",
    text: "Öppna Lag. När en ny säsong är tillgänglig visas Ny säsong. Kontrollera lagnamnet, välj spelarna som fortsätter och ändra tröjnummer eller roll vid behov. Tidigare matcher och statistik ligger kvar."
  },
  {
    title: "Matcher och statistik",
    text: "Här kan du granska en enskild säsong eller välja Alla säsonger för lagets samlade historik. Aktuell säsong är alltid förvald när sidan öppnas."
  },
  {
    title: "Lägga in en äldre match",
    text: "Välj matchens riktiga datum. Appen visar vilken äldre säsong matchen sparas i och ber dig bekräfta innan matchen startar."
  }
];

export default function HelpModal({ open, onClose }) {
  useDocumentScrollLock(open);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] overscroll-contain bg-slate-950/55 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Så fungerar MatchApp">
      <div className="mx-auto flex h-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Hjälp</div>
            <h2 className="text-xl font-extrabold text-slate-900">Så fungerar MatchApp</h2>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">Stäng</button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          <p className="text-sm text-slate-600">
            En kort guide till de viktigaste delarna. Guiden kan byggas ut när fler funktioner tillkommer.
          </p>
          {sections.map((section, index) => (
            <section key={section.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-sky-700">Steg {index + 1}</div>
              <h3 className="font-extrabold text-slate-900">{section.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{section.text}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
