/**
 * Admin-Liste der Szenarioartikel einer Themenwelt.
 * Zeigt Status, Sortierung, Aktionen.
 * Archivieren, Publizieren mit Bestätigungsdialog.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Edit, Archive, Eye, EyeOff, Loader, AlertCircle, RefreshCw, GripVertical } from 'lucide-react';
import AdminStatusBadge from './AdminStatusBadge';
import {
  listScenarios,
  archiveScenario,
  publishScenario,
  reorderScenarios,
  getThemeWorld,
  getErrorMessage,
  ApiError,
} from '../../lib/themeWorldAdminApi';

export default function AdminScenarioList({
  showNotification,
  setView,
  themeWorldId,
  setSelectedScenarioId,
}) {
  const [scenarios, setScenarios] = useState([]);
  const [themeWorld, setThemeWorld] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionItem, setActionItem] = useState(null);
  const [actionRunning, setActionRunning] = useState(false);

  const fetchData = useCallback(async () => {
    if (!themeWorldId) {
      setError('Keine Themenwelt-ID angegeben. Bitte gehe zurück zur Themenwelt-Liste.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [tw, list] = await Promise.all([
        getThemeWorld(themeWorldId),
        listScenarios(themeWorldId),
      ]);
      setThemeWorld(tw);
      setScenarios(list);
    } catch (err) {
      setError(getErrorMessage(err, 'Daten konnten nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, [themeWorldId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleNew = () => {
    setSelectedScenarioId(null);
    setView('admin-scenario-form');
  };

  const handleEdit = (id) => {
    setSelectedScenarioId(id);
    setView('admin-scenario-form');
  };

  const requestAction = (item, action) => {
    setActionItem({ id: item.id, action, label: item.label_de });
  };

  const confirmAction = async () => {
    if (!actionItem) return;
    setActionRunning(true);
    try {
      if (actionItem.action === 'archive') {
        await archiveScenario(actionItem.id);
        showNotification(`"${actionItem.label}" archiviert.`);
      } else if (actionItem.action === 'publish') {
        await publishScenario(actionItem.id);
        showNotification(`"${actionItem.label}" publiziert.`);
      }
      await fetchData();
    } catch (err) {
      const msg = getErrorMessage(err);
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
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView('admin-theme-worlds')}
              className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-sm border border-gray-200 text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-heading">Szenarioartikel</h1>
              {themeWorld && (
                <p className="text-sm text-gray-500 mt-0.5">{themeWorld.title_de}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleNew}
            disabled={!themeWorldId}
            className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-purple-700 font-bold disabled:opacity-50"
          >
            <Plus className="w-5 h-5" /> Neuer Artikel
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">{error}</p>
              <button onClick={fetchData} className="mt-2 text-sm text-red-600 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Erneut versuchen
              </button>
            </div>
          </div>
        )}

        {!loading && !error && scenarios.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-medium">Noch keine Szenarioartikel vorhanden.</p>
            <button onClick={handleNew} className="mt-4 text-purple-600 hover:underline text-sm font-medium">
              Ersten Artikel erstellen
            </button>
          </div>
        )}

        {!loading && !error && scenarios.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600 w-8">Reihenfolge</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">Titel</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">Publiziert</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scenarios.map((scenario) => (
                  <tr key={scenario.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-400">
                      <div className="flex items-center gap-1">
                        <GripVertical className="w-4 h-4" />
                        <span className="text-xs">{scenario.sort_order}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {scenario.icon && <span>{scenario.icon}</span>}
                        <div>
                          <div className="font-semibold text-gray-800">{scenario.label_de}</div>
                          <div className="text-xs text-gray-400 font-mono">{scenario.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge status={scenario.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(scenario.published_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ActionBtn
                          onClick={() => handleEdit(scenario.id)}
                          icon={<Edit size={15} />}
                          title="Bearbeiten"
                          className="text-blue-600 hover:bg-blue-50"
                        />
                        {scenario.status === 'draft' && themeWorld?.status === 'published' && (
                          <ActionBtn
                            onClick={() => requestAction(scenario, 'publish')}
                            icon={<Eye size={15} />}
                            title="Publizieren"
                            className="text-green-600 hover:bg-green-50"
                          />
                        )}
                        {scenario.status !== 'archived' && (
                          <ActionBtn
                            onClick={() => requestAction(scenario, 'archive')}
                            icon={<Archive size={15} />}
                            title="Archivieren"
                            className="text-gray-500 hover:bg-gray-100"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && themeWorld && themeWorld.status !== 'published' && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
            Die Themenwelt ist nicht publiziert. Szenarioartikel können erst publiziert werden, wenn die Themenwelt publiziert ist.
          </div>
        )}
      </div>

      {/* Bestätigungsdialog */}
      {actionItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {actionItem.action === 'archive' ? 'Artikel archivieren' : 'Artikel publizieren'}
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              Artikel: <strong>"{actionItem.label}"</strong>
            </p>
            {actionItem.action === 'publish' && (
              <p className="text-sm text-gray-500">
                Der Artikel wird nach serverseitiger Prüfung publiziert.
                Die Eltern-Themenwelt muss publiziert sein.
              </p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setActionItem(null)} disabled={actionRunning}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                Abbrechen
              </button>
              <button onClick={confirmAction} disabled={actionRunning}
                className={`px-4 py-2 text-sm font-bold rounded-lg text-white disabled:opacity-50 flex items-center gap-2 ${
                  actionItem.action === 'archive' ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'
                }`}>
                {actionRunning && <Loader className="w-4 h-4 animate-spin" />}
                {actionItem.action === 'archive' ? 'Archivieren' : 'Publizieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ActionBtn = ({ onClick, icon, title, className = '' }) => (
  <button type="button" onClick={onClick} title={title} className={`p-1.5 rounded-md transition ${className}`}>
    {icon}
  </button>
);
