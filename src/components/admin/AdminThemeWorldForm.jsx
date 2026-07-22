/**
 * Admin-Formular für Themenwelten (9 Tabs).
 * Jeder Tab speichert seinen Bereich separat.
 * Pro Tab: Speicherstatus, ungespeicherte-Änderungen-Warnung.
 */

import React, { useState, useEffect, useCallback } from 'react';
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

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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

  // Suche
  const sucheSave = useSaveState();
  const [suche, setSuche] = useState({
    area_slug: '', type_key: '', default_spec: '', default_focus: '',
  });

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
        type_key: sc.type_key || '',
        default_spec: sc.default_spec || '',
        default_focus: sc.default_focus || '',
      });

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
    if (autoSlug && grundlagen.title_de) {
      setGrundlagen((prev) => ({ ...prev, slug: slugify(prev.title_de) }));
    }
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
        area_slug: suche.area_slug || grundlagen.key,
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
    bilderSave.startSaving();
    try {
      await updateThemeWorld(id, {
        hero_image_url: bilder.hero_image_url || null,
        hero_image_alt_de: bilder.hero_image_alt_de || null,
        og_image_url: bilder.og_image_url || null,
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
    sucheSave.startSaving();
    try {
      await updateThemeWorld(id, {
        area_slug: suche.area_slug,
        search_config: {
          area_slug: suche.area_slug,
          ...(suche.type_key && { type_key: suche.type_key }),
          ...(suche.default_spec && { default_spec: suche.default_spec }),
          ...(suche.default_focus && { default_focus: suche.default_focus }),
        },
      });
      sucheSave.markSaved();
      showNotification('Suchkonfiguration gespeichert.');
    } catch (err) {
      const msg = getErrorMessage(err);
      sucheSave.markError(msg);
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
                      setGrundlagen((p) => ({ ...p, slug: slugify(p.title_de) }));
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
              />

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
              <FormField label="Bereichs-Slug (area_slug)" hint="Exakter Slug aus taxonomy_level2. Beispiel: sport_fitness" required>
                <input
                  type="text"
                  className="FormInput font-mono"
                  placeholder="z.B. sport_fitness"
                  value={suche.area_slug}
                  onChange={(e) => { setSuche((p) => ({ ...p, area_slug: e.target.value })); sucheSave.markDirty(); }}
                />
              </FormField>

              <FormField label="Standard-Spezialgebiet" hint="Optionaler default_spec für Suche">
                <input
                  type="text"
                  className="FormInput"
                  placeholder="Fitness Trainer"
                  value={suche.default_spec}
                  onChange={(e) => { setSuche((p) => ({ ...p, default_spec: e.target.value })); sucheSave.markDirty(); }}
                />
              </FormField>

              <FormField label="Standard-Fokus" hint="Optionaler default_focus für Suche">
                <input
                  type="text"
                  className="FormInput"
                  placeholder="Kraft & Ausdauer"
                  value={suche.default_focus}
                  onChange={(e) => { setSuche((p) => ({ ...p, default_focus: e.target.value })); sucheSave.markDirty(); }}
                />
              </FormField>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600">Kursbereich-Label (exakt wie in Taxonomie)</label>
                    <input className="FormInput mt-1" value={item.specialty_label || ''} onChange={(e) => update({ specialty_label: e.target.value })} placeholder="Fitness Trainer" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Emoji-Icon</label>
                    <input className="FormInput mt-1 w-24" value={item.icon || ''} onChange={(e) => update({ icon: e.target.value })} placeholder="🏋️" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Sortierung</label>
                    <input type="number" className="FormInput mt-1 w-24" value={item.sort_order ?? i} onChange={(e) => update({ sort_order: parseInt(e.target.value, 10) })} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600">Kurzbeschreibung (optional)</label>
                    <textarea className="FormInput mt-1 h-16 resize-none" value={item.description_de || ''} onChange={(e) => update({ description_de: e.target.value })} />
                  </div>
                  <ActiveToggle value={item.is_active} onChange={(v) => update({ is_active: v })} />
                  <button type="button" onClick={remove} className="text-xs text-red-500 hover:underline text-right col-start-2">Entfernen</button>
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
              newItem={() => ({ label_de: '', loc_param: '', delivery_param: '', sort_order: regionen.length, is_active: true })}
              renderItem={(item, i, update, remove) => (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600">Anzeige-Label</label>
                    <input className="FormInput mt-1" value={item.label_de || ''} onChange={(e) => update({ label_de: e.target.value })} placeholder="Zürich" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Standort-Parameter (loc)</label>
                    <input className="FormInput mt-1" value={item.loc_param || ''} onChange={(e) => update({ loc_param: e.target.value })} placeholder="Zürich" />
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
                    <input type="number" className="FormInput mt-1 w-24" value={item.sort_order ?? i} onChange={(e) => update({ sort_order: parseInt(e.target.value, 10) })} />
                  </div>
                  <div className="flex items-end">
                    <ActiveToggle value={item.is_active} onChange={(v) => update({ is_active: v })} />
                  </div>
                  <button type="button" onClick={remove} className="text-xs text-red-500 hover:underline col-span-2 text-right">Entfernen</button>
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
                    <textarea
                      className="FormInput h-24 resize-none font-mono text-sm"
                      value={(item.items_de || []).join('\n')}
                      onChange={(e) => update({ items_de: e.target.value.split('\n').filter(Boolean) })}
                      placeholder="Punkt 1&#10;Punkt 2&#10;Punkt 3"
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
                  <div className="grid grid-cols-2 gap-3">
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
                      <input type="number" className="FormInput w-24" value={item.sort_order ?? i} onChange={(e) => update({ sort_order: parseInt(e.target.value, 10) })} />
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
      <div className="[&_.FormInput]:w-full [&_.FormInput]:p-2.5 [&_.FormInput]:border [&_.FormInput]:rounded-lg [&_.FormInput]:text-sm [&_.FormInput]:focus:ring-2 [&_.FormInput]:focus:ring-teal-500 [&_.FormInput]:outline-none">
        {children}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
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

function RepeatableList({ items, onChange, emptyLabel, addLabel, newItem, renderItem }) {
  const add = () => onChange([...items, newItem()]);

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
        <div key={i} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative">
          <div className="absolute top-2 right-2 text-xs text-gray-400 font-mono">#{i + 1}</div>
          {renderItem(item, i, (patch) => update(i, patch), () => remove(i))}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition font-medium"
      >
        + {addLabel}
      </button>
    </div>
  );
}
