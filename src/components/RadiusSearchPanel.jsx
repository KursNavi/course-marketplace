import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, LocateFixed, X, Loader, Info } from 'lucide-react';
import { SectionMarker } from './SectionMarker';
import { findPlaceSuggestions } from '../lib/swissPlaces';
import { RADIUS_OPTIONS, DEFAULT_RADIUS_KM } from '../lib/courseGeo';
import { requestDeviceLocation } from '../lib/deviceLocation';

/**
 * Bedienfeld der Umkreissuche: Ausgangsort wählen, Umkreis setzen, zurücksetzen.
 *
 * Der Gerätestandort wird ausschliesslich nach Klick auf «Meinen Standort
 * verwenden» abgefragt — nie beim Seitenaufruf. Die manuelle Eingabe bleibt in
 * jedem Fehlerfall bedienbar; der Fehlertext steht direkt am Knopf.
 *
 * Die Ortstabelle wird erst bei der ersten Eingabe geladen (onEnsurePlaces).
 * Wer die Umkreissuche nicht benutzt, lädt sie nie.
 */
const RadiusSearchPanel = ({
    origin,
    onOriginChange,
    radiusKm,
    onRadiusChange,
    onReset,
    placesIndex,
    placesLoading,
    placesError,
    onEnsurePlaces,
    geoStats,
    resultCount,
}) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState('');
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    const suggestions = useMemo(
        () => (placesIndex ? findPlaceSuggestions(placesIndex, query, 8) : []),
        [placesIndex, query],
    );

    // Klick aussserhalb schliesst die Vorschlagsliste.
    useEffect(() => {
        if (!open) return undefined;
        const handler = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleQueryChange = (value) => {
        setQuery(value);
        setHighlight(-1);
        setLocationError('');
        if (value.trim().length >= 2) {
            setOpen(true);
            if (onEnsurePlaces) onEnsurePlaces();
        } else {
            setOpen(false);
        }
    };

    const pickSuggestion = useCallback((suggestion) => {
        if (!suggestion) return;
        setQuery('');
        setOpen(false);
        setHighlight(-1);
        setLocationError('');
        onOriginChange({
            id: suggestion.id,
            label: suggestion.label,
            lat: suggestion.lat,
            lng: suggestion.lng,
            source: 'place',
            approximate: true,
        });
        // Erst ein Ausgangsort macht einen Umkreis sinnvoll — darum wird der
        // Standardumkreis genau hier gesetzt, nicht schon beim Seitenaufruf.
        if (!radiusKm) onRadiusChange(DEFAULT_RADIUS_KM);
    }, [onOriginChange, onRadiusChange, radiusKm]);

    const handleKeyDown = (event) => {
        if (!open || suggestions.length === 0) {
            if (event.key === 'ArrowDown' && query.trim().length >= 2) setOpen(true);
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((i) => (i + 1) % suggestions.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            pickSuggestion(suggestions[highlight >= 0 ? highlight : 0]);
        } else if (event.key === 'Escape') {
            setOpen(false);
        }
    };

    const useDeviceLocation = async () => {
        setLocationError('');
        setLocating(true);
        try {
            if (onEnsurePlaces) onEnsurePlaces();
            const { lat, lng } = await requestDeviceLocation();
            // Kein Speichern, kein Protokollieren, kein URL-Eintrag: die
            // Koordinaten leben nur im Zustand dieser Seite.
            onOriginChange({
                id: '',
                label: 'Mein Standort',
                lat,
                lng,
                source: 'device',
                approximate: false,
            });
            if (!radiusKm) onRadiusChange(DEFAULT_RADIUS_KM);
        } catch (error) {
            setLocationError(error?.message || 'Dein Standort liess sich nicht bestimmen.');
        } finally {
            setLocating(false);
        }
    };

    const aktiv = Boolean(origin) && Boolean(radiusKm);
    const ohneOrt = (geoStats?.unknown || 0) + (geoStats?.ausland || 0);
    const nurOnline = geoStats?.online || 0;

    return (
        <div
            className="bg-white border border-borderSubtle rounded-xl p-3 space-y-3"
            data-testid="radius-panel"
            ref={wrapperRef}
        >
            <div className="flex items-center justify-between gap-2">
                <SectionMarker>Umkreis</SectionMarker>
                {aktiv && (
                    <button
                        type="button"
                        onClick={onReset}
                        data-testid="btn-radius-reset"
                        className="text-xs text-gray-400 hover:text-gray-700 hover:underline flex items-center gap-1 shrink-0"
                    >
                        <X className="w-3 h-3" aria-hidden="true" />
                        Zurücksetzen
                    </button>
                )}
            </div>

            {/* --- AUSGANGSORT --- */}
            <div className="relative">
                <label htmlFor="radius-place-input" className="sr-only">Ort oder Postleitzahl</label>
                <div className="relative">
                    <MapPin className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                        id="radius-place-input"
                        ref={inputRef}
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        role="combobox"
                        aria-expanded={open && suggestions.length > 0}
                        aria-controls="radius-place-listbox"
                        aria-autocomplete="list"
                        data-testid="radius-place-input"
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ort oder Postleitzahl"
                        className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                </div>

                {open && (
                    <div
                        id="radius-place-listbox"
                        role="listbox"
                        aria-label="Ortsvorschläge"
                        data-testid="radius-place-suggestions"
                        className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg"
                    >
                        {placesLoading && (
                            <div className="px-3 py-2 text-xs text-gray-500 flex items-center gap-2">
                                <Loader className="w-3 h-3 animate-spin" aria-hidden="true" />
                                Orte werden geladen …
                            </div>
                        )}
                        {!placesLoading && placesError && (
                            <div className="px-3 py-2 text-xs text-red-600">
                                Die Ortsliste konnte nicht geladen werden. Bitte lade die Seite neu.
                            </div>
                        )}
                        {!placesLoading && !placesError && suggestions.length === 0 && (
                            <div className="px-3 py-2 text-xs text-gray-500">
                                Kein passender Ort gefunden.
                            </div>
                        )}
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={suggestion.id}
                                type="button"
                                role="option"
                                aria-selected={index === highlight}
                                data-testid="radius-place-option"
                                onMouseEnter={() => setHighlight(index)}
                                onClick={() => pickSuggestion(suggestion)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${index === highlight ? 'bg-primaryLight text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden="true" />
                                <span className="truncate">{suggestion.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={useDeviceLocation}
                disabled={locating}
                data-testid="btn-use-device-location"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
            >
                {locating
                    ? <Loader className="w-4 h-4 animate-spin" aria-hidden="true" />
                    : <LocateFixed className="w-4 h-4" aria-hidden="true" />}
                {locating ? 'Standort wird bestimmt …' : 'Meinen Standort verwenden'}
            </button>

            {locationError && (
                <p className="text-xs text-red-600" role="status" data-testid="radius-location-error">
                    {locationError}
                </p>
            )}

            {/* --- UMKREIS --- */}
            <div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Umkreis in Kilometern">
                    {RADIUS_OPTIONS.map((km) => (
                        <button
                            key={km}
                            type="button"
                            onClick={() => onRadiusChange(km)}
                            disabled={!origin}
                            aria-pressed={radiusKm === km}
                            data-testid={`btn-radius-${km}`}
                            className={`min-h-10 px-3 py-1.5 rounded-lg text-sm font-semibold border transition
                                ${radiusKm === km
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary'}
                                disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-700`}
                        >
                            {km} km
                        </button>
                    ))}
                </div>
                {!origin && (
                    <p className="mt-1.5 text-xs text-gray-500">
                        Wähle zuerst einen Ort oder verwende deinen Standort.
                    </p>
                )}
            </div>

            {/* --- AKTIVER ZUSTAND IN KLARTEXT --- */}
            {aktiv && (
                <div className="rounded-lg bg-primaryLight border border-orange-100 px-3 py-2" data-testid="radius-active-summary">
                    <p className="text-sm text-gray-800">
                        <span className="font-bold">{radiusKm} km</span> um{' '}
                        <span className="font-bold">{origin.label}</span>
                    </p>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                        Luftlinie. Kursorte sind Ortsmittelpunkte und darum ungefähr.
                    </p>
                    {typeof resultCount === 'number' && (
                        <p className="text-[11px] text-gray-600">
                            {resultCount === 1 ? '1 Kurs' : `${resultCount} Kurse`} im Umkreis.
                        </p>
                    )}
                </div>
            )}

            {aktiv && (nurOnline > 0 || ohneOrt > 0) && (
                <p className="text-[11px] text-gray-500 flex gap-1.5" data-testid="radius-exclusion-hint">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                    <span>
                        {nurOnline > 0 && 'Reine Onlinekurse zählen nicht als Treffer im Umkreis. '}
                        {ohneOrt > 0 && 'Kurse ohne eindeutig zuordenbaren Veranstaltungsort können räumlich nicht geprüft werden – sie findest du weiterhin über die Suche ohne Umkreis.'}
                    </span>
                </p>
            )}
        </div>
    );
};

export default RadiusSearchPanel;
