import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Trash2, Edit, Plus, Eye, ArrowLeft, Bold, List, Heading, Image as ImageIcon } from 'lucide-react';

export default function AdminBlogManager({ showNotification, setView }) {
  const [articles, setArticles] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '', slug: '', excerpt: '', content: '', image_url: '', is_published: false
  });

  useEffect(() => { fetchArticles(); }, []);

  const fetchArticles = async () => {
    const { data, error } = await supabase.from('articles').select('*').order('created_at', { ascending: false });
    if (data) setArticles(data);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug) return showNotification("Titel und Slug sind Pflichtfelder.");
    
    // Auto-generate slug if empty (safety)
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

  const insertTag = (tag, closeTag = null) => {
    const textarea = document.getElementById('blog-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);
    
    const effectiveClose = closeTag || `</${tag.replace('<', '').replace('>', '')}>`;
    // Handle self-closing or simple tags
    const newText = before + tag + selection + effectiveClose + after;
    
    setFormData({ ...formData, content: newText });
    // Restore focus (basic implementation)
    setTimeout(() => textarea.focus(), 0);
  };

  if (isEditing) {
    return (
      <div className="p-6 max-w-4xl mx-auto bg-white shadow-xl rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setIsEditing(false)} className="flex items-center text-gray-600 hover:text-primary">
            <ArrowLeft className="w-5 h-5 mr-1" /> Zurück
          </button>
          <h2 className="text-2xl font-heading font-bold">Artikel Editor</h2>
          <button onClick={handleSave} className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-orange-600">
            <Save className="w-4 h-4 mr-2" /> Speichern
          </button>
        </div>

        <div className="grid gap-4 mb-6">
          <input 
            type="text" placeholder="Artikel Titel (H1)" className="w-full p-3 border rounded font-bold text-lg"
            value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} 
          />
          <div className="grid grid-cols-2 gap-4">
             <input 
              type="text" placeholder="URL-Slug (z.B. warum-yoga-gesund-ist)" className="w-full p-3 border rounded text-sm font-mono text-gray-600"
              value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} 
            />
            <div className="flex items-center space-x-2">
                <input type="checkbox" id="pub" checked={formData.is_published} onChange={e => setFormData({...formData, is_published: e.target.checked})} />
                <label htmlFor="pub" className="font-medium cursor-pointer">Veröffentlicht?</label>
            </div>
          </div>
          <input 
            type="text" placeholder="Titelbild URL (https://...)" className="w-full p-3 border rounded"
            value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} 
          />
          <textarea 
            placeholder="Kurzer Auszug (Meta Description & Vorschau)..." className="w-full p-3 border rounded h-24"
            value={formData.excerpt} onChange={e => setFormData({...formData, excerpt: e.target.value})} 
          />
        </div>

        {/* --- SIMPLE FORMATTING TOOLBAR --- */}
        <div className="bg-gray-100 p-2 rounded-t-lg border border-b-0 flex gap-2">
            <ToolBtn onClick={() => insertTag('<h2>', '</h2>')} label="H2" />
            <ToolBtn onClick={() => insertTag('<h3>', '</h3>')} label="H3" />
            <ToolBtn onClick={() => insertTag('<strong>', '</strong>')} icon={<Bold size={16}/>} />
            <ToolBtn onClick={() => insertTag('<em>', '</em>')} label="Italic" />
            <ToolBtn onClick={() => insertTag('<ul>\n<li>', '</li>\n</ul>')} label="List" />
            <ToolBtn onClick={() => insertTag('<a href="/courses/zuerich/yoga">', '</a>')} label="Link" />
            <ToolBtn onClick={() => insertTag('<br/>', '')} label="Absatz" />
        </div>
        
        <textarea 
          id="blog-editor"
          placeholder="Schreibe deinen Artikel hier... HTML ist erlaubt." 
          className="w-full p-4 border rounded-b-lg h-[500px] font-mono text-sm leading-relaxed focus:ring-2 focus:ring-primary outline-none"
          value={formData.content} 
          onChange={e => setFormData({...formData, content: e.target.value})} 
        />
        <div className="mt-2 text-xs text-gray-500">
            Tipp: Nutze <code>&lt;a href="/search?q=yoga"&gt;Text&lt;/a&gt;</code> für interne Links.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-heading font-bold text-dark">Blog Management</h1>
        <button onClick={() => { setFormData({}); setIsEditing(true); }} className="bg-primary text-white px-4 py-2 rounded hover:bg-orange-600 flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Neuer Artikel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-gray-100 border-b">
                <tr>
                    <th className="p-4">Titel</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Datum</th>
                    <th className="p-4 text-right">Aktionen</th>
                </tr>
            </thead>
            <tbody>
                {articles.map(art => (
                    <tr key={art.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-medium">{art.title} <br/><span className="text-xs text-gray-400 font-mono">/{art.slug}</span></td>
                        <td className="p-4">
                            {art.is_published 
                                ? <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Online</span> 
                                : <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Entwurf</span>
                            }
                        </td>
                        <td className="p-4 text-sm text-gray-500">{new Date(art.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-right space-x-2">
                            <button onClick={() => { setFormData(art); setIsEditing(true); }} className="p-2 hover:bg-gray-200 rounded text-blue-600"><Edit size={18}/></button>
                            <button onClick={() => handleDelete(art.id)} className="p-2 hover:bg-gray-200 rounded text-red-600"><Trash2 size={18}/></button>
                        </td>
                    </tr>
                ))}
                {articles.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-gray-500">Keine Artikel gefunden.</td></tr>}
            </tbody>
        </table>
      </div>
    </div>
  );
}

const ToolBtn = ({ onClick, label, icon }) => (
    <button type="button" onClick={onClick} className="px-3 py-1 bg-white border rounded hover:bg-gray-50 text-xs font-bold flex items-center">
        {icon || label}
    </button>
);