export const PLANS = [
  {
    id: "basic",
    title: "Basic",
    priceText: "0 CHF",
    periodText: "/Jahr",
    accent: "green",
    badgeText: null,
    lift: false,
    buttonVariant: "outline",
    ctaLabel: "Basic wählen",

    // --- Machine-readable Paketlogik (für App-Regeln & Ranking) ---
    priceAnnualCHF: 0,
    maxCourses: Infinity, // nicht mehr limitiert
    maxCategoriesPerCourse: 1,
    commissionPct: 15,
    planFactor: 1.0,
    includedCaptureServices: 0,
    bookingFactorWithKursNavi: 1.3, // Basic + KursNavi-Buchung
    bookingFactorWithoutKursNavi: 1.0,

    features: [
      { text: "Unbegrenzte Kurse" },
      { text: "1 Kategorie pro Kurs" },
      { text: "15% Komm. (inkl. Stripe)" },
      { text: "Standard Listing" },
      { text: "Link auf eigene Website" },
      { text: "Optional: Direktbuchung (Rankingfaktor 1.3)" },
    ],
  },
  {
    id: "pro",
    title: "Pro",
    priceText: "290 CHF",
    periodText: "/Jahr",
    accent: "blue",
    badgeText: "BELIEBT",
    lift: true,
    buttonVariant: "solid",
    ctaLabel: "Pro wählen",

    // --- Machine-readable Paketlogik (für App-Regeln & Ranking) ---
    priceAnnualCHF: 290,
    maxCourses: Infinity,
    maxCategoriesPerCourse: 3,
    commissionPct: 12,
    planFactor: 1.2,
    includedCaptureServices: 0,
    bookingFactorWithKursNavi: 1.2, // Paid + KursNavi-Buchung
    bookingFactorWithoutKursNavi: 1.0,

    features: [
      { text: "Unbegrenzte Kurse" },
      { text: "Bis 3 Kategorien pro Kurs" },
      { text: "12% Komm. bei Buchung" },
      { text: "Rankingbonus (Faktor 1.2)" },
      { text: "Kontaktformular" },
      { text: "Attraktivere Darstellung" },
      { text: "Optional: Direktbuchung (Faktor 1.2 + Extra-Filter)" },
    ],
  },
  {
    id: "premium",
    title: "Premium",
    priceText: "690 CHF",
    periodText: "/Jahr",
    accent: "purple",
    badgeText: null,
    lift: false,
    buttonVariant: "outline",
    ctaLabel: "Premium wählen",

    // --- Machine-readable Paketlogik (für App-Regeln & Ranking) ---
    priceAnnualCHF: 690,
    maxCourses: Infinity,
    maxCategoriesPerCourse: 3,
    commissionPct: 10,
    planFactor: 1.2,
    includedCaptureServices: 5,
    bookingFactorWithKursNavi: 1.2,
    bookingFactorWithoutKursNavi: 1.0,

    features: [
      { text: "Unbegrenzte Kurse" },
      { text: "Bis 3 Kategorien pro Kurs" },
      { text: "10% Komm. bei Buchung" },
      { text: "Rankingbonus (Faktor 1.2)", isStrong: true },
      { text: "5 Erfassungsservices inklusive", isStrong: true },
      { text: 'Badge "Empfohlen"' },
      { text: "Newsletter Präsenz" },
      { text: "Reporting Dashboard" },
      { text: "Optional: Direktbuchung (Faktor 1.2 + Extra-Filter)" },
    ],
  },
  {
    id: "enterprise",
    title: "Enterprise",
    priceText: "1490 CHF",
    periodText: "/Jahr",
    accent: "orange",
    badgeText: null,
    lift: false,
    buttonVariant: "outline",
    ctaLabel: "Kontaktieren",

    // --- Machine-readable Paketlogik (für App-Regeln & Ranking) ---
    priceAnnualCHF: 1490,
    maxCourses: Infinity,
    maxCategoriesPerCourse: 5,
    commissionPct: 8,
    planFactor: 1.2,
    includedCaptureServices: 15,
    bookingFactorWithKursNavi: 1.2,
    bookingFactorWithoutKursNavi: 1.0,

    features: [
      { text: "Unbegrenzte Kurse", isStrong: true },
      { text: "Bis 5 Kategorien pro Kurs" },
      { text: "8% Komm. bei Buchung" },
      { text: "Rankingbonus (Faktor 1.2)" },
      { text: "15 Erfassungsservices inklusive", isStrong: true },
      { text: "Beste Platzierung" },
      { text: "Eigene Landingpage" },
      { text: "Personal Account Mgr." },
      { text: "Optional: Direktbuchung (Faktor 1.2 + Extra-Filter)" },
    ],
  },
];
