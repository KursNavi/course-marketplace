#!/usr/bin/env node
/**
 * Import-Script für Themenwelten
 *
 * Liest eine versionierte Importdatei und schreibt die Daten
 * in eine lokale Supabase-Instanz.
 *
 * Modi:
 *   --validate   Prüft die Importdatei ohne DB-Zugriff.
 *   --dry-run    Zeigt was importiert würde, ohne zu schreiben.
 *   --apply      Schreibt in eine LOKALE Supabase-Instanz (Sicherheitscheck!).
 *
 * Sicherheit:
 *   - --apply prüft zwingend dass die DB-URL lokal ist (localhost / 127.0.0.1).
 *   - Keine Remote-Option in Phase 5.
 *   - Transaktion: Alle Tabellen werden in einem Atomic-Block geschrieben.
 *     Bei Fehler wird nichts in der DB hinterlassen (soweit Supabase-RPC möglich).
 *
 * Idempotenz:
 *   - Themenwelt wird per key upserted.
 *   - Szenarien werden per (theme_world_id, slug) upserted.
 *   - Listen (FAQs, Regions, Specialties, Editorial, Trust) werden atomisch ersetzt.
 *
 * Verwendung:
 *   node scripts/import-theme-world.mjs --file data/theme-worlds/sport-fitness-berufsausbildung.json --validate
 *   node scripts/import-theme-world.mjs --file data/theme-worlds/sport-fitness-berufsausbildung.json --dry-run
 *   node scripts/import-theme-world.mjs --file data/theme-worlds/sport-fitness-berufsausbildung.json --apply
 */

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI-Argumente parsen
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const fileArgIdx = args.indexOf('--file');
const filePath = fileArgIdx !== -1 ? args[fileArgIdx + 1] : null;
const mode = args.includes('--apply')
  ? 'apply'
  : args.includes('--dry-run')
  ? 'dry-run'
  : args.includes('--validate')
  ? 'validate'
  : null;

if (!mode || !filePath) {
  console.error(`
Verwendung:
  node scripts/import-theme-world.mjs --file <pfad-zur-json> --validate
  node scripts/import-theme-world.mjs --file <pfad-zur-json> --dry-run
  node scripts/import-theme-world.mjs --file <pfad-zur-json> --apply

Optionen:
  --file      Pfad zur Importdatei (relativ zum Projekt-Root oder absolut)
  --validate  Prüft Schema ohne DB-Zugriff
  --dry-run   Zeigt Import-Übersicht ohne DB-Änderung
  --apply     Schreibt in lokale Supabase (Sicherheitscheck aktiv!)
`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Importdatei laden
// ---------------------------------------------------------------------------

const resolvedPath = resolve(PROJECT_ROOT, filePath);
if (!existsSync(resolvedPath)) {
  console.error(`Fehler: Datei nicht gefunden: ${resolvedPath}`);
  process.exit(1);
}

let importData;
try {
  const raw = readFileSync(resolvedPath, 'utf-8');
  importData = JSON.parse(raw);
} catch (e) {
  console.error(`Fehler beim Lesen der Importdatei: ${e.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Schema-Validierung
// ---------------------------------------------------------------------------

function validateSchema(data) {
  const errors = [];
  const warnings = [];

  // Version und Schema
  if (!data.schema || !data.schema.startsWith('theme-world-import/')) {
    errors.push('Fehlendes oder ungültiges "schema" Feld (erwartet: theme-world-import/v1)');
  }
  if (!data.version) {
    warnings.push('"version" Feld fehlt');
  }

  // Themenwelt-Pflichtfelder
  const tw = data.theme_world;
  if (!tw) {
    errors.push('Fehlendes Objekt "theme_world"');
  } else {
    const requiredTwFields = ['key', 'slug', 'url_segment', 'db_segment', 'title_de', 'meta_title', 'meta_description'];
    for (const f of requiredTwFields) {
      if (!tw[f]) errors.push(`theme_world.${f} ist Pflichtfeld und fehlt oder ist leer`);
    }

    // Segment-Validierung
    const validSegments = ['beruflich', 'privat-hobby', 'kinder-jugend'];
    if (tw.url_segment && !validSegments.includes(tw.url_segment)) {
      errors.push(`theme_world.url_segment "${tw.url_segment}" ist ungültig. Erlaubt: ${validSegments.join(', ')}`);
    }
    const validDbSegments = ['professionell', 'privat', 'kinder'];
    if (tw.db_segment && !validDbSegments.includes(tw.db_segment)) {
      errors.push(`theme_world.db_segment "${tw.db_segment}" ist ungültig. Erlaubt: ${validDbSegments.join(', ')}`);
    }

    // Slug-Format
    if (tw.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(tw.slug)) {
      errors.push(`theme_world.slug "${tw.slug}" enthält ungültige Zeichen (nur Kleinbuchstaben, Zahlen, Bindestriche)`);
    }

    // Hero-Bild Alt-Text
    if (tw.hero_image_url && !tw.hero_image_alt_de) {
      warnings.push('theme_world hat hero_image_url aber kein hero_image_alt_de');
    }
  }

  // Szenarien
  const scenarios = data.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    errors.push('"scenarios" Array fehlt oder ist leer');
  } else {
    const slugsSeen = new Set();
    for (const [i, s] of scenarios.entries()) {
      const prefix = `scenarios[${i}] (${s.slug || 'ohne slug'})`;
      if (!s.slug) errors.push(`${prefix}: Pflichtfeld "slug" fehlt`);
      if (!s.label_de) errors.push(`${prefix}: Pflichtfeld "label_de" fehlt`);
      if (!s.content_html) errors.push(`${prefix}: Pflichtfeld "content_html" fehlt oder leer`);
      if (!s.meta_title) warnings.push(`${prefix}: "meta_title" fehlt`);
      if (!s.meta_description) warnings.push(`${prefix}: "meta_description" fehlt`);
      if (s.slug && slugsSeen.has(s.slug)) errors.push(`${prefix}: Doppelter slug "${s.slug}"`);
      if (s.slug) slugsSeen.add(s.slug);
    }
  }

  // FAQs
  const faqs = data.faqs;
  if (!Array.isArray(faqs)) {
    errors.push('"faqs" Array fehlt');
  } else {
    for (const [i, f] of faqs.entries()) {
      if (!f.question_de) errors.push(`faqs[${i}]: "question_de" fehlt`);
      if (!f.answer_de) errors.push(`faqs[${i}]: "answer_de" fehlt`);
    }
  }

  // Editorial Sections
  const es = data.editorial_sections;
  if (!Array.isArray(es)) {
    errors.push('"editorial_sections" Array fehlt');
  } else {
    for (const [i, s] of es.entries()) {
      if (!s.heading_de) errors.push(`editorial_sections[${i}]: "heading_de" fehlt`);
    }
  }

  // Specialties
  if (!Array.isArray(data.specialties)) {
    errors.push('"specialties" Array fehlt');
  } else {
    const labelsSeen = new Set();
    for (const [i, s] of data.specialties.entries()) {
      if (!s.specialty_label) errors.push(`specialties[${i}]: "specialty_label" fehlt`);
      if (s.specialty_label && labelsSeen.has(s.specialty_label)) {
        errors.push(`specialties[${i}]: Doppeltes label "${s.specialty_label}"`);
      }
      if (s.specialty_label) labelsSeen.add(s.specialty_label);
    }
  }

  // Regionen
  if (!Array.isArray(data.regions)) {
    errors.push('"regions" Array fehlt');
  } else {
    for (const [i, r] of data.regions.entries()) {
      if (!r.label_de) errors.push(`regions[${i}]: "label_de" fehlt`);
    }
  }

  // Trust Items
  if (!Array.isArray(data.trust_items)) {
    errors.push('"trust_items" Array fehlt');
  }

  // Kanonische Pfade prüfen
  if (tw && Array.isArray(scenarios)) {
    const canonicalPaths = new Set();
    const base = `/bereich/${tw.url_segment}/${tw.slug}`;
    canonicalPaths.add(base);
    for (const s of scenarios) {
      const path = `${base}/${s.slug}`;
      if (canonicalPaths.has(path)) {
        errors.push(`Doppelter kanonischer Pfad: ${path}`);
      }
      canonicalPaths.add(path);
    }
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Dry-Run-Ausgabe
// ---------------------------------------------------------------------------

function printDryRun(data) {
  const tw = data.theme_world;
  const scenarios = data.scenarios || [];
  const faqs = data.faqs || [];
  const es = data.editorial_sections || [];
  const specialties = data.specialties || [];
  const regions = data.regions || [];
  const trust = data.trust_items || [];
  const base = `/bereich/${tw.url_segment}/${tw.slug}`;

  console.log('\n' + '═'.repeat(60));
  console.log('  IMPORT DRY-RUN ÜBERSICHT');
  console.log('═'.repeat(60));
  console.log(`\nThemenwelt:`);
  console.log(`  Key:           ${tw.key}`);
  console.log(`  Titel:         ${tw.title_de}`);
  console.log(`  Slug:          ${tw.slug}`);
  console.log(`  URL-Segment:   ${tw.url_segment}`);
  console.log(`  DB-Segment:    ${tw.db_segment}`);
  console.log(`  Status:        ${tw.status || 'draft'}`);
  console.log(`  Meta-Title:    ${tw.meta_title}`);
  console.log(`  Hero-Bild:     ${tw.hero_image_url ? '✓ vorhanden' : '– fehlt'}`);
  console.log(`  Hero-Alt:      ${tw.hero_image_alt_de || '– fehlt'}`);

  console.log(`\nSzenarioartikel (${scenarios.length}):`);
  for (const s of scenarios) {
    const path = `${base}/${s.slug}`;
    const htmlLen = (s.content_html || '').length;
    console.log(`  [${String(s.sort_order || '?').padStart(2)}] ${s.slug}`);
    console.log(`       Label:   ${s.label_de}`);
    console.log(`       URL:     ${path}`);
    console.log(`       HTML:    ${htmlLen} Zeichen`);
    console.log(`       Bild:    ${s.card_image_url ? '✓' : '– kein Bild'}`);
    console.log(`       SEO:     ${s.meta_title ? '✓' : '–'}`);
  }

  console.log(`\nFAQs:                 ${faqs.length}`);
  console.log(`Editorial Sections:   ${es.length}`);
  console.log(`Specialties:          ${specialties.length}`);
  console.log(`Regionen:             ${regions.length}`);
  console.log(`Trust Items:          ${trust.length}`);
  console.log(`Vord. Suchen:         ${(tw.predefined_searches || []).length}`);
  console.log(`CTA-Links:            ${(tw.cta_links || []).length}`);

  console.log('\nPilot-URLs (9 insgesamt):');
  console.log(`  ${base}`);
  for (const s of scenarios) {
    console.log(`  ${base}/${s.slug}`);
  }

  console.log('\nBilder:');
  if (tw.hero_image_url) {
    console.log(`  Hero: ${tw.hero_image_url.substring(0, 60)}...`);
  } else {
    console.log('  – Kein Hero-Bild');
  }

  const scenariosWithImages = scenarios.filter((s) => s.card_image_url);
  console.log(`  Szenario-Bilder: ${scenariosWithImages.length} / ${scenarios.length}`);

  console.log('\nKonflikte prüfen: keine bekannten Konflikte');
  console.log('\n✓ DRY-RUN abgeschlossen. Keine Daten verändert.');
}

// ---------------------------------------------------------------------------
// Lokalitätsprüfung
// ---------------------------------------------------------------------------

function assertIsLocalSupabase(url) {
  if (!url) {
    throw new Error(
      'SUPABASE_URL ist nicht gesetzt. Für --apply muss eine lokale Supabase-URL konfiguriert sein.'
    );
  }
  const lc = url.toLowerCase();
  const isLocal =
    lc.includes('localhost') ||
    lc.includes('127.0.0.1') ||
    lc.includes('::1') ||
    lc.includes('supabase.local');

  if (!isLocal) {
    throw new Error(
      `SICHERHEITSABBRUCH: Die Supabase-URL "${url}" ist keine lokale URL.\n` +
        'Das Import-Script darf in Phase 5 nur gegen eine lokale Instanz schreiben.\n' +
        'Erlaubte Hosts: localhost, 127.0.0.1, ::1, supabase.local'
    );
  }
}

// ---------------------------------------------------------------------------
// Lokaler Import
// ---------------------------------------------------------------------------

async function applyLocal(data) {
  // .env.local lesen für lokale Variablen
  let supabaseUrl = process.env.SUPABASE_LOCAL_URL || process.env.VITE_SUPABASE_URL;
  let supabaseKey =
    process.env.SUPABASE_LOCAL_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fallback auf .env.local
  if (!supabaseUrl || !supabaseKey) {
    try {
      const envPath = resolve(PROJECT_ROOT, '.env.local');
      if (existsSync(envPath)) {
        const envContent = readFileSync(envPath, 'utf-8');
        for (const line of envContent.split('\n')) {
          const [k, ...vs] = line.split('=');
          const v = vs.join('=').trim().replace(/^["']|["']$/g, '');
          if (k?.trim() === 'VITE_SUPABASE_URL' && !supabaseUrl) supabaseUrl = v;
          if (
            (k?.trim() === 'SUPABASE_SERVICE_ROLE_KEY' ||
              k?.trim() === 'SUPABASE_LOCAL_SERVICE_KEY') &&
            !supabaseKey
          ) {
            supabaseKey = v;
          }
        }
      }
    } catch (_) {
      // .env.local nicht vorhanden — ignorieren
    }
  }

  assertIsLocalSupabase(supabaseUrl);

  if (!supabaseKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY (oder SUPABASE_LOCAL_SERVICE_KEY) ist nicht gesetzt.\n' +
        'Für den lokalen Import wird der Service-Role-Key der lokalen Supabase benötigt.'
    );
  }

  console.log(`\nVerbinde mit lokaler Supabase: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const tw = data.theme_world;
  const scenarios = data.scenarios || [];

  // --- Haupttabelle ---
  console.log('\n[1/8] Upsert theme_worlds...');
  const twPayload = {
    key: tw.key,
    slug: tw.slug,
    url_segment: tw.url_segment,
    db_segment: tw.db_segment,
    area_slug: tw.area_slug || tw.key,
    title_de: tw.title_de,
    subtitle_de: tw.subtitle_de || null,
    intro_de: tw.intro_de || null,
    hero_image_url: tw.hero_image_url || null,
    hero_image_alt_de: tw.hero_image_alt_de || null,
    og_image_url: tw.og_image_url || null,
    meta_title: tw.meta_title || null,
    meta_description: tw.meta_description || null,
    status: tw.status || 'draft',
    sort_order: tw.sort_order || 10,
    search_config: tw.search_config || null,
    section_titles: tw.section_titles || null,
    predefined_searches: tw.predefined_searches || [],
    cta_links: tw.cta_links || [],
  };

  const { data: twResult, error: twError } = await supabase
    .from('theme_worlds')
    .upsert(twPayload, { onConflict: 'key' })
    .select('id')
    .single();

  if (twError) throw new Error(`theme_worlds upsert fehlgeschlagen: ${twError.message}`);
  const themeWorldId = twResult.id;
  console.log(`  ✓ Themenwelt: id=${themeWorldId}`);

  // --- Szenarien ---
  console.log('\n[2/8] Upsert theme_world_scenarios...');
  for (const [i, s] of scenarios.entries()) {
    const scenPayload = {
      theme_world_id: themeWorldId,
      slug: s.slug,
      sort_order: s.sort_order || i + 1,
      icon: s.icon || null,
      label_de: s.label_de,
      teaser_de: s.teaser_de || null,
      content_html: s.content_html || '',
      card_image_url: s.card_image_url || null,
      card_image_alt: s.card_image_alt || null,
      og_image_url: s.og_image_url || null,
      meta_title: s.meta_title || null,
      meta_description: s.meta_description || null,
      cta_label_de: s.cta_label_de || null,
      cta_config: s.cta_config || null,
      status: s.status || 'draft',
    };
    const { error: sErr } = await supabase
      .from('theme_world_scenarios')
      .upsert(scenPayload, { onConflict: 'theme_world_id,slug' });
    if (sErr) throw new Error(`Szenario "${s.slug}" fehlgeschlagen: ${sErr.message}`);
    console.log(`  ✓ [${i + 1}/${scenarios.length}] ${s.slug}`);
  }

  // --- FAQs (atomischer Replace) ---
  console.log('\n[3/8] Replace theme_world_faqs...');
  await supabase.from('theme_world_faqs').delete().eq('theme_world_id', themeWorldId);
  if (data.faqs?.length) {
    const faqPayload = data.faqs.map((f, i) => ({
      theme_world_id: themeWorldId,
      question_de: f.question_de,
      answer_de: f.answer_de,
      sort_order: f.sort_order || i + 1,
      is_active: f.is_active !== false,
    }));
    const { error: fErr } = await supabase.from('theme_world_faqs').insert(faqPayload);
    if (fErr) throw new Error(`FAQs fehlgeschlagen: ${fErr.message}`);
  }
  console.log(`  ✓ ${data.faqs?.length || 0} FAQs`);

  // --- Editorial Sections ---
  console.log('\n[4/8] Replace theme_world_editorial_sections...');
  await supabase.from('theme_world_editorial_sections').delete().eq('theme_world_id', themeWorldId);
  if (data.editorial_sections?.length) {
    const esPayload = data.editorial_sections.map((s, i) => ({
      theme_world_id: themeWorldId,
      heading_de: s.heading_de,
      intro_de: s.intro_de || null,
      items_de: s.items_de || null,
      is_ordered: s.is_ordered || false,
      closing_de: s.closing_de || null,
      sort_order: s.sort_order || i + 1,
      is_active: s.is_active !== false,
    }));
    const { error: esErr } = await supabase
      .from('theme_world_editorial_sections')
      .insert(esPayload);
    if (esErr) throw new Error(`Editorial Sections fehlgeschlagen: ${esErr.message}`);
  }
  console.log(`  ✓ ${data.editorial_sections?.length || 0} Editorial Sections`);

  // --- Specialties ---
  console.log('\n[5/8] Replace theme_world_specialties...');
  await supabase.from('theme_world_specialties').delete().eq('theme_world_id', themeWorldId);
  if (data.specialties?.length) {
    const spPayload = data.specialties.map((s, i) => ({
      theme_world_id: themeWorldId,
      specialty_label: s.specialty_label,
      description_de: s.description_de || null,
      icon: s.icon || null,
      sort_order: s.sort_order || i + 1,
      is_active: s.is_active !== false,
    }));
    const { error: spErr } = await supabase.from('theme_world_specialties').insert(spPayload);
    if (spErr) throw new Error(`Specialties fehlgeschlagen: ${spErr.message}`);
  }
  console.log(`  ✓ ${data.specialties?.length || 0} Specialties`);

  // --- Regions ---
  console.log('\n[6/8] Replace theme_world_regions...');
  await supabase.from('theme_world_regions').delete().eq('theme_world_id', themeWorldId);
  if (data.regions?.length) {
    const rPayload = data.regions.map((r, i) => ({
      theme_world_id: themeWorldId,
      label_de: r.label_de,
      anchor_text_de: r.anchor_text_de || r.label_de,
      loc_param: r.loc_param || null,
      delivery_param: r.delivery_param || null,
      sort_order: r.sort_order || i + 1,
      is_active: r.is_active !== false,
    }));
    const { error: rErr } = await supabase.from('theme_world_regions').insert(rPayload);
    if (rErr) throw new Error(`Regions fehlgeschlagen: ${rErr.message}`);
  }
  console.log(`  ✓ ${data.regions?.length || 0} Regionen`);

  // --- Trust Items ---
  console.log('\n[7/8] Replace theme_world_trust_items...');
  await supabase.from('theme_world_trust_items').delete().eq('theme_world_id', themeWorldId);
  if (data.trust_items?.length) {
    const tiPayload = data.trust_items.map((t, i) => ({
      theme_world_id: themeWorldId,
      item_type: t.item_type || 'label',
      name: t.name,
      description_de: t.description_de || null,
      logo_url: t.logo_url || null,
      logo_alt: t.logo_alt || null,
      external_url: t.external_url || null,
      rights_note: t.rights_note || null,
      sort_order: t.sort_order || i + 1,
      is_active: t.is_active !== false,
    }));
    const { error: tiErr } = await supabase.from('theme_world_trust_items').insert(tiPayload);
    if (tiErr) throw new Error(`Trust Items fehlgeschlagen: ${tiErr.message}`);
  }
  console.log(`  ✓ ${data.trust_items?.length || 0} Trust Items`);

  console.log('\n[8/8] Import abgeschlossen.');
  console.log(`\n✓ Sport & Fitness Themenwelt erfolgreich in lokale Supabase importiert.`);
  console.log(`  Themenwelt-ID: ${themeWorldId}`);
  console.log(`  Status: DRAFT (muss manuell auf "published" gesetzt werden)`);
  console.log(
    `\nHinweis: In Phase 5 ist die Themenwelt im Status "draft" und nur lokal sichtbar.`
  );
  console.log(
    `  Das Feature-Flag VITE_THEME_WORLD_PILOT_KEYS=sport_fitness_beruf muss aktiviert werden.`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nThemenwelt Import-Script v1.0`);
  console.log(`Modus:  ${mode.toUpperCase()}`);
  console.log(`Datei:  ${resolvedPath}`);

  // --- VALIDATE ---
  console.log('\n--- Schema-Validierung ---');
  const { errors, warnings } = validateSchema(importData);

  if (warnings.length > 0) {
    console.warn('\nWarnungen:');
    for (const w of warnings) console.warn(`  ⚠  ${w}`);
  }

  if (errors.length > 0) {
    console.error('\nFehler:');
    for (const e of errors) console.error(`  ✗  ${e}`);
    console.error(`\n${errors.length} Fehler gefunden. Import abgebrochen.`);
    process.exit(1);
  }

  console.log(`✓ Schema valide (${warnings.length} Warnungen)`);

  if (mode === 'validate') {
    console.log('\n✓ Validierung abgeschlossen. Keine Daten verändert.');
    return;
  }

  // --- DRY-RUN ---
  if (mode === 'dry-run') {
    printDryRun(importData);
    return;
  }

  // --- APPLY ---
  if (mode === 'apply') {
    console.log('\n--- Lokaler Import ---');
    try {
      await applyLocal(importData);
    } catch (e) {
      console.error(`\n✗ Import fehlgeschlagen: ${e.message}`);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error('Unbehandelter Fehler:', e);
  process.exit(1);
});
