import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CATEGORY_TYPES, COURSE_LEVELS, AGE_GROUPS } from '../lib/constants'; // Import constants for dropdowns
import { Save, Trash2, Edit, Plus, ArrowLeft, Bold, Search, Link as LinkIcon, X, LayoutTemplate, Filter } from 'lucide-react';

export default function AdminBlogManager({ showNotification, setView, courses }) {
  const [articles, setArticles] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [linkToolMode, setLinkToolMode] = useState(null); 
  
  // Form State
  const [formData, setFormData] = useState({
    title: '', slug: '', excerpt: '', content: '', image_url: '', is_published: false, related_config: {}
  });

  // Link Tool State for Inline Editor
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [searchParams, setSearchParams] = useState({ q: '', loc: '', label: '' });

  useEffect(() => { fetchArticles(); }, []);

  const fetchArticles = async () => {
    const { data } = await supabase.from('articles').select('*').order('created_at', { ascending: false });
    if (data) setArticles(data);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug) return showNotification("Titel und Slug sind Pflichtfelder.");
    const cleanSlug = formData.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const payload = { ...formData, slug: cleanSlug };
    
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
      setIsEditing(false);
      fetchArticles();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Artikel wirklich löschen?")) return;
    await supabase.from('articles').delete().eq('id', id);
    fetchArticles();
  };

  const insertText = (textToInsert) => {
    const textarea = document.getElementById('blog-editor');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    setFormData({ ...formData, content: before + textToInsert + after });
    setTimeout(() => textarea.focus(), 0);
  };

  const insertTag = (tag, closeTag = null) => {
    const textarea = document.getElementById('blog-editor');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = textarea.value.substring(start, end);
    const effectiveClose = closeTag || `</${tag.replace('<', '').replace('>', '')}>`;
    insertText(tag + selection + effectiveClose);
  };

  // --- SMART LINK GENERATORS (INLINE) ---
  const generateCourseLink = () => {
    if (!selectedCourseId) return;
    const course = courses.find(c => c.id.toString() === selectedCourseId);
    if (course) {
        const topicSlug = (course.category_area || 'kurs').toLowerCase().replace(/_/g, '-');
        const locSlug = (course.canton || 'schweiz').toLowerCase();
        const titleSlug = (course.title || 'detail').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const url = `/courses/${topicSlug}/${locSlug}/${course.id}-${titleSlug}`;
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
      setFormData(prev => ({
          ...prev,
          related_config: { ...prev.related_config, [key]: value }
      }));
  };

  if (isEditing) {
    return (
      <div className="p-6 max-w-5xl mx-auto bg-white shadow-xl rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setIsEditing(false)} className="flex items-center text-gray-600 hover:text-primary">
            <ArrowLeft className="w-5 h-5 mr-1" /> Zurück
          </button>
          <h2 className="text-2xl font-heading font-bold">Editor</h2>
          <button onClick={handleSave} className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-orange-600">
            <Save className="w-4 h-4 mr-2" /> Speichern
          </button>
        </div>

        {/* METADATA */}
        <div className="grid gap-4 mb-6">
          <input type="text" placeholder="H1 Titel" className="w-full p-3 border rounded font-bold text-lg" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
             <input type="text" placeholder="slug-url" className="w-full p-3 border rounded font-mono text-sm" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} />
             <div className="flex items-center space-x-2"><input type="checkbox" checked={formData.is_published} onChange={e => setFormData({...formData, is_published: e.target.checked})} /> <label>Veröffentlicht</label></div>
          </div>
          <input type="text" placeholder="Bild URL" className="w-full p-3 border rounded" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} />
          <textarea placeholder="Vorschau Text (Excerpt)" className="w-full p-3 border rounded h-20" value={formData.excerpt} onChange={e => setFormData({...formData, excerpt: e.target.value})} />
        </div>

        {/* TOOLBAR */}
        <div className="bg-gray-100 p-2 rounded-t-lg border border-b-0 flex flex-wrap gap-2 items-center">
            <ToolBtn onClick={() => insertTag('<h2>', '</h2>')} label="H2" />
            <ToolBtn onClick={() => insertTag('<h3>', '</h3>')} label="H3" />
            <ToolBtn onClick={() => insertTag('<strong>', '</strong>')} icon={<Bold size={16}/>} />
            <ToolBtn onClick={() => insertTag('<ul>\n<li>', '</li>\n</ul>')} label="List" />
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button onClick={() => setLinkToolMode(linkToolMode === 'course' ? null : 'course')} className={`px-3 py-1 text-xs font-bold rounded flex items-center ${linkToolMode === 'course' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-50 text-blue-600'}`}><LinkIcon size={14} className="mr-1"/> Kurs-Link</button>
            <button onClick={() => setLinkToolMode(linkToolMode === 'search' ? null : 'search')} className={`px-3 py-1 text-xs font-bold rounded flex items-center ${linkToolMode === 'search' ? 'bg-purple-600 text-white' : 'bg-white hover:bg-purple-50 text-purple-600'}`}><Search size={14} className="mr-1"/> Such-Link</button>
        </div>

        {/* INLINE LINK TOOLS */}
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
        
        <textarea id="blog-editor" placeholder="Artikel Inhalt..." className="w-full p-4 border rounded-b-lg h-[500px] font-mono text-sm leading-relaxed focus:ring-2 focus:ring-primary outline-none" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />

        {/* --- SECTION: EMPFEHLUNGEN (CTA) - ERWEITERT --- */}
        <div className="mt-8 bg-orange-50 p-6 rounded-xl border border-orange-100">
            <div className="flex items-center mb-4 text-orange-800">
                <LayoutTemplate className="w-5 h-5 mr-2" />
                <h3 className="font-heading font-bold text-lg">Empfehlungen (Call-to-Action)</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
                {/* 1. Einzelner Kurs */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Hervorgehobener Kurs</label>
                    <select 
                        className="w-full p-2 border rounded bg-white text-sm"
                        value={formData.related_config?.course_id || ''}
                        onChange={(e) => updateRelated('course_id', e.target.value)}
                    >
                        <option value="">-- Keinen Kurs anzeigen --</option>
                        {(courses || []).map(c => <option key={c.id} value={c.id}>{c.title} ({c.price} CHF)</option>)}
                    </select>
                </div>

                {/* 2. Komplexer Such Button */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center"><Filter className="w-4 h-4 mr-1"/> Such-Button Konfiguration</label>
                    <div className="space-y-3 p-4 bg-white rounded border border-gray-200">
                        <input 
                            type="text" placeholder="Button Label (z.B. 'Alle Kinder-Englisch Kurse')" 
                            className="w-full p-2 border rounded text-sm font-bold text-primary"
                            value={formData.related_config?.search_label || ''}
                            onChange={(e) => updateRelated('search_label', e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Suchbegriff (q)" className="p-2 border rounded text-sm" value={formData.related_config?.search_q || ''} onChange={(e) => updateRelated('search_q', e.target.value)} />
                            <input type="text" placeholder="Ort (loc)" className="p-2 border rounded text-sm" value={formData.related_config?.search_loc || ''} onChange={(e) => updateRelated('search_loc', e.target.value)} />
                        </div>
                        
                        {/* Dropdowns for Categories */}
                        <div className="grid grid-cols-2 gap-2">
                             <select className="p-2 border rounded text-sm" value={formData.related_config?.search_type || ''} onChange={(e) => updateRelated('search_type', e.target.value)}>
                                <option value="">- Kategorie Typ -</option>
                                {Object.entries(CATEGORY_TYPES).map(([key, label]) => <option key={key} value={key}>{key}</option>)}
                             </select>
                             <select className="p-2 border rounded text-sm" value={formData.related_config?.search_level || ''} onChange={(e) => updateRelated('search_level', e.target.value)}>
                                <option value="">- Level -</option>
                                {COURSE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                             </select>
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                             <select className="p-2 border rounded text-sm" value={formData.related_config?.search_age || ''} onChange={(e) => updateRelated('search_age', e.target.value)}>
                                <option value="">- Zielgruppe -</option>
                                {Object.keys(AGE_GROUPS).map(k => <option key={k} value={k}>{k}</option>)}
                             </select>
                             <input type="text" placeholder="Spezialgebiet (Key)" className="p-2 border rounded text-sm" value={formData.related_config?.search_spec || ''} onChange={(e) => updateRelated('search_spec', e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-heading font-bold text-dark">Blog Management</h1>
        <button onClick={() => { setFormData({ related_config: {} }); setIsEditing(true); }} className="bg-primary text-white px-4 py-2 rounded flex items-center"><Plus className="w-4 h-4 mr-2" /> Neuer Artikel</button>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-gray-100 border-b"><tr><th className="p-4">Titel</th><th className="p-4">Status</th><th className="p-4">Datum</th><th className="p-4 text-right">Aktionen</th></tr></thead>
            <tbody>
                {articles.map(art => (
                    <tr key={art.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-medium">{art.title}</td>
                        <td className="p-4">{art.is_published ? <span className="text-green-600 text-xs font-bold bg-green-100 px-2 py-1 rounded">Online</span> : <span className="text-yellow-600 text-xs font-bold bg-yellow-100 px-2 py-1 rounded">Entwurf</span>}</td>
                        <td className="p-4 text-sm text-gray-500">{new Date(art.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-right space-x-2">
                            <button onClick={() => { setFormData(art); setIsEditing(true); }} className="p-2 text-blue-600"><Edit size={18}/></button>
                            <button onClick={() => handleDelete(art.id)} className="p-2 text-red-600"><Trash2 size={18}/></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}

const ToolBtn = ({ onClick, label, icon }) => (
    <button type="button" onClick={onClick} className="px-3 py-1 bg-white border rounded hover:bg-gray-50 text-xs font-bold flex items-center min-h-[24px]">{icon || label}</button>
);