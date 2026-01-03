import React from 'react';
import { Mail, Search, BookOpen, BarChart, CheckCircle } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Navigation Dummy */}
      <nav className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-600">KursNavi</div>
          <a href="mailto:info@kursnavi.ch" className="text-gray-600 hover:text-blue-600 font-medium">
            Kontakt
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 flex flex-col lg:flex-row items-center">
          <div className="lg:w-1/2 lg:pr-12">
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 mb-6">
              Die zentrale Plattform für <span className="text-blue-600">Schweizer Bildungsangebote</span>.
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              KursNavi revolutioniert, wie die Schweiz lernt. Wir bündeln Kurse, Workshops und Weiterbildungen von Top-Anbietern an einem Ort – transparent, vergleichbar und einfach zu buchen.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button disabled className="px-8 py-4 bg-blue-600 text-white font-bold rounded-lg shadow-lg opacity-80 cursor-not-allowed">
                Bald verfügbar
              </button>
              <a href="mailto:info@kursnavi.ch" className="px-8 py-4 bg-white text-blue-600 border border-blue-200 font-bold rounded-lg hover:bg-blue-50 transition shadow-sm text-center">
                Als Anbieter partnern
              </a>
            </div>
          </div>
          {/* Screenshot Placeholder Hero */}
          <div className="lg:w-1/2 mt-12 lg:mt-0 relative">
            <div className="rounded-xl shadow-2xl bg-gray-800 border-4 border-gray-800 overflow-hidden aspect-video flex items-center justify-center text-white/50">
                <div className="text-center">
                    <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <span className="text-lg font-mono">Screenshot: Intelligente Kurssuche</span>
                </div>
            </div>
          </div>
        </div>
      </header>

      {/* Value Proposition */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Warum KursNavi?</h2>
            <p className="mt-4 text-lg text-gray-600">Wir lösen das Chaos im Bildungsmarkt.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-6">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Zentrale Suche</h3>
              <p className="text-gray-600">
                Schluss mit dem Durchsuchen von hunderten Webseiten. Finden Sie den passenden Kurs basierend auf Thema, Ort und Preis in Sekunden.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-6">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Transparenz</h3>
              <p className="text-gray-600">
                Vergleichen Sie Inhalte und Anbieter objektiv. Keine versteckten Kosten, klare Strukturen und verifizierte Informationen.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-6">
                <BarChart className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Für Anbieter</h3>
              <p className="text-gray-600">
                Erreichen Sie genau die Zielgruppe, die nach Weiterbildung sucht. Nutzen Sie unser "Teacher Hub" für maximale Sichtbarkeit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshot Showcase Section */}
      <section className="py-20 bg-white border-t border-gray-200">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center gap-12">
                <div className="md:w-1/2">
                     <div className="rounded-xl shadow-2xl bg-gray-100 border border-gray-200 overflow-hidden aspect-[4/3] flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <span className="text-lg font-mono">Screenshot: Kurs Detailansicht</span>
                        </div>
                    </div>
                </div>
                <div className="md:w-1/2">
                    <h2 className="text-3xl font-bold text-gray-900 mb-6">Einblicke in die Plattform</h2>
                    <ul className="space-y-4">
                        <li className="flex items-start">
                            <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-1" />
                            <span className="text-lg text-gray-700">Detaillierte Kursbeschreibungen mit direkter Buchungsoption.</span>
                        </li>
                        <li className="flex items-start">
                            <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-1" />
                            <span className="text-lg text-gray-700">Smarte Filterung nach Kanton, Datum und Kategorie.</span>
                        </li>
                        <li className="flex items-start">
                            <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-1" />
                            <span className="text-lg text-gray-700">Optimiert für Desktop und Mobile.</span>
                        </li>
                    </ul>
                </div>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; {new Date().getFullYear()} KursNavi Schweiz. Alle Rechte vorbehalten.</p>
          <p className="mt-2 text-sm">Adligenswil, Luzern</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;