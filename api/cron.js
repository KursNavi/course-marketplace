import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// --- EMAIL HELPERS ---
const EMAIL_TRANSLATIONS = {
  en: {
    subject: "Payout Alert: ",
    title: "Payout Processed",
    body: (course, amount, list) => `Hello Teacher,<br>Your course <strong>${course}</strong> is starting soon.<br>Payout Amount: <strong>CHF ${amount}</strong><br><h3>Student List:</h3><ul>${list}</ul>`,
    cta: "Check Bank Details"
  },
  de: {
    subject: "Auszahlung: ",
    title: "Auszahlung bearbeitet",
    body: (course, amount, list) => `Hallo Kursleiter,<br>Dein Kurs <strong>${course}</strong> startet bald.<br>Auszahlungsbetrag: <strong>CHF ${amount}</strong><br><h3>Teilnehmerliste:</h3><ul>${list}</ul>`,
    cta: "Bankdaten prüfen"
  },
  fr: {
    subject: "Paiement : ",
    title: "Paiement traité",
    body: (course, amount, list) => `Bonjour,<br>Votre cours <strong>${course}</strong> commence bientôt.<br>Montant du paiement : <strong>CHF ${amount}</strong><br><h3>Liste des étudiants :</h3><ul>${list}</ul>`,
    cta: "Vérifier les coordonnées"
  }
};

const generateEmailHtml = (title, bodyHtml, ctaText) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background-color: #FA6E28; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
    .content { padding: 30px; color: #333333; line-height: 1.6; }
    .btn { display: inline-block; background-color: #FA6E28; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
    .footer { background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>KursNavi</h1></div>
    <div class="content">
      <h2>${title}</h2>
      <p>${bodyHtml}</p>
      <a href="https://www.kursnavi.ch/dashboard" class="btn">${ctaText}</a>
    </div>
    <div class="footer"><p>© ${new Date().getFullYear()} KursNavi Schweiz.</p></div>
  </div>
</body>
</html>
`;

export default async function handler(req, res) {

  // --- SECURE KEYS ---
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = 'btrespondek@gmail.com'; 

  if (!SUPABASE_URL || !SUPABASE_KEY || !RESEND_KEY) {
      return res.status(500).json({ error: "Keys missing in Vercel." });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const resend = new Resend(RESEND_KEY);

  try {
    const today = new Date();
    const nowISO = today.toISOString();
    let emailsSent = 0;
    let processedBookings = 0;

    // ============================================
    // PART 1: platform_flex bookings (payout after 7 days from payment)
    // ============================================
    const { data: flexBookings } = await supabase
      .from('bookings')
      .select('*, courses(*)')
      .eq('booking_type', 'platform_flex')
      .eq('is_paid', false)
      .eq('status', 'confirmed')
      .lte('payout_eligible_at', nowISO);

    if (flexBookings && flexBookings.length > 0) {
      // Group by course for batch processing
      const flexByCourse = {};
      for (const booking of flexBookings) {
        const courseId = booking.course_id;
        if (!flexByCourse[courseId]) {
          flexByCourse[courseId] = { course: booking.courses, bookings: [] };
        }
        flexByCourse[courseId].bookings.push(booking);
      }

      // Batch fetch all teacher profiles to avoid N+1
      const teacherIds = [...new Set(Object.values(flexByCourse).map(g => g.course?.user_id).filter(Boolean))];
      const allStudentIds = [...new Set(flexBookings.map(b => b.user_id))];

      const { data: teacherProfiles } = teacherIds.length > 0
        ? await supabase.from('profiles').select('id, email, language').in('id', teacherIds)
        : { data: [] };
      const { data: studentProfiles } = allStudentIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('id', allStudentIds)
        : { data: [] };

      const teacherMap = (teacherProfiles || []).reduce((m, p) => { m[p.id] = p; return m; }, {});
      const studentMap = (studentProfiles || []).reduce((m, p) => { m[p.id] = p; return m; }, {});

      for (const courseId of Object.keys(flexByCourse)) {
        const { course, bookings } = flexByCourse[courseId];
        if (!course) continue;

        // Get teacher info from batch
        const teacherProfile = course.user_id ? teacherMap[course.user_id] : null;
        const teacherEmail = teacherProfile?.email || ADMIN_EMAIL;
        const teacherLang = teacherProfile?.language || 'de';

        const t = EMAIL_TRANSLATIONS[teacherLang] || EMAIL_TRANSLATIONS['de'];

        const listHtml = bookings.map(booking => {
          const profile = studentMap[booking.user_id];
          return `<li>${profile?.full_name || 'Teilnehmer'} (${profile?.email || 'Keine Email'})</li>`;
        }).join('');

        // Calculate payout
        const totalRevenue = bookings.reduce((sum, b) => sum + (course.price || 0), 0);
        const payoutAmount = totalRevenue * 0.85;

        // Mark as paid
        const bookingIds = bookings.map(b => b.id);
        await supabase.from('bookings').update({ is_paid: true }).in('id', bookingIds);
        processedBookings += bookingIds.length;

        // Send email
        try {
          await resend.emails.send({
            from: 'KursNavi <info@kursnavi.ch>',
            to: teacherEmail,
            bcc: ADMIN_EMAIL,
            subject: `${t.subject}${course.title} (Flexible Buchungen)`,
            html: generateEmailHtml(t.title, t.body(course.title, payoutAmount.toFixed(2), listHtml), t.cta)
          });
          emailsSent++;
        } catch (emailError) {
          console.error(`Failed to send flex payout email to ${teacherEmail}:`, emailError);
        }
      }
    }

    // ============================================
    // PART 2: platform bookings (payout 25-35 days before event)
    // ============================================
    const startWindowDate = new Date(today);
    startWindowDate.setDate(today.getDate() + 25);
    const startWindow = `${startWindowDate.toISOString().split('T')[0]}T00:00:00`;

    const endWindowDate = new Date(today);
    endWindowDate.setDate(today.getDate() + 35);
    const endWindow = `${endWindowDate.toISOString().split('T')[0]}T23:59:59`;

    // Find events in the payout window
    const { data: events } = await supabase
      .from('course_events')
      .select('*, courses(*)')
      .gte('start_date', startWindow)
      .lte('start_date', endWindow);

    if (events && events.length > 0) {
      // Batch fetch all bookings for all events at once
      const eventIds = events.map(e => e.id);
      const { data: allEventBookings } = await supabase
        .from('bookings')
        .select('*')
        .in('event_id', eventIds)
        .eq('status', 'confirmed')
        .eq('is_paid', false);

      // Group bookings by event
      const bookingsByEvent = (allEventBookings || []).reduce((acc, b) => {
        if (!acc[b.event_id]) acc[b.event_id] = [];
        acc[b.event_id].push(b);
        return acc;
      }, {});

      // Batch fetch all teacher and student profiles
      const eventTeacherIds = [...new Set(events.map(e => e.courses?.user_id).filter(Boolean))];
      const eventStudentIds = [...new Set((allEventBookings || []).map(b => b.user_id))];

      const { data: eventTeacherProfiles } = eventTeacherIds.length > 0
        ? await supabase.from('profiles').select('id, email, language').in('id', eventTeacherIds)
        : { data: [] };
      const { data: eventStudentProfiles } = eventStudentIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('id', eventStudentIds)
        : { data: [] };

      const eventTeacherMap = (eventTeacherProfiles || []).reduce((m, p) => { m[p.id] = p; return m; }, {});
      const eventStudentMap = (eventStudentProfiles || []).reduce((m, p) => { m[p.id] = p; return m; }, {});

      for (const event of events) {
        const course = event.courses;
        if (!course) continue;

        const bookings = bookingsByEvent[event.id] || [];
        if (bookings.length === 0) continue;

        // Get teacher info from batch
        const teacherProfile = course.user_id ? eventTeacherMap[course.user_id] : null;
        const teacherEmail = teacherProfile?.email || ADMIN_EMAIL;
        const teacherLang = teacherProfile?.language || 'de';

        const t = EMAIL_TRANSLATIONS[teacherLang] || EMAIL_TRANSLATIONS['de'];

        const listHtml = bookings.map(booking => {
          const profile = eventStudentMap[booking.user_id];
          return `<li>${profile?.full_name || 'Teilnehmer'} (${profile?.email || 'Keine Email'})</li>`;
        }).join('');

        // Calculate payout
        const totalRevenue = bookings.length * (course.price || 0);
        const payoutAmount = totalRevenue * 0.85;

        // Mark as paid
        const bookingIds = bookings.map(b => b.id);
        await supabase.from('bookings').update({ is_paid: true }).in('id', bookingIds);
        processedBookings += bookingIds.length;

        // Send email
        try {
          await resend.emails.send({
            from: 'KursNavi <info@kursnavi.ch>',
            to: teacherEmail,
            bcc: ADMIN_EMAIL,
            subject: `${t.subject}${course.title}`,
            html: generateEmailHtml(t.title, t.body(course.title, payoutAmount.toFixed(2), listHtml), t.cta)
          });
          emailsSent++;
        } catch (emailError) {
          console.error(`Failed to send payout email to ${teacherEmail}:`, emailError);
        }
      }
    }

    // Also handle legacy bookings (old format without event_id)
    const { data: legacyCourses } = await supabase.from('courses').select('*').gte('start_date', startWindow).lte('start_date', endWindow);

    if (legacyCourses && legacyCourses.length > 0) {
      for (const course of legacyCourses) {
        // Find unpaid bookings without event_id (legacy)
        const { data: bookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('course_id', course.id)
          .is('event_id', null)
          .eq('is_paid', false);

        if (!bookings || bookings.length === 0) continue;

        // Only process if status is confirmed or null (legacy bookings may not have status)
        const validBookings = bookings.filter(b => !b.status || b.status === 'confirmed');
        if (validBookings.length === 0) continue;

        let teacherEmail = ADMIN_EMAIL;
        let teacherLang = 'de';
        if (course.user_id) {
          const { data: teacherProfile } = await supabase.from('profiles').select('email, language').eq('id', course.user_id).single();
          if (teacherProfile?.email) teacherEmail = teacherProfile.email;
          if (teacherProfile?.language) teacherLang = teacherProfile.language;
        }

        const t = EMAIL_TRANSLATIONS[teacherLang] || EMAIL_TRANSLATIONS['de'];

        const userIds = validBookings.map(b => b.user_id);
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);

        const listHtml = validBookings.map(booking => {
          const profile = profiles?.find(p => p.id === booking.user_id);
          return `<li>${profile?.full_name || 'Teilnehmer'} (${profile?.email || 'Keine Email'})</li>`;
        }).join('');

        const totalRevenue = validBookings.length * (course.price || 0);
        const payoutAmount = totalRevenue * 0.85;

        const bookingIds = validBookings.map(b => b.id);
        await supabase.from('bookings').update({ is_paid: true }).in('id', bookingIds);
        processedBookings += bookingIds.length;

        try {
          await resend.emails.send({
            from: 'KursNavi <info@kursnavi.ch>',
            to: teacherEmail,
            bcc: ADMIN_EMAIL,
            subject: `${t.subject}${course.title}`,
            html: generateEmailHtml(t.title, t.body(course.title, payoutAmount.toFixed(2), listHtml), t.cta)
          });
          emailsSent++;
        } catch (emailError) {
          console.error(`Failed to send legacy payout email to ${teacherEmail}:`, emailError);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payouts Processed",
      emailsSent: emailsSent,
      processedBookings: processedBookings
    });

  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}