/**
 * Admin-Formular für Themenwelten (9 Tabs).
 * Jeder Tab speichert seinen Bereich separat.
 * Pro Tab: Speicherstatus, ungespeicherte-Änderungen-Warnung.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Save, Loader, AlertCircle, ChevronRight } from 'lucide-react';
import AdminStatusBadge from './AdminStatusBadge';
import AdminSaveState from './AdminSaveState';
import AdminSeoFields from './AdminSeoFields';
import AdminImageField from './AdminImageField';
import AdminRichTextEditor from './AdminRichTextEditor';
import {
  getThemeWorld, createThemeWorld, updateThemeWorld,
  getAllSubEntities, replaceFaqs, replaceEditorialSections,
  replaceSpecialties, replaceRegions, replaceTrustItems,
  getErrorMessage, ApiError,
} from '../../lib/themeWorldAdminApi';
import { SEGMENT_FALLBACK_HERO_IMAGES } from '../../lib/themeWorldAdapter';
import { useTaxonomy } from '../../hooks/useTaxonomy';
import { SWISS_CANTONS } from '../../lib/constants';
import { normalizePredefinedSearches } from '../../lib/themeWorldAdminUtils';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'grundlagen', label: 'Grundlagen' },
  { id: 'bilder-seo', label: 'Bilder & SEO' },
  { id: 'suche', label: 'Suche' },
  { id: 'kursbereiche', label: 'Kursbereiche' },
  { id: 'regionen', label: 'Regionen' },
  { id: 'editorial', label: 'Redaktionell' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'trust', label: 'Trust & Hinweise' },
  { id: 'szenarien', label: 'Szenarioartikel' },
];

const SEGMENTS = [
  { value: 'beruflich', dbValue: 'professionell', label: 'Beruflich' },
  { value: 'privat-hobby', dbValue: 'privat', label: 'Privat & Hobby' },
  { value: 'kinder-jugend', dbValue: 'kinder', label: 'Kinder & Jugend' },
];

const URL_TO_DB = { beruflich: 'professionell', 'privat-hobby': 'privat', 'kinder-jugend': 'kinder' };
const DB_TO_URL = { professionell: 'beruflich', privat: 'privat-hobby', kinder: 'kinder-jugend' };

/**
 * Obergrenze für zusätzliche CTA-Links. Spiegelt MAX_CTA_LINKS in
 * api/_lib/theme-world-validate.js — der Server bleibt die verbindliche Instanz,
 * diese Konstante verhindert nur, dass die Redaktion in einen Serverfehler läuft.
 */
const MAX_CTA_LINKS = 5;

/**
 * Die im Tab «Seitentexte & Abschluss / CTA» bearbeitbaren section_titles-Keys,
 * in Anzeigereihenfolge und nach Abschnitt gruppiert.
 *
 * Bis hierher waren nur trust_heading, cta_heading und cta_button exponiert. Die
 * übrigen Überschriften kamen ausschliesslich über den Import in die Datenbank
 * und liessen sich danach nirgends mehr korrigieren — für eine redaktionell
 * gepflegte Themenwelt ein Sackgassenzustand.
 *
 * Nicht exponiert bleibt searches_heading: der Key ist im Validator erlaubt, wird
 * aber von keiner Themenwelt geführt. Er überlebt trotzdem jeden Speichervorgang,
 * weil der Merge auf dem vollständigen geladenen Objekt aufsetzt.
 */
const SEITENTEXTE_GROUPS = [
  {
    title: 'Szenarioartikel',
    hint: 'Überschriften über den Szenariokarten der öffentlichen Themenwelt.',
    fields: [
      { key: 'scenarios_heading', label: 'Überschrift', placeholder: 'z.B. Welche Richtung passt zu dir?' },
      { key: 'scenarios_subheading', label: 'Unterzeile', placeholder: 'z.B. Finde den passenden Einstieg.' },
    ],
  },
  {
    title: 'Kursbereiche',
    hint: 'Überschriften über den Kursbereichen (Specialties).',
    fields: [
      { key: 'specialties_heading', label: 'Überschrift', placeholder: 'z.B. Kursbereiche' },
      { key: 'specialties_subheading', label: 'Unterzeile', placeholder: 'z.B. Alle Schwerpunkte auf einen Blick.' },
    ],
  },
  {
    title: 'Vordefinierte Suchen',
    hint: 'Unterzeile über den vordefinierten Suchen.',
    fields: [
      { key: 'searches_subheading', label: 'Unterzeile', placeholder: 'z.B. Kurse nach Technik und Region.' },
    ],
  },
  {
    title: 'Regionen',
    hint: 'Überschriften über den Regionenlinks.',
    fields: [
      { key: 'regions_heading', label: 'Überschrift', placeholder: 'z.B. Kurse in deiner Region' },
      { key: 'regions_subheading', label: 'Unterzeile', placeholder: 'z.B. Aktuelle Präsenzangebote nach Region.' },
    ],
  },
  {
    title: 'Häufige Fragen',
    hint: 'Überschrift über dem FAQ-Abschnitt.',
    fields: [
      { key: 'faqs_heading', label: 'Überschrift', placeholder: 'z.B. Häufige Fragen zu Kreativkursen' },
    ],
  },
];

/** Flache Liste aller exponierten Keys — inklusive der drei CTA-/Trust-Felder. */
const SEITENTEXTE_KEYS = [
  ...SEITENTEXTE_GROUPS.flatMap((group) => group.fields.map((field) => field.key)),
  'trust_heading',
  'cta_heading',
  'cta_button',
];

function emptySeitentexte() {
  return Object.fromEntries(SEITENTEXTE_KEYS.map((key) => [key, '']));
}

/**
 * Bringt section_titles in die Formularform.
 *
 * Ein fehlender Key und ein ausdrückliches null erscheinen beide als leeres
 * Eingabefeld — sichtbar gibt es keinen Unterschied. Damit das Speichern die
 * beiden Zustände trotzdem nicht vermischt, merkt sich `buildSectionTitles` den
 * Ausgangswert und schreibt ihn unverändert zurück, solange die Redaktion das
 * Feld nicht angefasst hat.
 */
function sectionTitlesToForm(sectionTitles) {
  const source = sectionTitles || {};
  return Object.fromEntries(
    SEITENTEXTE_KEYS.map((key) => [key, typeof source[key] === 'string' ? source[key] : '']),
  );
}

/**
 * Baut das zu speichernde section_titles-Objekt.
 *
 * Regeln, in dieser Reihenfolge:
 *   1. Basis ist das vollständige geladene Objekt — nicht exponierte Keys
 *      bleiben unangetastet.
 *   2. Ein unverändertes Feld wird exakt so zurückgeschrieben, wie es geladen
 *      wurde. Ein null bleibt null, ein fehlender Key bleibt fehlend, ein
 *      gespeicherter Leerstring bleibt Leerstring. Kein Zustand wird
 *      stillschweigend in einen anderen überführt.
 *   3. Ein geändertes Feld mit Inhalt wird getrimmt gespeichert.
 *   4. Ein von der Redaktion aktiv geleertes Feld entfernt seinen Key — das ist
 *      die ausdrückliche Ansage «diese Überschrift soll weg», und der Adapter
 *      greift dann auf seinen Vorgabetext zurück.
 *
 * @param {object} base - vollständiges section_titles der geladenen Zeile
 * @param {object} form - aktuelle Formularwerte (nur exponierte Keys)
 * @param {object} loadedForm - Formularwerte direkt nach dem Laden
 */
function buildSectionTitles(base, form, loadedForm) {
  const next = { ...(base || {}) };

  for (const key of SEITENTEXTE_KEYS) {
    const current = form[key] || '';
    const original = loadedForm[key] || '';

    if (current === original) continue; // unverändert ⅒ Ausgangszustand behalten

    const trimmed = current.trim();
    if (trimmed) next[key] = trimmed;
    else delete next[key];
  }

  return next;
}

/**
 * Bringt cta_links in die Formularform.
 *
 * spec und focus waren bisher nicht abgebildet: ein importierter Link verlor
 * seine Fachrichtung beim ersten Speichern im Admin. sort_order und status sind
 * nicht bearbeitbar, werden aber mitgeführt, damit der Speicherpfad das
 * Importpaket nicht beschneidet.
 */
function ctaLinksToForm(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((link) => link && typeof link === 'object' && !Array.isArray(link))
    .map((link) => ({
      label_de: link.label_de || '',
      spec: link.spec || '',
      focus: link.focus || '',
      loc: link.loc || '',
      delivery: link.delivery || '',
      kursart: link.kursart || '',
      // null-fähig mitgeführt, nicht bearbeitbar:
      hadSortOrder: Number.isInteger(link.sort_order),
      status: typeof link.status === 'string' ? link.status : null,
    }));
}

/**
 * Baut das zu speichernde cta_links-Array.
 *
 * Die Array-Position ist die Anzeigereihenfolge. Ein Eintrag, der beim Laden
 * eine sort_order führte, bekommt sie positionsgerecht neu vergeben — so bleibt
 * der Wert wahr, auch wenn die Redaktion Einträge entfernt hat. Einträge ohne
 * sort_order bekommen keine dazuerfunden.
 */
function formToCtaLinks(rows) {
  return (rows || []).map((row, index) => ({
    label_de: (row.label_de || '').trim(),
    ...(row.spec && row.spec.trim() ? { spec: row.spec.trim() } : {}),
    ...(row.focus && row.focus.trim() ? { focus: row.focus.trim() } : {}),
    ...(row.loc && row.loc.trim() ? { loc: row.loc.trim() } : {}),
    ...(row.delivery ? { delivery: row.delivery } : {}),
    ...(row.kursart && row.kursart.trim() ? { kursart: row.kursart.trim() } : {}),
    ...(row.hadSortOrder ? { sort_order: index + 1 } : {}),
    ...(row.status ? { status: row.status } : {}),
  }));
}

/**
 * Gemeinsame Gestaltung aller `.FormInput`-Felder dieses Formulars.
 *
 * Wird als Klassenliste auf einen Container gesetzt und wirkt über
 * Descendant-Varianten auf jedes `.FormInput` darin. Bewusst kein globales CSS
 * und keine `.FormInput`-Regel ausserhalb dieses Formulars: die Klasse existiert
 * nur hier, andere Admin-Bereiche bleiben unberührt.
 *
 * Angewendet wird der Scope an genau zwei Stellen — `FormField` (Einzelfelder)
 * und die Karten von `RepeatableList`. Vorher galt er nur in `FormField`, weshalb
 * die Felder in den Listenkarten ohne Rand, Hintergrund und Innenabstand
 * gerendert wurden.
 */
const FORM_INPUT_SCOPE = [
  '[&_.FormInput]:block',
  '[&_.FormInput]:w-full',
  '[&_.FormInput]:px-3',
  '[&_.FormInput]:py-2',
  '[&_.FormInput]:border',
  '[&_.FormInput]:border-gray-300',
  '[&_.FormInput]:bg-white',
  '[&_.FormInput]:text-gray-900',
  '[&_.FormInput]:rounded-lg',
  '[&_.FormInput]:text-sm',
  '[&_.FormInput]:leading-normal',
  '[&_.FormInput]:shadow-sm',
  '[&_.FormInput]:outline-none',
  '[&_.FormInput]:transition',
  '[&_.FormInput]:placeholder:text-gray-400',
  // Pseudo-Klassen gehören in die Arbitrary-Variant hinein: `[&_.FormInput]:focus:*`
  // erzeugt `.scope:focus .FormInput` — der Fokus läge auf dem Container-DIV, das
  // nie fokussiert oder disabled ist. `[&_.FormInput:focus]:*` trifft das Feld selbst.
  '[&_.FormInput:focus]:ring-2',
  '[&_.FormInput:focus]:ring-teal-500',
  '[&_.FormInput:focus]:border-teal-500',
  '[&_.FormInput:disabled]:bg-gray-100',
  '[&_.FormInput:disabled]:text-gray-500',
  '[&_.FormInput:disabled]:border-gray-200',
  '[&_.FormInput:disabled]:cursor-not-allowed',
  // Select: Platz für den nativen Pfeil, damit lange Optionstexte nicht darunter laufen.
  '[&_select.FormInput]:pr-9',
  '[&_textarea.FormInput]:leading-relaxed',
].join(' ');

/** Optionen für alle Standortfelder — dieselbe Liste wie die öffentliche Suche. */
const LOCATION_OPTIONS = SWISS_CANTONS;

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Þ/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Anzeigelabel einer Taxonomie-Zeile. */
function rowLabel(row) {
  return (row?.label_de || row?.name || '').trim();
}

/** Eindeutige, alphabetisch sortierte Labels aus einer Taxonomie-Liste. */
function toLabelOptions(rows) {
  const labels = new Set();
  for (const row of rows || []) {
    const label = rowLabel(row);
    if (label) labels.add(label);
  }
  return Array.from(labels).sort((a, b) => a.localeCompare(b, 'de'));
}

/** level2-Zuordnung einer Specialty — je nach Quelle level2_id oder area_id. */
function specialtyAreaId(specialty) {
  return specialty?.level2_id ?? specialty?.area_id ?? null;
}

/** level3-Zuordnung eines Fokus — je nach Quelle level3_id oder specialty_id. */
function focusSpecialtyId(focus) {
  return focus?.level3_id ?? focus?.specialty_id ?? null;
}

/**
 * Ableitung der Taxonomie-Optionen für die Selects dieses Formulars.
 *
 * Alle Werte stammen aus useTaxonomy() — es wird keine eigene Optionsliste
 * gepflegt. Die Funktion ist bewusst tolerant: fehlt die Taxonomie oder lässt
 * sich der area_slug nicht eindeutig auflösen, liefert sie leere bzw.
 * unbeschränkte Listen statt zu werfen.
 */
function buildTaxonomyOptions({ areas, specialties, focuses, areaSlug }) {
  const allAreas = Array.isArray(areas) ? areas : [];
  const allSpecialties = Array.isArray(specialties) ? specialties : [];
  const allFocuses = Array.isArray(focuses) ? focuses : [];

  // Eindeutige Area: exakt ein Treffer auf den Slug. Mehrdeutig oder unbekannt
  // → keine Einschränkung, statt eine falsche Area zu raten.
  const slug = (areaSlug || '').trim();
  const slugHits = slug ? allAreas.filter((a) => a?.slug === slug) : [];
  const area = slugHits.length === 1 ? slugHits[0] : null;

  const scopedSpecialties = area
    ? allSpecialties.filter((s) => specialtyAreaId(s) === area.id)
    : allSpecialties;

  // Fällt die Area-Einschränkung auf null Einträge zurück (z.B. Taxonomie noch
  // nicht geladen), bleiben alle Spezialgebiete wählbar — Bestandsdaten sollen
  // nie in ein leeres Select laufen.
  const specialtySource = scopedSpecialties.length > 0 ? scopedSpecialties : allSpecialties;
  const specialtyOptions = toLabelOptions(specialtySource);

  /**
   * Suchraum der Fokus-Auflösung. Bewusst NICHT `specialtySource`: dessen
   * Rückfall auf die Gesamtliste darf hier nicht greifen. Ist die Area eindeutig,
   * gilt ausschliesslich sie — sonst könnten Fokusgebiete einer fremden Area als
   * reguläre Optionen erscheinen.
   */
  const focusScope = area ? scopedSpecialties : allSpecialties;

  /**
   * Fokusgebiete eines Spezialgebiets — nur bei eindeutiger Zuordnung.
   *
   * Das Label wird im `focusScope` gesucht; angeboten werden ausschliesslich
   * level4-Einträge, deren level3_id/specialty_id auf genau diese eine Specialty
   * zeigt. Jeder andere Fall liefert bewusst eine leere Liste:
   *
   *  - 0 Treffer  (z.B. gespeicherte Specialty einer fremden Area) — kein
   *    Rückfall auf die Gesamtliste;
   *  - >1 Treffer (gleichnamige Specialties in mehreren Areas) — die Fokusgebiete
   *    werden nie vereinigt.
   *
   * Ein gespeicherter Fokus geht dadurch nicht verloren: CanonicalSelect zeigt
   * ihn weiterhin als markierten Bestandswert an.
   */
  const focusesForSpecialty = (specialtyLabel) => {
    const label = (specialtyLabel || '').trim();
    if (!label) return [];

    const matches = focusScope.filter((s) => rowLabel(s) === label);
    if (matches.length !== 1) return [];

    const specialtyId = matches[0].id;
    return toLabelOptions(
      allFocuses.filter((f) => focusSpecialtyId(f) === specialtyId),
    );
  };

  return { area, isAreaResolved: !!area, specialtyOptions, focusesForSpecialty };
}

function useSaveState() {
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [isDirty, setIsDirty] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const markDirty = useCallback(() => {
    setState('idle');
    setIsDirty(true);
  }, []);

  const startSaving = useCallback(() => {
    setState('saving');
    setErrorMsg(null);
  }, []);

  const markSaved = useCallback(() => {
    setState('saved');
    setIsDirty(false);
  }, []);

  const markError = useCallback((msg) => {
    setState('error');
    setErrorMsg(msg);
  }, []);

  const resetDirty = useCallback(() => {
    setState('idle');
    setIsDirty(false);
    setErrorMsg(null);
  }, []);

  return { state, isDirty, errorMsg, markDirty, startSaving, markSaved, markError, resetDirty };
}

// ---------------------------------------------------------------------------
// Haupt-Komponente
// ---------------------------------------------------------------------------

export default function AdminThemeWorldForm({
  showNotification,
  setView,
  themeWorldId,
  setSelectedThemeWorldId,
  setSelectedScenarioId,
}) {
  const isNew = !themeWorldId;
  const [activeTab, setActiveTab] = useState('grundlagen');
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(null);

  // Hauptdaten
  const [tw, setTw] = useState(null);
  const [savedTwId, setSavedTwId] = useState(themeWorldId || null);

  // Grundlagen
  const grundlagenSave = useSaveState();
  const [grundlagen, setGrundlagen] = useState({
    key: '', title_de: '', subtitle_de: '', intro_de: '', url_segment: '', slug: '',
  });
  const [autoSlug, setAutoSlug] = useState(true);

  // Bilder & SEO
  const bilderSave = useSaveState();
  const [bilder, setBilder] = useState({
    hero_image_url: '', hero_image_alt_de: '', og_image_url: '', og_image_alt_de: '',
    meta_title: '', meta_description: '',
  });
  // Upload-Status je Bildfeld — Speichern wird blockiert solange ein Upload läuft
  const [heroUploading, setHeroUploading] = useState(false);
  const [ogUploading, setOgUploading] = useState(false);

  // Suche
  const sucheSave = useSaveState();
  const [suche, setSuche] = useState({
    area_slug: '', kursart: '', type_key: '', default_spec: '', default_focus: '', area_label_de: '',
  });
  const [predefinedSearches, setPredefinedSearches] = useState([]);

  // Taxonomie für die Filter-Selects (Spezialgebiet / Fokus).
  // Dieselbe Quelle wie die öffentliche Suche — keine zweite Optionsliste.
  const taxonomy = useTaxonomy();
  const { specialtyOptions, focusesForSpecialty, isAreaResolved } = useMemo(
    () => buildTaxonomyOptions({
      areas: taxonomy.areas,
      specialties: taxonomy.specialties,
      focuses: taxonomy.focuses,
      areaSlug: suche.area_slug,
    }),
    [taxonomy.areas, taxonomy.specialties, taxonomy.focuses, suche.area_slug],
  );

  const specialtyHint = isAreaResolved
    ? 'Optionaler default_spec für Suche. Auswahl auf den Bereichs-Slug begrenzt.'
    : 'Optionaler default_spec für Suche. Bereichs-Slug nicht eindeutig zugeordnet — es werden alle Spezialgebiete angeboten.';

  // Kursbereiche (Specialties)
  const specialtiesSave = useSaveState();
  const [specialties, setSpecialties] = useState([]);

  // Regionen
  const regionenSave = useSaveState();
  const [regionen, setRegionen] = useState([]);

  // Editorial Sections
  const editorialSave = useSaveState();
  const [editorial, setEditorial] = useState([]);

  // FAQs
  const faqSave = useSaveState();
  const [faqs, setFaqs] = useState([]);

  // Trust Items
  const trustSave = useSaveState();
  const [trustItems, setTrustItems] = useState([]);

  // Seitentexte & Abschluss / CTA
  //
  // Eigener Speicherbereich, getrennt von den Trust Items: Trust Items liegen in
  // der Subentity-Tabelle theme_world_trust_items (replaceTrustItems = delete +
  // insert), section_titles und cta_links sind Spalten auf theme_worlds. Ein
  // gemeinsamer Klick würde bei Teilfehler einen inkonsistenten Zustand hinterlassen.
  const seitentexteSave = useSaveState();
  const [seitentexte, setSeitentexte] = useState(() => emptySeitentexte());
  // Formularwerte direkt nach dem Laden. Referenz für «unverändert» beim
  // Speichern, damit null/fehlend/Leerstring nicht vermischt werden.
  const [seitentexteLoaded, setSeitentexteLoaded] = useState(() => emptySeitentexte());
  const [ctaLinks, setCtaLinks] = useState([]);
  // Vollständiges section_titles der geladenen Zeile. Basis für den Merge beim
  // Speichern, damit nicht exponierte Keys (z.B. searches_heading) erhalten bleiben.
  const [sectionTitlesBase, setSectionTitlesBase] = useState({});

  // ---------------------------------------------------------------------------
  // Daten laden
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isNew) return;
    loadAll();
  }, [themeWorldId]);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [data, subs] = await Promise.all([
        getThemeWorld(savedTwId || themeWorldId),
        getAllSubEntities(savedTwId || themeWorldId),
      ]);
      setTw(data);

      // Grundlagen füllen
      setGrundlagen({
        key: data.key || '',
        title_de: data.title_de || '',
        subtitle_de: data.subtitle_de || '',
        intro_de: data.intro_de || '',
        url_segment: data.url_segment || '',
        slug: data.slug || '',
      });
      setAutoSlug(false);

      // Bilder & SEO
      setBilder({
        hero_image_url: data.hero_image_url || '',
        hero_image_alt_de: data.hero_image_alt_de || '',
        og_image_url: data.og_image_url || '',
        og_image_alt_de: data.og_image_alt_de || '',
        meta_title: data.meta_title || '',
        meta_description: data.meta_description || '',
      });

      // Suche
      const sc = data.search_config || {};
      setSuche({
        area_slug: sc.area_slug || data.area_slug || '',
        kursart: sc.kursart || '',
        type_key: sc.type_key || '',
        default_spec: sc.default_spec || '',
        default_focus: sc.default_focus || '',
        area_label_de: sc.area_label_de || '',
      });
      setPredefinedSearches(data.predefined_searches || []);

      // Seitentexte & CTA — kanonische snake_case-Keys aus section_titles.
      // Das vollständige Objekt bleibt Merge-Basis, damit nicht exponierte Keys
      // erhalten bleiben; zusätzlich wird der Ladezustand der exponierten Felder
      // festgehalten (siehe buildSectionTitles).
      const st = data.section_titles || {};
      const loadedSeitentexte = sectionTitlesToForm(st);
      setSectionTitlesBase(st);
      setSeitentexte(loadedSeitentexte);
      setSeitentexteLoaded(loadedSeitentexte);
      setCtaLinks(ctaLinksToForm(data.cta_links));

      // Sub-Entitäten (keys already normalized to camelCase by getAllSubEntities)
      setSpecialties(subs.specialties || []);
      setRegionen(subs.regions || []);
      setEditorial(subs.editorialSections || []);
      setFaqs(subs.faqs || []);
      setTrustItems(subs.trustItems || []);

      // Reset all dirty states after successful load — prevents phantom
      // "Ungespeicherte Änderungen" from stale state or previous sessions.
      grundlagenSave.resetDirty();
      bilderSave.resetDirty();
      sucheSave.resetDirty();
      specialtiesSave.resetDirty();
      regionenSave.resetDirty();
      editorialSave.resetDirty();
      faqSave.resetDirty();
      trustSave.resetDirty();
      seitentexteSave.resetDirty();

    } catch (err) {
      setLoadError(getErrorMessage(err, 'Daten konnten nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Auto-Slug
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!autoSlug || !grundlagen.title_de) return;

    const nextSlug = slugify(grundlagen.title_de);
    setGrundlagen((previous) => (
      previous.slug === nextSlug ? previous : { ...previous, slug: nextSlug }
    ));
  }, [grundlagen.title_de, autoSlug]);

  // ---------------------------------------------------------------------------
  // Speicherfunktionen
  // ---------------------------------------------------------------------------

  const saveGrundlagen = async () => {
    if (!grundlagen.url_segment) {
      grundlagenSave.markError('Bitte wähle ein Segment aus.');
      showNotification('Fehler: Bitte wähle ein Segment aus.');
      return;
    }
    grundlagenSave.startSaving();
    try {
      const payload = {
        key: grundlagen.key,
        title_de: grundlagen.title_de,
        subtitle_de: grundlagen.subtitle_de || null,
        intro_de: grundlagen.intro_de || null,
        url_segment: grundlagen.url_segment,
        db_segment: URL_TO_DB[grundlagen.url_segment] || null,
        slug: grundlagen.slug,
        area_slug: suche.area_slug || null,
      };

      if (isNew && !savedTwId) {
        // Safety: create mode must not have a themeWorldId prop
        if (themeWorldId) {
          throw new Error('Interner Fehler: Create-Modus hat unerwartete themeWorldId. Bitte Seite neu laden.');
        }
        const created = await createThemeWorld(payload);
        setSavedTwId(created.id);
        // Note: setSelectedThemeWorldId is intentionally NOT called here.
        // Updating App-state here would change the key prop on this component,
        // causing an unmount/remount mid-session and losing unsaved tab data.
        // The ID is propagated via savedTwId for all within-session operations.
        // When navigating to the scenario list the explicit setter is used there.
        setTw({ ...payload, id: created.id, status: 'draft', published_at: null });
        showNotification('Themenwelt erstellt.');
      } else {
        const id = savedTwId || themeWorldId;
        if (!id) {
          throw new Error('Interner Fehler: Kein ID für Update-Speicherung. Bitte Seite neu laden.');
        }
        await updateThemeWorld(id, payload);
        setTw((prev) => ({ ...prev, ...payload }));
        showNotification('Grundlagen gespeichert.');
      }

      grundlagenSave.markSaved();
    } catch (err) {
      const isConflict = err instanceof ApiError && err.isConflict;
      const msg = isConflict
        ? (err.message || 'Konflikt: Key oder Pfad wird bereits von einer anderen Themenwelt verwendet.')
        : getErrorMessage(err, 'Speichern fehlgeschlagen.');
      grundlagenSave.markError(msg);
      showNotification(`Fehler: ${msg}`);
    }
  };

  const saveBilder = async () => {
    const id = savedTwId || themeWorldId;
    if (!id) return showNotification('Bitte zuerst Grundlagen speichern.');
    if (loadError) return showNotification('Laden fehlgeschlagen — Speichern nicht möglich.');
    if (heroUploading || ogUploading) {
      return showNotification('Bild-Upload noch aktiv — bitte warte kurz und versuche erneut.');
    }
    // Sicherheitsprüfung: blob: oder data: URLs niemals in DB speichern
    const sanitizeUrl = (url) => {
      if (!url) return null;
      if (url.startsWith('blob:') || url.startsWith('data:')) return null;
      return url;
    };
    bilderSave.startSaving();
    try {
      await updateThemeWorld(id, {
        hero_image_url: sanitizeUrl(bilder.hero_image_url),
        hero_image_alt_de: bilder.hero_image_alt_de || null,
        og_image_url: sanitizeUrl(bilder.og_image_url),
        og_image_alt_de: bilder.og_image_alt_de || null,
        meta_title: bilder.meta_title || null,
        meta_description: bilder.meta_description || null,
      });
      bilderSave.markSaved();
      showNotification('Bilder & SEO gespeichert.');
    } catch (err) {
      const msg = getErrorMessage(err);
      bilderSave.markError(msg);
      showNotification(`Fehler: ${msg}`);
    }
  };

  const saveSuche = async () => {
    const id = savedTwId || themeWorldId;
    if (!id) return showNotification('Bitte zuerst Grundlagen speichern.');
    if (loadError) return showNotification('Laden fehlgeschlagen — Speichern nicht möglich.');

    // Client-side validation: predefined_searches
    if (predefinedSearches.length > 20) {
      sucheSave.markError('Maximal 20 vordefinierte Suchen erlaubt.');
      showNotification('Fehler: Maximal 20 vordefinierte Suchen erlaubt.');
      return;
    }
    for (let i = 0; i < predefinedSearches.length; i++) {
      const s = predefinedSearches[i];
      if (!s.label_de || !s.label_de.trim()) {
        sucheSave.markError(`Eintrag #${i + 1}: Bezeichnung ist Pflichtfeld.`);
        showNotification(`Fehler: Eintrag #${i + 1} — Bezeichnung ist Pflichtfeld.`);
        return;
      }
    }

    sucheSave.startSaving();
    try {
      // Normalize: strip empty optional fields from predefined_searches
      const normalizedSearches = normalizePredefinedSearches(predefinedSearches);

      await updateThemeWorld(id, {
        area_slug: suche.area_slug || null,
        search_config: {
          ...(suche.area_slug && suche.area_slug.trim() ? { area_slug: suche.area_slug.trim() } : {}),
          ...(suche.kursart ? { kursart: suche.kursart.trim() } : {}),
          ...(suche.type_key && { type_key: suche.type_key }),
          ...(suche.default_spec && { default_spec: suche.default_spec }),
          ...(suche.default_focus && { default_focus: suche.default_focus }),
          ...(suche.area_label_de && suche.area_label_de.trim() ? { area_label_de: suche.area_label_de.trim() } : {}),
        },
        predefined_searches: normalizedSearches,
      });
      sucheSave.markSaved();
      showNotification('Suchkonfiguration gespeichert.');
    } catch (err) {
      const msg = getErrorMessage(err);
      sucheSave.markError(msg);
      showNotification(`Fehler: ${msg}`);
    }
  };

  const saveSeitentexte = async () => {
    const id = savedTwId || themeWorldId;
    if (!id) return showNotification('Bitte zuerst Grundlagen speichern.');
    // Data-loss protection: ohne erfolgreichen Load ist sectionTitlesBase unvollständig,
    // ein Merge würde fremde Keys löschen.
    if (loadError) return showNotification('Laden fehlgeschlagen — Speichern nicht möglich.');

    // Client-side validation: cta_links (spiegelt validateCtaLinks)
    if (ctaLinks.length > MAX_CTA_LINKS) {
      seitentexteSave.markError(`Maximal ${MAX_CTA_LINKS} CTA-Links erlaubt.`);
      showNotification(`Fehler: Maximal ${MAX_CTA_LINKS} CTA-Links erlaubt.`);
      return;
    }
    for (let i = 0; i < ctaLinks.length; i++) {
      if (!ctaLinks[i].label_de || !ctaLinks[i].label_de.trim()) {
        seitentexteSave.markError(`CTA-Link #${i + 1}: Bezeichnung ist Pflichtfeld.`);
        showNotification(`Fehler: CTA-Link #${i + 1} — Bezeichnung ist Pflichtfeld.`);
        return;
      }
    }

    seitentexteSave.startSaving();
    try {
      // Merge statt Ersetzen: das vollständige geladene section_titles ist die
      // Basis, nur tatsächlich geänderte Felder werden angefasst. Nicht
      // exponierte Keys (searches_heading) bleiben exakt erhalten, und ein
      // unverändertes null bleibt null statt zu verschwinden.
      const nextSectionTitles = buildSectionTitles(sectionTitlesBase, seitentexte, seitentexteLoaded);

      // Normalisierung: label_de getrimmt, leere optionale Felder entfernt,
      // sort_order positionsgerecht, status unverändert durchgereicht.
      const normalizedCtaLinks = formToCtaLinks(ctaLinks);

      await updateThemeWorld(id, {
        section_titles: nextSectionTitles,
        cta_links: normalizedCtaLinks,
      });

      // Merge-Basis und Ladereferenz nachziehen, damit ein direkt folgender Save
      // nicht auf einem veralteten Stand aufsetzt und unveränderte Felder
      // weiterhin als unverändert gelten.
      setSectionTitlesBase(nextSectionTitles);
      setSeitentexteLoaded(sectionTitlesToForm(nextSectionTitles));
      setCtaLinks(ctaLinksToForm(normalizedCtaLinks));
      setTw((prev) => (prev ? { ...prev, section_titles: nextSectionTitles, cta_links: normalizedCtaLinks } : prev));
      seitentexteSave.markSaved();
      showNotification('Seitentexte & CTA gespeichert.');
    } catch (err) {
      const msg = getErrorMessage(err);
      seitentexteSave.markError(msg);
      showNotification(`Fehler: ${msg}`);
    }
  };

  const saveSub = async (action, data, saveState, label) => {
    const id = savedTwId || themeWorldId;
    if (!id) return showNotification('Bitte zuerst Grundlagen speichern.');
    // Data-loss protection: never save if initial load failed (data not fully loaded).
    if (loadError) return showNotification('Laden fehlgeschlagen — Speichern nicht möglich.');
    saveState.startSaving();
    try {
      await action(id, data);
      saveState.markSaved();
      showNotification(`${label} gespeichert.`);
    } catch (err) {
      const msg = getErrorMessage(err);
      saveState.markError(msg);
      showNotification(`Fehler: ${msg}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-red-200 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">Fehler beim Laden</p>
              <p className="text-sm text-red-600 mt-1">{loadError}</p>
              <button onClick={() => setView('admin-theme-worlds')} className="mt-4 text-sm text-gray-600 hover:underline">
                Zurück zur Liste
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dbSegment = URL_TO_DB[grundlagen.url_segment] || null;
  const publicPath = grundlagen.url_segment && grundlagen.slug
    ? `/bereich/${grundlagen.url_segment}/${grundlagen.slug}`
    : '—';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('admin-theme-worlds')}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600"
              title="Zurück zur Übersicht"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-heading">
                {(!savedTwId && !themeWorldId) ? 'Neue Themenwelt' : (tw?.title_de || 'Themenwelt bearbeiten')}
              </h1>
              {tw && (
                <div className="flex items-center gap-2 mt-0.5">
                  <AdminStatusBadge status={tw.status} />
                  <span className="text-xs text-gray-400 font-mono">{publicPath}</span>
                </div>
              )}
            </div>
          </div>
          {tw && (
            <button
              onClick={() => { setSelectedThemeWorldId(savedTwId || themeWorldId); setView('admin-scenario-list'); }}
              className="flex items-center gap-1.5 text-sm text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100"
            >
              Szenarioartikel <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tab-Navigation */}
      <div className="bg-white border-b border-gray-200 px-6 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-teal-500 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab-Inhalte */}
      <div className="max-w-4xl mx-auto p-6">

        {/* TAB 1: Grundlagen */}
        {activeTab === 'grundlagen' && (
          <TabPanel>
            <TabHeader title="Grundlagen" saveState={grundlagenSave}>
              <button onClick={saveGrundlagen} disabled={grundlagenSave.state === 'saving'} className="SaveBtn">
                {grundlagenSave.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Speichern
              </button>
            </TabHeader>

            <div className="space-y-5">
              <FormField label="Interner Key" hint="Eindeutig, nur a-z, 0-9, _. Beispiel: mein_thema_key" required>
                <input
                  type="text"
                  className="FormInput font-mono"
                  placeholder="z.B. mein_thema_key"
                  value={grundlagen.key}
                  onChange={(e) => { setGrundlagen((p) => ({ ...p, key: e.target.value })); grundlagenSave.markDirty(); }}
                />
              </FormField>

              <FormField label="Öffentlicher Titel" required>
                <input
                  type="text"
                  className="FormInput"
                  placeholder="Titel der Themenwelt"
                  value={grundlagen.title_de}
                  onChange={(e) => { setGrundlagen((p) => ({ ...p, title_de: e.target.value })); grundlagenSave.markDirty(); }}
                />
              </FormField>

              <FormField label="Untertitel" hint="Kurzer Satz unter dem Titel">
                <input
                  type="text"
                  className="FormInput"
                  placeholder="Kurzer Untertitel"
                  value={grundlagen.subtitle_de}
                  onChange={(e) => { setGrundlagen((p) => ({ ...p, subtitle_de: e.target.value })); grundlagenSave.markDirty(); }}
                />
              </FormField>

              <FormField label="Segment" hint="URL-Segment bestimmt die Kategorie" required>
                <select
                  className="FormInput"
                  value={grundlagen.url_segment}
                  onChange={(e) => { setGrundlagen((p) => ({ ...p, url_segment: e.target.value })); grundlagenSave.markDirty(); }}
                >
                  <option value="">— Segment auswählen —</option>
                  {SEGMENTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  DB-Segment: <code className="text-xs bg-gray-100 px-1 rounded">{dbSegment || '—'}</code>
                </p>
              </FormField>

              <FormField
                label="Slug (URL)"
                hint="Nur a-z, 0-9, Bindestriche. Kann nach Publikation nicht mehr geändert werden."
                required
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="FormInput font-mono"
                    placeholder="mein-thema-slug"
                    value={grundlagen.slug}
                    onChange={(e) => {
                      setAutoSlug(false);
                      setGrundlagen((p) => ({ ...p, slug: e.target.value }));
                      grundlagenSave.markDirty();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAutoSlug(true);
                      setGrundlagen((previous) => {
                        const nextSlug = slugify(previous.title_de);
                        return previous.slug === nextSlug ? previous : { ...previous, slug: nextSlug };
                      });
                    }}
                    className="px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg whitespace-nowrap"
                  >
                    Aus Titel
                  </button>
                </div>
                {grundlagen.url_segment && grundlagen.slug && (
                  <p className="text-xs text-teal-600 mt-1">
                    Öffentlicher Pfad: <strong>/bereich/{grundlagen.url_segment}/{grundlagen.slug}</strong>
                  </p>
                )}
              </FormField>

              <FormField label="Einleitungstext" hint="Erscheint als Lead-Text auf der Landingpage">
                <textarea
                  className="FormInput resize-none h-28"
                  placeholder="Kurze Einleitung zur Themenwelt…"
                  value={grundlagen.intro_de}
                  onChange={(e) => { setGrundlagen((p) => ({ ...p, intro_de: e.target.value })); grundlagenSave.markDirty(); }}
                />
              </FormField>
            </div>

            <TabFooter saveState={grundlagenSave} onSave={saveGrundlagen} />
          </TabPanel>
        )}

        {/* TAB 2: Bilder & SEO */}
        {activeTab === 'bilder-seo' && (
          <TabPanel>
            <TabHeader title="Bilder & SEO" saveState={bilderSave}>
              <button onClick={saveBilder} disabled={bilderSave.state === 'saving'} className="SaveBtn">
                {bilderSave.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Speichern
              </button>
            </TabHeader>

            <div className="space-y-8">
              <AdminImageField
                currentUrl={bilder.hero_image_url}
                altText={bilder.hero_image_alt_de}
                folder="theme-worlds"
                label="Hero-Bild"
                altRequired={!!bilder.hero_image_url}
                onImageUploaded={({ publicUrl }) => {
                  setBilder((p) => ({ ...p, hero_image_url: publicUrl }));
                  bilderSave.markDirty();
                }}
                onAltTextChange={(alt) => {
                  setBilder((p) => ({ ...p, hero_image_alt_de: alt }));
                  bilderSave.markDirty();
                }}
                onUploadStateChange={setHeroUploading}
              />
              {/* Hinweis: Kein eigenes Bild → Fallback wird auf der Seite angezeigt */}
              {!bilder.hero_image_url && grundlagen.url_segment && (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <img
                    src={SEGMENT_FALLBACK_HERO_IMAGES[grundlagen.url_segment]}
                    alt="Standardbild"
                    className="w-16 h-10 object-cover rounded shrink-0"
                  />
                  <p>
                    Kein Bild hochgeladen — auf der Landingpage wird dieses <strong>Standardbild für das Segment</strong> angezeigt.
                    Du kannst jederzeit ein eigenes Bild hochladen.
                  </p>
                </div>
              )}

              <AdminImageField
                currentUrl={bilder.og_image_url}
                altText={bilder.og_image_alt_de}
                folder="theme-worlds"
                label="Open-Graph-Bild (Social Media)"
                altRequired={false}
                onImageUploaded={({ publicUrl }) => {
                  setBilder((p) => ({ ...p, og_image_url: publicUrl }));
                  bilderSave.markDirty();
                }}
                onAltTextChange={(alt) => {
                  setBilder((p) => ({ ...p, og_image_alt_de: alt }));
                  bilderSave.markDirty();
                }}
                onUploadStateChange={setOgUploading}
              />

              <AdminSeoFields
                metaTitle={bilder.meta_title}
                metaDescription={bilder.meta_description}
                onChange={({ metaTitle, metaDescription }) => {
                  setBilder((p) => ({ ...p, meta_title: metaTitle, meta_description: metaDescription }));
                  bilderSave.markDirty();
                }}
                titlePlaceholder="SEO-Titel (max. 60 Zeichen)"
                descriptionPlaceholder="Meta-Beschreibung (max. 155 Zeichen)"
              />
            </div>

            <TabFooter saveState={bilderSave} onSave={saveBilder} />
          </TabPanel>
        )}

        {/* TAB 3: Suche */}
        {activeTab === 'suche' && (
          <TabPanel>
            <TabHeader title="Suchkonfiguration" saveState={sucheSave}>
              <button onClick={saveSuche} disabled={sucheSave.state === 'saving'} className="SaveBtn">
                {sucheSave.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Speichern
              </button>
            </TabHeader>
            <p className="text-sm text-gray-500 mb-6">
              Diese Felder steuern die themenspezifische Kurssuche auf der Landingpage.
              Keine freien URL-Strings — nur strukturierte Felder.
            </p>

            <div className="space-y-5">
              <FormField label="Bereichs-Slug (area_slug)" hint="Optionaler Slug aus taxonomy_level2. Beispiel: sport_fitness">
                <input
                  type="text"
                  className="FormInput font-mono"
                  placeholder="z.B. sport_fitness"
                  value={suche.area_slug}
                  onChange={(e) => { setSuche((p) => ({ ...p, area_slug: e.target.value })); sucheSave.markDirty(); }}
                />
              </FormField>

              <FormField label="Kursart (kursart)" hint="Optionaler Kursart-Filter, z. B. feriencamp">
                <input
                  type="text"
                  className="FormInput font-mono"
                  placeholder="z. B. feriencamp"
                  maxLength={100}
                  value={suche.kursart}
                  onChange={(e) => { setSuche((p) => ({ ...p, kursart: e.target.value })); sucheSave.markDirty(); }}
                />
              </FormField>

              <FormField
                label="Anzeigename in der Suche"
                hint='Lesbare Bezeichnung für Breadcrumb, Seitentitel und Suchfilter, z. B. ”Kreativ & Gestalten". Leer lassen um den Titel der Themenwelt zu verwenden.'
              >
                <input
                  type="text"
                  className="FormInput"
                  placeholder='z. B. Kreativ & Gestalten'
                  maxLength={80}
                  value={suche.area_label_de}
                  onChange={(e) => { setSuche((p) => ({ ...p, area_label_de: e.target.value })); sucheSave.markDirty(); }}
                />
              </FormField>

              <FormField label="Standard-Spezialgebiet" hint={specialtyHint}>
                <CanonicalSelect
                  value={suche.default_spec}
                  options={specialtyOptions}
                  emptyLabel="Kein Spezialgebiet"
                  onChange={(v) => { setSuche((p) => ({ ...p, default_spec: v })); sucheSave.markDirty(); }}
                />
              </FormField>

              <FormField
                label="Standard-Fokus"
                hint="Optionaler default_focus für Suche. Auswahl abhängig vom Standard-Spezialgebiet."
              >
                <CanonicalSelect
                  value={suche.default_focus}
                  options={focusesForSpecialty(suche.default_spec)}
                  emptyLabel="Kein Fokus"
                  onChange={(v) => { setSuche((p) => ({ ...p, default_focus: v })); sucheSave.markDirty(); }}
                />
              </FormField>
            </div>

            {/* Vordefinierte Suchen */}
            <div className="pt-6 border-t border-gray-100">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Vordefinierte Suchen</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Schnelleinstieg-Links auf der Landingpage (max. 20 Einträge).
                  Bezeichnung ist Pflichtfeld, alle anderen Felder optional.
                </p>
              </div>
              <RepeatableList
                items={predefinedSearches}
                maxItems={20}
                onChange={(items) => { setPredefinedSearches(items); sucheSave.markDirty(); }}
                emptyLabel="Noch keine vordefinierten Suchen"
                addLabel="Vordefinierte Suche hinzufügen"
                newItem={() => ({ label_de: '', spec: '', focus: '', loc: '', delivery: '', kursart: '' })}
                renderItem={(item, i, update, remove) => (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Bezeichnung <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="FormInput mt-1"
                        value={item.label_de || ''}
                        onChange={(e) => update({ label_de: e.target.value })}
                        placeholder="z.B. Fitnesstrainer Basiskurs"
                        maxLength={80}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Spezialgebiet (spec)</label>
                        <CanonicalSelect
                          className="mt-1"
                          value={item.spec}
                          options={specialtyOptions}
                          emptyLabel="Kein Spezialgebiet"
                          onChange={(v) => update({ spec: v })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Fokus (focus)</label>
                        {/*
                          Abhängig vom gewählten Spezialgebiet. Ein bestehender,
                          nicht mehr passender Fokus wird bewusst NICHT gelöscht —
                          er bleibt als markierte Option ausgewählt.
                        */}
                        <CanonicalSelect
                          className="mt-1"
                          value={item.focus}
                          options={focusesForSpecialty(item.spec)}
                          emptyLabel="Kein Fokus"
                          onChange={(v) => update({ focus: v })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Ort (loc)</label>
                        <LocationSelect
                          className="mt-1"
                          value={item.loc}
                          onChange={(v) => update({ loc: v })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Kursformat (delivery)</label>
                        <select
                          className="FormInput mt-1"
                          value={item.delivery || ''}
                          onChange={(e) => update({ delivery: e.target.value })}
                        >
                          <option value="">Alle Formate</option>
                          <option value="online_live">Online Live</option>
                          <option value="self_study">Selbststudium</option>
                          <option value="presence">Präsenz (vor Ort)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Kursart (kursart)</label>
                        <input
                          className="FormInput mt-1"
                          value={item.kursart || ''}
                          onChange={(e) => update({ kursart: e.target.value })}
                          placeholder="z. B. feriencamp"
                          maxLength={100}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={remove} className="text-xs text-red-500 hover:underline">
                        Entfernen
                      </button>
                    </div>
                  </div>
                )}
              />
            </div>

            <TabFooter saveState={sucheSave} onSave={saveSuche} />
          </TabPanel>
        )}

        {/* TAB 4: Kursbereiche (Specialties) */}
        {activeTab === 'kursbereiche' && (
          <TabPanel>
            <TabHeader title="Kursbereiche" saveState={specialtiesSave}>
              <button
                onClick={() => saveSub(replaceSpecialties, specialties, specialtiesSave, 'Kursbereiche')}
                disabled={specialtiesSave.state === 'saving'} className="SaveBtn"
              >
                {specialtiesSave.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Speichern
              </button>
            </TabHeader>
            <RepeatableList
              items={specialties}
              onChange={(items) => { setSpecialties(items); specialtiesSave.markDirty(); }}
              emptyLabel="Noch keine Kursbereiche"
              addLabel="Kursbereich hinzufügen"
              newItem={() => ({ specialty_label: '', description_de: '', icon: '', sort_order: specialties.length, is_active: true })}
              renderItem={(item, i, update, remove) => (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-600">Kursbereich-Label (exakt wie in Taxonomie)</label>
                    <CanonicalSelect
                      className="mt-1"
                      value={item.specialty_label}
                      options={specialtyOptions}
                      emptyLabel="Kein Spezialgebiet"
                      onChange={(v) => update({ specialty_label: v })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Emoji-Icon</label>
                    <input className="FormInput mt-1" value={item.icon || ''} onChange={(e) => update({ icon: e.target.value })} placeholder="ðŸ‹ï¸" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Sortierung</label>
                    <input type="number" className="FormInput mt-1" value={item.sort_order ?? i} onChange={(e) => update({ sort_order: parseInt(e.target.value, 10) })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-600">Kurzbeschreibung (optional)</label>
                    <textarea className="FormInput mt-1 min-h-[7rem] h-28 resize-y" value={item.description_de || ''} onChange={(e) => update({ description_de: e.target.value })} />
                  </div>
                  <ActiveToggle value={item.is_active} onChange={(v) => update({ is_active: v })} />
                  <button type="button" onClick={remove} className="text-xs text-red-500 hover:underline text-right md:col-start-2">Entfernen</button>
                </div>
              )}
            />
            <TabFooter saveState={specialtiesSave} onSave={() => saveSub(replaceSpecialties, specialties, specialtiesSave, 'Kursbereiche')} />
          </TabPanel>
        )}

        {/* TAB 5: Regionen */}
        {activeTab === 'regionen' && (
          <TabPanel>
            <TabHeader title="Regionen" saveState={regionenSave}>
              <button
                onClick={() => saveSub(replaceRegions, regionen, regionenSave, 'Regionen')}
                disabled={regionenSave.state === 'saving'} className="SaveBtn"
              >
                {regionenSave.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Speichern
              </button>
            </TabHeader>

            <RepeatableList
              items={regionen}
              onChange={(items) => { setRegionen(items); regionenSave.markDirty(); }}
              emptyLabel="Noch keine Regionen"
              addLabel="Region hinzufügen"
              newItem={() => ({ label_de: '', anchor_text_de: '', loc_param: '', delivery_param: '', sort_order: regionen.length, is_active: true })}
              renderItem={(item, i, update, remove) => (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    {/* Redaktionelles Anzeige-Label — bewusst weiterhin Freitext. */}
                    <label className="text-xs font-semibold text-gray-600">Anzeige-Label</label>
                    <input className="FormInput mt-1" value={item.label_de || ''} onChange={(e) => update({ label_de: e.target.value })} placeholder="Zürich" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-600">Linktext für öffentliche Regionenseite</label>
                    <input className="FormInput mt-1" value={item.anchor_text_de || ''} onChange={(e) => update({ anchor_text_de: e.target.value })} placeholder="Kreativkurse in Zürich" />
                    <p className="text-xs text-gray-500 mt-1">Dieser Text wird für den sichtbaren Regions-Link verwendet. Leer lassen nutzt das Anzeige-Label.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Standort-Parameter (loc)</label>
                    <LocationSelect
                      className="mt-1"
                      value={item.loc_param}
                      onChange={(v) => update({ loc_param: v })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Lieferart-Parameter</label>
                    <select className="FormInput mt-1" value={item.delivery_param || ''} onChange={(e) => update({ delivery_param: e.target.value })}>
                      <option value="">Keine</option>
                      <option value="online_live">Online Live</option>
                      <option value="self_study">Selbststudium</option>
                      <option value="in_person">Vor Ort</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Sortierung</label>
                    <input type="number" className="FormInput mt-1" value={item.sort_order ?? i} onChange={(e) => update({ sort_order: parseInt(e.target.value, 10) })} />
                  </div>
                  <div className="flex items-end">
                    <ActiveToggle value={item.is_active} onChange={(v) => update({ is_active: v })} />
                  </div>
                  <button type="button" onClick={remove} className="text-xs text-red-500 hover:underline md:col-span-2 text-right">Entfernen</button>
                </div>
              )}
            />
            <TabFooter saveState={regionenSave} onSave={() => saveSub(replaceRegions, regionen, regionenSave, 'Regionen')} />
          </TabPanel>
        )}

        {/* TAB 6: Editorial */}
        {activeTab === 'editorial' && (
          <TabPanel>
            <TabHeader title="Redaktionelle Abschnitte" saveState={editorialSave}>
              <button
                onClick={() => saveSub(replaceEditorialSections, editorial, editorialSave, 'Redaktioneller Inhalt')}
                disabled={editorialSave.state === 'saving'} className="SaveBtn"
              >
                {editorialSave.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Speichern
              </button>
            </TabHeader>

            <RepeatableList
              items={editorial}
              onChange={(items) => { setEditorial(items); editorialSave.markDirty(); }}
              emptyLabel="Noch keine Abschnitte"
              addLabel="Abschnitt hinzufügen"
              newItem={() => ({ heading_de: '', intro_de: '', items_de: [], is_ordered: false, closing_de: '', sort_order: editorial.length, is_active: true })}
              renderItem={(item, i, update, remove) => (
                <div className="space-y-3">
                  <FormField label="Abschnittstitel" required>
                    <input className="FormInput" value={item.heading_de || ''} onChange={(e) => update({ heading_de: e.target.value })} />
                  </FormField>
                  <FormField label="Einleitungstext">
                    <textarea className="FormInput h-16 resize-none" value={item.intro_de || ''} onChange={(e) => update({ intro_de: e.target.value })} />
                  </FormField>
                  <FormField label="Aufzählungspunkte (einer pro Zeile)">
                    <ItemsDeTextarea
                      value={item.items_de}
                      onChange={(normalized) => update({ items_de: normalized })}
                    />
                  </FormField>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={!!item.is_ordered} onChange={(e) => update({ is_ordered: e.target.checked })} id={`ordered-${i}`} />
                    <label htmlFor={`ordered-${i}`} className="text-sm text-gray-700">Geordnete Liste (1, 2, 3…)</label>
                  </div>
                  <FormField label="Schlusstext">
                    <textarea className="FormInput h-16 resize-none" value={item.closing_de || ''} onChange={(e) => update({ closing_de: e.target.value })} />
                  </FormField>
                  <div className="flex justify-between items-center">
                    <ActiveToggle value={item.is_active} onChange={(v) => update({ is_active: v })} />
                    <button type="button" onClick={remove} className="text-xs text-red-500 hover:underline">Entfernen</button>
                  </div>
                </div>
              )}
            />
            <TabFooter saveState={editorialSave} onSave={() => saveSub(replaceEditorialSections, editorial, editorialSave, 'Redaktioneller Inhalt')} />
          </TabPanel>
        )}

        {/* TAB 7: FAQs */}
        {activeTab === 'faqs' && (
          <TabPanel>
            <TabHeader title="FAQs" saveState={faqSave}>
              <button
                onClick={() => saveSub(replaceFaqs, faqs, faqSave, 'FAQs')}
                disabled={faqSave.state === 'saving'} className="SaveBtn"
              >
                {faqSave.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Speichern
              </button>
            </TabHeader>

            <RepeatableList
              items={faqs}
              onChange={(items) => { setFaqs(items); faqSave.markDirty(); }}
              emptyLabel="Noch keine FAQs"
              addLabel="FAQ hinzufügen"
              newItem={() => ({ question_de: '', answer_de: '', sort_order: faqs.length, is_active: true })}
              renderItem={(item, i, update, remove) => (
                <div className="space-y-3">
                  <FormField label="Frage" required>
                    <input className="FormInput" value={item.question_de || ''} onChange={(e) => update({ question_de: e.target.value })} />
                  </FormField>
                  <FormField label="Antwort" required>
                    <textarea className="FormInput h-24 resize-none" value={item.answer_de || ''} onChange={(e) => update({ answer_de: e.target.value })} />
                  </FormField>
                  <div className="flex justify-between items-center">
                    <ActiveToggle value={item.is_active} onChange={(v) => update({ is_active: v })} />
                    <button type="button" onClick={remove} className="text-xs text-red-500 hover:underline">Entfernen</button>
                  </div>
                </div>
              )}
            />
            <TabFooter saveState={faqSave} onSave={() => saveSub(replaceFaqs, faqs, faqSave, 'FAQs')} />
          </TabPanel>
        )}

        {/* TAB 8: Trust & Hinweise */}
        {activeTab === 'trust' && (
          <TabPanel>
            <TabHeader title="Trust & Hinweise" saveState={trustSave}>
              <button
                onClick={() => saveSub(replaceTrustItems, trustItems, trustSave, 'Trust-Hinweise')}
                disabled={trustSave.state === 'saving'} className="SaveBtn"
              >
                {trustSave.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Speichern
              </button>
            </TabHeader>
            <p className="text-sm text-gray-500 mb-4">
              Unterscheide klar zwischen echten Qualitätslabels (mit Logo), redaktionellen
              Hinweisen und allgemeinen Info-Karten.
            </p>

            <RepeatableList
              items={trustItems}
              onChange={(items) => { setTrustItems(items); trustSave.markDirty(); }}
              emptyLabel="Noch keine Trust-Hinweise"
              addLabel="Eintrag hinzufügen"
              newItem={() => ({ item_type: 'editorial', name: '', description_de: '', sort_order: trustItems.length, is_active: true })}
              renderItem={(item, i, update, remove) => (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField label="Typ">
                      <select className="FormInput" value={item.item_type || 'editorial'} onChange={(e) => update({ item_type: e.target.value })}>
                        <option value="label">Qualitätslabel (mit Logo)</option>
                        <option value="editorial">Redaktioneller Hinweis</option>
                        <option value="info">Info-Karte</option>
                      </select>
                      {item.item_type === 'editorial' && (
                        <p className="text-xs text-amber-600 mt-1">
                          Hinweis: Redaktionelle Einträge sind keine offiziellen Zertifizierungen.
                        </p>
                      )}
                    </FormField>
                    <FormField label="Sortierung">
                      <input type="number" className="FormInput" value={item.sort_order ?? i} onChange={(e) => update({ sort_order: parseInt(e.target.value, 10) })} />
                    </FormField>
                  </div>
                  <FormField label="Titel" required>
                    <input className="FormInput" value={item.name || ''} onChange={(e) => update({ name: e.target.value })} />
                  </FormField>
                  <FormField label="Beschreibung">
                    <textarea className="FormInput h-20 resize-none" value={item.description_de || ''} onChange={(e) => update({ description_de: e.target.value })} />
                  </FormField>
                  {item.item_type === 'label' && (
                    <>
                      <FormField label="Logo-URL (https://)">
                        <input type="url" className="FormInput" value={item.logo_url || ''} onChange={(e) => update({ logo_url: e.target.value })} placeholder="https://..." />
                      </FormField>
                      <FormField label="Logo Alt-Text" required={!!item.logo_url}>
                        <input className="FormInput" value={item.logo_alt || ''} onChange={(e) => update({ logo_alt: e.target.value })} />
                      </FormField>
                      <FormField label="Bildrechte / Nutzungshinweis">
                        <input className="FormInput" value={item.rights_note || ''} onChange={(e) => update({ rights_note: e.target.value })} />
                      </FormField>
                    </>
                  )}
                  <FormField label="Externe URL (optional)">
                    <input type="url" className="FormInput" value={item.external_url || ''} onChange={(e) => update({ external_url: e.target.value })} placeholder="https://..." />
                  </FormField>
                  <div className="flex justify-between items-center">
                    <ActiveToggle value={item.is_active} onChange={(v) => update({ is_active: v })} />
                    <button type="button" onClick={remove} className="text-xs text-red-500 hover:underline">Entfernen</button>
                  </div>
                </div>
              )}
            />
            <TabFooter saveState={trustSave} onSave={() => saveSub(replaceTrustItems, trustItems, trustSave, 'Trust-Hinweise')} />

            {/*
              Zweiter, getrennter Speicherbereich im selben Tab.
              Speichert ausschliesslich Spalten auf theme_worlds (section_titles,
              cta_links) über EINEN updateThemeWorld()-Request — ein einzelnes
              Row-Update, unabhängig vom Trust-Items-Save oberhalb.
            */}
            <div className="pt-8 mt-4 border-t-2 border-gray-200 space-y-6">
              <TabHeader title="Seitentexte & Abschluss / CTA" saveState={seitentexteSave}>
                <button onClick={saveSeitentexte} disabled={seitentexteSave.state === 'saving'} className="SaveBtn">
                  {seitentexteSave.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Speichern
                </button>
              </TabHeader>

              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                Alle Felder sind optional. Bleibt ein Feld leer, verwendet die
                öffentliche Seite ihren eingebauten Vorgabetext.
              </p>

              {/*
                Überschriften der übrigen Seitenabschnitte. Sie liegen im selben
                section_titles-Objekt wie die Trust- und CTA-Titel und werden
                deshalb im selben Speichervorgang geschrieben.
              */}
              {SEITENTEXTE_GROUPS.map((group) => (
                <div key={group.title} className="pt-5 border-t border-gray-100 space-y-4 first:pt-0 first:border-t-0">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700">{group.title}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">{group.hint}</p>
                  </div>
                  {group.fields.map((field) => (
                    <FormField key={field.key} label={field.label}>
                      <input
                        type="text"
                        className="FormInput"
                        placeholder={field.placeholder}
                        maxLength={200}
                        value={seitentexte[field.key]}
                        onChange={(e) => {
                          const { value } = e.target;
                          setSeitentexte((p) => ({ ...p, [field.key]: value }));
                          seitentexteSave.markDirty();
                        }}
                      />
                    </FormField>
                  ))}
                </div>
              ))}

              <div className="pt-5 border-t border-gray-100 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Trust-Hinweise</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Überschrift über den Trust- und Hinweis-Karten.
                  </p>
                </div>
                <FormField
                  label="Abschnittsüberschrift"
                  hint="Überschrift über den Trust- und Hinweis-Karten auf der öffentlichen Themenwelt."
                >
                  <input
                    type="text"
                    className="FormInput"
                    placeholder="z.B. Worauf du bei der Kurswahl achten solltest"
                    maxLength={200}
                    value={seitentexte.trust_heading}
                    onChange={(e) => { setSeitentexte((p) => ({ ...p, trust_heading: e.target.value })); seitentexteSave.markDirty(); }}
                  />
                </FormField>
              </div>

              {/* Abschluss / CTA */}
              <div className="pt-6 border-t border-gray-100 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Abschluss / CTA</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Der Abschlussbereich am Seitenende der öffentlichen Themenwelt.
                  </p>
                </div>

                <FormField label="Abschlussüberschrift" hint="Überschrift im Abschlussbereich am Seitenende.">
                  <input
                    type="text"
                    className="FormInput"
                    placeholder="z.B. Bereit für deine Praxis?"
                    maxLength={200}
                    value={seitentexte.cta_heading}
                    onChange={(e) => { setSeitentexte((p) => ({ ...p, cta_heading: e.target.value })); seitentexteSave.markDirty(); }}
                  />
                </FormField>

                <FormField
                  label="Hauptbutton"
                  hint="Text des Hauptbuttons. Er verlinkt automatisch auf alle Kurse dieser Themenwelt — keine URL-Konfiguration nötig."
                >
                  <input
                    type="text"
                    className="FormInput"
                    placeholder="z.B. Alle Yoga-Kurse anzeigen"
                    maxLength={200}
                    value={seitentexte.cta_button}
                    onChange={(e) => { setSeitentexte((p) => ({ ...p, cta_button: e.target.value })); seitentexteSave.markDirty(); }}
                  />
                </FormField>

                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  Die angezeigte Kurszahl wird automatisch aus den veröffentlichten Kursen berechnet.
                </p>

                {/* Zusätzliche CTA-Links */}
                <div className="pt-5 border-t border-gray-100">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">Zusätzliche CTA-Links</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Weiterführende Links unter dem Hauptbutton (max. {MAX_CTA_LINKS} Einträge).
                      Bezeichnung ist Pflichtfeld, die vier Suchparameter sind optional.
                      Die Reihenfolge der Karten ist die Reihenfolge auf der Seite.
                    </p>
                  </div>
                  <RepeatableList
                    items={ctaLinks}
                    maxItems={MAX_CTA_LINKS}
                    onChange={(items) => { setCtaLinks(items); seitentexteSave.markDirty(); }}
                    emptyLabel="Noch keine zusätzlichen CTA-Links"
                    addLabel="CTA-Link hinzufügen"
                    newItem={() => ({
                      label_de: '', spec: '', focus: '', loc: '', delivery: '', kursart: '',
                      hadSortOrder: false, status: null,
                    })}
                    renderItem={(item, i, update, remove) => (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600">
                            Bezeichnung <span className="text-red-500">*</span>
                          </label>
                          <input
                            className="FormInput mt-1"
                            value={item.label_de || ''}
                            onChange={(e) => update({ label_de: e.target.value })}
                            placeholder="z.B. Kurse in Zürich"
                            maxLength={60}
                          />
                        </div>
                        {/* Dieselben vier Suchparameter wie bei den vordefinierten
                            Suchen — ein CTA-Link ist eine hervorgehobene Suche. */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Spezialgebiet (spec)</label>
                            <CanonicalSelect
                              className="mt-1"
                              value={item.spec}
                              options={specialtyOptions}
                              emptyLabel="Kein Spezialgebiet"
                              onChange={(v) => update({ spec: v })}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Fokus (focus)</label>
                            <CanonicalSelect
                              className="mt-1"
                              value={item.focus}
                              options={focusesForSpecialty(item.spec)}
                              emptyLabel="Kein Fokus"
                              onChange={(v) => update({ focus: v })}
                            />
                          </div>
                          <div>
                            {/* Erzeugt denselben öffentlichen loc-Suchparameter
                                wie die vordefinierten Suchen und die Regionen. */}
                            <label className="text-xs font-semibold text-gray-600">Ort (loc)</label>
                            <LocationSelect
                              className="mt-1"
                              value={item.loc}
                              onChange={(v) => update({ loc: v })}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Kursformat (delivery)</label>
                            <select
                              className="FormInput mt-1"
                              value={item.delivery || ''}
                              onChange={(e) => update({ delivery: e.target.value })}
                            >
                              <option value="">Alle Formate</option>
                              <option value="online_live">Online Live</option>
                              <option value="self_study">Selbststudium</option>
                              <option value="presence">Präsenz (vor Ort)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Kursart (kursart)</label>
                            <input
                              className="FormInput mt-1"
                              value={item.kursart || ''}
                              onChange={(e) => update({ kursart: e.target.value })}
                              placeholder="z. B. feriencamp"
                              maxLength={100}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button type="button" onClick={remove} className="text-xs text-red-500 hover:underline">
                            Entfernen
                          </button>
                        </div>
                      </div>
                    )}
                  />
                </div>
              </div>

              <TabFooter saveState={seitentexteSave} onSave={saveSeitentexte} />
            </div>
          </TabPanel>
        )}

        {/* TAB 9: Szenarioartikel */}
        {activeTab === 'szenarien' && (
          <TabPanel>
            <TabHeader title="Szenarioartikel">
              <button
                onClick={() => {
                  setSelectedThemeWorldId(savedTwId || themeWorldId);
                  setView('admin-scenario-list');
                }}
                className="SaveBtn"
              >
                Zur Szenariolverwaltung <ChevronRight className="w-4 h-4" />
              </button>
            </TabHeader>
            <p className="text-gray-500 text-sm">
              Szenarioartikel werden in einer separaten Ansicht verwaltet.
              Dort können Artikel erstellt, bearbeitet, sortiert und publiziert werden.
            </p>
            {(!savedTwId && !themeWorldId) && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                Bitte zuerst die Grundlagen speichern, bevor Szenarioartikel erstellt werden können.
              </div>
            )}
          </TabPanel>
        )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hilfskomponenten (lokal)
// ---------------------------------------------------------------------------

function TabPanel({ children }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">{children}</div>;
}

function TabHeader({ title, saveState, children }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="flex items-center gap-3">
        {saveState && <AdminSaveState state={saveState.state} isDirty={saveState.isDirty} errorMessage={saveState.errorMsg} />}
        <div className="flex gap-2 [&_.SaveBtn]:flex [&_.SaveBtn]:items-center [&_.SaveBtn]:gap-2 [&_.SaveBtn]:bg-teal-600 [&_.SaveBtn]:text-white [&_.SaveBtn]:px-4 [&_.SaveBtn]:py-2 [&_.SaveBtn]:rounded-lg [&_.SaveBtn]:text-sm [&_.SaveBtn]:font-bold [&_.SaveBtn]:hover:bg-teal-700 [&_.SaveBtn]:disabled:opacity-50 [&_.SaveBtn]:transition">
          {children}
        </div>
      </div>
    </div>
  );
}

function TabFooter({ saveState, onSave }) {
  return (
    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
      <AdminSaveState state={saveState.state} isDirty={saveState.isDirty} errorMessage={saveState.errorMsg} />
      <button
        onClick={onSave}
        disabled={saveState.state === 'saving'}
        className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
      >
        {saveState.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Speichern
      </button>
    </div>
  );
}

function FormField({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className={FORM_INPUT_SCOPE}>
        {children}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Select für einen kanonischen Filterwert (Spezialgebiet, Fokus, Ort).
 *
 * Bestandsschutz: ist der gespeicherte Wert nicht (mehr) in `options`, wird er
 * als zusätzliche, markierte Option angeboten und bleibt ausgewählt. Er
 * verschwindet erst, wenn der Admin bewusst eine andere Option wählt. Der
 * State-Wert bleibt exakt der String aus der DB — der Save-Vertrag ('' bzw.
 * bestehende Normalisierung) ändert sich nicht.
 */
function CanonicalSelect({
  value,
  onChange,
  options,
  emptyLabel,
  unknownNote = 'nicht in aktueller Taxonomie',
  className = '',
  disabled = false,
}) {
  const current = value || '';
  const list = options || [];
  const isUnknown = current !== '' && !list.includes(current);

  return (
    <select
      className={`FormInput ${className}`.trim()}
      value={current}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{emptyLabel}</option>
      {isUnknown && (
        <option value={current}>{`${current} (${unknownNote})`}</option>
      )}
      {list.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

/** Standort-Select — kanonische Ortsliste der öffentlichen Suche. */
function LocationSelect({ value, onChange, className = '' }) {
  return (
    <CanonicalSelect
      value={value}
      onChange={onChange}
      options={LOCATION_OPTIONS}
      emptyLabel="Kein Ort"
      unknownNote="nicht in aktueller Ortsliste"
      className={className}
    />
  );
}

function ActiveToggle({ value, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded" />
      <span className="text-sm text-gray-700">Aktiv</span>
    </label>
  );
}

/**
 * Textarea für Aufzählungspunkte (items_de).
 *
 * Behält den Rohtext während der Eingabe — Enter wird nicht sofort entfernt.
 * Erst beim Verlassen des Feldes (blur) wird der Text normalisiert:
 * leere Zeilen werden entfernt, Zeilen getrimmt, das Ergebnis als Array
 * an den Parent übergeben.
 */
function ItemsDeTextarea({ value, onChange }) {
  const [raw, setRaw] = React.useState(() => (value || []).join('\n'));
  const isFocused = React.useRef(false);

  React.useEffect(() => {
    if (!isFocused.current) {
      setRaw((value || []).join('\n'));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <textarea
      className="FormInput h-24 resize-none font-mono text-sm"
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onFocus={() => { isFocused.current = true; }}
      onBlur={() => {
        isFocused.current = false;
        onChange(raw.split('\n').map((line) => line.trim()).filter(Boolean));
      }}
      placeholder={"Punkt 1\nPunkt 2\nPunkt 3"}
    />
  );
}

function RepeatableList({ items, onChange, emptyLabel, addLabel, newItem, renderItem, maxItems }) {
  const atMax = maxItems != null && items.length >= maxItems;
  const add = () => { if (!atMax) onChange([...items, newItem()]); };

  const update = (i, patch) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <p className="text-sm text-gray-400 italic">{emptyLabel}</p>
      )}
      {items.map((item, i) => (
        <div
          key={i}
          // FORM_INPUT_SCOPE auch hier: die Felder in den Karten liegen ausserhalb
          // von FormField und blieben sonst ohne Rand, Hintergrund und Padding.
          className={`border border-gray-200 rounded-lg p-4 bg-gray-50 relative ${FORM_INPUT_SCOPE}`}
        >
          <div className="absolute top-2 right-2 text-xs text-gray-400 font-mono">#{i + 1}</div>
          {renderItem(item, i, (patch) => update(i, patch), () => remove(i))}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={atMax}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:text-gray-500"
      >
        {atMax ? `Maximum erreicht (${maxItems})` : `+ ${addLabel}`}
      </button>
    </div>
  );
}
