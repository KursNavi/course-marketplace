/**
 * Dynamische SEO-Header für die Suchseite.
 *
 * Liefert H1 + Subline je nach aktiven Filtern.
 * Gibt null zurück wenn keine Spezialregel greift → SEGMENT_CONFIG-Default.
 *
 * Priorität:
 *  1. area + specialty (+ focus) + loc/delivery
 *  2. area + specialty (+ focus)
 *  3. area + loc/delivery
 *  4. area only
 *  5. null (→ Default aus SEGMENT_CONFIG)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOCATION_DISPLAY = {
  'Basel-Stadt': 'Basel',
};

const displayLoc = (loc) => LOCATION_DISPLAY[loc] || loc;

/**
 * Ermittelt Standort-Kontext aus den aktiven Filtern.
 * @returns {{ display: string, type: 'specific'|'online'|'all' }}
 */
function resolveLocation(locations, deliveryTypes) {
  const hasLoc = locations && locations.length === 1;
  const isOnlineLive = deliveryTypes?.includes('online_live') && !hasLoc;

  if (hasLoc) return { display: displayLoc(locations[0]), type: 'specific' };
  if (isOnlineLive) return { display: 'der Schweiz', type: 'online' };
  return { display: 'der Schweiz', type: 'all' };
}

// ---------------------------------------------------------------------------
// Specialty-Titel-Fragmente (pro Area)
// ---------------------------------------------------------------------------
// Jeder Eintrag mappt ein DB-Specialty-Label auf:
//   title     – natürliches Plural-Fragment für H1  (z.B. "Fitness-Trainer-Ausbildungen")
//   context   – Kontext-Phrase für Subline           (z.B. "Fitness-Training")
//   focuses   – optionale Verfeinerung pro Focus-Label

const SPECIALTY_TITLES = {
  sport_fitness_beruf: {
    'Fitness-Trainer-Ausbildung': {
      title: 'Fitness-Trainer-Ausbildungen',
      context: 'Fitness-Training',
      focuses: {
        'Basis-Ausbildung': 'Fitness-Trainer-Basis-Ausbildungen',
      },
    },
    'Personal-Trainer-Ausbildung': {
      title: 'Personal-Trainer-Ausbildungen',
      context: 'Personal Training',
    },
    'Group-Fitness / Kursleitung': {
      title: 'Group-Fitness-Ausbildungen',
      context: 'Group Fitness und Kursleitung',
    },
    'Trainingsmethoden & Spezialisierungen': {
      title: 'Kurse für Trainingsmethoden und Spezialisierungen',
      context: 'Trainingsmethoden und Spezialisierungen',
    },
    'Mind-Body (Yoga & Pilates)': {
      title: 'Yoga- und Pilates-Ausbildungen',
      context: 'Yoga und Pilates',
    },
    'Ernährung & Coaching': {
      title: 'Ernährungs- und Coaching-Kurse',
      context: 'Ernährung und Coaching',
    },
    'Zertifikate & Prüfungsvorbereitung': {
      title: 'Zertifikatskurse und Prüfungsvorbereitungen',
      context: 'Zertifikate und Prüfungsvorbereitung',
    },
    'Business & Selbstständigkeit': {
      title: 'Business- und Selbstständigkeitskurse',
      context: 'Business und Selbstständigkeit',
    },
  },

  yoga_achtsamkeit: {
    'Yoga': {
      title: 'Yogakurse',
      context: 'Yoga',
      focuses: {
        'Hatha & Grundlagen': 'Hatha-Yoga-Kurse',
        'Vinyasa & Flow': 'Vinyasa-Yoga-Kurse',
        'Yin & Restorative': 'Yin-Yoga-Kurse',
      },
    },
    'Meditation & Achtsamkeit': {
      title: 'Meditations- und Achtsamkeitskurse',
      context: 'Meditation und Achtsamkeit',
      focuses: {
        'Yoga Nidra': 'Yoga-Nidra-Kurse',
        'Achtsamkeitstraining (MBSR/Alltag)': 'Achtsamkeitskurse (MBSR)',
      },
    },
    'Atemarbeit': {
      title: 'Atemarbeit- und Breathwork-Kurse',
      context: 'Atemarbeit und Breathwork',
    },
    'Klang & Mantra': {
      title: 'Klang- und Mantra-Kurse',
      context: 'Klangmeditation und Mantra',
    },
    'Somatics & Körperbewusstsein': {
      title: 'Kurse für Somatics und Körperbewusstsein',
      context: 'Somatics und Körperbewusstsein',
    },
    'Energiearbeit': {
      title: 'Energiearbeit- und Reiki-Kurse',
      context: 'Energiearbeit und Reiki',
      focuses: {
        'Reiki': 'Reiki-Kurse',
      },
    },
    'Bodywork & Massage': {
      title: 'Bodywork- und Massagekurse',
      context: 'Bodywork und Massage',
      focuses: {
        'Thai Yoga Massage': 'Thai-Yoga-Massage-Kurse',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Subline-Templates pro Area (für Specialty-Level)
// ---------------------------------------------------------------------------

const SPEC_SUBTITLE = {
  sport_fitness_beruf: {
    specific: (ctx, loc) => `Finde berufliche Weiterbildungen und Fachkurse für ${ctx} in ${loc}.`,
    all:      (ctx)      => `Entdecke berufliche Weiterbildungen und Fachkurse für ${ctx} in der ganzen Schweiz.`,
    online:   (ctx)      => `Finde live begleitete Online-Angebote für ${ctx} – flexibel und schweizweit.`,
  },
  yoga_achtsamkeit: {
    specific: (ctx, loc) => `Finde passende Kurse für ${ctx} in ${loc}.`,
    all:      (ctx)      => `Entdecke Kurse für ${ctx} in der ganzen Schweiz.`,
    online:   (ctx)      => `Finde live begleitete Online-Kurse für ${ctx} – flexibel und ortsunabhängig.`,
  },
};

// ---------------------------------------------------------------------------
// Area-Level-Header (wenn kein Specialty aktiv ist)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------

/**
 * Gibt dynamischen Header zurück oder null (→ Segment-Default).
 *
 * @param {Object} params
 * @param {string}   params.area           – z.B. 'sport_fitness_beruf'
 * @param {string[]} params.locations       – z.B. ['Zürich']
 * @param {string[]} params.deliveryTypes   – z.B. ['online_live']
 * @param {string}   params.specialty       – z.B. 'Fitness-Trainer-Ausbildung'
 * @param {string}   params.focus           – z.B. 'Basis-Ausbildung'
 * @returns {{ title: string, subtitle: string } | null}
 */
export function getSearchHeader({ area, locations, deliveryTypes, specialty, focus }) {
  // ---------------------------------------------------------------
  // 1) Specialty-Level: area + specialty (+ focus) ± loc/delivery
  // ---------------------------------------------------------------
  const specConfig = SPECIALTY_TITLES[area]?.[specialty];
  if (specConfig) {
    const loc = resolveLocation(locations, deliveryTypes);

    // Focus-spezifischer Titel (falls vorhanden), sonst Specialty-Titel
    const titleFragment = (focus && specConfig.focuses?.[focus]) || specConfig.title;

    // H1 zusammenbauen
    const title = loc.type === 'online'
      ? `Online-live ${titleFragment} in der Schweiz`
      : `${titleFragment} in ${loc.display}`;

    // Subline aus Template
    const templates = SPEC_SUBTITLE[area];
    const subtitle = templates
      ? templates[loc.type](specConfig.context, loc.display)
      : '';

    return { title, subtitle };
  }

  // ---------------------------------------------------------------
  // 2) Area-Level: area ± loc/delivery (kein Specialty)
  // ---------------------------------------------------------------
  const areaCfg = AREA_HEADERS[area];
  if (!areaCfg) return null;

  const hasLoc = locations && locations.length === 1;
  const loc = hasLoc ? locations[0] : null;
  const isOnlineLive = deliveryTypes?.includes('online_live') && !hasLoc;

  if (isOnlineLive) {
    return { title: areaCfg.onlineLiveTitle, subtitle: areaCfg.onlineLiveSubtitle };
  }

  if (hasLoc) {
    const display = displayLoc(loc);
    return {
      title: `${areaCfg.titleBase} in ${display}`,
      subtitle: areaCfg.subtitleOverrides[loc] || areaCfg.subtitleDefault(display),
    };
  }

  return { title: areaCfg.allTitle, subtitle: areaCfg.allSubtitle };
}
