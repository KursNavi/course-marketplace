import React from 'react';
import { ArrowLeft } from 'lucide-react';

// --- HIER SIND DIE TEXTE DIREKT INTEGRIERT ---
const LEGAL_CONTENT = {
  agb: {
    title: "Allgemeine Geschäftsbedingungen (AGB)",
    company: "LifeSkills360 GmbH",
    sections: [
      {
        heading: "1. Geltungsbereich",
        text: "Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung der Plattform LifeSkills360 (nachfolgend „Plattform“) durch registrierte und nicht registrierte Nutzerinnen und Nutzer (nachfolgend „Teilnehmer“) sowie Kursanbieter (nachfolgend „Anbieter“).\n\nBetreiberin der Plattform ist die:\nLifeSkills360 GmbH\nTalrain 25\n6043 Adligenswil\nSchweiz\n(nachfolgend „LifeSkills360“, „wir“, „uns“).\n\nAbweichende Bedingungen von Teilnehmern oder Anbietern gelten nur, wenn sie von LifeSkills360 ausdrücklich schriftlich bestätigt wurden."
      },
      {
        heading: "2. Rolle von LifeSkills360",
        text: "2.1 LifeSkills360 stellt eine Online-Plattform zur Verfügung, auf der Anbieter offline stattfindende Kurse und Weiterbildungen einstellen und Teilnehmer solche Kurse suchen, buchen und bezahlen können.\n2.2 LifeSkills360 ist in der Regel Vermittlerin zwischen Teilnehmern und Anbietern. Der Kursvertrag kommt grundsätzlich direkt zwischen Teilnehmer und Anbieter zustande.\n2.3 Soweit LifeSkills360 Zahlungen entgegennimmt, erfolgt dies im Namen und auf Rechnung des jeweiligen Anbieters.\n2.4 Die Verantwortung für Inhalt, Durchführung und Qualität der Kurse liegt beim jeweiligen Anbieter."
      },
      {
        heading: "3. Registrierung und Nutzerkonto",
        text: "3.1 Die Nutzung bestimmter Funktionen erfordert eine Registrierung.\n3.2 Daten müssen vollständig und wahrheitsgetreu angegeben werden.\n3.3 Nutzerkonten sind nicht übertragbar.\n3.4 LifeSkills360 kann Nutzerkonten bei Missbrauch sperren."
      },
      {
        heading: "4. Leistungen der Plattform",
        text: "4.1 LifeSkills360 ermöglicht das Suchen, Vergleichen und Buchen von Kursen.\n4.2 Kursinformationen stammen von den Anbietern. Wir machen einen Plausibilitätscheck, garantieren aber keine Vollständigkeit.\n4.3 Es besteht kein Anspruch auf ständige Verfügbarkeit der Plattform."
      },
      {
        heading: "5. Buchung und Vertragsschluss",
        text: "5.1 Die Darstellung der Kurse ist kein bindendes Angebot. Ein Vertrag kommt erst mit der Buchungsbestätigung zustande.\n5.2 Teilnehmer müssen Kursbeschreibungen vor Buchung lesen.\n5.3 Die Bestätigung erfolgt per E-Mail."
      },
      {
        heading: "6. Preise und Zahlungen",
        text: "6.1 Preise verstehen sich inkl. MwSt., sofern nicht anders angegeben.\n6.2 Zahlung erfolgt über die angegebenen Zahlungsarten."
      },
      {
        heading: "7. Stornierung, Umbuchung und Widerruf",
        text: "7.1 Stornobedingungen stehen auf der Kursdetailseite.\n7.2 Gesetzliche Widerrufsrechte können bei Freizeitveranstaltungen mit fixem Termin ausgeschlossen sein.\n7.3 Stornierungen müssen über die Plattform erfolgen."
      },
      {
        heading: "8. Bewertungen und Nutzerinhalte",
        text: "8.1 Bewertungen sollen sachlich sein.\n8.2 LifeSkills360 darf rechtswidrige Inhalte löschen.\n8.3 Nutzer räumen LifeSkills360 Nutzungsrechte an ihren Inhalten ein."
      },
      {
        heading: "9. Pflichten der Teilnehmer",
        text: "Keine falschen Angaben, fristgerechte Zahlung, Einhaltung der Kursregeln, keine missbräuchliche Nutzung."
      },
      {
        heading: "10. Zusätzliche Bedingungen für Anbieter",
        text: "10.1 Anbieter müssen rechtsfähig sein.\n10.2 Anbieter haften für Kursbeschreibungen und Durchführung.\n10.3 LifeSkills360 führt einen Basischeck durch.\n10.4 Anbieter gewähren Nutzungsrechte an Bildern/Texten für Werbung."
      },
      {
        heading: "11. Haftung von LifeSkills360",
        text: "11.1 Unbeschränkte Haftung bei Vorsatz/grober Fahrlässigkeit.\n11.2 Bei leichter Fahrlässigkeit nur für Kardinalpflichten.\n11.3 Keine Haftung für die Durchführung der Kurse durch Anbieter."
      },
      {
        heading: "12. Geistiges Eigentum",
        text: "Inhalte der Plattform sind urheberrechtlich geschützt."
      },
      {
        heading: "13. Laufzeit und Kündigung",
        text: "Der Nutzungsvertrag läuft auf unbestimmte Zeit und ist jederzeit kündbar (vorbehaltlich laufender Buchungen)."
      },
      {
        heading: "14. Anwendbares Recht",
        text: "Es gilt materielles Recht der Schweiz. Gerichtsstand ist der Sitz von LifeSkills360."
      }
    ]
  },
  datenschutz: {
    title: "Datenschutzerklärung",
    company: "LifeSkills360 GmbH",
    sections: [
      {
        heading: "1. Verantwortliche Stelle",
        text: "LifeSkills360 GmbH\nTalrain 25, 6043 Adligenswil, Schweiz\nE-Mail: info@kursnavi.ch"
      },
      {
        heading: "2. Arten der verarbeiteten Daten",
        text: "Stammdaten, Kontodaten, Kursdaten, Zahlungsdaten, Kommunikationsdaten, Nutzungsdaten."
      },
      {
        heading: "3. Zwecke und Rechtsgrundlagen",
        text: "Betrieb der Plattform, Abwicklung von Buchungen, Sicherheit, Marketing (mit Einwilligung). Rechtsgrundlagen: Vertragserfüllung, berechtigtes Interesse, Einwilligung."
      },
      {
        heading: "4. Weitergabe von Daten",
        text: "Anbieter (für die Durchführung), Zahlungsdienstleister, IT-Dienstleister."
      },
      {
        heading: "5. Datenübermittlung ins Ausland",
        text: "Nur bei angemessenem Datenschutzniveau oder Einwilligung."
      },
      {
        heading: "6. Speicherdauer",
        text: "So lange wie für den Zweck erforderlich oder gesetzlich vorgeschrieben."
      },
      {
        heading: "7. Rechte der betroffenen Personen",
        text: "Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch. Kontakt: info@kursnavi.ch"
      },
      {
        heading: "8. Cookies",
        text: "Wir nutzen Cookies für Funktionalität und Analyse. Einstellungen können im Cookie-Banner vorgenommen werden."
      },
      {
        heading: "9. Datensicherheit",
        text: "Wir nutzen Verschlüsselung und Zugriffsbeschränkungen."
      }
    ]
  },
  impressum: {
    title: "Impressum",
    company: "LifeSkills360 GmbH",
    sections: [
      {
        heading: "Angaben gemäß Gesetz",
        text: "LifeSkills360 GmbH\nTalrain 25\n6043 Adligenswil\nSchweiz\n\nE-Mail: info@kursnavi.ch\nWeb: www.kursnavi.ch\n\nHandelsregister: [Nummer einfügen]\nUID: [CHE-Nummer einfügen]\nVertretungsberechtigte Person: [Name einfügen]"
      },
      {
        heading: "Haftungsausschluss",
        text: "Haftung für Inhalte: Wir übernehmen keine Gewähr für Richtigkeit, Vollständigkeit und Aktualität.\nHaftung für Links: Für Inhalte verlinkter Seiten ist der jeweilige Anbieter verantwortlich.\nUrheberrecht: Inhalte unterliegen dem Urheberrecht. Verbreitung nur mit Zustimmung."
      }
    ]
  },
  widerruf: {
    title: "Widerruf & Stornierung",
    company: "LifeSkills360 GmbH",
    sections: [
      {
        heading: "1. Gesetzliches Widerrufsrecht (EU)",
        text: "Für Freizeitbetätigungen mit spezifischem Termin besteht häufig kein gesetzliches Widerrufsrecht."
      },
      {
        heading: "2. Widerruf in der Schweiz",
        text: "Es besteht kein generelles gesetzliches Rücktrittsrecht für Kursbuchungen in der Schweiz."
      },
      {
        heading: "3. Vertragliche Stornierungsbedingungen",
        text: "Es gelten die auf der Kursdetailseite angegebenen Bedingungen. Standard-Regel (sofern nicht anders angegeben):\n- Bis 14 Tage vor Start: 100% Rückerstattung\n- 13-7 Tage vor Start: 50% Rückerstattung\n- Unter 7 Tage: Keine Rückerstattung"
      },
      {
        heading: "4. Absage durch Anbieter",
        text: "Bei Absage durch den Anbieter werden Zahlungen voll erstattet."
      }
    ]
  },
  trust: {
    title: "Vertrauen & Sicherheit",
    company: "LifeSkills360 GmbH",
    sections: [
      {
        heading: "Unsere Rolle",
        text: "LifeSkills360 ist Vermittlerin. Wir sorgen für sichere Buchung und Vergleichbarkeit."
      },
      {
        heading: "Basischeck & Verifizierung",
        text: "Wir prüfen Identität und Kontaktdaten aller Anbieter (Basischeck). Anbieter mit dem 'Verifiziert'-Label wurden zusätzlich manuell geprüft. Dies ist keine staatliche Zertifizierung."
      },
      {
        heading: "Sichere Zahlungen",
        text: "Zahlungen laufen über etablierte Dienstleister. Wir speichern keine Kreditkartendaten."
      },
      {
        heading: "Probleme?",
        text: "Kontaktiere uns unter info@kursnavi.ch, wir helfen bei der Lösungsfindung."
      }
    ]
  }
};

const LegalPage = ({ pageKey, setView }) => {
  const content = LEGAL_CONTENT[pageKey];

  if (!content) {
    return (
      <div className="min-h-screen bg-[#FAF5F0] flex items-center justify-center p-10">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">Inhalt nicht gefunden</h2>
          <p className="text-gray-500 mt-2">Die Seite "{pageKey}" existiert nicht oder ist leer.</p>
          <button onClick={() => setView('home')} className="mt-4 inline-block text-[#FA6E28] font-bold">Zurück zur Startseite</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF5F0] py-12 px-4 sm:px-6 lg:px-8 font-['Hind_Madurai']">
      <div className="max-w-3xl mx-auto bg-white shadow-xl sm:rounded-2xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-white px-8 py-8 border-b border-gray-100">
          <button onClick={() => setView('home')} className="inline-flex items-center text-gray-400 hover:text-[#FA6E28] mb-6 transition-colors text-sm font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
          </button>
          <h1 className="text-3xl font-extrabold text-[#333333] font-['Open_Sans']">
            {content.title}
          </h1>
          <p className="mt-2 text-sm text-gray-500 font-medium">
            {content.company}
          </p>
        </div>

        {/* Content Body */}
        <div className="px-8 py-8 space-y-10">
          {content.sections.map((section, index) => (
            <div key={index}>
              <h2 className="text-lg font-bold text-[#333333] mb-3 font-['Open_Sans']">
                {section.heading}
              </h2>
              <div className="text-gray-600 leading-relaxed whitespace-pre-wrap text-base">
                {section.text}
              </div>
            </div>
          ))}
        </div>

        {/* Footer of the card */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <span className="text-gray-400 text-xs font-medium">Zuletzt aktualisiert: Oktober 2024</span>
          <span className="text-gray-400 text-xs font-bold">LifeSkills360 GmbH</span>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;