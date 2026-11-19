/**
 * Texte zum Indexstand über den KI-Suchergebnissen.
 *
 * Nachtrag 13 (19.11.2026): Abdeckung (jeder veröffentlichte Kurs hat einen
 * Indexeintrag) ist keine Aktualitätsbestätigung. Offene Aufträge sind
 * Jobzeilen, nicht Kurse – mehrere Aufträge können denselben Kurs betreffen,
 * darunter auch Entwürfe oder gelöschte Kurse.
 */

const fmt = (n) => Number(n).toLocaleString('de-CH');

/** Nachweislich unvollständiger Index = sichtbare Warnung über den Ergebnissen. */
export function coverageWarning(coverage) {
  if (!coverage || coverage.complete) return null;
  return `Suchindex unvollständig: ${coverage.missingCount ?? '?'} von ${fmt(coverage.publishedCount)} veröffentlichten Kursen fehlen im Index. Passende Kurse können hier fehlen.`;
}

/** Vollständige Abdeckung (ggf. mit offenen Aufträgen) = ruhige Fussnote. */
export function coverageFootnote(coverage) {
  if (!coverage || !coverage.complete) return null;
  const base = `Indexabgleich vor dieser Suche: Alle ${fmt(coverage.publishedCount)} veröffentlichten Kurse haben einen Eintrag im Suchindex.`;
  const pending = Number(coverage.pendingUpdates) || 0;
  if (pending > 0) {
    const jobs = pending === 1
      ? '1 offener Aktualisierungsauftrag ist'
      : `${fmt(pending)} offene Aktualisierungsaufträge (mehrere können denselben Kurs betreffen) sind`;
    return `${base} Das bestätigt nicht, dass jeder Eintrag aktuell ist: ${jobs} noch nicht verarbeitet; einzelne Angaben können veraltet sein.`;
  }
  return `${base} Keine offenen Aktualisierungsaufträge.`;
}
