/**
 * Eigenes, kurzlebiges Anbieterkonto für schreibende Profiltests (Nachtrag 14).
 *
 * Hintergrund: Der Profiltest speicherte bisher Änderungen am gemeinsamen
 * E2E-Anbieter, dem in der TESTumgebung rund 807 Kurse gehören. Jede echte
 * Profiländerung reiht dann 807 Indexaufträge ein. Dieses Konto besitzt genau
 * EINEN Entwurfskurs; Änderungen betreffen nur ihn.
 *
 * - Nur TESTumgebung: dieselbe strikte Zielprüfung wie die DB-Tests
 *   (checkTestTarget), sonst kein Anlegen.
 * - Kein Mailversand: Konto per Admin-API mit email_confirm: true.
 * - Bereinigung räumt ALLE eigenen Daten weg (Indexaufträge des eigenen
 *   Kurses, Kurs, Paket-Historie, Profil, Konto) und prüft danach, dass
 *   nichts übrig ist. Es werden nur Zeilen mit eigenen IDs gelöscht.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { checkTestTarget } from '../../../scripts/ai-search-db-tests.mjs';

export const ISOLATED_PREFIX = 'ZZ E2E Profiltest';

/** @returns {boolean} ob die nötigen Variablen für die TESTumgebung gesetzt sind */
export function isolatedProviderAvailable(env = process.env) {
  return Boolean(env.SUPABASE_URL_TEST && env.SUPABASE_SECRET_KEY_TEST) && checkTestTarget(env).ok;
}

function serviceClient(env = process.env) {
  const guard = checkTestTarget(env);
  if (!guard.ok) throw new Error(`Eigenes Testprofil abgelehnt: ${guard.reason}`);
  return createClient(env.SUPABASE_URL_TEST, env.SUPABASE_SECRET_KEY_TEST, { auth: { persistSession: false, autoRefreshToken: false } });
}

function must(result, what) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

/**
 * Legt Konto, Anbieterprofil und einen Entwurfskurs an.
 * @returns {Promise<{userId: string, email: string, password: string, courseId: number,
 *   fullName: string, service: object, cleanup: () => Promise<void>}>}
 */
export async function createIsolatedProvider(env = process.env) {
  const service = serviceClient(env);
  const tag = randomBytes(5).toString('hex');
  const email = `e2e-profiltest-${tag}@example.com`;
  const password = `Pt-${randomBytes(12).toString('base64url')}9!`;
  const fullName = `${ISOLATED_PREFIX} ${tag}`;
  const created = { userId: null, courseId: null };

  const cleanup = async () => {
    const problems = [];
    const step = async (what, fn) => {
      try { const r = await fn(); if (r?.error) problems.push(`${what}: ${r.error.message}`); } catch (e) { problems.push(`${what}: ${e.message}`); }
    };
    if (created.courseId) {
      await step('Kurs löschen', () => service.from('courses').delete().eq('id', created.courseId));
      // Danach: auch der durch das Löschen eingereihte Auftrag gehört zum eigenen Kurs.
      await step('Indexaufträge löschen', () => service.from('ai_search_jobs').delete().eq('course_id', created.courseId));
      await step('Indexstand löschen', () => service.from('ai_search_index_state').delete().eq('course_id', created.courseId));
    }
    if (created.userId) {
      await step('Paket-Historie löschen', () => service.from('provider_package_history').delete().eq('provider_id', created.userId));
      await step('Profil löschen', () => service.from('profiles').delete().eq('id', created.userId));
      await step('Konto löschen', () => service.auth.admin.deleteUser(created.userId));
    }
    // Nachweis: keine Rückstände mit eigenen IDs.
    const left = [];
    const count = async (table, column, value) => {
      if (!value) return;
      const { count: n, error } = await service.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
      if (error) left.push(`${table}: Prüfung fehlgeschlagen (${error.message})`);
      else if (n > 0) left.push(`${table}: ${n}`);
    };
    await count('courses', 'id', created.courseId);
    await count('ai_search_jobs', 'course_id', created.courseId);
    await count('profiles', 'id', created.userId);
    await count('provider_package_history', 'provider_id', created.userId);
    if (problems.length || left.length) {
      throw new Error(`Bereinigung des eigenen Testprofils unvollständig: ${[...problems, ...left].join('; ')}`);
    }
  };

  try {
    const user = must(await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // kein Bestätigungs-Mail
      user_metadata: { role: 'teacher', full_name: fullName },
    }), 'Konto anlegen').user;
    created.userId = user.id;

    must(await service.from('profiles').insert({
      id: user.id,
      email,
      full_name: fullName,
      role: 'teacher',
      package_tier: 'basic',
      preferred_language: 'de',
      city: 'Bern',
      canton: 'Bern',
      bio_text: `${ISOLATED_PREFIX}: Ausgangstext`,
    }), 'Profil anlegen');

    const course = must(await service.from('courses').insert({
      title: `${fullName} Kurs`,
      description: 'Eigener Entwurfskurs für den isolierten Profiltest.',
      status: 'draft',
      user_id: user.id,
      instructor_name: fullName,
    }).select('id').single(), 'Kurs anlegen');
    created.courseId = course.id;
  } catch (error) {
    await cleanup().catch(() => {});
    throw error;
  }

  return { userId: created.userId, email, password, courseId: created.courseId, fullName, service, cleanup };
}
