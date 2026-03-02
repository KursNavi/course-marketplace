/**
 * Migrate Unsplash Images to Supabase Storage
 *
 * Findet alle Kurse und Profile mit Unsplash-URLs und importiert die Bilder
 * in unseren Supabase Storage (course-images Bucket).
 *
 * Verwendung:
 *   node scripts/migrate-unsplash-images.js --dry-run    # Nur analysieren
 *   node scripts/migrate-unsplash-images.js --execute    # Tatsächlich migrieren
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

dotenv.config({ path: resolve(rootDir, '.env') });
dotenv.config({ path: resolve(rootDir, '.env.local'), override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Fehler: VITE_SUPABASE_URL und SUPABASE_SERVICE_KEY muessen gesetzt sein');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET = 'course-images';
const DRY_RUN = !process.argv.includes('--execute');

if (DRY_RUN) {
    console.log('DRY RUN MODUS - Keine Aenderungen werden durchgefuehrt');
    console.log('Verwende --execute um tatsaechlich zu migrieren\n');
} else {
    console.log('EXECUTE MODUS - Aenderungen werden durchgefuehrt!\n');
}

/**
 * Laedt ein Bild herunter, berechnet Hash und speichert in Storage
 * @returns {string} Die neue Supabase Storage URL
 */
async function importImage(unsplashUrl) {
    const response = await fetch(unsplashUrl);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} fuer ${unsplashUrl}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // SHA-256 Hash (erste 16 Bytes = 32 Hex-Chars, wie imageUtils.js)
    const fullHash = createHash('sha256').update(buffer).digest('hex');
    const hash = fullHash.slice(0, 32);

    const ext = contentType.includes('png') ? 'png'
        : contentType.includes('webp') ? 'webp'
        : 'jpg';
    const fileName = `${hash}.${ext}`;

    // Pruefen ob bereits vorhanden
    const { data: existing } = await supabase.storage
        .from(BUCKET)
        .list('', { search: fileName });

    if (existing && existing.some(f => f.name === fileName)) {
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(fileName);
        console.log(`  [DEDUP] ${fileName} existiert bereits`);
        return publicUrl;
    }

    if (!DRY_RUN) {
        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(fileName, buffer, { contentType, upsert: false });

        if (error && !error.message?.includes('already exists')) {
            throw error;
        }
    }

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

    console.log(`  [UPLOAD] ${fileName} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return publicUrl;
}

async function main() {
    console.log('='.repeat(60));
    console.log('Unsplash-Bilder Migration');
    console.log('='.repeat(60));

    // 1. Kurse mit Unsplash-URLs finden
    console.log('\n--- Kurse mit Unsplash-URLs ---');
    const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, image_url')
        .like('image_url', '%unsplash.com%');

    if (coursesError) {
        console.error('Fehler beim Laden der Kurse:', coursesError);
        process.exit(1);
    }

    console.log(`Gefunden: ${courses.length} Kurse mit Unsplash-URLs\n`);

    // Unique URLs sammeln (viele Kurse nutzen dasselbe Default-Bild)
    const urlMap = new Map(); // unsplashUrl -> storageUrl

    for (const course of courses) {
        const url = course.image_url;
        if (!urlMap.has(url)) {
            urlMap.set(url, null); // Platzhalter
        }
    }

    console.log(`Unique Unsplash-URLs: ${urlMap.size}\n`);

    // Jede unique URL importieren
    for (const [unsplashUrl] of urlMap) {
        try {
            console.log(`Importiere: ${unsplashUrl.substring(0, 80)}...`);
            const storageUrl = await importImage(unsplashUrl);
            urlMap.set(unsplashUrl, storageUrl);

            // Rate Limiting: 500ms Pause zwischen Downloads
            await new Promise(r => setTimeout(r, 500));
        } catch (err) {
            console.error(`  [FEHLER] ${err.message}`);
        }
    }

    // Kurse aktualisieren
    let updatedCourses = 0;
    for (const [unsplashUrl, storageUrl] of urlMap) {
        if (!storageUrl) continue;

        const affected = courses.filter(c => c.image_url === unsplashUrl);
        console.log(`\nErsetze ${unsplashUrl.substring(0, 60)}... -> ${storageUrl.substring(0, 60)}...`);
        console.log(`  Betrifft ${affected.length} Kurs(e)`);

        if (!DRY_RUN) {
            const { error } = await supabase
                .from('courses')
                .update({ image_url: storageUrl })
                .like('image_url', `%${unsplashUrl.split('?')[0]}%`);

            if (error) {
                console.error(`  [FEHLER] Update fehlgeschlagen:`, error);
            } else {
                updatedCourses += affected.length;
            }
        }
    }

    // 2. Profile mit Unsplash cover_image_url
    console.log('\n--- Profile mit Unsplash Cover-URLs ---');
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, cover_image_url')
        .like('cover_image_url', '%unsplash.com%');

    if (profilesError) {
        console.error('Fehler beim Laden der Profile:', profilesError);
    } else {
        console.log(`Gefunden: ${profiles.length} Profile mit Unsplash Cover-URLs\n`);

        for (const profile of profiles) {
            const url = profile.cover_image_url;
            if (!urlMap.has(url)) {
                try {
                    console.log(`Importiere Cover: ${url.substring(0, 80)}...`);
                    const storageUrl = await importImage(url);
                    urlMap.set(url, storageUrl);
                    await new Promise(r => setTimeout(r, 500));
                } catch (err) {
                    console.error(`  [FEHLER] ${err.message}`);
                }
            }

            const storageUrl = urlMap.get(url);
            if (storageUrl && !DRY_RUN) {
                const { error } = await supabase
                    .from('profiles')
                    .update({ cover_image_url: storageUrl })
                    .eq('id', profile.id);

                if (error) {
                    console.error(`  [FEHLER] Profile-Update:`, error);
                }
            }
        }
    }

    // Zusammenfassung
    console.log('\n' + '='.repeat(60));
    console.log('ZUSAMMENFASSUNG');
    console.log('='.repeat(60));
    console.log(`Unique Unsplash-URLs importiert: ${[...urlMap.values()].filter(Boolean).length}`);
    console.log(`Kurse aktualisiert: ${DRY_RUN ? `${courses.length} (dry-run)` : updatedCourses}`);
    console.log(`Profile aktualisiert: ${DRY_RUN ? `${profiles?.length || 0} (dry-run)` : (profiles?.length || 0)}`);

    // Neue Default-URLs ausgeben
    const defaultCourseUnsplash = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3";
    const defaultCoverUnsplash = "https://images.unsplash.com/photo-1557683316-973673baf926";

    for (const [unsplashUrl, storageUrl] of urlMap) {
        if (unsplashUrl.includes('photo-1516321318423-f06f85e504b3') && storageUrl) {
            console.log(`\nNeue DEFAULT_COURSE_IMAGE:\n  ${storageUrl}`);
        }
        if (unsplashUrl.includes('photo-1557683316-973673baf926') && storageUrl) {
            console.log(`\nNeue DEFAULT_COVER_IMAGE:\n  ${storageUrl}`);
        }
    }

    if (DRY_RUN) {
        console.log('\n-> Verwende --execute um die Migration durchzufuehren');
    }
}

main().catch(err => {
    console.error('Migration fehlgeschlagen:', err);
    process.exit(1);
});
