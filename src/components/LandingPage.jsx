import React from 'react';
import { 
  TrendingUp, 
  Users, 
  CheckCircle, 
  LayoutDashboard, 
  MousePointerClick, 
  BarChart,
  Search,
  Monitor
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-gray-900 selection:bg-orange-100">
      
      {/* --- NAVIGATION --- */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold tracking-tight text-gray-900">
            Kurs<span className="text-blue-600">Navi</span>
          </div>
          <div className="flex gap-4">
             <a href="mailto:info@kursnavi.ch" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors py-2">
               Kontakt
             </a>
             <a 
               href="mailto:info@kursnavi.ch?subject=Partner%20Werden" 
               className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition shadow-sm"
             >
               Partner werden
             </a>
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <header className="relative overflow-hidden pt-16 pb-12 lg:pt-24 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6 border border-blue-100">
            Schweizer Bildungsplattform
          </span>
          <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
            Ihre Kurse verdienen <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">
              maximale Sichtbarkeit.
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            KursNavi ist der zentrale Marktplatz, der Bildungsanbieter direkt mit Suchenden verbindet. Ohne Technik-Frust, dafür mit klarer Reichweite.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <a 
              href="mailto:info@kursnavi.ch?subject=Partner%20Anfrage" 
              className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition transform hover:-translate-y-1"
            >
              Jetzt listen lassen
            </a>
            <button className="px-8 py-4 bg-white text-gray-700 font-bold border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              Mehr erfahren
            </button>
          </div>

          {/* MAIN HERO IMAGE (Suchseite) */}
          <div className="relative max-w-5xl mx-auto">
             <div className="absolute inset-0 bg-blue-600 blur-[100px] opacity-20 rounded-full"></div>
             <div className="relative rounded-xl shadow-2xl border-4 border-white overflow-hidden bg-gray-100">
                <img 
                  src="/images/Suchseite.jpg" 
                  alt="KursNavi Suche Vorschau" 
                  className="w-full h-auto object-cover"
                />
             </div>
             <p className="mt-4 text-sm text-gray-400">Vorschau: Die intelligente Kurssuche</p>
          </div>
        </div>
      </header>

      {/* --- FEATURE GRID & SCREENSHOTS --- */}
      <section className="py-20 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           
           {/* Feature 1: Detailansicht */}
           <div className="flex flex-col lg:flex-row items-center gap-16 mb-24">
              <div className="lg:w-1/2 order-2 lg:order-1">
                 <div className="rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                    <img 
                      src="/images/Course Detail.jpg" 
                      alt="Kurs Detailansicht" 
                      className="w-full h-auto"
                    />
                 </div>
              </div>
              <div className="lg:w-1/2 order-1 lg:order-2">
                 <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-6">
                    <Monitor className="w-6 h-6" />
                 </div>
                 <h2 className="text-3xl font-bold text-gray-900 mb-4">Professionelle Präsentation</h2>
                 <p className="text-lg text-gray-600 mb-6">
                    Ihre Kurse werden übersichtlich und attraktiv dargestellt. Nutzer finden alle wichtigen Infos auf einen Blick – vom Inhalt bis zur Buchung.
                 </p>
                 <ul className="space-y-3">
                    <li className="flex items-center text-gray-700">
                       <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                       Optimiert für Google (SEO)
                    </li>
                    <li className="flex items-center text-gray-700">
                       <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                       Klare Call-to-Actions
                    </li>
                 </ul>
              </div>
           </div>

           {/* Feature 2: Dashboard */}
           <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2">
                 <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-6">
                    <LayoutDashboard className="w-6 h-6" />
                 </div>
                 <h2 className="text-3xl font-bold text-gray-900 mb-4">Volle Kontrolle im Cockpit</h2>
                 <p className="text-lg text-gray-600 mb-6">
                    Verwalten Sie Ihre Kurse und Buchungen zentral. Unser Dashboard gibt Ihnen Einblicke in Klicks und Performance.
                 </p>
                 <ul className="space-y-3">
                    <li className="flex items-center text-gray-700">
                       <CheckCircle className="w-5 h-5 text-purple-500 mr-3" />
                       Einfache Kursverwaltung
                    </li>
                    <li className="flex items-center text-gray-700">
                       <CheckCircle className="w-5 h-5 text-purple-500 mr-3" />
                       Performance-Statistiken
                    </li>
                 </ul>
              </div>
              <div className="lg:w-1/2">
                 <div className="rounded-xl shadow-xl border border-gray-200 overflow-hidden bg-gray-50">
                    <img 
                      src="/images/dashboard-preview.jpg" 
                      alt="Anbieter Dashboard" 
                      className="w-full h-auto"
                    />
                 </div>
              </div>
           </div>

        </div>
      </section>

      {/* --- PRICING SECTION --- */}
      <section className="py-24 bg-[#FDFBF7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Partner werden</h2>
            <p className="mt-4 text-lg text-gray-600">
              Faire Konditionen für jede Größe. Starten Sie risikofrei und wachsen Sie mit uns.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            
            {/* PLAN: BASIC */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col hover:shadow-lg transition">
              <div className="mb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide bg-gray-100 px-2 py-1 rounded">Basic</span>
                <h3 className="text-4xl font-extrabold text-gray-900 mt-4">0 CHF</h3>
                <p className="text-sm text-gray-500 mt-1">Dauerhaft kostenloser Einstieg</p>
              </div>
              <ul className="space-y-4 mb-8 flex-1 mt-6">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0" />
                  <span className="text-gray-700">Bis zu 3 aktive Kurse</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0" />
                  <span className="text-gray-700">Standard Listing</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0" />
                  <span className="text-gray-700">Link zur eigenen Website</span>
                </li>
                 <li className="flex items-start opacity-75">
                  <CheckCircle className="w-5 h-5 text-gray-300 mr-3 shrink-0" />
                  <span className="text-gray-500 text-sm">Standard Kommission bei Buchung</span>
                </li>
              </ul>
              <a href="mailto:info@kursnavi.ch?subject=Anfrage%20Basic" className="w-full py-3 bg-gray-50 border border-gray-200 text-gray-900 font-bold rounded-lg text-center hover:bg-gray-100 transition">
                Starten
              </a>
            </div>

            {/* PLAN: PROFESSIONAL (PRO + PREMIUM) */}
            <div className="bg-white border-2 border-blue-600 rounded-2xl p-8 shadow-2xl relative flex flex-col transform md:-translate-y-4">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                EMPFEHLUNG
              </div>
              <div className="mb-4">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wide bg-blue-50 px-2 py-1 rounded">Professional</span>
                <h3 className="text-4xl font-extrabold text-gray-900 mt-4">ab 24 CHF<span className="text-lg font-normal text-gray-400">/mtl.</span></h3>
                <p className="text-sm text-gray-500 mt-1">Für ambitionierte Anbieter</p>
              </div>
              <ul className="space-y-4 mb-8 flex-1 mt-6">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
                  <span className="text-gray-900 font-medium">Bis zu 30 aktive Kurse</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
                  <span className="text-gray-700">Bevorzugtes Ranking (SEO+)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
                  <span className="text-gray-700">Reduzierte Kommission</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
                  <span className="text-gray-700">Lead-Generierung & Statistik</span>
                </li>
              </ul>
              <a href="mailto:info@kursnavi.ch?subject=Anfrage%20Professional" className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg text-center hover:bg-blue-700 transition shadow-md">
                Jetzt anfragen
              </a>
            </div>

            {/* PLAN: ENTERPRISE */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col hover:shadow-lg transition">
              <div className="mb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide bg-gray-100 px-2 py-1 rounded">Enterprise</span>
                <h3 className="text-4xl font-extrabold text-gray-900 mt-4">Individuell</h3>
                <p className="text-sm text-gray-500 mt-1">Für Schulen & Akademien</p>
              </div>
              <ul className="space-y-4 mb-8 flex-1 mt-6">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
                  <span className="text-gray-700">Unbegrenzte Kurse</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
                  <span className="text-gray-700">Top-Listing ("Empfohlen")</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
                  <span className="text-gray-700">Eigene Landingpage</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
                  <span className="text-gray-700">Persönlicher Account Manager</span>
                </li>
              </ul>
              <a href="mailto:info@kursnavi.ch?subject=Anfrage%20Enterprise" className="w-full py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg text-center hover:bg-gray-50 transition">
                Kontaktieren
              </a>
            </div>

          </div>
          
          <p className="text-center text-sm text-gray-400 mt-10 max-w-2xl mx-auto">
            * Preise bei jährlicher Abrechnung. Die Pläne "Pro" (bis 10 Kurse) und "Premium" (bis 30 Kurse) bieten flexible Upgrade-Möglichkeiten.
          </p>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-[#1A1A1A] text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-6 md:mb-0">
            <span className="text-2xl font-bold text-white">Kurs<span className="text-blue-500">Navi</span></span>
            <p className="mt-2 text-sm">Adligenswil, Luzern</p>
          </div>
          <div className="flex space-x-8 text-sm">
             <a href="mailto:info@kursnavi.ch" className="hover:text-white transition">Kontakt</a>
             <span className="text-gray-600">|</span>
             <span className="hover:text-white transition cursor-not-allowed">AGB</span>
             <span className="text-gray-600">|</span>
             <span className="hover:text-white transition cursor-not-allowed">Datenschutz</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mt-8 text-xs text-gray-600">
          &copy; {new Date().getFullYear()} KursNavi Schweiz. Alle Rechte vorbehalten.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;