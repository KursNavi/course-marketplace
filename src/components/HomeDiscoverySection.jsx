import React from 'react';
import {
  GraduationCap, BookOpen, Compass, Sparkles, PlayCircle,
  CalendarDays, School, Sun, Smile, ArrowRight, Briefcase, Palette,
} from 'lucide-react';
import { getBereicheForSegment, getBereichUrl } from '../lib/bereichLandingConfig';

const navigateTo = (url) => {
  window.history.pushState({}, '', url);
  window.scrollTo({ top: 0 });
};

const SEGMENTS = [
  {
    key: 'beruflich',
    label: 'Beruflich',
    SegmentIcon: Briefcase,
    c: {
      blockBg: 'bg-blue-50',
      blockBorder: 'border-blue-200',
      chip: 'bg-blue-600 text-white',
      cardBorder: 'border-blue-100 hover:border-blue-300',
      iconBg: 'bg-blue-100 group-hover/card:bg-blue-200',
      iconColor: 'text-blue-600',
      headingColor: 'text-blue-800',
      hoverText: 'group-hover/card:text-blue-700',
      subText: 'text-blue-600',
      themenBorder: 'border-blue-200 hover:border-blue-400',
      themenGradient: 'from-blue-600 to-blue-800',
    },
    kursarten: [
      {
        label: 'Diplome & Lehrgänge',
        Icon: GraduationCap,
        text: 'Längere Weiterbildungen mit Abschluss oder Zertifikat.',
        url: '/search?type=beruflich&q=Diplom',
      },
      {
        label: 'Fachkurse & Skill-Updates',
        Icon: BookOpen,
        text: 'Gezielte Kurse für neue Fähigkeiten im Job.',
        url: '/search?type=beruflich&q=Fachkurs',
      },
      {
        label: 'Quereinstieg & Neuorientierung',
        Icon: Compass,
        text: 'Neue berufliche Wege entdecken und vorbereiten.',
        url: '/search?type=beruflich&q=Quereinstieg',
      },
    ],
    fallbackThemen: [
      {
        label: 'IT & Digital',
        text: 'Digitale Kompetenzen aufbauen und weiterentwickeln.',
        url: '/search?type=beruflich&q=Digital',
      },
      {
        label: 'Führung & Management',
        text: 'Führungskompetenzen und Managementfähigkeiten stärken.',
        url: '/search?type=beruflich&q=Führung',
      },
      {
        label: 'Kommunikation & Sprachen',
        text: 'Sprachen lernen und Kommunikation im Beruf verbessern.',
        url: '/search?type=beruflich&q=Kommunikation',
      },
    ],
  },
  {
    key: 'privat_hobby',
    label: 'Privat & Hobby',
    SegmentIcon: Palette,
    c: {
      blockBg: 'bg-orange-50',
      blockBorder: 'border-orange-200',
      chip: 'bg-orange-500 text-white',
      cardBorder: 'border-orange-100 hover:border-orange-300',
      iconBg: 'bg-orange-100 group-hover/card:bg-orange-200',
      iconColor: 'text-orange-600',
      headingColor: 'text-orange-800',
      hoverText: 'group-hover/card:text-orange-700',
      subText: 'text-orange-600',
      themenBorder: 'border-orange-200 hover:border-orange-400',
      themenGradient: 'from-orange-500 to-orange-700',
    },
    kursarten: [
      {
        label: 'Workshops',
        Icon: Sparkles,
        text: 'Kompakte Erlebnisse zum Ausprobieren und Vertiefen.',
        url: '/search?type=privat_hobby&q=Workshop',
      },
      {
        label: 'Kurse für Einsteiger',
        Icon: PlayCircle,
        text: 'Neue Hobbys ohne Vorkenntnisse starten.',
        url: '/search?type=privat_hobby&q=Einsteiger',
      },
      {
        label: 'Regelmässige Kurse',
        Icon: CalendarDays,
        text: 'Lernen mit Rhythmus, Gruppe und Begleitung.',
        url: '/search?type=privat_hobby&q=regelmässig',
      },
    ],
    fallbackThemen: [
      {
        label: 'Musik',
        text: 'Musik entdecken, spielen und geniessen.',
        url: '/search?type=privat_hobby&q=Musik',
      },
      {
        label: 'Kochen & Genuss',
        text: 'Kulinarisches Wissen und Kochfreude entfalten.',
        url: '/search?type=privat_hobby&q=Kochen',
      },
      {
        label: 'Kunst & Kreativität',
        text: 'Kreative Techniken entdecken und ausdrücken.',
        url: '/search?type=privat_hobby&q=Kreativität',
      },
    ],
  },
  {
    key: 'kinder_jugend',
    label: 'Kinder & Jugend',
    SegmentIcon: Smile,
    c: {
      blockBg: 'bg-emerald-50',
      blockBorder: 'border-emerald-200',
      chip: 'bg-emerald-600 text-white',
      cardBorder: 'border-emerald-100 hover:border-emerald-300',
      iconBg: 'bg-emerald-100 group-hover/card:bg-emerald-200',
      iconColor: 'text-emerald-600',
      headingColor: 'text-emerald-800',
      hoverText: 'group-hover/card:text-emerald-700',
      subText: 'text-emerald-600',
      themenBorder: 'border-emerald-200 hover:border-emerald-400',
      themenGradient: 'from-emerald-600 to-emerald-800',
    },
    kursarten: [
      {
        label: 'Nachhilfe & Prüfungsvorbereitung',
        Icon: School,
        text: 'Unterstützung für Schule, Prüfungen und Lernziele.',
        url: '/search?type=kinder_jugend&q=Nachhilfe',
      },
      {
        label: 'Ferienkurse & Camps',
        Icon: Sun,
        text: 'Sinnvolle Aktivitäten für schulfreie Zeiten.',
        url: '/search?type=kinder_jugend&q=Ferienkurs',
      },
      {
        label: 'Freizeitkurse',
        Icon: Smile,
        text: 'Kreative, sportliche und soziale Kurse für Kinder.',
        url: '/search?type=kinder_jugend&q=Freizeit',
      },
    ],
    fallbackThemen: [
      {
        label: 'Musik für Kinder',
        text: 'Musikerziehung und Instrumentalkurse für Kinder.',
        url: '/search?type=kinder_jugend&q=Musik',
      },
      {
        label: 'Sport & Bewegung',
        text: 'Sportliche Aktivitäten und Bewegungskurse für Kinder.',
        url: '/search?type=kinder_jugend&q=Sport',
      },
      {
        label: 'MINT & Technik',
        text: 'Mathe, Informatik, Naturwissenschaften und Technik entdecken.',
        url: '/search?type=kinder_jugend&q=Technik',
      },
    ],
  },
];

export const HomeDiscoverySection = ({ lang = 'de' }) => {
  return (
    <section className="py-20 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-heading font-bold text-dark mb-3">
            Entdecke Kurse nach Ziel und Thema
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto font-sans">
            Wähle zuerst, was du erreichen möchtest – oder stöbere direkt in passenden Themenwelten.
          </p>
        </div>

        {/* Segment Blocks */}
        <div className="space-y-12">
          {SEGMENTS.map((segment) => {
            const bereiche = getBereicheForSegment(segment.key);
            const hasBereiche = bereiche.length > 0;
            const { SegmentIcon, c } = segment;

            return (
              <div
                key={segment.key}
                className={`rounded-2xl ${c.blockBg} border ${c.blockBorder} p-6 sm:p-8`}
              >
                {/* Segment Label */}
                <div className="mb-6">
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${c.chip}`}>
                    <SegmentIcon className="w-4 h-4" />
                    {segment.label}
                  </span>
                </div>

                {/* Kursarten */}
                <div className="mb-8">
                  <h3 className={`text-base font-bold ${c.headingColor} mb-4 uppercase tracking-wide text-sm`}>
                    Kursarten
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {segment.kursarten.map((k) => {
                      const KIcon = k.Icon;
                      return (
                        <a
                          key={k.label}
                          href={k.url}
                          onClick={(e) => { e.preventDefault(); navigateTo(k.url); }}
                          className={`group/card flex items-start gap-3 p-4 bg-white rounded-xl border ${c.cardBorder} hover:-translate-y-1 hover:shadow-lg transition-all duration-200`}
                        >
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center transition-colors`}>
                            <KIcon className={`w-5 h-5 ${c.iconColor}`} />
                          </div>
                          <div>
                            <p className={`font-semibold text-gray-800 text-sm leading-tight mb-1 ${c.hoverText} transition-colors`}>
                              {k.label}
                            </p>
                            <p className="text-xs text-gray-500 leading-relaxed">{k.text}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>

                {/* Themenwelten */}
                <div>
                  <h3 className={`text-base font-bold ${c.headingColor} mb-4 uppercase tracking-wide text-sm`}>
                    Themenwelten
                  </h3>

                  {hasBereiche ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {bereiche.map((bereich) => (
                        <a
                          key={bereich.slug}
                          href={getBereichUrl(bereich)}
                          onClick={(e) => { e.preventDefault(); navigateTo(getBereichUrl(bereich)); }}
                          className={`group/bereich flex flex-col p-5 bg-white rounded-xl border-2 ${c.themenBorder} hover:-translate-y-1 hover:shadow-xl transition-all duration-200`}
                        >
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.themenGradient} flex items-center justify-center mb-3 flex-shrink-0`}>
                            <Compass className="w-5 h-5 text-white" />
                          </div>
                          <p className="font-bold text-gray-800 text-sm leading-tight mb-1">
                            {bereich.title[lang] || bereich.title.de}
                          </p>
                          <p className="text-xs text-gray-500 leading-relaxed flex-1 mb-4">
                            {bereich.subtitle[lang] || bereich.subtitle.de}
                          </p>
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${c.subText}`}>
                            Themenwelt ansehen
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {segment.fallbackThemen.map((thema) => (
                        <a
                          key={thema.label}
                          href={thema.url}
                          onClick={(e) => { e.preventDefault(); navigateTo(thema.url); }}
                          className={`group/card flex items-start gap-3 p-4 bg-white rounded-xl border ${c.cardBorder} hover:-translate-y-1 hover:shadow-lg transition-all duration-200`}
                        >
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center transition-colors`}>
                            <Compass className={`w-5 h-5 ${c.iconColor}`} />
                          </div>
                          <div>
                            <p className={`font-semibold text-gray-800 text-sm leading-tight mb-1 ${c.hoverText} transition-colors`}>
                              {thema.label}
                            </p>
                            <p className="text-xs text-gray-500 leading-relaxed">{thema.text}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
