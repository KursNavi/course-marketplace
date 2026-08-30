import { describe, expect, it } from 'vitest';
import { hasCompleteCourseCategory } from '../src/lib/courseStatus.js';

describe('hasCompleteCourseCategory', () => {
  it('recognises numeric primary category IDs', () => {
    expect(hasCompleteCourseCategory({ category_level3_id: 42 })).toBe(true);
    expect(hasCompleteCourseCategory({ category_specialty_id: 42 })).toBe(true);
  });

  it('recognises a real assignment exposed through category paths', () => {
    expect(hasCompleteCourseCategory({
      has_stored_category: undefined,
      category_paths: [{ area: 7, specialty: 'Keramik' }]
    })).toBe(true);
  });

  it('does not treat arbitrary legacy text as a publishable category', () => {
    expect(hasCompleteCourseCategory({
      has_stored_category: false,
      category_area: 'frei erfunden',
      category_specialty: 'ebenfalls frei erfunden'
    })).toBe(false);
  });
});
