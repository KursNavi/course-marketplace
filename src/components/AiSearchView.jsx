import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Search, LayoutGrid, Lock, AlertTriangle, ChevronDown, ArrowRight, Loader, FlaskConical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AI_SEARCH_TEST_REF, supabaseRefOf } from '../lib/aiSearch/previewGuard';
import { writeStored, readSession, writeSession, removeSession } from '../lib/safeStorage';

/**
 * KI-Suche (Preview). Dritter Einstieg neben Kategorien und klassischer
 * Filtersuche. Nur für angemeldete echte Konten, 10 Suchen je Kalendermonat.
 *
 * Datenschutz: Der Suchtext bleibt im Browser (sessionStorage) und wird nie
 * in die URL geschrieben. Das letzte Ergebnis wird nur für das angemeldete
 * Konto zwischengespeichert und beim Abmelden verworfen. Angezeigt werden
 * bis zu zehn Vorschläge mit Mindestpassung (Nachtrag 10, keine Auswahl
 * 3/5/10 mehr); die Anzeige löst nie eine neue Suche aus.
 */

// Datenbank, mit der DIESER Browser spricht (zur Build-Zeit eingebettet).
const BROWSER_DB_REF = supabaseRefOf(import.meta.env.VITE_SUPABASE_URL);
const BROWSER_ON_TEST_DB = BROWSER_DB_REF === AI_SEARCH_TEST_REF;

const DRAFT_KEY = 'kn_ai_search_draft';
const RESULT_KEY = 'kn_ai_search_last_result';
export const POST_LOGIN_AI_SEARCH_KEY = 'postLoginAiSearch';

const CANTONS = ['Aargau', 'Appenzell AI', 'Appenzell AR', 'Basel-Landschaft', 'Basel-Stadt', 'Bern', 'Fribourg', 'Genève', 'Glarus', 'Graubünden', 'Jura', 'Luzern', 'Neuchâtel', 'Nidwalden', 'Obwalden', 'Schaffhausen', 'Schwyz', 'Solothurn', 'St. Gallen', 'Thurgau', 'Ticino', 'Uri', 'Valais', 'Vaud', 'Zug', 'Zürich'];

const ERROR_TEXT = {
  login_required: 'Bitte melde dich an, um die KI-Suche zu nutzen.',
  real_account_required: 'Die KI-Suche steht nur mit einem echten Konto zur Verfügung.',
  query_too_short: 'Bitte beschreibe deinen Wunsch etwas genauer (mindestens 3 Zeichen). Es wurde nichts verbraucht.',
  query_too_long: 'Deine Beschreibung ist zu lang (höchstens 500 Zeichen). Es wurde nichts verbraucht.',
  search_failed: 'Die Suche ist wegen eines technischen Fehlers fehlgeschlagen. Dein Kontingent wurde dafür nicht belastet.',
  result_not_stored: 'Diese Suche wurde bereits abgeschlossen, das Ergebnis ist aber nicht mehr verfügbar. Du kannst eine neue Suche starten (zählt als neue KI-Suche).',
  in_progress: 'Diese Suche läuft bereits. Bitte warte einen Moment.',
  request_mismatch: 'Die Anfrage passte nicht zum laufenden Suchvorgang. Bitte starte die Suche neu.',
  not_released: 'Das Ergebnis konnte nicht freigegeben werden, weil dein Monatskontingent inzwischen aufgebraucht ist.',
  wrong_environment: 'Die KI-Suche ist in dieser Umgebung gesperrt: Sie darf nur mit der Testdatenbank laufen.',
  not_available: 'Die KI-Suche ist hier noch nicht freigeschaltet.',
  server_error: 'Unerwarteter Serverfehler. Bitte versuche es später erneut.',
  network: 'Keine Verbindung zum Server. Du kannst es mit derselben Anfrage erneut versuchen – sie wird höchstens einmal gezählt.',
};

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' });
}

function newRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback (ältere Browser): RFC-4122-v4-Format
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
  });
}

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function navigate(path) {
  window.scrollTo(0, 0);
  window.history.pushState({}, '', path);
}

// Nachweislich unvollständiger Index = sichtbare Warnung über den Ergebnissen.
function coverageWarning(coverage) {
  if (!coverage || coverage.complete) return null;
  return `Suchindex unvollständig: ${coverage.missingCount ?? '?'} von ${coverage.publishedCount} veröffentlichten Kursen fehlen im Index. Passende Kurse können hier fehlen.`;
}

// Vollständiger Abgleich (ggf. mit Aktualisierungsrückstand) = ruhige Fussnote.
function coverageFootnote(coverage) {
  if (!coverage || !coverage.complete) return null;
  const base = `Indexabgleich vor dieser Suche: Alle ${coverage.publishedCount} aktuell veröffentlichten Kurse sind im Suchindex enthalten.`;
  return coverage.pendingUpdates > 0
    ? `${base} ${coverage.pendingUpdates} Kursänderungen sind noch nicht eingearbeitet; einzelne Angaben können veraltet sein.`
    : base;
}

function QuotaBadge({ quota }) {
  if (!quota) return null;
  const reset = formatDate(quota.resetDate);
  return (
    <p className="text-sm text-gray-600" data-testid="ai-quota">
      Noch <strong>{quota.remaining} von {quota.limit}</strong> KI-Suchen diesen Monat
      {reset ? <> · Zurücksetzung am {reset}</> : null}
    </p>
  );
}

// Schlanke Karte (Nachtrag 10): Titel, eine Begründung als Fliesstext,
// Kurslink; offizielles Kursbild nur, wenn vorhanden (Desktop rechts,
// mobil oberhalb in voller Breite – keine gequetschte Textspalte).
function ResultCard({ card }) {
  const [imageFailed, setImageFailed] = useState(false);
  const open = (e) => { e.preventDefault(); navigate(card.url); };
  const showImage = card.imageUrl && !imageFailed;
  return (
    <article className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col-reverse sm:flex-row gap-4" data-testid="ai-result-card">
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-bold text-dark font-heading break-words">
          <a href={card.url} onClick={open} className="hover:text-primary">{card.title}</a>
        </h3>
        {card.explanation && <p className="mt-2 text-[15px] leading-relaxed text-gray-700" data-testid="ai-explanation">{card.explanation}</p>}
        <a href={card.url} onClick={open} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Zum Kurs <ArrowRight className="w-4 h-4" />
        </a>
      </div>
      {showImage && (
        <img src={card.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)}
          className="w-full h-40 sm:w-44 sm:h-32 object-cover rounded-lg flex-shrink-0 bg-gray-100" />
      )}
    </article>
  );
}

function ClassicAlternatives() {
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      <button type="button" onClick={() => navigate('/search')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold hover:border-primary hover:text-primary">
        <Search className="w-4 h-4" /> Klassische Filtersuche
      </button>
      <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold hover:border-primary hover:text-primary">
        <LayoutGrid className="w-4 h-4" /> Kategorien durchstöbern
      </button>
    </div>
  );
}

export default function AiSearchView({ user, setView }) {
  const [query, setQuery] = useState(() => readSession(DRAFT_KEY) || '');
  const [mustCanton, setMustCanton] = useState('');
  const [mustOnline, setMustOnline] = useState(false);
  const [mustBudget, setMustBudget] = useState('');
  const [showMusts, setShowMusts] = useState(false);
  const [quota, setQuota] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const pendingRef = useRef(null); // { requestId, payload } für idempotenten Wiederholversuch

  // Entwurf nur lokal bewahren (nie in URL/Analytics).
  useEffect(() => { writeSession(DRAFT_KEY, query); }, [query]);

  // Ergebnis nur für das angemeldete Konto; beim Abmelden verwerfen.
  useEffect(() => {
    if (!user) {
      removeSession(RESULT_KEY);
      setResult(null);
      setQuota(null);
      return;
    }
    try {
      const stored = JSON.parse(readSession(RESULT_KEY) || 'null');
      if (stored && stored.userId === user.id) setResult(stored.result);
      else removeSession(RESULT_KEY);
    } catch {
      removeSession(RESULT_KEY);
    }
  }, [user]);

  const loadStatus = useCallback(async () => {
    const headers = await authHeader();
    if (!headers) return;
    try {
      const response = await fetch('/api/ai-search', { headers });
      const body = await response.json().catch(() => ({}));
      if (response.ok) { setQuota(body.quota); setStatusError(null); }
      else setStatusError(body.error || 'server_error');
    } catch {
      setStatusError('network');
    }
  }, []);

  useEffect(() => { if (user) loadStatus(); }, [user, loadStatus]);

  const submit = async (retry = false) => {
    setError(null);
    if (!BROWSER_ON_TEST_DB) { setError('wrong_environment'); return; }
    let pending = pendingRef.current;
    if (!retry || !pending) {
      const musts = {};
      if (mustCanton) { musts.canton = mustCanton; musts.onlineAllowed = mustOnline; }
      if (mustBudget) musts.maxBudget = Number(mustBudget);
      pending = { requestId: newRequestId(), payload: { query, musts } };
      pendingRef.current = pending;
    }
    const headers = await authHeader();
    if (!headers) { setError('login_required'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: pending.requestId, ...pending.payload }),
      });
      const body = await response.json().catch(() => ({}));
      if (body.quota) setQuota(body.quota);
      if (response.ok) {
        pendingRef.current = null;
        setResult(body);
        writeSession(RESULT_KEY, JSON.stringify({ userId: user.id, result: body }));
      } else {
        if (body.error !== 'network') pendingRef.current = null;
        setError(body.error || 'server_error');
      }
    } catch {
      // Antwort verloren: derselbe Vorgang darf mit derselben Kennung wiederholt werden.
      setError('network');
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    writeStored(POST_LOGIN_AI_SEARCH_KEY, '1');
    window.history.pushState({}, '', '/login');
    setView('login');
  };

  const limitReached = error === 'limit_reached' || (quota && quota.remaining === 0);
  const coverageAlert = result ? coverageWarning(result.coverage) : null;
  const coverageNote = result ? coverageFootnote(result.coverage) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <p className={`mb-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full px-3 py-1 text-xs ${BROWSER_ON_TEST_DB ? 'bg-indigo-50 text-indigo-900' : 'bg-red-50 text-red-800'}`} data-testid="ai-preview-banner">
        <FlaskConical className="w-3.5 h-3.5" />
        <span>Vorschau mit Testdaten, nicht öffentlich</span>
        <span aria-hidden="true">·</span>
        <span data-testid="ai-db-check">
          {BROWSER_ON_TEST_DB ? '✓ Datenbank dieses Browsers: Testumgebung' : '✗ Dieser Browser ist NICHT mit der Testumgebung verbunden – KI-Suche gesperrt.'}
        </span>
      </p>

      <h1 className="text-3xl sm:text-4xl font-bold font-heading text-dark leading-tight" data-testid="ai-title">
        <Sparkles className="inline-block w-8 h-8 sm:w-9 sm:h-9 text-primary align-[-0.15em] mr-2" aria-hidden="true" />
        KI-Suche: Beschreibe in eigenen Worten, was du lernen möchtest.
      </h1>
      <p className="mt-3 text-sm text-gray-500">
        Lieber selbst stöbern? Kategorien und klassische Filtersuche gibt es auch ohne Anmeldung.
      </p>
      <ClassicAlternatives />

      {!user ? (
        <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6" data-testid="ai-login-gate">
          <p className="flex items-center gap-2 font-semibold text-dark"><Lock className="w-5 h-5" /> Die KI-Suche ist nur mit Konto verfügbar</p>
          <p className="mt-2 text-sm text-gray-600">
            Angemeldete Nutzerinnen und Nutzer haben 10 KI-Suchen pro Kalendermonat. Dein Text bleibt in diesem Browser gespeichert und wird nach der Anmeldung nicht automatisch abgeschickt.
          </p>
          <textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={3} maxLength={500} className="mt-4 w-full border border-gray-300 rounded-lg p-3 text-sm" placeholder="z. B. Anfänger-Yoga in Zürich am Abend, höchstens CHF 200" />
          <button type="button" onClick={goToLogin} className="mt-3 bg-petrol text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-petrolDark">Anmelden oder Konto erstellen</button>
        </div>
      ) : (
        <div className="mt-8">
          <form onSubmit={(e) => { e.preventDefault(); if (!loading) submit(false); }} className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex flex-wrap justify-between gap-2 items-center">
              <label htmlFor="ai-query" className="font-semibold text-dark">Deine Beschreibung</label>
              <QuotaBadge quota={quota} />
            </div>
            <textarea id="ai-query" value={query} onChange={(e) => setQuery(e.target.value)} rows={3} maxLength={500} className="mt-2 w-full border border-gray-300 rounded-lg p-3 text-sm" placeholder="z. B. Ich möchte nach der Arbeit besser fotografieren, vorzugsweise in Bern" />
            <p className="text-xs text-gray-500 text-right">{query.length}/500</p>

            <button type="button" onClick={() => setShowMusts(!showMusts)} className="mt-1 text-sm text-primary font-semibold inline-flex items-center gap-1">
              Zwingende Vorgaben (optional) <ChevronDown className={`w-4 h-4 transition-transform ${showMusts ? 'rotate-180' : ''}`} />
            </button>
            {showMusts && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
                <label className="flex flex-col gap-1">Kanton (muss)
                  <select value={mustCanton} onChange={(e) => setMustCanton(e.target.value)} className="border border-gray-300 rounded-lg p-2">
                    <option value="">egal</option>
                    {CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 mt-6">
                  <input type="checkbox" checked={mustOnline} onChange={(e) => setMustOnline(e.target.checked)} disabled={!mustCanton} />
                  Online-Termine auch ok
                </label>
                <label className="flex flex-col gap-1">Budget höchstens (CHF)
                  <input type="number" min="1" max="100000" value={mustBudget} onChange={(e) => setMustBudget(e.target.value)} className="border border-gray-300 rounded-lg p-2" />
                </label>
                <p className="sm:col-span-3 text-xs text-gray-500">Zwingende Vorgaben gelten nur als erfüllt, wenn die Kursangaben sie belegen. Kurse mit fehlenden Angaben erscheinen getrennt unter „Angaben unvollständig“.</p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={loading || !BROWSER_ON_TEST_DB || limitReached || statusError === 'wrong_environment' || statusError === 'not_available'} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                KI-Suche starten
              </button>
              <span className="text-xs text-gray-500">Zählt als 1 von 10 Suchen dieses Monats.</span>
            </div>
          </form>

          {statusError && statusError !== 'network' && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm" role="alert">{ERROR_TEXT[statusError] || ERROR_TEXT.server_error}</div>
          )}

          {limitReached && (
            <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 text-sm" role="alert" data-testid="ai-limit">
              <p className="font-semibold">Du hast deine 10 KI-Suchen für diesen Monat aufgebraucht.</p>
              <p>{quota?.resetDate ? `Ab dem ${formatDate(quota.resetDate)} stehen dir wieder 10 Suchen zur Verfügung.` : 'Zu Beginn des nächsten Monats stehen dir wieder 10 Suchen zur Verfügung.'} Bis dahin kannst du deine bisherigen Ergebnisse ansehen oder klassisch suchen.</p>
              <ClassicAlternatives />
            </div>
          )}

          {error && error !== 'limit_reached' && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm" role="alert">
              <p className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{ERROR_TEXT[error] || ERROR_TEXT.server_error}</p>
              {error === 'network' && (
                <button type="button" onClick={() => submit(true)} className="mt-2 text-sm font-semibold underline">Erneut versuchen</button>
              )}
              {(error === 'search_failed' || error === 'server_error') && <ClassicAlternatives />}
            </div>
          )}

          {result && (
            <section className="mt-8" data-testid="ai-results">
              <div className="flex flex-wrap gap-2 items-center text-sm">
                <span className="text-gray-500">Verstanden:</span>
                {result.criteria.terms.map((term) => <span key={term} className="bg-gray-100 px-2 py-1 rounded-full">{term}</span>)}
                {result.criteria.wishes.map((wish) => <span key={wish.type + wish.label} className="bg-blue-50 text-blue-800 px-2 py-1 rounded-full">Wunsch: {wish.label}</span>)}
                {result.criteria.musts.canton && <span className="bg-petrol/10 text-petrol px-2 py-1 rounded-full">Muss: {result.criteria.musts.canton}{result.criteria.musts.onlineAllowed ? ' oder online' : ''}</span>}
                {result.criteria.musts.maxBudget && <span className="bg-petrol/10 text-petrol px-2 py-1 rounded-full">Muss: bis CHF {result.criteria.musts.maxBudget}</span>}
              </div>

              {coverageAlert && (
                <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm" role="alert" data-testid="ai-coverage-alert">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{coverageAlert}
                </div>
              )}

              {/* Genau EIN kompakter Simulationshinweis, solange Luna nicht aktiv ist. */}
              {result.method && !result.method.luna && (
                <p className="mt-4 inline-flex items-start gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-900" data-testid="ai-simulated">
                  <FlaskConical className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                  <span><strong>Simulierte Bewertung:</strong> Reihenfolge und Begründungen beruhen vorläufig auf Textbelegen, nicht auf der KI (Luna ist noch nicht aktiv).</span>
                </p>
              )}

              {result.results.length === 0 && result.incompleteResults.length === 0 ? (
                <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6" data-testid="ai-empty">
                  <p className="font-semibold text-dark">Keine passenden Kurse gefunden.</p>
                  <p className="mt-1 text-sm text-gray-600">Versuche andere oder allgemeinere Begriffe, oder lockere zwingende Vorgaben. Auch eine Suche ohne Treffer zählt als KI-Suche.</p>
                  <ClassicAlternatives />
                </div>
              ) : (
                <>
                  {/* Bis zu zehn Vorschläge – nur solche mit Mindestpassung, keine Auffüllung. */}
                  <div className="mt-4 space-y-4">
                    {result.results.map((card) => <ResultCard key={card.courseId} card={card} />)}
                  </div>
                  {result.results.length === 0 && (
                    <p className="mt-3 text-sm text-gray-600">Kein Kurs erfüllt alle zwingenden Vorgaben nachweislich.</p>
                  )}
                  {result.incompleteResults.length > 0 && (
                    <div className="mt-8">
                      <h2 className="text-lg font-bold text-dark">Angaben unvollständig</h2>
                      <p className="text-sm text-gray-600">Diese Kurse passen inhaltlich, aber ihre Angaben belegen nicht alle zwingenden Vorgaben. Was offen ist, steht jeweils in der Begründung.</p>
                      <div className="mt-3 space-y-4">
                        {result.incompleteResults.map((card) => <ResultCard key={card.courseId} card={card} />)}
                      </div>
                    </div>
                  )}
                </>
              )}

              <footer className="mt-8 border-t border-gray-200 pt-4 space-y-2 text-xs text-gray-500" data-testid="ai-footnotes">
                {result.results.length > 0 && result.results.length < 10 && (
                  <p>Gezeigt werden nur Kurse mit ausreichender Passung; diesmal {result.results.length === 1 ? 'einer' : result.results.length}.</p>
                )}
                {coverageNote && <p data-testid="ai-coverage">{coverageNote}</p>}
                <details className="group" data-testid="ai-ranking-info">
                  <summary className="cursor-pointer select-none underline decoration-dotted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                    Wie entsteht die Reihenfolge? Passung und gebuchte Pakete
                  </summary>
                  <div className="mt-2 space-y-1.5 text-gray-600">
                    <p>Zuerst zählt, wie gut ein Kurs zu deiner Beschreibung passt. Kurse unter einer Mindestpassung erscheinen nicht, auch nicht gegen Bezahlung. Zwingende Vorgaben gelten nur als erfüllt, wenn die Kursangaben sie belegen.</p>
                    <p>Anbieter mit einem gebuchten Paket können innerhalb gleich gut passender Kurse etwas weiter oben stehen. An der Auswahl, der Mindestpassung und den zwingenden Vorgaben ändert ein Paket nichts.</p>
                    <p>Wünsche wie ein bevorzugter Ort beeinflussen die Reihenfolge, schliessen aber keine Kurse aus. Für feste Bedingungen gibt es „Zwingende Vorgaben“; eine geänderte Suche zählt als neue KI-Suche.</p>
                    {result.method && <p>Suchverfahren: {result.method.retrieval}.</p>}
                  </div>
                </details>
              </footer>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
