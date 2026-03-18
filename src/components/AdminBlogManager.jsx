import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatPriceCHF } from '../lib/formatPrice';
import { buildCoursePath } from '../lib/siteConfig';
import imageCompression from 'browser-image-compression';
import { computeImageHash, getExistingImageByHash, uploadImageWithHash } from '../lib/imageUtils';
import { Save, Trash2, Edit, Plus, ArrowLeft, Bold, Search, Link as LinkIcon, X, Layout, Filter, Globe, ExternalLink, Image } from 'lucide-react';

const compressImage = async (file) => {
    if (file.size <= 500 * 1024) return file;
    const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/jpeg'
    };
    try {
        return await imageCompression(file, options);
    } catch (error) {
        console.warn('Bildkomprimierung fehlgeschlagen, Original wird verwendet:', error);
        return file;
    }
};

export default function AdminBlogManager({ showNotification, setView, courses }) {
  const [articles, setArticles] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [linkToolMode, setLinkToolMode] = useState(null);
  const cursorRef = useRef(null);

  // Image upload state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // FALLBACK CONSTANTS
  const LOCAL_CATEGORY_TYPES = {
      'beruflich': 'Beruflich',
      'privat_hobby': 'Privat & Hobby',
      'kinder_jugend': 'Kinder & Jugend'
  };
  const LOCAL_LEVELS = ['all_levels', 'beginner', 'intermediate', 'advanced'];
  const LOCAL_AGE_GROUPS = {
      'age_0_3': '0-3 Jahre',
      'age_4_6': '4-6 Jahre',
      'age_7_9': '7-9 Jahre',
      'age_10_12': '10-12 Jahre',
      'age_13_17': '13-17 Jahre',
      'age_18_25': '18-25 Jahre',
      'age_26_59': '26-59 Jahre',
      'age_60_plus': '60+ Jahre'
  };

  const initialFormState = {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    image_url: '',
    meta_title: '',
    meta_description: '',
    social_teaser: '',
    is_published: false,
    related_config: {
        course_id: '',
        search_label: '',
        search_q: '',
        search_loc: '',
        search_type: '',
        search_level: '',
        search_age: '',
        search_spec: '',
        link_cards: []
    }
  };

  const [formData, setFormData] = useState(initialFormState);

  // Link Tool State
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [searchParams, setSearchParams] = useState({ q: '', loc: '', label: '' });
  const [genericLink, setGenericLink] = useState({ url: '', text: '' });

  const fetchArticles = async () => {
    const { data } = await supabase.from('articles').select('*').order('created_at', { ascending: false });
    if (data) setArticles(data);
  };

  useEffect(() => { fetchArticles(); }, []);

  // Cursor restore after content change
  useEffect(() => {
    if (cursorRef.current !== null) {
      const textarea = document.getElementById('blog-editor');
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(cursorRef.current, cursorRef.current);
      }
      cursorRef.current = null;
    }
  }, [formData.content]);

  // Cleanup image preview URL
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleCreateNew = () => {
      setFormData(JSON.parse(JSON.stringify(initialFormState)));
      setImageFile(null);
      setImagePreview(null);
      setIsEditing(true);
  };

  const handleEdit = (article) => {
      setFormData({
          ...article,
          meta_title: article.meta_title || '',
          meta_description: article.meta_description || '',
          social_teaser: article.social_teaser || '',
          related_config: {
              ...initialFormState.related_config,
              ...(article.related_config || {}),
              link_cards: article.related_config?.link_cards || []
          }
      });
      setImageFile(null);
      setImagePreview(null);
      setIsEditing(true);
  };

  // --- Image Upload ---
  const handleBlogImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadBlogImage = async () => {
    if (!imageFile) return formData.image_url || '';
    setIsUploading(true);
    try {
      const compressed = await compressImage(imageFile);
      const hash = await computeImageHash(compressed);
      const existing = await getExistingImageByHash(hash, 'blog/');
      if (existing) { setIsUploading(false); return existing; }
      const url = await uploadImageWithHash(compressed, hash, 'blog/');
      setIsUploading(false);
      return url;
    } catch (err) {
      setIsUploading(false);
      throw err;
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug) return showNotification("Titel und Slug sind Pflichtfelder.");
    const cleanSlug = formData.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    let imageUrl = formData.image_url || '';
    if (imageFile) {
      try {
        imageUrl = await uploadBlogImage();
      } catch (err) {
        return showNotification("Bild-Upload fehlgeschlagen: " + err.message);
      }
    }

    const payload = { ...formData, slug: cleanSlug, image_url: imageUrl };
    // Remove undefined values to avoid Supabase errors
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    let error;
    if (formData.id) {
      const { error: err } = await supabase.from('articles').update(payload).eq('id', formData.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('articles').insert([payload]);
      error = err;
    }

    if (error) showNotification("Fehler: " + error.message);
    else {
      showNotification("Artikel gespeichert!");
      setImageFile(null);
      setImagePreview(null);
      setIsEditing(false);
      fetchArticles();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Artikel wirklich löschen?")) return;
    await supabase.from('articles').delete().eq('id', id);
    fetchArticles();
  };

  // --- Text Insertion (with cursor restore) ---
  const insertText = (textToInsert) => {
    const textarea = document.getElementById('blog-editor');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value || '';
    const before = text.substring(0, start);
    const after = text.substring(end);
    cursorRef.current = start + textToInsert.length;
    setFormData(prev => ({ ...prev, content: before + textToInsert + after }));
  };

  const insertTag = (tag, closeTag = null) => {
    const textarea = document.getElementById('blog-editor');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value || '';
    const selection = text.substring(start, end);
    const effectiveClose = closeTag || `</${tag.replace('<', '').replace('>', '')}>`;
    const fullInsert = tag + selection + effectiveClose;
    cursorRef.current = start + tag.length + selection.length;
    setFormData(prev => ({
      ...prev,
      content: text.substring(0, start) + fullInsert + text.substring(end)
    }));
  };

  const generateCourseLink = () => {
    if (!selectedCourseId) return;
    const course = (courses || []).find(c => c.id.toString() === selectedCourseId);
    if (course) {
        const url = buildCoursePath(course);
        insertText(`<a href="${url}" title="${course.title}">${course.title}</a>`);
        setLinkToolMode(null);
    }
  };

  const generateSearchLink = () => {
    const { q, loc, label } = searchParams;
    if (!label) return showNotification("Bitte Link-Text eingeben");
    let url = '/search?';
    const params = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (loc) params.push(`loc=${encodeURIComponent(loc)}`);
    insertText(`<a href="${url}${params.join('&')}">${label}</a>`);
    setLinkToolMode(null);
    setSearchParams({ q: '', loc: '', label: '' });
  };

  const updateRelated = (key, value) => {
      setFormData(prev => {
          const safeConfig = prev.related_config || {};
          return {
            ...prev,
            related_config: { ...safeConfig, [key]: value }
          };
      });
  };

  // --- Link Cards ---
  const updateLinkCards = (cards) => {
    setFormData(prev => ({
      ...prev,
      related_config: { ...(prev.related_config || {}), link_cards: cards }
    }));
  };

  const addLinkCard = () => {
    const cards = [...(formData.related_config?.link_cards || [])];
    cards.push({ type: 'external', title: '', description: '', url: '', icon: '' });
    updateLinkCards(cards);
  };

  const removeLinkCard = (index) => {
    const cards = [...(formData.related_config?.link_cards || [])];
    cards.splice(index, 1);
    updateLinkCards(cards);
  };

  const updateLinkCard = (index, key, value) => {
    const cards = [...(formData.related_config?.link_cards || [])];
    cards[index] = { ...cards[index], [key]: value };
    updateLinkCards(cards);
  };

  if (isEditing) {
    if (!formData) return <div>Lade Editor...</div>;
    const config = formData.related_config || {};

    return (
      <div className="p-6 max-w-5xl mx-auto bg-white shadow-xl rounded-xl mt-6">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setIsEditing(false)} className="flex items-center text-gray-600 hover:text-primary">
            <ArrowLeft className="w-5 h-5 mr-1" /> Zurück zur Liste
          </button>
          <h2 className="text-2xl font-heading font-bold">Artikel Editor</h2>
          <button onClick={handleSave} disabled={isUploading} className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-orange-600 shadow-md disabled:opacity-50">
            <Save className="w-4 h-4 mr-2" /> {isUploading ? 'Lädt hoch...' : 'Speichern'}
          </button>
        </div>

        {/* METADATA */}
        <div className="grid gap-4 mb-6">
          <input type="text" placeholder="H1 Titel" className="w-full p-3 border rounded font-bold text-lg focus:ring-2 focus:ring-primary outline-none" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
             <input type="text" placeholder="slug-url" className="w-full p-3 border rounded font-mono text-sm bg-gray-50" value={formData.slug || ''} onChange={e => setFormData({...formData, slug: e.target.value})} />
             <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded border"><input type="checkbox" checked={formData.is_published || false} onChange={e => setFormData({...formData, is_published: e.target.checked})} /> <label className="font-medium">Veröffentlicht</label></div>
          </div>

          {/* IMAGE UPLOAD */}
          <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center"><Image className="w-4 h-4 mr-1" /> Artikelbild</label>
            <div className="flex items-center gap-4">
              {(imagePreview || formData.image_url) && (
                <div className="relative shrink-0">
                  <img src={imagePreview || formData.image_url} className="w-20 h-20 rounded-lg object-cover shadow-sm" alt="Vorschau" />
                  {imagePreview && (
                    <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">Neu</span>
                  )}
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleBlogImageChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-orange-600 cursor-pointer" />
            </div>
            {isUploading && <p className="text-xs text-orange-500 mt-2 animate-pulse">Bild wird hochgeladen...</p>}
            <p className="text-xs text-gray-500 mt-1">Max. 5 MB. Wird automatisch komprimiert und als JPEG gespeichert.</p>
          </div>

          <textarea placeholder="Vorschau Text (Excerpt) für die Blog-Übersicht..." className="w-full p-3 border rounded h-24 resize-none" value={formData.excerpt || ''} onChange={e => setFormData({...formData, excerpt: e.target.value})} />

          {/* SEO & META */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
            <h3 className="text-sm font-bold text-blue-800">SEO & Social Media (optional)</h3>
            <input type="text" placeholder="Meta Titel (falls anders als H1)" className="w-full p-2 border rounded text-sm" maxLength={70}
              value={formData.meta_title || ''} onChange={e => setFormData({...formData, meta_title: e.target.value})} />
            <textarea placeholder="Meta Description (max. 155 Zeichen)" className="w-full p-2 border rounded text-sm h-16 resize-none" maxLength={160}
              value={formData.meta_description || ''} onChange={e => setFormData({...formData, meta_description: e.target.value})} />
            <input type="text" placeholder="Social Teaser (für OG/Twitter Cards)" className="w-full p-2 border rounded text-sm"
              value={formData.social_teaser || ''} onChange={e => setFormData({...formData, social_teaser: e.target.value})} />
            <p className="text-xs text-blue-600">Wenn leer, werden Titel und Inhalt automatisch verwendet.</p>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bg-gray-100 p-2 rounded-t-lg border border-b-0 flex flex-wrap gap-2 items-center sticky top-0 z-10">
            <ToolBtn onClick={() => insertTag('<h2>', '</h2>')} label="H2" />
            <ToolBtn onClick={() => insertTag('<h3>', '</h3>')} label="H3" />
            <ToolBtn onClick={() => insertTag('<strong>', '</strong>')} icon={<Bold size={16}/>} />
            <ToolBtn onClick={() => insertTag('<ul>\n<li>', '</li>\n</ul>')} label="List" />
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button onClick={() => setLinkToolMode(linkToolMode === 'generic' ? null : 'generic')} className={`px-3 py-1 text-xs font-bold rounded flex items-center ${linkToolMode === 'generic' ? 'bg-green-600 text-white' : 'bg-white hover:bg-green-50 text-green-600'}`}><Globe size={14} className="mr-1"/> Link</button>
            <button onClick={() => setLinkToolMode(linkToolMode === 'course' ? null : 'course')} className={`px-3 py-1 text-xs font-bold rounded flex items-center ${linkToolMode === 'course' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-50 text-blue-600'}`}><LinkIcon size={14} className="mr-1"/> Kurs-Link</button>
            <button onClick={() => setLinkToolMode(linkToolMode === 'search' ? null : 'search')} className={`px-3 py-1 text-xs font-bold rounded flex items-center ${linkToolMode === 'search' ? 'bg-purple-600 text-white' : 'bg-white hover:bg-purple-50 text-purple-600'}`}><Search size={14} className="mr-1"/> Such-Link</button>
        </div>

        {/* INLINE LINK TOOLS */}
        {linkToolMode === 'generic' && (
            <div className="bg-green-50 p-3 border-x border-green-100 flex items-center gap-2 flex-wrap animate-in slide-in-from-top-2">
                <input type="text" placeholder="Link Text" className="p-1 text-sm border rounded w-40"
                    value={genericLink.text} onChange={e => setGenericLink({...genericLink, text: e.target.value})} />
                <input type="text" placeholder="URL (https://... oder /seite)" className="p-1 text-sm border rounded flex-grow"
                    value={genericLink.url} onChange={e => setGenericLink({...genericLink, url: e.target.value})} />
                <button onClick={() => {
                    if (!genericLink.text || !genericLink.url) return showNotification("Bitte URL und Text eingeben");
                    const isInternal = genericLink.url.startsWith('/');
                    const attrs = isInternal ? '' : ' target="_blank" rel="noopener noreferrer"';
                    insertText(`<a href="${genericLink.url}"${attrs}>${genericLink.text}</a>`);
                    setLinkToolMode(null);
                    setGenericLink({ url: '', text: '' });
                }} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">Einfügen</button>
                <button onClick={() => setLinkToolMode(null)}><X size={16} className="text-green-400"/></button>
            </div>
        )}
        {linkToolMode === 'course' && (
            <div className="bg-blue-50 p-3 border-x border-blue-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                <span className="text-xs font-bold text-blue-800">Kurs wählen:</span>
                <select className="flex-grow p-1 text-sm border rounded" onChange={(e) => setSelectedCourseId(e.target.value)} value={selectedCourseId}>
                    <option value="">-- Bitte wählen --</option>
                    {(courses || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <button onClick={generateCourseLink} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">Einfügen</button>
                <button onClick={() => setLinkToolMode(null)}><X size={16} className="text-blue-400"/></button>
            </div>
        )}
        {linkToolMode === 'search' && (
            <div className="bg-purple-50 p-3 border-x border-purple-100 flex items-center gap-2 flex-wrap animate-in slide-in-from-top-2">
                <input type="text" placeholder="Link Text" className="p-1 text-sm border rounded w-48" value={searchParams.label} onChange={e => setSearchParams({...searchParams, label: e.target.value})} />
                <input type="text" placeholder="Suchbegriff (z.B. IT)" className="p-1 text-sm border rounded w-32" value={searchParams.q} onChange={e => setSearchParams({...searchParams, q: e.target.value})} />
                <button onClick={generateSearchLink} className="bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold">Einfügen</button>
                <button onClick={() => setLinkToolMode(null)}><X size={16} className="text-purple-400"/></button>
            </div>
        )}

        <textarea id="blog-editor" placeholder="Artikel Inhalt (HTML erlaubt)..." className="w-full p-4 border rounded-b-lg h-[500px] font-mono text-sm leading-relaxed focus:ring-2 focus:ring-primary outline-none" value={formData.content || ''} onChange={e => setFormData({...formData, content: e.target.value})} />

        {/* --- SECTION: EMPFEHLUNGEN (CTA) --- */}
        <div className="mt-8 bg-orange-50 p-6 rounded-xl border border-orange-100">
            <div className="flex items-center mb-4 text-orange-800">
                <Layout className="w-5 h-5 mr-2" />
                <h3 className="font-heading font-bold text-lg">Seitenleiste Empfehlungen (Call-to-Action)</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
                {/* 1. Einzelner Kurs */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Hervorgehobener Kurs</label>
                    <select
                        className="w-full p-2 border rounded bg-white text-sm"
                        value={config.course_id || ''}
                        onChange={(e) => updateRelated('course_id', e.target.value)}
                    >
                        <option value="">-- Keinen Kurs anzeigen --</option>
                        {(courses || []).map(c => <option key={c.id} value={c.id}>{c.title} ({formatPriceCHF(c.price)} CHF)</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Zeigt eine Kurskarte in der Sidebar an.</p>
                </div>

                {/* 2. Komplexer Such Button */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center"><Filter className="w-4 h-4 mr-1"/> Such-Button Konfiguration</label>
                    <div className="space-y-3 p-4 bg-white rounded border border-gray-200">
                        <input
                            type="text" placeholder="Button Label (z.B. 'Alle Kinder-Englisch Kurse')"
                            className="w-full p-2 border rounded text-sm font-bold text-primary"
                            value={config.search_label || ''}
                            onChange={(e) => updateRelated('search_label', e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Suchbegriff (q)" className="p-2 border rounded text-sm" value={config.search_q || ''} onChange={(e) => updateRelated('search_q', e.target.value)} />
                            <input type="text" placeholder="Ort (loc)" className="p-2 border rounded text-sm" value={config.search_loc || ''} onChange={(e) => updateRelated('search_loc', e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                             <select className="p-2 border rounded text-sm" value={config.search_type || ''} onChange={(e) => updateRelated('search_type', e.target.value)}>
                                <option value="">- Kategorie Typ -</option>
                                {Object.entries(LOCAL_CATEGORY_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                             </select>
                             <select className="p-2 border rounded text-sm" value={config.search_level || ''} onChange={(e) => updateRelated('search_level', e.target.value)}>
                                <option value="">- Level -</option>
                                {LOCAL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                             </select>
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                             <select className="p-2 border rounded text-sm" value={config.search_age || ''} onChange={(e) => updateRelated('search_age', e.target.value)}>
                                <option value="">- Zielgruppe -</option>
                                {Object.entries(LOCAL_AGE_GROUPS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                             </select>
                             <input type="text" placeholder="Spezialgebiet (Key)" className="p-2 border rounded text-sm" value={config.search_spec || ''} onChange={(e) => updateRelated('search_spec', e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* --- SECTION: LINK CARDS --- */}
        <div className="mt-8 bg-green-50 p-6 rounded-xl border border-green-100">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-green-800">
                    <ExternalLink className="w-5 h-5 mr-2" />
                    <h3 className="font-heading font-bold text-lg">Link-Karten (unterhalb des Artikels)</h3>
                </div>
                <button type="button" onClick={addLinkCard}
                    className="flex items-center bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700">
                    <Plus className="w-3 h-3 mr-1" /> Karte hinzufügen
                </button>
            </div>

            {(config.link_cards || []).length === 0 && (
                <p className="text-sm text-gray-500">Noch keine Link-Karten. Klicke "Karte hinzufügen" um eine Karte zu erstellen.</p>
            )}

            <div className="space-y-4">
                {(config.link_cards || []).map((card, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg border border-green-200 relative">
                        <button type="button" onClick={() => removeLinkCard(i)}
                            className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                            <Trash2 size={16} />
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                            <select className="p-2 border rounded text-sm" value={card.type || 'external'}
                                onChange={e => updateLinkCard(i, 'type', e.target.value)}>
                                <option value="external">Externer Link</option>
                                <option value="internal">Interne Seite</option>
                                <option value="search">Suche</option>
                            </select>
                            <input type="text" placeholder="Icon Emoji (z.B. 🎯)" className="p-2 border rounded text-sm"
                                value={card.icon || ''} onChange={e => updateLinkCard(i, 'icon', e.target.value)} />
                            <input type="text" placeholder="Titel" className="p-2 border rounded text-sm col-span-2 font-bold"
                                value={card.title || ''} onChange={e => updateLinkCard(i, 'title', e.target.value)} />
                            <input type="text" placeholder="Beschreibung" className="p-2 border rounded text-sm col-span-2"
                                value={card.description || ''} onChange={e => updateLinkCard(i, 'description', e.target.value)} />
                            <input type="text" placeholder={card.type === 'external' ? 'https://...' : '/search?q=yoga'}
                                className="p-2 border rounded text-sm col-span-2 font-mono"
                                value={card.url || ''} onChange={e => updateLinkCard(i, 'url', e.target.value)} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
            <button
                onClick={() => setView('admin')}
                className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-sm border border-gray-200 transition text-gray-600"
                title="Zurück zum Control Room"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-heading font-bold text-dark">Blog Management</h1>
        </div>
        <button onClick={handleCreateNew} className="bg-primary text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-orange-600 transition flex items-center font-bold">
            <Plus className="w-5 h-5 mr-2" /> Neuer Artikel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {articles.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
                <p>Noch keine Artikel vorhanden.</p>
            </div>
        ) : (
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="p-4 font-semibold text-gray-600">Titel</th>
                        <th className="p-4 font-semibold text-gray-600">Status</th>
                        <th className="p-4 font-semibold text-gray-600">Erstellt am</th>
                        <th className="p-4 text-right font-semibold text-gray-600">Aktionen</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {articles.map(art => (
                        <tr key={art.id} className="hover:bg-gray-50 transition">
                            <td className="p-4 font-bold text-gray-800">{art.title}</td>
                            <td className="p-4">
                                {art.is_published ?
                                    <span className="text-green-700 text-xs font-bold bg-green-100 px-2 py-1 rounded-full border border-green-200">Online</span> :
                                    <span className="text-yellow-700 text-xs font-bold bg-yellow-100 px-2 py-1 rounded-full border border-yellow-200">Entwurf</span>
                                }
                            </td>
                            <td className="p-4 text-sm text-gray-500">{new Date(art.created_at).toLocaleDateString()}</td>
                            <td className="p-4 text-right flex justify-end gap-2">
                                <button onClick={() => handleEdit(art)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition" title="Bearbeiten"><Edit size={18}/></button>
                                <button onClick={() => handleDelete(art.id)} className="p-2 text-red-500 hover:bg-red-50 rounded transition" title="Löschen"><Trash2 size={18}/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
}

const ToolBtn = ({ onClick, label, icon }) => (
    <button type="button" onClick={onClick} className="px-3 py-1 bg-white border rounded hover:bg-gray-50 text-xs font-bold flex items-center min-h-[28px] shadow-sm text-gray-700">{icon || label}</button>
);
