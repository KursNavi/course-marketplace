/**
 * Legt ein BESTÄTIGTES Testkonto (Rolle Lernende) für die Prüfung der
 * KI-Suche-Preview an — AUSSCHLIESSLICH in der TESTumgebung KursNavi
 * (omoapbvfligjfznzivyu). Kein E-Mail-Versand nötig.
 *
 * E-Mail und Passwort kommen nur aus Geheimnissen (PREVIEW_TEST_EMAIL,
 * PREVIEW_TEST_PASSWORD), die die Nutzerin selbst in GitHub hinterlegt.
 * Sie werden weder ausgegeben noch protokolliert.
 *
 * Schutz: strikter Zielschutz (nur Testprojekt); ein bestehendes Konto wird
 * nur angepasst, wenn es ein Lernenden-Konto ist — Anbieter-/Admin-Konten
 * (z. B. die der automatischen Tests) werden nie verändert.
 */

import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { checkTestTarget } from './ai-search-db-tests.mjs';

export function validateAccountInput(email, password) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'PREVIEW_TEST_EMAIL fehlt oder ist ungültig.';
  if (typeof password !== 'string' || password.length < 12) return 'PREVIEW_TEST_PASSWORD fehlt oder ist kürzer als 12 Zeichen.';
  return null;
}

async function findUserByEmail(service, email) {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Konten lesen: ${error.message}`);
    const hit = (data?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === wanted);
    if (hit) return hit;
    if ((data?.users ?? []).length < 200) return null;
  }
  return null;
}

async function main() {
  const guard = checkTestTarget(process.env);
  if (!guard.ok) { console.error(`Abbruch: ${guard.reason}`); process.exit(2); }
  const email = process.env.PREVIEW_TEST_EMAIL;
  const password = process.env.PREVIEW_TEST_PASSWORD;
  const inputError = validateAccountInput(email, password);
  if (inputError) { console.error(`Abbruch: ${inputError}`); process.exit(2); }

  const service = createClient(process.env.SUPABASE_URL_TEST, process.env.SUPABASE_SECRET_KEY_TEST, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const existing = await findUserByEmail(service, email);
  let userId;
  if (existing) {
    const role = existing.user_metadata?.role ?? 'student';
    if (role !== 'student') {
      console.error('Abbruch: Zu dieser Adresse existiert ein Anbieter-/Admin-Konto. Es wird nicht verändert.');
      process.exit(2);
    }
    const { error } = await service.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) throw new Error(`Konto aktualisieren: ${error.message}`);
    userId = existing.id;
    console.log('Bestehendes Lernenden-Testkonto bestätigt und Passwort gesetzt.');
  } else {
    const { data, error } = await service.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: 'Preview-Test' },
    });
    if (error) throw new Error(`Konto anlegen: ${error.message}`);
    userId = data.user.id;
    console.log('Neues bestätigtes Lernenden-Testkonto angelegt.');
  }

  // Profilzeile wie bei einer normalen Registrierung; bestehende bleibt unverändert.
  const { error: profileError } = await service.from('profiles').upsert(
    [{ id: userId, full_name: 'Preview-Test', email: email.trim(), role: 'student' }],
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (profileError) throw new Error(`Profil: ${profileError.message}`);
  console.log('Fertig. Anmeldung auf der Preview mit der hinterlegten E-Mail-Adresse und dem hinterlegten Passwort.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error('Unerwarteter Fehler:', error?.message ?? error); process.exit(1); });
}
