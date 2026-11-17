import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Search, LayoutGrid, Lock, AlertTriangle, Info, MapPin, Calendar, Tag, ChevronDown, ExternalLink, Loader, FlaskConical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AI_SEARCH_TEST_REF, supabaseRefOf } from '../lib/aiSearch/previewGuard';
import { writeStored, readSession, writeSession, removeSession } from '../lib/safeStorage';

/**
 * KI-Suche (Preview). Dritter Einstieg neben Kategorien und klassischer
 * Filtersuche. Nur für angemeldete echte Konten, 10 Suchen je Kalendermonat.
 *
 * Datenschutz: Der Suchtext bleibt im Browser (sessionStorage) und wird nie
 * in die URL geschrieben. Das letzte Ergebnis wird nur für das angemeldete
 * Konto zwischengespeichert und beim Abmelden verworfen; das Umschalten
 * 3/5/10 arbeitet ausschliesslich auf diesem Ergebnis (keine neue Suche).
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

function coverageText(coverage) {
  if (!coverage) return null;
  if (!coverage.complete) {
    return `Suchindex unvollständig: ${coverage.missingCount ?? '?'} von ${coverage.publishedCount} veröffentlichten Kursen fehlen im Index. Passende Kurse können hier fehlen.`;
  }
  const base = `Abgleich vor dieser Suche: Jeder der ${coverage.publishedCount} aktuell veröffentlichten Kurse ist im Suchindex enthalten und wurde durchsucht.`;
  return coverage.pendingUpdates > 0
    ? `${base} ${coverage.pendingUpdates} Kursänderungen sind noch nicht eingearbeitet – einzelne Angaben können veraltet sein.`
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

function ResultCard({ card }) {
  const eventDate = card.event ? formatDate(card.event.startDate) : null;
  return (
    <article className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm" data-testid="ai-result-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-dark font-heading">
            <a href={card.url} onClick={(e) => { e.preventDefault(); navigate(card.url); }} className="hover:text-primary">{card.title}</a>
          </h3>
          <p className="text-sm text-gray-500">
            {[card.provider, card.category].filter(Boolean).join(' · ')}
          </p>
        </div>
        {card.paidHighlight && (
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded-full" title="Der Anbieter hat eine Hervorhebung gebucht. Sie wirkt nur innerhalb gleich gut passender Treffer.">
            Hervorgehoben
          </span>
        )}
      </div>

      {card.reasons.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Warum dieser Kurs</p>
          <ul className="mt-1 space-y-1">
            {card.reasons.map((reason, index) => (
              <li key={index} className="text-sm text-gray-700">
                <span className="font-medium">{reason.sectionLabel}:</span>{' '}
                <span className="text-gray-600">„{reason.quote}“</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700">
        <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-gray-400" />{eventDate ? `Nächster Termin: ${eventDate}` : 'Termin unbekannt'}</span>
        <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-gray-400" />{card.place || 'Ort unbekannt'}</span>
        <span className="flex items-center gap-1"><Tag className="w-4 h-4 text-gray-400" />{card.price}</span>
      </div>

      {card.gaps.length > 0 && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">Fehlende oder unklare Angaben</p>
          <ul className="list-disc list-inside text-sm text-amber-900">
            {card.gaps.map((gap) => <li key={gap}>{gap}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <a href={card.url} onClick={(e) => { e.preventDefault(); navigate(card.url); }} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Zur Kursseite <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
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
  const [visibleCount, setVisibleCount] = useState(5);
  const [showRankingInfo, setShowRankingInfo] = useState(false);
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
        setVisibleCount(5);
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
  const visibleResults = result ? result.results.slice(0, visibleCount) : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-4 flex items-start gap-2 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-4 py-3 text-sm" data-testid="ai-preview-banner">
        <FlaskConical className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Vorschau mit Testdaten.</strong> Diese KI-Suche läuft ausschliesslich gegen die Testumgebung und ist nicht öffentlich.
          Die Bewertung durch das Sprachmodell (Luna) und die Bedeutungssuche sind noch nicht freigeschaltet – Reihenfolge und Begründungen beruhen vorläufig auf Textbelegen aus den Kursbeschreibungen.
          <span className="block mt-1" data-testid="ai-db-check">
            {BROWSER_ON_TEST_DB ? '✓ Datenbank dieses Browsers: Testumgebung' : '✗ Dieser Browser ist NICHT mit der Testumgebung verbunden – KI-Suche gesperrt.'}
          </span>
        </div>
      </div>

      <h1 className="text-3xl font-bold font-heading text-dark flex items-center gap-2">
        <Sparkles className="w-7 h-7 text-primary" /> KI-Suche
      </h1>
      <p className="mt-2 text-gray-600">
        Beschreibe in eigenen Worten, was du lernen möchtest. Die Suche durchsucht alle veröffentlichten Kurse inklusive der vollständigen Beschreibungen.
        Lieber selbst stöbern? Kategorien und klassische Filtersuche bleiben ohne Anmeldung verfügbar.
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
              <label htmlFor="ai-query" className="font-semibold text-dark">Was möchtest du lernen?</label>
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
              <span className="text-xs text-gray-500">Zählt als 1 von 10 Suchen dieses Monats. Umschalten der Trefferzahl zählt nicht.</span>
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
              <p className="mt-2 text-xs text-gray-500">Wünsche beeinflussen die Reihenfolge, schliessen aber keine Kurse aus. Um etwas zwingend zu machen, nutze „Zwingende Vorgaben“ (eine geänderte Suche zählt als neue KI-Suche).</p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-700 flex items-center gap-1">
                  <Info className="w-4 h-4 text-gray-400" />
                  {coverageText(result.coverage)}
                </p>
                <div className="flex items-center gap-1 text-sm" role="group" aria-label="Anzahl Vorschläge">
                  <span className="text-gray-500 mr-1">Vorschläge:</span>
                  {[3, 5, 10].map((n) => (
                    <button key={n} type="button" onClick={() => setVisibleCount(n)} aria-pressed={visibleCount === n} className={`px-3 py-1 rounded-full border ${visibleCount === n ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}>{n}</button>
                  ))}
                </div>
              </div>

              {result.method && (
                <p className="mt-1 text-xs text-gray-500" data-testid="ai-method">
                  Suche: {result.method.retrieval} · Bewertung: {result.method.ranking}
                </p>
              )}
              {result.method && !result.method.luna && (
                <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-3 py-2 text-sm" data-testid="ai-simulated">
                  <FlaskConical className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span><strong>Simulierte Bewertung:</strong> Diese Reihenfolge stammt nicht von der KI. Sie zählt vorläufig, wie viele deiner Suchbegriffe belegbar im Kurstext vorkommen. Die echte KI-Bewertung (Luna) ist noch nicht freigeschaltet.</span>
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                Passung und gebuchte Hervorhebung beeinflussen die Reihenfolge.{' '}
                <button type="button" onClick={() => setShowRankingInfo(!showRankingInfo)} className="underline">Mehr erfahren</button>
                {showRankingInfo && (
                  <p className="mt-1">Zuerst zählt, wie gut ein Kurs zu deiner Beschreibung passt. Kurse unter einer Mindestpassung werden nicht vorgeschlagen, auch nicht gegen Bezahlung. Anbieter mit gebuchtem Paket erhalten nur innerhalb gleich gut passender Treffer einen kleinen Vorteil; solche Kurse sind als „Hervorgehoben“ gekennzeichnet. In dieser Vorschau wird die Passung vorläufig über Textbelege bestimmt (Sprachmodell noch nicht freigeschaltet).</p>
                )}
              </div>

              {result.results.length === 0 && result.incompleteResults.length === 0 ? (
                <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6" data-testid="ai-empty">
                  <p className="font-semibold text-dark">Keine passenden Kurse gefunden.</p>
                  <p className="mt-1 text-sm text-gray-600">Versuche andere oder allgemeinere Begriffe, oder lockere zwingende Vorgaben. Auch eine Suche ohne Treffer zählt als KI-Suche.</p>
                  <ClassicAlternatives />
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-4">
                    {visibleResults.map((card) => <ResultCard key={card.courseId} card={card} />)}
                  </div>
                  {result.results.length > 0 && result.results.length < visibleCount && (
                    <p className="mt-3 text-sm text-gray-600">Nur {result.results.length} {result.results.length === 1 ? 'Kurs erfüllt' : 'Kurse erfüllen'} die Mindestpassung – wir füllen nicht künstlich auf.</p>
                  )}
                  {result.results.length === 0 && (
                    <p className="mt-3 text-sm text-gray-600">Kein Kurs erfüllt alle zwingenden Vorgaben nachweislich.</p>
                  )}
                  {result.incompleteResults.length > 0 && (
                    <div className="mt-8">
                      <h2 className="text-lg font-bold text-dark">Angaben unvollständig</h2>
                      <p className="text-sm text-gray-600">Diese Kurse passen inhaltlich, aber ihre Angaben belegen nicht alle zwingenden Vorgaben (z. B. kein Termin oder Preis auf Anfrage).</p>
                      <div className="mt-3 space-y-4">
                        {result.incompleteResults.slice(0, visibleCount).map((card) => <ResultCard key={card.courseId} card={card} />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
