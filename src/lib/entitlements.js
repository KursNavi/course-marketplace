/**
 * Entitlements System
 * Central source of truth for tier-based feature access
 *
 * Tiers (in order):
 * - basic: Free tier, no public profile
 * - pro: Paid tier, public profile + directory listing
 * - premium: Higher paid tier, same as pro with more features
 * - enterprise: Top tier, includes reviews + featured status
 */

export const TIER_ORDER = ['basic', 'pro', 'premium', 'enterprise'];

/**
 * Normalize and validate tier string
 * Logs warning for unknown tiers (helps debugging)
 * @param {string} raw - Raw tier value from database
 * @returns {string} Normalized tier (defaults to 'basic')
 */
export function parseTier(raw) {
  const normalized = (raw || '').toLowerCase().trim();
  if (TIER_ORDER.includes(normalized)) return normalized;

  // Log unknown tier for debugging
  if (raw !== null && raw !== undefined && raw !== '') {
    console.warn('[Entitlements] Unknown tier:', raw);
  }

  return 'basic';
}

/**
 * Get tier display label
 * @param {string} tier - Tier identifier
 * @returns {string} Human-readable tier label
 */
export function getTierLabel(tier) {
  const labels = {
    basic: 'Basic',
    pro: 'Pro',
    premium: 'Premium',
    enterprise: 'Enterprise'
  };
  return labels[parseTier(tier)] || 'Basic';
}

/**
 * Check if tier has access to public profile
 * Pro, Premium, and Enterprise can have public profiles
 * @param {string} tier - Tier identifier
 * @returns {boolean}
 */
export function hasPublicProfile(tier) {
  return ['pro', 'premium', 'enterprise'].includes(parseTier(tier));
}

/**
 * Check if tier is listed in provider directory
 * Same as hasPublicProfile - Pro+ required
 * @param {string} tier - Tier identifier
 * @returns {boolean}
 */
export function isDirectoryListed(tier) {
  return ['pro', 'premium', 'enterprise'].includes(parseTier(tier));
}

/**
 * Check if tier has access to external reviews integration
 * Enterprise only
 * @param {string} tier - Tier identifier
 * @returns {boolean}
 */
export function hasReviews(tier) {
  return parseTier(tier) === 'enterprise';
}

/**
 * Check if tier gets featured/boosted in listings
 * Enterprise only
 * @param {string} tier - Tier identifier
 * @returns {boolean}
 */
export function isFeatured(tier) {
  return parseTier(tier) === 'enterprise';
}

/**
 * Check if tier can have a cover image
 * Enterprise only (Pro/Premium get logo only)
 * @param {string} tier - Tier identifier
 * @returns {boolean}
 */
export function hasCoverImage(tier) {
  return parseTier(tier) === 'enterprise';
}

/**
 * Get the rel attribute for homepage links based on tier
 * Following Google's sponsored/nofollow guidelines for paid links
 *
 * @param {string} tier - Tier identifier
 * @returns {string|null} rel attribute value or null if no link allowed
 */
export function getHomepageLinkRel(tier) {
  const t = parseTier(tier);

  // Enterprise: sponsored (paid link disclosure)
  if (t === 'enterprise') return 'sponsored noopener';

  // Pro/Premium: nofollow (no SEO value passed)
  if (t === 'pro' || t === 'premium') return 'nofollow noopener';

  // Basic: no public link allowed
  return null;
}

/**
 * Check if tier can edit their profile slug
 * Pro+ can edit, max 1x per month (checked separately)
 * @param {string} tier - Tier identifier
 * @returns {boolean}
 */
export function canEditSlug(tier) {
  return ['pro', 'premium', 'enterprise'].includes(parseTier(tier));
}

/**
 * Check if tier can publish their profile
 * Pro+ required
 * @param {string} tier - Tier identifier
 * @returns {boolean}
 */
export function canPublishProfile(tier) {
  return ['pro', 'premium', 'enterprise'].includes(parseTier(tier));
}

/**
 * Check if tier has access to analytics time series charts
 * Pro+ required
 * @param {string} tier - Tier identifier
 * @returns {boolean}
 */
export function hasAnalyticsCharts(tier) {
  return ['pro', 'premium', 'enterprise'].includes(parseTier(tier));
}

/**
 * Check if tier has access to advanced analytics insights & course comparison
 * Premium+ required
 * @param {string} tier - Tier identifier
 * @returns {boolean}
 */
export function hasAnalyticsInsights(tier) {
  return ['premium', 'enterprise'].includes(parseTier(tier));
}

/**
 * Get the course limit for a tier
 * @param {string} tier - Tier identifier
 * @returns {number} Maximum number of courses allowed
 */
export function getCourseLimit(tier) {
  const limits = {
    basic: 3,
    pro: 10,
    premium: 30,
    enterprise: 9999 // Unlimited
  };
  return limits[parseTier(tier)] || 3;
}

/**
 * Get the commission percentage for a tier
 * @param {string} tier - Tier identifier
 * @returns {number} Commission percentage
 */
export function getCommissionPercent(tier) {
  const commissions = {
    basic: 15,
    pro: 12,
    premium: 10,
    enterprise: 8
  };
  return commissions[parseTier(tier)] || 15;
}

/**
 * Get all entitlements for a tier as an object
 * Useful for passing to components or APIs
 * @param {string} tier - Tier identifier
 * @returns {object} All entitlements for the tier
 */
export function getAllEntitlements(tier) {
  const t = parseTier(tier);
  return {
    tier: t,
    tierLabel: getTierLabel(t),
    hasPublicProfile: hasPublicProfile(t),
    isDirectoryListed: isDirectoryListed(t),
    hasReviews: hasReviews(t),
    isFeatured: isFeatured(t),
    hasCoverImage: hasCoverImage(t),
    homepageLinkRel: getHomepageLinkRel(t),
    canEditSlug: canEditSlug(t),
    canPublishProfile: canPublishProfile(t),
    courseLimit: getCourseLimit(t),
    commissionPercent: getCommissionPercent(t),
    hasAnalyticsCharts: hasAnalyticsCharts(t),
    hasAnalyticsInsights: hasAnalyticsInsights(t)
  };
}

/**
 * Compare two tiers
 * @param {string} tier1 - First tier
 * @param {string} tier2 - Second tier
 * @returns {number} -1 if tier1 < tier2, 0 if equal, 1 if tier1 > tier2
 */
export function compareTiers(tier1, tier2) {
  const idx1 = TIER_ORDER.indexOf(parseTier(tier1));
  const idx2 = TIER_ORDER.indexOf(parseTier(tier2));

  if (idx1 < idx2) return -1;
  if (idx1 > idx2) return 1;
  return 0;
}

/**
 * Check if tier1 is at least as high as tier2
 * @param {string} tier1 - Tier to check
 * @param {string} minTier - Minimum required tier
 * @returns {boolean}
 */
export function isAtLeastTier(tier1, minTier) {
  return compareTiers(tier1, minTier) >= 0;
}
