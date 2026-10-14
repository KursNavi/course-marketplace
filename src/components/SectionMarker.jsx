// Wiederkehrendes Leitelement "Linie mit Punkt" (siehe public/images/brand/kursnavi/marker-hero.svg)
// vor Abschnittslabels. Auf hellem Grund wird das Original-Asset verwendet (Petrol-Linie,
// orangener Punkt); auf dunklem Untergrund ist die feste Petrol-Strichfarbe des Assets nicht
// lesbar, deshalb dort dieselbe Form/Proportion inline nachgebaut, nur die Linie heller.
// Gemeinsam genutzt von Home.jsx (Startseite) und SearchPageView.jsx (Suchseite), damit beide
// Seiten exakt dasselbe Wiedererkennungssystem zeigen.
export const SectionMarker = ({ children, dark = false }) => (
  <div className="flex items-center gap-2.5">
    {dark ? (
      <svg width="34" height="8" viewBox="0 0 34 8" fill="none" aria-hidden="true" className="shrink-0">
        <path d="M1 4H24" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="30" cy="4" r="3" fill="#E17A3B" />
      </svg>
    ) : (
      <img src="/images/brand/kursnavi/marker-hero.svg" alt="" aria-hidden="true" className="h-2 w-auto shrink-0" />
    )}
    <span className={`text-xs font-semibold uppercase tracking-wider ${dark ? 'text-white/75' : 'text-petrol'}`}>{children}</span>
  </div>
);
