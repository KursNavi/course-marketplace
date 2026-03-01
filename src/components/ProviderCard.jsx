import React from 'react';
import { MapPin, CheckCircle, Star, BookOpen } from 'lucide-react';

/**
 * ProviderCard Component
 * Compact card for displaying provider in directory listing
 *
 * Props:
 * - provider: Provider data object
 * - onClick: Click handler for navigation
 */
export default function ProviderCard({ provider, onClick, segmentConfig }) {
  const {
    name,
    slug,
    description,
    logoUrl,
    location,
    isVerified,
    isFeatured,
    courseCount,
    tier
  } = provider;

  // Segment-aware colors with orange fallback
  const accentText = segmentConfig?.text || 'text-orange-500';
  const accentBgLight = segmentConfig?.bgLight || 'bg-orange-50';
  const accentBorderLight = segmentConfig?.borderLight || 'border-orange-200';
  const accentGradient = segmentConfig?.gradient || 'from-orange-500/70 to-orange-400/90';

  return (
    <div
      onClick={() => onClick?.(slug)}
      className={`
        bg-white rounded-xl shadow-sm border overflow-hidden cursor-pointer
        transition-all duration-300 hover:shadow-xl hover:-translate-y-1
        ${isFeatured ? `${accentBorderLight} ring-2 ring-current/10` : 'border-gray-100'}
      `}
    >
      {/* Featured Badge */}
      {isFeatured && (
        <div className={`bg-gradient-to-r ${accentGradient} text-white text-xs font-bold px-3 py-1 text-center`}>
          <Star className="w-3 h-3 inline mr-1" />
          Featured Anbieter
        </div>
      )}

      <div className="p-5">
        {/* Header: Logo + Name */}
        <div className="flex items-start gap-4 mb-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${name} Logo`}
                className="w-16 h-16 rounded-xl object-contain bg-white border border-gray-100 p-1"
              />
            ) : (
              <div className={`w-16 h-16 rounded-xl ${accentBgLight} flex items-center justify-center`}>
                <span className={`text-2xl font-bold ${accentText}`}>
                  {name?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
            )}
          </div>

          {/* Name + Badges */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-gray-900 truncate">
              {name}
            </h3>

            <div className="flex items-center gap-2 mt-1">
              {/* Location */}
              {(location?.city || location?.canton) && (
                <span className="flex items-center text-sm text-gray-500">
                  <MapPin className="w-3.5 h-3.5 mr-1" />
                  {location.city || location.canton}
                </span>
              )}
            </div>

            {/* Verification Badge */}
            {isVerified && (
              <span className="inline-flex items-center text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-2">
                <CheckCircle className="w-3 h-3 mr-1" />
                Verifiziert
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-4">
            {description}
          </p>
        )}

        {/* Footer: Course Count + CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="flex items-center text-sm text-gray-500">
            <BookOpen className="w-4 h-4 mr-1.5" />
            {courseCount} {courseCount === 1 ? 'Kurs' : 'Kurse'}
          </span>

          <span className={`text-sm font-medium ${accentText}`}>
            Profil ansehen &rarr;
          </span>
        </div>
      </div>
    </div>
  );
}
