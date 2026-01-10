import React, { useEffect } from 'react';
import { CheckCircle, BarChart, Users, Calendar, ArrowRight, DollarSign, Mail } from 'lucide-react';

const TeacherHub = ({ setView, t, user, showNotification }) => {
    
    // SEO: B2B Specific Meta Tags
    useEffect(() => {
        document.title = "Kurse anbieten & Geld verdienen | KursNavi Teacher Hub";
        
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = "description";
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = "Erstelle und verkaufe deine Kurse auf dem Schweizer Marktplatz. Erreiche tausende Schüler, verwalte Buchungen und steigere deinen Umsatz mit KursNavi.";
        
        // Canonical
        let linkCanonical = document.querySelector('link[rel="canonical"]');
        if (!linkCanonical) {
            linkCanonical = document.createElement('link');
            linkCanonical.rel = "canonical";
            document.head.appendChild(linkCanonical);
        }
        linkCanonical.href = "https://kursnavi.ch/teacher-hub";

    }, []);

    const handleCta = (tier) => {
        // 1. Wenn User NICHT eingeloggt ist -> Zum Login schicken
        if (!user) {
            localStorage.setItem('selectedPackage', tier);
            setView('login');
            window.scrollTo(0,0);
            return;
        }

        // 2. Wenn User eingeloggt ist -> "Soft Upgrade" Prozess starten
        if (tier === 'basic' || tier === 'basic_default') {
            // Basic ist Standard, einfach zum Dashboard
            if (showNotification) showNotification("Du nutzt das Basic Paket.");
            setView('dashboard');
        } else {
            // PRO / PREMIUM / ENTERPRISE -> Stabilste Lösung: Manuelle E-Mail
            // Wir verhindern automatische Links, da diese auf manchen Windows-Systemen zu XML-Fehlern führen.
            const subject = `Upgrade Anfrage: ${tier.toUpperCase()} Paket`;
            
            // Adresse in Zwischenablage kopieren (UX Boost)
            navigator.clipboard.writeText("info@kursnavi.ch").then(() => {
                // Erfolg
            }).catch(err => {
                console.error('Kopieren fehlgeschlagen:', err);
            });
            
            // Klare Anweisung an den User statt Absturzrisiko
            if (showNotification) {
                showNotification(`Bitte schreibe eine Mail an info@kursnavi.ch (Adresse kopiert!). Betreff: ${subject}`);
            } else {
                alert(`Bitte schreibe eine Mail an info@kursnavi.ch mit dem Betreff: ${subject}`);
            }
        }
    };

    return (
        <div className="font-sans bg-white">
            {/* Hero Section */}
            <div className="relative bg-dark text-white pt-20 pb-24 px-4 overflow-hidden">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-primary opacity-10 transform skew-x-12 translate-x-20"></div>
                <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-center gap-12">
                    <div className="md:w-1/2 space-y-6">
                        <span className="text-primary font-bold tracking-wider uppercase text-sm">Für Kursanbieter & Experten</span>
                        <h1 className="text-5xl md:text-6xl font-heading font-bold leading-tight">
                            Verwandle dein Wissen in <span className="text-primary">Einkommen</span>.
                        </h1>
                        <p className="text-xl text-gray-300">
                            Die einfachste Plattform der Schweiz, um Kurse zu erstellen, zu verwalten und zu füllen. Keine technischen Vorkenntnisse nötig.
                        </p>
                        <div className="flex gap-4 pt-4">
                            <button onClick={() => handleCta('basic')} className="bg-primary hover:bg-orange-600 text-white px-8 py-4 rounded-full font-bold text-lg transition flex items-center shadow-lg hover:shadow-orange-500/20">
                                Kostenlos starten <ArrowRight className="ml-2 w-5 h-5"/>
                            </button>
                        </div>
                    </div>
                    <div className="md:w-1/2 bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl">
                        {/* Abstract UI Mockup */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                                <div>
                                    <div className="text-gray-400 text-sm">Monatsumsatz</div>
                                    <div className="text-3xl font-bold text-white">CHF 4'250.00</div>
                                </div>
                                <BarChart className="text-green-400 w-8 h-8"/>
                            </div>
                            <div className="space-y-3">
                                <div className="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                                    <span className="flex items-center text-gray-200"><Users className="w-4 h-4 mr-2 text-primary"/> Töpfern für Anfänger</span>
                                    <span className="text-green-400 font-bold">+ 12 Buchungen</span>
                                </div>
                                <div className="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                                    <span className="flex items-center text-gray-200"><Calendar className="w-4 h-4 mr-2 text-blue-400"/> Business Yoga</span>
                                    <span className="text-green-400 font-bold">+ 5 Buchungen</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pricing / Packages Section */}
            <div className="py-20 max-w-7xl mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold font-heading text-dark mb-4">Wähle dein Anbieter-Paket</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        Fair und transparent. Wähle das Paket, das zu deinem Kursvolumen passt.
                    </p>
                </div>

                {/* Pricing Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    
                    {/* BASIC */}
                    <div className="bg-white p-6 rounded-2xl border-t-4 border-green-500 shadow-lg hover:shadow-xl transition flex flex-col relative">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold font-heading text-gray-800">Basic</h3>
                            <div className="mt-2 text-3xl font-bold">0 CHF<span className="text-sm font-normal text-gray-500">/Jahr</span></div>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-600">
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1 shrink-0"/> Bis 3 aktive Kurse</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1 shrink-0"/> 15% Komm. (inkl. Stripe)</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1 shrink-0"/> Standard Listing</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1 shrink-0"/> Link auf eigene Website</li>
                        </ul>
                        <button onClick={() => handleCta('basic')} className="w-full py-2 border-2 border-green-500 text-green-700 font-bold rounded-lg hover:bg-green-50 transition">
                            Basic wählen
                        </button>
                    </div>

                    {/* PRO */}
                    <div className="bg-white p-6 rounded-2xl border-t-4 border-blue-500 shadow-lg hover:shadow-xl transition flex flex-col relative transform md:-translate-y-2">
                        <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">BELIEBT</div>
                        <div className="mb-4">
                            <h3 className="text-xl font-bold font-heading text-gray-800">Pro</h3>
                            <div className="mt-2 text-3xl font-bold text-blue-600">290 CHF<span className="text-sm font-normal text-gray-500">/Jahr</span></div>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-600">
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-blue-500 mr-2 mt-1 shrink-0"/> Bis 10 aktive Kurse</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-blue-500 mr-2 mt-1 shrink-0"/> 12% Komm. bei Buchung</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-blue-500 mr-2 mt-1 shrink-0"/> Besseres Ranking</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-blue-500 mr-2 mt-1 shrink-0"/> Kontaktformular</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-blue-500 mr-2 mt-1 shrink-0"/> Attraktivere Darstellung</li>
                        </ul>
                        <button onClick={() => handleCta('pro')} className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-md">
                            Pro wählen
                        </button>
                    </div>

                    {/* PREMIUM */}
                    <div className="bg-white p-6 rounded-2xl border-t-4 border-purple-500 shadow-lg hover:shadow-xl transition flex flex-col relative">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold font-heading text-gray-800">Premium</h3>
                            <div className="mt-2 text-3xl font-bold text-purple-600">590 CHF<span className="text-sm font-normal text-gray-500">/Jahr</span></div>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-600">
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-purple-500 mr-2 mt-1 shrink-0"/> Bis 30 aktive Kurse</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-purple-500 mr-2 mt-1 shrink-0"/> 10% Komm. bei Buchung</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-purple-500 mr-2 mt-1 shrink-0"/> <strong>Top Ranking</strong></li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-purple-500 mr-2 mt-1 shrink-0"/> Badge "Empfohlen"</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-purple-500 mr-2 mt-1 shrink-0"/> Newsletter Präsenz</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-purple-500 mr-2 mt-1 shrink-0"/> Reporting Dashboard</li>
                        </ul>
                        <button onClick={() => handleCta('premium')} className="w-full py-2 border-2 border-purple-500 text-purple-700 font-bold rounded-lg hover:bg-purple-50 transition">
                            Premium wählen
                        </button>
                    </div>

                    {/* ENTERPRISE */}
                    <div className="bg-white p-6 rounded-2xl border-t-4 border-orange-500 shadow-lg hover:shadow-xl transition flex flex-col relative">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold font-heading text-gray-800">Enterprise</h3>
                            <div className="mt-2 text-3xl font-bold text-orange-600">ab 1'190 CHF<span className="text-sm font-normal text-gray-500">/Jahr</span></div>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-600">
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-orange-500 mr-2 mt-1 shrink-0"/> <strong>Unbegrenzte Kurse</strong></li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-orange-500 mr-2 mt-1 shrink-0"/> 8% Komm. bei Buchung</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-orange-500 mr-2 mt-1 shrink-0"/> Beste Platzierung</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-orange-500 mr-2 mt-1 shrink-0"/> Eigene Landingpage</li>
                            <li className="flex items-start"><CheckCircle className="w-4 h-4 text-orange-500 mr-2 mt-1 shrink-0"/> Personal Account Mgr.</li>
                        </ul>
                        <button onClick={() => handleCta('enterprise')} className="w-full py-2 border-2 border-orange-500 text-orange-700 font-bold rounded-lg hover:bg-orange-50 transition">
                            Kontaktieren
                        </button>
                    </div>
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

            {/* CTA Bottom */}
            <div className="bg-gray-50 py-20 border-t border-gray-200">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold font-heading text-dark mb-6">Bereit, durchzustarten?</h2>
                    <p className="text-xl text-gray-600 mb-8">Erstelle heute noch deinen ersten Kurs. Es dauert weniger als 10 Minuten.</p>
                    <button onClick={() => handleCta('basic')} className="bg-dark hover:bg-gray-800 text-white px-10 py-4 rounded-full font-bold text-lg transition shadow-xl">
                        Jetzt Anbieter werden
                    </button>
                </div>
            </div>
            
            {/* Schema.org for B2B Page */}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebPage",
                "name": "KursNavi Teacher Hub",
                "description": "Plattform für Kursanbieter in der Schweiz.",
                "audience": {
                    "@type": "BusinessAudience",
                    "audienceType": "Course Instructors, Teachers, Coaches"
                }
            })}} />
        </div>
    );
};

export default TeacherHub;