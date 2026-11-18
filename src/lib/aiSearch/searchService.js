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
import { fuseRankedLists } from './retrieval.js';
import { rankWithPaidPriority, MIN_SCORE } from './paidRanking.js';
import { buildCanonicalCoursePath } from '../courseUrl.js';
import { buildExplanation } from './explanation.js';

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
  const locationWishes = wishes.filter((w) => w.type === 'location');
  if (locationWishes.length > 0) {
    const places = [
      course.canton,
      ...(Array.isArray(course.course_locations) ? course.course_locations.flatMap((l) => [l.canton, l.city]) : []),
      ...(Array.isArray(course.course_events) ? course.course_events.flatMap((e) => [e.canton, e.location]) : []),
    ].filter(Boolean).map((p) => String(p).toLowerCase());
    for (const wish of locationWishes) {
      const canton = cantonForPlace(wish.value);
      const hit = places.find((p) => p.includes(String(wish.value).toLowerCase()) || (canton && p === canton.toLowerCase()));
      if (hit) {
        wishBonus = 5;
        reasons.push({ kind: 'location', section: 'location', sectionLabel: 'Ort', term: wish.label, quote: `Ort laut Kursangaben: ${hit.replace(/^\w/, (c) => c.toUpperCase())}` });
        break;
      }
    }
  }

  const coverage = terms.length > 0 ? matched / terms.length : (wishBonus > 0 ? 1 : 0);
  const base = terms.length > 0 ? 55 + 45 * coverage : (wishBonus > 0 ? 70 : 0);
  const score = Math.min(100, Math.round(base + (titleHit ? 5 : 0) + wishBonus));
  return { score, coverage, matchedTerms: matched, reasons };
}

async function lexicalChunkChannel(client, tsQuery) {
  const { data, error } = await client.rpc('ai_search_lexical', { p_query: tsQuery, p_limit: CANDIDATE_LIMIT });
  if (error) throw new Error(`Abruf (Abschnitte): ${error.message}`);
  return (data ?? []).map((row) => ({ courseId: row.course_id }));
}

async function lexicalDocumentChannel(client, tsQuery) {
  const { data, error } = await client
    .from('ai_search_documents')
    .select('course_id')
    .textSearch('tsv', tsQuery, { type: 'websearch', config: 'german' })
    .limit(CANDIDATE_LIMIT);
  if (error) throw new Error(`Abruf (Titel): ${error.message}`);
  return (data ?? []).map((row) => ({ courseId: row.course_id }));
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
      // Nur öffentliche Anbieterfelder + Paketfelder für die Paid-Stufe.
      ? client.from('profiles').select('id, full_name, slug, city, canton, verification_status, package_tier, package_expires_at').in('id', userIds)
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
  };
  return Object.fromEntries(Object.entries(evidence).filter(([, value]) => value !== undefined && value !== ''));
}

function categoryLabel(rows) {
  const primary = (rows ?? []).find((r) => r.is_primary) ?? (rows ?? [])[0];
  if (!primary) return null;
  return [primary.level2_label_de, primary.level3_label_de].filter(Boolean).join(' › ') || null;
}

/** Nur ein dem Kurs zugeordnetes offizielles Bild (http/https), sonst keins. */
export function officialImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function buildCard(course, ranked, mustResult, context, now, request) {
  const priceStatus = derivePriceStatus(course);
  const price = describePrice(priceStatus);
  const event = mustResult.matchingEvent ?? nextUpcomingEvent(course, now);
  const profile = context.profilesById.get(String(course.user_id)) ?? null;
  const gaps = [];
  if (price.gap) gaps.push(price.gap);
  if (!event) gaps.push('Kein künftiger Termin hinterlegt.');
  const place = event?.location || event?.canton || course.canton || null;
  if (!place) gaps.push('Ort nicht angegeben.');
  for (const unknown of mustResult.unknowns) {
    if (unknown === 'event') gaps.push('Ort/Termin-Vorgabe kann ohne passenden Termin nicht bestätigt werden.');
    if (unknown === 'budget') gaps.push('Budget-Vorgabe kann mit den Preisangaben nicht bestätigt werden.');
    if (unknown === 'language') gaps.push('Kurssprache nicht angegeben.');
  }

  const categoryRows = context.categoriesByCourse.get(String(course.id)) ?? [];
  const courseForUrl = { ...course, all_categories: categoryRows.map((row) => ({
    category_type: row.level1_slug, category_area: row.level2_slug, category_area_label: row.level2_label_de,
    category_specialty: row.level3_slug, category_specialty_label: row.level3_label_de,
    category_focus: row.level4_slug || null, category_focus_label: row.level4_label_de || null, is_primary: row.is_primary,
  })) };

  const cardEvent = event ? { startDate: event.start_date, endDate: event.end_date ?? null, location: event.location ?? null, canton: event.canton ?? null } : null;
  const explanation = buildExplanation({
    reasons: ranked.reasons,
    wishes: request.wishes,
    musts: request.musts,
    mustUnknowns: mustResult.unknowns ?? [],
    place,
    event: cardEvent,
    price: price.text,
  });

  // Paketeinfluss bewusst NICHT je Karte (Nachtrag 10: keine Einzelbadges);
  // er wird allgemein in der Fussnote unter den Ergebnissen erklärt.
  return {
    courseId: course.id,
    title: course.title ?? '',
    url: buildCanonicalCoursePath(courseForUrl),
    imageUrl: officialImageUrl(course.image_url),
    explanation,
    provider: profile?.full_name ?? null,
    category: categoryLabel(categoryRows),
    score: ranked.score,
    reasons: ranked.reasons,
    price: price.text,
    place,
    event: cardEvent,
    gaps: [...new Set(gaps)],
    mustStatus: mustResult.result,
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

  const coverage = await indexCoverage(client);
  const models = input.models ?? null; // { gateway, embeddingVersion } — nur nach Freigabe E3

  const channels = [];
  if (parsed.tsQuery) {
    const [chunkHits, documentHits] = await Promise.all([
      lexicalChunkChannel(client, parsed.tsQuery),
      lexicalDocumentChannel(client, parsed.tsQuery),
    ]);
    channels.push(chunkHits, documentHits);
  }
  let semanticUsed = false;
  if (models?.gateway) {
    // Bedeutungssuche nur, wenn der Index für genau diese Modellversion
    // vollständig eingebettet und aktiv geschaltet ist (ai_search_config).
    const { data: config, error: configError } = await client
      .from('ai_search_config').select('active_model_version').eq('id', 1).maybeSingle();
    if (configError) throw new Error(`Konfiguration: ${configError.message}`);
    if (config?.active_model_version && config.active_model_version === models.embeddingVersion) {
      const [vector] = await models.gateway.embed(parsed.normalized);
      const { data, error } = await client.rpc('ai_search_semantic', {
        p_embedding: JSON.stringify(vector),
        p_model_version: models.embeddingVersion,
        p_limit: CANDIDATE_LIMIT,
      });
      if (error) throw new Error(`Abruf (Bedeutung): ${error.message}`);
      channels.push((data ?? []).map((row) => ({ courseId: row.course_id })));
      semanticUsed = true;
    }
  }
  const candidateIds = channels.length > 0
    ? fuseRankedLists(channels, { limit: CANDIDATE_LIMIT }).map((c) => c.courseId)
    : [];

  const context = await loadCandidates(client, candidateIds);
  // Statusprüfung unmittelbar vor Ausgabe (zusätzlich zum Filter in der Abfrage).
  const freshCourses = context.courses.filter((course) => isPubliclySearchable(course));

  const scored = [];
  let excludedByMust = 0;
  for (const course of freshCourses) {
    const mustResult = checkCourseMusts(course, musts, { today: now });
    if (mustResult.result === MUST_RESULT.FAILED) {
      excludedByMust += 1;
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
  if (models?.gateway && scored.length > 0) {
    const rankIndex = new Map(candidateIds.map((id, index) => [String(id), index]));
    const ordered = [...scored].sort((a, b) => (rankIndex.get(String(a.course.id)) ?? 1e9) - (rankIndex.get(String(b.course.id)) ?? 1e9));
    const evidenceCandidates = ordered.map((s) => ({ courseId: s.course.id, evidence: buildEvidence(s.course, context) }));
    const { accepted } = await models.gateway.rerank(parsed.normalized, evidenceCandidates);
    const byId = new Map(accepted.map((a) => [String(a.courseId), a]));
    for (const entry of scored) {
      const judged = byId.get(String(entry.course.id));
      // Ortsabgleich (aus Kursangaben, nicht vom Modell) bleibt erhalten,
      // damit Abweichungen vom Ortswunsch korrekt benannt werden.
      const locationReasons = entry.candidate.reasons.filter((r) => r.kind === 'location');
      entry.candidate.score = judged ? judged.score : 0;
      entry.candidate.reasons = judged
        ? [...judged.reasons.slice(0, 3).map((r) => ({ kind: 'luna', section: r.field, sectionLabel: EVIDENCE_LABELS[r.field] ?? r.field, quote: r.quote })), ...locationReasons]
        : [];
    }
    lunaUsed = true;
  }

  const confirmed = scored.filter((s) => s.mustResult.result === MUST_RESULT.CONFIRMED);
  const incomplete = scored.filter((s) => s.mustResult.result === MUST_RESULT.INCOMPLETE);

  const toCards = (group) => {
    const byId = new Map(group.map((s) => [String(s.course.id), s]));
    return rankWithPaidPriority(group.map((s) => s.candidate))
      .slice(0, RESULT_LIMIT)
      .map((ranked) => {
        const entry = byId.get(String(ranked.courseId));
        return buildCard(entry.course, ranked, entry.mustResult, context, now, { wishes: parsed.wishes, musts });
      });
  };

  const results = toCards(confirmed);
  const incompleteResults = toCards(incomplete);
  const belowThreshold = scored.filter((s) => s.candidate.score < MIN_SCORE).length;

  return {
    criteria: {
      terms: parsed.terms,
      wishes: parsed.wishes,
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
      belowThreshold,
    },
    method: {
      retrieval: semanticUsed
        ? 'lexikalisch + Bedeutungssuche (Titel + vollständige Beschreibungen)'
        : 'lexikalisch (Titel + vollständige Beschreibungen)',
      semantic: semanticUsed,
      ranking: lunaUsed ? 'Luna-Bewertung mit belegten Zitaten' : 'Textpassung (Ersatz bis zur Luna-Freigabe)',
      luna: lunaUsed,
    },
  };
}
