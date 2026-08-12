import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const articleStyles = readFileSync(resolve('src/index.css'), 'utf8');

describe('prose-ratgeber inline formatting', () => {
  it('styles strong and b output as bold', () => {
    expect(articleStyles).toMatch(
      /\.prose-ratgeber strong,\s*\.prose-ratgeber b\s*\{\s*@apply text-gray-800 font-semibold;/,
    );
  });

  it('styles em and i output as italic', () => {
    expect(articleStyles).toMatch(
      /\.prose-ratgeber em,\s*\.prose-ratgeber i\s*\{\s*@apply italic;/,
    );
  });
});
