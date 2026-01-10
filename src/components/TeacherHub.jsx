import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { BarChart, Users, Calendar, ArrowRight, CheckCircle } from "lucide-react";
import PricingCard from "./PricingCard";
import { PLANS } from "../constants/plans";
import { cn } from "../lib/cn";

const STORAGE_SELECTED_PACKAGE = "selectedPackage";

function getPublicSiteUrl() {
  const vite = typeof import.meta !== "undefined" ? import.meta.env?.VITE_PUBLIC_SITE_URL : undefined;
  if (vite) return String(vite).replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://kursnavi.ch";
}

function buildCanonical(pathname) {
  const base = getPublicSiteUrl();
  const cleanPath = pathname?.startsWith("/") ? pathname : `/${pathname ?? ""}`;
  return `${base}${cleanPath}`;
}

export default function TeacherHub({ setView, t, user, showNotification }) {
  const [mailtoFallback, setMailtoFallback] = useState(null);

  const pageTitle = "Kurse anbieten & Geld verdienen | KursNavi Teacher Hub";
  const pageDescription =
    "Erstelle und verkaufe deine Kurse auf dem Schweizer Marktplatz. Erreiche tausende Schüler, verwalte Buchungen und steigere deinen Umsatz mit KursNavi.";

  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/teacher-hub";
  const canonicalUrl = buildCanonical(pathname);

  const jsonLd = useMemo(() => {
    const data = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "KursNavi Teacher Hub",
      description: "Plattform für Kursanbieter in der Schweiz.",
      url: canonicalUrl,
      audience: {
        "@type": "BusinessAudience",
        audienceType: "Course Instructors, Teachers, Coaches",
      },
    };
    return JSON.stringify(data);
  }, [canonicalUrl]);

  const tx = (key, fallback) => {
    if (typeof t === "function") {
      const val = t(key);
      return val ?? fallback;
    }
    return fallback;
  };

  const handleCta = (tierRaw) => {
    const tier = tierRaw === "basic_default" ? "basic" : tierRaw;

    // 1) Nicht eingeloggt -> Login
    if (!user) {
      try {
        localStorage.setItem(STORAGE_SELECTED_PACKAGE, tier);
      } catch {
        // ignorieren
      }
      setView("login");
      if (typeof window !== "undefined") window.scrollTo(0, 0);
      return;
    }

    // 2) Eingeloggt
    if (tier === "basic") {
      if (showNotification) showNotification(tx("teacherhub.basic_active", "Du nutzt das Basic Paket."));
      setView("dashboard");
      return;
    }

    // 3) Pro/Premium/Enterprise -> Mailto (MVP)
    const subject = `Upgrade Anfrage: ${String(tier).toUpperCase()} Paket`;
    const userEmail = user?.email ?? "Keine Email angegeben";
    const body =
      `Hallo KursNavi Team,\n\n` +
      `ich möchte gerne mein Konto (${userEmail}) auf das ${String(tier).toUpperCase()} Paket upgraden.\n\n` +
      `Bitte sendet mir die Rechnung und schaltet mich frei.\n\n` +
      `Danke!`;

    const mailtoLink = `mailto:info@kursnavi.ch?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    setMailtoFallback(mailtoLink);

    // robuster als DOM-Link click()
    if (typeof window !== "undefined") {
      window.location.href = mailtoLink;
    }

    if (showNotification) showNotification(
      tx(
        "teacherhub.mail_opened",
        "E-Mail Programm geöffnet. Bitte sende die Anfrage ab."
      )
    );
  };

  return (
    <main className="font-sans bg-white">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />

        {/* OpenGraph */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />

        {/* JSON-LD */}
        <script type="application/ld+json">{jsonLd}</script>
      </Helmet>

      {/* Fallback, falls Mailto blockiert */}
      {mailtoFallback ? (
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-3 text-sm text-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle aria-hidden="true" className="w-4 h-4 text-green-600" />
              <span>
                Falls sich kein Mailprogramm geöffnet hat: klicke auf den Link.
              </span>
            </div>
            <a
              href={mailtoFallback}
              className="font-semibold underline underline-offset-2 text-primary"
            >
              Upgrade Anfrage per E-Mail öffnen
            </a>
          </div>
        </div>
      ) : null}

      {/* Hero Section */}
      <section
        aria-labelledby="teacherhub-hero-title"
        className="relative bg-dark text-white pt-20 pb-24 px-4 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary opacity-10 transform skew-x-12 translate-x-20" />
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="md:w-1/2 space-y-6">
            <span className="text-primary font-bold tracking-wider uppercase text-sm">
              Für Kursanbieter & Experten
            </span>

            <h1
              id="teacherhub-hero-title"
              className="text-5xl md:text-6xl font-heading font-bold leading-tight"
            >
              Verwandle dein Wissen in{" "}
              <span className="text-primary">Einkommen</span>.
            </h1>

            <p className="text-xl text-gray-300">
              Die einfachste Plattform der Schweiz, um Kurse zu erstellen, zu
              verwalten und zu füllen. Keine technischen Vorkenntnisse nötig.
            </p>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => handleCta("basic")}
                className={cn(
                  "bg-primary hover:bg-orange-600 text-white px-8 py-4 rounded-full font-bold text-lg transition flex items-center shadow-lg hover:shadow-orange-500/20",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
                )}
              >
                Kostenlos starten <ArrowRight aria-hidden="true" className="ml-2 w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="md:w-1/2 bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl">
            {/* Abstract UI Mockup */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                <div>
                  <div className="text-gray-400 text-sm">Monatsumsatz</div>
                  <div className="text-3xl font-bold text-white">
                    CHF 4'250.00
                  </div>
                </div>
                <BarChart aria-hidden="true" className="text-green-400 w-8 h-8" />
              </div>

              <div className="space-y-3">
                <div className="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                  <span className="flex items-center text-gray-200">
                    <Users aria-hidden="true" className="w-4 h-4 mr-2 text-primary" />{" "}
                    Töpfern für Anfänger
                  </span>
                  <span className="text-green-400 font-bold">+ 12 Buchungen</span>
                </div>

                <div className="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                  <span className="flex items-center text-gray-200">
                    <Calendar aria-hidden="true" className="w-4 h-4 mr-2 text-blue-400" />{" "}
                    Business Yoga
                  </span>
                  <span className="text-green-400 font-bold">+ 5 Buchungen</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing / Packages Section */}
      <section
        aria-labelledby="teacherhub-pricing-title"
        className="py-20 max-w-7xl mx-auto px-4"
      >
        <div className="text-center mb-12">
          <h2
            id="teacherhub-pricing-title"
            className="text-3xl md:text-4xl font-bold font-heading text-dark mb-4"
          >
            Wähle dein Anbieter-Paket
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Fair und transparent. Wähle das Paket, das zu deinem Kursvolumen passt.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <PricingCard key={plan.id} plan={plan} onSelect={handleCta} />
          ))}
        </div>

        {/* Service Add-on */}
        <div className="mt-12 bg-gray-50 rounded-xl p-6 border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <div className="bg-primary text-white p-1 rounded-md">
                <CheckCircle aria-hidden="true" className="w-4 h-4" />
              </div>
              Kurserfassungsservice
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              Keine Zeit für Dateneingabe? Wir übernehmen das für dich.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Gilt für alle Pakete (begrenzt durch jeweiliges Kurslimit).
            </p>
          </div>
          <div className="text-right">
            <span className="block text-gray-800 font-bold text-lg">
              75 CHF <span className="text-sm font-normal">pro Kurs</span>
            </span>
            <span className="text-xs text-gray-500">ab dem 4. Kurs: 50 CHF</span>
          </div>
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="bg-gray-50 py-20 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-dark mb-6">
            Bereit, durchzustarten?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Erstelle heute noch deinen ersten Kurs. Es dauert weniger als 10 Minuten.
          </p>
          <button
            type="button"
            onClick={() => handleCta("basic")}
            className={cn(
              "bg-dark hover:bg-gray-800 text-white px-10 py-4 rounded-full font-bold text-lg transition shadow-xl",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
            )}
          >
            Jetzt Anbieter werden
          </button>
        </div>
      </section>
    </main>
  );
}