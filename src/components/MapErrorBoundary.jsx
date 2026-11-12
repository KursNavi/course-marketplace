import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Fängt Fehler der Kartenansicht ab — auch solche beim Nachladen des
 * Kartenpakets, die ein Suspense-Fallback nicht abdeckt.
 *
 * Zweck: Ein Ausfall des Kartendienstes darf die Ergebnisliste nie
 * unbenutzbar machen. Hier erscheint dann nur ein Hinweis mit dem Weg zurück
 * zur Liste; Treffer und Filter bleiben unverändert im Zustand der Seite.
 */
class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-6 py-12 text-center"
        data-testid="map-boundary-error"
      >
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" aria-hidden="true" />
        <h3 className="mb-1 font-heading text-lg font-bold text-gray-900">Karte nicht verfügbar</h3>
        <p className="mx-auto mb-4 max-w-md text-sm text-gray-600">
          Die Karte konnte nicht geladen werden. Deine Treffer und Filter sind davon nicht betroffen.
        </p>
        {this.props.onBackToList && (
          <button
            type="button"
            onClick={this.props.onBackToList}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-primary transition hover:bg-orange-100"
          >
            Zur Liste wechseln
          </button>
        )}
      </div>
    );
  }
}

export default MapErrorBoundary;
