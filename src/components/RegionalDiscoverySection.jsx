import React from 'react';
import { MapPin, Globe } from 'lucide-react';
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
  theme,
  buildSearchUrl,
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
        <div className="flex flex-wrap justify-center gap-3">
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
      </div>
    </section>
  );
}
