import { createClient } from '@supabase/supabase-js';

/**
 * Delete Account API
 * Deletes a user from auth.users using the service role key.
 * The user must provide a valid JWT token to prove their identity.
 *
 * POST /api/delete-account
 * Headers: Authorization: Bearer <jwt>
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Extract JWT from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify the user's identity using their JWT
    const supabaseAuth = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Delete the auth user using admin privileges
    const { error: deleteError } = await supabaseAuth.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return res.status(500).json({ error: 'Failed to delete auth user: ' + deleteError.message });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
