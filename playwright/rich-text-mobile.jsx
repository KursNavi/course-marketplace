/* global window, document */
/**
 * Playwright-Harness für AdminRichTextEditor — mobile/tablet Responsiveness.
 *
 * Mountet die echte Editor-Komponente als kontrollierte Komponente, genau wie
 * rich-text-table.jsx. Der Artikel ist hier bewusst sehr lang: ein Info-Baustein
 * und eine Tabelle liegen weit unterhalb des sichtbaren Bereichs, damit sich
 * echtes Scrollen bis zu einem tief liegenden Baustein reproduzieren lässt
 * (siehe PR #94 mobile QA, Fehler „Aktionsleiste ausserhalb des Viewports").
 *
 * Kein Supabase, kein Router, keine Datenbank.
 */
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../src/index.css';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor.jsx';

function fillerParagraphs(count, prefix) {
  return Array.from({ length: count }, (_, i) => (
    `<p>${prefix} Absatz ${i + 1} — ausreichend Text, um die Seite deutlich zu verlängern und echtes Scrollen bis zum tief liegenden Baustein zu erzwingen.</p>`
  )).join('');
}

const ARTICLE_A = [
  fillerParagraphs(30, 'Einleitung'),
  '<div class="info-box" id="deep-info-box"><h3>Tief liegender Baustein</h3><p>Inhalt des tief liegenden Bausteins.</p></div>',
  fillerParagraphs(20, 'Mittelteil'),
  '<table id="deep-table">',
  '<thead><tr><th>Spalte A</th><th>Spalte B</th><th>Spalte C</th></tr></thead>',
  '<tbody>',
  '<tr><td>Wert A1</td><td>Wert B1</td><td>Wert C1</td></tr>',
  '<tr><td>Wert A2</td><td>Wert B2</td><td>Wert C2</td></tr>',
  '</tbody>',
  '</table>',
  fillerParagraphs(15, 'Schlussteil'),
].join('');

// Zähler zur Erkennung ungewollter onChange-Meldungen durch Scrollen/Fokus
window.__renderCount = 0;
window.__changeCount = 0;

function Harness() {
  const [html, setHtml] = useState(ARTICLE_A);
  window.__renderCount += 1;
  window.__editorValue = html;

  return (
    <div style={{ padding: 16 }}>
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
