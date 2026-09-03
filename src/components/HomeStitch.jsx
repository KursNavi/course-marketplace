import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, Briefcase, Palette, Smile, BookOpen, MapPin, CalendarDays, CheckCircle2 } from 'lucide-react';
import { LocationDropdown, DeliveryTypeFilter } from './Filters';
import { BASE_URL, buildCoursePath } from '../lib/siteConfig';
import { RATGEBER_STRUCTURE } from '../lib/ratgeberStructure';

const FALLBACK_COURSE_IMAGE = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop';
const SEGMENT_CARDS = [
  { key: 'beruflich', configKey: 'beruflich', title: 'Beruflich', description: 'Weiterbildungen, Zertifikate und Seminare für deinen nächsten Karriereschritt.', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=900&auto=format&fit=crop', Icon: Briefcase },
  { key: 'privat_hobby', configKey: 'privat_hobby', title: 'Privat & Hobby', description: 'Sprachen, Kunst, Sport und Freizeitangebote für mehr Balance im Alltag.', image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=900&auto=format&fit=crop', Icon: Palette },
  { key: 'kinder_jugend', configKey: 'kinder_jugend', title: 'Kinder & Jugend', description: 'Nachhilfe, Feriencamps und Förderkurse für die Entwicklung deines Kindes.', image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=900&auto=format&fit=crop', Icon: Smile },
];

function getCourseSegment(course) {
  const categoryType = course?.category_type || course?.all_categories?.[0]?.category_type;
  if (categoryType === 'professionell' || categoryType === 'beruflich') return SEGMENT_CARDS[0];
  if (categoryType === 'kinder') return SEGMENT_CARDS[2];
  return SEGMENT_CARDS[1];
}

function getCoursePrice(course) {
  if (course?.price === null || course?.price === undefined || course?.price === '') return 'Preis auf Anfrage';
  const price = Number(course.price);
  if (Number.isNaN(price)) return 'Preis auf Anfrage';
  return price === 0 ? 'Kostenlos' : `CHF ${price.toFixed(0)}`;
}

export const HomeStitch = ({
  lang, t, setView, courses, setSearchType, searchQuery, setSearchQuery,
  selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef,
  selectedDeliveryTypes, setSelectedDeliveryTypes, deliveryMenuOpen, setDeliveryMenuOpen, deliveryMenuRef,
  isLoading = false,
}) => {
  const [homeSegment, setHomeSegment] = useState('alle');

  const guessTypeFromQuery = (query) => {
    const lower = query.toLowerCase();
    const kids = ['kinder', 'jugend', 'camp', 'feriencamp', 'geburtstag', 'kid', 'schüler'];
    const professional = ['excel', 'zertifikat', 'zertifizierung', 'ausbildung', 'diplom', 'fachausweis', 'mba', 'cas', 'das', 'eidg', 'fachkraft', 'weiterbildung', 'berufs', 'karriere', 'lehrgang', 'seminar', 'brevet'];
    if (kids.some((keyword) => lower.includes(keyword))) return 'kinder_jugend';
    if (professional.some((keyword) => lower.includes(keyword))) return 'beruflich';
    return 'privat_hobby';
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedLocations?.length) params.set('loc', selectedLocations.join(','));
    if (selectedDeliveryTypes?.length) params.set('delivery', selectedDeliveryTypes.join(','));
    if (homeSegment !== 'alle') params.set('type', homeSegment);
    else { params.set('type', searchQuery ? guessTypeFromQuery(searchQuery) : 'privat_hobby'); params.set('autoType', '1'); }
    window.history.pushState({ view: 'search' }, '', `/search?${params.toString()}`);
    window.dispatchEvent(new Event('locationchange'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToSearch = (type) => {
    setSearchType?.(type);
    window.history.pushState({ view: 'search' }, '', `/search?type=${type}`);
    window.dispatchEvent(new Event('locationchange'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToCourse = (event, course) => {
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const path = buildCoursePath(course) || `/search?q=${encodeURIComponent(course.title || '')}`;
    window.history.pushState({ view: 'detail', courseId: course.id }, '', path);
    window.dispatchEvent(new Event('locationchange'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToTeacherHub = () => {
    window.history.pushState({ view: 'teacher-hub' }, '', '/teacher-hub');
    setView?.('teacher-hub');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    document.title = 'KursNavi - Der Schweizer Kursmarktplatz für Weiterbildung & Freizeit';
    const metaDescription = 'Entdecke Kurse in der Schweiz: Weiterbildung, Hobbys sowie Kinder- und Jugendkurse. Vergleiche Anbieter und finde ein Angebot, das zu dir passt.';
    let metaDescTag = document.querySelector('meta[name="description"]');
    if (!metaDescTag) { metaDescTag = document.createElement('meta'); metaDescTag.name = 'description'; document.head.appendChild(metaDescTag); }
    metaDescTag.content = metaDescription;
    const canonicalUrl = `${BASE_URL}/`;
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) { canonicalTag = document.createElement('link'); canonicalTag.rel = 'canonical'; document.head.appendChild(canonicalTag); }
    canonicalTag.href = canonicalUrl;
  }, []);

  const availableCourses = (courses || []).filter((course) => course?.status !== 'draft');
  const featuredCourses = availableCourses.slice(0, 3);
  const quickTopics = Object.values(RATGEBER_STRUCTURE).flatMap((segment) => Object.values(segment.clusters || {}).map((cluster) => ({ ...cluster, segment: segment.slug }))).slice(0, 6);

  return (
    <div className="relative w-full overflow-hidden bg-[#FAF5F0] font-sans text-[#333333]">
      {isLoading && <div className="absolute inset-x-0 top-0 z-40 flex h-[60vh] items-center justify-center pointer-events-none"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[#FA6E28] border-t-transparent" role="status" aria-label="Laden" /></div>}

      <section className="relative border-b border-[#EBE4DE] px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[min(760px,90vw)] -translate-x-1/2 rounded-full bg-[#FFF0EB] blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#A43D00]"><span className="h-2 w-2 rounded-full bg-[#FA6E28]" /> KursNavi · Kurse in der Schweiz</span>
          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold leading-[1.05] tracking-[-0.045em] text-[#333333] sm:text-6xl">Finde den Kurs, der zu dir passt.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#594138] sm:text-lg">{t.home_subhead || 'Vergleiche Weiterbildung, Hobbys und Kinderkurse in der Schweiz – online und vor Ort.'}</p>
          <div className="mx-auto mt-10 max-w-3xl rounded-[1.25rem] border border-[#EBE4DE] bg-white p-3 text-left shadow-[0_18px_55px_rgba(93,64,48,0.12)] sm:p-5">
            <form onSubmit={handleSearch} className="space-y-3">
              <label htmlFor="home-search-input" className="sr-only">Was möchtest du lernen oder erleben?</label>
              <div className="relative"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8D7166]" aria-hidden="true" /><input id="home-search-input" type="text" placeholder={t.search_placeholder || 'z.B. Excel, Yoga, Gitarre...'} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-lg border border-[#EBE4DE] bg-[#FAF5F0] py-4 pl-12 pr-4 text-base text-[#333333] outline-none transition focus:border-[#78B3CE] focus:bg-white focus:ring-2 focus:ring-[#78B3CE]/30" /></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                <LocationDropdown selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} t={t} buttonClassName={`w-full rounded-lg border px-4 py-3 text-left text-sm font-semibold transition ${locMenuOpen ? 'border-[#78B3CE] bg-[#C8E6F0] text-[#25657E]' : 'border-[#EBE4DE] bg-white text-[#594138] hover:border-[#78B3CE]'}`} />
                <DeliveryTypeFilter selectedDeliveryTypes={selectedDeliveryTypes} setSelectedDeliveryTypes={setSelectedDeliveryTypes} deliveryMenuOpen={deliveryMenuOpen} setDeliveryMenuOpen={setDeliveryMenuOpen} deliveryMenuRef={deliveryMenuRef} t={t} buttonClassName={`w-full rounded-lg border px-4 py-3 text-left text-sm font-semibold transition ${deliveryMenuOpen ? 'border-[#78B3CE] bg-[#C8E6F0] text-[#25657E]' : 'border-[#EBE4DE] bg-white text-[#594138] hover:border-[#78B3CE]'}`} />
                <div className="flex items-center gap-2 rounded-lg border border-[#EBE4DE] bg-white px-3 py-2"><span className="text-xs font-bold uppercase tracking-wide text-[#8D7166]">Bereich</span><select value={homeSegment} onChange={(event) => setHomeSegment(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#333333] outline-none"><option value="alle">Alle Bereiche</option><option value="beruflich">Beruflich</option><option value="privat_hobby">Privat & Hobby</option><option value="kinder_jugend">Kinder & Jugend</option></select></div>
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FA6E28] px-6 py-3 font-bold text-white transition hover:bg-[#A43D00] focus:outline-none focus:ring-2 focus:ring-[#78B3CE] focus:ring-offset-2">{t.btn_search || 'Kurse entdecken'} <ArrowRight className="h-4 w-4" /></button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20"><div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#A43D00]">Entdecken</p><h2 className="font-heading text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Welche Richtung interessiert dich?</h2></div><p className="max-w-md text-sm leading-6 text-[#594138]">Wähle einen Bereich und entdecke passende Kurse, Anbieter und Themenwelten.</p></div><div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {SEGMENT_CARDS.map(({ key, title, description, image, Icon }) => { const accent = key === 'beruflich' ? 'border-[#78B3CE] bg-[#C8E6F0]' : key === 'privat_hobby' ? 'border-[#FA6E28] bg-[#FFF0EB]' : 'border-[#6DB58A] bg-[#E8F5EC]'; const accentText = key === 'beruflich' ? 'text-[#25657E]' : key === 'privat_hobby' ? 'text-[#A43D00]' : 'text-[#23734A]'; return <a key={key} href={`/search?type=${key}`} onClick={(event) => { event.preventDefault(); navigateToSearch(key); }} className={`group overflow-hidden rounded-xl border ${accent} transition hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(93,64,48,0.13)]`}><div className="relative aspect-[16/9] overflow-hidden"><img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#333333]/65 to-transparent" /><div className="absolute bottom-4 left-4 flex items-center gap-2 text-white"><Icon className="h-5 w-5" /><span className="font-heading text-xl font-bold">{title}</span></div></div><div className="p-5"><p className="min-h-12 text-sm leading-6 text-[#594138]">{description}</p><span className={`mt-4 inline-flex items-center gap-2 text-sm font-bold ${accentText}`}>Entdecken <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div></a>; })}
      </div></section>

      <section className="border-y border-[#B7DCE8] bg-[#EAF6FA] px-4 py-16 sm:px-6 sm:py-20"><div className="mx-auto max-w-7xl"><div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#25657E]">Ausgewählt für dich</p><h2 className="font-heading text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Empfehlungen</h2><p className="mt-2 text-sm text-[#594138]">Entdecke spannende Angebote quer durch alle Bereiche.</p></div><button type="button" onClick={() => navigateToSearch('privat_hobby')} className="inline-flex items-center gap-2 self-start text-sm font-bold text-[#25657E] hover:underline sm:self-auto">Alle ansehen <ArrowRight className="h-4 w-4" /></button></div>{featuredCourses.length > 0 ? <div className="grid grid-cols-1 gap-5 md:grid-cols-3">{featuredCourses.map((course) => { const segment = getCourseSegment(course); const SegmentIcon = segment.Icon; return <a key={course.id} href={buildCoursePath(course) || '/search'} onClick={(event) => navigateToCourse(event, course)} className="group overflow-hidden rounded-xl border border-[#D5EAF0] bg-white shadow-[0_8px_22px_rgba(37,101,126,0.08)] transition hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(37,101,126,0.14)]"><div className="relative aspect-[16/9] overflow-hidden"><img src={course.image_url || FALLBACK_COURSE_IMAGE} alt={course.title || 'Kurs'} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#594138]"><SegmentIcon className="h-3.5 w-3.5" />{segment.title}</span></div><div className="p-5"><h3 className="line-clamp-2 min-h-12 font-heading text-lg font-bold text-[#333333] group-hover:text-[#A43D00]">{course.title}</h3><div className="mt-4 space-y-2 text-xs text-[#594138]"><span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-[#25657E]" />{course.canton || course.city || 'Schweiz'}</span>{course.session_length && <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-[#25657E]" />{course.session_length}</span>}<span className="block pt-2 text-sm font-bold text-[#A43D00]">{getCoursePrice(course)}</span></div></div></a>; })}</div> : <div className="rounded-xl border border-dashed border-[#B7DCE8] bg-white px-6 py-10 text-center text-sm text-[#594138]">Sobald Kurse verfügbar sind, erscheinen hier passende Empfehlungen.</div>}</div></section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#A43D00]">Schnell gefunden</p><h2 className="font-heading text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Beliebte Themengebiete</h2><p className="mt-3 max-w-md text-sm leading-6 text-[#594138]">Starte mit einem Thema und verfeinere die Suche anschliessend mit allen verfügbaren Filtern.</p></div><div className="flex flex-wrap gap-3">{quickTopics.map((topic) => <a key={`${topic.segment}-${topic.slug}`} href={`/ratgeber/${topic.segment}/${topic.slug}`} className="inline-flex items-center gap-2 rounded-full border border-[#EBE4DE] bg-white px-4 py-2.5 text-sm font-semibold text-[#594138] transition hover:border-[#78B3CE] hover:bg-[#C8E6F0] hover:text-[#25657E]"><BookOpen className="h-4 w-4 text-[#FA6E28]" />{topic.label?.[lang] || topic.label?.de || topic.slug}</a>)}</div></div></section>

      <section className="border-y border-[#EBE4DE] bg-white px-4 py-16 sm:px-6 sm:py-20"><div className="mx-auto max-w-7xl"><div className="mx-auto max-w-2xl text-center"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#25657E]">Orientierung</p><h2 className="font-heading text-3xl font-bold tracking-[-0.03em] sm:text-4xl">So funktioniert KursNavi</h2><p className="mt-3 text-sm leading-6 text-[#594138]">Vom ersten Suchbegriff bis zum passenden Angebot.</p></div><div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">{[{ number: '01', Icon: Search, title: 'Suchen & Filtern', text: 'Nutze Thema, Ort, Format und die weiteren Filter, um Angebote einzugrenzen.' }, { number: '02', Icon: CheckCircle2, title: 'Vergleichen', text: 'Betrachte Kursinhalte, Daten, Anbieter und Preise übersichtlich auf einen Blick.' }, { number: '03', Icon: ArrowRight, title: 'Direkt weiter', text: 'Gelange zum Anbieter, um dich anzumelden oder eine unverbindliche Anfrage zu senden.' }].map(({ number, Icon, title, text }) => <div key={number} className="rounded-xl border border-[#EBE4DE] bg-[#FAF5F0] p-6"><span className="text-sm font-bold text-[#FA6E28]">{number}</span><div className="mt-5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8E6F0] text-[#25657E]"><Icon className="h-5 w-5" /></div><h3 className="mt-5 font-heading text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#594138]">{text}</p></div>)}</div></div></section>

      <section className="px-4 py-16 sm:px-6 sm:py-20"><div className="mx-auto grid max-w-7xl overflow-hidden rounded-2xl bg-[#333333] lg:grid-cols-[1.1fr_0.9fr]"><div className="p-8 text-white sm:p-12"><p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#FFB597]">Für Anbieter</p><h2 className="max-w-xl font-heading text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Präsentiere dein Kursangebot auf KursNavi.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-white/75">Erreiche Menschen, die nach Bildungs- und Freizeitangeboten suchen – strukturiert, transparent und passend zu deiner Zielgruppe.</p><button type="button" onClick={navigateToTeacherHub} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#FA6E28] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#FF8B50]">Mehr erfahren <ArrowRight className="h-4 w-4" /></button></div><div className="relative min-h-64 lg:min-h-full"><img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1000&auto=format&fit=crop" alt="Menschen in einem Kurs" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-[#25657E]/25" /></div></div></section>
    </div>
  );
};
