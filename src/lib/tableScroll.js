/**
 * Scrollbare redaktionelle Tabellen bedienbar machen.
 *
 * Ausgangslage:
 *   wrapTables() legt um jede Tabelle ein <div class="table-wrapper"> mit
 *   overflow-x: auto. Das verhindert zwar den Seiten-Overflow, aber der
 *   Container war für Nutzer nicht als scrollbar erkennbar und für die
 *   Tastatur gar nicht erreichbar: Ein Element mit overflow: auto bekommt
 *   ohne tabindex keinen Fokus, also lässt es sich auch nicht mit den
 *   Pfeiltasten scrollen. Screenreader kündigten den Bereich nicht an.
 *
 * Was diese Funktion tut:
 *   Sie markiert ausschliesslich jene Container, deren Inhalt tatsächlich
 *   breiter ist als der sichtbare Bereich. Nur diese bekommen
 *     - data-scrollable  → Aufhänger für die dezente Rahmen-/Scrollbar-Optik
 *     - tabindex="0"     → mit Tab erreichbar, mit Pfeiltasten scrollbar
 *     - role="region" + aria-label → als eigener Bereich angekündigt
 *
 *   Passt die Tabelle (praktisch immer auf Desktop), werden die Attribute
 *   wieder entfernt. Dadurch entstehen dort weder zusätzliche Tabstopps noch
 *   zusätzliche Landmarken, und die Darstellung bleibt unverändert.
 *
 * Semantik:
 *   Angefasst wird nur der umgebende <div>. table, thead, th und td bleiben
 *   unberührt, die Tabellennavigation von Screenreadern funktioniert weiter.
 */

/** Beschriftung des Scrollbereichs für Screenreader. */
export const TABLE_SCROLL_LABEL = 'Tabelle, horizontal scrollbar';

/** Toleranz in Pixeln — fängt Rundungsfehler bei Zoom und Skalierung ab. */
const TOLERANCE = 2;

/** Setzt oder entfernt die Attribute eines einzelnen Containers. */
function applyState(wrapper) {
  const scrollable = wrapper.scrollWidth - wrapper.clientWidth > TOLERANCE;

  if (scrollable) {
    wrapper.setAttribute('data-scrollable', 'true');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('role', 'region');
    // Eine bereits vorhandene redaktionelle Beschriftung nicht überschreiben.
    if (!wrapper.hasAttribute('aria-label')) {
      wrapper.setAttribute('aria-label', TABLE_SCROLL_LABEL);
    }
    return;
  }

  wrapper.removeAttribute('data-scrollable');
  wrapper.removeAttribute('tabindex');
  wrapper.removeAttribute('role');
  if (wrapper.getAttribute('aria-label') === TABLE_SCROLL_LABEL) {
    wrapper.removeAttribute('aria-label');
  }
}

/** Entfernt alle von uns gesetzten Attribute wieder. */
function clearState(wrapper) {
  wrapper.removeAttribute('data-scrollable');
  wrapper.removeAttribute('tabindex');
  wrapper.removeAttribute('role');
  if (wrapper.getAttribute('aria-label') === TABLE_SCROLL_LABEL) {
    wrapper.removeAttribute('aria-label');
  }
}

/**
 * Prüft alle Tabellen-Container unterhalb von `root` und hält sie aktuell.
 *
 * Bewusst nicht an einen React-Effekt mit Abhängigkeitsliste gebunden:
 * Der Artikelinhalt wird über dangerouslySetInnerHTML gesetzt und kann später
 * durch Datenbankinhalte ersetzt werden, ohne dass sich der Container-Knoten
 * ändert. Eine Abhängigkeitsliste trifft dabei zwangsläufig irgendwann daneben
 * — deshalb beobachtet die Funktion den Container selbst:
 *
 *   MutationObserver → neuer oder ersetzter Inhalt wird neu erfasst
 *   ResizeObserver   → Drehen, Zoomen, nachgeladene Schriften
 *
 * @param {HTMLElement|null} root - Container des Artikelinhalts
 * @returns {() => void} Aufräumfunktion; entfernt Beobachter und Attribute
 */
export function enhanceTableScrollContainers(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return () => {};

  let observed = [];
  let resizeObserver = null;

  const update = () => {
    const wrappers = Array.from(root.querySelectorAll('.table-wrapper'));

    // Container, die es nicht mehr gibt, aus der Beobachtung nehmen.
    if (resizeObserver) {
      observed.forEach((w) => { if (!wrappers.includes(w)) resizeObserver.unobserve(w); });
      wrappers.forEach((w) => { if (!observed.includes(w)) resizeObserver.observe(w); });
    }
    observed = wrappers;

    wrappers.forEach(applyState);
  };

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(update);
  } else if (typeof window !== 'undefined') {
    window.addEventListener('resize', update);
  }

  let mutationObserver = null;
  if (typeof MutationObserver !== 'undefined') {
    mutationObserver = new MutationObserver(update);
    mutationObserver.observe(root, { childList: true, subtree: true });
  }

  update();

  return () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    } else if (typeof window !== 'undefined') {
      window.removeEventListener('resize', update);
    }
    if (mutationObserver) mutationObserver.disconnect();
    observed.forEach(clearState);
    observed = [];
  };
}
