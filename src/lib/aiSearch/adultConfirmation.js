/**
 * Bestätigung der Volljährigkeit (AGB Ziff. 3.5 a, Entscheid 27.11.2026).
 *
 * Selbstauskunft „Ich bin mindestens 18 Jahre alt“, KEINE überprüfte
 * Altersfeststellung (kein Geburtsdatum, kein Ausweis, kein Elternverfahren).
 *
 * Speicherung: Tabelle account_adult_confirmations (nur Serverrolle), je Konto
 * und Regelversion ein Eintrag mit Zeitpunkt der Datenbank und Quelle:
 *  - 'signup':    bei der Registrierung, atomar mit dem Konto (Trigger auf
 *                 auth.users, Metadaten adult_confirmed/adult_rule_version);
 *  - 'ai_search': bestehende Konten, einmal vor der ersten KI-Nutzung.
 * Frühere Registrierung oder alte AGB-Zustimmung zählen NICHT.
 */
import { ADULT_RULE_VERSION } from '../legalVersions.js';

export const ADULT_CONFIRMATION_TABLE = 'account_adult_confirmations';
export { ADULT_RULE_VERSION };

/**
 * @returns {Promise<{ok: true, confirmed: boolean, ruleVersion: string, confirmedAt: string|null, source: string|null}
 *                   | {ok: false, error: string}>}
 */
export async function readAdultConfirmation(service, userId, ruleVersion = ADULT_RULE_VERSION) {
  const { data, error } = await service.from(ADULT_CONFIRMATION_TABLE)
    .select('confirmed_at, source')
    .eq('user_id', userId)
    .eq('rule_version', ruleVersion)
    .limit(1);
  if (error) return { ok: false, error: String(error.message ?? error) };
  const row = Array.isArray(data) ? data[0] : null;
  return { ok: true, confirmed: Boolean(row), ruleVersion, confirmedAt: row?.confirmed_at ?? null, source: row?.source ?? null };
}

/** Nur eine ausdrückliche Bestätigung der aktuellen Regelversion wird angenommen. */
export function validateAdultConfirmRequest(body, ruleVersion = ADULT_RULE_VERSION) {
  if (body?.confirmed !== true) return 'adult_confirmation_missing';
  if (body?.ruleVersion !== ruleVersion) return 'adult_rule_outdated';
  return null;
}

/**
 * Speichert die Bestätigung (Zeitpunkt = Datenbank) und liest sie zur Kontrolle
 * zurück. Erfolg nur, wenn der Eintrag danach nachweislich vorhanden ist.
 */
export async function recordAdultConfirmation(service, userId, ruleVersion = ADULT_RULE_VERSION) {
  const { error } = await service.from(ADULT_CONFIRMATION_TABLE)
    .upsert({ user_id: userId, rule_version: ruleVersion, source: 'ai_search' }, { onConflict: 'user_id,rule_version', ignoreDuplicates: true });
  if (error) return { ok: false, error: String(error.message ?? error) };
  const check = await readAdultConfirmation(service, userId, ruleVersion);
  if (!check.ok) return { ok: false, error: check.error };
  if (!check.confirmed) return { ok: false, error: 'not_found_after_write' };
  return check;
}
