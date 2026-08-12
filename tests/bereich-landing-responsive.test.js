/**
 * Structural regression guard for the 390px landing-page layout.
 *
 * JSDOM does not calculate Tailwind layout dimensions, so document scrollWidth
 * and actual viewport containment must be covered by a browser E2E run. This
 * focused guard keeps the responsive containment classes in place for the
 * dynamic content paths that caused the mobile overflow.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentSource = readFileSync(
  resolve(process.cwd(), 'src/components/BereichLandingPage.jsx'),
  'utf8',
);

describe('BereichLandingPage mobile responsive regression guard', () => {
  it('keeps dynamic breadcrumb and scenario content contained at 390px', () => {
    expect(componentSource).toContain('flex flex-wrap items-center gap-2 text-sm text-white/90 mb-8');
    expect(componentSource).toContain('min-w-0 break-words text-white/90');
    expect(componentSource).toContain('flex min-w-0 flex-wrap gap-2 mb-10');
    expect(componentSource).toContain('inline-flex min-w-0 max-w-full items-center');
    expect(componentSource).toContain('<span className="shrink-0">{scenario.icon}</span>');
    expect(componentSource).toContain('<span className="min-w-0 break-words">{scenario.label[lang] || scenario.label.de}</span>');
  });

  it('stacks the search controls below sm and preserves a horizontal sm layout', () => {
    expect(componentSource).toContain('flex flex-col gap-2 sm:relative sm:block');
    expect(componentSource).toContain('w-full min-w-0 pl-12 pr-4');
    expect(componentSource).toContain('sm:pr-32');
    expect(componentSource).toContain('w-full shrink-0 bg-primary');
    expect(componentSource).toContain('sm:absolute sm:right-2 sm:top-2 sm:w-auto');
  });

  it('allows long scenario-card titles and teasers to wrap instead of expanding the grid', () => {
    expect(componentSource).toContain('relative min-w-0 overflow-hidden p-6');
    expect(componentSource).toContain('min-w-0 break-words font-bold text-base');
    expect(componentSource).toContain('min-w-0 break-words text-sm text-gray-500');
  });
});
