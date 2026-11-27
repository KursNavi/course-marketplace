/**
 * Datenschutzerklärung KI-Suche (27.11.2026): Ergänzungen in allen vier Sprachen
 * mit übereinstimmenden Kernaussagen; nicht blockierende Hinweiszeile in der KI-Suche.
 * Keine Netzaufrufe, keine Modellaufrufe.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { LEGAL_CONTENT } from '../src/lib/legalText.js';

const LANGS = ['de', 'en', 'fr', 'it'];
const section = (lang, nr) => LEGAL_CONTENT[lang].datenschutz.sections.find((s) => s.heading.startsWith(`${nr}.`)).text;

/** Je Sprache die Kernaussagen als Muster; jede Aussage muss in jeder Sprache vorkommen. */
const FACTS = {
  // Abschnitt 2: Datenkategorien, Ergebnis, vorgesehene Nutzung durch Erwachsene, Eltern
  s2: {
    de: [/KI-Suche/, /Suchvorgaben \(Kanton, Online, Budget\)/, /abgeleitete Suchbegriffe und Wünsche/, /Prüfsumme/, /für die Nutzung durch Erwachsene vorgesehen/, /Eltern und Erziehungsberechtigte/],
    en: [/AI search/, /search criteria \(canton, online, budget\)/, /search terms and preferences derived/, /checksum/, /intended for use by adults/, /Parents and guardians/],
    fr: [/recherche IA/, /critères de recherche facultatifs \(canton, en ligne, budget\)/, /termes de recherche et souhaits déduits/, /somme de contrôle/, /prévue pour être utilisée par des adultes/, /parents et représentants légaux/],
    it: [/ricerca IA/, /criteri di ricerca facoltativi \(cantone, online, budget\)/, /termini di ricerca e i desideri ricavati/, /somma di controllo/, /prevista per l'utilizzo da parte di adulti/, /Genitori e rappresentanti legali/],
  },
  s4: {
    de: [/OpenAI Ireland Ltd\., Irland/, /USA/, /nicht automatisch/, /selbst in den Suchtext schreiben/, /nicht zum Training/, /bis zu 30 Tage/, /keine Namen und keine sensiblen Angaben/],
    en: [/OpenAI Ireland Ltd\., Ireland/, /USA/, /do not automatically transmit/, /write into the search text yourself/, /not used to train models/, /up to 30 days/, /do not enter names or sensitive information/],
    fr: [/OpenAI Ireland Ltd\., Irlande/, /États-Unis/, /ne transmettons pas automatiquement/, /écrivez vous-même dans le texte de recherche/, /pas utilisées pour entraîner des modèles/, /jusqu'à 30 jours/, /ni noms ni informations sensibles/],
    it: [/OpenAI Ireland Ltd\., Irlanda/, /USA/, /Non trasmettiamo automaticamente/, /scrivete voi stessi nel testo di ricerca/, /non vengono utilizzati per addestrare modelli/, /fino a 30 giorni/, /nomi né informazioni sensibili/],
  },
  s7: {
    de: [/OpenAI Ireland Ltd\. \(Irland\)/, /gemäss Bundesrat ein angemessenes Datenschutzniveau/, /Standardvertragsklauseln der EU-Kommission/],
    en: [/OpenAI Ireland Ltd\. \(Ireland\)/, /Swiss Federal Council, Ireland provides an adequate level/, /European Commission's standard contractual clauses/],
    fr: [/OpenAI Ireland Ltd\. \(Irlande\)/, /selon le Conseil fédéral, l'Irlande offre un niveau de protection des données adéquat/, /clauses contractuelles types de la Commission européenne/],
    it: [/OpenAI Ireland Ltd\. \(Irlanda\)/, /secondo il Consiglio federale, l'Irlanda garantisce un livello adeguato/, /clausole contrattuali standard della Commissione europea/],
  },
  s8: {
    de: [/Teile Ihres Suchtexts/, /vollständigen Suchtext speichern wir nicht/, /Nach 24 Stunden ist das Ergebnis nicht mehr abrufbar/, /nächsten regelmässigen Bereinigungslauf gelöscht/, /laufenden und den vorherigen Kalendermonat/, /Konto gelöscht, löschen wir gespeicherte Suchergebnisse sofort/],
    en: [/parts of your search text/, /do not store the full search text/, /After 24 hours the result can no longer be retrieved/, /next regular clean-up run/, /current and the previous calendar month/, /account is deleted, stored search results are deleted immediately/],
    fr: [/des parties de votre texte de recherche/, /ne conservons pas le texte de recherche complet/, /Après 24 heures, le résultat ne peut plus être consulté/, /prochain nettoyage régulier/, /mois civil en cours et le mois précédent/, /compte est supprimé, les résultats de recherche enregistrés sont supprimés immédiatement/],
    it: [/parti del vostro testo di ricerca/, /non conserviamo il testo di ricerca completo/, /Dopo 24 ore il risultato non è più consultabile/, /successiva pulizia periodica/, /mese civile in corso e quello precedente/, /account viene cancellato, i risultati di ricerca salvati vengono cancellati immediatamente/],
  },
};

describe('Datenschutzerklärung: KI-Suche in allen vier Sprachen übereinstimmend', () => {
  for (const [key, byLang] of Object.entries(FACTS)) {
    it(`Abschnitt ${key.slice(1)}: gleiche Kernaussagen in DE/EN/FR/IT`, () => {
      const counts = new Set(Object.values(byLang).map((list) => list.length));
      expect(counts.size).toBe(1); // gleich viele Aussagen je Sprache
      for (const lang of LANGS) {
        const text = section(lang, key.slice(1));
        for (const pattern of byLang[lang]) expect(text, `${lang} ${key} ${pattern}`).toMatch(pattern);
      }
    });
  }

  it('Abschnitt 3: Zweck der KI-Suche in allen Sprachen', () => {
    expect(section('de', 3)).toMatch(/Bereitstellung der KI-Suche/);
    expect(section('en', 3)).toMatch(/Providing the AI search/);
    expect(section('fr', 3)).toMatch(/Mise à disposition de la recherche IA/);
    expect(section('it', 3)).toMatch(/Fornitura della ricerca IA/);
  });

  it('Stand-Datum in allen Sprachen auf den 27. November 2026 gesetzt', () => {
    expect(LEGAL_CONTENT.de.datenschutz.intro).toMatch(/Stand: 27\. November 2026/);
    expect(LEGAL_CONTENT.en.datenschutz.intro).toMatch(/Status: 27 November 2026/);
    expect(LEGAL_CONTENT.fr.datenschutz.intro).toMatch(/État : 27 novembre 2026/);
    expect(LEGAL_CONTENT.it.datenschutz.intro).toMatch(/Stato: 27 novembre 2026/);
  });

  it('keine Behauptung, die nicht belegt ist: keine DPF-Zertifizierung von OpenAI, keine Schweizer SCC-Anpassung, keine technische Altersprüfung, keine EU-Verarbeitung', () => {
    for (const lang of LANGS) {
      const ai = [4, 7].map((nr) => section(lang, nr)).join('\n').split('\n').filter((l) => /OpenAI/.test(l)).join('\n');
      expect(ai).not.toMatch(/Data Privacy Framework|DPF/);
      expect(ai).not.toMatch(/Swiss addendum|Schweizer Zusatz|FDPIC|EDÖB|PFPDT|IFPDT/i);
      expect(ai).not.toMatch(/eu\.api|EU-Datenzentrum|data residency|Datenresidenz/i);
      expect(section(lang, 2)).not.toMatch(/Altersprüfung|age verification|vérification de l'âge|verifica dell'età/i);
    }
  });

  it('bestehende Inhalte bleiben erhalten (z. B. Gemini, Lead-Freitext 60 Tage, DPF-Satz DE)', () => {
    for (const lang of LANGS) {
      expect(section(lang, 4)).toMatch(/Google Gemini API/);
      expect(section(lang, 8)).toMatch(/60/);
    }
    expect(section('de', 7)).toMatch(/Soweit Empfänger in den USA nach dem Swiss-U\.S\. Data Privacy Framework zertifiziert sind/);
  });
});

vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })) } },
}));

async function loadView() {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://omoapbvfligjfznzivyu.supabase.co');
  return (await import('../src/components/AiSearchView.jsx')).default;
}

describe('KI-Suche: nicht blockierende Datenschutz-Hinweiszeile', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
  });

  const HINT = 'Dein Suchtext wird zur Auswertung an OpenAI (auch USA) übermittelt. Bitte keine Namen und keine sensiblen Angaben über dich oder andere eingeben.';

  it('angemeldet: Hinweis unter dem Eingabefeld mit Link zur Datenschutzerklärung; Absenden ohne Bestätigung möglich', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ quota: { remaining: 5, limit: 10, resetDate: '2026-12-01' } }) })));
    const AiSearchView = await loadView();
    await act(async () => { render(<AiSearchView user={{ id: 'user-1' }} setView={() => {}} />); });
    const hint = screen.getByTestId('ai-privacy-hint');
    expect(hint.textContent).toContain(HINT);
    expect(hint.querySelector('a').getAttribute('href')).toBe('/datenschutz');
    // Kein Bestätigungsdialog: keine Checkbox im Hinweis, Absenden nicht gesperrt.
    expect(hint.querySelector('input')).toBeNull();
    expect(screen.getByTestId('ai-submit').hasAttribute('disabled')).toBe(false);
  });

  it('Gast: Hinweis ebenfalls sichtbar (vor der Anmeldung)', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const AiSearchView = await loadView();
    await act(async () => { render(<AiSearchView user={null} setView={() => {}} />); });
    expect(screen.getByTestId('ai-privacy-hint').textContent).toContain(HINT);
  });
});
