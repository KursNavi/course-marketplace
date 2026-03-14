import React, { useEffect } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  CreditCard,
  LineChart,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { BASE_URL } from '../lib/siteConfig';

const howItWorksSteps = [
  {
    number: '01',
    title: 'Kurs erstellen',
    description: 'Erstellen Sie eine Kursseite mit Bildern, Beschreibung und Terminen.',
    icon: BookOpen,
  },
  {
    number: '02',
    title: 'Gefunden werden',
    description: 'Ihre Kurse erscheinen in Suchergebnissen nach Kategorie, Ort und Thema.',
    icon: Search,
  },
  {
    number: '03',
    title: 'Teilnehmer gewinnen',
    description: 'Interessenten senden Anfragen oder buchen direkt online.',
    icon: Users,
  },
];

const courseModels = [
  {
    key: 'lead',
    title: 'Lead Courses',
    eyebrow: 'Ohne Provision',
    icon: MessageSquare,
    accent: 'emerald',
    description: 'Teilnehmer kontaktieren Sie ueber ein Formular.',
    features: ['No commission', 'Full control of booking', 'Ideal for large schools'],
  },
  {
    key: 'booking',
    title: 'Direct Booking',
    eyebrow: 'Optional aktivierbar',
    icon: CreditCard,
    accent: 'orange',
    description: 'Teilnehmer buchen den Kurs direkt ueber KursNavi.',
    features: ['Automated booking', 'Higher conversion', 'Less administration'],
  },
];

const comparisonRows = [
  { feature: 'Course listing', traditional: true, kursnavi: true },
  { feature: 'Lead inquiries', traditional: true, kursnavi: true },
  { feature: 'Direct booking', traditional: false, kursnavi: true },
  { feature: 'SEO landing pages', traditional: 'limited', kursnavi: true },
  { feature: 'Analytics', traditional: false, kursnavi: true },
];

const pricingGroups = [
  {
    title: 'Marketplace',
    subtitle: 'Starter (Free)',
    highlight: 'Kostenlos starten und Leads sammeln',
    plans: [
      {
        id: 'basic',
        name: 'Start for free',
        price: '0 CHF',
        period: '/ year',
        accent: 'emerald',
        badge: 'Marketplace',
        features: ['publish courses', 'receive inquiries', 'optional direct booking'],
        note: 'commission only on direct bookings',
      },
    ],
  },
  {
    title: 'Visibility & Growth',
    subtitle: 'Pro / Premium / Enterprise',
    highlight: 'Mehr Sichtbarkeit, mehr Daten, mehr Leads',
    plans: [
      {
        id: 'pro',
        name: 'Grow visibility',
        price: '290 CHF',
        period: '/ year',
        accent: 'sky',
        badge: 'Pro',
        features: ['better ranking', 'analytics', 'multiple categories'],
      },
      {
        id: 'premium',
        name: 'Maximize reach',
        price: '690 CHF',
        period: '/ year',
        accent: 'violet',
        badge: 'Premium',
        features: ['featured placement', 'advanced analytics', 'priority ranking'],
      },
      {
        id: 'enterprise',
        name: 'For large providers',
        price: '1490 CHF',
        period: '/ year',
        accent: 'amber',
        badge: 'Enterprise',
        features: ['unlimited courses', 'maximum ranking priority', 'onboarding support', 'import service'],
      },
    ],
  },
];

const accentMap = {
  emerald: {
    card: 'border-emerald-200 bg-emerald-50/80',
    soft: 'bg-emerald-100 text-emerald-800',
    icon: 'text-emerald-600',
    button: 'border-emerald-500 text-emerald-700 hover:bg-emerald-50',
  },
  orange: {
    card: 'border-orange-200 bg-orange-50/80',
    soft: 'bg-orange-100 text-orange-800',
    icon: 'text-orange-600',
    button: 'bg-primary text-white hover:bg-orange-600',
  },
  sky: {
    card: 'border-sky-200 bg-sky-50/80',
    soft: 'bg-sky-100 text-sky-800',
    icon: 'text-sky-600',
    button: 'bg-sky-600 text-white hover:bg-sky-700',
  },
  violet: {
    card: 'border-violet-200 bg-violet-50/80',
    soft: 'bg-violet-100 text-violet-800',
    icon: 'text-violet-600',
    button: 'bg-violet-600 text-white hover:bg-violet-700',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50/80',
    soft: 'bg-amber-100 text-amber-800',
    icon: 'text-amber-600',
    button: 'bg-amber-500 text-white hover:bg-amber-600',
  },
};

const tableCellClasses = 'px-4 py-4 text-sm md:text-base';

const TeacherHub = ({ setView, user, showNotification }) => {
  useEffect(() => {
    document.title = 'Kurse anbieten auf KursNavi | Fuer Anbieter in der Schweiz';

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content =
      'Mehr Teilnehmer fuer Ihre Kurse: kostenlos starten, Leads ohne Provision erhalten und Direktbuchung optional aktivieren.';

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
      showNotification('Ihr E-Mail-Programm sollte sich jetzt oeffnen. Falls nicht: info@kursnavi.ch');
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

    if (showNotification) showNotification('Sie koennen jetzt Ihren Anbieter-Account aufsetzen.');
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
          ? 'Ich moechte eine Demo fuer das Enterprise Paket buchen.'
          : `Ich moechte mehr ueber das ${String(planId).charAt(0).toUpperCase()}${String(planId).slice(1)} Paket erfahren.`,
    });
  };

  const handleDemoCta = () => {
    openEmailDraft({
      subject: 'Demo Anfrage KursNavi fuer Anbieter',
      intro: 'Ich moechte eine Demo fuer KursNavi als Anbieter buchen.',
    });
  };

  return (
    <div className="bg-white text-gray-900">
      <section className="relative overflow-hidden bg-dark px-4 pb-24 pt-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(250,110,40,0.22),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.18),_transparent_32%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-orange-200 backdrop-blur">
              Fuer Anbieter, Schulen und Akademien
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
              Mehr Teilnehmer fuer Ihre Kurse.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-gray-200 md:text-xl">
              KursNavi bringt Ihre Kurse zu Menschen, die aktiv nach Weiterbildung suchen.
            </p>

            <div className="mt-8 grid gap-3 text-base text-gray-100 sm:grid-cols-2">
              {[
                'Lead-Anfragen oder Direktbuchungen',
                'Kostenlos starten',
                'Nur Provision bei Buchung',
              ].map((point) => (
                <div key={point} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" />
                  <span>{point}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-lg font-bold text-white transition hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/20"
              >
                Jetzt Anbieter werden
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 text-lg font-bold text-white transition hover:border-white hover:bg-white/5"
              >
                Preise ansehen
              </button>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-orange-200">Provider Model</p>
                  <h2 className="mt-2 text-2xl font-bold">Leads zuerst, Buchung optional</h2>
                </div>
                <Sparkles className="h-10 w-10 text-orange-300" />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-5">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-6 w-6 text-emerald-300" />
                    <span className="font-semibold text-emerald-100">Lead courses</span>
                  </div>
                  <p className="mt-3 text-sm text-gray-200">Anfragen landen direkt bei Ihnen. Keine Provision.</p>
                </div>
                <div className="rounded-2xl border border-orange-300/30 bg-orange-400/10 p-5">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-6 w-6 text-orange-300" />
                    <span className="font-semibold text-orange-100">Direct booking</span>
                  </div>
                  <p className="mt-3 text-sm text-gray-200">Optional fuer Kurse, die online buchbar sein sollen.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-gray-300">Startkosten</p>
                <p className="mt-2 text-3xl font-bold text-white">0 CHF</p>
                <p className="mt-2 text-sm text-gray-400">Starter ist kostenlos.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-gray-300">Provision</p>
                <p className="mt-2 text-3xl font-bold text-white">nur bei Buchung</p>
                <p className="mt-2 text-sm text-gray-400">Lead-Kurse bleiben provisionsfrei.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-gray-300">Paid plans</p>
                <p className="mt-2 text-3xl font-bold text-white">mehr Sichtbarkeit</p>
                <p className="mt-2 text-sm text-gray-400">Besseres Ranking und mehr Reichweite.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">How KursNavi Works</p>
            <h2 className="mt-4 text-3xl font-bold text-dark md:text-4xl">So gewinnen Anbieter Teilnehmer ueber den Marktplatz</h2>
            <p className="mt-4 text-lg text-gray-600">
              Der Ablauf ist bewusst einfach: Kurs erfassen, in der Suche sichtbar werden und ueber Leads oder Direktbuchungen neue Teilnehmer gewinnen.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {howItWorksSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="relative rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase tracking-[0.22em] text-gray-400">{step.number}</span>
                    <div className="rounded-2xl bg-orange-50 p-3 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                  <h3 className="mt-8 text-2xl font-bold text-gray-900">{step.title}</h3>
                  <p className="mt-4 text-gray-600">{step.description}</p>
                  {index < howItWorksSteps.length - 1 ? (
                    <ChevronRight className="absolute -right-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-white text-gray-300 shadow lg:block" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-stone-50 px-4 py-20 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Two Course Models</p>
            <h2 className="mt-4 text-3xl font-bold text-dark md:text-4xl">Zwei Modelle, ein Ziel: mehr passende Teilnehmer</h2>
            <p className="mt-4 text-lg text-gray-600">
              Waehlen Sie pro Kurs, ob Interessenten zuerst anfragen oder direkt buchen sollen. So passt sich KursNavi an Ihren Vertriebsprozess an.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {courseModels.map((model) => {
              const Icon = model.icon;
              const accent = accentMap[model.accent];
              return (
                <div key={model.key} className={`rounded-[2rem] border p-8 shadow-sm ${accent.card}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${accent.soft}`}>{model.eyebrow}</span>
                      <h3 className="mt-5 text-3xl font-bold text-gray-900">{model.title}</h3>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <Icon className={`h-8 w-8 ${accent.icon}`} />
                    </div>
                  </div>
                  <p className="mt-5 text-lg text-gray-700">{model.description}</p>
                  <div className="mt-8 space-y-4">
                    {model.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3">
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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-orange-50 p-3 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">Commission is only charged on successful direct bookings.</p>
                  <p className="mt-2 text-gray-600">
                    Lead courses have no commission. Sie zahlen nur dann eine Provision, wenn Sie die Direktbuchung fuer einen Kurs aktivieren und eine Buchung erfolgreich abgeschlossen wird.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Wichtig</p>
                <p className="mt-1 text-lg font-bold text-emerald-800">Lead courses have no commission.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Why KursNavi</p>
            <h2 className="mt-4 text-3xl font-bold text-dark md:text-4xl">Mehr als ein klassisches Kursverzeichnis</h2>
            <p className="mt-4 text-lg text-gray-600">
              KursNavi kombiniert Sichtbarkeit, Lead-Generierung und optionale Direktbuchung auf einer Plattform.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${tableCellClasses} text-left font-bold text-gray-800`}>Feature</th>
                  <th className={`${tableCellClasses} text-left font-bold text-gray-800`}>Traditional course directories</th>
                  <th className={`${tableCellClasses} text-left font-bold text-gray-800`}>KursNavi</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="border-t border-gray-100">
                    <td className={`${tableCellClasses} font-medium text-gray-900`}>{row.feature}</td>
                    <td className={`${tableCellClasses} text-gray-600`}>
                      {row.traditional === true ? (
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      ) : row.traditional === false ? (
                        <span className="text-xl text-gray-300">✗</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">{row.traditional}</span>
                      )}
                    </td>
                    <td className={`${tableCellClasses} text-gray-700`}>
                      {row.kursnavi === true ? (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <span>{String(row.kursnavi)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-dark px-4 py-20 text-white md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">Pricing</p>
            <h2 className="mt-4 text-3xl font-bold md:text-5xl">Pakete fuer Sichtbarkeit und Wachstum</h2>
            <p className="mt-4 text-lg text-gray-300">
              Starter ist Ihr kostenloser Marktplatz-Einstieg. Bezahlte Pakete steigern Ranking, Reichweite und Lead-Potenzial.
            </p>
          </div>

          <div className="mt-12 grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
            {pricingGroups.map((group) => (
              <div key={group.title} className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur md:p-8">
                <div className="flex flex-col gap-3 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-orange-200">{group.title}</p>
                    <h3 className="mt-2 text-2xl font-bold">{group.subtitle}</h3>
                  </div>
                  <p className="text-sm text-gray-300">{group.highlight}</p>
                </div>

                <div className={`mt-6 grid gap-6 ${group.plans.length === 1 ? '' : 'lg:grid-cols-3'}`}>
                  {group.plans.map((plan) => {
                    const accent = accentMap[plan.accent];
                    const isStarter = plan.id === 'basic';
                    return (
                      <div
                        key={plan.id}
                        className={`flex h-full flex-col rounded-[1.75rem] border bg-white p-6 text-gray-900 shadow-xl ${
                          isStarter ? 'border-emerald-200 ring-2 ring-emerald-200' : 'border-white/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${accent.soft}`}>
                              {plan.badge}
                            </span>
                            <h4 className="mt-4 text-2xl font-bold text-gray-900">{plan.name}</h4>
                          </div>
                          {plan.id !== 'basic' ? <LineChart className={`h-8 w-8 ${accent.icon}`} /> : <Sparkles className={`h-8 w-8 ${accent.icon}`} />}
                        </div>

                        <div className="mt-6">
                          <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                          <span className="ml-2 text-sm text-gray-500">{plan.period}</span>
                        </div>

                        <div className="mt-6 flex-1 space-y-3">
                          {plan.features.map((feature) => (
                            <div key={feature} className="flex items-start gap-3">
                              <CheckCircle className={`mt-0.5 h-5 w-5 shrink-0 ${accent.icon}`} />
                              <span className="text-gray-700">{feature}</span>
                            </div>
                          ))}
                        </div>

                        {plan.note ? (
                          <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{plan.note}</div>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handlePlanCta(plan.id)}
                          className={`mt-6 inline-flex items-center justify-center rounded-xl px-5 py-3 font-bold transition ${accent.button}`}
                        >
                          {plan.id === 'enterprise' ? 'Book a demo' : plan.id === 'basic' ? 'Create provider account' : 'Mehr erfahren'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[2rem] border border-orange-400/25 bg-orange-500/10 p-6">
            <p className="text-lg font-bold text-white">Lead courses have no commission. Commission only applies to direct bookings.</p>
          </div>

          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 md:flex md:items-center md:justify-between md:gap-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/10 p-3">
                <ClipboardList className="h-6 w-6 text-orange-200" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">Import- und Erfassungsservice</p>
                <p className="mt-2 text-gray-300">Wenn Sie viele Kurse migrieren moechten, unterstuetzt KursNavi Ihr Team beim Onboarding und Import.</p>
              </div>
            </div>
            <div className="mt-4 text-left md:mt-0 md:text-right">
              <p className="text-2xl font-bold text-white">75 CHF pro Kurs</p>
              <p className="text-sm text-gray-400">ab dem 4. Kurs: 50 CHF</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-stone-50 px-4 py-20 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">ROI Example</p>
            <h2 className="mt-4 text-3xl font-bold text-dark md:text-4xl">Schon wenige zusaetzliche Teilnehmer machen den Unterschied</h2>
            <p className="mt-4 text-lg text-gray-600">
              Die bezahlten Pakete sollen sich nicht ueber Provision erklaeren, sondern ueber mehr Reichweite. Schon ein kleiner Zuwachs kann den Jahrespreis deutlich uebersteigen.
            </p>
          </div>

          <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-5">
                <p className="text-sm text-gray-500">Average course price</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">350 CHF</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-5">
                <p className="text-sm text-gray-500">Additional participants</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">2 / month</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-orange-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Annual uplift</p>
              <p className="mt-3 text-4xl font-bold text-gray-900">8 400 CHF</p>
              <p className="mt-2 text-gray-600">2 zusaetzliche Teilnehmer pro Monat bei 350 CHF Kurswert.</p>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-gray-200 px-5 py-4">
              <div>
                <p className="text-sm text-gray-500">Enterprise plan</p>
                <p className="text-xl font-bold text-gray-900">1490 CHF / year</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Beispiel-Ergebnis</p>
                <p className="text-xl font-bold text-emerald-700">deutlich positiv</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 md:py-24">
        <div className="mx-auto max-w-5xl rounded-[2.5rem] bg-[linear-gradient(135deg,#171717_0%,#2a2a2a_55%,#40220f_100%)] px-8 py-12 text-center text-white shadow-2xl md:px-12 md:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">Final CTA</p>
          <h2 className="mt-4 text-3xl font-bold md:text-5xl">Start listing your courses today.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-300">
            Starten Sie kostenlos, sammeln Sie provisionsfreie Leads und aktivieren Sie Direktbuchung nur dort, wo sie fuer Sie sinnvoll ist.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-lg font-bold text-white transition hover:bg-orange-600"
            >
              Create provider account
            </button>
            <button
              type="button"
              onClick={handleDemoCta}
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 text-lg font-bold text-white transition hover:border-white hover:bg-white/5"
            >
              Book a demo
            </button>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'KursNavi - Fuer Anbieter',
            description:
              'Landingpage fuer Kursanbieter: kostenlos starten, Leads ohne Provision erhalten und Direktbuchung optional aktivieren.',
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
