import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  CreditCard,
  MessageSquare,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { BASE_URL } from '../lib/siteConfig';
import PlanCardGrid from './PlanCardGrid';

const heroBullets = [
  'Kostenlos starten',
  'Anfragen erhalten ohne Provision',
  'Direktbuchung optional pro Kurs',
];


const courseModels = [
  {
    key: 'lead',
    title: 'Anfrage-Modell',
    eyebrow: 'Der einfachste Einstieg',
    icon: MessageSquare,
    accent: 'emerald',
    description: 'Interessenten senden Ihnen eine Anfrage. Sie beantworten diese direkt und schliessen die Buchung selbst mit dem Teilnehmer ab.',
    features: [
      'Keine Provision – Anfragen sind immer kostenlos',
      'Volle Kontrolle über den Ablauf',
      'Ideal für individuelle Beratung oder mehrere Rückfragen',
    ],
  },
  {
    key: 'booking',
    title: 'Direktbuchung',
    eyebrow: 'Optional pro Kurs',
    icon: CreditCard,
    accent: 'orange',
    description: 'Interessenten buchen den Kurs direkt über KursNavi. Das reduziert manuellen Aufwand und macht die Buchung besonders einfach.',
    features: [
      'Buchung direkt online',
      'Weniger Administration',
      'Provision nur bei erfolgreicher Buchung',
      'Ranking-Bonus in der Suche',
    ],
  },
];

const accentMap = {
  emerald: { panel: 'border-emerald-200 bg-emerald-50', surface: 'bg-emerald-100 text-emerald-800', icon: 'text-emerald-600' },
  orange: { panel: 'border-orange-200 bg-orange-50', surface: 'bg-orange-100 text-orange-800', icon: 'text-orange-600' },
};

const upgradeBenefits = [
  { icon: TrendingUp, title: 'Bessere Platzierung', text: 'Wichtige Kurse können Sie hervorheben – sie erscheinen dann in der Suche und in Kategorien weiter oben und werden schneller gefunden.' },
  { icon: Search, title: 'Mehr Reichweite', text: 'Mit einem Upgrade erscheinen Ihre Kurse in mehreren Themenbereichen gleichzeitig – so finden Sie mehr Interessenten, die nach genau diesem Angebot suchen.' },
  { icon: Users, title: 'Mehr Einblicke', text: 'Sie sehen, welche Kurse gut laufen, wie oft sie aufgerufen werden und wo sich eine Anpassung lohnen könnte.' },
];

const faqItems = [
  {
    question: 'Muss ich für jeden Kurs Direktbuchung aktivieren?',
    answer: 'Nein. Sie entscheiden pro Kurs, ob Sie nur Anfragen erhalten oder die Direktbuchung aktivieren möchten.',
  },
  {
    question: 'Kostet mich eine Anfrage etwas?',
    answer: 'Nein. Anfragen sind provisionsfrei.',
  },
  {
    question: 'Wann fällt eine Provision an?',
    answer: 'Nur dann, wenn ein Kurs direkt über KursNavi gebucht wird und die Direktbuchung für diesen Kurs aktiviert ist.',
  },
  {
    question: 'Kann ich kostenlos starten?',
    answer: 'Ja. Mit dem Basic-Paket können Sie kostenlos starten und Ihre Kurse auf KursNavi präsentieren.',
  },
];

const FaqItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-gray-900">{question}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-gray-100 px-6 py-4">
          <p className="leading-relaxed text-gray-600">{answer}</p>
        </div>
      )}
    </div>
  );
};

const TeacherHub = ({ setView, user, showNotification }) => {
  useEffect(() => {
    document.title = 'Kurse anbieten auf KursNavi | Für Anbieter in der Schweiz';

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content =
      'Mehr Teilnehmer für Ihre Kurse: kostenlos starten, Anfragen ohne Provision erhalten und Direktbuchung optional aktivieren.';

    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.rel = 'canonical';
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.href = `${BASE_URL}/teacher-hub`;
  }, []);

  const handlePrimaryCta = () => {
    if (!user) {
      localStorage.setItem('selectedPackage', 'basic');
      setView('login');
      window.scrollTo(0, 0);
      return;
    }

    if (showNotification) showNotification('Sie können jetzt Ihren Anbieter-Account aufsetzen.');
    setView('dashboard');
  };

  const handlePlanCta = (planId) => {
    if (!user) {
      localStorage.setItem('selectedPackage', planId);
      setView('login');
      window.scrollTo(0, 0);
      return;
    }

    if (planId === 'basic') {
      setView('dashboard');
      return;
    }

    setView('dashboard');
    if (showNotification) showNotification(`Wechsle zum Dashboard – dort können Sie das ${String(planId).charAt(0).toUpperCase()}${String(planId).slice(1)}-Paket buchen.`);
  };

  const handleContactCta = () => {
    setView('contact');
    window.scrollTo(0, 0);
  };

  return (
    <div className="bg-[#f7f3ee] text-gray-900">

      {/* ── 1. Hero ── */}
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#1d1a19_0%,#2e2b2a_54%,#1d4965_100%)] px-4 pb-20 pt-20 text-white md:pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(250,110,40,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(90,155,193,0.22),_transparent_28%)]" />
        <div className="absolute -left-20 top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-orange-100 backdrop-blur">
            Für Anbieter, Schulen und Akademien
          </div>

          <h1 className="mt-7 text-5xl font-bold leading-[0.95] sm:text-6xl xl:text-7xl">
            Mehr passende Teilnehmer für Ihre Kurse
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-200 md:text-xl">
            Präsentieren Sie Ihre Kurse auf KursNavi, erhalten Sie direkte Anfragen und aktivieren Sie auf Wunsch die Direktbuchung für einzelne Angebote.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button type="button" onClick={handlePrimaryCta} className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-lg font-bold text-white transition hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/20">
              Jetzt kostenlos starten
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
            <button type="button" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 text-lg font-bold text-white transition hover:border-white hover:bg-white/[0.06]">
              Preise ansehen
            </button>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {heroBullets.map((point) => (
              <div key={point} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-2.5 backdrop-blur">
                <CheckCircle className="h-4 w-4 shrink-0 text-orange-300" />
                <span className="text-sm font-medium text-white">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. So funktioniert es ── */}
      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.24em] text-primary">So funktioniert es</p>
          <div className="mt-10 grid gap-px rounded-[2rem] overflow-hidden border border-gray-200 bg-gray-200 md:grid-cols-3">
            {[
              { n: '1', title: 'Kurs erstellen', text: 'Sie legen eine Kursseite an – mit Beschreibung, Bildern und Terminen.' },
              { n: '2', title: 'Sichtbar werden', text: 'Ihr Kurs erscheint in Suche und Kategorien auf KursNavi.' },
              { n: '3', title: 'Anfragen erhalten', text: 'Interessenten melden sich bei Ihnen – oder buchen direkt, wenn Sie das aktiviert haben.' },
            ].map(({ n, title, text }) => (
              <div key={n} className="bg-white px-8 py-8">
                <span className="text-4xl font-bold text-gray-100">{n}</span>
                <h3 className="mt-3 text-lg font-bold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Zwei Modelle ── */}
      <section className="bg-[linear-gradient(180deg,#fffaf5_0%,#f5efe7_100%)] px-4 py-20 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Zwei Kursmodelle</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight text-dark md:text-5xl">Zwei Wege, um Teilnehmer zu gewinnen</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
              Sie entscheiden pro Kurs, wie Interessenten mit Ihnen in Kontakt treten.
            </p>
          </div>

          <div className="mt-12 grid gap-7 lg:grid-cols-2">
            {courseModels.map((model) => {
              const Icon = model.icon;
              const accent = accentMap[model.accent];
              return (
                <div key={model.key} className={`rounded-[2.25rem] border p-8 shadow-[0_22px_70px_rgba(34,34,34,0.07)] md:p-10 ${accent.panel}`}>
                  <div className="flex items-start justify-between gap-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${accent.surface}`}>{model.eyebrow}</span>
                    <div className="rounded-[1.4rem] bg-white p-3 shadow-sm">
                      <Icon className={`h-7 w-7 ${accent.icon}`} />
                    </div>
                  </div>
                  <h3 className="mt-5 text-3xl font-bold text-gray-900">{model.title}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-gray-700">{model.description}</p>
                  <div className="mt-7 space-y-3">
                    {model.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3 rounded-2xl bg-white/90 px-4 py-3">
                        <CheckCircle className={`mt-0.5 h-5 w-5 shrink-0 ${accent.icon}`} />
                        <span className="font-medium text-gray-800">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ── 4. Warum sich ein Upgrade lohnt ── */}
      <section className="px-4 py-20 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Upgrade</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight text-dark md:text-5xl">Kostenlos starten, bei Bedarf mehr Sichtbarkeit nutzen</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
              Mit dem kostenlosen Einstieg können Sie Kurse aufschalten und Anfragen erhalten. Ein Upgrade lohnt sich, wenn Sie mehr Sichtbarkeit, bessere Platzierungen oder mehr Einblicke in Ihre Kurse möchten.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {upgradeBenefits.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-[2rem] border border-gray-200 bg-white p-7 shadow-[0_12px_40px_rgba(34,34,34,0.06)]">
                <div className="inline-flex rounded-2xl bg-orange-50 p-3 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-gray-900">{title}</h3>
                <p className="mt-2 leading-relaxed text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Preise ── */}
      <section id="pricing" className="bg-[linear-gradient(180deg,#19242c_0%,#111827_100%)] px-4 py-20 text-white md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">Preise</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">Pakete für unterschiedliche Wachstumsziele</h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-300">Sie können kostenlos starten und erst upgraden, wenn Sie mehr Sichtbarkeit möchten.</p>
          </div>

          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-orange-400/20 bg-orange-500/10 px-6 py-4 text-center">
            <p className="font-bold text-white">Direktbuchung ist optional. Wenn Sie nur mit Anfragen arbeiten, fällt keine Provision an.</p>
          </div>

          <div className="mt-10">
            <PlanCardGrid
              renderAction={({ plan, colors }) => {
                let label;
                if (!user) {
                  label = 'Anbieterkonto erstellen';
                } else if (plan.id === 'basic') {
                  label = 'Zum Dashboard';
                } else {
                  label = 'Upgrade kaufen';
                }

                const btnClass = plan.buttonVariant === 'solid'
                  ? colors.btnSolid
                  : colors.btnOutline;
                return (
                  <button
                    type="button"
                    onClick={() => handlePlanCta(plan.id)}
                    className={`w-full rounded-lg border py-2.5 font-bold transition ${btnClass}`}
                  >
                    {label}
                  </button>
                );
              }}
            />
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.05] p-6 md:flex md:items-center md:justify-between md:gap-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/10 p-3">
                <ClipboardList className="h-6 w-6 text-orange-200" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">Unterstützung beim Onboarding</p>
                <p className="mt-1 text-gray-300">Wenn Sie viele Kurse migrieren möchten, unterstützt KursNavi Sie beim Erfassen und Importieren Ihrer Angebote.</p>
              </div>
            </div>
            <div className="mt-4 shrink-0 text-left md:mt-0 md:text-right">
              <p className="text-2xl font-bold text-white">75 CHF pro Kurs</p>
              <p className="text-sm text-gray-400">ab dem 4. Kurs: 50 CHF</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. FAQ ── */}
      <section className="bg-[#f5efe7] px-4 py-20 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Häufige Fragen</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight text-dark">Noch Fragen?</h2>
          </div>

          <div className="mt-10 space-y-3">
            {faqItems.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Abschluss-CTA ── */}
      <section className="bg-white px-4 py-20 md:py-24">
        <div className="mx-auto max-w-6xl rounded-[2.75rem] bg-[linear-gradient(135deg,#171717_0%,#2b2730_55%,#55301b_100%)] px-8 py-12 text-white shadow-[0_24px_90px_rgba(18,18,18,0.22)] md:px-12 md:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">Jetzt starten</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">Starten Sie kostenlos mit Ihrem ersten Kurs.</h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-300">
              Beginnen Sie mit dem Anfrage-Modell und aktivieren Sie die Direktbuchung später nur dort, wo sie für Ihren Kurs wirklich sinnvoll ist.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <button type="button" onClick={handlePrimaryCta} className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-lg font-bold text-white transition hover:bg-orange-600">
                Anbieterkonto erstellen
              </button>
              <button type="button" onClick={handleContactCta} className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 text-lg font-bold text-white transition hover:border-white hover:bg-white/[0.05]">
                Kontakt aufnehmen
              </button>
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'KursNavi - Für Anbieter',
            description:
              'Landingpage für Kursanbieter: kostenlos starten, Anfragen ohne Provision erhalten und Direktbuchung optional aktivieren.',
            audience: {
              '@type': 'BusinessAudience',
              audienceType: 'Course Providers, Academies, Schools',
            },
          }),
        }}
      />
    </div>
  );
};

export default TeacherHub;
