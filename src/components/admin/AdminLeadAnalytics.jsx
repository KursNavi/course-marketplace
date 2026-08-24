import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Loader, ChevronLeft, ChevronRight, ArrowLeft, RefreshCw, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Admin-Bereich "Lead-Analyse".
 *
 * Bewusst ein eigener Tab und keine Erweiterung der Anbieter-Verwaltung: Die
 * Kennzahlen hier beantworten eine andere Frage (Leadaufkommen und -qualität
 * über die Zeit) als die Nutzerverwaltung.
 *
 * Alle Daten kommen über /api/admin-lead-analytics mit dem Access-Token der
 * Admin-Sitzung. Es gibt hier keine direkte Supabase-Abfrage auf leads oder
 * lead_message_payloads — diese Tabellen sind für den Browser gesperrt.
 */

const TIER_LABELS = { basic: 'Basic', pro: 'Pro', premium: 'Premium', enterprise: 'Enterprise' };

const SORT_OPTIONS = [
  { value: 'leads_total', label: 'Leads gesamt' },
  { value: 'leads_30d', label: 'Leads 30 Tage' },
  { value: 'leads_90d', label: 'Leads 90 Tage' },
  { value: 'leads_365d', label: 'Leads 365 Tage' },
  { value: 'avg_quality', label: 'Ø Qualität (365 Tage)' },
  { value: 'qualified_basic', label: 'Qualifizierte Basic-Leads' },
  { value: 'ranking_factor', label: 'Ranking-Faktor' },
  { value: 'package_started_at', label: 'Paket seit' },
  { value: 'last_lead_at', label: 'Letzter Lead' },
  { value: 'full_name', label: 'Name' },
];

function formatDate(value) {
  if (!value) return '–';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : date.toLocaleDateString('de-CH');
}

/**
 * Durchschnittsscore anzeigen.
 *
 * Liefert bewusst einen Hinweis statt einer Zahl, wenn im Zeitraum kein Lead
 * bewertet wurde. Eine "0.0" wäre an dieser Stelle irreführend — sie sähe aus
 * wie ein sehr schlechter Wert, bedeutet aber "keine Datenlage".
 */
function formatScore(average, scoredCount) {
  if (!scoredCount || average === null || average === undefined) return null;
  const value = Number(average);
  return Number.isFinite(value) ? value.toFixed(1) : null;
}

function ScoreCell({ average, scoredCount }) {
  const formatted = formatScore(average, scoredCount);
  if (formatted === null) {
    return <span className="text-gray-400 italic" title="Im Zeitraum wurde kein Lead bewertet">keine Bewertung</span>;
  }
  return <span title={`${scoredCount} bewertete Leads`}>{formatted}</span>;
}

function FactorBadge({ factor }) {
  const value = Number(factor ?? 1);
  const isPenalised = Number.isFinite(value) && value < 1;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isPenalised ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
      {Number.isFinite(value) ? value.toFixed(2) : '1.00'}
    </span>
  );
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Nicht eingeloggt');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
}

const AdminLeadAnalytics = ({ showNotification }) => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('leads_total');
  const [sortDir, setSortDir] = useState('desc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [selectedProvider, setSelectedProvider] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        action: 'overview',
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
        sortBy,
        sortDir,
      });
      if (search) params.set('q', search);
      if (tier) params.set('tier', tier);
      if (filter) params.set('filter', filter);

      const res = await fetch(`/api/admin-lead-analytics?${params}`, { headers: await getAuthHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Fehler ${res.status}`);
      }
      const json = await res.json();
      setRows(json.data || []);
      setTotal(json.pagination?.total || 0);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setLoadError(err.message || 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, tier, filter, sortBy, sortDir]);

  useEffect(() => { if (!selectedProvider) fetchOverview(); }, [fetchOverview, selectedProvider]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  if (selectedProvider) {
    return (
      <ProviderDetail
        providerId={selectedProvider}
        onBack={() => setSelectedProvider(null)}
        showNotification={showNotification}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-1">Lead-Analyse</h2>
      <p className="text-sm text-gray-500 mb-5">
        Leadaufkommen und Leadqualität je Anbieter. Die Bewertung ist aktuell deaktiviert und wird später über Codex ausgeführt.
      </p>
      <p className="text-xs text-gray-500 mb-5">
        Die Leadzahlen zeigen registrierte Anfragen. Der E-Mail-Zustellstatus ist davon getrennt und in der Detailansicht sichtbar.
      </p>

      {/* Filterleiste */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Anbieter suchen (Name oder E-Mail)"
            aria-label="Anbieter suchen"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={tier}
          onChange={(e) => { setTier(e.target.value); setPage(1); }}
          aria-label="Nach Paket filtern"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Alle Pakete</option>
          {Object.entries(TIER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          aria-label="Zusatzfilter"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Kein Zusatzfilter</option>
          <option value="basic_many_leads">Basic mit vielen Leads</option>
          <option value="no_leads">Noch keine Leads</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          aria-label="Sortieren nach"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          type="button"
          onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
        >
          {sortDir === 'asc' ? 'Aufsteigend' : 'Absteigend'}
        </button>

        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          aria-label="Eintraege pro Seite"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {[25, 50, 100].map(n => <option key={n} value={n}>{n} pro Seite</option>)}
        </select>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 mb-4 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Lead-Analyse konnte nicht geladen werden: {loadError}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 py-10 justify-center">
          <Loader className="w-5 h-5 animate-spin" /> Lade Lead-Analyse…
        </div>
      )}

      {!loading && !loadError && rows.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="font-medium">Keine Anbieter gefunden.</p>
          <p className="text-sm mt-1">Passe Suche oder Filter an.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3 font-semibold">Anbieter</th>
                <th className="py-2 px-3 font-semibold">Paket</th>
                <th className="py-2 px-3 font-semibold">Paket seit</th>
                <th className="py-2 px-3 font-semibold">Vorheriges</th>
                <th className="py-2 px-3 font-semibold text-right">Aktive Kurse</th>
                <th className="py-2 px-3 font-semibold text-right">30 T.</th>
                <th className="py-2 px-3 font-semibold text-right">90 T.</th>
                <th className="py-2 px-3 font-semibold text-right">365 T.</th>
                <th className="py-2 px-3 font-semibold text-right">Gesamt</th>
                <th className="py-2 px-3 font-semibold text-right">Ø Score (365 T.)</th>
                <th className="py-2 px-3 font-semibold text-right">Qual. Basic-Leads</th>
                <th className="py-2 px-3 font-semibold text-right">Faktor</th>
                <th className="py-2 px-3 font-semibold">Letzter Lead (registriert)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.provider_id}
                  onClick={() => setSelectedProvider(row.provider_id)}
                  className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
                >
                  <td className="py-2 pr-3">
                    <div className="font-medium text-gray-900">{row.full_name || '(ohne Namen)'}</div>
                    <div className="text-xs text-gray-500">{row.email}</div>
                  </td>
                  <td className="py-2 px-3">{TIER_LABELS[row.package_tier] || row.package_tier}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {formatDate(row.package_started_at)}
                    {row.package_start_is_estimated && (
                      <span className="ml-1 text-xs text-gray-400" title="Startpunkt aus der Migration übernommen, nicht der echte Wechselzeitpunkt">
                        (bekannt seit)
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3">{row.previous_package_tier ? (TIER_LABELS[row.previous_package_tier] || row.previous_package_tier) : '–'}</td>
                  <td className="py-2 px-3 text-right">{row.active_courses}</td>
                  <td className="py-2 px-3 text-right">{row.leads_30d}</td>
                  <td className="py-2 px-3 text-right">{row.leads_90d}</td>
                  <td className="py-2 px-3 text-right">{row.leads_365d}</td>
                  <td className="py-2 px-3 text-right font-semibold">{row.leads_total}</td>
                  <td className="py-2 px-3 text-right">
                    <ScoreCell average={row.avg_quality_score_365d} scoredCount={row.scored_leads_365d} />
                  </td>
                  <td className="py-2 px-3 text-right">
                    {row.package_tier === 'basic' ? row.qualified_basic_leads_current_phase : '–'}
                  </td>
                  <td className="py-2 px-3 text-right"><FactorBadge factor={row.basic_lead_ranking_factor} /></td>
                  <td className="py-2 px-3 whitespace-nowrap">{formatDate(row.last_lead_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>{total} Anbieter</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 border border-gray-300 rounded disabled:opacity-40"
              aria-label="Vorherige Seite"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Seite {page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 border border-gray-300 rounded disabled:opacity-40"
              aria-label="Naechste Seite"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Detailansicht eines Anbieters
// ---------------------------------------------------------------------------

const ProviderDetail = ({ providerId, onBack, showNotification }) => {
  const [detail, setDetail] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadPage, setLeadPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openMessage, setOpenMessage] = useState(null);
  const [rescoring, setRescoring] = useState(false);

  const leadPageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();

      const detailRes = await fetch(`/api/admin-lead-analytics?action=detail&providerId=${providerId}`, { headers });
      if (!detailRes.ok) {
        const body = await detailRes.json().catch(() => ({}));
        throw new Error(body.error || `Fehler ${detailRes.status}`);
      }
      const detailJson = await detailRes.json();
      setDetail(detailJson.data);

      const leadsRes = await fetch(
        `/api/admin-lead-analytics?action=leads&providerId=${providerId}&limit=${leadPageSize}&offset=${(leadPage - 1) * leadPageSize}`,
        { headers }
      );
      if (leadsRes.ok) {
        const leadsJson = await leadsRes.json();
        setLeads(leadsJson.data || []);
        setLeadsTotal(leadsJson.pagination?.total || 0);
      }
    } catch (err) {
      setError(err.message || 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [providerId, leadPage]);

  useEffect(() => { load(); }, [load]);

  const showMessage = async (leadId) => {
    setOpenMessage({ leadId, loading: true });
    try {
      const res = await fetch(`/api/admin-lead-analytics?action=message&leadId=${leadId}`, { headers: await getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
      setOpenMessage({ leadId, loading: false, ...json });
    } catch (err) {
      setOpenMessage({ leadId, loading: false, available: false, reason: 'error', error: err.message });
    }
  };

  const rescore = async (leadIds) => {
    setRescoring(true);
    try {
      const res = await fetch('/api/admin-lead-analytics?action=rescore', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ leadIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || `Fehler ${res.status}`);
      showNotification?.(`Bewertung wiederholt: ${json.scored} erfolgreich, ${json.failed} fehlgeschlagen.`);
      await load();
    } catch (err) {
      showNotification?.(`Wiederholung fehlgeschlagen: ${err.message}`);
    } finally {
      setRescoring(false);
    }
  };

  const retryableIds = leads
    .filter(l => l.quality_status === 'failed' || l.quality_status === 'pending')
    .map(l => l.id)
    .slice(0, 25);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-2 text-gray-500">
        <Loader className="w-5 h-5 animate-spin" /> Lade Anbieterdetails…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-blue-600 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </button>
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const provider = detail?.provider || {};
  const totals = detail?.totals || {};
  const monthly = detail?.monthly || [];
  const byCourse = detail?.by_course || [];
  const distribution = detail?.score_distribution || {};
  const history = detail?.package_history || [];
  const leadPages = Math.max(1, Math.ceil(leadsTotal / leadPageSize));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-8">
      <div>
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-blue-600 mb-3 text-sm">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </button>
        <h2 className="text-xl font-bold">{provider.full_name || '(ohne Namen)'}</h2>
        <p className="text-sm text-gray-500">{provider.email}</p>
        <div className="flex flex-wrap gap-3 mt-3 text-sm">
          <span className="px-2 py-1 bg-gray-100 rounded">Paket: <strong>{TIER_LABELS[provider.package_tier] || provider.package_tier}</strong></span>
          <span className="px-2 py-1 bg-gray-100 rounded">Paket seit: <strong>{formatDate(provider.package_started_at)}</strong></span>
          <span className="px-2 py-1 bg-gray-100 rounded">
            Aktuelle Basic-Phase: <strong>{provider.current_basic_phase_start ? formatDate(provider.current_basic_phase_start) : 'keine'}</strong>
          </span>
          <span className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1">
            Ranking-Faktor: <FactorBadge factor={provider.basic_lead_ranking_factor} />
          </span>
        </div>
      </div>

      {/* Zeitraum-Kennzahlen */}
      <section>
        <h3 className="font-bold mb-3">Leads nach Zeitraum</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '30 Tage', leads: totals.leads_30d, avg: totals.avg_quality_30d },
            { label: '90 Tage', leads: totals.leads_90d, avg: totals.avg_quality_90d },
            { label: '365 Tage', leads: totals.leads_365d, avg: totals.avg_quality_365d },
            { label: 'Gesamt', leads: totals.leads_total, avg: totals.avg_quality_total },
          ].map(box => (
            <div key={box.label} className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500">{box.label}</div>
              <div className="text-2xl font-bold">{box.leads ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">
                Ø Score: <ScoreCell average={box.avg} scoredCount={totals.scored_total} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-600">
          <span>Während Basic: <strong>{totals.leads_during_basic ?? 0}</strong></span>
          <span>Während Bezahlpaket: <strong>{totals.leads_during_paid ?? 0}</strong></span>
          <span title="Leads von vor der Einführung der Lead-Analyse; das damalige Paket ist nicht bekannt">
            Paket unbekannt: <strong>{totals.leads_tier_unknown ?? 0}</strong>
          </span>
          <span>Qualifizierte Basic-Leads (aktuelle Phase): <strong>{totals.qualified_basic_current_phase ?? 0}</strong></span>
        </div>
      </section>

      {/* Monatsverlauf */}
      <section>
        <h3 className="font-bold mb-3">Monatsverlauf</h3>
        {monthly.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine Leads erfasst.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-semibold">Monat</th>
                  <th className="py-2 px-4 font-semibold text-right">Leads</th>
                  <th className="py-2 px-4 font-semibold text-right">Bewertet</th>
                  <th className="py-2 px-4 font-semibold text-right">Ø Score</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(m => (
                  <tr key={m.month} className="border-b border-gray-100">
                    <td className="py-1.5 pr-4">{m.month}</td>
                    <td className="py-1.5 px-4 text-right">{m.leads}</td>
                    <td className="py-1.5 px-4 text-right">{m.scored}</td>
                    <td className="py-1.5 px-4 text-right"><ScoreCell average={m.avg_quality} scoredCount={m.scored} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Kurse und Score-Verteilung */}
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h3 className="font-bold mb-3">Leads nach Kurs</h3>
          {byCourse.length === 0 ? (
            <p className="text-sm text-gray-500">Noch keine Leads erfasst.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {byCourse.map((c, i) => (
                <li key={c.course_id ?? `deleted-${i}`} className="flex justify-between border-b border-gray-100 py-1">
                  <span>{c.title || <em className="text-gray-400">Kurs gelöscht</em>}</span>
                  <span className="font-semibold">{c.leads}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="font-bold mb-3">Verteilung der Scores</h3>
          {Object.keys(distribution).length === 0 ? (
            <p className="text-sm text-gray-500">Noch keine Bewertungen vorhanden.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(score => (
                <li key={score} className="flex justify-between border-b border-gray-100 py-1">
                  <span>Score {score}</span>
                  <span className="font-semibold">{distribution[String(score)] || 0}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Paketverlauf */}
      <section>
        <h3 className="font-bold mb-3">Paketverlauf</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Kein Paketverlauf vorhanden.</p>
        ) : (
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4 font-semibold">Paket</th>
                <th className="py-2 px-4 font-semibold">Von</th>
                <th className="py-2 px-4 font-semibold">Bis</th>
                <th className="py-2 px-4 font-semibold">Quelle</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-4">{TIER_LABELS[h.package_tier] || h.package_tier}</td>
                  <td className="py-1.5 px-4">
                    {formatDate(h.started_at)}
                    {h.start_is_estimated && <span className="ml-1 text-xs text-gray-400">(bekannt seit)</span>}
                  </td>
                  <td className="py-1.5 px-4">{h.ended_at ? formatDate(h.ended_at) : <span className="text-green-700 font-medium">laufend</span>}</td>
                  <td className="py-1.5 px-4 text-gray-500 text-xs">{h.change_source || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Einzelleads */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Einzelne Leads</h3>
          {retryableIds.length > 0 && (
            <button
              type="button"
              onClick={() => rescore(retryableIds)}
              disabled={rescoring}
              className="flex items-center gap-1 text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${rescoring ? 'animate-spin' : ''}`} />
              Offene Bewertungen wiederholen ({retryableIds.length})
            </button>
          )}
        </div>

        {leads.length === 0 ? (
          <p className="text-sm text-gray-500">Für diesen Anbieter sind keine Leads erfasst.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-semibold">Datum</th>
                  <th className="py-2 px-4 font-semibold">Kurs</th>
                  <th className="py-2 px-4 font-semibold">E-Mail</th>
                  <th className="py-2 px-4 font-semibold">Paket damals</th>
                  <th className="py-2 px-4 font-semibold text-right">Score</th>
                  <th className="py-2 px-4 font-semibold">Bewertung</th>
                  <th className="py-2 px-4 font-semibold">Anfragetext</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <React.Fragment key={lead.id}>
                    <tr className="border-b border-gray-100">
                      <td className="py-1.5 pr-4 whitespace-nowrap">{formatDate(lead.created_at)}</td>
                      <td className="py-1.5 px-4">{lead.course_title || <em className="text-gray-400">Kurs gelöscht</em>}</td>
                      <td className="py-1.5 px-4"><EmailDeliveryStatus lead={lead} /></td>
                      <td className="py-1.5 px-4">{lead.provider_tier_at_lead ? (TIER_LABELS[lead.provider_tier_at_lead] || lead.provider_tier_at_lead) : <span className="text-gray-400">unbekannt</span>}</td>
                      <td className="py-1.5 px-4 text-right">{lead.quality_score ?? '–'}</td>
                      <td className="py-1.5 px-4">
                        <QualityStatus lead={lead} />
                      </td>
                      <td className="py-1.5 px-4">
                        {lead.message_available ? (
                          <button type="button" onClick={() => showMessage(lead.id)} className="text-blue-600 hover:underline">
                            Anzeigen
                          </button>
                        ) : (
                          <span className="text-gray-400 flex items-center gap-1" title="Der Anfragetext wird nach 60 Tagen gelöscht. Der Lead bleibt in der Statistik.">
                            <Lock className="w-3 h-3" /> gelöscht
                          </span>
                        )}
                      </td>
                    </tr>
                    {openMessage?.leadId === lead.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="p-4">
                          {openMessage.loading && <span className="text-gray-500">Lade…</span>}
                          {!openMessage.loading && openMessage.available && (
                            <>
                              <div className="text-xs text-gray-500 mb-1">
                                Wird am {formatDate(openMessage.expires_at)} automatisch gelöscht.
                              </div>
                              <pre className="whitespace-pre-wrap font-sans text-sm">{openMessage.message}</pre>
                            </>
                          )}
                          {!openMessage.loading && !openMessage.available && (
                            <span className="text-gray-500">
                              {openMessage.reason === 'expired'
                                ? 'Der Anfragetext ist abgelaufen und wurde gelöscht.'
                                : openMessage.reason === 'error'
                                  ? `Fehler: ${openMessage.error}`
                                  : 'Für diesen Lead ist kein Anfragetext (mehr) gespeichert.'}
                            </span>
                          )}
                          <div className="mt-2">
                            <button type="button" onClick={() => setOpenMessage(null)} className="text-xs text-blue-600 hover:underline">
                              Schliessen
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {leadsTotal > leadPageSize && (
          <div className="flex items-center justify-end gap-2 mt-3 text-sm text-gray-600">
            <button type="button" onClick={() => setLeadPage(p => Math.max(1, p - 1))} disabled={leadPage <= 1} className="p-1.5 border border-gray-300 rounded disabled:opacity-40" aria-label="Vorherige Lead-Seite">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Seite {leadPage} / {leadPages}</span>
            <button type="button" onClick={() => setLeadPage(p => Math.min(leadPages, p + 1))} disabled={leadPage >= leadPages} className="p-1.5 border border-gray-300 rounded disabled:opacity-40" aria-label="Naechste Lead-Seite">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

function QualityStatus({ lead }) {
  const labels = {
    scored: { text: 'bewertet', className: 'text-green-700' },
    pending: { text: 'ausstehend', className: 'text-gray-500' },
    failed: { text: 'fehlgeschlagen', className: 'text-red-600' },
    expired_unscored: { text: 'Text abgelaufen', className: 'text-gray-400' },
  };
  const entry = labels[lead.quality_status] || { text: lead.quality_status, className: 'text-gray-500' };
  return (
    <span className={entry.className} title={lead.quality_error_code ? `Fehlercode: ${lead.quality_error_code}` : undefined}>
      {entry.text}
    </span>
  );
}

function EmailDeliveryStatus({ lead }) {
  const labels = {
    pending: { text: 'wird verarbeitet', className: 'text-gray-500', title: 'Der Versand wurde noch nicht abgeschlossen.' },
    accepted: { text: 'angenommen', className: 'text-blue-700', title: 'Der Versanddienst hat die Nachricht angenommen. Das ist noch keine Zustellbestätigung.' },
    delivered: { text: 'zugestellt', className: 'text-green-700', title: 'Resend meldet die Zustellung an den Mailserver des Empfängers.' },
    delivery_delayed: { text: 'verzögert', className: 'text-amber-700', title: 'Resend meldet eine vorübergehende Zustellverzögerung.' },
    bounced: { text: 'abgewiesen', className: 'text-red-700', title: 'Der Empfänger-Mailserver hat die Nachricht dauerhaft abgewiesen.' },
    complained: { text: 'Spam-Meldung', className: 'text-red-700', title: 'Die Nachricht wurde als Spam gemeldet.' },
    failed: { text: 'fehlgeschlagen', className: 'text-red-700', title: 'Der Versanddienst hat die Nachricht nicht angenommen.' },
    suppressed: { text: 'unterdrückt', className: 'text-red-700', title: 'Resend hat den Versand wegen einer Suppression-Liste nicht ausgeführt.' },
    unknown: { text: 'nicht nachverfolgbar', className: 'text-gray-400', title: 'Für diesen älteren Lead liegt kein Zustellstatus vor.' },
  };
  const entry = labels[lead.email_delivery_status] || labels.unknown;
  return <span className={entry.className} title={entry.title}>{entry.text}</span>;
}

export default AdminLeadAnalytics;
