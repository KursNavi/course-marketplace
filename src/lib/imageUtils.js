import { supabase } from './supabase';

const BUCKET_NAME = 'course-images';

export const DEFAULT_COURSE_IMAGE = "https://nplxmpfasgpumpiddjfl.supabase.co/storage/v1/object/public/course-images/a0e887f57107603aaf4327ad40de2ab7.jpg";
export const DEFAULT_COVER_IMAGE = "https://nplxmpfasgpumpiddjfl.supabase.co/storage/v1/object/public/course-images/ca3c9cbb76c1d0b4b0bf300cdbd3bf39.jpg";

/**
 * Prüft ob eine URL auf Unsplash zeigt (sichere Hostname-Prüfung)
 */
export function isUnsplashUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.hostname === 'images.unsplash.com' ||
               parsed.hostname === 'unsplash.com' ||
               parsed.hostname.endsWith('.unsplash.com');
    } catch {
        return false;
    }
}

/**
 * Importiert ein Unsplash-Bild über den Server in Supabase Storage
 * @param {string} unsplashUrl - Die Unsplash-URL
 * @returns {string} Die neue Supabase Storage URL
 */
export async function importUnsplashImage(unsplashUrl) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Nicht angemeldet');
    }

    const response = await fetch('/api/import-unsplash-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ url: unsplashUrl })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Import fehlgeschlagen');
    }

    const { url } = await response.json();
    return url;
}

/**
 * Berechnet einen MD5-ähnlichen Hash aus einer Datei
 * Verwendet SubtleCrypto für schnelle Hash-Berechnung
 */
export async function computeImageHash(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Nur die ersten 16 Bytes für kürzeren Dateinamen
    return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Prüft ob ein Bild mit diesem Hash bereits im Storage existiert
 * @param {string} hash - Der SHA-256 Hash der Datei
 * @param {string} pathPrefix - Optionaler Pfad-Prefix (z.B. 'blog/')
 * @returns {string|null} Die Public URL wenn vorhanden, sonst null
 */
export async function getExistingImageByHash(hash, pathPrefix = '') {
    const fileName = `${hash}.jpg`;
    const fullPath = pathPrefix ? `${pathPrefix}${fileName}` : fileName;
    const folder = pathPrefix ? pathPrefix.replace(/\/$/, '') : '';

    // Versuche die Datei zu listen um zu prüfen ob sie existiert
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folder, { search: fileName });

    if (error || !data) return null;

    const exists = data.some(file => file.name === fileName);
    if (!exists) return null;

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fullPath);

    return publicUrl;
}

/**
 * Lädt ein Bild mit Hash-basiertem Namen hoch
 * @param {File} file - Die Bilddatei
 * @param {string} hash - Der SHA-256 Hash der Datei
 * @param {string} pathPrefix - Optionaler Pfad-Prefix (z.B. 'blog/')
 * @returns {string} Die Public URL des Bildes
 */
export async function uploadImageWithHash(file, hash, pathPrefix = '') {
    const fileName = `${hash}.jpg`;
    const fullPath = pathPrefix ? `${pathPrefix}${fileName}` : fileName;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fullPath, file, { upsert: false });

    if (uploadError) {
        // Falls Datei bereits existiert, ist das OK - wir verwenden sie einfach
        if (!uploadError.message.includes('already exists') &&
            !uploadError.message.includes('Duplicate')) {
            throw uploadError;
        }
    }

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fullPath);

    return publicUrl;
}

/**
 * Prüft ob ein Bild noch von anderen Kursen verwendet wird
 * @param {string} imageUrl - Die URL des Bildes
 * @param {string} excludeCourseId - Die ID des zu löschenden Kurses (ausschliessen)
 * @returns {boolean} true wenn das Bild noch von anderen Kursen verwendet wird
 */
export async function isImageUsedByOtherCourses(imageUrl, excludeCourseId) {
    if (!imageUrl) return false;

    // Unsplash-Bilder oder externe URLs nicht prüfen
    if (imageUrl.includes('unsplash.com') || !imageUrl.includes(BUCKET_NAME)) {
        return true; // Nicht löschen
    }

    const { data, error } = await supabase
        .from('courses')
        .select('id')
        .eq('image_url', imageUrl)
        .neq('id', excludeCourseId)
        .limit(1);

    if (error) {
        console.error('Fehler beim Prüfen der Bildverwendung:', error);
        return true; // Im Zweifelsfall nicht löschen
    }

    return data && data.length > 0;
}

/**
 * Extrahiert den Dateinamen aus einer Supabase Storage URL
 */
function extractFileNameFromUrl(imageUrl) {
    if (!imageUrl) return null;

    // URL Format: .../storage/v1/object/public/course-images/filename.jpg
    const match = imageUrl.match(/course-images\/([^?]+)/);
    return match ? match[1] : null;
}

/**
 * Löscht ein Bild aus dem Storage
 * @param {string} imageUrl - Die Public URL des Bildes
 */
export async function deleteImageFromStorage(imageUrl) {
    const fileName = extractFileNameFromUrl(imageUrl);
    if (!fileName) return;

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([fileName]);

    if (error) {
        console.error('Fehler beim Löschen des Bildes:', error);
    }
}

/**
 * Holt alle Bilder die von Kursen eines bestimmten Users verwendet werden
 * @param {string} userId - Die User ID
 * @returns {Array} Array von {url, usedBy: number, courseIds: string[]} Objekten
 */
export async function getUserCourseImages(userId) {
    const { data: courses, error } = await supabase
        .from('courses')
        .select('id, image_url')
        .eq('user_id', userId);

    if (error || !courses) return [];

    // Gruppiere nach image_url und zähle Verwendungen
    const imageMap = new Map();

    for (const course of courses) {
        const url = course.image_url;
        if (!url || url.includes('unsplash.com') || !url.includes(BUCKET_NAME)) {
            continue;
        }

        if (imageMap.has(url)) {
            const entry = imageMap.get(url);
            entry.usedBy++;
            entry.courseIds.push(course.id);
        } else {
            imageMap.set(url, { url, usedBy: 1, courseIds: [course.id] });
        }
    }

    return Array.from(imageMap.values());
}

/**
 * Löscht ein Bild aus der Bibliothek und setzt betroffene Kurse auf das Default-Bild
 * @param {string} imageUrl - Die URL des Bildes
 * @param {string[]} courseIds - Die IDs der Kurse die dieses Bild verwenden
 * @returns {Object} { success: boolean, updatedCourses: number, error?: string }
 */
export async function deleteImageFromLibrary(imageUrl, courseIds = []) {

    try {
        // 1. Setze alle betroffenen Kurse auf das Default-Bild
        if (courseIds.length > 0) {
            const { error: updateError } = await supabase
                .from('courses')
                .update({ image_url: DEFAULT_COURSE_IMAGE })
                .in('id', courseIds);

            if (updateError) {
                console.error('Fehler beim Aktualisieren der Kurse:', updateError);
                return { success: false, updatedCourses: 0, error: 'Kurse konnten nicht aktualisiert werden' };
            }
        }

        // 2. Lösche das Bild aus dem Storage
        await deleteImageFromStorage(imageUrl);

        return { success: true, updatedCourses: courseIds.length };
    } catch (error) {
        console.error('Fehler beim Löschen des Bildes:', error);
        return { success: false, updatedCourses: 0, error: error.message };
    }
}
