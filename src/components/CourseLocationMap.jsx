import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import MapErrorBoundary from './MapErrorBoundary';
import { loadSwissPlaces } from '../lib/swissPlaces';
import { buildMapMarkers, createGeoResolver, getCourseGeoInfo } from '../lib/courseGeo';

const CourseMap = React.lazy(() => import('./CourseMap'));

/**
 * Standortkarte auf der Kursdetailseite.
 *
 * Zeigt den oder die Veranstaltungsorte eines Kurses — dieselbe Zuordnung wie
 * in der Umkreissuche (src/lib/courseGeo.js), also Veranstaltungsort statt
 * Firmensitz und keine erfundenen Koordinaten.
 *
 * Bewusst zurückhaltend geladen: Kartenbibliothek und Ortstabelle sind
 * zusammen gut 350 KB. Beides startet erst, wenn dieser Abschnitt in den
 * sichtbaren Bereich scrollt — wer die Seite oben wieder verlässt, lädt nichts
 * davon. Browser ohne IntersectionObserver laden sofort.
 *
 * Nichts anzuzeigen ist ein gültiges Ergebnis: Reine Onlinekurse und Kurse
 * ohne eindeutig zuordenbaren Ort bekommen hier keine Karte, sondern gar
 * nichts. Eine Karte mit geratenem Punkt wäre schlechter als keine Karte.
 */
const CourseLocationMap = ({ course }) => {
    const wrapperRef = useRef(null);
    // Browser ohne IntersectionObserver laden sofort — das steht schon beim
    // ersten Rendern fest und gehoert darum in die Startbelegung, nicht in
    // einen Effekt.
    const [sichtbar, setSichtbar] = useState(() => typeof IntersectionObserver !== 'function');
    const [placesIndex, setPlacesIndex] = useState(null);
    const [fehlgeschlagen, setFehlgeschlagen] = useState(false);

    useEffect(() => {
        if (sichtbar || typeof IntersectionObserver !== 'function') return undefined;
        const el = wrapperRef.current;
        if (!el) return undefined;
        const beobachter = new IntersectionObserver((eintraege) => {
            if (eintraege.some((e) => e.isIntersecting)) {
                setSichtbar(true);
                beobachter.disconnect();
            }
        }, { rootMargin: '200px' });
        beobachter.observe(el);
        return () => beobachter.disconnect();
    }, [sichtbar]);

    useEffect(() => {
        if (!sichtbar || placesIndex || fehlgeschlagen) return;
        let abgebrochen = false;
        loadSwissPlaces()
            .then((index) => { if (!abgebrochen) setPlacesIndex(index); })
            .catch(() => { if (!abgebrochen) setFehlgeschlagen(true); });
        return () => { abgebrochen = true; };
    }, [sichtbar, placesIndex, fehlgeschlagen]);

    const geoInfo = useMemo(
        () => (placesIndex ? getCourseGeoInfo(course, placesIndex) : null),
        [course, placesIndex],
    );

    const markers = useMemo(() => {
        if (!placesIndex || geoInfo?.status !== 'located') return [];
        return buildMapMarkers([course], createGeoResolver(placesIndex));
    }, [course, placesIndex, geoInfo]);

    // Kein Ort zuordenbar oder reiner Onlinekurs: kein Abschnitt. Der
    // Platzhalter bleibt stehen, solange noch geladen wird, damit der
    // Beobachter einen Anker hat.
    const nichtsZuZeigen = Boolean(placesIndex) && markers.length === 0;
    if (fehlgeschlagen || nichtsZuZeigen) return null;

    return (
        <div ref={wrapperRef} className="mb-6" data-testid="course-location-map">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-dark">
                <MapPin className="h-4 w-4 text-gray-400" aria-hidden="true" />
                Wo der Kurs stattfindet
            </h3>
            {!placesIndex ? (
                <div className="h-56 w-full animate-pulse rounded-xl border border-borderSubtle bg-gray-100" aria-hidden="true" />
            ) : (
                <MapErrorBoundary>
                    <Suspense fallback={<div className="h-56 w-full animate-pulse rounded-xl border border-borderSubtle bg-gray-100" aria-hidden="true" />}>
                        <CourseMap
                            markers={markers}
                            origin={null}
                            radiusKm={0}
                            buildCoursePath={() => ''}
                            heightClass="h-56"
                            footnote={false}
                            popupMode="place"
                        />
                    </Suspense>
                </MapErrorBoundary>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                {markers.length > 1
                    ? `Dieser Kurs findet an ${markers.length} Orten statt. `
                    : ''}
                Die Position zeigt den Ortsmittelpunkt und ist darum ungefähr – nicht die genaue Adresse.
            </p>
        </div>
    );
};

export default CourseLocationMap;
