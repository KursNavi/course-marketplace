import { describe, expect, it } from 'vitest';
import { buildSyntheticCategories, getCourseCategoryText, getNormalizedDeliveryTypes, getPrimaryCategorySlug, normalizeCategoryType } from '../src/lib/courseMetadata';
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

  it('normalizes legacy segment slugs and synthesizes a primary category', () => {
    const course = {
      category_type: 'privat_hobby',
      category_area: 'sprachen_privat',
      category_specialty: 'Reisevorbereitung'
    };

    expect(normalizeCategoryType(course.category_type)).toBe('privat');
    expect(buildSyntheticCategories(course)).toEqual([
      expect.objectContaining({
        category_type: 'privat',
        category_area: 'sprachen_privat',
        category_specialty_label: 'Reisevorbereitung',
        is_primary: true,
        is_synthetic: true
      })
    ]);
  });

  it('overrides a misleading in-person delivery flag for online-only legacy courses', () => {
    const course = {
      delivery_types: ['presence'],
      canton: 'Online',
      address: 'Online per Zoom'
    };

    expect(getNormalizedDeliveryTypes(course)).toEqual(['online_live']);
  });

  it('ignores stale legacy delivery_type column when delivery_types array is present', () => {
    // Bug: DB has both delivery_types=['self_study'] (new, correct) and delivery_type='presence'
    // (old column with stale default). The function must not combine both.
    const course = {
      delivery_types: ['self_study'],
      delivery_type: 'presence',  // stale DB default — must be ignored
      address: 'Online'
    };

    expect(getNormalizedDeliveryTypes(course)).toEqual(['self_study']);
  });

  it('falls back to legacy delivery_type when delivery_types array is absent', () => {
    const course = {
      delivery_type: 'online_live'
    };

    expect(getNormalizedDeliveryTypes(course)).toEqual(['online_live']);
  });

  it('uses the most specific synthetic category for legacy detail paths and labels', () => {
    const course = {
      id: '363',
      title: 'Testkurs Auto',
      canton: 'Online',
      category_type: 'privat_hobby',
      category_area: 'sprachen_privat',
      category_specialty: 'Reisevorbereitung'
    };

    expect(getPrimaryCategorySlug(course)).toBe('Reisevorbereitung');
    expect(buildCoursePath(course)).toBe('/courses/reisevorbereitung/online/363-testkurs-auto');
  });
});
