import React, { useEffect } from 'react';
import { CheckCircle, BarChart, Users, Calendar, ArrowRight, DollarSign } from 'lucide-react';

const TeacherHub = ({ setView, t, user }) => {
    
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

    const handleCta = () => {
        if (user) {
            setView('create');
        } else {
            setView('login');
        }
        window.scrollTo(0,0);
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
                            <button onClick={handleCta} className="bg-primary hover:bg-orange-600 text-white px-8 py-4 rounded-full font-bold text-lg transition flex items-center shadow-lg hover:shadow-orange-500/20">
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

            {/* Benefits Section */}
            <div className="py-20 max-w-7xl mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold font-heading text-dark mb-4">Warum KursNavi?</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">Wir kümmern uns um Marketing, Zahlungen und Administration. Du kümmerst dich um deine Teilnehmer.</p>
                </div>
                
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="bg-beige p-8 rounded-2xl border border-orange-100 hover:shadow-lg transition">
                        <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <Users className="w-6 h-6 text-primary"/>
                        </div>
                        <h3 className="text-xl font-bold mb-3 font-heading">Mehr Reichweite</h3>
                        <p className="text-gray-600">Deine Kurse erscheinen automatisch in der lokalen Suche und in relevanten Kategorien. Erreiche neue Zielgruppen ohne Ad-Spend.</p>
                    </div>
                    <div className="bg-beige p-8 rounded-2xl border border-orange-100 hover:shadow-lg transition">
                        <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <CheckCircle className="w-6 h-6 text-blue-600"/>
                        </div>
                        <h3 className="text-xl font-bold mb-3 font-heading">Automatisierte Admin</h3>
                        <p className="text-gray-600">Buchungsbestätigungen, Teilnehmerlisten und Rechnungen werden automatisch generiert. Spar dir den Papierkram.</p>
                    </div>
                    <div className="bg-beige p-8 rounded-2xl border border-orange-100 hover:shadow-lg transition">
                        <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <DollarSign className="w-6 h-6 text-green-600"/>
                        </div>
                        <h3 className="text-xl font-bold mb-3 font-heading">Sichere Auszahlung</h3>
                        <p className="text-gray-600">Kein Risiko. Wir verarbeiten Zahlungen sicher und zahlen deine Einnahmen pünktlich aus. Keine Fixkosten, nur Provision bei Erfolg.</p>
                    </div>
                </div>
            </div>

            {/* CTA Bottom */}
            <div className="bg-gray-50 py-20 border-t border-gray-200">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold font-heading text-dark mb-6">Bereit, durchzustarten?</h2>
                    <p className="text-xl text-gray-600 mb-8">Erstelle heute noch deinen ersten Kurs. Es dauert weniger als 10 Minuten.</p>
                    <button onClick={handleCta} className="bg-dark hover:bg-gray-800 text-white px-10 py-4 rounded-full font-bold text-lg transition shadow-xl">
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