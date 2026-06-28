import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MapPin, Filter, CheckCircle, Loader, ChevronDown, X } from 'lucide-react';
import { SWISS_CANTONS, SEGMENT_CONFIG } from '../lib/constants';
import { BASE_URL } from '../lib/siteConfig';
import { useTaxonomy } from '../hooks/useTaxonomy';
import ProviderCard from './ProviderCard';

// Module-level constant — must NOT be inside the component to avoid TDZ errors
// when referenced by useState lazy initializers or early useEffect calls.
const URL_TO_DB_TYPE_PROVIDER = {
  beruflich: 'professionell',
  privat_hobby: 'privat',
  kinder_jugend: 'kinder',
};

/**
 * ProviderDirectory Component
 * Public directory listing of Pro+ providers with published profiles
 *
 * Features:
 * - Filter by canton, category (type/area/specialty/focus), text search
 * - Categories derived from provider's courses (new taxonomy schema)
 * - SEO: Meta tags, canonical URL, schema.org
 * - Pagination/Load more
 */
export default function ProviderDirectory({ t, setView, embedded = false }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Taxonomy for category filters
  const { types, areas, getSpecialtyObjects, loading: taxonomyLoading } = useTaxonomy();

  // Filters
  const [selectedCanton, setSelectedCanton] = useState('');
  const [selectedType, setSelectedType] = useState('');   // level1 id
  const [selectedArea, setSelectedArea] = useState('');   // level2 id
  const [selectedSpecialty, setSelectedSpecialty] = useState(''); // level3 id
  const [selectedFocus, setSelectedFocus] = useState('');  // level4 id
  // Initialize from URL q param so the search term is preserved when switching tabs
  const [searchQuery, setSearchQuery] = useState(() => {
    return new URLSearchParams(window.location.search).get('q') || '';
  });
  const [searchInput, setSearchInput] = useState(() => {
    return new URLSearchParams(window.location.search).get('q') || '';
  });

  // Initialize from URL pro param so verified filter is preserved on direct navigation
  const [verifiedOnly, setVerifiedOnly] = useState(() =>
    new URLSearchParams(window.location.search).get('pro') === '1'
  );

  // Ref so the type sync effect doesn't need selectedType in its deps
  // (avoids listener re-registration on every type change → no missed events)
  const selectedTypeRef = useRef(selectedType);
  useEffect(() => { selectedTypeRef.current = selectedType; }, [selectedType]);

  // Read URL type param DIRECTLY on every render — no state, no lag.
  // This guarantees the title/theme is correct even when activeType is stale
  // (e.g. component stays mounted while segment changes, or taxonomy hasn't loaded yet).
  const _urlTypeParam = new URLSearchParams(window.location.search).get('type');
  const urlSegmentSlug = _urlTypeParam ? (URL_TO_DB_TYPE_PROVIDER[_urlTypeParam] || _urlTypeParam) : null;

  // URL param ALWAYS wins (nullish coalescing ?? — only falls back to activeType when no type in URL).
  // Using || would let a stale activeType.slug override the new URL param for one render.
  const activeType = types.find(tp => tp.id === selectedType);
  const resolvedSlug = urlSegmentSlug ?? activeType?.slug ?? null;
  const segmentConfig = SEGMENT_CONFIG[resolvedSlug] || SEGMENT_CONFIG.privat;

  const INTRO_TEXTS = {
    professionell: {
      title: 'Anbieter für berufliche Weiterbildung',
      subtitle: 'Finde Schulen, Akademien und Kursleiter für Fachkurse, Zertifikate und berufliche Weiterbildung in der Schweiz.'
    },
    privat: {
      title: 'Anbieter für Hobby & Freizeit',
      subtitle: 'Finde Kursanbieter und Kursleiter für Hobby, Freizeit und persönliche Weiterbildung in der Schweiz.'
    },
    kinder: {
      title: 'Anbieter für Kinder & Jugendliche',
      subtitle: 'Finde geeignete Kursanbieter und Schulen für Kinder und Jugendliche in der Schweiz.'
    }
  };

  const introText = INTRO_TEXTS[resolvedSlug] || {
    title: 'Anbieter in der Schweiz',
    subtitle: 'Finde passende Kursanbieter, Schulen und Kursleiter in der Schweiz.'
  };

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const LIMIT = 24;

  // Derived filter lists (cascade)
  // Areas: flat array filtered by type_id matches correctly
  const filteredAreas = selectedType
    ? areas.filter(a => a.type_id === selectedType)
    : [];
  // Specialties: use getSpecialtyObjects helper which reads from the nested taxonomy object
  // (more reliable than filtering the flat specialties array by UUID)
  const filteredSpecialties = (selectedType && selectedArea)
    ? getSpecialtyObjects(selectedType, selectedArea)
    : [];
  // Focuses: nested inside the selected specialty object (.focuses array)
  const selectedSpecialtyObj = filteredSpecialties.find(s => s.id === selectedSpecialty);
  const filteredFocuses = selectedSpecialtyObj ? (selectedSpecialtyObj.focuses || []) : [];

  // Stale request protection: discard responses from outdated fetches
  const fetchIdRef = useRef(0);

  // Fetch providers from API
  const fetchProviders = useCallback(async (resetOffset = false) => {
    const fetchId = ++fetchIdRef.current;
    try {
      setLoading(true);
      const currentOffset = resetOffset ? 0 : offset;

      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        offset: currentOffset.toString()
      });

      // New taxonomy IDs (used by the updated API)
      if (selectedType) params.append('level1_id', selectedType);
      if (selectedArea) params.append('level2_id', selectedArea);
      if (selectedSpecialty) params.append('level3_id', selectedSpecialty);
      if (selectedFocus) params.append('level4_id', selectedFocus);
      if (selectedCanton) params.append('canton', selectedCanton);
      if (searchQuery) params.append('q', searchQuery);
      if (verifiedOnly) params.append('verified', 'true');

      const response = await fetch(`/api/provider?action=directory&${params}`);
      const data = await response.json();

      // Discard stale response if a newer fetch was started
      if (fetchId !== fetchIdRef.current) return;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch providers');
      }

      if (resetOffset) {
        setProviders(data.providers || []);
        setOffset(LIMIT);
      } else {
        setProviders(prev => [...prev, ...(data.providers || [])]);
        setOffset(prev => prev + LIMIT);
      }

      setHasMore(data.pagination?.hasMore || false);
      setTotalCount(data.pagination?.total || 0);
      setError(null);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      console.error('Error fetching providers:', err);
      setError(err.message);
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, [offset, selectedCanton, selectedType, selectedArea, selectedSpecialty, selectedFocus, searchQuery, verifiedOnly]);

  // Initial fetch and on filter change
  useEffect(() => {
    fetchProviders(true);
  }, [selectedCanton, selectedType, selectedArea, selectedSpecialty, selectedFocus, searchQuery, verifiedOnly]);

  // Handle search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  // Batched filter change handlers — reset all dependent filters in one render cycle
  // to prevent intermediate fetches with stale params (race condition fix)
  const changeType = useCallback((newType) => {
    setSelectedType(newType);
    setSelectedArea('');
    setSelectedSpecialty('');
    setSelectedFocus('');
  }, []);

  const changeArea = useCallback((newArea) => {
    setSelectedArea(newArea);
    setSelectedSpecialty('');
    setSelectedFocus('');
  }, []);

  const changeSpecialty = useCallback((newSpecialty) => {
    setSelectedSpecialty(newSpecialty);
    setSelectedFocus('');
  }, []);

  // Read type from URL param — normalize legacy course-search slugs to DB slugs
  useEffect(() => {
    if (types.length === 0) return;

    const syncTypeFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const typeParam = params.get('type');
      const normalizedType = typeParam
        ? (URL_TO_DB_TYPE_PROVIDER[typeParam] || typeParam)
        : null;
      if (normalizedType) {
        const matched = types.find(t => t.slug === normalizedType);
        if (matched && matched.id !== selectedTypeRef.current) changeType(matched.id);
      } else if (!selectedTypeRef.current) {
        changeType(types[0]?.id || '');
      }
    };

    syncTypeFromUrl(); // initial read

    window.addEventListener('popstate', syncTypeFromUrl);
    window.addEventListener('locationchange', syncTypeFromUrl);
    return () => {
      window.removeEventListener('popstate', syncTypeFromUrl);
      window.removeEventListener('locationchange', syncTypeFromUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, changeType]);

  // Sync q from URL on navigation (popstate / locationchange).
  // Lazy init only runs at mount; this effect handles subsequent URL changes.
  useEffect(() => {
    const syncQFromUrl = () => {
      const q = new URLSearchParams(window.location.search).get('q') || '';
      setSearchQuery(q);
      setSearchInput(q);
    };
    window.addEventListener('popstate', syncQFromUrl);
    window.addEventListener('locationchange', syncQFromUrl);
    return () => {
      window.removeEventListener('popstate', syncQFromUrl);
      window.removeEventListener('locationchange', syncQFromUrl);
    };
  }, []);

  // Sync verifiedOnly from URL pro param on navigation (popstate / locationchange).
  useEffect(() => {
    const syncVerifiedFromUrl = () => {
      setVerifiedOnly(new URLSearchParams(window.location.search).get('pro') === '1');
    };
    window.addEventListener('popstate', syncVerifiedFromUrl);
    window.addEventListener('locationchange', syncVerifiedFromUrl);
    return () => {
      window.removeEventListener('popstate', syncVerifiedFromUrl);
      window.removeEventListener('locationchange', syncVerifiedFromUrl);
    };
  }, []);

  // SEO: Grunddaten sofort beim Mount setzen (unabhängig vom API-Ergebnis)
  // → Google's Renderer sieht Titel, Description und Canonical ohne auf Supabase zu warten
  useEffect(() => {
    const pageTitle = 'Kursanbieter in der Schweiz | KursNavi';
    const metaDescription = 'Entdecke geprüfte Kursanbieter und Bildungsinstitutionen in der Schweiz. Finde den passenden Anbieter für deine Weiterbildung.';

    document.title = pageTitle;

    let metaDescTag = document.querySelector('meta[name="description"]');
    if (!metaDescTag) {
      metaDescTag = document.createElement('meta');
      metaDescTag.name = 'description';
      document.head.appendChild(metaDescTag);
    }
    metaDescTag.content = metaDescription;

    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.rel = 'canonical';
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = `${BASE_URL}/anbieter`;
  }, []);

  // SEO: Schema.org ItemList – wird aktualisiert sobald Anbieter geladen sind
  useEffect(() => {
    const metaDescription = 'Entdecke geprüfte Kursanbieter und Bildungsinstitutionen in der Schweiz. Finde den passenden Anbieter für deine Weiterbildung.';

    const schemaData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Kursanbieter auf KursNavi",
      "description": metaDescription,
      "numberOfItems": totalCount,
      "itemListElement": providers.slice(0, 10).map((p, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "item": {
          "@type": "EducationalOrganization",
          "name": p.name,
          "url": `${BASE_URL}/anbieter/${p.slug}`
        }
      }))
    };

    let schemaScript = document.querySelector('script[data-schema="provider-list"]');
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.type = 'application/ld+json';
      schemaScript.setAttribute('data-schema', 'provider-list');
      document.head.appendChild(schemaScript);
    }
    schemaScript.textContent = JSON.stringify(schemaData);

    return () => {
      schemaScript?.remove();
    };
  }, [providers, totalCount]);

  // Navigate to provider profile
  const handleProviderClick = (slug) => {
    window.history.pushState({}, '', `/anbieter/${slug}`);
    setView('provider-profile');
  };

  // Clear all filters — keep the URL type so segment stays consistent.
  // Also updates the URL so App.jsx filterPro / filterQ stays in sync.
  const clearFilters = () => {
    setSelectedCanton('');
    // Re-read type from URL so segment is preserved (don't reset to '')
    const urlType = new URLSearchParams(window.location.search).get('type');
    const normalizedType = urlType ? (URL_TO_DB_TYPE_PROVIDER[urlType] || urlType) : null;
    const matched = normalizedType ? types.find(t => t.slug === normalizedType) : null;
    changeType(matched?.id || '');
    setSearchQuery('');
    setSearchInput('');
    setVerifiedOnly(false);

    // Update URL: keep only segment context (type, tab=anbieter), remove all user filters
    const newParams = new URLSearchParams();
    if (urlType) newParams.set('type', urlType);
    newParams.set('tab', 'anbieter');
    window.history.replaceState(
      window.history.state || {},
      '',
      '/search?' + newParams.toString()
    );
  };

  // selectedType is driven by URL segment — not a user-applied filter, so don't count it
  const activeFilterCount =
    (selectedCanton ? 1 : 0) +
    (selectedArea ? 1 : 0) +
    (selectedSpecialty ? 1 : 0) +
    (selectedFocus ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    (verifiedOnly ? 1 : 0);

  return (
    <div className={`min-h-screen bg-beige ${embedded ? 'pt-6' : 'pt-24'} pb-16`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className={`text-3xl md:text-4xl font-heading font-bold mb-4 ${segmentConfig.text}`}>
            {introText.title}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {introText.subtitle}
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Anbieter, Schule oder Kursleiter suchen"
              className="w-full pl-12 pr-24 py-3.5 bg-white border border-gray-200 rounded-xl text-base shadow-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
            />
            <button
              type="submit"
              className={`absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 ${segmentConfig.bgSolid} text-white rounded-lg text-sm font-medium transition-colors hover:opacity-90`}
            >
              Suchen
            </button>
          </div>
          {searchQuery && (
            <p className="text-center text-sm text-gray-500 mt-2">
              Suche nach: <span className="font-medium text-gray-700">"{searchQuery}"</span>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchInput(''); }}
                className="ml-2 text-orange-500 hover:text-orange-600"
              >
                (zurücksetzen)
              </button>
            </p>
          )}
        </form>


        {/* Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-8">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center flex-wrap">

            {/* Canton Filter */}
            <div className="relative w-full sm:w-auto">
              <select
                value={selectedCanton}
                onChange={(e) => setSelectedCanton(e.target.value)}
                className="w-full sm:w-44 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none cursor-pointer focus:outline-none focus:border-orange-400"
              >
                <option value="">Alle Kantone</option>
                {SWISS_CANTONS.filter(c => c !== 'Online' && c !== 'Ausland').map(canton => (
                  <option key={canton} value={canton}>{canton}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Verified Only Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400"
              />
              <span className="flex items-center text-sm text-gray-700">
                <CheckCircle className="w-4 h-4 mr-1 text-blue-500" />
                Nur verifizierte
              </span>
            </label>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4 mr-1" />
                Filter zurücksetzen ({activeFilterCount})
              </button>
            )}

            {/* Results Count */}
            <div className="lg:ml-auto text-sm text-gray-500">
              {totalCount} {totalCount === 1 ? 'Anbieter' : 'Anbieter'} gefunden
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            <p>Fehler beim Laden der Anbieter: {error}</p>
            <button
              onClick={() => fetchProviders(true)}
              className="text-sm underline mt-2"
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {/* Loading State (initial) */}
        {loading && providers.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-8 h-8 text-orange-500 animate-spin" />
            <span className="ml-3 text-gray-600">Anbieter werden geladen...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && providers.length === 0 && !error && (
          <div className="text-center py-20" data-testid="provider-empty-state">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Keine passenden Anbieter gefunden.
            </h3>
            <p className="text-gray-600 mb-4">
              Passe deine Suche oder die Filter an.
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-orange-500 font-medium hover:text-orange-600"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}

        {/* Provider Grid */}
        {providers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onClick={handleProviderClick}
                segmentConfig={segmentConfig}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <div className="text-center mt-10">
            <button
              onClick={() => fetchProviders(false)}
              className="px-6 py-3 bg-white border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Mehr Anbieter laden
            </button>
          </div>
        )}

        {/* Loading More */}
        {loading && providers.length > 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 text-orange-500 animate-spin" />
            <span className="ml-2 text-gray-600">Weitere Anbieter werden geladen…</span>
          </div>
        )}
      </div>
    </div>
  );
}
