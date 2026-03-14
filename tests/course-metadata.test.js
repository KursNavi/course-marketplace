import { describe, expect, it } from 'vitest';
import { getCourseCategoryText, getNormalizedDeliveryTypes, getPrimaryCategorySlug } from '../src/lib/courseMetadata';
import { buildCoursePath } from '../src/lib/siteConfig';

describe('course metadata helpers', () => {
  it('prefers the primary taxonomy category for course paths', () => {
    const course = {
      id: '42',
      title: 'Testkurs Auto',
      canton: 'Zürich',
      category_area: 'sprachen_privat',
      all_categories: [
        { category_area: 'sprachen_privat', is_primary: false },
        { category_area: 'reisevorbereitung', is_primary: true }
      ]
    };

    expect(getPrimaryCategorySlug(course)).toBe('reisevorbereitung');
    expect(buildCoursePath(course)).toBe('/courses/reisevorbereitung/zuerich/42-testkurs-auto');
  });

  it('derives online delivery from location hints when legacy delivery fields are missing', () => {
    const course = {
      canton: 'Online',
      address: 'Online per Zoom'
    };

    expect(getNormalizedDeliveryTypes(course)).toEqual(['online_live']);
  });

  it('returns the most specific available category label', () => {
    const course = {
      category_area: 'sprachen_privat',
      all_categories: [
        {
          category_area: 'sprachen_privat',
          category_area_label: 'Sprachen',
          category_specialty: 'reisevorbereitung',
          category_specialty_label: 'Reisevorbereitung',
          is_primary: true
        }
      ]
    };

    expect(getCourseCategoryText(course)).toBe('Reisevorbereitung');
  });
});
