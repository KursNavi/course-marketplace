import { describe, expect, it } from 'vitest';
import { mergeImpersonatedCourses } from '../src/lib/impersonationCourses';

describe('mergeImpersonatedCourses', () => {
  it('keeps public courses and adds provider drafts', () => {
    const publicCourse = { id: 1, status: 'published' };
    const draft = { id: 2, status: 'draft', user_id: 'provider-1' };

    expect(mergeImpersonatedCourses([publicCourse], [draft])).toEqual([
      publicCourse,
      draft,
    ]);
  });

  it('replaces stale entries for the represented provider after a refresh', () => {
    const publicCourse = { id: 1, status: 'published' };
    const staleDraft = { id: 2, status: 'draft', title: 'old' };
    const freshDraft = { id: 2, status: 'draft', title: 'fresh' };

    expect(mergeImpersonatedCourses([publicCourse, staleDraft], [freshDraft])).toEqual([
      publicCourse,
      freshDraft,
    ]);
  });

  it('handles missing lists without losing the protected result', () => {
    const draft = { id: 2, status: 'draft' };

    expect(mergeImpersonatedCourses(null, [draft])).toEqual([draft]);
    expect(mergeImpersonatedCourses([{ id: 1 }], null)).toEqual([{ id: 1 }]);
  });
});
