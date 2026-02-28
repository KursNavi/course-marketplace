import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Filter, CheckCircle, Loader, ChevronDown, X } from 'lucide-react';
import { SWISS_CANTONS, SEGMENT_CONFIG } from '../lib/constants';
import { BASE_URL } from '../lib/siteConfig';
import { useTaxonomy } from '../hooks/useTaxonomy';
import ProviderCard from './ProviderCard';

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
export default function ProviderDirectory({ t, setView }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Taxonomy for category filters
  const { types, areas, specialties, focuses, loading: taxonomyLoading } = useTaxonomy();

  // Filters
  const [selectedCanton, setSelectedCanton] = useState('');
  const [selectedType, setSelectedType] = useState('');   // level1 id
  const [selectedArea, setSelectedArea] = useState('');   // level2 id
  const [selectedSpecialty, setSelectedSpecialty] = useState(''); // level3 id
  const [selectedFocus, setSelectedFocus] = useState('');  // level4 id
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const LIMIT = 24;

  // Derived filter lists (cascade)
  const filteredAreas = selectedType
    ? areas.filter(a => a.type_id === selectedType)
    : [];
  const filteredSpecialties = selectedArea
    ? specialties.filter(s => s.area_id === selectedArea)
    : [];
  const filteredFocuses = selectedSpecialty
    ? focuses.filter(f => f.specialty_id === selectedSpecialty)
    : [];

  // Fetch providers from API
  const fetchProviders = useCallback(async (resetOffset = false) => {
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
      console.error('Error fetching providers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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

  // Cascade resets
  useEffect(() => { setSelectedArea(''); }, [selectedType]);
  useEffect(() => { setSelectedSpecialty(''); }, [selectedArea]);
  useEffect(() => { setSelectedFocus(''); }, [selectedSpecialty]);

  // SEO: Set meta tags
  useEffect(() => {
    document.title = 'Kursanbieter-Verzeichnis | KursNavi';

    const metaDescription = 'Entdecken Sie verifizierte Kursanbieter in der Schweiz. Finden Sie Schulen, Trainer und Experten für Weiterbildung, Hobbykurse und Kinderkurse.';

    let metaDescTag = document.querySelector('meta[name="description"]');
    if (!metaDescTag) {
      metaDescTag = document.createElement('meta');
      metaDescTag.name = 'description';
      document.head.appendChild(metaDescTag);
    }
    metaDescTag.content = metaDescription;

    // Canonical
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.rel = 'canonical';
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = `${BASE_URL}/anbieter`;

    // Schema.org ItemList
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

  // Clear all filters
  const clearFilters = () => {
    setSelectedCanton('');
    setSelectedType('');
    setSelectedArea('');
    setSelectedSpecialty('');
    setSelectedFocus('');
    setSearchQuery('');
    setSearchInput('');
    setVerifiedOnly(false);
  };

  const activeFilterCount =
    (selectedCanton ? 1 : 0) +
    (selectedType ? 1 : 0) +
    (selectedArea ? 1 : 0) +
    (selectedSpecialty ? 1 : 0) +
    (selectedFocus ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    (verifiedOnly ? 1 : 0);

  return (
    <div className="min-h-screen bg-beige pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-dark mb-4">
            Kursanbieter entdecken
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Finden Sie verifizierte Kursanbieter für Weiterbildung, Hobbykurse und Kinderprogramme in der ganzen Schweiz.
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
              placeholder="Anbieter suchen (z.B. Yoga, Kochen, Programmieren...)"
              className="w-full pl-12 pr-24 py-3.5 bg-white border border-gray-200 rounded-xl text-base shadow-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
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

        {/* Top-level Category Buttons (Oberkategorien) */}
        {!taxonomyLoading && types.length > 0 && (
          <div className="flex flex-wrap gap-3 justify-center mb-6">
            {types.map(type => {
              const config = SEGMENT_CONFIG[type.slug] || SEGMENT_CONFIG.privat;
              const Icon = config.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(isSelected ? '' : type.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 font-medium text-sm transition-all shadow-sm ${
                    isSelected
                      ? `${config.bgSolid} text-white border-transparent shadow-md`
                      : `bg-white ${config.text} ${config.border} ${config.hoverBg}`
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{type.label_de}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-8">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center flex-wrap">

            {/* Level 2: Area (dependent on type) */}
            {selectedType && filteredAreas.length > 0 && (
              <div className="relative w-full sm:w-auto">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full sm:w-52 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none cursor-pointer focus:outline-none focus:border-orange-400"
                >
                  <option value="">Alle Bereiche</option>
                  {filteredAreas.map(area => (
                    <option key={area.id} value={area.id}>{area.label_de}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Level 3: Specialty (dependent on area) */}
            {selectedArea && filteredSpecialties.length > 0 && (
              <div className="relative w-full sm:w-auto">
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full sm:w-52 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none cursor-pointer focus:outline-none focus:border-orange-400"
                >
                  <option value="">Alle Fachbereiche</option>
                  {filteredSpecialties.map(spec => (
                    <option key={spec.id} value={spec.id}>{spec.label_de}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Level 4: Focus (dependent on specialty) */}
            {selectedSpecialty && filteredFocuses.length > 0 && (
              <div className="relative w-full sm:w-auto">
                <select
                  value={selectedFocus}
                  onChange={(e) => setSelectedFocus(e.target.value)}
                  className="w-full sm:w-52 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none cursor-pointer focus:outline-none focus:border-orange-400"
                >
                  <option value="">Alle Schwerpunkte</option>
                  {filteredFocuses.map(focus => (
                    <option key={focus.id} value={focus.id}>{focus.label_de}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}

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
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Keine Anbieter gefunden
            </h3>
            <p className="text-gray-600 mb-4">
              Versuchen Sie, Ihre Filter anzupassen.
            </p>
            <button
              onClick={clearFilters}
              className="text-orange-500 font-medium hover:text-orange-600"
            >
              Alle Filter zurücksetzen
            </button>
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
            <span className="ml-2 text-gray-600">Laden...</span>
          </div>
        )}
      </div>
    </div>
  );
}
