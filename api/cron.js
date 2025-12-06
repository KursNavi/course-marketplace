import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export default async function handler(req, res) {

  // --- KEYS ---
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  const RESEND_KEY = "re_PWCFaKxw_LPBudxuw5WoRiefvdJSPnnds";
  // ------------

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = new Resend(RESEND_KEY);

  try {
    // 1. Calculate Target Date
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);
    const targetDateStr = nextMonth.toISOString().split('T')[0];
    const startOfDay = `${targetDateStr}T00:00:00`;
    const endOfDay = `${targetDateStr}T23:59:59`;

    // 2. Find Course
    const { data: courses } = await supabase
      .from('courses')
      .select('*')
      .gte('start_date', startOfDay)
      .lte('start_date', endOfDay);

    if (!courses || courses.length === 0) {
      return res.status(200).json({ message: "No courses found for " + targetDateStr });
    }

    // --- DEBUGGING SECTION ---
    // We will collect data here to show you on the screen
    let debugReport = [];

    for (const course of courses) {
        
        // fetch ALL bookings for this course (regardless of payment status)
        const { data: allBookings } = await supabase
            .from('bookings')
            .select('*')
            .eq('course_id', course.id);

        debugReport.push({
            courseTitle: course.title,
            courseId: course.id,
            totalBookingsFound: allBookings.length,
            // Show us the status of each booking
            bookingDetails: allBookings.map(b => ({ 
                id: b.id, 
                is_paid_status: b.is_paid 
            }))
        });
    }

    // Return the report to the screen so we can see what's wrong
    return res.status(200).json({
      success: true,
      report: debugReport
    });
    // -------------------------

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}