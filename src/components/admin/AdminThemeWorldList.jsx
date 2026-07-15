/**
 * Admin-Übersicht aller Themenwelten.
 * Zeigt Status, Segment, Pfad, Aktionen.
 * Archivieren, Publizieren und Zurückziehen mit Bestätigungsdialog.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Edit, Archive, Globe, EyeOff, Eye, FileText, Loader, AlertCircle, RefreshCw } from 'lucide-react';
import AdminStatusBadge from './AdminStatusBadge';
import {
  listThemeWorlds,
  archiveThemeWorld,
  publishThemeWorld,
  unpublishThemeWorld,
  getErrorMessage,
  ApiError,
} from '../../lib/themeWorldAdminApi';

const SEGMENT_LABELS = {
  beruflich: 'Beruflich',
  'privat-hobby': 'Privat & Hobby',
  'kinder-jugend': 'Kinder & Jugend',
};

export default function AdminThemeWorldList({ showNotification, setView, setSelectedThemeWorldId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionItem, setActionItem] = useState(null); // { id, action, title }
  const [actionRunning, setActionRunning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listThemeWorlds();
      setItems(data);
    } catch (err) {
      const msg = getErrorMessage(err, 'Liste konnte nicht geladen werden.');
      setError(msg);
      if (err instanceof ApiError && err.isUnauthorized) {
        showNotification('Sitzung abgelaufen. Bitte erneut anmelden.');
      }
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleNew = () => {
    setSelectedThemeWorldId(null);
    setView('admin-theme-world-form');
  };

  const handleEdit = (id) => {
    setSelectedThemeWorldId(id);
    setView('admin-theme-world-form');
  };

  const handleScenarios = (id) => {
    setSelectedThemeWorldId(id);
    setView('admin-scenario-list');
  };

  const requestAction = (item, action) => {
    setActionItem({ id: item.id, action, title: item.title_de });
  };

  const confirmAction = async () => {
    if (!actionItem) return;
    setActionRunning(true);
    try {
      if (actionItem.action === 'archive') {
        await archiveThemeWorld(actionItem.id);
        showNotification(`"${actionItem.title}" wurde archiviert.`);
      } else if (actionItem.action === 'publish') {
        const result = await publishThemeWorld(actionItem.id);
        const deployInfo = result.deploy?.status && result.deploy.status !== 'not_configured'
          ? ` Deploy: ${result.deploy.status}`
          : '';
        showNotification(`"${actionItem.title}" wurde publiziert.${deployInfo}`);
      } else if (actionItem.action === 'unpublish') {
        await unpublishThemeWorld(actionItem.id);
        showNotification(`"${actionItem.title}" wurde zurückgezogen.`);
      }
      await fetchData();
    } catch (err) {
      const msg = getErrorMessage(err, 'Aktion fehlgeschlagen.');
      showNotification(`Fehler: ${msg}`);
      if (err instanceof ApiError && err.isUnprocessable && err.details?.length) {
        alert(`Pflichtfelder fehlen:\n\n${err.details.join('\n')}`);
      }
    } finally {
      setActionRunning(false);
      setActionItem(null);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '–';
    return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView('admin')}
              className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-sm border border-gray-200 text-gray-600"
              title="Zurück zum Control Room"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-heading">Themenwelten</h1>
              <p className="text-sm text-gray-500 mt-0.5">Verwaltung der Bereichs-Landingpages</p>
            </div>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-teal-700 font-bold"
          >
            <Plus className="w-5 h-5" /> Neue Themenwelt
          </button>
        </div>

        {/* Ladezustand */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        )}

        {/* Fehler */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-700">Fehler beim Laden</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              <button
                onClick={fetchData}
                className="mt-3 flex items-center gap-1.5 text-sm text-red-600 hover:underline font-medium"
              >
                <RefreshCw className="w-4 h-4" /> Erneut versuchen
              </button>
            </div>
          </div>
        )}

        {/* Leere Liste */}
        {!loading && !error && items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Noch keine Themenwelten vorhanden.</p>
            <button
              onClick={handleNew}
              className="mt-4 text-teal-600 hover:underline text-sm font-medium"
            >
              Erste Themenwelt erstellen
            </button>
          </div>
        )}

        {/* Liste */}
        {!loading && !error && items.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Titel</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Segment</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Öffentlicher Pfad</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Geändert</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Publiziert</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => {
                    const publicPath = `/bereich/${item.url_segment}/${item.slug}`;
                    const segLabel = SEGMENT_LABELS[item.url_segment] || item.url_segment;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800">{item.title_de}</div>
                          <div className="text-xs text-gray-400 font-mono">{item.key}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{segLabel}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-gray-500">{publicPath}</span>
                        </td>
                        <td className="px-4 py-3">
                          <AdminStatusBadge status={item.status} />
                          {item.deploy_status === 'requested' && (
                            <span className="ml-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">
                              Deploy
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(item.updated_at)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(item.published_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <ActionBtn
                              onClick={() => handleEdit(item.id)}
                              icon={<Edit size={15} />}
                              title="Bearbeiten"
                              className="text-blue-600 hover:bg-blue-50"
                            />
                            <ActionBtn
                              onClick={() => handleScenarios(item.id)}
                              icon={<FileText size={15} />}
                              title="Szenarioartikel"
                              className="text-purple-600 hover:bg-purple-50"
                            />
                            {item.status === 'draft' && (
                              <ActionBtn
                                onClick={() => requestAction(item, 'publish')}
                                icon={<Eye size={15} />}
                                title="Publizieren"
                                className="text-green-600 hover:bg-green-50"
                              />
                            )}
                            {item.status === 'published' && (
                              <ActionBtn
                                onClick={() => requestAction(item, 'unpublish')}
                                icon={<EyeOff size={15} />}
                                title="Zurückziehen"
                                className="text-amber-600 hover:bg-amber-50"
                              />
                            )}
                            {item.status !== 'archived' && (
                              <ActionBtn
                                onClick={() => requestAction(item, 'archive')}
                                icon={<Archive size={15} />}
                                title="Archivieren"
                                className="text-gray-500 hover:bg-gray-100"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bestätigungsdialog */}
      {actionItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {actionItem.action === 'archive' && 'Themenwelt archivieren'}
              {actionItem.action === 'publish' && 'Themenwelt publizieren'}
              {actionItem.action === 'unpublish' && 'Themenwelt zurückziehen'}
            </h3>
            <p className="text-gray-600 text-sm mb-1">
              Themenwelt: <strong>"{actionItem.title}"</strong>
            </p>
            {actionItem.action === 'archive' && (
              <p className="text-sm text-gray-500 mt-2">
                Die Themenwelt wird archiviert und ist nicht mehr öffentlich sichtbar.
                Sie kann jederzeit wiederhergestellt werden.
              </p>
            )}
            {actionItem.action === 'publish' && (
              <p className="text-sm text-gray-500 mt-2">
                Die Themenwelt wird nach serverseitiger Prüfung aller Pflichtfelder publiziert.
                Der öffentliche Pfad ist danach unveränderbar.
              </p>
            )}
            {actionItem.action === 'unpublish' && (
              <p className="text-sm text-gray-500 mt-2">
                Die Themenwelt wird auf Entwurf zurückgesetzt und ist nicht mehr öffentlich sichtbar.
              </p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setActionItem(null)}
                disabled={actionRunning}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmAction}
                disabled={actionRunning}
                className={`px-4 py-2 text-sm font-bold rounded-lg text-white disabled:opacity-50 flex items-center gap-2 ${
                  actionItem.action === 'archive' ? 'bg-gray-600 hover:bg-gray-700' :
                  actionItem.action === 'publish' ? 'bg-green-600 hover:bg-green-700' :
                  'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {actionRunning && <Loader className="w-4 h-4 animate-spin" />}
                {actionItem.action === 'archive' && 'Archivieren'}
                {actionItem.action === 'publish' && 'Jetzt publizieren'}
                {actionItem.action === 'unpublish' && 'Zurückziehen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ActionBtn = ({ onClick, icon, title, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded-md transition ${className}`}
  >
    {icon}
  </button>
);
