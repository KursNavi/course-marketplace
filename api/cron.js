import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {

  // --- KEYS ---
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  // ------------

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // 1. Fetch the specific booking we know exists (ID 70)
    // We select '*' to see every single column name
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', 70)
      .single();

    if (error) throw error;

    // 2. Show the raw data
    return res.status(200).json({
      success: true,
      RAW_DATA_FROM_DB: booking
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}