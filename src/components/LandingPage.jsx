import React, { useState } from 'react';
import { Footer } from './components/Footer';
import { 
  CheckCircle, 
  Monitor,
  Search,
  Send,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';

const LandingPage = () => {
  // State für das Kontaktformular
  const [formData, setFormData] = useState({
    email: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Erstellt einen Mailto-Link, der das Mailprogramm öffnet
    const subject = encodeURIComponent("B2B Partner Anfrage via KursNavi");
    const body = encodeURIComponent(`Anfrage von: ${formData.email}\n\nNachricht:\n${formData.message}`);
    window.location.href = `mailto:info@kursnavi.ch?subject=${subject}&body=${body}`;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-gray-900 selection:bg-orange-100">
      
      {/* --- NAVIGATION --- */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold tracking-tight text-gray-900">
            Kurs<span className="text-blue-600">Navi</span>
          </div>
          <a 
            href="#contact" 
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            Kontakt aufnehmen
          </a>
        </div>
      </nav>

      {/* --- HERO SECTION (Startseite Bild) --- */}
      <header className="relative pt-16 pb-20 lg:pt-24 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <span className="inline-block py-1 px-3 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6 border border-blue-100">
            Schweizer Bildungsplattform
          </span>
          <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
            Bildung, die gefunden wird. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">
              Einfach. Zentral. Schweizerisch.
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            KursNavi bündelt die fragmentierte Schweizer Bildungslandschaft auf einer modernen Plattform. Für Anbieter bedeutet das: Weniger Admin, mehr Reichweite.
          </p>

          {/* HERO IMAGE: Die Startseite (Dashboard-Preview genannt) */}
          <div className="relative max-w-5xl mx-auto shadow-2xl rounded-xl border-4 border-white overflow-hidden bg-gray-100">
             <img 
               src="/images/dashboard-preview.jpg" 
               alt="KursNavi Startseite" 
               className="w-full h-auto object-cover"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
          </div>
          <p className="mt-4 text-sm text-gray-400">Vorschau: Die KursNavi Startseite</p>
        </div>
      </header>

      {/* --- HOW IT WORKS (Screenshots) --- */}
      <section className="py-24 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-20">
              <h2 className="text-3xl font-bold text-gray-900">So erleben Nutzer Ihre Kurse</h2>
              <p className="mt-4 text-lg text-gray-600">Optimiert für schnelle Suche und klare Entscheidungen.</p>
           </div>
           
           {/* Step 1: Suche */}
           <div className="flex flex-col lg:flex-row items-center gap-16 mb-32">
              <div className="lg:w-1/2">
                 <div className="rounded-xl shadow-xl border border-gray-200 overflow-hidden transform hover:scale-[1.02] transition duration-500">
                    <img 
                      src="/images/Suchseite.jpg" 
                      alt="Intelligente Suche" 
                      className="w-full h-auto"
                    />
                 </div>
              </div>
              <div className="lg:w-1/2">
                 <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-6">
                    <Search className="w-6 h-6" />
                 </div>
                 <h3 className="text-2xl font-bold text-gray-900 mb-4">Gefunden werden, statt suchen lassen</h3>
                 <p className="text-lg text-gray-600 mb-6">
                    Unsere Suche filtert blitzschnell nach Thema, Ort, Preis und Zielgruppe. Ihr Kurs erscheint genau dann, wenn das Interesse am höchsten ist.
                 </p>
                 <ul className="space-y-3">
                    <li className="flex items-center text-gray-700 font-medium">
                       <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                       Regionale Filterung (Kantone)
                    </li>
                    <li className="flex items-center text-gray-700 font-medium">
                       <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                       Kategorien-Matching
                    </li>
                 </ul>
              </div>
           </div>

           {/* Step 2: Detail */}
           <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2 order-2 lg:order-1">
                 <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-6">
                    <Monitor className="w-6 h-6" />
                 </div>
                 <h3 className="text-2xl font-bold text-gray-900 mb-4">Ihr Auftritt: Professionell & Überzeugend</h3>
                 <p className="text-lg text-gray-600 mb-6">
                    Die Detailseite ist Ihre Visitenkarte. Bilder, Beschreibungen und direkte Buchungsoptionen sind conversion-optimiert angeordnet.
                 </p>
                 <ul className="space-y-3">
                    <li className="flex items-center text-gray-700 font-medium">
                       <CheckCircle className="w-5 h-5 text-purple-500 mr-3" />
                       SEO-optimierte Struktur
                    </li>
                    <li className="flex items-center text-gray-700 font-medium">
                       <CheckCircle className="w-5 h-5 text-purple-500 mr-3" />
                       Direkte Kontaktmöglichkeiten
                    </li>
                 </ul>
              </div>
              <div className="lg:w-1/2 order-1 lg:order-2">
                 <div className="rounded-xl shadow-xl border border-gray-200 overflow-hidden transform hover:scale-[1.02] transition duration-500">
                    <img 
                      src="/images/Course Detail.jpg" 
                      alt="Kurs Detailansicht" 
                      className="w-full h-auto"
                    />
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* --- PRICING STRATEGY (Abstract) --- */}
      <section className="py-24 bg-[#FDFBF7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Unser Partner-Modell</h2>
          <p className="text-xl text-gray-600 mb-12 leading-relaxed">
            Wir glauben an faire Partnerschaften. Deshalb gibt es bei uns keine versteckten Kosten oder komplizierte Verträge. Unser Modell skaliert mit Ihrem Erfolg.
          </p>

          <div className="grid md:grid-cols-2 gap-8 text-left">
             {/* Box 1: Free */}
             <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-green-500"></div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic (Kostenlos)</h3>
                <p className="text-gray-500 mb-6">Der risikofreie Einstieg.</p>
                <p className="text-gray-700 mb-4">
                  Ideal, um KursNavi kennenzulernen. Listen Sie Ihre wichtigsten Kurse kostenfrei und profitieren Sie sofort von unserer Plattform-Reichweite.
                </p>
                <div className="flex items-center text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                   <ShieldCheck className="w-5 h-5 mr-2" />
                   Keine monatlichen Fixkosten
                </div>
             </div>

             {/* Box 2: Premium Options */}
             <div className="bg-white p-8 rounded-2xl border border-blue-200 shadow-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Premium Optionen</h3>
                <p className="text-gray-500 mb-6">Für mehr Wachstum.</p>
                <p className="text-gray-700 mb-4">
                  Sie möchten mehr Sichtbarkeit, bessere Rankings oder detaillierte Statistiken? Unsere Zusatzpakete sind modular buchbar, wenn Sie sie brauchen.
                </p>
                <div className="flex items-center text-sm text-blue-700 bg-blue-50 p-3 rounded-lg">
                   <TrendingUp className="w-5 h-5 mr-2" />
                   Individuell skalierbar
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* --- CONTACT FORM --- */}
      <section id="contact" className="py-24 bg-white border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900">Interesse geweckt?</h2>
              <p className="mt-4 text-gray-600">
                 Schreiben Sie uns für Details zu den Konditionen oder eine persönliche Demo.
              </p>
           </div>

           <div className="bg-gray-50 p-8 rounded-2xl border border-gray-200 shadow-inner">
              <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Ihre E-Mail Adresse</label>
                    <input 
                      type="email" 
                      name="email"
                      id="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="name@firma.ch"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                 </div>
                 <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">Ihre Nachricht / Anfrage</label>
                    <textarea 
                      name="message"
                      id="message"
                      rows="4"
                      required
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Ich interessiere mich für eine Partnerschaft..."
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    ></textarea>
                 </div>
                 <button 
                   type="submit"
                   className="w-full flex justify-center items-center px-8 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition transform hover:-translate-y-1"
                 >
                    <Send className="w-5 h-5 mr-2" />
                    Anfrage absenden
                 </button>
                 <p className="text-xs text-center text-gray-500 mt-4">
                    Durch Klick öffnet sich Ihr Standard-Mailprogramm mit der vorbereiteten Nachricht an info@kursnavi.ch.
                 </p>
              </form>
           </div>
        </div>
      </section>

      {/* --- NEW FOOTER WITH NEWSLETTER --- */}
      <Footer />
    </div>
  );
};

export default LandingPage;