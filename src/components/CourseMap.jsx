import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader } from 'lucide-react';

/**
 * Kartenansicht der Kurstreffer.
 *
 * Gewählte Bausteine und warum:
 *   • Leaflet als Kartenbibliothek — quelloffen (BSD-2), keine Registrierung,
 *     keine laufenden Kosten, kein Zugangsschlüssel.
 *   • Kartenbilder standardmässig von OpenStreetMap (ODbL, Namensnennung
 *     erforderlich und unten sichtbar eingeblendet). Über
 *     VITE_MAP_TILE_URL / VITE_MAP_TILE_ATTRIBUTION kann jederzeit ein
 *     anderer Kartendienst eingesetzt werden, ohne Code zu ändern — nötig,
 *     sobald die Zugriffszahlen über die Fair-Use-Regeln von OpenStreetMap
 *     hinauswachsen.
 *   • Leaflet und die Kartenbilder werden erst geladen, wenn diese Ansicht
 *     tatsächlich geöffnet wird (dynamischer Import in einem Effekt).
 *
 * Verhalten:
 *   • Verschieben und Zoomen ändert die Suche NICHT. Die Karte zeigt genau
 *     die Treffer der Ergebnisliste, nichts anderes.
 *   • Fällt der Kartendienst aus, erscheint hier ein Hinweis; die
 *     Ergebnisliste daneben bleibt unberührt benutzbar.
 *   • Eigene Marker-Symbole (divIcon) statt der Leaflet-Standardbilder —
 *     damit gibt es keine fehlenden Bildpfade nach dem Bündeln.
 */

const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>-Mitwirkende';

const tileUrl = import.meta.env?.VITE_MAP_TILE_URL || DEFAULT_TILE_URL;
const tileAttribution = import.meta.env?.VITE_MAP_TILE_ATTRIBUTION || DEFAULT_TILE_ATTRIBUTION;

/** Mitte der Schweiz — Startansicht, wenn kein Ausgangsort gewählt ist. */
const SWITZERLAND_CENTER = [46.8, 8.23];

/**
 * Zoomstufe, bei der ein Umkreis in eine übliche Kartenfläche passt.
 * Nur als Rückfallebene gedacht, wenn das Einpassen über die Eckpunkte
 * nicht möglich ist — besser ein etwas unpassender Ausschnitt am richtigen
 * Ort als ein Blick auf die halbe Schweiz.
 */
const ZOOM_FOR_RADIUS = { 5: 12, 10: 11, 25: 10, 50: 9 };

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Inhalt eines Marker-Fensters.
 *
 * Bei mehreren Kursen am selben Punkt entspricht die Reihenfolge der
 * Ergebnisliste — also der bestehenden Priorisierung. Hier wird nichts
 * umsortiert.
 */
function buildPopupHtml(marker, buildPath, popupMode) {
    // Auf der Kursdetailseite ist der Kurs schon bekannt — dort genügt der Ort.
    if (popupMode === 'place') {
        return `<div style="min-width:140px"><strong>${escapeHtml(marker.courses[0]?.label || '')}</strong><div style="font-size:11px;color:#6b7280;margin-top:2px">ungefähre Lage (Ortsmittelpunkt)</div></div>`;
    }

    const maxEintraege = 5;
    const sichtbar = marker.courses.slice(0, maxEintraege);
    const rest = marker.courses.length - sichtbar.length;
    const ort = escapeHtml(sichtbar[0]?.label || '');

    const eintraege = sichtbar.map(({ course }) => {
        const pfad = escapeHtml(buildPath(course));
        const titel = escapeHtml(course.title || 'Kurs');
        return `<li style="margin:0 0 6px"><a href="${pfad}" data-course-id="${escapeHtml(course.id)}" class="kn-map-link" style="color:#FA6E28;font-weight:700;text-decoration:none">${titel}</a></li>`;
    }).join('');

    return `
        <div style="min-width:180px;max-width:240px">
            <div style="font-size:11px;color:#6b7280;margin-bottom:6px">${ort} · ungefähr</div>
            <ul style="list-style:none;margin:0;padding:0;font-size:13px">${eintraege}</ul>
            ${rest > 0 ? `<div style="font-size:11px;color:#6b7280;margin-top:4px">und ${rest} weitere an diesem Ort</div>` : ''}
        </div>
    `;
}

const CourseMap = ({
    markers,
    origin,
    radiusKm,
    buildCoursePath,
    onSelectCourse,
    totalCourses,
    // Kursorte werden aus einer nachgeladenen Ortstabelle aufgelöst. Solange
    // die nicht da ist, gibt es noch keine Marker — das ist etwas anderes als
    // «es gibt keine Kursorte» und muss darum anders aussehen.
    placesReady = true,
    heightClass = 'h-[60vh] min-h-[320px] lg:h-[calc(100vh-14rem)]',
    footnote = true,
    // 'courses' = Liste der Kurse am Punkt (Suchergebnisse),
    // 'place'   = nur der Ort (Kursdetailseite, der Kurs ist dort bekannt).
    popupMode = 'courses',
}) => {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const leafletRef = useRef(null);
    const layerRef = useRef(null);
    const overlayRef = useRef(null);
    const resizeObserverRef = useRef(null);
    const fitRef = useRef(null);
    // Merkt sich, ob der Nutzer den Ausschnitt selbst verschoben oder gezoomt
    // hat. Danach wird er nicht mehr automatisch zurückgesetzt.
    const userMovedRef = useRef(false);
    const programmaticRef = useRef(false);
    const hinweisTimerRef = useRef(null);
    const [status, setStatus] = useState('loading');
    const [wheelAktiv, setWheelAktiv] = useState(false);
    const [hinweisSichtbar, setHinweisSichtbar] = useState(false);

    const markersRef = useRef(markers);
    markersRef.current = markers;
    const buildPathRef = useRef(buildCoursePath);
    buildPathRef.current = buildCoursePath;
    const onSelectRef = useRef(onSelectCourse);
    onSelectRef.current = onSelectCourse;

    // --- Karte einmalig aufbauen ---
    useEffect(() => {
        let abgebrochen = false;

        (async () => {
            try {
                const [leafletModul] = await Promise.all([
                    import('leaflet'),
                    import('leaflet/dist/leaflet.css'),
                ]);
                const L = leafletModul.default || leafletModul;
                // markercluster erweitert das globale Leaflet-Objekt und braucht
                // es darum vorher auf window.
                window.L = L;
                await Promise.all([
                    import('leaflet.markercluster'),
                    import('leaflet.markercluster/dist/MarkerCluster.css'),
                    import('leaflet.markercluster/dist/MarkerCluster.Default.css'),
                ]);

                if (abgebrochen || !containerRef.current) return;

                const map = L.map(containerRef.current, {
                    center: SWITZERLAND_CENTER,
                    zoom: 7,
                    // Zu Beginn aus, damit die Karte das Scrollen der Seite
                    // nicht verschluckt. Ein Klick in die Karte schaltet das
                    // Mausrad frei (siehe unten) — so bleibt beides möglich.
                    scrollWheelZoom: false,
                    attributionControl: true,
                });
                L.tileLayer(tileUrl, {
                    attribution: tileAttribution,
                    maxZoom: 18,
                    crossOrigin: true,
                }).addTo(map);

                map.on('dragstart zoomstart', () => {
                    if (!programmaticRef.current) userMovedRef.current = true;
                });

                // --- Mausrad-Zoom ---
                // Ein Klick in die Karte schaltet ihn frei, das Verlassen der
                // Karte wieder ab. Damit zoomt das Mausrad dort, wo man es
                // erwartet, reisst aber nie das Scrollen der Seite an sich,
                // wenn man nur an der Karte vorbeiscrollt.
                map.on('click', () => {
                    map.scrollWheelZoom.enable();
                    setWheelAktiv(true);
                });
                map.on('mouseout', () => {
                    map.scrollWheelZoom.disable();
                    setWheelAktiv(false);
                });
                // Wer ueber der noch gesperrten Karte scrollt, bekommt kurz den
                // Hinweis, wie er sie freischaltet — sonst wirkt sie kaputt.
                containerRef.current.addEventListener('wheel', () => {
                    if (map.scrollWheelZoom.enabled()) return;
                    setHinweisSichtbar(true);
                    clearTimeout(hinweisTimerRef.current);
                    hinweisTimerRef.current = setTimeout(() => setHinweisSichtbar(false), 1600);
                }, { passive: true });

                leafletRef.current = L;
                mapRef.current = map;

                // Der Container bekommt seine endgültige Grösse erst nach dem
                // Layout. Misst Leaflet vorher, fällt der Ausschnitt zu weit
                // heraus — auf dem Handy war genau das sichtbar. Darum einmal
                // nach dem nächsten Bildaufbau nachmessen und zusätzlich bei
                // jeder späteren Grössenänderung.
                requestAnimationFrame(() => {
                    if (abgebrochen || !mapRef.current) return;
                    map.invalidateSize();
                    if (!userMovedRef.current) fitRef.current?.();
                });

                if (typeof ResizeObserver === 'function' && containerRef.current) {
                    const beobachter = new ResizeObserver(() => {
                        if (!mapRef.current) return;
                        map.invalidateSize();
                        if (!userMovedRef.current) fitRef.current?.();
                    });
                    beobachter.observe(containerRef.current);
                    resizeObserverRef.current = beobachter;
                }

                setStatus('ready');
            } catch {
                if (!abgebrochen) setStatus('error');
            }
        })();

        return () => {
            abgebrochen = true;
            clearTimeout(hinweisTimerRef.current);
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = null;
            }
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            layerRef.current = null;
            overlayRef.current = null;
            fitRef.current = null;
        };
    }, []);

    const handlePopupClick = useCallback((event) => {
        const link = event.target.closest?.('.kn-map-link');
        if (!link) return;
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const courseId = link.getAttribute('data-course-id');
        const treffer = markersRef.current
            .flatMap((marker) => marker.courses)
            .find(({ course }) => String(course.id) === String(courseId));
        if (!treffer || !onSelectRef.current) return;
        event.preventDefault();
        onSelectRef.current(treffer.course);
    }, []);

    // --- Marker, Umkreis und Ausgangsort bei jeder Änderung neu zeichnen ---
    useEffect(() => {
        const L = leafletRef.current;
        const map = mapRef.current;
        if (status !== 'ready' || !L || !map) return;

        if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
        if (overlayRef.current) { map.removeLayer(overlayRef.current); overlayRef.current = null; }

        const cluster = typeof L.markerClusterGroup === 'function'
            ? L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 })
            : L.layerGroup();

        const icon = L.divIcon({
            className: 'kn-map-marker',
            html: '<span style="display:block;width:16px;height:16px;border-radius:50%;background:#FA6E28;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        });

        markers.forEach((marker) => {
            const leafletMarker = L.marker([marker.lat, marker.lng], {
                icon,
                title: marker.courses[0]?.course?.title || 'Kurs',
            });
            leafletMarker.bindPopup(buildPopupHtml(marker, buildPathRef.current, popupMode), { closeButton: true });
            cluster.addLayer(leafletMarker);
        });

        cluster.addTo(map);
        layerRef.current = cluster;

        const overlay = L.layerGroup();
        if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
            L.circleMarker([origin.lat, origin.lng], {
                radius: 6,
                color: '#183642',
                weight: 2,
                fillColor: '#183642',
                fillOpacity: 1,
            }).bindPopup(`<strong>${escapeHtml(origin.label || 'Ausgangsort')}</strong>`).addTo(overlay);

            if (Number.isFinite(radiusKm) && radiusKm > 0) {
                L.circle([origin.lat, origin.lng], {
                    radius: radiusKm * 1000,
                    color: '#FA6E28',
                    weight: 1.5,
                    fillColor: '#FA6E28',
                    fillOpacity: 0.07,
                }).addTo(overlay);
            }
        }
        overlay.addTo(map);
        overlayRef.current = overlay;

        // Ausschnitt setzen: Umkreis zeigt den Umkreis, sonst alle Marker.
        // Danach bleibt der Ausschnitt dem Nutzer überlassen — Verschieben und
        // Zoomen löst keine neue Suche aus.
        // Bewusst ohne Animation: so laufen die Leaflet-Ereignisse synchron und
        // die Erkennung einer echten Nutzerbewegung schlägt nicht fälschlich an.
        const ausschnittSetzen = () => {
            if (!mapRef.current) return;
            programmaticRef.current = true;
            const radiusAktiv = origin && Number.isFinite(radiusKm) && radiusKm > 0;
            try {
                if (radiusAktiv) {
                    // Bewusst latLng().toBounds() statt circle.getBounds():
                    // Ein Kreis kennt seine Eckpunkte erst, wenn er auf einer
                    // Karte liegt — ohne Karte wirft getBounds(), und der
                    // Ausschnitt fiel dann auf die Notfallansicht über der
                    // ganzen Schweiz zurück. toBounds rechnet ohne Karte.
                    map.fitBounds(L.latLng(origin.lat, origin.lng).toBounds(radiusKm * 2000), { padding: [20, 20], animate: false });
                } else if (markers.length > 0) {
                    map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng])), { padding: [30, 30], maxZoom: 13, animate: false });
                } else {
                    map.setView(SWITZERLAND_CENTER, 7, { animate: false });
                }
            } catch {
                // Rückfallebene: lieber beim gewählten Ort bleiben als bei der
                // Landesmitte.
                if (radiusAktiv) {
                    map.setView([origin.lat, origin.lng], ZOOM_FOR_RADIUS[radiusKm] || 10, { animate: false });
                } else {
                    map.setView(SWITZERLAND_CENTER, 7, { animate: false });
                }
            } finally {
                programmaticRef.current = false;
            }
        };

        fitRef.current = ausschnittSetzen;
        // Eine neue Treffermenge heisst neuer passender Ausschnitt — eine
        // frühere Nutzerbewegung gilt dafür nicht mehr.
        userMovedRef.current = false;
        map.invalidateSize();
        ausschnittSetzen();
    }, [markers, origin, radiusKm, status, popupMode]);

    // Kurse mit mehreren Standorten erscheinen an jedem davon. Gezählt wird
    // darum ausdrücklich die Zahl der KURSE, nicht die der Markereinträge —
    // sonst stünde unter der Karte eine höhere Zahl als über der Liste.
    const kurseAufDerKarte = new Set(markers.flatMap((m) => m.courses.map((c) => c.course.id))).size;
    const markerEintraege = markers.reduce((summe, marker) => summe + marker.courses.length, 0);
    const mehrfachStandorte = markerEintraege > kurseAufDerKarte;
    const ohneMarker = typeof totalCourses === 'number' ? Math.max(0, totalCourses - kurseAufDerKarte) : 0;

    if (status === 'error') {
        return (
            <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-6 py-12 text-center" data-testid="map-error">
                <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" aria-hidden="true" />
                <h3 className="mb-1 font-heading text-lg font-bold text-gray-900">Karte nicht verfügbar</h3>
                <p className="mx-auto max-w-md text-sm text-gray-600">
                    Die Karte konnte nicht geladen werden. Wechsle auf «Liste» – deine Treffer und Filter bleiben unverändert.
                </p>
            </div>
        );
    }

    return (
        <div data-testid="course-map">
            <div className="relative overflow-hidden rounded-2xl border border-borderSubtle bg-white">
                <div
                    ref={containerRef}
                    onClick={handlePopupClick}
                    className={`w-full ${heightClass}`}
                    role="application"
                    aria-label="Karte mit Kursorten"
                />
                {(status === 'loading' || !placesReady) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80" data-testid="map-loading">
                        <span className="flex items-center gap-2 text-sm text-gray-600">
                            <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                            {status === 'loading' ? 'Karte wird geladen …' : 'Kursorte werden geladen …'}
                        </span>
                    </div>
                )}
                {/* Mausrad-Hinweis: erscheint nur, wenn jemand über der noch
                    gesperrten Karte scrollt. */}
                {hinweisSichtbar && !wheelAktiv && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" data-testid="map-wheel-hint">
                        <span className="rounded-lg bg-petrol/85 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                            Zum Zoomen mit dem Mausrad in die Karte klicken
                        </span>
                    </div>
                )}
            </div>
            {footnote && (
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                    {!placesReady
                        ? 'Kursorte werden geladen …'
                        : markers.length === 0
                            ? 'Für die aktuellen Treffer gibt es keine Kursorte auf der Karte.'
                            : `${kurseAufDerKarte} ${kurseAufDerKarte === 1 ? 'Kurs' : 'Kurse'} an ${markers.length} ${markers.length === 1 ? 'Ort' : 'Orten'}. Positionen sind Ortsmittelpunkte und darum ungefähr.`}
                    {placesReady && mehrfachStandorte && ' Kurse mit mehreren Standorten erscheinen an jedem davon.'}
                    {placesReady && ohneMarker > 0 && ` ${ohneMarker} ${ohneMarker === 1 ? 'Treffer hat' : 'Treffer haben'} keinen Kartenpunkt (Onlinekurs oder kein eindeutiger Veranstaltungsort) – in der Liste sind sie weiterhin dabei.`}
                    {' '}Mausrad-Zoom: einmal in die Karte klicken.
                </p>
            )}
        </div>
    );
};

export default CourseMap;
