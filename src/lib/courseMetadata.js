import { DELIVERY_TYPES } from './constants';

const ONLINE_HINTS = ['online', 'remote', 'zoom', 'teams', 'meet'];
const LEGACY_CATEGORY_TYPE_MAP = {
  beruflich: 'professionell',
  privat_hobby: 'privat',
  kinder_jugend: 'kinder'
};

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

function isOnlineToken(token) {
  return ONLINE_HINTS.some((hint) => token.includes(hint));
}

export function normalizeCategoryType(value) {
  if (!value) return value ?? null;
  const normalized = String(value).trim().toLowerCase();
  return LEGACY_CATEGORY_TYPE_MAP[normalized] || normalized;
}

export function buildSyntheticCategories(course) {
  if (!course || Array.isArray(course.all_categories) && course.all_categories.length > 0) {
    return Array.isArray(course?.all_categories) ? course.all_categories : [];
  }

  if (!course.category_type && !course.category_area && !course.category_specialty && !course.category_focus) {
    return [];
  }

  return [{
    category_type: normalizeCategoryType(course.category_type) || null,
    category_type_label: course.category_type_label || null,
    category_area: course.category_area || course.primary_category || null,
    category_area_label: course.category_area_label || null,
    category_specialty: course.category_specialty || null,
    category_specialty_label: course.category_specialty_label || course.category_specialty || null,
    category_focus: course.category_focus || null,
    category_focus_label: course.category_focus_label || course.category_focus || null,
    is_primary: true,
    is_synthetic: true
  }];
}

function isSyntheticCategory(category) {
  return Boolean(
    category?.is_synthetic ||
    (
      category &&
      !category.type_id &&
      !category.area_id &&
      !category.specialty_id &&
      !category.focus_id &&
      !category.course_id
    )
  );
}

function getPreferredCategoryTopic(category, fallbackCourse) {
  if (!category) return fallbackCourse?.primary_category || fallbackCourse?.category_area || 'kurs';

  if (isSyntheticCategory(category)) {
    return (
      category.category_focus_label ||
      category.category_focus ||
      category.category_specialty_label ||
      category.category_specialty ||
      category.category_area_label ||
      category.category_area ||
      fallbackCourse?.primary_category ||
      fallbackCourse?.category_area ||
      'kurs'
    );
  }

  return category.category_area || fallbackCourse?.primary_category || fallbackCourse?.category_area || 'kurs';
}

export function getPrimaryCategory(course) {
  if (!course) return null;
  const categories = buildSyntheticCategories(course);
  if (categories.length > 0) {
    return categories.find((entry) => entry?.is_primary) || categories[0];
  }
  if (course.category_type || course.category_area || course.category_specialty || course.category_focus) {
    return {
      category_type: normalizeCategoryType(course.category_type) || null,
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
  return getPreferredCategoryTopic(primary, course);
}

export function getPrimaryCategoryLabel(course) {
  const primary = getPrimaryCategory(course);
  if (isSyntheticCategory(primary)) {
    const syntheticLabel = (
      primary?.category_focus_label ||
      primary?.category_focus ||
      primary?.category_specialty_label ||
      primary?.category_specialty
    );
    if (syntheticLabel) return syntheticLabel;
  }
  if (primary?.category_area_label) return primary.category_area_label;
  const area = getPreferredCategoryTopic(primary, course);
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
  const locationTokens = collectLocationTokens(course);
  const explicit = [
    ...(Array.isArray(course?.delivery_types) ? course.delivery_types : []),
    course?.delivery_type
  ]
    .map(normalizeDeliveryTypeKey)
    .filter(Boolean);

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
