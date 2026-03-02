import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // JWT-Auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
    }

    const { url } = req.body || {};
    if (!url || !url.includes('unsplash.com')) {
      return res.status(400).json({ error: 'Ungültige oder fehlende Unsplash-URL' });
    }

    // 1. Bild von Unsplash herunterladen
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({ error: 'Bild konnte nicht von Unsplash geladen werden' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. SHA-256 Hash berechnen (erste 16 Bytes = 32 Hex-Chars, wie imageUtils.js)
    const fullHash = createHash('sha256').update(buffer).digest('hex');
    const hash = fullHash.slice(0, 32);

    const ext = contentType.includes('png') ? 'png'
      : contentType.includes('webp') ? 'webp'
      : 'jpg';
    const fileName = `${hash}.${ext}`;
    const BUCKET = 'course-images';

    // 3. Dedup-Check: existiert das Bild bereits?
    const { data: existing } = await supabase.storage
      .from(BUCKET)
      .list('', { search: fileName });

    if (existing && existing.some(f => f.name === fileName)) {
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);
      return res.status(200).json({ url: publicUrl, deduplicated: true });
    }

    // 4. In Supabase Storage hochladen
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType,
        upsert: false
      });

    if (uploadError) {
      // Falls Datei bereits existiert (Race Condition) → URL zurückgeben
      if (uploadError.message?.includes('already exists') ||
          uploadError.message?.includes('Duplicate')) {
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(fileName);
        return res.status(200).json({ url: publicUrl, deduplicated: true });
      }
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

    return res.status(200).json({ url: publicUrl, deduplicated: false });

  } catch (error) {
    console.error('import-unsplash-image error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
