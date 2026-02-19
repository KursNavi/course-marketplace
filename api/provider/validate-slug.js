import { createClient } from '@supabase/supabase-js';

/**
 * Slug Validation API
 * POST /api/provider/validate-slug
 *
 * Validates a proposed slug for a provider profile.
 * Checks:
 * - Format (lowercase, alphanumeric, hyphens only)
 * - Availability (not already taken)
 * - Cooldown (if updating existing slug, must be 30+ days since last change)
 *
 * Request body:
 * {
 *   slug: string,      // Proposed slug
 *   providerId?: string // Provider ID (for checking cooldown on updates)
 * }
 *
 * Response:
 * {
 *   valid: boolean,
 *   available: boolean,
 *   canChange: boolean, // For updates: has cooldown passed?
 *   error?: string,
 *   suggestions?: string[] // Alternative slugs if not available
 * }
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { slug, providerId } = req.body;

    if (!slug) {
      return res.status(400).json({
        valid: false,
        error: 'Slug is required'
      });
    }

    // Validate format
    const formatRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const isValidFormat = formatRegex.test(slug);

    if (!isValidFormat) {
      return res.status(200).json({
        valid: false,
        available: false,
        canChange: true,
        error: 'Slug muss Kleinbuchstaben, Zahlen und Bindestriche enthalten (z.B. meine-schule-123)'
      });
    }

    // Check minimum length
    if (slug.length < 3) {
      return res.status(200).json({
        valid: false,
        available: false,
        canChange: true,
        error: 'Slug muss mindestens 3 Zeichen lang sein'
      });
    }

    // Check maximum length
    if (slug.length > 50) {
      return res.status(200).json({
        valid: false,
        available: false,
        canChange: true,
        error: 'Slug darf maximal 50 Zeichen lang sein'
      });
    }

    // Reserved slugs
    const reservedSlugs = ['admin', 'api', 'login', 'dashboard', 'search', 'new', 'edit', 'delete', 'kursnavi', 'support', 'help'];
    if (reservedSlugs.includes(slug)) {
      return res.status(200).json({
        valid: false,
        available: false,
        canChange: true,
        error: 'Dieser Slug ist reserviert'
      });
    }

    // Check availability
    const { data: existingProvider } = await supabase
      .from('profiles')
      .select('id, slug')
      .eq('slug', slug)
      .single();

    // Check if slug is taken by someone else
    const isTakenByOther = existingProvider && existingProvider.id !== providerId;

    // Generate suggestions if not available
    let suggestions = [];
    if (isTakenByOther) {
      for (let i = 2; i <= 5; i++) {
        const suggestion = `${slug}-${i}`;
        const { data: check } = await supabase
          .from('profiles')
          .select('id')
          .eq('slug', suggestion)
          .single();

        if (!check) {
          suggestions.push(suggestion);
          if (suggestions.length >= 3) break;
        }
      }
    }

    // Check cooldown for updates
    let canChange = true;
    let cooldownEnds = null;

    if (providerId && existingProvider?.id !== providerId) {
      // This is an update (provider already has a different slug)
      const { data: provider } = await supabase
        .from('profiles')
        .select('last_slug_change_at')
        .eq('id', providerId)
        .single();

      if (provider?.last_slug_change_at) {
        const lastChange = new Date(provider.last_slug_change_at);
        const now = new Date();
        const daysSinceChange = (now - lastChange) / (1000 * 60 * 60 * 24);

        if (daysSinceChange < 30) {
          canChange = false;
          cooldownEnds = new Date(lastChange.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }
      }
    }

    return res.status(200).json({
      valid: isValidFormat && slug.length >= 3 && !reservedSlugs.includes(slug),
      available: !isTakenByOther,
      canChange,
      cooldownEnds,
      suggestions: isTakenByOther ? suggestions : []
    });

  } catch (error) {
    console.error('Slug validation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
