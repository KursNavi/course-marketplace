/**
 * Supabase Image Cleanup Script
 *
 * Dieses Script:
 * 1. Findet verwaiste Bilder (nicht von Kursen referenziert)
 * 2. Findet Duplikate (gleicher Inhalt, verschiedene URLs)
 * 3. Konsolidiert Duplikate und löscht ungenutzte Bilder
 *
 * Verwendung:
 *   node scripts/cleanup-images.js --dry-run    # Nur analysieren, nichts löschen
 *   node scripts/cleanup-images.js --execute    # Tatsächlich aufräumen
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Lade Environment Variables (beide Dateien, .env.local hat Priorität)
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
    console.error('❌ Fehler: VITE_SUPABASE_URL und SUPABASE_SERVICE_KEY müssen gesetzt sein');
    console.log('   Für Lösch-Operationen wird der Service Key benötigt (nicht der anon key)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET_NAME = 'course-images';
const DRY_RUN = !process.argv.includes('--execute');

if (DRY_RUN) {
    console.log('🔍 DRY RUN MODUS - Keine Änderungen werden durchgeführt');
    console.log('   Verwende --execute um tatsächlich aufzuräumen\n');
} else {
    console.log('⚠️  EXECUTE MODUS - Änderungen werden durchgeführt!\n');
}

async function main() {
    console.log('='.repeat(60));
    console.log('SUPABASE IMAGE CLEANUP');
    console.log('='.repeat(60));

    // 1. Alle Bilder im Storage laden
    console.log('\n📦 Lade Bilder aus Storage...');
    const storageImages = await getAllStorageImages();
    console.log(`   Gefunden: ${storageImages.length} Bilder im Storage`);

    // 2. Alle Kurs-Bild-URLs laden
    console.log('\n📚 Lade Kurs-Referenzen...');
    const courseImageRefs = await getCourseImageReferences();
    console.log(`   Gefunden: ${courseImageRefs.length} Kurse mit Bildern`);

    // 3. Verwaiste Bilder finden
    console.log('\n🔎 Suche verwaiste Bilder...');
    const orphanedImages = findOrphanedImages(storageImages, courseImageRefs);
    console.log(`   Gefunden: ${orphanedImages.length} verwaiste Bilder`);

    if (orphanedImages.length > 0) {
        console.log('\n   Verwaiste Bilder:');
        orphanedImages.forEach(img => console.log(`   - ${img.name}`));
    }

    // 4. Duplikate finden (gleicher Inhalt)
    console.log('\n🔎 Suche Duplikate (gleicher Bildinhalt)...');
    const duplicates = await findDuplicateImages(storageImages);

    let totalDuplicateFiles = 0;
    if (duplicates.size > 0) {
        console.log(`   Gefunden: ${duplicates.size} Gruppen von Duplikaten`);
        console.log('\n   Duplikat-Gruppen:');
        for (const [hash, files] of duplicates) {
            console.log(`   Hash ${hash.substring(0, 8)}...:`);
            files.forEach((f, i) => {
                const marker = i === 0 ? '✓ (behalten)' : '✗ (Duplikat)';
                console.log(`     ${marker} ${f.name}`);
            });
            totalDuplicateFiles += files.length - 1; // Erstes behalten
        }
    } else {
        console.log('   Keine Duplikate gefunden');
    }

    // 5. Zusammenfassung
    console.log('\n' + '='.repeat(60));
    console.log('ZUSAMMENFASSUNG');
    console.log('='.repeat(60));
    console.log(`Bilder im Storage:     ${storageImages.length}`);
    console.log(`Verwaiste Bilder:      ${orphanedImages.length}`);
    console.log(`Duplikat-Dateien:      ${totalDuplicateFiles}`);
    console.log(`Zu löschende Dateien:  ${orphanedImages.length + totalDuplicateFiles}`);

    // 6. Cleanup durchführen
    if (!DRY_RUN && (orphanedImages.length > 0 || duplicates.size > 0)) {
        console.log('\n🧹 Führe Cleanup durch...');

        // Verwaiste Bilder löschen
        if (orphanedImages.length > 0) {
            console.log('\n   Lösche verwaiste Bilder...');
            await deleteImages(orphanedImages.map(img => img.name));
        }

        // Duplikate konsolidieren
        if (duplicates.size > 0) {
            console.log('\n   Konsolidiere Duplikate...');
            await consolidateDuplicates(duplicates);
        }

        console.log('\n✅ Cleanup abgeschlossen!');
    } else if (DRY_RUN && (orphanedImages.length > 0 || duplicates.size > 0)) {
        console.log('\n💡 Führe mit --execute aus um diese Dateien zu bereinigen');
    } else {
        console.log('\n✨ Keine Bereinigung nötig - alles sauber!');
    }
}

// Alle Bilder aus dem Storage Bucket laden
async function getAllStorageImages() {
    const allImages = [];
    let offset = 0;
    const limit = 100;

    while (true) {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list('', { limit, offset });

        if (error) {
            console.error('Fehler beim Laden der Storage-Bilder:', error);
            break;
        }

        if (!data || data.length === 0) break;

        const images = data.filter(file =>
            file.name && /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
        );

        allImages.push(...images);
        offset += limit;

        if (data.length < limit) break;
    }

    return allImages;
}

// Alle Kurs-Bild-Referenzen laden
async function getCourseImageReferences() {
    const { data, error } = await supabase
        .from('courses')
        .select('id, image_url, title');

    if (error) {
        console.error('Fehler beim Laden der Kurse:', error);
        return [];
    }

    return data || [];
}

// Verwaiste Bilder finden (im Storage aber nicht in courses referenziert)
function findOrphanedImages(storageImages, courseRefs) {
    // Extrahiere alle Dateinamen aus den Kurs-URLs
    const usedFileNames = new Set();

    for (const course of courseRefs) {
        if (!course.image_url) continue;
        // Ignoriere externe URLs (Unsplash etc.)
        if (!course.image_url.includes(BUCKET_NAME)) continue;

        const match = course.image_url.match(/course-images\/([^?]+)/);
        if (match) {
            usedFileNames.add(match[1]);
        }
    }

    // Finde Bilder die nicht referenziert werden
    return storageImages.filter(img => !usedFileNames.has(img.name));
}

// Duplikate finden durch Hash-Vergleich
async function findDuplicateImages(storageImages) {
    const hashMap = new Map(); // hash -> [files]

    console.log('   Berechne Bild-Hashes (kann dauern)...');

    let processed = 0;
    for (const img of storageImages) {
        try {
            // Bild herunterladen
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .download(img.name);

            if (error || !data) continue;

            // Hash berechnen
            const arrayBuffer = await data.arrayBuffer();
            const hash = crypto
                .createHash('sha256')
                .update(Buffer.from(arrayBuffer))
                .digest('hex');

            if (hashMap.has(hash)) {
                hashMap.get(hash).push({ ...img, hash });
            } else {
                hashMap.set(hash, [{ ...img, hash }]);
            }

            processed++;
            if (processed % 10 === 0) {
                process.stdout.write(`\r   Verarbeitet: ${processed}/${storageImages.length}`);
            }
        } catch (err) {
            console.error(`\n   Fehler bei ${img.name}:`, err.message);
        }
    }
    console.log(`\r   Verarbeitet: ${processed}/${storageImages.length}`);

    // Nur Gruppen mit mehr als einem Bild (echte Duplikate)
    const duplicates = new Map();
    for (const [hash, files] of hashMap) {
        if (files.length > 1) {
            // Sortiere: älteste Datei zuerst (die behalten wir)
            files.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            duplicates.set(hash, files);
        }
    }

    return duplicates;
}

// Bilder aus Storage löschen
async function deleteImages(fileNames) {
    if (fileNames.length === 0) return;

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(fileNames);

    if (error) {
        console.error('   Fehler beim Löschen:', error);
    } else {
        console.log(`   ✓ ${fileNames.length} Bilder gelöscht`);
    }
}

// Duplikate konsolidieren: Kurse auf kanonisches Bild umstellen, dann Duplikate löschen
async function consolidateDuplicates(duplicates) {
    for (const [hash, files] of duplicates) {
        const canonicalFile = files[0]; // Älteste Datei behalten
        const duplicateFiles = files.slice(1); // Rest sind Duplikate

        // Kanonische URL erstellen
        const { data: { publicUrl: canonicalUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(canonicalFile.name);

        // Alle Kurse mit Duplikat-URLs auf kanonische URL umstellen
        for (const dupFile of duplicateFiles) {
            const { data: { publicUrl: dupUrl } } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(dupFile.name);

            // Update alle Kurse die dieses Duplikat verwenden
            const { data: updated, error } = await supabase
                .from('courses')
                .update({ image_url: canonicalUrl })
                .eq('image_url', dupUrl)
                .select('id, title');

            if (error) {
                console.error(`   Fehler beim Update für ${dupFile.name}:`, error);
            } else if (updated && updated.length > 0) {
                console.log(`   ✓ ${updated.length} Kurse von ${dupFile.name} → ${canonicalFile.name}`);
            }
        }

        // Duplikat-Dateien löschen
        await deleteImages(duplicateFiles.map(f => f.name));
    }
}

// Script ausführen
main().catch(console.error);
