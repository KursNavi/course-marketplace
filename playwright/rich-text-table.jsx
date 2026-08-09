/* global window, document */
/**
 * Playwright-Harness für AdminRichTextEditor — Baustein- und Tabellen-Aktionen.
 *
 * Mountet die echte Editor-Komponente als kontrollierte Komponente, damit der
 * vollständige Zyklus onInput → onChange → value-Sync → Selection im echten
 * Chromium läuft. Kein Supabase, kein Router, keine Datenbank.
 *
 * Zusätzlich zum Tabellen-Baustein stehen eine Info-Box, eine Tipp-Box und ein
 * normaler Absatz bereit: nur damit lässt sich prüfen, dass „Baustein löschen"
 * genau den erfassten Baustein trifft und keinen anderen.
 *
 * Die Schalter oberhalb des Editors gehören zum Harness, nicht zur Komponente.
 * Sie erzwingen einen echten externen value-Wechsel (Artikelwechsel) — der Fall,
 * in dem eine offene Sicherheitsabfrage sicher schliessen muss.
 */
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../src/index.css';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor.jsx';

const ARTICLE_A = [
  '<table>',
  '<thead><tr><th>Spalte A</th><th>Spalte B</th><th>Spalte C</th></tr></thead>',
  '<tbody>',
  '<tr><td>Wert A1</td><td>Wert B1</td><td>Wert C1</td></tr>',
  '<tr><td>Wert A2</td><td>Wert B2</td><td>Wert C2</td></tr>',
  '</tbody>',
  '</table>',
  '<div class="info-box"><h3>Information</h3><p>Inhalt der Informationsbox.</p></div>',
  '<div class="tip-box"><h3>Tipp</h3><p>Inhalt der Tipp-Box.</p></div>',
  '<p id="schluss">Schlussabsatz.</p>',
].join('');

const ARTICLE_B = '<p id="artikel-b">Zweiter Artikel ohne Baustein.</p>';

// Zähler zur Erkennung von Render-/Update-Schleifen
window.__renderCount = 0;
window.__changeCount = 0;

function Harness() {
  const [html, setHtml] = useState(ARTICLE_A);
  window.__renderCount += 1;
  window.__editorValue = html;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <button type="button" data-testid="harness-article-a" onClick={() => setHtml(ARTICLE_A)}>
          Artikel A laden
        </button>
        <button type="button" data-testid="harness-article-b" onClick={() => setHtml(ARTICLE_B)}>
          Artikel B laden
        </button>
      </div>
      <AdminRichTextEditor
        value={html}
        onChange={(next) => {
          window.__changeCount += 1;
          setHtml(next);
        }}
        minRows={8}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Harness />);
