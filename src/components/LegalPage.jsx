import React from 'react';
import { ArrowLeft, ShieldCheck, Scale, FileText, Undo2, BadgeCheck } from 'lucide-react';

const LEGAL_CONTENT = {
  de: {
    back_btn: "Zurück",
    updated_at: "Zuletzt aktualisiert: Oktober 2024",
    agb: {
      title: "Allgemeine Geschäftsbedingungen (AGB)",
      company: "LifeSkills360 GmbH",
      sections: [
        { heading: "1. Geltungsbereich", text: "Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung der Plattform LifeSkills360 (nachfolgend „Plattform“) durch registrierte und nicht registrierte Nutzerinnen und Nutzer (nachfolgend „Teilnehmer“) sowie Kursanbieter (nachfolgend „Anbieter“).\n\nBetreiberin der Plattform ist die LifeSkills360 GmbH, Talrain 25, 6043 Adligenswil, Schweiz.\n\nAbweichende Bedingungen gelten nur, wenn sie von uns ausdrücklich schriftlich bestätigt wurden." },
        { heading: "2. Rolle von LifeSkills360", text: "2.1 Wir stellen eine Plattform zur Verfügung, auf der Anbieter Kurse einstellen und Teilnehmer diese buchen können.\n2.2 Wir sind in der Regel Vermittlerin. Der Kursvertrag kommt direkt zwischen Teilnehmer und Anbieter zustande.\n2.3 Die Verantwortung für Durchführung und Qualität liegt beim Anbieter." },
        { heading: "3. Registrierung", text: "Die Nutzung bestimmter Funktionen erfordert ein Konto. Daten müssen wahrheitsgetreu sein. Konten sind nicht übertragbar." },
        { heading: "4. Leistungen & Verfügbarkeit", text: "Wir ermöglichen Suche und Buchung. Wir prüfen die Plausibilität der Kurse, garantieren aber keine Vollständigkeit. Es besteht kein Anspruch auf 100%ige Verfügbarkeit der Plattform." },
        { heading: "5. Vertragsschluss", text: "Die Darstellung ist kein bindendes Angebot. Der Vertrag kommt mit der Buchungsbestätigung zustande." },
        { heading: "6. Preise & Zahlung", text: "Preise sind inkl. MwSt. (sofern nicht anders angegeben). Zahlungen erfolgen über externe Dienstleister wie Stripe." },
        { heading: "7. Stornierung", text: "Es gelten die auf der Kursseite angegebenen Bedingungen. Stornierungen müssen über die Plattform erfolgen." },
        { heading: "8. Bewertungen", text: "Bewertungen müssen sachlich und wahrheitsgemäß sein. Wir dürfen rechtswidrige Inhalte löschen." },
        { heading: "11. Haftung", text: "Wir haften unbeschränkt bei Vorsatz/grober Fahrlässigkeit. Wir haften nicht für die Durchführung der Kurse durch die Anbieter." },
        { heading: "14. Recht & Gerichtsstand", text: "Es gilt materielles Recht der Schweiz. Gerichtsstand ist der Sitz der LifeSkills360 GmbH." }
      ]
    },
    datenschutz: {
      title: "Datenschutzerklärung",
      company: "LifeSkills360 GmbH",
      sections: [
        { heading: "1. Verantwortliche Stelle", text: "LifeSkills360 GmbH, Talrain 25, 6043 Adligenswil, Schweiz. Mail: info@kursnavi.ch" },
        { heading: "2. Datenkategorien", text: "Wir verarbeiten Stammdaten, Kontodaten, Kursdaten, Zahlungsdaten sowie Kommunikations- und Nutzungsdaten (IP-Adressen, Cookies)." },
        { heading: "3. Zweck der Verarbeitung", text: "Betrieb der Plattform, Abwicklung von Buchungen, Sicherheit und (mit Einwilligung) Marketing." },
        { heading: "4. Weitergabe", text: "Daten gehen an Kursanbieter (zur Durchführung), Zahlungsdienstleister und IT-Provider." },
        { heading: "7. Ihre Rechte", text: "Sie haben Recht auf Auskunft, Berichtigung, Löschung und Widerspruch. Kontaktieren Sie uns unter info@kursnavi.ch." }
      ]
    },
    impressum: {
      title: "Impressum",
      company: "LifeSkills360 GmbH",
      sections: [
        { heading: "Betreiberin", text: "LifeSkills360 GmbH\nTalrain 25\n6043 Adligenswil\nSchweiz\n\nE-Mail: info@kursnavi.ch\nHandelsregister: Kanton Luzern\nUID: CHE-346.993.844\nVertreten durch: Raphael Suter" }
      ]
    },
    widerruf: {
      title: "Widerruf & Stornierung",
      company: "LifeSkills360 GmbH",
      sections: [
        { heading: "1. Gesetzlicher Widerruf", text: "Bei Freizeitbetätigungen mit fixem Termin (Kurse) besteht häufig kein gesetzliches Widerrufsrecht." },
        { heading: "2. Vertragliche Stornierung", text: "Standardregel (sofern nicht anders angegeben):\n- Bis 14 Tage vor Beginn: 100% Erstattung\n- 13 bis 7 Tage: 50% Erstattung\n- Weniger als 7 Tage: Keine Erstattung" },
        { heading: "3. Absage durch Anbieter", text: "Wird ein Kurs vom Anbieter abgesagt, erhalten Sie 100% Ihrer Zahlung zurück." }
      ]
    },
    trust: {
      title: "Vertrauen & Sicherheit",
      company: "LifeSkills360 GmbH",
      sections: [
        { heading: "1. Identitätsprüfung", text: "Wir führen bei jedem Anbieter einen Basischeck der Identität und der Kontaktdaten durch." },
        { heading: "2. Verifiziertes Label", text: "Anbieter mit diesem Label wurden manuell geprüft. Dies erhöht die Transparenz, ist aber keine staatliche Zertifizierung." },
        { heading: "3. Sichere Zahlungen", text: "Ihre Daten werden verschlüsselt über Stripe verarbeitet. Wir speichern keine Kreditkartendaten selbst." }
      ]
    }
  },
  en: {
    back_btn: "Back",
    updated_at: "Last updated: October 2024",
    agb: { title: "Terms and Conditions", company: "LifeSkills360 GmbH", sections: [{ heading: "1. Scope", text: "These terms govern the use of KursNavi..." }] },
    datenschutz: { title: "Privacy Policy", company: "LifeSkills360 GmbH", sections: [{ heading: "1. Data Control", text: "Responsible: LifeSkills360 GmbH, Switzerland." }] },
    impressum: { title: "Imprint", company: "LifeSkills360 GmbH", sections: [{ heading: "Operator", text: "LifeSkills360 GmbH, Adligenswil." }] },
    widerruf: { title: "Withdrawal & Cancellation", company: "LifeSkills360 GmbH", sections: [{ heading: "1. Policy", text: "For fixed-date leisure activities, statutory withdrawal rights usually do not apply." }] },
    trust: { title: "Trust & Safety", company: "LifeSkills360 GmbH", sections: [{ heading: "1. Verification", text: "We verify every provider on our platform." }] }
  },
  fr: { back_btn: "Retour", updated_at: "Mise à jour: Octobre 2024", agb: { title: "Conditions Générales", company: "LifeSkills360 GmbH", sections: [{ heading: "1. Portée", text: "Ces conditions régissent l'utilisation de KursNavi..." }] } },
  it: { back_btn: "Indietro", updated_at: "Aggiornato: Ottobre 2024", agb: { title: "Termini e Condizioni", company: "LifeSkills360 GmbH", sections: [{ heading: "1. Ambito", text: "Questi termini regolano l'uso di KursNavi..." }] } }
};

const LegalPage = ({ pageKey, lang = 'de', setView }) => {
  const langData = LEGAL_CONTENT[lang] || LEGAL_CONTENT['de'];
  const content = langData[pageKey] || LEGAL_CONTENT['de'][pageKey];

  if (!content) {
    return (
      <div className="min-h-screen bg-[#FAF5F0] flex items-center justify-center p-10">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">Content not found</h2>
          <button onClick={() => setView('home')} className="mt-4 text-[#FA6E28] font-bold">Back to Home</button>
        </div>
      </div>
    );
  }

  const getIcon = () => {
    switch (pageKey) {
      case 'agb': return <Scale className="w-8 h-8 text-[#FA6E28]" />;
      case 'datenschutz': return <ShieldCheck className="w-8 h-8 text-[#FA6E28]" />;
      case 'impressum': return <FileText className="w-8 h-8 text-[#FA6E28]" />;
      case 'widerruf': return <Undo2 className="w-8 h-8 text-[#FA6E28]" />;
      case 'trust': return <BadgeCheck className="w-8 h-8 text-[#FA6E28]" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF5F0] py-12 px-4 font-['Hind_Madurai']">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        <div className="px-8 py-8 border-b border-gray-100 bg-white">
          <button onClick={() => setView('home')} className="inline-flex items-center text-gray-400 hover:text-[#FA6E28] mb-6 transition-colors text-sm font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" /> {langData.back_btn}
          </button>
          <div className="flex items-center gap-4">
            {getIcon()}
            <div>
              <h1 className="text-3xl font-extrabold text-[#333333] font-['Open_Sans']">{content.title}</h1>
              <p className="mt-1 text-sm text-gray-500 font-medium">{content.company}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-10 space-y-10">
          {content.sections.map((section, index) => (
            <div key={index} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
              <h2 className="text-lg font-bold text-[#333333] mb-3 font-['Open_Sans'] flex items-center">
                <span className="w-1.5 h-6 bg-[#FA6E28] mr-3 rounded-full hidden md:block"></span>
                {section.heading}
              </h2>
              <div className="text-gray-600 leading-relaxed whitespace-pre-wrap text-base pl-0 md:pl-4">
                {section.text}
              </div>
            </div>
          ))}
        </div>

        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-gray-400 text-xs font-medium">{langData.updated_at}</span>
          <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">{content.company}</span>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;