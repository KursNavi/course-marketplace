/**
 * Admin-Formular fÃ¼r Szenarioartikel.
 * Erstellt oder bearbeitet einen einzelnen Szenarioartikel.
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, Save, Loader, AlertCircle, Plus, Trash2 } from 'lucide-react';
import AdminStatusBadge from './AdminStatusBadge';
import AdminSaveState from './AdminSaveState';
import AdminSeoFields from './AdminSeoFields';
import AdminImageField from './AdminImageField';
import AdminRichTextEditor from './AdminRichTextEditor';
import {
  getScenario,
  createScenario,
  updateScenario,
  getErrorMessage,
} from '../../lib/themeWorldAdminApi';
import { normalizeDeliveryTypeKey } from '../../lib/courseMetadata';
import { MAX_SOURCES_PER_SCENARIO } from '../../lib/scenarioSources';

/** Leerer Quelleneintrag fÃ¼r Â«Quelle hinzufÃ¼genÂ». */
function emptySource() {
  return { publisher: '', title: '', url: '' };
}

/**
 * Bringt die geladenen Quellen in die Formularform.
 *
 * Bewusst tolerant: ein Altbestand mit unerwartetem Inhalt soll das Formular
 * nicht blockieren, sondern sichtbar und korrigierbar sein. Die verbindliche
 * PrÃ¼fung passiert serverseitig (validateScenarioSources).
 */
function sourcesToFormRows(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => ({
      publisher: typeof entry.publisher === 'string' ? entry.publisher : '',
      title: typeof entry.title === 'string' ? entry.title : '',
      url: typeof entry.url === 'string' ? entry.url : '',
    }));
}

/**
 * Baut das sources-Array fÃ¼r den Speicher-Payload.
 *
 * VollstÃ¤ndig leere Zeilen fallen weg: eine versehentlich hinzugefÃ¼gte und nie
 * ausgefÃ¼llte Quelle soll das Speichern nicht mit einem Validierungsfehler
 * blockieren. Teilweise ausgefÃ¼llte Zeilen bleiben drin â€” dort ist der
 * Server-Fehler die richtige RÃ¼ckmeldung, weil die Redaktion etwas begonnen und
 * nicht zu Ende gefÃ¼hrt hat.
 */
function formRowsToSources(rows) {
  return (rows || [])
    .map((row) => ({
      title: (row.title || '').trim(),
      publisher: (row.publisher || '').trim(),
      url: (row.url || '').trim(),
    }))
    .filter((row) => row.title || row.publisher || row.url);
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/Ã¤/g, 'ae').replace(/Ã¶/g, 'oe').replace(/Ã¼/g, 'ue').replace(/ÃŸ/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function useSaveState() {
  const [state, setState] = useState('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const markDirty = () => { setState('idle'); setIsDirty(true); };
  const startSaving = () => { setState('saving'); setErrorMsg(null); };
  const markSaved = () => { setState('saved'); setIsDirty(false); };
  const markError = (msg) => { setState('error'); setErrorMsg(msg); };
  return { state, isDirty, errorMsg, markDirty, startSaving, markSaved, markError };
}

export default function AdminScenarioForm({
  showNotification,
  setView,
  themeWorldId,
  scenarioId,
  setSelectedScenarioId,
}) {
  const isNew = !scenarioId;
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(null);
  const saveState = useSaveState();

  const [form, setForm] = useState({
    label_de: '', icon: '', teaser_de: '', slug: '',
    content_html: '',
    card_image_url: '', card_image_alt: '', og_image_url: '', og_image_alt: '',
    meta_title: '', meta_description: '',
    cta_label_de: '',
    cta_spec: '', cta_focus: '', cta_loc: '', cta_delivery: '', cta_kursart: '',
    sources: [],
    last_reviewed_at: '',
    sort_order: 0,
    status: 'draft',
  });
  const [autoSlug, setAutoSlug] = useState(true);
  const [savedId, setSavedId] = useState(scenarioId || null);

  useEffect(() => {
    if (isNew) return;
    loadScenario();
  }, [scenarioId]);

  const loadScenario = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getScenario(savedId || scenarioId);
      const ctaCfg = data.cta_config || {};
      setForm({
        label_de: data.label_de || '',
        icon: data.icon || '',
        teaser_de: data.teaser_de || '',
        slug: data.slug || '',
        content_html: data.content_html || '',
        card_image_url: data.card_image_url || '',
        card_image_alt: data.card_image_alt || '',
        og_image_url: data.og_image_url || '',
        og_image_alt: data.og_image_alt || '',
        meta_title: data.meta_title || '',
        meta_description: data.meta_description || '',
        cta_label_de: data.cta_label_de || '',
        cta_spec: ctaCfg.spec || '',
        cta_focus: ctaCfg.focus || '',
        cta_loc: ctaCfg.loc || '',
        cta_delivery: normalizeDeliveryTypeKey(ctaCfg.delivery) || '',
        cta_kursart: ctaCfg.kursart || '',
        sources: sourcesToFormRows(data.sources),
        // date-Input erwartet exakt JJJJ-MM-TT. Die DB-Spalte ist `date` und
        // liefert genau dieses Format; ein Timestamp wÃ¼rde abgeschnitten.
        last_reviewed_at: (data.last_reviewed_at || '').slice(0, 10),
        sort_order: data.sort_order || 0,
        status: data.status || 'draft',
      });
      setAutoSlug(false);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Auto-Slug aus Titel
  useEffect(() => {
    if (!autoSlug || !form.label_de) return;

    const nextSlug = slugify(form.label_de);
    setForm((previous) => (
      previous.slug === nextSlug ? previous : { ...previous, slug: nextSlug }
    ));
  }, [form.label_de, autoSlug]);

  const update = (patch) => { setForm((p) => ({ ...p, ...patch })); saveState.markDirty(); };

  // --- Quellen ------------------------------------------------------------
  const addSource = () => {
    setForm((p) => (
      p.sources.length >= MAX_SOURCES_PER_SCENARIO
        ? p
        : { ...p, sources: [...p.sources, emptySource()] }
    ));
    saveState.markDirty();
  };

  const updateSource = (index, patch) => {
    setForm((p) => ({
      ...p,
      sources: p.sources.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
    saveState.markDirty();
  };

  const removeSource = (index) => {
    setForm((p) => ({ ...p, sources: p.sources.filter((_, i) => i !== index) }));
    saveState.markDirty();
  };

  /**
   * Verschiebt eine Quelle um eine Position.
   *
   * Die Array-Reihenfolge ist die einzige Ordnungsangabe â€” es gibt keine
   * sort_order im Quellenformat. Ein Tausch benachbarter EintrÃ¤ge ist deshalb
   * die vollstÃ¤ndige Umsortierlogik.
   *
   * @param {number} index - aktuelle Position
   * @param {number} direction - -1 = nach oben, +1 = nach unten
   */
  const moveSource = (index, direction) => {
    const target = index + direction;
    setForm((p) => {
      if (target < 0 || target >= p.sources.length) return p;
      const sources = [...p.sources];
      [sources[index], sources[target]] = [sources[target], sources[index]];
      return { ...p, sources };
    });
    saveState.markDirty();
  };

  const handleSave = async () => {
    saveState.startSaving();
    try {
      const payload = {
        label_de: form.label_de,
        icon: form.icon || null,
        teaser_de: form.teaser_de || null,
        slug: form.slug,
        content_html: form.content_html || null,
        card_image_url: form.card_image_url || null,
        card_image_alt: form.card_image_alt || null,
        og_image_url: form.og_image_url || null,
        og_image_alt: form.og_image_alt || null,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        cta_label_de: form.cta_label_de || null,
        cta_config: {
          ...(form.cta_spec && { spec: form.cta_spec }),
          ...(form.cta_focus && { focus: form.cta_focus }),
          ...(form.cta_loc && { loc: form.cta_loc }),
          ...(form.cta_kursart && { kursart: form.cta_kursart.trim() }),
          ...(normalizeDeliveryTypeKey(form.cta_delivery) && {
            delivery: normalizeDeliveryTypeKey(form.cta_delivery),
          }),
        },
        // Reihenfolge im Payload = Reihenfolge im Formular = Anzeigereihenfolge.
        sources: formRowsToSources(form.sources),
        last_reviewed_at: form.last_reviewed_at || null,
        sort_order: form.sort_order,
      };

      if (isNew && !savedId) {
        const created = await createScenario(themeWorldId, payload);
        setSavedId(created.id);
        setSelectedScenarioId(created.id);
        setForm((p) => ({ ...p, status: 'draft' }));
        showNotification('Szenarioartikel erstellt.');
      } else {
        const id = savedId || scenarioId;
        if (form.status === 'published') {
          // Slug-Schutz: Warnung wenn Slug geÃ¤ndert wird
          const existing = await getScenario(id);
          if (existing.slug !== form.slug) {
            showNotification('Achtung: Der Slug eines publizierten Artikels kann nicht geÃ¤ndert werden.');
            payload.slug = existing.slug;
            setForm((p) => ({ ...p, slug: existing.slug }));
          }
        }
        await updateScenario(id, payload);
        showNotification('Szenarioartikel gespeichert.');
      }
      saveState.markSaved();
    } catch (err) {
      const msg = getErrorMessage(err);
      saveState.markError(msg);
      showNotification(`Fehler: ${msg}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-purple-600" />
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
              <button onClick={() => setView('admin-scenario-list')} className="mt-4 text-sm text-gray-600 hover:underline">
                ZurÃ¼ck zur Liste
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('admin-scenario-list')} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-heading">
                {isNew ? 'Neuer Szenarioartikel' : (form.label_de || 'Artikel bearbeiten')}
              </h1>
              {!isNew && (
                <div className="flex items-center gap-2 mt-0.5">
                  <AdminStatusBadge status={form.status} />
                  {form.status === 'published' && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Slug gesperrt
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AdminSaveState state={saveState.state} isDirty={saveState.isDirty} errorMessage={saveState.errorMsg} />
            <button
              onClick={handleSave}
              disabled={saveState.state === 'saving'}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
            >
              {saveState.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* Grunddaten */}
        <Section title="Grunddaten">
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3">
                <label className="FLabel">Titel <span className="text-red-500">*</span></label>
                <input className="FInput" value={form.label_de} onChange={(e) => update({ label_de: e.target.value })} placeholder="Berufseinstieg als Fitness-Trainer" />
              </div>
              <div>
                <label className="FLabel">Emoji-Icon</label>
                <input className="FInput" value={form.icon} onChange={(e) => update({ icon: e.target.value })} placeholder="ðŸŽ“" />
              </div>
            </div>

            <div>
              <label className="FLabel">Slug <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  className="FInput font-mono"
                  value={form.slug}
                  onChange={(e) => { setAutoSlug(false); update({ slug: e.target.value }); }}
                  placeholder="berufseinstieg"
                  disabled={form.status === 'published'}
                />
                {form.status !== 'published' && (
                  <button type="button" onClick={() => {
                    setAutoSlug(true);
                    setForm((previous) => {
                      const nextSlug = slugify(previous.label_de);
                      return previous.slug === nextSlug ? previous : { ...previous, slug: nextSlug };
                    });
                  }}
                    className="px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg whitespace-nowrap">
                    Aus Titel
                  </button>
                )}
              </div>
              {form.status === 'published' && (
                <p className="text-xs text-amber-600 mt-1">Slug ist gesperrt (Artikel publiziert).</p>
              )}
            </div>

            <div>
              <label className="FLabel">Teaser (Kurzbeschreibung)</label>
              <textarea className="FInput h-20 resize-none" value={form.teaser_de} onChange={(e) => update({ teaser_de: e.target.value })} placeholder="Kurze Beschreibung fÃ¼r die Karten-Anzeige (max. 200 Zeichen)" maxLength={250} />
            </div>

            <div>
              <label className="FLabel">Sortierung</label>
              <input type="number" className="FInput w-28" value={form.sort_order} onChange={(e) => update({ sort_order: parseInt(e.target.value, 10) || 0 })} />
            </div>
          </div>
        </Section>

        {/* Artikelinhalt */}
        <Section title="Artikelinhalt">
          <p className="text-xs text-gray-400 mb-3">HTML-Eingabe Â· wird serverseitig sanitiert</p>
          <AdminRichTextEditor
            value={form.content_html}
            onChange={(html) => update({ content_html: html })}
            placeholder="Artikelinhalt als HTMLâ€¦"
            minRows={25}
            id="scenario-editor"
          />
        </Section>

        {/* Quellen */}
        <Section title="Quellen">
          <p className="text-sm text-gray-500 mb-4">
            Erscheinen Ã¶ffentlich unter dem Artikel als Â«Quellen &amp; weiterfÃ¼hrende
            InformationenÂ». Ohne Eintrag wird der Bereich gar nicht angezeigt.
            Die Reihenfolge hier ist die Reihenfolge auf der Website.
          </p>

          {form.sources.length === 0 && (
            <p className="text-sm text-gray-400 mb-4">Noch keine Quellen erfasst.</p>
          )}

          <div className="space-y-4">
            {form.sources.map((source, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                data-testid={`source-row-${index}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500">
                    Quelle {index + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    {/* Reihenfolge = Anzeigereihenfolge auf der Artikelseite. */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveSource(index, -1)}
                        disabled={index === 0}
                        aria-label={`Quelle ${index + 1} nach oben`}
                        data-testid={`source-up-${index}`}
                        className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSource(index, 1)}
                        disabled={index === form.sources.length - 1}
                        aria-label={`Quelle ${index + 1} nach unten`}
                        data-testid={`source-down-${index}`}
                        className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSource(index)}
                      aria-label={`Quelle ${index + 1} entfernen`}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Entfernen
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="FLabel">Herausgeber <span className="text-red-500">*</span></label>
                    <input
                      className="FInput"
                      data-testid={`source-publisher-${index}`}
                      value={source.publisher}
                      onChange={(e) => updateSource(index, { publisher: e.target.value })}
                      placeholder="Staatssekretariat fÃ¼r Bildung, Forschung und Innovation SBFI"
                    />
                  </div>
                  <div>
                    <label className="FLabel">Titel <span className="text-red-500">*</span></label>
                    <input
                      className="FInput"
                      data-testid={`source-title-${index}`}
                      value={source.title}
                      onChange={(e) => updateSource(index, { title: e.target.value })}
                      placeholder="Subjektfinanzierung fÃ¼r vorbereitende Kurse"
                    />
                  </div>
                  <div>
                    <label className="FLabel">URL <span className="text-red-500">*</span></label>
                    <input
                      className="FInput font-mono text-xs"
                      data-testid={`source-url-${index}`}
                      value={source.url}
                      onChange={(e) => updateSource(index, { url: e.target.value })}
                      placeholder="https://www.sbfi.admin.ch/â€¦"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={addSource}
              disabled={form.sources.length >= MAX_SOURCES_PER_SCENARIO}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Quelle hinzufÃ¼gen
            </button>
            <span className="text-xs text-gray-400">
              {form.sources.length} von {MAX_SOURCES_PER_SCENARIO}
            </span>
          </div>
        </Section>

        {/* Redaktionelle PrÃ¼fung */}
        <Section title="Redaktionelle PrÃ¼fung">
          <p className="text-sm text-gray-500 mb-4">
            Datum der letzten inhaltlichen PrÃ¼fung. Wird Ã¶ffentlich als
            Â«Zuletzt redaktionell geprÃ¼ft: Monat JahrÂ» angezeigt. Ohne Datum
            steht kein PrÃ¼fhinweis unter dem Artikel â€” bitte nur setzen, wenn
            der Inhalt tatsÃ¤chlich geprÃ¼ft wurde.
          </p>
          <div>
            <label className="FLabel" htmlFor="scenario-last-reviewed-at">
              Zuletzt redaktionell geprÃ¼ft
            </label>
            <input
              id="scenario-last-reviewed-at"
              type="date"
              className="FInput w-48"
              data-testid="last-reviewed-at"
              value={form.last_reviewed_at}
              onChange={(e) => update({ last_reviewed_at: e.target.value })}
            />
          </div>
        </Section>

        {/* Bilder */}
        <Section title="Bilder">
          <div className="space-y-6">
            <AdminImageField
              currentUrl={form.card_image_url}
              altText={form.card_image_alt}
              folder="theme-world-scenarios"
              label="Karten-Bild (Anzeige auf Landingpage)"
              altRequired={!!form.card_image_url}
              onImageUploaded={({ publicUrl }) => update({ card_image_url: publicUrl })}
              onAltTextChange={(alt) => update({ card_image_alt: alt })}
            />
            <AdminImageField
              currentUrl={form.og_image_url}
              altText={form.og_image_alt}
              folder="theme-world-scenarios"
              label="Open-Graph-Bild (Social Media)"
              altRequired={false}
              onImageUploaded={({ publicUrl }) => update({ og_image_url: publicUrl })}
              onAltTextChange={(alt) => update({ og_image_alt: alt })}
            />
          </div>
        </Section>

        {/* SEO */}
        <Section title="SEO">
          <AdminSeoFields
            metaTitle={form.meta_title}
            metaDescription={form.meta_description}
            onChange={({ metaTitle, metaDescription }) => update({ meta_title: metaTitle, meta_description: metaDescription })}
          />
        </Section>

        {/* CTA */}
        <Section title="Call-to-Action (Suchverlinkung)">
          <p className="text-sm text-gray-500 mb-4">
            Strukturierte Suchparameter â€” keine freie URL-Eingabe.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="FLabel">CTA-Button-Text</label>
              <input className="FInput" value={form.cta_label_de} onChange={(e) => update({ cta_label_de: e.target.value })} placeholder="Jetzt Kurse entdecken" />
            </div>
            <div>
              <label className="FLabel">Spezialgebiet (spec)</label>
              <input className="FInput" value={form.cta_spec} onChange={(e) => update({ cta_spec: e.target.value })} placeholder="Fitness Trainer" />
            </div>
            <div>
              <label className="FLabel">Fokus (focus)</label>
              <input className="FInput" value={form.cta_focus} onChange={(e) => update({ cta_focus: e.target.value })} />
            </div>
            <div>
              <label className="FLabel">Standort (loc)</label>
              <input className="FInput" value={form.cta_loc} onChange={(e) => update({ cta_loc: e.target.value })} placeholder="ZÃ¼rich" />
            </div>
            <div>
              <label className="FLabel">Lieferart (delivery)</label>
              <select className="FInput" value={form.cta_delivery} onChange={(e) => update({ cta_delivery: e.target.value })}>
                <option value="">Keine EinschrÃ¤nkung</option>
                <option value="online_live">Online Live</option>
                <option value="self_study">Selbststudium</option>
                <option value="presence">Vor Ort</option>
              </select>
            </div>
            <div>
              <label className="FLabel">Kursart (kursart)</label>
              <input className="FInput" value={form.cta_kursart} onChange={(e) => update({ cta_kursart: e.target.value })} placeholder="feriencamp" />
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <AdminSaveState state={saveState.state} isDirty={saveState.isDirty} errorMessage={saveState.errorMsg} />
          <button
            onClick={handleSave}
            disabled={saveState.state === 'saving'}
            className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
          >
            {saveState.state === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Speichern
          </button>
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-5 pb-3 border-b border-gray-100">{title}</h2>
      <div className="[&_.FLabel]:block [&_.FLabel]:text-sm [&_.FLabel]:font-semibold [&_.FLabel]:text-gray-700 [&_.FLabel]:mb-1 [&_.FInput]:w-full [&_.FInput]:p-2.5 [&_.FInput]:border [&_.FInput]:rounded-lg [&_.FInput]:text-sm [&_.FInput]:focus:ring-2 [&_.FInput]:focus:ring-purple-500 [&_.FInput]:outline-none">
        {children}
      </div>
    </div>
  );
}
