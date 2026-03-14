import { DELIVERY_TYPES } from './constants';

const ONLINE_HINTS = ['online', 'remote', 'zoom', 'teams', 'meet'];

function normalizeDeliveryTypeKey(value) {
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

export function getPrimaryCategory(course) {
  if (!course) return null;
  if (Array.isArray(course.all_categories) && course.all_categories.length > 0) {
    return course.all_categories.find((entry) => entry?.is_primary) || course.all_categories[0];
  }
  if (course.category_type || course.category_area || course.category_specialty || course.category_focus) {
    return {
      category_type: course.category_type || null,
      category_area: course.category_area || course.primary_category || null,
      category_area_label: course.category_area_label || null,
      category_specialty: course.category_specialty || null,
      category_specialty_label: course.category_specialty_label || null,
      category_focus: course.category_focus || null,
      category_focus_label: course.category_focus_label || null,
      is_primary: true
    };
  }
  if (course.primary_category) {
    return {
      category_type: null,
      category_area: course.primary_category,
      category_area_label: null,
      category_specialty: null,
      category_specialty_label: null,
      category_focus: null,
      category_focus_label: null,
      is_primary: true
    };
  }
  return null;
}

export function getPrimaryCategorySlug(course) {
  const primary = getPrimaryCategory(course);
  return primary?.category_area || course?.primary_category || course?.category_area || 'kurs';
}

export function getPrimaryCategoryLabel(course) {
  const primary = getPrimaryCategory(course);
  if (primary?.category_area_label) return primary.category_area_label;
  const area = primary?.category_area || course?.primary_category || course?.category_area;
  return area ? String(area).replace(/_/g, ' ') : '';
}

export function getCourseCategoryText(course) {
  const primary = getPrimaryCategory(course);
  return (
    primary?.category_focus_label ||
    primary?.category_focus ||
    primary?.category_specialty_label ||
    primary?.category_specialty ||
    primary?.category_area_label ||
    primary?.category_area ||
    course?.category_specialty ||
    course?.category_area ||
    course?.primary_category ||
    ''
  );
}

export function getNormalizedDeliveryTypes(course) {
  const explicit = [
    ...(Array.isArray(course?.delivery_types) ? course.delivery_types : []),
    course?.delivery_type
  ]
    .map(normalizeDeliveryTypeKey)
    .filter(Boolean);

  if (explicit.length > 0) {
    return [...new Set(explicit)];
  }

  const locationTokens = collectLocationTokens(course);
  const hasOnlineHint = locationTokens.some((token) => ONLINE_HINTS.some((hint) => token.includes(hint)));
  return hasOnlineHint ? ['online_live'] : [];
}
