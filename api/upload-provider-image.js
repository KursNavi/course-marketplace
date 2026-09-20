import { createClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const BUCKET_NAME = 'course-images';
const ALLOWED_TYPES = new Set(['logo', 'cover']);
const MIME_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

function getFileExtension(fileName) {
  const extension = String(fileName || '').split('.').pop()?.toLowerCase() || '';
  return extension === 'jpeg' ? 'jpg' : extension;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const token = authHeader.slice('Bearer '.length);

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
    }

    const { imageBase64, fileName, type, reset } = parseBody(req);
    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ error: 'Ungültige Bilddaten' });
    }

    const fieldName = type === 'logo' ? 'logo_url' : 'cover_image_url';

    if (reset) {
      const { data: profile, error: profileReadError } = await supabaseAdmin
        .from('profiles')
        .select(fieldName)
        .eq('id', authData.user.id)
        .single();

      if (profileReadError) {
        console.error('upload-provider-image profile read error:', profileReadError);
        return res.status(500).json({ error: 'Profil konnte nicht gelesen werden' });
      }

      const currentUrl = profile?.[fieldName];
      const publicPathMarker = `/storage/v1/object/public/${BUCKET_NAME}/`;
      const encodedPath = currentUrl?.includes(publicPathMarker)
        ? currentUrl.split(publicPathMarker)[1]
        : null;
      const currentPath = encodedPath ? decodeURIComponent(encodedPath) : null;

      if (currentPath?.startsWith(`providers/${authData.user.id}/`)) {
        const { error: removeError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .remove([currentPath]);
        if (removeError) console.warn('upload-provider-image cleanup warning:', removeError);
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ [fieldName]: null })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('upload-provider-image reset error:', profileError);
        return res.status(500).json({ error: 'Profil-Update fehlgeschlagen' });
      }

      return res.status(200).json({ ok: true, publicUrl: null });
    }

    if (!imageBase64 || !fileName) {
      return res.status(400).json({ error: 'Ungültige Bilddaten' });
    }

    const extension = getFileExtension(fileName);
    const contentType = MIME_TYPES[extension];
    if (!contentType) {
      return res.status(400).json({ error: 'Dateiformat nicht unterstützt' });
    }

    const base64Payload = String(imageBase64).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length || buffer.length > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: 'Bild darf maximal 2MB gross sein' });
    }

    const storagePath = `providers/${authData.user.id}/${type}_${Date.now()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, { upsert: false, contentType });

    if (uploadError) {
      console.error('upload-provider-image storage error:', uploadError);
      return res.status(500).json({ error: 'Upload fehlgeschlagen' });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ [fieldName]: publicUrl })
      .eq('id', authData.user.id);

    if (profileError) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([storagePath]);
      console.error('upload-provider-image profile error:', profileError);
      return res.status(500).json({ error: 'Profil-Update fehlgeschlagen' });
    }

    return res.status(200).json({ ok: true, publicUrl });
  } catch (error) {
    console.error('upload-provider-image error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
