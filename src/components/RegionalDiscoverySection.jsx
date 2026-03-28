import React from 'react';
import { MapPin, ArrowRight, Globe } from 'lucide-react';
import { shouldHandleClientNavigation } from '../lib/navigation';

/**
 * RegionalDiscoverySection – wiederverwendbarer Block für regionale Einstiege
 * in Bereichs-Themenwelten (Sport & Fitness, Yoga & Achtsamkeit, etc.).
 *
 * Wird zwischen Ausbildungsbereiche/Kurscluster und "Beliebte Suchen" eingesetzt.
 */
export default function RegionalDiscoverySection({
  title,
  subtitle,
  regions,
  deepLinks,
  theme,
  buildSearchUrl,
  lang = 'de',
}) {
  if (!regions || regions.length === 0) return null;

  const handleClick = (e, url) => {
    if (!shouldHandleClientNavigation(e)) return;
    e.preventDefault();
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'search' }, '', url);
    window.dispatchEvent(new Event('locationchange'));
  };

  return (
    <section className="bg-beige py-16" aria-label={title}>
      <div className="max-w-5xl mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <MapPin className={`w-6 h-6 ${theme.text}`} />
          <h2 className="text-2xl font-heading font-bold text-dark">{title}</h2>
        </div>
        <p className="text-gray-500 text-center mb-10 max-w-2xl mx-auto">
          {subtitle}
        </p>

        {/* Regional Chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {regions.map((region) => {
            const url = buildSearchUrl(region.params);
            const isOnline = region.params.delivery && !region.params.loc;
            const isAll = !region.params.loc && !region.params.delivery;
            return (
              <a
                key={region.label}
                href={url}
                onClick={(e) => handleClick(e, url)}
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 ${theme.borderLight} bg-white ${theme.text} font-medium text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}
                title={region.anchorText}
              >
                {isOnline ? (
                  <Globe className="w-4 h-4" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                <span>{region.label}</span>
                {isAll && (
                  <span className="text-xs text-gray-400 ml-1">(alle Regionen)</span>
                )}
              </a>
            );
          })}
        </div>

        {/* Deep Links (optional) */}
        {deepLinks && deepLinks.length > 0 && (
          <div className="mt-6">
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto`}>
              {deepLinks.map((link) => {
                const url = buildSearchUrl(link.params);
                return (
                  <a
                    key={link.anchorText}
                    href={url}
                    onClick={(e) => handleClick(e, url)}
                    className={`flex items-center gap-3 px-5 py-3.5 rounded-xl bg-white border ${theme.borderLight} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group`}
                  >
                    <MapPin className={`w-4 h-4 ${theme.text} flex-shrink-0`} />
                    <span className="text-sm text-dark font-medium">{link.anchorText}</span>
                    <ArrowRight className={`w-4 h-4 ml-auto flex-shrink-0 text-gray-300 group-hover:${theme.text} group-hover:translate-x-0.5 transition-all duration-150`} />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
