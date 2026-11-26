/**
 * Lokaler Suchtext-Entwurf der KI-Suche (nur sessionStorage dieses Tabs).
 *
 * Nachtrag 13: Wechselt jemand von der Startseite zur KI-Suche, darf der dort
 * bereits eingegebene Text nicht verloren gehen. Er wird lokal übergeben –
 * nie über die URL, nie mit automatischer Suche, ohne Kontingentverbrauch.
 * Der Entwurf übersteht auch den Login-Rücksprung im selben Tab.
 */
import { readSession, writeSession } from '../safeStorage.js';

export const AI_SEARCH_DRAFT_KEY = 'kn_ai_search_draft';
const MAX_DRAFT_CHARS = 500; // gleiche Obergrenze wie das KI-Suchfeld

/**
 * Übernimmt einen Text von der Startseite als Entwurf. Ein leerer Text
 * überschreibt einen bestehenden Entwurf nicht.
 * @returns {boolean} true, wenn ein Text übergeben wurde
 */
export function handOverAiSearchDraft(text) {
  const clean = String(text ?? '').trim().slice(0, MAX_DRAFT_CHARS);
  if (!clean) return false;
  return writeSession(AI_SEARCH_DRAFT_KEY, clean);
}

export function readAiSearchDraft() {
  return readSession(AI_SEARCH_DRAFT_KEY) || '';
}
