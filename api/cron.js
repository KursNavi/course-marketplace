import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {

  // --- KEYS ---
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  // ------------

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // 1. Get the booking to find the User ID
    const { data: booking } = await supabase
        .from('bookings')
        .select('user_id')
        .eq('id', 70) // Your test booking ID
        .single();

    if (!booking) return res.status(200).json({ error: "Booking 70 not found" });

    // 2. Search for the Profile using that User ID
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*') // Grab EVERYTHING to see correct column names
        .eq('id', booking.user_id)
        .single();

    // 3. Show the results
    return res.status(200).json({
      success: true,
      bookingUserId: booking.user_id,
      profileFound: profile || "NULL (Profile not found!)",
      databaseError: error ? error.message : "None"
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}