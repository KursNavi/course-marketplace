import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(
  path.join(testDir, '..', 'supabase', 'migrations', '20260911120000_restore_course_status_and_preview_access.sql'),
  'utf8'
);
const appSource = fs.readFileSync(path.join(testDir, '..', 'src', 'App.jsx'), 'utf8');

describe('Kurs-Draft-Vorschau und Statuswechsel', () => {
  it('macht Kursdetaildaten per URL für beide öffentlichen Rollen lesbar', () => {
    expect(migration).toContain('"Courses: public read all for URL previews"');
    expect(migration).toContain('"Course events: public read all for URL previews"');
    expect(migration).toContain('"Course categories: public read all for URL previews"');
    expect(migration).toContain('"Course locations: public read all for URL previews"');
    expect(migration.match(/TO anon, authenticated/g)).toHaveLength(4);
    expect(migration).not.toContain("status = 'published'");
  });

  it('stellt die Anbieter-Schreibrechte mit Besitzprüfung wieder her', () => {
    expect(migration).toContain('CREATE POLICY "Courses: update own"');
    expect(migration).toContain('USING ((select auth.uid()) = user_id)');
    expect(migration).toContain('WITH CHECK ((select auth.uid()) = user_id)');
    expect(migration).toContain('CREATE POLICY "Course events: owner update"');
  });

  it('prüft beim Statuswechsel das tatsächlich gespeicherte Ergebnis', () => {
    expect(appSource).toContain(".select('id, status')");
    expect(appSource).toContain("result.data?.status !== newStatus");
  });

  it('hält Entwürfe aus der öffentlichen Suche heraus', () => {
    expect(appSource).toContain("const isPublished = course.status === 'published' || !course.status;");
    expect(appSource).toContain('if (!isPublished && !isOwner) return false;');
  });
});

