/**
 * Zentrale AGB- und Datenschutz-Versionierung
 *
 * Diese Datei ist die EINZIGE Stelle, an der AGB- und Datenschutzversionen
 * gepflegt werden. Bitte nur hier ändern, wenn eine neue Version in Kraft tritt.
 *
 * Format: "JJJJ-MM-TT" (ISO-Datum des Inkrafttretens)
 */
export const TERMS_VERSION = "2026-11-27";
export const PRIVACY_VERSION = "2026-11-27";

/**
 * Erwachsenenregel (AGB Ziff. 3.5 a): Eigene Konten nur ab 18 Jahren.
 * Selbstauskunft bei der Registrierung bzw. bei bestehenden Konten vor der
 * ersten KI-Nutzung; KEINE überprüfte Altersfeststellung. Eine neue Version
 * verlangt eine erneute Bestätigung (die KI-Suche prüft genau diese Version).
 */
export const ADULT_RULE_VERSION = "2026-11-27";
