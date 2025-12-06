import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export default async function handler(req, res) {

  // --- KEYS (Inserted from your snippet) ---
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  const RESEND_KEY = "re_PWCFaKxw_LPBudxuw5WoRiefvdJSPnnds";
  // ----------------------------------------

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = new Resend(RESEND_KEY);

  try {
    // 1. Calculate Target Date (1 Month from now)
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);
    
    // Format: YYYY-MM-DD (e.g., "2025-01-06")
    const targetDateString = nextMonth.toISOString().split('T')[0];

    // 2. Find courses starting on that DATE (Ignoring the specific time)
    // We use .ilike to find any string starting with "2025-01-06"
    const { data: courses, error: courseError } = await supabase
      .from('