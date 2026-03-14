import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin, CheckCircle, Mail, ArrowLeft, BookOpen,
  Globe, Phone, Loader, Star, ChevronRight, Award, Search, SortAsc
} from 'lucide-react';
import { BASE_URL, buildCoursePath } from '../lib/siteConfig';
import { formatPriceCHF, getPriceLabel } from '../lib/formatPrice';
import { getCourseCategoryText } from '../lib/courseMetadata';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Neueste zuerst' },
  { value: 'alpha', label: 'Alphabetisch' },
  { value: 'price_asc', label: 'Preis aufsteigend' },
  { value: 'price_desc', label: 'Preis absteigend' },
];

/**
 * ProviderProfilePage Component
 * Public profile page for Pro+ providers
 */
export default function ProviderProfilePage({ t, setView, setSelectedCourse }) {
  const [provider, setProvider] = useState(null);
  const [courses, setCourses] = useState([]);
  const [entitlements, setEntitlements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [redirect, setRedirect] = useState(null);

  // Course filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filterCanton, setFilterCanton] = useState('');

  // Get slug from URL
  const getSlugFromUrl = () => {
    const path = window.location.pathname;
    const match = path.match(/^\/anbieter\/([^/]+)\/?$/);
    return match ? match[1] : null;
  };

  const slug = getSlugFromUrl();

  // Fetch provider data
  useEffect(() => {
    if (!slug) {
      setError('Kein Anbieter angegeben');
      setLoading(false);
      return;
    }

    const fetchProvider = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/provider?action=profile&slug=${slug}`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            setError('Anbieter nicht gefunden');
          } else {
            setError(data.error || 'Fehler beim Laden');
          }
          return;
        }

        // Handle redirect (old slug to new slug)
        if (data.redirect) {
          setRedirect(data);
          window.history.replaceState({}, '', `/anbieter/${data.newSlug}`);
          const newResponse = await fetch(`/api/provider?action=profile&slug=${data.newSlug}`);
          const newData = await newResponse.json();
          if (newResponse.ok && !newData.redirect) {
            setProvider(newData.provider);
            setCourses(newData.courses || []);
            setEntitlements(newData.entitlements);
          }
          return;
        }

        setProvider(data.provider);
        setCourses(data.courses || []);
        setEntitlements(data.entitlements);
        setError(null);
      } catch (err) {
        console.error('Error fetching provider:', err);
        setError('Fehler beim Laden des Anbieters');
      } finally {
        setLoading(false);
      }
    };

    fetchProvider();
  }, [slug]);

  // SEO: Set meta tags
  useEffect(() => {
    if (!provider) return;

    document.title = `${provider.name} - Kursanbieter | KursNavi`;

    const metaDescription = (provider.description || '').substring(0, 155) + '...';

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
    canonicalTag.href = `${BASE_URL}/anbieter/${provider.slug}`;

    const ogTags = {
      'og:title': `${provider.name} - Kursanbieter`,
      'og:description': metaDescription,
      'og:url': `${BASE_URL}/anbieter/${provider.slug}`,
      'og:image': provider.logoUrl || `${BASE_URL}/og-default.jpg`,
      'og:type': 'profile',
      'og:site_name': 'KursNavi'
    };

    Object.entries(ogTags).forEach(([property, content]) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.content = content;
    });

    const schemaData = {
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      "name": provider.name,
      "url": `${BASE_URL}/anbieter/${provider.slug}`,
      "logo": provider.logoUrl,
      "description": provider.description,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": provider.location?.city,
        "addressRegion": provider.location?.canton,
        "addressCountry": "CH"
      }
    };

    const sameAs = [provider.websiteUrl, provider.socialLinkedin, provider.socialInstagram, provider.socialFacebook, provider.socialYoutube].filter(Boolean);
    if (sameAs.length > 0) schemaData.sameAs = sameAs;

    let schemaScript = document.querySelector('script[data-schema="provider"]');
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.type = 'application/ld+json';
      schemaScript.setAttribute('data-schema', 'provider');
      document.head.appendChild(schemaScript);
    }
    schemaScript.textContent = JSON.stringify(schemaData);

    return () => {
      schemaScript?.remove();
    };
  }, [provider]);

  // Navigate to course detail
  const handleCourseClick = (course) => {
    const path = buildCoursePath(course);
    window.history.pushState({}, '', path);
    setSelectedCourse(course);
    setView('detail');
  };

  // Back navigation
  const handleBack = () => {
    window.history.back();
  };

  // Available cantons from courses (for filter dropdown)
  const availableCantons = useMemo(() => {
    const cantons = [...new Set(courses.map(c => c.canton).filter(Boolean))].sort();
    return cantons;
  }, [courses]);

  // Filter + sort courses
  const filteredCourses = useMemo(() => {
    let result = [...courses];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.category_specialty || '').toLowerCase().includes(q) ||
        (c.category_area || '').toLowerCase().includes(q)
      );
    }

    if (filterCanton) {
      result = result.filter(c => c.canton === filterCanton);
    }

    switch (sortBy) {
      case 'alpha':
        result.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
        break;
      case 'price_asc':
        result.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        break;
      case 'price_desc':
        result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
    }
    return result;
  }, [courses, searchQuery, sortBy, filterCanton]);

  // Social links helper
  const socialLinks = useMemo(() => {
    if (!provider) return [];
    const links = [];
    if (provider.socialLinkedin) links.push({ url: provider.socialLinkedin, label: 'LinkedIn', icon: 'in' });
    if (provider.socialInstagram) links.push({ url: provider.socialInstagram, label: 'Instagram', icon: 'ig' });
    if (provider.socialFacebook) links.push({ url: provider.socialFacebook, label: 'Facebook', icon: 'fb' });
    if (provider.socialYoutube) links.push({ url: provider.socialYoutube, label: 'YouTube', icon: 'yt' });
    return links;
  }, [provider]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-beige pt-24 flex items-center justify-center">
        <Loader className="w-8 h-8 text-orange-500 animate-spin" />
        <span className="ml-3 text-gray-600">Anbieter wird geladen...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-beige pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center py-20">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">?</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error}
          </h1>
          <p className="text-gray-600 mb-8">
            Der gesuchte Anbieter konnte nicht gefunden werden oder ist nicht mehr verfügbar.
          </p>
          <button
            onClick={() => { window.history.pushState({}, '', '/anbieter'); setView('provider-directory'); }}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            Zurück zum Anbieter-Verzeichnis
          </button>
        </div>
      </div>
    );
  }

  if (!provider) return null;

  return (
    <div className="min-h-screen bg-beige pt-24 pb-16">
      {/* Cover Image */}
      {provider.coverImageUrl && (
        <div className="w-full h-48 md:h-64 lg:h-80 relative">
          <img
            src={provider.coverImageUrl}
            alt={`${provider.name} Cover`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 mt-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </button>

        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Logo */}
            <div className="flex-shrink-0">
              {provider.logoUrl ? (
                <img
                  src={provider.logoUrl}
                  alt={`${provider.name} Logo`}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-contain bg-white border border-gray-100 p-1"
                />
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
                  <span className="text-4xl font-bold text-orange-400">
                    {provider.name?.charAt(0)?.toUpperCase() || 'A'}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-start gap-3 mb-3">
                <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900">
                  {provider.name}
                </h1>

                {entitlements?.isFeatured && (
                  <span className="inline-flex items-center text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                    <Star className="w-4 h-4 mr-1.5 fill-current" />
                    Featured
                  </span>
                )}

                {provider.isVerified && (
                  <span className="inline-flex items-center text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Verifiziert
                  </span>
                )}
              </div>

              {(provider.location?.city || provider.location?.canton) && (
                <p className="flex items-center text-gray-600 mb-4">
                  <MapPin className="w-4 h-4 mr-2" />
                  {[provider.location.city, provider.location.canton].filter(Boolean).join(', ')}
                </p>
              )}

              {provider.additionalLocations?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {provider.additionalLocations.map((loc, idx) => (
                    <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {[loc.city, loc.canton].filter(Boolean).join(', ')}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center">
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  {provider.courseCount} {provider.courseCount === 1 ? 'Kurs' : 'Kurse'}
                </span>
                {provider.certificates?.length > 0 && (
                  <span className="flex items-center">
                    <Award className="w-4 h-4 mr-1.5" />
                    {provider.certificates.length} Zertifikate
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 md:min-w-[200px]">
              {provider.websiteUrl && entitlements?.homepageLinkRel && (
                <a
                  href={provider.websiteUrl}
                  target="_blank"
                  rel={entitlements.homepageLinkRel}
                  className="flex items-center justify-center px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Website besuchen
                </a>
              )}

              {provider.phone && (
                <a
                  href={`tel:${provider.phone}`}
                  className="flex items-center justify-center px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  {provider.phone}
                </a>
              )}

            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {provider.description && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Über uns</h2>
                <div className="prose prose-gray max-w-none">
                  <p className="text-gray-600 whitespace-pre-line">{provider.description}</p>
                </div>
              </div>
            )}

            {/* Certificates */}
            {provider.certificates?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Zertifikate & Qualifikationen</h2>
                <div className="flex flex-wrap gap-2">
                  {provider.certificates.map((cert, idx) => (
                    <span key={idx} className="inline-flex items-center text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
                      <Award className="w-4 h-4 mr-1.5" />
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Courses with Filter */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Kurse von {provider.name}
                  <span className="text-gray-400 font-normal text-base ml-2">({filteredCourses.length})</span>
                </h2>
              </div>

              {/* Filter Bar */}
              {courses.length > 3 && (
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Kurs suchen..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                    />
                  </div>
                  {availableCantons.length > 1 && (
                    <select
                      value={filterCanton}
                      onChange={e => setFilterCanton(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                    >
                      <option value="">Alle Kantone</option>
                      {availableCantons.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  <div className="relative">
                    <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                    >
                      {SORT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {filteredCourses.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {searchQuery || filterCanton ? 'Keine Kurse für diese Filter gefunden.' : 'Momentan sind keine Kurse verfügbar.'}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredCourses.map((course) => (
                    <div
                      key={course.id}
                      onClick={() => handleCourseClick(course)}
                      className="flex gap-4 p-4 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 cursor-pointer transition-all"
                    >
                      {course.image_url ? (
                        <img
                          src={course.image_url}
                          alt={course.title}
                          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-6 h-6 text-gray-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 line-clamp-1">{course.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {getCourseCategoryText(course)}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          {course.canton && (
                            <span className="flex items-center text-gray-500">
                              <MapPin className="w-3.5 h-3.5 mr-1" />
                              {course.canton}
                            </span>
                          )}
                          <span className="font-bold text-orange-600">
                            {getPriceLabel(course)}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 self-center" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
              <h3 className="font-bold text-gray-900 mb-4">Auf einen Blick</h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{provider.courseCount} Kurse</p>
                    <p className="text-sm text-gray-500">Verfügbare Angebote</p>
                  </div>
                </div>

                {provider.location?.canton && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {[provider.location.city, provider.location.canton].filter(Boolean).join(', ')}
                      </p>
                      <p className="text-sm text-gray-500">Hauptstandort</p>
                    </div>
                  </div>
                )}

                {provider.isVerified && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Verifiziert</p>
                      <p className="text-sm text-gray-500">Geprüft von KursNavi</p>
                    </div>
                  </div>
                )}

                {provider.contactEmail && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <a
                        href={`mailto:${provider.contactEmail}`}
                        className="font-medium text-gray-900 hover:text-orange-600 transition-colors break-all"
                      >
                        {provider.contactEmail}
                      </a>
                      <p className="text-sm text-gray-500">E-Mail Kontakt</p>
                    </div>
                  </div>
                )}

                {provider.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <a
                        href={`tel:${provider.phone}`}
                        className="font-medium text-gray-900 hover:text-orange-600 transition-colors"
                      >
                        {provider.phone}
                      </a>
                      <p className="text-sm text-gray-500">Telefon</p>
                    </div>
                  </div>
                )}

                {provider.websiteUrl && entitlements?.homepageLinkRel && (
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <a
                        href={provider.websiteUrl}
                        target="_blank"
                        rel={entitlements.homepageLinkRel}
                        className="font-medium text-gray-900 hover:text-orange-600 transition-colors break-all"
                      >
                        {provider.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                      <p className="text-sm text-gray-500">Webseite</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Social Links */}
              {socialLinks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-500 mb-3">Social Media</p>
                  <div className="flex flex-wrap gap-2">
                    {socialLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="nofollow noopener"
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                {provider.contactEmail ? (
                  <a
                    href={`mailto:${provider.contactEmail}`}
                    className="w-full flex items-center justify-center px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    E-Mail senden
                  </a>
                ) : (
                  <button
                    onClick={() => setView('contact')}
                    className="w-full flex items-center justify-center px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Kontakt aufnehmen
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
