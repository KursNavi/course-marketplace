import { supabase } from './supabase';

const BUCKET_NAME = 'course-images';

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
 * @returns {string|null} Die Public URL wenn vorhanden, sonst null
 */
export async function getExistingImageByHash(hash) {
    const fileName = `${hash}.jpg`;

    // Versuche die Datei zu listen um zu prüfen ob sie existiert
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', { search: fileName });

    if (error || !data) return null;

    const exists = data.some(file => file.name === fileName);
    if (!exists) return null;

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

    return publicUrl;
}

/**
 * Lädt ein Bild mit Hash-basiertem Namen hoch
 * @returns {string} Die Public URL des Bildes
 */
export async function uploadImageWithHash(file, hash) {
    const fileName = `${hash}.jpg`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, { upsert: false });

    if (uploadError) {
        // Falls Datei bereits existiert, ist das OK - wir verwenden sie einfach
        if (!uploadError.message.includes('already exists') &&
            !uploadError.message.includes('Duplicate')) {
            throw uploadError;
        }
    }

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

    return publicUrl;
}

/**
 * Prüft ob ein Bild noch von anderen Kursen verwendet wird
 * @param {string} imageUrl - Die URL des Bildes
 * @param {string} excludeCourseId - Die ID des zu löschenden Kurses (ausschließen)
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
 * @returns {Array} Array von {url, usedBy: number} Objekten
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
            imageMap.get(url).usedBy++;
        } else {
            imageMap.set(url, { url, usedBy: 1 });
        }
    }

    return Array.from(imageMap.values());
}
