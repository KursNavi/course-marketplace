import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, BookOpen, Compass } from 'lucide-react';
import { RATGEBER_STRUCTURE } from '../lib/ratgeberStructure';
import { getBereicheForSegment, getBereichUrl } from '../lib/bereichLandingConfig';
import { shouldHandleClientNavigation } from '../lib/navigation';

/**
 * MegaMenu Component
 *
 * Renders a hover-activated dropdown menu for each main category.
 * Shows:
 * - "Zu den Angeboten" link (to search)
 * - 4 Themen-Cluster links (to cluster overview pages)
 */
export const MegaMenu = ({
  categoryKey, // 'beruflich' | 'privat_hobby' | 'kinder_jugend'
  label,
  Icon,
  config,
  isActive,
  lang = 'de'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef(null);
  const menuRef = useRef(null);

  // Map internal keys to ratgeber structure keys
  const ratgeberKey = categoryKey === 'privat_hobby' ? 'privat_hobby' :
                      categoryKey === 'kinder_jugend' ? 'kinder_jugend' :
                      categoryKey;

  const categoryData = RATGEBER_STRUCTURE[ratgeberKey];

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150); // Small delay to allow moving to submenu
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Navigate to segment landing page
  const SEGMENT_TO_LANDING = {
    beruflich: '/professional',
    privat_hobby: '/private',
    kinder_jugend: '/children',
  };

  const goToLanding = () => {
    setIsOpen(false);
    window.scrollTo(0, 0);
    const path = SEGMENT_TO_LANDING[categoryKey] || `/search?type=${categoryKey}`;
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('locationchange'));
  };

  // Navigate to search with category filter
  const goToSearch = () => {
    setIsOpen(false);
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'search' }, '', `/search?type=${categoryKey}`);
    window.dispatchEvent(new Event('locationchange'));
  };

  // Navigate to cluster page
  const goToCluster = (clusterSlug) => {
    setIsOpen(false);
    window.scrollTo(0, 0);
    const categorySlug = categoryData?.slug || categoryKey;
    window.history.pushState({ view: 'ratgeber-cluster' }, '', `/ratgeber/${categorySlug}/${clusterSlug}`);
    window.dispatchEvent(new Event('locationchange'));
  };

  // Get available Bereichs-Landingpages for this segment
  const bereiche = getBereicheForSegment(categoryKey);

  // Navigate to Bereich landing page
  const goToBereich = (bereichConfig) => {
    setIsOpen(false);
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'bereich-landing' }, '', getBereichUrl(bereichConfig));
    window.dispatchEvent(new Event('locationchange'));
  };

  // Translations
  const t = {
    toOffers: {
      de: 'Zu den Angeboten',
      en: 'View Offers',
      fr: 'Voir les offres',
      it: 'Vedi offerte'
    },
    ratgeber: {
      de: 'Ratgeber',
      en: 'Guides',
      fr: 'Guides',
      it: 'Guide'
    },
    themenwelten: {
      de: 'Themenwelten',
      en: 'Topic Worlds',
      fr: 'Mondes thématiques',
      it: 'Mondi tematici'
    }
  };

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
      <button
        onClick={goToLanding}
        className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 font-sans ${
          isActive
            ? `${config.bgLight} ${config.text} border-b-2 ${config.border}`
            : `text-gray-500 hover:text-gray-700`
        }`}
      >
        <Icon className={`w-4 h-4 mr-1.5 ${isActive ? config.text : 'text-gray-400'}`} />
        {label}
        <ChevronRight className={`w-3 h-3 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && categoryData && (
        <div
          className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ minWidth: '280px' }}
        >
          {/* "Zu den Angeboten" - Primary Action */}
          <a
            href={`/search?type=${categoryKey}`}
            onClick={(e) => {
              if (!shouldHandleClientNavigation(e)) return;
              e.preventDefault();
              goToSearch();
            }}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 ${config.hoverBg} transition-colors group`}
          >
            <div className={`p-2 rounded-lg ${config.bgLight}`}>
              <Icon className={`w-5 h-5 ${config.text}`} />
            </div>
            <div className="flex-1">
              <span className={`font-bold ${config.text} text-sm`}>
                {t.toOffers[lang] || t.toOffers.de}
              </span>
              <span className="text-gray-400 text-xs block">
                {label}
              </span>
            </div>
            <ChevronRight className={`w-4 h-4 ${config.text} opacity-0 group-hover:opacity-100 transition-opacity`} />
          </a>

          {/* Divider */}
          <div className="border-t border-gray-100 my-2" />

          {/* Ratgeber Section Header */}
          <div className="px-4 py-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" />
              {t.ratgeber[lang] || t.ratgeber.de}
            </span>
          </div>

          {/* Cluster Links */}
          {Object.values(categoryData.clusters).map((cluster) => {
            const ClusterIcon = cluster.icon;
            return (
              <a
                key={cluster.slug}
                href={`/ratgeber/${categoryData?.slug || categoryKey}/${cluster.slug}`}
                onClick={(e) => {
                  if (!shouldHandleClientNavigation(e)) return;
                  e.preventDefault();
                  goToCluster(cluster.slug);
                }}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
              >
                <div className="p-1.5 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                  <ClusterIcon className="w-4 h-4 text-gray-500" />
                </div>
                <span className="text-gray-700 text-sm font-medium group-hover:text-gray-900 transition-colors flex-1">
                  {cluster.label[lang] || cluster.label.de}
                </span>
                <ChevronRight className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            );
          })}

          {/* Themenwelten Section */}
          {bereiche.length > 0 && (
            <>
              <div className="border-t border-gray-100 my-2" />
              <div className="px-4 py-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Compass className="w-3 h-3" />
                  {t.themenwelten[lang] || t.themenwelten.de}
                </span>
              </div>
              {bereiche.map((bereich) => (
                <a
                  key={bereich.slug}
                  href={getBereichUrl(bereich)}
                  onClick={(e) => {
                    if (!shouldHandleClientNavigation(e)) return;
                    e.preventDefault();
                    goToBereich(bereich);
                  }}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 ${config.hoverBg} transition-colors group`}
                >
                  <div className={`p-1.5 rounded-lg ${config.bgLight}`}>
                    <Compass className={`w-4 h-4 ${config.text}`} />
                  </div>
                  <span className="text-gray-700 text-sm font-medium group-hover:text-gray-900 transition-colors flex-1">
                    {bereich.title[lang] || bereich.title.de}
                  </span>
                  <ChevronRight className={`w-3 h-3 ${config.text} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </a>
              ))}
              <p className="px-4 py-2 text-xs text-gray-500">
                Weitere Themenwelten sind in Arbeit und folgen demnächst.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * MobileMenuCategory Component
 *
 * For mobile: Expandable category with cluster links
 */
export const MobileMenuCategory = ({
  categoryKey,
  label,
  Icon,
  config,
  isActive,
  lang = 'de',
  onClose
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const ratgeberKey = categoryKey === 'privat_hobby' ? 'privat_hobby' :
                      categoryKey === 'kinder_jugend' ? 'kinder_jugend' :
                      categoryKey;

  const categoryData = RATGEBER_STRUCTURE[ratgeberKey];
  const bereiche = getBereicheForSegment(categoryKey);

  const SEGMENT_TO_LANDING = {
    beruflich: '/professional',
    privat_hobby: '/private',
    kinder_jugend: '/children',
  };

  const goToLanding = () => {
    onClose?.();
    window.scrollTo(0, 0);
    const path = SEGMENT_TO_LANDING[categoryKey] || `/search?type=${categoryKey}`;
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('locationchange'));
  };

  const goToSearch = () => {
    onClose?.();
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'search' }, '', `/search?type=${categoryKey}`);
    window.dispatchEvent(new Event('locationchange'));
  };

  const goToCluster = (clusterSlug) => {
    onClose?.();
    window.scrollTo(0, 0);
    const categorySlug = categoryData?.slug || categoryKey;
    window.history.pushState({ view: 'ratgeber-cluster' }, '', `/ratgeber/${categorySlug}/${clusterSlug}`);
    window.dispatchEvent(new Event('locationchange'));
  };

  const goToBereich = (bereichConfig) => {
    onClose?.();
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'bereich-landing' }, '', getBereichUrl(bereichConfig));
    window.dispatchEvent(new Event('locationchange'));
  };

  const t = {
    toOffers: {
      de: 'Zu den Angeboten',
      en: 'View Offers',
      fr: 'Voir les offres',
      it: 'Vedi offerte'
    },
    ratgeber: {
      de: 'Ratgeber',
      en: 'Guides',
      fr: 'Guides',
      it: 'Guide'
    },
    themenwelten: {
      de: 'Themenwelten',
      en: 'Topic Worlds',
      fr: 'Mondes thématiques',
      it: 'Mondi tematici'
    }
  };

  return (
    <div className="border-b border-gray-100">
      {/* Main Category Button */}
      <div className="flex items-center">
        <button
          onClick={goToLanding}
          className={`flex-1 flex items-center text-left px-3 py-3 text-base font-medium transition-all font-sans ${
            isActive
              ? `${config.bgLight} ${config.text}`
              : `text-gray-700`
          }`}
        >
          <Icon className={`w-5 h-5 mr-3 ${isActive ? config.text : 'text-gray-400'}`} />
          {label}
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-3 ${config.hoverBg} rounded-lg mr-2`}
        >
          <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && categoryData && (
        <div className="bg-gray-50 py-2 animate-in slide-in-from-top-2 duration-200">
          {/* To Offers */}
          <button
            onClick={goToSearch}
            className={`w-full text-left px-6 py-2 text-sm font-bold ${config.text} flex items-center gap-2`}
          >
            <Icon className="w-4 h-4" />
            {t.toOffers[lang] || t.toOffers.de}
          </button>

          {/* Ratgeber Header */}
          <div className="px-6 py-1 mt-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {t.ratgeber[lang] || t.ratgeber.de}
            </span>
          </div>

          {/* Cluster Links */}
          {Object.values(categoryData.clusters).map((cluster) => {
            const ClusterIcon = cluster.icon;
            return (
              <button
                key={cluster.slug}
                onClick={() => goToCluster(cluster.slug)}
                className="w-full text-left px-6 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
              >
                <ClusterIcon className="w-4 h-4 text-gray-400" />
                {cluster.label[lang] || cluster.label.de}
              </button>
            );
          })}

          {/* Themenwelten */}
          {bereiche.length > 0 && (
            <>
              <div className="px-6 py-1 mt-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                  <Compass className="w-3 h-3" />
                  {t.themenwelten[lang] || t.themenwelten.de}
                </span>
              </div>
              {bereiche.map((bereich) => (
                <button
                  key={bereich.slug}
                  onClick={() => goToBereich(bereich)}
                  className={`w-full text-left px-6 py-2 text-sm ${config.text} font-medium flex items-center gap-2`}
                >
                  <Compass className="w-4 h-4" />
                  {bereich.title[lang] || bereich.title.de}
                </button>
              ))}
              <p className="px-6 py-2 text-xs text-gray-500">
                Weitere Themenwelten sind in Arbeit und folgen demnächst.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MegaMenu;
