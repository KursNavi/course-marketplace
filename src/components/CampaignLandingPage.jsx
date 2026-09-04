import React, { useEffect, useMemo } from 'react';
import { ArrowRight, CheckCircle2, MapPin, Search } from 'lucide-react';
import { getCampaignLanding } from '../lib/campaignLandingConfig';
import { buildCoursePath, CANONICAL_BASE_URL } from '../lib/siteConfig';
import { getPriceLabel } from '../lib/formatPrice';
import { trackCampaignCta, trackCampaignView } from '../lib/analytics';

function normalize(value) {
  return String(value || '').toLocaleLowerCase('de-CH');
}

function courseSearchText(course) {
  const categories = Array.isArray(course.all_categories) ? course.all_categories : [];
  return [
    course.title,
    course.instructor_name,
    course.keywords,
    course.category_area,
    course.category_specialty,
    course.category_focus,
    ...categories.flatMap((category) => [
      category.category_area,
      category.category_specialty,
      category.category_specialty_label,
      category.category_focus,
      category.category_focus_label,
    ]),
  ].map(normalize).join(' ');
}

function courseMatchesType(course, aliases) {
  const categories = Array.isArray(course.all_categories) ? course.all_categories : [];
  const types = [course.category_type, ...categories.map((category) => category.category_type)]
    .map(normalize);
  return types.some((type) => aliases.includes(type));
}

function hasCurrentAvailability(course) {
  const datedOffers = [
    course.start_date,
    ...(Array.isArray(course.course_events) ? course.course_events.map((event) => (
      event?.cancelled_at ? null : event?.end_date || event?.start_date
    )) : []),
  ].filter(Boolean);

  if (datedOffers.length === 0) return true;
  return datedOffers.some((date) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      const [year, month, day] = String(date).split('-').map(Number);
      return Date.UTC(year, month - 1, day + 1) > Date.now();
    }
    const timestamp = new Date(date).getTime();
    return Number.isFinite(timestamp) && timestamp >= Date.now();
  });
}

function buildSearchUrl(params) {
  const search = new URLSearchParams(params);
  return `/search?${search.toString()}`;
}

export default function CampaignLandingPage({ slug, courses = [], setView, setSelectedCourse }) {
  const config = getCampaignLanding(slug);

  const matchingCourses = useMemo(() => {
    if (!config) return [];
    return courses
      .filter((course) => course.status === 'published')
      .filter(hasCurrentAvailability)
      .filter((course) => courseMatchesType(course, config.typeAliases))
      .filter((course) => {
        const text = courseSearchText(course);
        return config.matchTerms.some((term) => text.includes(normalize(term)));
      })
      .sort((a, b) =>
        Number(b.instructor_name === config.focusProvider) - Number(a.instructor_name === config.focusProvider)
        || Number(Boolean(b.is_prio)) - Number(Boolean(a.is_prio))
        || String(a.title).localeCompare(String(b.title), 'de')
      );
  }, [config, courses]);

  useEffect(() => {
    const previousTitle = document.title;
    const canonicalHref = `${CANONICAL_BASE_URL}/kampagne/${encodeURIComponent(slug)}`;
    const previousDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const previousRobots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';

    let campaignViewTracked = false;
    const trackViewWithConsent = () => {
      if (!config || campaignViewTracked || window.Cookiebot?.consent?.statistics !== true) return;
      trackCampaignView(slug);
      campaignViewTracked = true;
    };

    if (config) {
      document.title = `${config.title} | KursNavi`;
      trackViewWithConsent();
      window.addEventListener('CookiebotOnAccept', trackViewWithConsent);
      window.addEventListener('CookiebotOnConsentReady', trackViewWithConsent);
    } else {
      document.title = 'Seite nicht gefunden | KursNavi';
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    const createdCanonical = !canonical;
    const previousCanonical = canonical?.getAttribute('href') || '';
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalHref;

    let description = document.querySelector('meta[name="description"]');
    const createdDescription = !description;
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = config?.subtitle || 'Die gesuchte Kampagnenseite wurde nicht gefunden.';

    let robots = document.querySelector('meta[name="robots"]');
    const createdRobots = !robots;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = config ? 'noindex,follow' : 'noindex,nofollow';

    return () => {
      window.removeEventListener('CookiebotOnAccept', trackViewWithConsent);
      window.removeEventListener('CookiebotOnConsentReady', trackViewWithConsent);
      document.title = previousTitle;
      if (createdCanonical) canonical.remove();
      else canonical.setAttribute('href', previousCanonical);
      if (createdDescription) description.remove();
      else description.setAttribute('content', previousDescription);
      if (createdRobots) robots.remove();
      else robots.setAttribute('content', previousRobots);
    };
  }, [config, slug]);

  if (!config) {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-bold text-dark mb-3">Seite nicht gefunden</h1>
          <a className="text-primary font-semibold hover:underline" href="/search">Zur Kurssuche</a>
        </div>
      </div>
    );
  }

  const providerCount = new Set(matchingCourses.map((course) => course.instructor_name).filter(Boolean)).size;
  const ready = matchingCourses.length >= config.minCourses;
  const searchUrl = buildSearchUrl(config.searchParams);

  const openCourse = (event, course) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    trackCampaignCta(slug, 'course');
    setSelectedCourse?.(course);
    setView?.('detail');
    window.history.pushState({ view: 'detail' }, '', buildCoursePath(course));
    window.dispatchEvent(new Event('locationchange'));
    window.scrollTo(0, 0);
  };

  return (
    <main className="min-h-screen bg-beige">
      <section className="bg-dark text-white">
        <div className="max-w-5xl mx-auto px-4 py-14 md:py-20">
          <p className="text-sm font-semibold tracking-wide uppercase text-orange-200 mb-3">KursNavi</p>
          <h1 className="text-3xl md:text-5xl font-heading font-bold leading-tight max-w-3xl">{config.title}</h1>
          <p className="mt-4 text-lg text-gray-200 max-w-2xl">{config.subtitle}</p>
          {ready && (
            <a href={searchUrl} onClick={() => trackCampaignCta(slug)} className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-full bg-primary font-bold text-white hover:bg-orange-600 transition-colors">
              Angebote ansehen <ArrowRight className="w-4 h-4" />
            </a>
          )}
          {config.notice && <p className="mt-4 text-sm text-gray-200 leading-relaxed">{config.notice}</p>}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl mb-8">
          <h2 className="text-2xl font-heading font-bold text-dark mb-3">Passende aktuelle Angebote</h2>
          <p className="text-gray-600 leading-relaxed">{config.intro}</p>
          {ready && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              {matchingCourses.length} {matchingCourses.length === 1 ? 'Kurs' : 'Kurse'} von {providerCount} {providerCount === 1 ? 'Anbieter' : 'Anbietern'} verfügbar
            </p>
          )}
        </div>

        {ready ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {matchingCourses.slice(0, 9).map((course) => (
                <a key={course.id} href={buildCoursePath(course)} onClick={(event) => openCourse(event, course)} className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="h-36 bg-gray-100 overflow-hidden">
                    {course.image_url ? (
                      <img src={course.image_url} alt={course.title || 'Kursangebot'} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" />
                    ) : (
                      <div className="h-full flex items-center justify-center text-3xl" aria-hidden="true">📚</div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-primary font-semibold mb-1">{course.instructor_name || 'Kursanbieter'}</p>
                    <h3 className="font-heading font-bold text-dark leading-snug line-clamp-2">{course.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                      {course.canton && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{course.canton}</span>}
                      {getPriceLabel(course) && <span>{getPriceLabel(course)}</span>}
                    </div>
                  </div>
                </a>
              ))}
            </div>
            <div className="mt-8 text-center">
              <a href={searchUrl} onClick={() => trackCampaignCta(slug)} className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
                Alle passenden Angebote und Filter anzeigen <Search className="w-4 h-4" />
              </a>
            </div>
          </>
        ) : (
          <div className="bg-white border border-amber-200 rounded-2xl p-7 max-w-2xl">
            <h2 className="font-heading font-bold text-dark text-lg">Diese Kampagnenseite ist noch nicht startbereit.</h2>
            <p className="text-gray-600 mt-2">Es stehen derzeit nicht genügend passende, veröffentlichte Angebote zur Verfügung. Deshalb sollte noch kein Google-Ads-Traffic auf diese Seite geleitet werden.</p>
          </div>
        )}
      </section>
    </main>
  );
}
