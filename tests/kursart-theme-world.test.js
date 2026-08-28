import { describe, expect, it } from 'vitest';
import { normalizePredefinedSearches } from '../src/lib/themeWorldAdminUtils.js';
import { matchesCourseTypeFilter } from '../src/lib/themeWorldCourseFilters.js';
import { adaptToLegacyBereichConfig, adaptScenarioArticle } from '../src/lib/themeWorldAdapter.js';

describe('Kursart-Filter in Themenwelten', () => {
  it('behÃ¤lt kursart bei vordefinierten Suchen beim Speichern', () => {
    expect(normalizePredefinedSearches([
      { label_de: ' Feriencamps ', kursart: ' feriencamp ', spec: '' },
    ])).toEqual([{ label_de: 'Feriencamps', kursart: 'feriencamp' }]);
  });

  it('verwendet das Kursart-Feld des passenden Segments fÃ¼r die Landing-ZÃ¤hlung', () => {
    expect(matchesCourseTypeFilter({ kinder_kursart: 'feriencamp' }, 'kinder_jugend', 'feriencamp')).toBe(true);
    expect(matchesCourseTypeFilter({ privat_kursart: 'feriencamp' }, 'privat_hobby', 'feriencamp')).toBe(true);
    expect(matchesCourseTypeFilter({ kinder_kursart: 'feriencamp' }, 'privat_hobby', 'feriencamp')).toBe(false);
  });

  it('Ã¼bernimmt einen globalen Kursart-Filter in Landing- und Szenario-CTAs', () => {
    const themeWorld = {
      key: 'kinder-feriencamps', title_de: 'Kinder-Feriencamps', slug: 'kinder-feriencamps',
      url_segment: 'kinder-jugend', db_segment: 'kinder', area_slug: null,
      search_config: { kursart: 'feriencamp' },
      predefined_searches: [{ label_de: 'Alle Feriencamps' }],
    };
    const landing = adaptToLegacyBereichConfig({ themeWorld });
    expect(landing.areaSlug).toBeNull();
    expect(landing.kursart).toBe('feriencamp');
    expect(landing.predefinedSearches[0].params).toEqual({});

    const scenario = adaptScenarioArticle({
      id: '1', theme_world_id: 'tw', slug: 'auswahl', label_de: 'Auswahl', cta_config: {},
    }, themeWorld);
    expect(scenario.ctaConfig).toMatchObject({ areaSlug: null, kursart: 'feriencamp' });
  });
});
