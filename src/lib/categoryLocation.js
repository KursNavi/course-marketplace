import { buildSyntheticCategories, getPrimaryCategorySlug } from './courseCategory.js';
import { slugify } from './courseUrl.js';
import { formatPriceCHF } from './formatPrice.js';

export const MIN_INDEXABLE_CATEGORY_LOCATION_COURSES = 2;

const SWISS_CANTONS = [
  'Aargau', 'Appenzell AI', 'Appenzell AR', 'Basel-Landschaft', 'Basel-Stadt',
  'Bern', 'Fribourg', 'Genève', 'Glarus', 'Graubünden', 'Jura', 'Luzern',
  'Neuchâtel', 'Nidwalden', 'Obwalden', 'Schaffhausen', 'Schwyz', 'Solothurn',
  'St. Gallen', 'Thurgau', 'Ticino', 'Uri', 'Valais', 'Vaud', 'Zug', 'Zürich',
];

const CANTON_CODES = {
  AG: 'Aargau', AI: 'Appenzell AI', AR: 'Appenzell AR', BL: 'Basel-Landschaft',
  BS: 'Basel-Stadt', BE: 'Bern', FR: 'Fribourg', GE: 'Genève', GL: 'Glarus',
  GR: 'Graubünden', JU: 'Jura', LU: 'Luzern', NE: 'Neuchâtel', NW: 'Nidwalden',
  OW: 'Obwalden', SH: 'Schaffhausen', SZ: 'Schwyz', SO: 'Solothurn',
  SG: 'St. Gallen', TG: 'Thurgau', TI: 'Ticino', UR: 'Uri', VS: 'Valais',
  VD: 'Vaud', ZG: 'Zug', ZH: 'Zürich',
};

function categoryCode(name) {
  return Object.entries(CANTON_CODES).find(([, canton]) => canton === name)?.[0] || '';
}

const CANTON_CODE_FOR_NAME = Object.fromEntries(
  SWISS_CANTONS.map((name) => [name, categoryCode(name)])
);

const CANTON_BY_SLUG = new Map(
  SWISS_CANTONS.flatMap((name) => [
    [slugify(name), name],
    [slugify(CANTON_CODE_FOR_NAME[name]), name],
  ])
);

function isSemanticSlug(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return Boolean(text) && !/^\d+$/.test(text);
}

function topicEntryFromCategory(category) {
  const areaSlug = category?.category_area;
  const areaLabel = category?.category_area_label;
  const source = isSemanticSlug(areaSlug) ? areaSlug : areaLabel;
  if (isSemanticSlug(source)) {
    const slug = slugify(source);
    if (slug && !/^\d+$/.test(slug)) {
      return { slug, label: areaLabel || String(source).replace(/[_-]+/g, ' ').trim() };
    }
  }

  // Legacy/synthetic categories can have no area value. Keep their canonical
  // semantic topic as a fallback, matching the course detail URL builder.
  return null;
}

export function getCourseTopicEntries(course) {
  const bySlug = new Map();
  for (const category of buildSyntheticCategories(course)) {
    const entry = topicEntryFromCategory(category);
    if (entry && !bySlug.has(entry.slug)) bySlug.set(entry.slug, entry);
  }

  if (bySlug.size === 0) {
    const topic = getPrimaryCategorySlug(course);
    if (isSemanticSlug(topic)) {
      const slug = slugify(topic);
      if (slug && !/^\d+$/.test(slug)) {
        bySlug.set(slug, { slug, label: String(topic).replace(/[_-]+/g, ' ').trim() });
      }
    }
  }

  return [...bySlug.values()];
}

export function resolveSwissCanton(value) {
  if (value === null || value === undefined) return null;
  const slug = slugify(value);
  const label = CANTON_BY_SLUG.get(slug);
  return label ? { slug: slugify(label), label } : null;
}

export function filterCoursesForCategoryLocation(courses, topicSlug, locationSlug) {
  const topic = slugify(topicSlug);
  const canton = resolveSwissCanton(locationSlug);
  if (!topic || !canton) return [];

  const unique = new Map();
  for (const course of Array.isArray(courses) ? courses : []) {
    if (!course || (course.status && course.status !== 'published')) continue;
    if (resolveSwissCanton(course.canton)?.slug !== canton.slug) continue;
    if (!getCourseTopicEntries(course).some((entry) => entry.slug === topic)) continue;
    const identity = course.id ?? `${topic}:${canton.slug}:${course.title || ''}`;
    if (!unique.has(identity)) unique.set(identity, course);
  }
  return [...unique.values()];
}

export function buildCategoryLocationSeo({ topicLabel, locationLabel, stats }) {
  const totalCourses = Number(stats?.totalCourses) || 0;
  const bookableCourses = Number(stats?.bookableCourses) || 0;
  const avgPrice = Number(stats?.avgPrice) || 0;
  const title = `${topicLabel} in ${locationLabel} - ${totalCourses} Kurse vergleichen | KursNavi`;

  if (totalCourses === 0) {
    return {
      title,
      description: `Finde ${topicLabel}-Kurse in ${locationLabel}. Vergleiche Anbieter, Preise und Termine auf KursNavi.`,
    };
  }

  const bookingPhrase = bookableCourses >= totalCourses
    ? 'Buche passende Angebote direkt online.'
    : bookableCourses > 0
      ? 'Einige Angebote kannst du direkt online buchen, bei anderen fragst du unverbindlich an.'
      : 'Frage unverbindlich beim passenden Anbieter an.';
  const plural = totalCourses === 1 ? 'Kurs' : 'Kurse';
  const description = `${totalCourses} ${topicLabel}-${plural} in ${locationLabel} ab CHF ${formatPriceCHF(avgPrice)}. Vergleiche ${bookableCourses > 0 ? 'Anbieter und verfügbare Angebote' : 'Anbieter, Preise und Termine'} auf KursNavi. ${bookingPhrase}`;

  return { title, description: description.slice(0, 160) };
}

export function buildCategoryLocationRoutes(courses) {
  const groups = new Map();
  for (const course of Array.isArray(courses) ? courses : []) {
    if (!course || (course.status && course.status !== 'published')) continue;
    const canton = resolveSwissCanton(course.canton);
    if (!canton) continue;

    for (const topic of getCourseTopicEntries(course)) {
      const key = `${topic.slug}/${canton.slug}`;
      const group = groups.get(key) || {
        topicSlug: topic.slug,
        locationSlug: canton.slug,
        topicLabels: new Map(),
        courses: new Map(),
      };
      group.topicLabels.set(topic.label, (group.topicLabels.get(topic.label) || 0) + 1);
      const identity = course.id ?? `${topic.slug}/${canton.slug}/${course.title || ''}`;
      if (!group.courses.has(identity)) group.courses.set(identity, course);
      groups.set(key, group);
    }
  }

  const routes = [];
  for (const group of groups.values()) {
    const pageCourses = [...group.courses.values()];
    if (pageCourses.length < MIN_INDEXABLE_CATEGORY_LOCATION_COURSES) continue;

    const topicLabel = [...group.topicLabels.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'de'))[0]?.[0]
      || group.topicSlug.replace(/-/g, ' ');
    const bookableCourses = pageCourses.filter((course) =>
      course.booking_type === 'platform' || course.booking_type === 'platform_flex'
    ).length;
    const stats = {
      totalCourses: pageCourses.length,
      avgPrice: Math.round(
        pageCourses.reduce((sum, course) => sum + (Number(course.price) || 0), 0) / pageCourses.length
      ),
      bookableCourses,
    };
    const seo = buildCategoryLocationSeo({
      topicLabel,
      locationLabel: resolveSwissCanton(group.locationSlug).label,
      stats,
    });

    routes.push({
      path: `/courses/${group.topicSlug}/${group.locationSlug}`,
      kind: 'category-location',
      topicSlug: group.topicSlug,
      topicLabel,
      locationSlug: group.locationSlug,
      locationLabel: resolveSwissCanton(group.locationSlug).label,
      ...seo,
      ogTitle: `${topicLabel} in ${resolveSwissCanton(group.locationSlug).label}`,
      ogDescription: seo.description,
      ogType: 'website',
    });
  }

  return routes.sort((left, right) => left.path.localeCompare(right.path));
}
