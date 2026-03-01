import React, { useEffect } from 'react';
import {
    CheckCircle, XCircle, ArrowRight, CreditCard, MessageSquare,
    CalendarClock, BookOpen, BarChart3, UserCircle, BadgeCheck,
    ClipboardList, User, Building2, Zap, Shield, Eye
} from 'lucide-react';
import { PLANS } from '../constants/plans';
import { BASE_URL } from '../lib/siteConfig';

const TeacherHub = ({ setView, t, user, showNotification }) => {

    // SEO: B2B Specific Meta Tags
    useEffect(() => {
        document.title = "Kurse anbieten auf KursNavi | Für Anbieter in der Schweiz";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = "description";
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = "Biete deine Kurse auf der Schweizer Plattform an – ob Einzelanbieter oder Kursschule. Wähle zwischen Direktbuchung und Kontaktanfragen. Kostenlos starten.";

        let linkCanonical = document.querySelector('link[rel="canonical"]');
        if (!linkCanonical) {
            linkCanonical = document.createElement('link');
            linkCanonical.rel = "canonical";
            document.head.appendChild(linkCanonical);
        }
        linkCanonical.href = `${BASE_URL}/teacher-hub`;
    }, []);

    const handleCta = (tier) => {
        if (!user) {
            localStorage.setItem('selectedPackage', tier);
            setView('login');
            window.scrollTo(0, 0);
            return;
        }

        if (tier === 'basic' || tier === 'basic_default') {
            if (showNotification) showNotification("Du nutzt das Basic Paket.");
            setView('dashboard');
            return;
        }

        const planLabel = String(tier || "").toUpperCase();
        const to = "info@kursnavi.ch";
        const subject = `Upgrade Anfrage: ${planLabel} Paket`;

        const name =
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            "";
        const email = user?.email || "";

        const body = [
            "Hallo KursNavi Team",
            "",
            `ich möchte mein Abo auf "${planLabel}" erhöhen.`,
            "",
            "Meine Angaben:",
            name ? `Name: ${name}` : "Name:",
            email ? `E-Mail: ${email}` : "E-Mail:",
            "Firma:",
            "",
            "Danke & Gruss"
        ].join("\n");

        const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(to).catch(() => {});
        }

        if (showNotification) {
            showNotification("Dein E-Mail-Programm sollte sich jetzt öffnen. Falls nicht: info@kursnavi.ch (Adresse wurde kopiert).");
        }

        window.location.href = mailto;
    };

    const getColorClasses = (accent) => {
        switch (accent) {
            case 'green': return { border: 'border-green-500', text: 'text-green-600', bg: 'bg-green-600', icon: 'text-green-500', btnOutline: 'text-green-700 border-green-500 hover:bg-green-50' };
            case 'blue': return { border: 'border-blue-500', text: 'text-blue-600', bg: 'bg-blue-600', icon: 'text-blue-500', btnSolid: 'bg-blue-600 hover:bg-blue-700 text-white' };
            case 'purple': return { border: 'border-purple-500', text: 'text-purple-600', bg: 'bg-purple-600', icon: 'text-purple-500', btnOutline: 'text-purple-700 border-purple-500 hover:bg-purple-50' };
            case 'orange': return { border: 'border-orange-500', text: 'text-orange-600', bg: 'bg-orange-600', icon: 'text-orange-500', btnOutline: 'text-orange-700 border-orange-500 hover:bg-orange-50' };
            default: return { border: 'border-gray-200', text: 'text-gray-800', bg: 'bg-gray-800', icon: 'text-gray-500', btnOutline: 'text-gray-700 border-gray-300' };
        }
    };

    const bookingModels = [
        {
            icon: CreditCard,
            title: 'Direktbuchung',
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            description: 'Teilnehmer buchen und bezahlen direkt über die Plattform.',
            idealFor: 'Feste Termine, Gruppenkurse & Events',
            detail: 'Automatische Zahlungsabwicklung via Stripe. Du erhältst die Auszahlung direkt auf dein Konto.',
        },
        {
            icon: CalendarClock,
            title: 'Flexibel',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
            description: 'Interessenten melden sich an – ihr vereinbart den Termin gemeinsam.',
            idealFor: 'Flexible Terminplanung & Einzelunterricht',
            detail: 'Bezahlung über die Plattform, aber der Termin wird individuell abgesprochen.',
        },
        {
            icon: MessageSquare,
            title: 'Anfrage (Lead)',
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200',
            description: 'Interessenten schreiben dir über ein Kontaktformular – du antwortest persönlich.',
            idealFor: 'Individuelle Angebote & Beratung',
            detail: 'Keine Zahlungsabwicklung nötig. Ideal, wenn du Preise individuell vereinbarst.',
        },
    ];

    const features = [
        {
            icon: BookOpen,
            title: 'Kursverwaltung',
            description: 'Erstelle und verwalte unbegrenzt viele Kurse. Mit Bildern, Beschreibung, Terminen und Preisen.',
        },
        {
            icon: Zap,
            title: 'Buchungen & Anfragen',
            description: 'Du entscheidest: Direktbuchung über die Plattform oder Kontaktformular für persönliche Anfragen.',
        },
        {
            icon: BarChart3,
            title: 'Analytics Dashboard',
            description: 'Behalte Buchungen, Umsatz und Kursaufrufe im Blick. Erweiterte Insights ab Pro.',
        },
        {
            icon: UserCircle,
            title: 'Öffentliches Profil',
            description: 'Deine eigene Anbieterseite mit Logo, Bio und Kursübersicht. Sichtbar im Anbieter-Verzeichnis.',
        },
        {
            icon: BadgeCheck,
            title: 'Verifizierungsbadge',
            description: 'Lass deine Qualifikationen prüfen und erhalte das blaue Häkchen für mehr Vertrauen.',
        },
        {
            icon: ClipboardList,
            title: 'Erfassungsservice',
            description: 'Keine Zeit für Dateneingabe? Wir übernehmen das Erstellen deiner Kurseinträge für dich.',
        },
    ];

    const steps = [
        { number: '1', title: 'Registriere dich kostenlos', description: 'In wenigen Klicks hast du deinen Anbieter-Account.' },
        { number: '2', title: 'Erstelle deinen ersten Kurs', description: 'Titel, Beschreibung, Preis – in unter 10 Minuten online.' },
        { number: '3', title: 'Empfange Buchungen oder Anfragen', description: 'Teilnehmer finden dich und buchen direkt – oder schreiben dir.' },
    ];

    return (
        <div className="font-sans bg-white">
            {/* ─── HERO ─── */}
            <div className="relative bg-dark text-white pt-20 pb-24 px-4 overflow-hidden">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-primary opacity-10 transform skew-x-12 translate-x-20"></div>
                <div className="max-w-5xl mx-auto relative z-10 text-center">
                    <span className="text-primary font-bold tracking-wider uppercase text-sm">Für Kursanbieter in der Schweiz</span>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-bold leading-tight mt-4">
                        Deine Kurse. <span className="text-primary">Deine Regeln.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-300 mt-6 max-w-3xl mx-auto">
                        Ob Einzelanbieter oder Kursschule – KursNavi passt sich deinem Modell an.
                        Empfange Anfragen über ein Kontaktformular oder verkaufe direkt über die Plattform. Kostenlos starten, ohne Risiko.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
                        <button onClick={() => handleCta('basic')} className="bg-primary hover:bg-orange-600 text-white px-8 py-4 rounded-full font-bold text-lg transition flex items-center justify-center shadow-lg hover:shadow-orange-500/20">
                            Kostenlos starten <ArrowRight className="ml-2 w-5 h-5"/>
                        </button>
                        <a href="#pakete" onClick={(e) => { e.preventDefault(); document.getElementById('pakete')?.scrollIntoView({ behavior: 'smooth' }); }} className="border border-gray-500 hover:border-white text-white px-8 py-4 rounded-full font-bold text-lg transition flex items-center justify-center">
                            Pakete vergleichen
                        </a>
                    </div>

                    {/* Mini trust signals */}
                    <div className="flex flex-wrap justify-center gap-6 mt-12 text-sm text-gray-400">
                        <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400"/> Keine Grundgebühr nötig</span>
                        <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-blue-400"/> Schweizer Plattform</span>
                        <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-yellow-400"/> In unter 10 Min. online</span>
                    </div>
                </div>
            </div>

            {/* ─── DEIN KURS, DEIN MODELL ─── */}
            <div className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-dark">Dein Kurs, dein Modell</h2>
                        <p className="text-gray-600 mt-3 max-w-2xl mx-auto">
                            Wähle, wie du mit Teilnehmern in Kontakt treten möchtest. Alle Modelle lassen sich pro Kurs individuell festlegen.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {bookingModels.map((model) => (
                            <div key={model.title} className={`rounded-2xl border ${model.borderColor} p-6 hover:shadow-lg transition`}>
                                <div className={`${model.bgColor} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                                    <model.icon className={`w-6 h-6 ${model.color}`} />
                                </div>
                                <h3 className="text-xl font-bold font-heading text-gray-900">{model.title}</h3>
                                <p className="text-gray-600 mt-2">{model.description}</p>
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="text-xs uppercase tracking-wide text-gray-400 font-bold mb-1">Ideal für</div>
                                    <p className="text-sm text-gray-700 font-medium">{model.idealFor}</p>
                                </div>
                                <p className="text-sm text-gray-500 mt-3">{model.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── FÜR JEDE GRÖSSE ─── */}
            <div className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-dark">Für jede Grösse die richtige Lösung</h2>
                        <p className="text-gray-600 mt-3 max-w-2xl mx-auto">
                            Ob du gerade erst anfängst oder bereits eine Kursschule betreibst – KursNavi wächst mit dir.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        {/* Einzelanbieter */}
                        <div className="bg-white rounded-2xl p-8 border border-orange-200 hover:shadow-lg transition relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">EMPFOHLEN</div>
                            <div className="bg-orange-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-5">
                                <User className="w-7 h-7 text-orange-600" />
                            </div>
                            <h3 className="text-2xl font-bold font-heading text-gray-900">Einzelanbieter</h3>
                            <p className="text-gray-500 mt-1 text-sm">Freelancer, Coaches, Trainer</p>
                            <ul className="mt-6 space-y-3">
                                {[
                                    'Eigenes Profil im Anbieter-Verzeichnis',
                                    'Erhöhte Sichtbarkeit mit Prio-Kursen',
                                    'Anfragen per Kontaktformular oder Direktbuchung',
                                    'Einfache Verwaltung ohne technische Kenntnisse',
                                    'Bereits ab 290 CHF/Jahr – weniger als 1 CHF/Tag',
                                ].map((text) => (
                                    <li key={text} className="flex items-start text-gray-700">
                                        <CheckCircle className="w-5 h-5 text-orange-500 mr-3 mt-0.5 shrink-0" />
                                        <span>{text}</span>
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => handleCta('pro')} className="mt-8 w-full py-3 rounded-xl font-bold transition bg-orange-500 hover:bg-orange-600 text-white shadow-md">
                                Pro-Paket wählen
                            </button>
                        </div>

                        {/* Kursschulen */}
                        <div className="bg-white rounded-2xl p-8 border border-blue-200 hover:shadow-lg transition relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">MEHR REICHWEITE</div>
                            <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-5">
                                <Building2 className="w-7 h-7 text-blue-600" />
                            </div>
                            <h3 className="text-2xl font-bold font-heading text-gray-900">Kursschulen & Akademien</h3>
                            <p className="text-gray-500 mt-1 text-sm">Fitness-Studios, Sprachschulen, Bildungsanbieter</p>
                            <ul className="mt-6 space-y-3">
                                {[
                                    'Direktbuchung mit automatischer Zahlungsabwicklung',
                                    'Prioritäts-Listings für mehr Sichtbarkeit',
                                    'Öffentliches Profil im Anbieter-Verzeichnis',
                                    'Analytics-Dashboard mit Buchungs- & Umsatztrends',
                                    'Tiefere Kommission ab dem Pro-Paket',
                                ].map((text) => (
                                    <li key={text} className="flex items-start text-gray-700">
                                        <CheckCircle className="w-5 h-5 text-blue-500 mr-3 mt-0.5 shrink-0" />
                                        <span>{text}</span>
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => handleCta('pro')} className="mt-8 w-full py-3 rounded-xl font-bold transition bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                                Pro-Paket wählen
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── ALLES WAS DU BRAUCHST ─── */}
            <div className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-dark">Alles was du brauchst</h2>
                        <p className="text-gray-600 mt-3 max-w-2xl mx-auto">
                            KursNavi bietet dir die Werkzeuge, um deine Kurse erfolgreich zu vermarkten und zu verwalten.
                        </p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature) => (
                            <div key={feature.title} className="p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition">
                                <div className="bg-gray-100 w-11 h-11 rounded-lg flex items-center justify-center mb-4">
                                    <feature.icon className="w-5 h-5 text-dark" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">{feature.title}</h3>
                                <p className="text-gray-600 text-sm mt-2">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── SO EINFACH GEHT'S ─── */}
            <div className="py-20 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-dark">So einfach geht's</h2>
                        <p className="text-gray-600 mt-3">In drei Schritten von der Registrierung zum ersten Teilnehmer.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {steps.map((step) => (
                            <div key={step.number} className="text-center">
                                <div className="w-14 h-14 rounded-full bg-primary text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                                    {step.number}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 font-heading">{step.title}</h3>
                                <p className="text-gray-600 text-sm mt-2">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── PRICING / PACKAGES ─── */}
            <div id="pakete" className="py-20 max-w-7xl mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold font-heading text-dark mb-4">Wähle dein Anbieter-Paket</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        Fair und transparent. Wähle das Paket, das zu deinem Kursvolumen passt.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {PLANS.map((plan) => {
                        const colors = getColorClasses(plan.accent);
                        return (
                            <div key={plan.id} className={`bg-white p-6 rounded-2xl border-t-4 shadow-lg hover:shadow-xl transition flex flex-col relative ${plan.lift ? 'transform md:-translate-y-2' : ''} ${colors.border}`}>
                                {plan.badgeText && (
                                    <div className={`absolute top-0 right-0 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg ${colors.bg}`}>
                                        {plan.badgeText}
                                    </div>
                                )}
                                <div className="mb-4">
                                    <h3 className="text-xl font-bold font-heading text-gray-800">{plan.title}</h3>
                                    <div className={`mt-2 text-3xl font-bold ${plan.id === 'basic' ? 'text-gray-900' : colors.text}`}>
                                        {plan.priceText}
                                        <span className="text-sm font-normal text-gray-500">{plan.periodText}</span>
                                    </div>
                                </div>
                                <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-600">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className={`flex items-start ${feature.dim ? 'opacity-70' : ''}`}>
                                            {feature.excluded ? (
                                                <XCircle className="w-4 h-4 mr-2 mt-1 shrink-0 text-red-500" />
                                            ) : (
                                                <CheckCircle className={`w-4 h-4 mr-2 mt-1 shrink-0 ${colors.icon}`} />
                                            )}
                                            <span className={feature.isStrong ? 'font-bold text-gray-800' : (feature.excluded ? 'text-gray-500' : '')}>
                                                {feature.text}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={() => handleCta(plan.id)}
                                    className={`w-full py-2 font-bold rounded-lg transition shadow-md ${plan.buttonVariant === 'solid' ? colors.btnSolid : colors.btnOutline}`}
                                >
                                    {plan.ctaLabel}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Service Add-on */}
                <div className="mt-12 bg-gray-50 rounded-xl p-6 border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h4 className="font-bold text-lg flex items-center gap-2"><div className="bg-primary text-white p-1 rounded-md"><CheckCircle className="w-4 h-4"/></div> Kurserfassungsservice</h4>
                        <p className="text-gray-600 text-sm mt-1">Keine Zeit für Dateneingabe? Wir übernehmen das für dich.</p>
                        <p className="text-xs text-gray-500 mt-2">Gilt für alle Pakete (begrenzt durch jeweiliges Kurslimit).</p>
                    </div>
                    <div className="text-right">
                        <span className="block text-gray-800 font-bold text-lg">75 CHF <span className="text-sm font-normal">pro Kurs</span></span>
                        <span className="text-xs text-gray-500">ab dem 4. Kurs: 50 CHF</span>
                    </div>
                </div>
            </div>

            {/* ─── CTA BOTTOM ─── */}
            <div className="bg-dark py-20">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold font-heading text-white mb-6">Bereit, loszulegen?</h2>
                    <p className="text-lg text-gray-300 mb-8">
                        Erstelle heute noch deinen ersten Kurs und erreiche neue Teilnehmer in der ganzen Schweiz.
                    </p>
                    <button onClick={() => handleCta('basic')} className="bg-primary hover:bg-orange-600 text-white px-10 py-4 rounded-full font-bold text-lg transition shadow-xl hover:shadow-orange-500/20">
                        Jetzt kostenlos starten
                    </button>
                    <p className="text-gray-500 text-sm mt-4">Kein Abo nötig. Du kannst jederzeit upgraden.</p>
                </div>
            </div>

            {/* Schema.org for B2B Page */}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebPage",
                "name": "KursNavi – Für Anbieter",
                "description": "Plattform für Kursanbieter in der Schweiz. Kostenlos starten, Kurse anbieten und Teilnehmer erreichen.",
                "audience": {
                    "@type": "BusinessAudience",
                    "audienceType": "Course Instructors, Teachers, Coaches"
                }
            })}} />
        </div>
    );
};

export default TeacherHub;
