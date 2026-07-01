import { describe, expect, it } from 'vitest';
import { validateImportJson } from '../scripts/import-pipeline/validate-import-json.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function validateTemp(data) {
  const filePath = path.join(os.tmpdir(), `kursnavi-import-${crypto.randomUUID()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  try {
    return validateImportJson(filePath).errors;
  } finally {
    fs.rmSync(filePath, { force: true });
  }
}

function validCoursesFixture() {
  return JSON.parse(fs.readFileSync('examples/import/courses.example.json', 'utf8'));
}

describe('provider import JSON schemas', () => {
  it('accepts all valid example files', () => {
    for (const filePath of [
      'examples/import/provider.example.json',
      'examples/import/courses.example.json',
      'examples/import/import-run.example.json',
    ]) {
      expect(validateImportJson(filePath).errors).toEqual([]);
    }
  });

  it('rejects missing required fields', () => {
    const fixture = validCoursesFixture();
    delete fixture.courses[0].title;

    expect(validateTemp(fixture)).toEqual(expect.arrayContaining([
      expect.stringContaining('$.courses[0].title: Pflichtfeld fehlt'),
    ]));
  });

  it('rejects published course drafts', () => {
    const fixture = validCoursesFixture();
    fixture.courses[0].status = 'published';

    expect(validateTemp(fixture)).toEqual(expect.arrayContaining([
      expect.stringContaining('$.courses[0].status: muss exakt "draft" sein'),
    ]));
  });

  it('rejects booking types other than lead', () => {
    const fixture = validCoursesFixture();
    fixture.courses[0].booking_type = 'direct';

    expect(validateTemp(fixture)).toEqual(expect.arrayContaining([
      expect.stringContaining('$.courses[0].booking_type: muss exakt "lead" sein'),
    ]));
  });

  it('rejects prices without source_url and evidence_text', () => {
    const fixture = validCoursesFixture();
    fixture.courses[0].price = { value: 120, currency: 'CHF', needs_review: true };

    const errors = validateTemp(fixture);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('$.courses[0].price: entspricht keiner erlaubten Schema-Alternative'),
    ]));
    expect(errors.join('\n')).toContain('source_url: Pflichtfeld fehlt');
    expect(errors.join('\n')).toContain('evidence_text: Pflichtfeld fehlt');
  });

  it('rejects dates without evidence', () => {
    const fixture = validCoursesFixture();
    fixture.courses[0].dates = [{ value: '2026-09-01T18:00:00.000Z', needs_review: true }];

    expect(validateTemp(fixture).join('\n')).toContain('source_url: Pflichtfeld fehlt');
    expect(validateTemp(fixture).join('\n')).toContain('evidence_text: Pflichtfeld fehlt');
  });
});
