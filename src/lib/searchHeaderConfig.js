/**
 * Dynamische SEO-Header für die Suchseite.
 *
 * Liefert H1 + Subline je nach aktiven Filtern (Thema + Ort + Format).
 * Wird nur für explizit konfigurierte Kombinationen aktiv –
 * alle anderen Fälle fallen auf die bestehenden SEGMENT_CONFIG-Defaults zurück.
 *
 * Priorität: area + loc/delivery  >  area only  >  null (→ Default)
 */

/** Display-Namen für Kantone, die in der URL anders heissen */
const LOCATION_DISPLAY = {
  'Basel-Stadt': 'Basel',
  'Basel-Landschaft': 'Basel-Landschaft',
};

const displayLoc = (loc) => LOCATION_DISPLAY[loc] || loc;

/**
 * Template-basierte Header-Konfiguration pro Bereich (area).
 * Jeder Eintrag definiert Grundtexte + optionale Overrides pro Stadt.
 */
const AREA_HEADERS = {
  sport_fitness_beruf: {
    titleBase: 'Sport- und Fitness-Kurse und Ausbildungen',
    subtitleDefault: (loc) =>
      `Entdecke berufliche Weiterbildungen und Fachkurse im Bereich Sport und Fitness in ${loc}.`,
    subtitleOverrides: {
      'Basel-Stadt':
        'Finde berufliche Angebote im Bereich Sport und Fitness in Basel – von Weiterbildungen bis zu spezialisierten Fachkursen.',
      'Bern':
        'Finde Ausbildungen und Fachkurse im Bereich Sport und Fitness in Bern – praxisnah und berufsbegleitend.',
      'St. Gallen':
        'Entdecke Sport- und Fitness-Ausbildungen in St. Gallen – von Basisausbildungen bis zu Spezialisierungen.',
    },
    allTitle: 'Sport- und Fitness-Kurse und Ausbildungen in der Schweiz',
    allSubtitle:
      'Entdecke berufliche Weiterbildungen und Fachkurse im Bereich Sport und Fitness in der ganzen Schweiz.',
    onlineLiveTitle:
      'Online-live Sport- und Fitness-Kurse und Ausbildungen in der Schweiz',
    onlineLiveSubtitle:
      'Finde live begleitete Online-Angebote im Bereich Sport und Fitness – flexibel und schweizweit.',
  },

  yoga_achtsamkeit: {
    titleBase: 'Yoga- und Achtsamkeitskurse',
    subtitleDefault: (loc) =>
      `Entdecke Yoga-, Meditations- und Achtsamkeitsangebote in ${loc}.`,
    subtitleOverrides: {
      'Zürich':
        'Entdecke Yoga-, Meditations- und Achtsamkeitsangebote in Zürich – vor Ort oder als ergänzende online-live Alternative.',
      'Bern':
        'Finde Yoga-, Meditations- und Achtsamkeitskurse in Bern und entdecke passende live begleitete Angebote.',
      'Basel-Stadt':
        'Entdecke Yoga- und Achtsamkeitskurse in Basel – von Hatha bis Meditation, vor Ort oder online-live.',
      'Luzern':
        'Finde Yoga- und Achtsamkeitskurse in Luzern – für Einsteiger und Fortgeschrittene.',
    },
    allTitle: 'Yoga- und Achtsamkeitskurse in der Schweiz',
    allSubtitle:
      'Entdecke Kurse für Yoga, Meditation und Achtsamkeit in der ganzen Schweiz.',
    onlineLiveTitle:
      'Online-live Yoga- und Achtsamkeitskurse in der Schweiz',
    onlineLiveSubtitle:
      'Finde live begleitete Online-Angebote für Yoga, Meditation und Achtsamkeit – flexibel und ortsunabhängig.',
  },
};

/**
 * Gibt dynamischen Header zurück, oder null wenn kein Spezialfall vorliegt.
 *
 * @param {Object} params
 * @param {string}   params.area             – z.B. 'sport_fitness_beruf'
 * @param {string[]} params.locations         – z.B. ['Zürich']
 * @param {string[]} params.deliveryTypes     – z.B. ['online_live']
 * @returns {{ title: string, subtitle: string } | null}
 */
export function getSearchHeader({ area, locations, deliveryTypes }) {
  const cfg = AREA_HEADERS[area];
  if (!cfg) return null;

  const hasLoc = locations && locations.length === 1;
  const loc = hasLoc ? locations[0] : null;
  const isOnlineLive =
    deliveryTypes?.includes('online_live') && !hasLoc;

  // Online-live (ohne spezifischen Standort)
  if (isOnlineLive) {
    return {
      title: cfg.onlineLiveTitle,
      subtitle: cfg.onlineLiveSubtitle,
    };
  }

  // Spezifischer Standort
  if (hasLoc) {
    const display = displayLoc(loc);
    return {
      title: `${cfg.titleBase} in ${display}`,
      subtitle: cfg.subtitleOverrides[loc] || cfg.subtitleDefault(display),
    };
  }

  // Bereich ausgewählt, kein Standort → "in der Schweiz"
  return {
    title: cfg.allTitle,
    subtitle: cfg.allSubtitle,
  };
}
