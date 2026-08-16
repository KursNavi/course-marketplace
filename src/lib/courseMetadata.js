import { DELIVERY_TYPES } from './constants';

// Die Kategorie-Auflösung liegt in ./courseCategory.js, damit sie auch in
// Serverless-Funktionen nutzbar ist (dieses Modul zieht über ./constants
// lucide-react nach). Re-Export: bestehende Importe bleiben gültig.
export {
  normalizeCategoryType,
  buildSyntheticCategories,
  isSyntheticCategory,
  getPrimaryCategory,
  getPrimaryCategorySlug,
  getPrimaryCategoryLabel,
  getCourseCategoryText
} from './courseCategory';

const ONLINE_HINTS = ['online', 'remote', 'zoom', 'teams', 'meet'];

export function normalizeDeliveryTypeKey(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'online') return 'online_live';
  if (normalized === 'onsite' || normalized === 'in_person') return 'presence';
  return Object.prototype.hasOwnProperty.call(DELIVERY_TYPES, normalized) ? normalized : null;
}

function collectLocationTokens(course) {
  const values = [
    course?.canton,
    course?.address,
    course?.location,
    ...(Array.isArray(course?.course_events)
      ? course.course_events.flatMap((event) => [event?.canton, event?.location, event?.city, event?.street])
      : [])
  ];

  if (course?.additional_locations) {
    try {
      const parsed = typeof course.additional_locations === 'string'
        ? JSON.parse(course.additional_locations)
        : course.additional_locations;
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          values.push(entry?.canton, entry?.city, entry?.location);
        });
      }
    } catch {
      values.push(course.additional_locations);
    }
  }

  return values
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
}

function isOnlineToken(token) {
  return ONLINE_HINTS.some((hint) => token.includes(hint));
}

export function getNormalizedDeliveryTypes(course) {
  const locationTokens = collectLocationTokens(course);
  // Use delivery_types (array) if present; fall back to legacy delivery_type (string) only when absent.
  // This prevents the stale DB default 'presence' in the old column from poisoning the result.
  const hasNewField = Array.isArray(course?.delivery_types) && course.delivery_types.length > 0;
  const rawExplicit = hasNewField ? course.delivery_types : [course?.delivery_type];
  const explicit = rawExplicit.map(normalizeDeliveryTypeKey).filter(Boolean);

  if (explicit.length > 0) {
    const uniqueExplicit = [...new Set(explicit)];
    const hasOnlineHint = locationTokens.some((token) => isOnlineToken(token));
    const hasPhysicalHint = locationTokens.some((token) => token && !isOnlineToken(token));
    const onlyPresenceSelected = uniqueExplicit.every((type) => type === 'presence');

    if (onlyPresenceSelected && hasOnlineHint && !hasPhysicalHint) {
      return ['online_live'];
    }

    return uniqueExplicit;
  }

  const hasOnlineHint = locationTokens.some((token) => isOnlineToken(token));
  return hasOnlineHint ? ['online_live'] : [];
}
