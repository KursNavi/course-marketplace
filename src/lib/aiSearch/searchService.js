/**
 * Suchdienst der KI-Suche (S03, Preview-Stufe ohne Modellaufrufe).
 *
 * Ablauf je Suche (docs/ai-search/indexdesign.md, 02-ki-suche.md):
 *  1. Vorinterpretation (queryParse.js, regelbasiert; Luna folgt nach E3).
 *  2. Katalogweiter lexikalischer Abruf über den GESAMTEN Index: Chunks
 *     (ai_search_lexical, vollständige Beschreibungen) UND Dokumente
 *     (Titel), vereinigt per Reciprocal Rank Fusion. Der semantische Kanal
 *     (Embeddings) ist vorbereitet, aber bis zur Freigabe E3 aus.
 *  3. Frische Quelldaten der Kandidaten laden; Statusprüfung unmittelbar vor
 *     Ausgabe (nur 'published', Rücknahme-Vorrang).
 *  4. Deterministische Muss-Prüfung (mussCheck.js): bestätigt → Hauptliste,
 *     unbekannt → "Angaben unvollständig", belegt verletzt → ausgeschlossen.
 *  5. Fachliche Passung: bis Luna freigegeben ist eine nachvollziehbare
 *     TEXTPASSUNG (Anteil der Suchbegriffe mit Beleg im Kurstext). Das ist
 *     ausdrücklich eine Ersatzbewertung und wird so gekennzeichnet.
 *  6. Begrenzte bezahlte Priorität (paidRanking.js) nur innerhalb geeigneter
 *     Treffer; offengelegt in der Fussnote unter den Ergebnissen (Nachtrag 10:
 *     keine Einzelbadges).
 *
 * Paket-/Prio-Daten fliessen ausschliesslich in Schritt 6, nie in Gründe.
 * Keine Rohsuche in Logs.
 */

import { parseQuery, findTermInText, excerptAround, cantonForPlace } from './queryParse.js';
import { checkCourseMusts, MUST_RESULT, zurichDayString } from './mussCheck.js';
import { derivePriceStatus, PRICE_STATUS } from './priceStatus.js';
import { isPubliclySearchable } from './publication.js';
import { fuseHybrid } from './retrieval.js';
import { rankWithPaidPriority, MIN_SCORE, wishAdjustment } from './paidRanking.js';
import { buildCanonicalCoursePath } from '../courseUrl.js';
import { buildExplanation, localizedPrice, offerFormsOf, addressCantons } from './explanation.js';
import { checkWishes, deliveryEvidence } from './wishCheck.js';
import { childAudience, adultsBackedByText, requestedChildAudience, adultOnlyForChildRequest } from './audience.js';
import { providerDisplayName } from './providerPublic.js';
export const CANDIDATE_LIMIT = 100;
export const RESULT_LIMIT = 10;

const SECTION_LABELS = {
  title: 'Titel',
  description: 'Beschreibung',
  objectives: 'Lernziele',
  prerequisites: 'Voraussetzungen',
  keywords: 'Stichworte',
  free_reason: 'Hinweis des Anbieters',
};

const PAID_TIERS = new Set(['pro', 'premium', 'enterprise']);

/** Aktuelle Paketstufe serverseitig aus autoritativen Profilfeldern. */
export function resolveActiveTier(profile, now = new Date()) {
  const tier = String(profile?.package_tier ?? 'basic').toLowerCase();
  if (!PAID_TIERS.has(tier)) return 'basic';
  const expires = profile?.package_expires_at ? new Date(profile.package_expires_at) : null;
  if (expires && !Number.isNaN(expires.getTime()) && expires.getTime() <= now.getTime()) return 'basic';
  return tier;
}

/** Nächster künftiger, nicht abgesagter Termin (Zürich-Tage). */
export function nextUpcomingEvent(course, now = new Date()) {
  const today = zurichDayString(now);
  const events = (Array.isArray(course?.course_events) ? course.course_events : [])
    .filter((event) => !event?.cancelled_at && event?.start_date)
    .filter((event) => {
      const end = zurichDayString(event.end_date || event.start_date);
      return end && end >= today;
    })
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
  return events[0] ?? null;
}

export function describePrice(priceStatus) {
  switch (priceStatus.status) {
    case PRICE_STATUS.FREE: return { text: 'Kostenlos', gap: null };
    case PRICE_STATUS.FIXED:
      return {
        text: `CHF ${priceStatus.amount}`,
        gap: priceStatus.basisConfirmed ? null : 'Ob der Preis den ganzen Kurs oder eine Einheit betrifft, ist nicht angegeben.',
      };
    case PRICE_STATUS.FROM: return { text: `ab CHF ${priceStatus.amount}`, gap: 'Endpreis offen.' };
    case PRICE_STATUS.PER_UNIT: return { text: `CHF ${priceStatus.amount} pro Einheit`, gap: 'Gesamtpreis offen.' };
    case PRICE_STATUS.INFO_TEXT: return { text: priceStatus.infoText, gap: 'Preis nur als Freitext angegeben.' };
    default: return { text: 'Preis auf Anfrage', gap: 'Kein Preis angegeben.' };
  }
}

function courseTexts(course, chunksByCourse) {
  const chunks = chunksByCourse.get(String(course.id)) ?? [];
  return [
    { section: 'title', text: course.title ?? '' },
    ...chunks.map((chunk) => ({ section: chunk.section, text: chunk.text })),
  ];
}

/**
 * Textpassung (Ersatz für die Luna-Bewertung bis Gate E3): Anteil der
 * Suchbegriffe, für die eine Belegstelle im öffentlichen Kurstext existiert.
 * Jeder Grund trägt Abschnitt + Zitat (kontrollierte Evidenz, kein Modelltext).
 */
export function scoreTextFit(course, terms, chunksByCourse, wishes) {
  const texts = courseTexts(course, chunksByCourse);
  const reasons = [];
  let matched = 0;
  let titleHit = false;
  for (const term of terms) {
    for (const { section, text } of texts) {
      const hit = findTermInText(term, text);
      if (hit) {
        matched += 1;
        if (section === 'title') titleHit = true;
        if (reasons.length < 3 && !reasons.some((r) => r.section === section && r.quote.includes(text.slice(hit.index, hit.index + hit.length)))) {
          reasons.push({
            kind: 'text',
            section,
            sectionLabel: SECTION_LABELS[section] ?? section,
            term,
            quote: excerptAround(text, hit.index, hit.length),
          });
        }
        break;
      }
    }
  }

  let wishBonus = 0;
  // Verneinte Ortsangaben („nicht in Zürich“) sind kein Ortswunsch (K1).
  const locationWishes = wishes.filter((w) => w.type === 'location' && !w.negated);
  if (locationWishes.length > 0) {
    const places = [
      course.canton,
      ...(Array.isArray(course.course_locations) ? course.course_locations.flatMap((l) => [l.canton, l.city]) : []),
      ...(Array.isArray(course.course_events) ? course.course_events.flatMap((e) => [e.canton, e.location]) : []),
      // Kantone aus der Adressangabe (24.11.2026, Befund 20127: Ortsfeld „Online“, Adresse nennt Bern).
      ...addressCantons(course.address),
    ].filter(Boolean).map((p) => String(p).toLowerCase());
    // Stadt und Kanton unterscheiden (Stabilisierung 23.11.2026, Befund
    // 20331/20579): Ein Stadtwunsch („Winterthur“) ist nur durch dieselbe
    // Stadt erfüllt, nicht durch den Kanton; ein Kantonswunsch durch den Kanton.
    const cityPlaces = [
      ...(Array.isArray(course.course_locations) ? course.course_locations.map((l) => l.city) : []),
      ...(Array.isArray(course.course_events) ? course.course_events.map((e) => e.location) : []),
    ].filter(Boolean).map((p) => String(p).toLowerCase());
    for (const wish of locationWishes) {
      const isCanton = cantonForPlace(wish.value) === wish.value;
      const wanted = String(wish.value).toLowerCase();
      const hit = isCanton
        ? places.find((p) => p === wanted || p.includes(wanted))
        : cityPlaces.find((p) => p.includes(wanted));
      if (hit) {
        wishBonus = 5;
        reasons.push({ kind: 'location', section: 'location', sectionLabel: 'Ort', term: wish.label, quote: `Ort laut Kursangaben: ${hit.replace(/^\w/, (c) => c.toUpperCase())}` });
        break;
      }
    }
  }

  const coverage = terms.length > 0 ? matched / terms.length : (wishBonus > 0 ? 1 : 0);
  // Produktregel (23.11.2026): Bei Suchbegriffen ist der Score die fachliche
  // Passung; ein Ortswunsch wirkt nur auf die Reihenfolge (wishAdjust ±2).
  // Reine Ortsanfrage ohne Suchbegriff: der Ort ist dann das einzige Kriterium.
  const base = terms.length > 0 ? 55 + 45 * coverage : (wishBonus > 0 ? 70 : 0);
  const score = Math.min(100, Math.round(base + (titleHit ? 5 : 0) + (terms.length > 0 ? 0 : wishBonus)));
  const positiveLocationWish = wishes.some((w) => w.type === 'location' && !w.negated);
  const wishAdjust = terms.length > 0 && positiveLocationWish ? (wishBonus > 0 ? 2 : -2) : 0;
  return { score, coverage, matchedTerms: matched, reasons, wishAdjust };
}

async function lexicalChunkChannel(client, tsQuery) {
  const { data, error } = await client.rpc('ai_search_lexical', { p_query: tsQuery, p_limit: CANDIDATE_LIMIT });
  if (error) throw new Error(`Abruf (Abschnitte): ${error.message}`);
  return (data ?? []).map((row) => ({ courseId: row.course_id }));
}

/** Höchstens so viele Treffer liest der Titel-Kanal, bevor er sortiert. */
export const TITLE_CHANNEL_MAX_ROWS = 5000;
const TITLE_CHANNEL_PAGE = 1000;

function compareCourseIds(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (Number.isFinite(x) && Number.isFinite(y) && x !== y) return x - y;
  return String(a).localeCompare(String(b));
}

/**
 * Relevanzfolge des Titel-Kanals (Korrektur 22.11.2026, Abnahme-Befund):
 * Die Volltextsuche auf ai_search_documents trifft Titel UND Beschreibung,
 * liefert aber keine Rangfolge. Sortiert wird deshalb nachvollziehbar und
 * reproduzierbar:
 *   1. Anzahl der Suchbegriffe im Titel (wortstammtolerant wie findTermInText),
 *   2. frühere erste Fundstelle im Titel,
 *   3. Kurs-ID aufsteigend.
 * Kurse ohne Begriff im Titel fallen aus diesem Kanal heraus; sie passen nur
 * über die Beschreibung, und die bewertet der Abschnitts-Kanal mit ts_rank.
 */
export function rankTitleMatches(rows, terms) {
  const unique = [...new Set((terms ?? []).map((t) => String(t).toLowerCase()).filter(Boolean))];
  return (rows ?? [])
    .map((row) => {
      let titleHits = 0;
      let firstHit = Number.POSITIVE_INFINITY;
      for (const term of unique) {
        const match = findTermInText(term, row?.title ?? '');
        if (match) {
          titleHits += 1;
          firstHit = Math.min(firstHit, match.index);
        }
      }
      return { courseId: row?.course_id, titleHits, firstHit };
    })
    .filter((row) => row.courseId !== undefined && row.courseId !== null && row.titleHits > 0)
    .sort((a, b) => (b.titleHits - a.titleHits) || (a.firstHit - b.firstHit) || compareCourseIds(a.courseId, b.courseId));
}

/**
 * Titel-Kanal: liest ALLE Treffer seitenweise in stabiler Reihenfolge
 * (course_id), erst danach wird sortiert und auf CANDIDATE_LIMIT begrenzt.
 * Früher schnitt limit(100) auf eine unsortierte Treffermenge relevante
 * Kurse ab und gab der Fusion eine zufällige Reihenfolge als Rang.
 */
export async function lexicalDocumentChannel(client, tsQuery, terms, meta = {}) {
  const rows = [];
  let truncated = false;
  for (let offset = 0; ; offset += TITLE_CHANNEL_PAGE) {
    if (offset >= TITLE_CHANNEL_MAX_ROWS) { truncated = true; break; }
    const { data, error } = await client
      .from('ai_search_documents')
      .select('course_id, title')
      .textSearch('tsv', tsQuery, { type: 'websearch', config: 'german' })
      .order('course_id', { ascending: true })
      .range(offset, offset + TITLE_CHANNEL_PAGE - 1);
    if (error) throw new Error(`Abruf (Titel): ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < TITLE_CHANNEL_PAGE) break;
  }
  const ranked = rankTitleMatches(rows, terms);
  Object.assign(meta, { matched: rows.length, withTitleHits: ranked.length, truncated });
  return ranked.slice(0, CANDIDATE_LIMIT).map((row) => ({ courseId: row.courseId }));
}

async function fetchAllIds(client, table, column, applyFilter) {
  const ids = new Set();
  for (let offset = 0; ; offset += 1000) {
    let query = client.from(table).select(column).order(column).range(offset, offset + 999);
    if (applyFilter) query = applyFilter(query);
    const { data, error } = await query;
    if (error) throw new Error(`Abdeckung (${table}): ${error.message}`);
    for (const row of data ?? []) ids.add(String(row[column]));
    if ((data ?? []).length < 1000) break;
  }
  return ids;
}

/**
 * Abdeckungsnachweis VOR jeder Suche: Abgleich auf Kurs-ID-Ebene (nicht nur
 * Anzahl): Jeder aktuell veröffentlichte Kurs muss ein Indexdokument haben.
 * Zusätzlich wird ausgewiesen, wie viele Änderungen noch nicht eingearbeitet
 * sind (offene Aufträge), damit keine Aktualitätsbehauptung entsteht.
 */
export async function indexCoverage(client) {
  const [publishedIds, documentIds, pending] = await Promise.all([
    fetchAllIds(client, 'courses', 'id', (q) => q.eq('status', 'published')),
    fetchAllIds(client, 'ai_search_documents', 'course_id'),
    client.from('ai_search_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  if (pending.error) throw new Error(`Abdeckung (Aufträge): ${pending.error.message}`);
  const missingCount = [...publishedIds].filter((id) => !documentIds.has(id)).length;
  return {
    publishedCount: publishedIds.size,
    documentCount: documentIds.size,
    missingCount,
    pendingUpdates: pending.count ?? 0,
    complete: publishedIds.size > 0 && missingCount === 0,
    method: 'id_anti_join',
  };
}

async function loadCandidates(client, courseIds) {
  if (courseIds.length === 0) return { courses: [], chunksByCourse: new Map(), profilesById: new Map(), categoriesByCourse: new Map() };
  const { data: courses, error } = await client
    .from('courses')
    .select('*, course_events(*), course_locations(*)')
    .in('id', courseIds)
    .eq('status', 'published');
  if (error) throw new Error(`Kursdaten: ${error.message}`);

  const userIds = [...new Set((courses ?? []).map((c) => c.user_id).filter(Boolean))];
  const [chunkResult, profileResult, categoryResult] = await Promise.all([
    client.from('ai_search_chunks').select('course_id, section, chunk_index, text').in('course_id', courseIds).order('chunk_index'),
    userIds.length > 0
      // Nur die Paketfelder für die serverseitige Paid-Stufe (Datenvertrag §2);
      // der Anbietername kommt wie auf der Kursseite aus courses.instructor_name.
      ? client.from('profiles').select('id, package_tier, package_expires_at').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    client.from('v_course_full_categories').select('*').in('course_id', courseIds),
  ]);
  if (chunkResult.error) throw new Error(`Abschnitte: ${chunkResult.error.message}`);
  if (profileResult.error) throw new Error(`Anbieter: ${profileResult.error.message}`);
  if (categoryResult.error) throw new Error(`Kategorien: ${categoryResult.error.message}`);

  const chunksByCourse = new Map();
  for (const chunk of chunkResult.data ?? []) {
    const key = String(chunk.course_id);
    if (!chunksByCourse.has(key)) chunksByCourse.set(key, []);
    chunksByCourse.get(key).push(chunk);
  }
  const profilesById = new Map((profileResult.data ?? []).map((p) => [String(p.id), p]));
  const categoriesByCourse = new Map();
  for (const row of categoryResult.data ?? []) {
    const key = String(row.course_id);
    if (!categoriesByCourse.has(key)) categoriesByCourse.set(key, []);
    categoriesByCourse.get(key).push(row);
  }
  return { courses: courses ?? [], chunksByCourse, profilesById, categoriesByCourse };
}

const EVIDENCE_LABELS = {
  title: 'Titel',
  description: 'Beschreibung',
  objectives: 'Lernziele',
  prerequisites: 'Voraussetzungen',
  keywords: 'Stichworte',
  category: 'Kategorie',
  location: 'Ort',
  price_status: 'Preis',
  level: 'Niveau',
  languages: 'Sprache',
  delivery_types: 'Lernform',
  target_group: 'Zielgruppe',
};

/**
 * Öffentliche Evidenz eines Kandidaten für Luna (Datenvertrag §2):
 * keine Paket-, Prio-, Lead- oder Kontaktdaten. Texte stammen aus dem
 * Index (bereinigte Chunks) und werden je Feld begrenzt.
 */
export function buildEvidence(course, context) {
  const chunks = context.chunksByCourse.get(String(course.id)) ?? [];
  const sectionText = (section) => chunks.filter((c) => c.section === section).map((c) => c.text).join(' ').slice(0, 1500) || undefined;
  const priceStatus = derivePriceStatus(course);
  const evidence = {
    title: course.title ?? '',
    description: sectionText('description'),
    objectives: sectionText('objectives'),
    prerequisites: sectionText('prerequisites'),
    keywords: sectionText('keywords'),
    category: categoryLabel(context.categoriesByCourse.get(String(course.id))) ?? undefined,
    location: [course.canton, ...(course.course_locations ?? []).map((l) => l.city)].filter(Boolean).join(', ') || undefined,
    price_status: describePrice(priceStatus).text,
    level: course.level ?? undefined,
    // Strukturierte Lernform, damit Luna sie nicht aus dem Thema ableitet.
    delivery_types: deliveryEvidence(course),
    // Zielgruppe nur, wenn belegt Kinder/Jugendliche (target_group „Adults“
    // ist in den Daten ein Standardwert und kein Beleg → nicht gesendet).
    target_group: childAudience(course, context.categoriesByCourse.get(String(course.id))).label ?? undefined,
  };
  return Object.fromEntries(Object.entries(evidence).filter(([, value]) => value !== undefined && value !== ''));
}

/**
 * Belegtext eines Kurses für die Prüfung des Luna-Inhaltssatzes: alle an Luna
 * gesendeten öffentlichen Felder plus Rohbeschreibung und Terminbeschreibungen.
 */
export function courseEvidenceText(course, context) {
  const evidence = buildEvidence(course, context);
  const events = (Array.isArray(course?.course_events) ? course.course_events : []).map((e) => e?.schedule_description);
  return [...Object.values(evidence), course?.description, ...events]
    .flatMap((v) => (Array.isArray(v) ? v : [v])).filter(Boolean).join(' ');
}

function categoryLabel(rows) {
  const primary = (rows ?? []).find((r) => r.is_primary) ?? (rows ?? [])[0];
  if (!primary) return null;
  return [primary.level2_label_de, primary.level3_label_de].filter(Boolean).join(' › ') || null;
}

/**
 * Eingetragenes Kursbild (dieselbe Quelle wie klassische Suche und
 * Kursdetail: courses.image_url). Fehlt es, setzt die Oberfläche wie dort das
 * Laptop-Standardbild ein (Nachtrag 10, Korrektur vom 18.11.2026).
 */
export function courseImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function buildCard(course, ranked, mustResult, context, now, request) {
  const priceStatus = derivePriceStatus(course);
  const price = describePrice(priceStatus);
  const event = mustResult.matchingEvent ?? nextUpcomingEvent(course, now);
  const gaps = [];
  if (price.gap) gaps.push(price.gap);
  if (!event) gaps.push('Kein künftiger Termin hinterlegt.');
  const place = event?.location || event?.canton || course.canton || null;
  if (!place) gaps.push('Ort nicht angegeben.');
  for (const unknown of mustResult.unknowns) {
    if (unknown === 'event') gaps.push('Ort/Termin-Vorgabe kann ohne passenden Termin nicht bestätigt werden.');
    if (unknown === 'location') gaps.push('Kursort zur Ortsvorgabe nicht angegeben.');
    if (unknown === 'budget') gaps.push('Budget-Vorgabe kann mit den Preisangaben nicht bestätigt werden.');
    if (unknown === 'language') gaps.push('Kurssprache nicht angegeben.');
  }

  const categoryRows = context.categoriesByCourse.get(String(course.id)) ?? [];
  const courseForUrl = { ...course, all_categories: categoryRows.map((row) => ({
    category_type: row.level1_slug, category_area: row.level2_slug, category_area_label: row.level2_label_de,
    category_specialty: row.level3_slug, category_specialty_label: row.level3_label_de,
    category_focus: row.level4_slug || null, category_focus_label: row.level4_label_de || null, is_primary: row.is_primary,
  })) };

  // Lernform-/Niveau-Wünsche nur aus strukturierten Kursangaben bestätigen.
  const wishChecks = checkWishes(course, request.wishes, { now });
  const childInfo = childAudience(course, categoryRows);
  const audience = childInfo.child
    ? { ...childInfo, adultsBacked: adultsBackedByText(buildEvidence(course, context)) }
    : null;
  const cardEvent = event ? { startDate: event.start_date, endDate: event.end_date ?? null, location: event.location ?? null, canton: event.canton ?? null } : null;
  // Diagnose (24.11.2026): ursprünglicher Luna-Satz und Verwerfungsgrund, nur
  // für den privaten Prüfbericht (request.traces nur bei diagnostics).
  const trace = request.traces ? {} : null;
  const explanation = buildExplanation({
    trace,
    // Ort und Lernform zusammen auswerten; Abschluss aus belegten Kursangaben.
    address: course.address ?? null,
    deliveryTypes: Array.isArray(course.delivery_types) && course.delivery_types.length > 0 ? course.delivery_types : (course.delivery_type ? [course.delivery_type] : []),
    objectives: course.objectives ?? null,
    // Felder zeilenweise getrennt: ein Zitat darf nie zwei Felder verbinden (Befund 20378).
    courseText: [course.title, course.description, Array.isArray(course.objectives) ? course.objectives.join('\n') : course.objectives, Array.isArray(course.keywords) ? course.keywords.join(', ') : course.keywords].filter(Boolean).join('\n'),
    title: course.title ?? null,
    keywords: Array.isArray(course.keywords) ? course.keywords.join(', ') : (course.keywords ?? null),
    lead: ranked.lunaExplanation ?? null,
    reasons: ranked.reasons,
    wishes: request.wishes,
    wishChecks,
    musts: request.musts,
    mustUnknowns: mustResult.unknowns ?? [],
    place,
    // Städte laut Kursorten/Termin: für verneinte Ortswünsche (K1), damit
    // Kanton und Stadt nicht verwechselt werden.
    cities: [...new Set([event?.location, ...(course.course_locations ?? []).map((l) => l.city)].filter(Boolean))],
    // Kanton getrennt von der Stadt (Stabilisierung 23.11.2026).
    canton: event?.canton || course.canton || null,
    // Voraussetzungen als wesentliche Teilnahmebeschränkung (wörtlich, gekürzt).
    prerequisites: Array.isArray(course.prerequisites) ? course.prerequisites.join('\n') : (course.prerequisites ?? null),
    description: course.description ?? null,
    // Belegtext für die Prüfung des Luna-Inhaltssatzes (Eigenschaften).
    evidenceText: courseEvidenceText(course, context),
    event: cardEvent,
    price: localizedPrice(priceStatus, request.language),
    audience,
    language: request.language,
    offerForm: offerFormsOf(course),
  });
  if (trace) {
    // Von der Textprüfung des Gateways verworfener Luna-Text (vor dem Server).
    if (!ranked.lunaExplanation && ranked.lunaExplanationRaw) {
      trace.lunaText = ranked.lunaExplanationRaw;
      trace.verworfen = `textpruefung:${ranked.lunaRejectedBecause ?? 'unbekannt'}`;
    }
    request.traces.set(String(course.id), trace);
  }

  // Paketeinfluss bewusst NICHT je Karte (Nachtrag 10: keine Einzelbadges);
  // er wird allgemein in der Fussnote unter den Ergebnissen erklärt.
  return {
    courseId: course.id,
    title: course.title ?? '',
    url: buildCanonicalCoursePath(courseForUrl),
    imageUrl: courseImageUrl(course.image_url),
    explanation,
    // Gleiche Quelle wie die Kursdetailseite; nie profiles.full_name.
    provider: providerDisplayName(course),
    category: categoryLabel(categoryRows),
    score: ranked.score,
    reasons: ranked.reasons,
    price: price.text,
    place,
    event: cardEvent,
    gaps: [...new Set(gaps)],
    mustStatus: mustResult.result,
    wishChecks,
  };
}

/**
 * Auswahlstufen je Kandidat für den Prüfbericht (K3): Rang je Abrufkanal,
 * fusionierter Rang, Muss-Ergebnis, an Luna gesendet, Score, angezeigt.
 */
export function buildSelectionDiagnostics({ channels, candidateIds, mustLog, scored, lunaUsed, lunaSentIds, results, incompleteResults, titleChannelMeta = null, semanticVariants = null }) {
  const rankIn = (list) => new Map((list ?? []).map((row, index) => [String(row.courseId ?? row.course_id), index + 1]));
  const ranks = { lexicalChunks: rankIn(channels.lexicalChunks), lexicalDocuments: rankIn(channels.lexicalDocuments), semantic: channels.semantic ? rankIn(channels.semantic) : null };
  const sent = new Set((lunaSentIds ?? []).map(String));
  const scoreById = new Map(scored.map((s) => [String(s.course.id), { rated: lunaUsed ? Boolean(s.rated) : true, score: s.candidate.score, samples: s.candidate.scoreSamples ?? null }]));
  const shown = new Map([...results.map((c) => [String(c.courseId), 'Treffer']), ...incompleteResults.map((c) => [String(c.courseId), 'unvollständig'])]);
  const variantRanks = semanticVariants?.full ? { full: rankIn(semanticVariants.full), topic: rankIn(semanticVariants.topic) } : null;
  return {
    minScore: MIN_SCORE,
    semanticUsed: Boolean(channels.semantic),
    titleChannel: titleChannelMeta,
    // Bedeutungssuche mit ganzer Anfrage bzw. nur fachlichem Anliegen (Abrufprüfung).
    semanticQueryUsed: semanticVariants?.used ?? null,
    // Erste 30 der Bedeutungssuche je Variante (nur IDs), auch ausserhalb der Kandidaten.
    semanticTop: semanticVariants?.full ? { full: semanticVariants.full.slice(0, 30).map((r) => String(r.courseId)), topic: semanticVariants.topic.slice(0, 30).map((r) => String(r.courseId)) } : null,
    candidates: candidateIds.map((id, index) => {
      const key = String(id);
      const must = mustLog.get(key) ?? null;
      const scoredEntry = scoreById.get(key);
      return {
        courseId: key,
        fusedRank: index + 1,
        lexicalChunkRank: ranks.lexicalChunks.get(key) ?? null,
        lexicalDocumentRank: ranks.lexicalDocuments.get(key) ?? null,
        semanticRank: ranks.semantic ? (ranks.semantic.get(key) ?? null) : null,
        ...(variantRanks ? { semanticRankFull: variantRanks.full.get(key) ?? null, semanticRankTopic: variantRanks.topic.get(key) ?? null } : {}),
        must: must ? must.result : 'not_loaded',
        mustFailures: must?.failures ?? [],
        mustUnknowns: must?.unknowns ?? [],
        sentToLuna: lunaUsed ? sent.has(key) : null,
        rated: scoredEntry ? scoredEntry.rated : false,
        score: scoredEntry && scoredEntry.rated ? scoredEntry.score : null,
        scoreSamples: scoredEntry && scoredEntry.rated ? scoredEntry.samples : null,
        shown: shown.get(key) ?? null,
      };
    }),
  };
}

/**
 * Führt die Suche aus. Der Aufrufer (Such-API) hat Auth und Kontingent
 * bereits geprüft und reserviert.
 *
 * @param {object} client - Supabase-Client (Service-Rolle, nur serverseitig)
 * @param {{query: string, musts?: {canton?: string, onlineAllowed?: boolean,
 *          maxBudget?: number}, now?: Date}} input
 */
export async function runAiSearch(client, input) {
  const now = input.now ?? new Date();
  const parsed = parseQuery(input.query);
  const musts = {};
  if (input.musts?.canton) {
    musts.location = String(input.musts.canton);
    musts.onlineAllowed = input.musts.onlineAllowed === true;
  }
  if (Number.isFinite(input.musts?.maxBudget) && input.musts.maxBudget > 0) musts.maxBudget = input.musts.maxBudget;

  const models = input.models ?? null; // { gateway, embeddingVersion } — nur nach Freigabe E3

  // Phasenzeiten in ms (Nachtrag 12) — nur Zahlen, keine Inhalte.
  const searchStarted = Date.now();
  const timings = {};
  const timed = async (name, fn) => {
    const started = Date.now();
    try { return await fn(); } finally { timings[name] = Date.now() - started; }
  };

  // Unabhängige Schritte PARALLEL: Abdeckungsnachweis, lexikalischer Abruf
  // (Abschnitte + Titel) und Bedeutungssuche (Konfiguration → Query-
  // Embedding → semantischer Abruf). Alle bleiben katalogweit.
  // Kennzahlen des Titel-Kanals (nur Zahlen) für Diagnose und Prüfbericht.
  const titleChannelMeta = {};
  // Beide Varianten der Bedeutungssuche (nur Prüfbericht, siehe unten).
  const semanticVariants = {};
  const lexicalPath = parsed.tsQuery
    ? timed('lexical', () => Promise.all([
      lexicalChunkChannel(client, parsed.tsQuery),
      lexicalDocumentChannel(client, parsed.tsQuery, parsed.terms, titleChannelMeta),
    ]))
    : Promise.resolve([]);
  const semanticPath = models?.gateway
    ? timed('semantic', async () => {
      // Bedeutungssuche nur, wenn der Index für genau diese Modellversion
      // vollständig eingebettet und aktiv geschaltet ist (ai_search_config).
      // Bewusst NACHEINANDER: kein kostenpflichtiges Query-Embedding, solange
      // die Indexversion nicht aktiv ist. Teilzeiten (Nachtrag 13) trennen
      // Konfiguration, Embedding und Datenbankabruf für die Ursachenanalyse.
      const configStarted = Date.now();
      const { data: config, error: configError } = await client
        .from('ai_search_config').select('active_model_version').eq('id', 1).maybeSingle();
      timings.semanticConfig = Date.now() - configStarted;
      if (configError) throw new Error(`Konfiguration: ${configError.message}`);
      if (!config?.active_model_version || config.active_model_version !== models.embeddingVersion) return null;
      // Anfragetext der Bedeutungssuche (Abrufprüfung 23.11.2026): 'full' wie
      // bisher die ganze Anfrage, 'topic' nur das fachliche Anliegen ohne
      // optionale Wünsche. Im Prüfbericht werden bei Unterschied BEIDE in EINEM
      // Embedding-Aufruf eingebettet und beide Ränge festgehalten.
      const useTopic = models.semanticQuery === 'topic' && parsed.topic && parsed.topic !== parsed.normalized;
      const compare = input.diagnostics === true && parsed.topic && parsed.topic !== parsed.normalized;
      const texts = compare ? [parsed.normalized, parsed.topic] : [useTopic ? parsed.topic : parsed.normalized];
      const embedStarted = Date.now();
      const vectors = await models.gateway.embed(texts);
      timings.queryEmbedding = Date.now() - embedStarted;
      const rpcStarted = Date.now();
      const lists = await Promise.all(vectors.map(async (vector) => {
        const { data, error } = await client.rpc('ai_search_semantic', {
          p_embedding: JSON.stringify(vector),
          p_model_version: models.embeddingVersion,
          p_limit: CANDIDATE_LIMIT,
        });
        if (error) throw new Error(`Abruf (Bedeutung): ${error.message}`);
        return (data ?? []).map((row) => ({ courseId: row.course_id }));
      }));
      timings.semanticRpc = Date.now() - rpcStarted;
      if (compare && lists.length === 2) {
        semanticVariants.full = lists[0];
        semanticVariants.topic = lists[1];
        semanticVariants.used = useTopic ? 'topic' : 'full';
        return useTopic ? lists[1] : lists[0];
      }
      return lists[0] ?? [];
    })
    : Promise.resolve(null);
  const [coverage, lexicalChannels, semanticChannel] = await Promise.all([
    timed('coverage', () => indexCoverage(client)),
    lexicalPath,
    semanticPath,
  ]);
  const semanticUsed = Array.isArray(semanticChannel);
  // Textkanäle zuerst zu einer Textliste, dann 1:1 mit der Bedeutungsliste
  // (fuseHybrid, Korrektur 23.11.2026): Füllworttreffer erhalten kein
  // doppeltes Gewicht mehr gegenüber der Bedeutungssuche.
  const candidateIds = (lexicalChannels.length > 0 || semanticUsed)
    ? fuseHybrid({ lexical: lexicalChannels, semantic: semanticUsed ? semanticChannel : null }, { limit: CANDIDATE_LIMIT }).map((c) => c.courseId)
    : [];

  const context = await timed('loadCandidates', () => loadCandidates(client, candidateIds));
  // Statusprüfung unmittelbar vor Ausgabe (zusätzlich zum Filter in der Abfrage).
  const freshCourses = context.courses.filter((course) => isPubliclySearchable(course));

  const scored = [];
  let excludedByMust = 0;
  let excludedByAudience = 0;
  // K3: Muss-Ergebnis je Kandidat (nur IDs/Codes) für den Prüfbericht.
  const mustLog = new Map();
  // Kinderanfrage (23.11.2026): ausdrücklich nur an Erwachsene/Jugendliche
  // gerichtete Kurse sind fachlich ungeeignet und werden nicht bewertet.
  const childRequest = requestedChildAudience(parsed.normalized);
  for (const course of freshCourses) {
    const mustResult = checkCourseMusts(course, musts, { today: now });
    mustLog.set(String(course.id), { result: mustResult.result, failures: mustResult.failures, unknowns: mustResult.unknowns });
    if (mustResult.result === MUST_RESULT.FAILED) {
      excludedByMust += 1;
      continue;
    }
    if (adultOnlyForChildRequest(course, context.categoriesByCourse.get(String(course.id)), childRequest)) {
      excludedByAudience += 1;
      mustLog.set(String(course.id), { result: 'zielgruppe', failures: ['zielgruppe_erwachsene'], unknowns: [] });
      continue;
    }
    const fit = scoreTextFit(course, parsed.terms, context.chunksByCourse, parsed.wishes);
    const profile = context.profilesById.get(String(course.user_id)) ?? null;
    const tier = resolveActiveTier(profile, now);
    scored.push({
      course,
      mustResult,
      candidate: {
        courseId: course.id,
        score: fit.score,
        wishAdjust: fit.wishAdjust,
        reasons: fit.reasons,
        tier,
        // Prio nur bei aktivem Bezahlpaket (Paketstatus serverseitig geprüft).
        prioEligible: course.is_prio === true && tier !== 'basic',
      },
    });
  }

  // Fachliche Bewertung durch Luna (nur nach Freigabe E3): ersetzt die
  // Textpassung für die nach Abrufrang besten Kandidaten. Nicht bewertete
  // Kandidaten fallen heraus (kein Auffüllen mit unbewerteten Kursen).
  let lunaUsed = false;
  let lunaSent = 0;
  let lunaSentIds = [];
  let lunaDiscarded = 0;
  let explanationsRejected = 0;
  let explanationsRequested = null;
  const twoStage = models?.gateway?.mode === 'twoStage' && typeof models.gateway.scoreCandidates === 'function';
  if (models?.gateway && scored.length > 0 && twoStage) {
    // Variante B (Nachtrag 14): Stufe 1 bewertet ALLE Kandidaten nur mit
    // Score; die Begründungen folgen erst nach der finalen Auswahl.
    const rankIndex = new Map(candidateIds.map((id, index) => [String(id), index]));
    const ordered = [...scored].sort((a, b) => (rankIndex.get(String(a.course.id)) ?? 1e9) - (rankIndex.get(String(b.course.id)) ?? 1e9));
    const evidenceCandidates = ordered.map((s) => ({ courseId: s.course.id, evidence: buildEvidence(s.course, context) }));
    const { accepted, sentIds, rejected = [] } = await timed('lunaScore', () => models.gateway.scoreCandidates(parsed.topic, evidenceCandidates, { optionalWishes: parsed.optionalWishes }));
    lunaSent = Array.isArray(sentIds) ? sentIds.length : evidenceCandidates.length;
    lunaSentIds = Array.isArray(sentIds) ? sentIds.map(String) : evidenceCandidates.map((c) => String(c.courseId));
    lunaDiscarded = rejected.filter((r) => /Kurs-ID|doppelt|Score/.test(r.reason)).length;
    const byId = new Map(accepted.map((a) => [String(a.courseId), a]));
    for (const entry of scored) {
      const judged = byId.get(String(entry.course.id));
      entry.rated = Boolean(judged);
      entry.candidate.score = judged ? judged.score : 0;
      entry.candidate.lunaExplanation = null;
      // Ortsabgleich bleibt (Kursangaben); Luna-Belege kommen aus Stufe 2.
      entry.candidate.reasons = judged ? entry.candidate.reasons.filter((r) => r.kind === 'location') : [];
    }
    lunaUsed = true;
  } else if (models?.gateway && scored.length > 0) {
    const rankIndex = new Map(candidateIds.map((id, index) => [String(id), index]));
    const ordered = [...scored].sort((a, b) => (rankIndex.get(String(a.course.id)) ?? 1e9) - (rankIndex.get(String(b.course.id)) ?? 1e9));
    const evidenceCandidates = ordered.map((s) => ({ courseId: s.course.id, evidence: buildEvidence(s.course, context) }));
    const { accepted, sentIds, rejected = [] } = await timed('luna', () => models.gateway.rerank(parsed.topic, evidenceCandidates, { language: parsed.language, optionalWishes: parsed.optionalWishes }));
    lunaSent = Array.isArray(sentIds) ? sentIds.length : evidenceCandidates.length;
    lunaSentIds = Array.isArray(sentIds) ? sentIds.map(String) : evidenceCandidates.map((c) => String(c.courseId));
    lunaDiscarded = rejected.filter((r) => /Kurs-ID|doppelt|Score/.test(r.reason)).length;
    explanationsRejected = rejected.filter((r) => /Begründungstext/.test(r.reason)).length;
    const byId = new Map(accepted.map((a) => [String(a.courseId), a]));
    for (const entry of scored) {
      const judged = byId.get(String(entry.course.id));
      entry.rated = Boolean(judged);
      // Ortsabgleich (aus Kursangaben, nicht vom Modell) bleibt erhalten,
      // damit Abweichungen vom Ortswunsch korrekt benannt werden.
      const locationReasons = entry.candidate.reasons.filter((r) => r.kind === 'location');
      entry.candidate.score = judged ? judged.score : 0;
      // Optionale Wünsche nur für die Reihenfolge (nie für die Mindestpassung).
      entry.candidate.wishAdjust = judged ? wishAdjustment(judged.wishScore) : 0;
      // Rohwerte beider Stichproben (nur für den Prüfbericht).
      entry.candidate.scoreSamples = judged?.scoreSamples ?? null;
      entry.candidate.lunaExplanation = judged?.explanation ?? null;
      entry.candidate.lunaExplanationRaw = judged?.explanationRaw ?? null;
      entry.candidate.lunaRejectedBecause = judged?.explanationRejectedBecause ?? null;
      entry.candidate.reasons = judged
        ? [...judged.reasons.slice(0, 3).map((r) => ({ kind: 'luna', section: r.field, sectionLabel: EVIDENCE_LABELS[r.field] ?? r.field, quote: r.quote })), ...locationReasons]
        : [];
    }
    lunaUsed = true;
  }

  const confirmed = scored.filter((s) => s.mustResult.result === MUST_RESULT.CONFIRMED);
  const incomplete = scored.filter((s) => s.mustResult.result === MUST_RESULT.INCOMPLETE);

  // Finale Auswahl (Mindestpassung, Paketregeln, höchstens RESULT_LIMIT je Gruppe).
  const select = (group) => rankWithPaidPriority(group.map((s) => s.candidate)).slice(0, RESULT_LIMIT);
  const selectedConfirmed = select(confirmed);
  const selectedIncomplete = select(incomplete);

  if (twoStage && lunaUsed) {
    // Variante B, Stufe 2: Begründungen NUR für die final angezeigten Kurse.
    const entryById = new Map(scored.map((s) => [String(s.course.id), s]));
    const finalEntries = [...selectedConfirmed, ...selectedIncomplete].map((r) => entryById.get(String(r.courseId))).filter(Boolean);
    explanationsRequested = finalEntries.length;
    const explainInput = finalEntries.map((s) => ({ courseId: s.course.id, evidence: buildEvidence(s.course, context) }));
    const { accepted = [], rejected = [] } = await timed('lunaExplain', () => models.gateway.explainCandidates(parsed.topic, explainInput, { language: parsed.language, optionalWishes: parsed.optionalWishes }));
    explanationsRejected = rejected.filter((r) => /Begründungstext/.test(r.reason)).length;
    const explainedById = new Map(accepted.map((a) => [String(a.courseId), a]));
    for (const ranked of [...selectedConfirmed, ...selectedIncomplete]) {
      const explained = explainedById.get(String(ranked.courseId));
      if (!explained) continue;
      const locationReasons = (ranked.reasons ?? []).filter((r) => r.kind === 'location');
      ranked.lunaExplanation = explained.explanation ?? null;
      ranked.lunaExplanationRaw = explained.explanationRaw ?? null;
      ranked.lunaRejectedBecause = explained.explanationRejectedBecause ?? null;
      ranked.reasons = [...explained.reasons.slice(0, 3).map((r) => ({ kind: 'luna', section: r.field, sectionLabel: EVIDENCE_LABELS[r.field] ?? r.field, quote: r.quote })), ...locationReasons];
    }
    timings.luna = (timings.lunaScore ?? 0) + (timings.lunaExplain ?? 0);
  }

  // Diagnose je angezeigter Karte (nur Prüfbericht, nie in der API-Antwort).
  const traces = input.diagnostics === true ? new Map() : null;
  const toCards = (selected, group) => {
    const byId = new Map(group.map((s) => [String(s.course.id), s]));
    return selected.map((ranked) => {
      const entry = byId.get(String(ranked.courseId));
      return buildCard(entry.course, ranked, entry.mustResult, context, now, { wishes: parsed.wishes, musts, language: parsed.language, traces });
    });
  };

  const cardsStarted = Date.now();
  const results = toCards(selectedConfirmed, confirmed);
  const incompleteResults = toCards(selectedIncomplete, incomplete);
  timings.cards = Date.now() - cardsStarted;
  timings.total = Date.now() - searchStarted;
  // Nur tatsächlich bewertete Kandidaten können "unter Mindestpassung" sein.
  // Mit Luna: nicht an Luna gesendete bzw. von Luna nicht zurückgegebene
  // Kandidaten sind UNBEWERTET, nicht "als ungeeignet bewertet".
  const rated = lunaUsed ? scored.filter((s) => s.rated) : scored;
  const belowThreshold = rated.filter((s) => s.candidate.score < MIN_SCORE).length;

  // K3 (22.11.2026): nachvollziehbare Auswahlstufen, nur auf ausdrückliche
  // Anforderung (Qualitätsprüfung). Nur IDs, Ränge, Codes und Scores.
  const diagnostics = input.diagnostics === true ? buildSelectionDiagnostics({
    channels: { lexicalChunks: lexicalChannels[0] ?? [], lexicalDocuments: lexicalChannels[1] ?? [], semantic: semanticUsed ? semanticChannel : null },
    candidateIds, mustLog, scored, lunaUsed, lunaSentIds, results, incompleteResults, titleChannelMeta, semanticVariants,
  }) : null;

  return {
    ...(diagnostics ? { diagnostics: { ...diagnostics, explanations: traces ? [...traces.entries()].map(([courseId, t]) => ({ courseId, ...t })) : [] } } : {}),
    criteria: {
      language: parsed.language,
      terms: parsed.terms,
      // Thema (gewünschte Sprache) ist kein Wunsch-Chip; nur für die Begründung.
      wishes: parsed.wishes.filter((w) => w.type !== 'subject'),
      musts: {
        canton: musts.location ?? null,
        onlineAllowed: musts.onlineAllowed ?? false,
        maxBudget: musts.maxBudget ?? null,
      },
    },
    coverage,
    results,
    incompleteResults,
    stats: {
      candidates: candidateIds.length,
      excludedByMust,
      // Kinderanfrage: ausdrücklich nur an Erwachsene/Jugendliche gerichtete Kurse.
      excludedByAudience,
      // Bewertet = von Luna (bzw. ohne Luna: von der Textpassung) beurteilt.
      rated: rated.length,
      belowThreshold,
      notRated: scored.length - rated.length,
      sentToLuna: lunaUsed ? lunaSent : 0,
      // Ungültige Luna-Einträge (fremde ID, doppelt, ohne Score) und verworfene Texte.
      lunaDiscarded,
      explanationsRejected,
      // Variante B: Anzahl der in Stufe 2 angeforderten Begründungen (sonst null).
      explanationsRequested,
    },
    timings,
    method: {
      retrieval: semanticUsed
        ? 'lexikalisch + Bedeutungssuche (Titel + vollständige Beschreibungen)'
        : 'lexikalisch (Titel + vollständige Beschreibungen)',
      semantic: semanticUsed,
      ranking: lunaUsed ? 'Luna-Bewertung mit belegten Zitaten' : 'Textpassung (Ersatz bis zur Luna-Freigabe)',
      luna: lunaUsed,
      // Nur Zahlen (keine Inhalte): Grundlage für den Kostenbericht.
      usage: models?.gateway?.usage ? { ...models.gateway.usage } : null,
    },
  };
}
