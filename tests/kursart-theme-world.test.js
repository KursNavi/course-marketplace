import { describe, expect, it, vi } from 'vitest';
import { normalizePredefinedSearches } from '../src/lib/themeWorldFormUtils.js';
import { matchesCourseTypeFilter } from '../src/components/BereichLandingPage.jsx';

vi.mock('../src/lib/supabase.js', () => ({ supabase: {} }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));

describe('Kursart-Filter in Themenwelten', () => {
  it('behält kursart bei vordefinierten Suchen beim Speichern', () => {
    expect(normalizePredefinedSearches([
      { label_de: ' Feriencamps ', kursart: ' feriencamp ', spec: '' },
    ])).toEqual([{ label_de: 'Feriencamps', kursart: 'feriencamp' }]);
  });

  it('verwendet das Kursart-Feld des passenden Segments für die Landing-Zählung', () => {
    expect(matchesCourseTypeFilter({ kinder_kursart: 'feriencamp' }, 'kinder_jugend', 'feriencamp')).toBe(true);
    expect(matchesCourseTypeFilter({ privat_kursart: 'feriencamp' }, 'privat_hobby', 'feriencamp')).toBe(true);
    expect(matchesCourseTypeFilter({ kinder_kursart: 'feriencamp' }, 'privat_hobby', 'feriencamp')).toBe(false);
  });
});
