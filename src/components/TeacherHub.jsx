import React, { useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle,
  ClipboardList,
  CreditCard,
  Image as ImageIcon,
  LineChart,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { BASE_URL } from '../lib/siteConfig';
import PlanCardGrid from './PlanCardGrid';

const heroBullets = [
  'Anfragen oder Direktbuchungen',
  'Kostenlos starten',
  'Nur Provision bei Buchung',
];

const heroStats = [
  { label: 'Startkosten', value: '0 CHF', description: 'Starter ist kostenlos.' },
  { label: 'Provision', value: 'nur bei Direktbuchung', description: 'Anfrage-Kurse bleiben provisionsfrei.' },
  {
    label: 'Upgrade-Vorteil',
    value: 'Mehr Reichweite',
    description: 'Bezahlte Pakete steigern Ranking und Anfragen.',
    span: 'sm:col-span-2',
  },
];

const howItWorksSteps = [
  {
    number: '01',
    title: 'Kurs erstellen',
    description: 'Erstellen Sie eine Kursseite mit Bildern, Beschreibung und Terminen.',
    icon: ImageIcon,
    accent: 'bg-orange-50 text-primary',
    tags: ['Bilder', 'Beschreibung', 'Termine'],
  },
  {
    number: '02',
    title: 'Gefunden werden',
    description: 'Ihre Kurse erscheinen in Suchergebnissen nach Kategorie, Ort und Thema.',
    icon: Search,
    accent: 'bg-blue-50 text-sky-700',
    tags: ['Kategorie', 'Ort', 'Thema'],
  },
  {
    number: '03',
    title: 'Teilnehmer gewinnen',
    description: 'Interessenten senden Anfragen oder buchen direkt online.',
    icon: Users,
    accent: 'bg-emerald-50 text-emerald-700',
    tags: ['Anfragen', 'Direktbuchung', 'Mehr Teilnehmer'],
  },
];

const courseModels = [
  {
    key: 'lead',
    title: 'Anfrage-Kurse',
    eyebrow: 'Ohne Provision',
    icon: MessageSquare,
    accent: 'emerald',
    description: 'Teilnehmende kontaktieren Sie über ein Formular.',
    features: ['Keine Provision', 'Volle Kontrolle über den Buchungsprozess', 'Ideal für grosse Schulen'],
  },
  {
    key: 'booking',
    title: 'Direktbuchung',
    eyebrow: 'Optional aktivierbar',
    icon: CreditCard,
    accent: 'orange',
    description: 'Teilnehmende buchen den Kurs direkt über KursNavi.',
    features: ['Automatisierte Buchung', 'Höhere Conversion', 'Weniger Administration'],
  },
];

const comparisonRows = [
  { feature: 'Kurslisting', traditional: 'Ja', kursnavi: 'Ja' },
  { feature: 'Anfragen', traditional: 'Ja', kursnavi: 'Ja' },
  { feature: 'Direktbuchung', traditional: 'Nein', kursnavi: 'Ja' },
  { feature: 'SEO-Landingpages', traditional: 'Begrenzt', kursnavi: 'Ja' },
  { feature: 'Analysen', traditional: 'Nein', kursnavi: 'Ja' },
];


const valueBullets = [
  'Mehr Sichtbarkeit in Suche, Kategorien und Regionen',
  'Klare Trennung zwischen provisionsfreien Anfragen und optionaler Direktbuchung',
  'Bezahlte Pakete fokussieren Ranking, Analysen und Reichweite statt nur Provision',
];

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

  const openEmailDraft = ({ subject, intro }) => {
    const to = 'info@kursnavi.ch';
    const name = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
    const email = user?.email || '';

    const body = [
      'Hallo KursNavi Team',
      '',
      intro,
      '',
      'Meine Angaben:',
      name ? `Name: ${name}` : 'Name:',
      email ? `E-Mail: ${email}` : 'E-Mail:',
      'Firma:',
      '',
      'Danke und Gruss',
    ].join('\n');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(to).catch(() => {});
    }

    if (showNotification) {
      showNotification('Ihr E-Mail-Programm sollte sich jetzt öffnen. Falls nicht: info@kursnavi.ch');
    }

    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

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
    if (planId === 'basic') {
      handlePrimaryCta();
      return;
    }

    const subjectMap = {
      pro: 'Upgrade Anfrage: Pro Paket',
      premium: 'Upgrade Anfrage: Premium Paket',
      enterprise: 'Demo Anfrage: Enterprise Paket',
    };

    openEmailDraft({
      subject: subjectMap[planId] || 'Anfrage zu Anbieter-Paketen',
      intro:
        planId === 'enterprise'
          ? 'Ich möchte eine Demo für das Enterprise-Paket buchen.'
          : `Ich möchte mehr über das ${String(planId).charAt(0).toUpperCase()}${String(planId).slice(1)}-Paket erfahren.`,
    });
  };

  const handleDemoCta = () => {
    openEmailDraft({
      subject: 'Demo-Anfrage KursNavi für Anbieter',
      intro: 'Ich möchte eine Demo für KursNavi als Anbieter buchen.',
    });
  };

  return (
    <div className="bg-[#f7f3ee] text-gray-900">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#1d1a19_0%,#2e2b2a_54%,#1d4965_100%)] px-4 pb-24 pt-20 text-white md:pb-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(250,110,40,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(90,155,193,0.22),_transparent_28%)]" />
        <div className="absolute -left-20 top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-orange-100 backdrop-blur">
              Für Anbieter, Schulen und Akademien
            </div>
            <h1 className="mt-7 max-w-3xl text-5xl font-bold leading-[0.95] sm:text-6xl xl:text-7xl">
              Mehr Teilnehmer für Ihre Kurse.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-gray-200 md:text-xl">
              KursNavi bringt Ihre Kurse zu Menschen, die aktiv nach Weiterbildung suchen.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {heroBullets.map((point) => (
                <div key={point} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 backdrop-blur">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" />
                  <span className="text-base text-white">{point}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button type="button" onClick={handlePrimaryCta} className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-lg font-bold text-white transition hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/20">
                Jetzt Anbieter werden
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
              <button type="button" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 text-lg font-bold text-white transition hover:border-white hover:bg-white/[0.06]">
                Preise ansehen
              </button>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {heroStats.map((stat) => (
                <div key={stat.label} className={`rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur ${stat.span || ''}`}>
                  <p className="text-sm font-medium text-gray-300">{stat.label}</p>
                  <p className="mt-3 text-2xl font-bold text-white md:text-3xl">{stat.value}</p>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-300">{stat.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/20 backdrop-blur">
              <div className="relative border-b border-white/10 p-4">
                <img src="/images/platform/hero-professional.svg" alt="Illustration einer Kursplattform für Anbieter" className="h-64 w-full rounded-[1.6rem] object-cover md:h-72" />
                <div className="absolute left-8 top-8 rounded-2xl border border-white/15 bg-[#13263e]/80 px-4 py-3 text-sm text-white shadow-lg backdrop-blur">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-orange-300" />
                    <span className="font-semibold">Gefunden in Suche und Kategorien</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
                <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-400/10 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-100/15 p-3">
                      <MessageSquare className="h-6 w-6 text-emerald-200" />
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-emerald-100/80">Anfrage-Kurse</p>
                      <h2 className="mt-1 text-xl font-bold text-white">Keine Provision</h2>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-gray-200">Teilnehmer senden Anfragen direkt an Sie. Sie behalten Preis, Ablauf und Abschluss komplett in Ihrer Hand.</p>
                </div>

                <div className="rounded-[1.75rem] border border-orange-300/25 bg-orange-400/10 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-orange-100/15 p-3">
                      <CreditCard className="h-6 w-6 text-orange-200" />
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-orange-100/80">Direct booking</p>
                      <h2 className="mt-1 text-xl font-bold text-white">Nur wenn sinnvoll</h2>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-gray-200">Aktivieren Sie Direktbuchung nur für Kurse, die sofort online gebucht werden sollen.</p>
                </div>
              </div>

              <div className="border-t border-white/10 px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-orange-500/15 p-3">
                    <ShieldCheck className="h-6 w-6 text-orange-200" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">Anfrage-Kurse haben keine Provision. Provision fällt nur bei Direktbuchungen an.</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-300">Damit ist der Unterschied sofort klar: kostenlos starten, provisionsfreie Anfragen sammeln und Direktbuchung nur dort einsetzen, wo sie Ihre Conversion erhöht.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-4 py-24 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">So funktioniert KursNavi</p>
            <h2 className="mt-4 max-w-xl text-4xl font-bold leading-tight text-dark md:text-5xl">So gewinnen Anbieter Teilnehmer über den Marktplatz</h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-gray-600">Der Ablauf ist bewusst einfach: Kurs erfassen, in der Suche sichtbar werden und über Anfragen oder Direktbuchungen neue Teilnehmer gewinnen.</p>

            <div className="mt-10 overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_18px_60px_rgba(34,34,34,0.08)]">
              <div className="border-b border-gray-100 bg-[#f3ede6] p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
              </div>
              <div className="bg-[linear-gradient(180deg,#f6f9ff_0%,#eef4ff_100%)] p-5">
                <img
                  src="/images/platform/hero-professional.svg"
                  alt="Visualisierung eines Kursangebots auf KursNavi"
                  className="h-64 w-full rounded-[1.5rem] border border-white object-cover shadow-[0_12px_30px_rgba(29,79,145,0.10)]"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            {howItWorksSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className={`rounded-[2rem] border border-gray-200 bg-white p-7 shadow-[0_18px_60px_rgba(34,34,34,0.06)] md:p-8 ${index === 1 ? 'md:ml-8' : index === 2 ? 'md:ml-16' : ''}`}>
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gray-400">{step.number}</p>
                      <h3 className="mt-5 text-3xl font-bold text-gray-900">{step.title}</h3>
                      <p className="mt-4 max-w-xl text-lg leading-relaxed text-gray-600">{step.description}</p>
                    </div>

                    <div className={`inline-flex rounded-2xl p-4 ${step.accent}`}>
                      <Icon className="h-7 w-7" />
                    </div>
                  </div>

                  <div className="mt-7 flex flex-wrap gap-3">
                    {step.tags.map((tag) => (
                      <span key={tag} className={`rounded-full px-4 py-2 text-sm font-medium ${index === 0 ? 'bg-orange-50 text-primary' : index === 1 ? 'bg-blue-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#fffaf5_0%,#f5efe7_100%)] px-4 py-24 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Zwei Kursmodelle</p>
            <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-tight text-dark md:text-5xl">Zwei Modelle, ein Ziel: mehr passende Teilnehmer</h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-gray-600">Wählen Sie pro Kurs, ob Interessenten zuerst anfragen oder direkt buchen sollen. So passt sich KursNavi an Ihren Vertriebsprozess an.</p>
          </div>

          <div className="mt-14 grid gap-7 lg:grid-cols-2">
            {courseModels.map((model) => {
              const Icon = model.icon;
              const accent = accentMap[model.accent];
              return (
                <div key={model.key} className={`rounded-[2.25rem] border p-8 shadow-[0_22px_70px_rgba(34,34,34,0.07)] md:p-10 ${accent.panel}`}>
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${accent.surface}`}>{model.eyebrow}</span>
                      <h3 className="mt-5 text-3xl font-bold text-gray-900 md:text-4xl">{model.title}</h3>
                    </div>
                    <div className="rounded-[1.4rem] bg-white p-4 shadow-sm">
                      <Icon className={`h-8 w-8 ${accent.icon}`} />
                    </div>
                  </div>

                  <p className="mt-6 text-lg leading-relaxed text-gray-700">{model.description}</p>

                  <div className="mt-8 space-y-4">
                    {model.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3 rounded-2xl bg-white/90 px-4 py-4">
                        <CheckCircle className={`mt-0.5 h-5 w-5 shrink-0 ${accent.icon}`} />
                        <span className="font-medium text-gray-800">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-orange-50 p-3 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">Provision wird nur bei erfolgreichen Direktbuchungen verrechnet.</p>
                  <p className="mt-3 leading-relaxed text-gray-600">Anfrage-Kurse haben keine Provision. Sie zahlen nur dann eine Provision, wenn Sie die Direktbuchung für einen Kurs aktivieren und eine Buchung erfolgreich abgeschlossen wird.</p>
                </div>
              </div>

              <div className="rounded-[1.75rem] bg-emerald-50 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Wichtig</p>
                <p className="mt-3 text-xl font-bold text-emerald-800">Anfrage-Kurse haben keine Provision.</p>
                <p className="mt-2 text-sm leading-relaxed text-emerald-700">Direktbuchung ist ein optionales Add-on für mehr Conversion.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-24 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Warum KursNavi</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight text-dark md:text-5xl">Mehr als ein klassisches Kursverzeichnis</h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">KursNavi kombiniert Sichtbarkeit, Anfragegewinnung und optionale Direktbuchung auf einer Plattform.</p>

            <div className="mt-8 overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-[0_18px_60px_rgba(34,34,34,0.06)]">
              <table className="min-w-full border-collapse">
                <thead className="bg-[#f8f5f1]">
                  <tr>
                    <th className="px-5 py-4 text-left text-sm font-bold text-gray-800">Feature</th>
                    <th className="px-5 py-4 text-left text-sm font-bold text-gray-800">Traditional course directories</th>
                    <th className="px-5 py-4 text-left text-sm font-bold text-gray-800">KursNavi</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.feature} className="border-t border-gray-100">
                      <td className="px-5 py-4 font-medium text-gray-900">{row.feature}</td>
                      <td className="px-5 py-4 text-gray-600">
                        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${row.traditional === 'Ja' ? 'bg-gray-100 text-gray-700' : row.traditional === 'Nein' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700'}`}>
                          {row.traditional}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-700">
                        <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">{row.kursnavi}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[2.25rem] bg-dark p-8 text-white shadow-[0_22px_70px_rgba(20,20,20,0.18)] md:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">Darum lohnt sich das</p>
            <h3 className="mt-4 text-3xl font-bold leading-tight">Warum Anbieter für Premium-Sichtbarkeit zahlen</h3>
            <p className="mt-5 text-lg leading-relaxed text-gray-300">Nicht wegen eines komplizierten Preismodells, sondern weil bessere Platzierungen und Analysen direkt zu mehr Sichtbarkeit und mehr Anfragen führen.</p>

            <div className="mt-8 space-y-4">
              {valueBullets.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-200" />
                  <span className="text-gray-100">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/[0.05] p-5">
                <TrendingUp className="h-6 w-6 text-orange-200" />
                <p className="mt-4 text-xl font-bold">Besseres Ranking</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-300">Bezahlte Pakete erscheinen prominenter und werden schneller gefunden.</p>
              </div>
              <div className="rounded-2xl bg-white/[0.05] p-5">
                <LineChart className="h-6 w-6 text-orange-200" />
                <p className="mt-4 text-xl font-bold">Messbarer Effekt</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-300">Analysen zeigen, welche Kurse, Kategorien und Regionen performen.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-[linear-gradient(180deg,#19242c_0%,#111827_100%)] px-4 py-24 text-white md:py-28">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">Preise</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">Pakete für Sichtbarkeit und Wachstum</h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-300">Starter ist Ihr kostenloser Marktplatz-Einstieg. Bezahlte Pakete steigern Ranking, Reichweite und Anfragepotenzial.</p>
          </div>

          {/* Provision note */}
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-orange-400/20 bg-orange-500/10 px-6 py-4 text-center">
            <p className="text-lg font-bold text-white">Anfrage-Kurse haben keine Provision. Provision fällt nur bei Direktbuchungen an.</p>
          </div>

          {/* Plan cards — same component as Dashboard, with inline descriptions */}
          <div className="mt-12">
            <PlanCardGrid
              showDescriptions
              renderAction={({ plan, colors }) => {
                const btnClass = plan.id === 'basic'
                  ? 'border-green-500 text-green-700 hover:bg-green-50'
                  : plan.buttonVariant === 'solid'
                    ? colors.btnSolid
                    : colors.btnOutline;
                return (
                  <button
                    type="button"
                    onClick={() => handlePlanCta(plan.id)}
                    className={`w-full rounded-lg border py-2.5 font-bold transition ${btnClass}`}
                  >
                    {plan.id === 'enterprise' ? 'Demo buchen' : plan.id === 'basic' ? 'Anbieterkonto erstellen' : 'Mehr erfahren'}
                  </button>
                );
              }}
            />
          </div>

          {/* Erfassungsservice callout */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.05] p-6 md:flex md:items-center md:justify-between md:gap-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/10 p-3">
                <ClipboardList className="h-6 w-6 text-orange-200" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">Import- und Erfassungsservice</p>
                <p className="mt-2 text-gray-300">Wenn Sie viele Kurse migrieren möchten, unterstützt KursNavi Ihr Team beim Onboarding und Import.</p>
              </div>
            </div>
            <div className="mt-4 text-left md:mt-0 md:text-right">
              <p className="text-2xl font-bold text-white">75 CHF pro Kurs</p>
              <p className="text-sm text-gray-400">ab dem 4. Kurs: 50 CHF</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f5efe7] px-4 py-24 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Unverbindliche Beispielrechnung</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight text-dark md:text-5xl">So kann eine Beispielrechnung aussehen</h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">Das folgende Rechenbeispiel dient nur der Veranschaulichung. Es ist keine Zusage und keine Garantie für Reichweite, Anfragen, Buchungen oder Umsatz.</p>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">Die tatsächlichen Ergebnisse hängen unter anderem von Angebot, Preis, Region, Nachfrage, Saison, Kursqualität und Sichtbarkeit ab.</p>
          </div>

          <div className="rounded-[2.25rem] border border-gray-200 bg-white p-8 shadow-[0_18px_60px_rgba(34,34,34,0.06)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-5">
                <p className="text-sm text-gray-500">Beispielhafter Kurspreis</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">350 CHF</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-5">
                <p className="text-sm text-gray-500">Beispielhafte zusätzliche Teilnehmende</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">2 / Monat</p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.75rem] bg-orange-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Beispielhafte Mehrerlöse pro Jahr</p>
              <p className="mt-3 text-4xl font-bold text-gray-900">8 400 CHF</p>
              <p className="mt-2 text-gray-600">Rechenbeispiel auf Basis von 2 zusätzlichen Teilnehmenden pro Monat bei 350 CHF Kurswert.</p>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-[1.75rem] border border-gray-200 px-5 py-4">
              <div>
                <p className="text-sm text-gray-500">Enterprise-Paket</p>
                <p className="text-xl font-bold text-gray-900">1490 CHF / Jahr</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Hinweis</p>
                <p className="text-xl font-bold text-gray-900">Keine Garantie</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-24 md:py-28">
        <div className="mx-auto max-w-6xl rounded-[2.75rem] bg-[linear-gradient(135deg,#171717_0%,#2b2730_55%,#55301b_100%)] px-8 py-12 text-white shadow-[0_24px_90px_rgba(18,18,18,0.22)] md:px-12 md:py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">Jetzt starten</p>
              <h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">Listen Sie Ihre Kurse noch heute auf.</h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-300">Starten Sie kostenlos, sammeln Sie provisionsfreie Anfragen und aktivieren Sie Direktbuchung nur dort, wo sie für Sie sinnvoll ist.</p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <button type="button" onClick={handlePrimaryCta} className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-lg font-bold text-white transition hover:bg-orange-600">
                  Anbieterkonto erstellen
                </button>
                <button type="button" onClick={handleDemoCta} className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 text-lg font-bold text-white transition hover:border-white hover:bg-white/[0.05]">
                  Demo buchen
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.06] p-5">
                  <MessageSquare className="h-6 w-6 text-emerald-200" />
                  <p className="mt-4 text-xl font-bold">Zuerst Anfragen</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">Provisionsfreie Anfragen für Kurse mit individuellem Abschluss.</p>
                </div>
                <div className="rounded-2xl bg-white/[0.06] p-5">
                  <CreditCard className="h-6 w-6 text-orange-200" />
                  <p className="mt-4 text-xl font-bold">Direktbuchung optional</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">Direktbuchung nur für Angebote, die sofort online buchbar sein sollen.</p>
                </div>
                <div className="rounded-2xl bg-white/[0.06] p-5 sm:col-span-2">
                  <MapPin className="h-6 w-6 text-sky-200" />
                  <p className="mt-4 text-xl font-bold">Mehr Sichtbarkeit mit Paid Plans</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">Pro, Premium und Enterprise bringen bessere Platzierungen, mehr Daten und mehr Reichweite.</p>
                </div>
              </div>
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
