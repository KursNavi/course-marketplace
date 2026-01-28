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

    // --- Machine-readable Paketlogik (v3.0) ---
    priceAnnualCHF: 0,
    maxCourses: Infinity,
    maxCategoriesPerCourse: 1,
    commissionPct: 15,
    planFactor: 1.0,
    includedCaptureServices: 0,
    bookingFactorWithKursNavi: 1.3,
    bookingFactorWithoutKursNavi: 1.0,

    features: [
      { text: "Unbegrenzte Kurse" },
      { text: "1 Kategorie pro Kurs" },
      { text: "15% Komm. (inkl. Stripe)" },
      { text: "Standard Listing" },
      // NEU: 'excluded: true' sorgt für das rote Kreuz statt Haken
      { text: "Keine Erfassungsservices inklusive", dim: true, excluded: true },
      { text: "Ranking-Bonus bei Direktbuchung" },
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

    // --- Machine-readable Paketlogik (v3.0) ---
    priceAnnualCHF: 290,
    maxCourses: Infinity,
    maxCategoriesPerCourse: 3,
    commissionPct: 12,
    planFactor: 1.2,
    includedCaptureServices: 0,
    bookingFactorWithKursNavi: 1.2,
    bookingFactorWithoutKursNavi: 1.0,

    features: [
      { text: "Unbegrenzte Kurse" },
      { text: "Bis 3 Kategorien pro Kurs" },
      { text: "12% Komm. bei Buchung" },
      { text: "Erhöhtes Ranking" },
      // NEU: 'excluded: true' für rotes Kreuz
      { text: "Keine Erfassungsservices inklusive", dim: true, excluded: true },
      { text: "Ranking-Bonus bei Direktbuchung" },
      // "Attraktivere Darstellung" entfernt gemäss Screenshot
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

    // --- Machine-readable Paketlogik (v3.0) ---
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
      { text: "Erhöhtes Ranking", isStrong: true },
      { text: "5 Erfassungsservices inklusive", isStrong: true },
      { text: "Ranking-Bonus bei Direktbuchung" },
      // Badge, Newsletter, Reporting entfernt gemäss Screenshot
    ],
  },
  {
    id: "enterprise",
    title: "Enterprise",
    priceText: "1'490 CHF",
    periodText: "/Jahr",
    accent: "orange",
    badgeText: null,
    lift: false,
    buttonVariant: "outline",
    ctaLabel: "Kontaktieren",

    // --- Machine-readable Paketlogik (v3.0) ---
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
      { text: "Erhöhtes Ranking" },
      { text: "15 Erfassungsservices inklusive", isStrong: true },
      { text: "Ranking-Bonus bei Direktbuchung" },
      // Platzierung, Landingpage, Account Mgr. entfernt gemäss Screenshot
    ],
  },
];