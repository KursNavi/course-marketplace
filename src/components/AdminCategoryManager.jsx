import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Edit2, Save, X, Loader, AlertTriangle, FolderTree } from 'lucide-react';
import { invalidateTaxonomyCache } from '../hooks/useTaxonomy';

const ADMIN_PW = "KursNavi2025!";

const AdminCategoryManager = ({ showNotification }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [types, setTypes] = useState([]);
    const [areas, setAreas] = useState([]);
    const [specialties, setSpecialties] = useState([]);
    const [focuses, setFocuses] = useState([]);
    const [courseCounts, setCourseCounts] = useState({ types: {}, areas: {}, specialties: {}, focuses: {} });

    // UI State
    const [expandedTypes, setExpandedTypes] = useState({});
    const [expandedAreas, setExpandedAreas] = useState({});
    const [expandedSpecialties, setExpandedSpecialties] = useState({});
    const [editingItem, setEditingItem] = useState(null); // { entity, id, field }
    const [editValue, setEditValue] = useState('');

    // Add new item state
    const [addingTo, setAddingTo] = useState(null); // { entity: 'type'|'area'|'specialty'|'focus', parentId?: string|number }
    const [newItemData, setNewItemData] = useState({ id: '', label_de: '', label_en: '', label_fr: '', label_it: '', name: '' });

    // Delete modal state
    const [deleteModal, setDeleteModal] = useState(null); // { entity, id, name, courseCount, reassignOptions }
    const [reassignTo, setReassignTo] = useState('');

    // Refs for input focus
    const specialtyInputRef = useRef(null);
    const focusInputRef = useRef(null);
    const areaInputRef = useRef(null);
    const typeInputRef = useRef(null);

    // Load taxonomy data
    useEffect(() => {
        loadTaxonomy();
    }, []);

    // Maintain focus on input fields during typing
    useEffect(() => {
        if (addingTo?.entity === 'specialty' && specialtyInputRef.current) {
            specialtyInputRef.current.focus();
        }
        if (addingTo?.entity === 'focus' && focusInputRef.current) {
            focusInputRef.current.focus();
        }
    }, [newItemData.name, addingTo]);

    const loadTaxonomy = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/taxonomy', {
                headers: { 'x-admin-secret': ADMIN_PW }
            });
            if (!res.ok) throw new Error('Failed to load taxonomy');
            const data = await res.json();
            setTypes(data.types || []);
            setAreas(data.areas || []);
            setSpecialties(data.specialties || []);
            setFocuses(data.focuses || []);
            setCourseCounts(data.courseCounts || { types: {}, areas: {}, specialties: {}, focuses: {} });
        } catch (err) {
            console.error(err);
            showNotification('Fehler beim Laden der Kategorien');
        } finally {
            setLoading(false);
        }
    };

    // API helper
    const apiCall = async (action, entity, data) => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/taxonomy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': ADMIN_PW
                },
                body: JSON.stringify({ action, entity, data })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'API error');
            }
            invalidateTaxonomyCache();
            return await res.json();
        } finally {
            setSaving(false);
        }
    };

    // Toggle expansion
    const toggleType = (id) => setExpandedTypes(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleArea = (id) => setExpandedAreas(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleSpecialty = (id) => setExpandedSpecialties(prev => ({ ...prev, [id]: !prev[id] }));

    // Start editing
    const startEdit = (entity, id, field, currentValue) => {
        setEditingItem({ entity, id, field });
        setEditValue(currentValue || '');
    };

    // Save edit
    const saveEdit = async () => {
        if (!editingItem || !editValue.trim()) return;

        try {
            await apiCall('update', editingItem.entity, {
                id: editingItem.id,
                [editingItem.field]: editValue.trim()
            });
            await loadTaxonomy();
            showNotification('Gespeichert!');
        } catch (err) {
            showNotification('Fehler: ' + err.message);
        }
        setEditingItem(null);
        setEditValue('');
    };

    // Cancel edit
    const cancelEdit = () => {
        setEditingItem(null);
        setEditValue('');
    };

    // Add new item
    const startAdd = (entity, parentId = null) => {
        setAddingTo({ entity, parentId });
        setNewItemData({ id: '', label_de: '', label_en: '', label_fr: '', label_it: '', name: '' });
    };

    const saveNewItem = async () => {
        if (!addingTo) return;

        try {
            if (addingTo.entity === 'type') {
                if (!newItemData.id || !newItemData.label_de) {
                    showNotification('ID und deutscher Name erforderlich');
                    return;
                }
                await apiCall('create', 'type', newItemData);
            } else if (addingTo.entity === 'area') {
                if (!newItemData.id || !newItemData.label_de) {
                    showNotification('ID und deutscher Name erforderlich');
                    return;
                }
                await apiCall('create', 'area', { ...newItemData, type_id: addingTo.parentId });
            } else if (addingTo.entity === 'specialty') {
                if (!newItemData.name) {
                    showNotification('Name erforderlich');
                    return;
                }
                await apiCall('create', 'specialty', { area_id: addingTo.parentId, name: newItemData.name });
            } else if (addingTo.entity === 'focus') {
                if (!newItemData.name) {
                    showNotification('Name erforderlich');
                    return;
                }
                await apiCall('create', 'focus', { specialty_id: addingTo.parentId, name: newItemData.name });
            }

            await loadTaxonomy();
            showNotification('Kategorie erstellt!');
            setAddingTo(null);
        } catch (err) {
            showNotification('Fehler: ' + err.message);
        }
    };

    // Delete item
    const initiateDelete = async (entity, id, name) => {
        try {
            // Count affected courses
            const res = await apiCall('count_courses', entity, { id });
            const courseCount = res.count || 0;

            // Get reassign options
            let reassignOptions = [];
            if (entity === 'focus') {
                const focusItem = focuses.find(f => f.id === id);
                if (focusItem) {
                    reassignOptions = focuses
                        .filter(f => f.specialty_id === focusItem.specialty_id && f.id !== id)
                        .map(f => ({ id: f.id, label: f.name }));
                }
            } else if (entity === 'specialty') {
                const spec = specialties.find(s => s.id === id);
                if (spec) {
                    reassignOptions = specialties
                        .filter(s => s.area_id === spec.area_id && s.id !== id)
                        .map(s => ({ id: s.id, label: s.name }));
                }
            } else if (entity === 'area') {
                const area = areas.find(a => a.id === id);
                if (area) {
                    reassignOptions = areas
                        .filter(a => a.type_id === area.type_id && a.id !== id)
                        .map(a => ({ id: a.id, label: a.label_de }));
                }
            } else if (entity === 'type') {
                reassignOptions = types
                    .filter(t => t.id !== id)
                    .map(t => ({ id: t.id, label: t.label_de }));
            }

            setDeleteModal({ entity, id, name, courseCount, reassignOptions });
            setReassignTo('');
        } catch (err) {
            showNotification('Fehler: ' + err.message);
        }
    };

    const confirmDelete = async () => {
        if (!deleteModal) return;

        // If courses exist and no reassign target selected, require selection (except for focus which can just clear)
        if (deleteModal.courseCount > 0 && !reassignTo && deleteModal.entity !== 'focus') {
            showNotification('Bitte wähle eine Ziel-Kategorie für die Kurse');
            return;
        }

        try {
            await apiCall('delete', deleteModal.entity, {
                id: deleteModal.id,
                reassign_to: reassignTo || null
            });
            await loadTaxonomy();
            showNotification('Kategorie gelöscht!');
            setDeleteModal(null);
        } catch (err) {
            showNotification('Fehler: ' + err.message);
        }
    };

    // Render editable field
    const EditableField = ({ entity, id, field, value, className = '' }) => {
        const isEditing = editingItem?.entity === entity && editingItem?.id === id && editingItem?.field === field;

        if (isEditing) {
            return (
                <div className="flex items-center gap-1">
                    <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                        }}
                        className="px-2 py-1 border rounded text-sm w-48"
                        autoFocus
                    />
                    <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Save className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            );
        }

        return (
            <span
                className={`cursor-pointer hover:bg-yellow-50 px-1 rounded ${className}`}
                onClick={() => startEdit(entity, id, field, value)}
                title="Klicken zum Bearbeiten"
            >
                {value || <span className="text-gray-400 italic">leer</span>}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-gray-500">Kategorien werden geladen...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold">Kategorien-Verwaltung</h2>
                </div>
                <button
                    onClick={() => startAdd('type')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                >
                    <Plus className="w-4 h-4" /> Neuer Typ
                </button>
            </div>

            {/* Add Type Form */}
            {addingTo?.entity === 'type' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                    <h3 className="font-bold text-orange-900 mb-3">Neuer Typ (Ebene 1)</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            placeholder="ID (z.B. hobbies)"
                            value={newItemData.id}
                            onChange={(e) => setNewItemData(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                            className="px-3 py-2 border rounded"
                        />
                        <input
                            placeholder="Name (DE) *"
                            value={newItemData.label_de}
                            onChange={(e) => setNewItemData(prev => ({ ...prev, label_de: e.target.value }))}
                            className="px-3 py-2 border rounded"
                        />
                        <input
                            placeholder="Name (EN)"
                            value={newItemData.label_en}
                            onChange={(e) => setNewItemData(prev => ({ ...prev, label_en: e.target.value }))}
                            className="px-3 py-2 border rounded"
                        />
                        <input
                            placeholder="Name (FR)"
                            value={newItemData.label_fr}
                            onChange={(e) => setNewItemData(prev => ({ ...prev, label_fr: e.target.value }))}
                            className="px-3 py-2 border rounded"
                        />
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button onClick={saveNewItem} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50">
                            {saving ? <Loader className="w-4 h-4 animate-spin" /> : 'Erstellen'}
                        </button>
                        <button onClick={() => setAddingTo(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                            Abbrechen
                        </button>
                    </div>
                </div>
            )}

            {/* Tree View */}
            <div className="border rounded-lg divide-y">
                {types.map(type => (
                    <div key={type.id} className="bg-white">
                        {/* Type Row */}
                        <div className="flex items-center gap-2 p-3 hover:bg-gray-50">
                            <button onClick={() => toggleType(type.id)} className="p-1 hover:bg-gray-200 rounded">
                                {expandedTypes[type.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-primary">
                                        <EditableField entity="type" id={type.id} field="label_de" value={type.label_de} />
                                    </span>
                                    <span className="text-xs text-gray-400 font-mono">{type.id}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${courseCounts.types[type.id] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {courseCounts.types[type.id] || 0} Kurse
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                                    <span>EN: <EditableField entity="type" id={type.id} field="label_en" value={type.label_en} /></span>
                                    <span>FR: <EditableField entity="type" id={type.id} field="label_fr" value={type.label_fr} /></span>
                                    <span>IT: <EditableField entity="type" id={type.id} field="label_it" value={type.label_it} /></span>
                                </div>
                            </div>
                            <button
                                onClick={() => startAdd('area', type.id)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                title="Bereich hinzufügen"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => initiateDelete('type', type.id, type.label_de)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                title="Löschen"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Add Area Form */}
                        {addingTo?.entity === 'area' && addingTo?.parentId === type.id && (
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 ml-8">
                                <h4 className="font-bold text-blue-900 mb-2">Neuer Bereich (Ebene 2)</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        placeholder="ID (z.B. cooking_basics)"
                                        value={newItemData.id}
                                        onChange={(e) => setNewItemData(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                                        className="px-2 py-1.5 border rounded text-sm"
                                    />
                                    <input
                                        placeholder="Name (DE) *"
                                        value={newItemData.label_de}
                                        onChange={(e) => setNewItemData(prev => ({ ...prev, label_de: e.target.value }))}
                                        className="px-2 py-1.5 border rounded text-sm"
                                    />
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button onClick={saveNewItem} disabled={saving} className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                                        Erstellen
                                    </button>
                                    <button onClick={() => setAddingTo(null)} className="px-3 py-1 bg-gray-200 rounded text-sm">
                                        Abbrechen
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Areas */}
                        {expandedTypes[type.id] && (
                            <div className="ml-8 border-l-2 border-gray-100">
                                {areas.filter(a => a.type_id === type.id).map(area => (
                                    <div key={area.id}>
                                        {/* Area Row */}
                                        <div className="flex items-center gap-2 p-2 pl-4 hover:bg-gray-50 border-b border-gray-50">
                                            <button onClick={() => toggleArea(area.id)} className="p-1 hover:bg-gray-200 rounded">
                                                {expandedAreas[area.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                            </button>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-800">
                                                        <EditableField entity="area" id={area.id} field="label_de" value={area.label_de} />
                                                    </span>
                                                    <span className="text-xs text-gray-400 font-mono">{area.id}</span>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${courseCounts.areas[area.id] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {courseCounts.areas[area.id] || 0}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => startAdd('specialty', area.id)}
                                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                title="Spezialgebiet hinzufügen"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => initiateDelete('area', area.id, area.label_de)}
                                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                title="Löschen"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>

                                        {/* Add Specialty Form */}
                                        {addingTo?.entity === 'specialty' && addingTo?.parentId === area.id && (
                                            <div className="bg-green-50 p-3 ml-8 border-l-2 border-green-300">
                                                <div className="flex gap-2">
                                                    <input
                                                        ref={specialtyInputRef}
                                                        placeholder="Name des Spezialgebiets"
                                                        value={newItemData.name}
                                                        onChange={(e) => setNewItemData(prev => ({ ...prev, name: e.target.value }))}
                                                        className="flex-1 px-2 py-1 border rounded text-sm"
                                                        onKeyDown={(e) => e.key === 'Enter' && saveNewItem()}
                                                    />
                                                    <button onClick={saveNewItem} disabled={saving} className="px-3 py-1 bg-green-600 text-white rounded text-sm">
                                                        +
                                                    </button>
                                                    <button onClick={() => setAddingTo(null)} className="px-3 py-1 bg-gray-200 rounded text-sm">
                                                        ×
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Specialties */}
                                        {expandedAreas[area.id] && (
                                            <div className="ml-12 py-1 bg-gray-50">
                                                {specialties.filter(s => s.area_id === area.id).map(spec => {
                                                    const specFocuses = focuses.filter(f => f.specialty_id === spec.id);
                                                    const hasFocuses = specFocuses.length > 0;

                                                    return (
                                                        <div key={spec.id}>
                                                            <div className="flex items-center gap-2 px-3 py-1 hover:bg-white group">
                                                                {/* Toggle for focuses */}
                                                                <button
                                                                    onClick={() => toggleSpecialty(spec.id)}
                                                                    className="p-0.5 hover:bg-gray-200 rounded"
                                                                >
                                                                    {expandedSpecialties[spec.id]
                                                                        ? <ChevronDown className="w-3 h-3 text-gray-400" />
                                                                        : <ChevronRight className="w-3 h-3 text-gray-400" />
                                                                    }
                                                                </button>
                                                                <span className="flex-1 text-sm text-gray-700">
                                                                    <EditableField entity="specialty" id={spec.id} field="name" value={spec.name} />
                                                                </span>
                                                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${courseCounts.specialties[spec.name] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {courseCounts.specialties[spec.name] || 0}
                                                                </span>
                                                                {hasFocuses && (
                                                                    <span className="text-xs text-gray-400">{specFocuses.length} Fokus</span>
                                                                )}
                                                                <button
                                                                    onClick={() => startAdd('focus', spec.id)}
                                                                    className="p-1 text-green-500 opacity-0 group-hover:opacity-100 hover:bg-green-50 rounded transition-opacity"
                                                                    title="Fokus hinzufügen"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => initiateDelete('specialty', spec.id, spec.name)}
                                                                    className="p-1 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-opacity"
                                                                    title="Löschen"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>

                                                            {/* Add Focus Form */}
                                                            {addingTo?.entity === 'focus' && addingTo?.parentId === spec.id && (
                                                                <div className="bg-purple-50 p-2 ml-8 border-l-2 border-purple-300">
                                                                    <div className="flex gap-2">
                                                                        <input
                                                                            ref={focusInputRef}
                                                                            placeholder="Name des Fokus"
                                                                            value={newItemData.name}
                                                                            onChange={(e) => setNewItemData(prev => ({ ...prev, name: e.target.value }))}
                                                                            className="flex-1 px-2 py-1 border rounded text-sm"
                                                                            onKeyDown={(e) => e.key === 'Enter' && saveNewItem()}
                                                                        />
                                                                        <button onClick={saveNewItem} disabled={saving} className="px-3 py-1 bg-purple-600 text-white rounded text-sm">
                                                                            +
                                                                        </button>
                                                                        <button onClick={() => setAddingTo(null)} className="px-3 py-1 bg-gray-200 rounded text-sm">
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Focuses (Level 4) */}
                                                            {expandedSpecialties[spec.id] && (
                                                                <div className="ml-16 py-0.5 bg-purple-50/30">
                                                                    {specFocuses.map(f => (
                                                                        <div key={f.id} className="flex items-center gap-2 px-3 py-0.5 hover:bg-white group/focus">
                                                                            <span className="w-1 h-1 bg-purple-300 rounded-full"></span>
                                                                            <span className="flex-1 text-xs text-gray-600">
                                                                                <EditableField entity="focus" id={f.id} field="name" value={f.name} />
                                                                            </span>
                                                                            <span className={`text-xs px-1 py-0.5 rounded ${courseCounts.focuses[f.name] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                                                                {courseCounts.focuses[f.name] || 0}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => initiateDelete('focus', f.id, f.name)}
                                                                                className="p-0.5 text-red-400 opacity-0 group-hover/focus:opacity-100 hover:bg-red-50 rounded transition-opacity"
                                                                                title="Löschen"
                                                                            >
                                                                                <Trash2 className="w-2.5 h-2.5" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    {specFocuses.length === 0 && (
                                                                        <div className="px-3 py-1 text-xs text-gray-400 italic">Keine Fokus-Einträge</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {specialties.filter(s => s.area_id === area.id).length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-gray-400 italic">Keine Spezialgebiete</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {areas.filter(a => a.type_id === type.id).length === 0 && (
                                    <div className="p-3 text-sm text-gray-400 italic">Keine Bereiche</div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                        <div className="bg-red-50 px-6 py-4 border-b border-red-100">
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertTriangle className="w-5 h-5" />
                                <h3 className="font-bold">Kategorie löschen</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-700 mb-4">
                                Möchtest du <strong>"{deleteModal.name}"</strong> wirklich löschen?
                            </p>

                            {deleteModal.courseCount > 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                    <p className="text-yellow-800 font-medium mb-2">
                                        {deleteModal.courseCount} Kurs(e) sind dieser Kategorie zugeordnet.
                                    </p>
                                    {deleteModal.entity === 'focus' ? (
                                        <p className="text-sm text-yellow-700">
                                            Der Fokus wird von den betroffenen Kursen entfernt (auf leer gesetzt).
                                            {deleteModal.reassignOptions.length > 0 && (
                                                <>
                                                    <br />Oder wähle einen anderen Fokus:
                                                </>
                                            )}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-yellow-700 mb-3">
                                            Bitte wähle eine Kategorie, zu der die Kurse verschoben werden sollen:
                                        </p>
                                    )}
                                    {deleteModal.reassignOptions.length > 0 && (
                                        <select
                                            value={reassignTo}
                                            onChange={(e) => setReassignTo(e.target.value)}
                                            className="w-full px-3 py-2 border border-yellow-300 rounded bg-white mt-2"
                                        >
                                            <option value="">{deleteModal.entity === 'focus' ? '-- Fokus entfernen (leer setzen) --' : '-- Ziel-Kategorie wählen --'}</option>
                                            {deleteModal.reassignOptions.map(opt => (
                                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            {deleteModal.entity !== 'specialty' && deleteModal.entity !== 'focus' && (
                                <p className="text-sm text-gray-500 mb-4">
                                    Hinweis: Alle untergeordneten Kategorien werden ebenfalls gelöscht.
                                </p>
                            )}
                            {deleteModal.entity === 'specialty' && (
                                <p className="text-sm text-gray-500 mb-4">
                                    Hinweis: Alle zugehörigen Fokus-Einträge werden ebenfalls gelöscht.
                                </p>
                            )}

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setDeleteModal(null)}
                                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={saving || (deleteModal.courseCount > 0 && !reassignTo && deleteModal.entity !== 'focus')}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : 'Löschen'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCategoryManager;
