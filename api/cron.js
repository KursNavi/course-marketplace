import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getEmailConfig, resolveUserEmail, sendEmailOrThrow } from './_lib/email-config.js';

// --- EMAIL HELPERS ---
const EMAIL_TRANSLATIONS = {
  en: {
    subject: "Payout Alert: ",
    title: "Payout Processed",
    body: (course, amount, list) => `Hello Teacher,<br>Your course <strong>${course}</strong> has been completed.<br>Payout Amount: <strong>CHF ${amount}</strong><br><h3>Student List:</h3><ul>${list}</ul>`,
    cta: "Check Bank Details"
  },
  de: {
    subject: "Auszahlung: ",
    title: "Auszahlung bearbeitet",
    body: (course, amount, list) => `Hallo Kursleiter,<br>Dein Kurs <strong>${course}</strong> wurde durchgeführt.<br>Auszahlungsbetrag: <strong>CHF ${amount}</strong><br><h3>Teilnehmerliste:</h3><ul>${list}</ul>`,
    cta: "Bankdaten prüfen"
  },
  fr: {
    subject: "Paiement : ",
    title: "Paiement traité",
    body: (course, amount, list) => `Bonjour,<br>Votre cours <strong>${course}</strong> a été réalisé.<br>Montant du paiement : <strong>CHF ${amount}</strong><br><h3>Liste des étudiants :</h3><ul>${list}</ul>`,
    cta: "Vérifier les coordonnées"
  }
};

const generateEmailHtml = (title, bodyHtml, ctaText) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
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
  const ADMIN_EMAIL = getEmailConfig().adminEmail; 

  if (!SUPABASE_URL || !SUPABASE_KEY || !RESEND_KEY) {
      return res.status(500).json({ error: "Keys missing in Vercel." });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const resend = new Resend(RESEND_KEY);
  const emailConfig = getEmailConfig();

  try {
    const today = new Date();
    const nowISO = today.toISOString();
    let emailsSent = 0;
    let processedBookings = 0;

    // ============================================
    // PART 1: platform_flex bookings (payout 14 days after payment)
    // ============================================
    const { data: flexBookings } = await supabase
      .from('bookings')
      .select('*, courses(*)')
      .eq('booking_type', 'platform_flex')
      .eq('is_paid', false)
      .in('status', ['confirmed', 'refunded'])
      .is('disputed_at', null)
      .not('delivered_at', 'is', null)
      .lte('payout_eligible_at', nowISO);

    const eligibleFlexBookings = (flexBookings || []).filter((b) => {
      if (b.goodwill_status === 'pending') return false;
      if (!b.refunded_at) return true;
      return b.goodwill_status === 'approved' && b.goodwill_refund_percent > 0 && b.goodwill_refund_percent < 100;
    });

    if (eligibleFlexBookings.length > 0) {
      // Group by course for batch processing
      const flexByCourse = {};
      for (const booking of eligibleFlexBookings) {
        const courseId = booking.course_id;
        if (!flexByCourse[courseId]) {
          flexByCourse[courseId] = { course: booking.courses, bookings: [] };
        }
        flexByCourse[courseId].bookings.push(booking);
      }

      // Batch fetch all teacher profiles to avoid N+1
      const teacherIds = [...new Set(Object.values(flexByCourse).map(g => g.course?.user_id).filter(Boolean))];
      const allStudentIds = [...new Set(eligibleFlexBookings.map(b => b.user_id))];

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
        const totalRevenue = bookings.reduce((sum, b) => {
          const refundedAmount = (b.goodwill_status === 'approved' ? (b.goodwill_refund_amount_cents || 0) : 0) / 100;
          return sum + Math.max((course.price || 0) - refundedAmount, 0);
        }, 0);
        const payoutAmount = totalRevenue * 0.85;

        // Mark as paid (guard against concurrent refund)
        const bookingIds = bookings.map(b => b.id);
        const { count: flexPaidCount } = await supabase
          .from('bookings')
          .update({ is_paid: true }, { count: 'exact' })
          .in('id', bookingIds)
          .eq('is_paid', false);
        processedBookings += flexPaidCount || 0;

        if (!flexPaidCount) continue;

        // Send email
        try {
          await sendEmailOrThrow(resend, 'cron-flex-payout', {
            from: emailConfig.from,
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
    // PART 2: platform bookings (payout after event, via payout_eligible_at)
    // ============================================
    const { data: platformBookingsRaw } = await supabase
      .from('bookings')
      .select('*, courses(*), course_events!event_id(cancelled_at)')
      .eq('booking_type', 'platform')
      .eq('is_paid', false)
      .in('status', ['confirmed', 'refunded'])
      .is('disputed_at', null)
      .not('event_id', 'is', null)
      .lte('payout_eligible_at', nowISO);

    // Safety: exclude bookings for cancelled events (should already be refunded, but guard against partial failures)
    const platformBookings = (platformBookingsRaw || []).filter((b) => {
      if (b.course_events?.cancelled_at || b.goodwill_status === 'pending') return false;
      if (!b.refunded_at) return true;
      return b.goodwill_status === 'approved' && b.goodwill_refund_percent > 0 && b.goodwill_refund_percent < 100;
    });

    if (platformBookings && platformBookings.length > 0) {
      // Group by course for batch processing
      const platformByCourse = {};
      for (const booking of platformBookings) {
        const courseId = booking.course_id;
        if (!platformByCourse[courseId]) {
          platformByCourse[courseId] = { course: booking.courses, bookings: [] };
        }
        platformByCourse[courseId].bookings.push(booking);
      }

      // Batch fetch all teacher and student profiles
      const platformTeacherIds = [...new Set(Object.values(platformByCourse).map(g => g.course?.user_id).filter(Boolean))];
      const platformStudentIds = [...new Set(platformBookings.map(b => b.user_id))];

      const { data: platformTeacherProfiles } = platformTeacherIds.length > 0
        ? await supabase.from('profiles').select('id, email, language').in('id', platformTeacherIds)
        : { data: [] };
      const { data: platformStudentProfiles } = platformStudentIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('id', platformStudentIds)
        : { data: [] };

      const platformTeacherMap = (platformTeacherProfiles || []).reduce((m, p) => { m[p.id] = p; return m; }, {});
      const platformStudentMap = (platformStudentProfiles || []).reduce((m, p) => { m[p.id] = p; return m; }, {});

      for (const courseId of Object.keys(platformByCourse)) {
        const { course, bookings } = platformByCourse[courseId];
        if (!course) continue;

        // Get teacher info from batch
        const teacherProfile = course.user_id ? platformTeacherMap[course.user_id] : null;
        const teacherEmail = teacherProfile?.email || ADMIN_EMAIL;
        const teacherLang = teacherProfile?.language || 'de';

        const t = EMAIL_TRANSLATIONS[teacherLang] || EMAIL_TRANSLATIONS['de'];

        const listHtml = bookings.map(booking => {
          const profile = platformStudentMap[booking.user_id];
          return `<li>${profile?.full_name || 'Teilnehmer'} (${profile?.email || 'Keine Email'})</li>`;
        }).join('');

        // Calculate payout
        const totalRevenue = bookings.reduce((sum, b) => {
          const refundedAmount = (b.goodwill_status === 'approved' ? (b.goodwill_refund_amount_cents || 0) : 0) / 100;
          return sum + Math.max((course.price || 0) - refundedAmount, 0);
        }, 0);
        const payoutAmount = totalRevenue * 0.85;

        // Mark as paid (guard against concurrent refund)
        const bookingIds = bookings.map(b => b.id);
        const { count: platformPaidCount } = await supabase
          .from('bookings')
          .update({ is_paid: true }, { count: 'exact' })
          .in('id', bookingIds)
          .eq('is_paid', false);
        processedBookings += platformPaidCount || 0;

        if (!platformPaidCount) continue;

        // Send email
        try {
          await sendEmailOrThrow(resend, 'cron-platform-payout', {
            from: emailConfig.from,
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

    // ============================================
    // PART 2b: Stale platform_flex bookings (no delivery after 90 days)
    // ============================================
    let staleAlertsSent = 0;
    const STALE_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    const staleCutoff = new Date(today.getTime() - STALE_DAYS_MS).toISOString();

    const { data: staleFlexBookings } = await supabase
      .from('bookings')
      .select('id, user_id, course_id, paid_at, courses(title, user_id)')
      .eq('booking_type', 'platform_flex')
      .eq('status', 'confirmed')
      .eq('is_paid', false)
      .is('delivered_at', null)
      .is('refunded_at', null)
      .lte('paid_at', staleCutoff);

    if (staleFlexBookings && staleFlexBookings.length > 0) {
      const staleListHtml = staleFlexBookings.map(b =>
        `<li><strong>${b.courses?.title || 'Kurs'}</strong> – Booking ${b.id}, bezahlt am ${new Date(b.paid_at).toLocaleDateString('de-CH')}</li>`
      ).join('');

      try {
        await sendEmailOrThrow(resend, 'cron-stale-flex-alert', {
          from: emailConfig.from,
          to: ADMIN_EMAIL,
          subject: `Achtung: ${staleFlexBookings.length} flexible Buchung(en) ohne Durchführung seit 90+ Tagen`,
          html: generateEmailHtml(
            'Stale Flex-Buchungen',
            `<p>Die folgenden platform_flex Buchungen wurden seit über 90 Tagen nicht als durchgeführt markiert. Bitte prüfen und ggf. manuell erstatten:</p><ul>${staleListHtml}</ul>`,
            'Im Dashboard prüfen'
          )
        });
        staleAlertsSent++;
        emailsSent++;
      } catch (emailError) {
        console.error('Stale flex alert email failed:', emailError);
      }
    }

    // ============================================
    // PART 3: Package Renewal Reminders (28, 14, 7 Tage vor Ablauf)
    // ============================================
    let remindersSent = 0;
    const REMINDER_DAYS = [28, 14, 7]; // 4 Wochen, 2 Wochen, 1 Woche

    // Fetch all paid profiles with future expiry (within 28 days)
    const reminderWindowDate = new Date(today);
    reminderWindowDate.setDate(today.getDate() + 29); // slightly wider to catch edge
    const reminderWindowISO = reminderWindowDate.toISOString();

    const { data: reminderProfiles, error: reminderError } = await supabase
      .from('profiles')
      .select('id, email, package_tier, package_expires_at, package_reminder_sent')
      .neq('package_tier', 'basic')
      .gt('package_expires_at', nowISO) // not yet expired
      .lt('package_expires_at', reminderWindowISO) // within 28 days
      .not('package_expires_at', 'is', null);

    if (reminderError) {
      console.error('Package reminder query error:', reminderError);
    }

    if (!reminderError && reminderProfiles && reminderProfiles.length > 0) {
      for (const profile of reminderProfiles) {
        const expiresAt = new Date(profile.package_expires_at);
        const daysRemaining = Math.ceil((expiresAt - today) / (1000 * 60 * 60 * 24));
        const lastSent = profile.package_reminder_sent || 999; // 999 = no reminder sent yet
        const tierLabel = { pro: 'Pro', premium: 'Premium', enterprise: 'Enterprise' }[profile.package_tier] || profile.package_tier;
        const expiryFormatted = expiresAt.toLocaleDateString('de-CH');

        // Find which reminder to send (most urgent first)
        let targetReminder = null;
        for (const days of REMINDER_DAYS) {
          if (daysRemaining <= days && lastSent > days) {
            targetReminder = days;
            break; // send the most urgent one
          }
        }

        if (!targetReminder) continue;

        // Determine urgency for email subject/content
        const urgencyText = targetReminder === 7 ? 'in 1 Woche'
          : targetReminder === 14 ? 'in 2 Wochen'
          : 'in 4 Wochen';

        const isUrgent = targetReminder === 7;

        try {
          await sendEmailOrThrow(resend, 'cron-package-reminder', {
            from: emailConfig.from,
            to: profile.email,
            subject: isUrgent
              ? `Dein ${tierLabel} Paket läuft ${urgencyText} ab!`
              : `Erinnerung: Dein ${tierLabel} Paket läuft ${urgencyText} ab`,
            html: generateEmailHtml(
              isUrgent ? 'Abo läuft bald ab!' : 'Abo-Erinnerung',
              `<p>Dein <strong>${tierLabel}</strong> Paket läuft am <strong>${expiryFormatted}</strong> ab (${urgencyText}).</p>
               <p>${isUrgent
                 ? 'Verlängere jetzt, damit du keine Features verlierst. Nach Ablauf wirst du automatisch auf den kostenlosen Basic-Plan zurückgestuft.'
                 : 'Verlängere rechtzeitig, um weiterhin alle Features nutzen zu können.'
               }</p>`,
              'Jetzt verlängern'
            )
          });
          emailsSent++;
          remindersSent++;
        } catch (emailErr) {
          console.error(`Reminder email to ${profile.email} failed:`, emailErr);
        }

        // Update reminder tracking
        await supabase
          .from('profiles')
          .update({ package_reminder_sent: targetReminder })
          .eq('id', profile.id);
      }
    }

    // ============================================
    // PART 4: Package Expiry – Downgrade abgelaufener Pakete
    // ============================================
    let expiredPackages = 0;

    const { data: expiredProfiles, error: expiryError } = await supabase
      .from('profiles')
      .select('id, email, package_tier, package_expires_at, pending_package_tier, pending_package_expires_at, pending_package_stripe_session_id')
      .neq('package_tier', 'basic')
      .lt('package_expires_at', nowISO)
      .not('package_expires_at', 'is', null);

    if (expiryError) {
      console.error('Package expiry query error:', expiryError);
    }

    if (!expiryError && expiredProfiles && expiredProfiles.length > 0) {
      for (const profile of expiredProfiles) {
        const tierLabel = { pro: 'Pro', premium: 'Premium', enterprise: 'Enterprise' }[profile.package_tier] || profile.package_tier;
        const expiryDate = new Date(profile.package_expires_at).toLocaleDateString('de-CH');

        if (profile.pending_package_tier) {
          // Activate the pre-paid pending package
          const pendingTierLabel = { pro: 'Pro', premium: 'Premium', enterprise: 'Enterprise' }[profile.pending_package_tier] || profile.pending_package_tier;
          const pendingExpiryFormatted = profile.pending_package_expires_at
            ? new Date(profile.pending_package_expires_at).toLocaleDateString('de-CH')
            : '–';

          const { error: activateError } = await supabase
            .from('profiles')
            .update({
              package_tier: profile.pending_package_tier,
              package_expires_at: profile.pending_package_expires_at,
              package_stripe_session_id: profile.pending_package_stripe_session_id,
              package_reminder_sent: null,
              pending_package_tier: null,
              pending_package_expires_at: null,
              pending_package_stripe_session_id: null,
            })
            .eq('id', profile.id);

          if (activateError) {
            console.error(`Failed to activate pending package for ${profile.id}:`, activateError);
            continue;
          }

          expiredPackages++;

          // Notify user about activation
          try {
            await sendEmailOrThrow(resend, 'cron-package-activated-customer', {
              from: emailConfig.from,
              to: profile.email,
              subject: `Dein ${pendingTierLabel} Paket ist jetzt aktiv!`,
              html: generateEmailHtml(
                'Dein neues Paket ist aktiv',
                `<p>Dein <strong>${tierLabel}</strong> Paket ist am ${expiryDate} abgelaufen.</p>
                 <p>Dein vorgebuchtes <strong>${pendingTierLabel}</strong> Paket ist jetzt aktiv.</p>
                 <p>Gültig bis: <strong>${pendingExpiryFormatted}</strong></p>`,
                'Zum Dashboard'
              )
            });
            emailsSent++;
          } catch (emailErr) {
            console.error(`Activation email to ${profile.email} failed:`, emailErr);
          }

          // Notify admin
          try {
            await sendEmailOrThrow(resend, 'cron-package-activated-admin', {
              from: emailConfig.from,
              to: ADMIN_EMAIL,
              subject: `Paketwechsel aktiviert: ${profile.email} (${tierLabel} → ${pendingTierLabel})`,
              html: generateEmailHtml(
                'Geplanter Paketwechsel aktiviert',
                `<p><strong>Kunde:</strong> ${profile.email}</p>
                 <p><strong>Bisheriges Paket:</strong> ${tierLabel} (abgelaufen am ${expiryDate})</p>
                 <p><strong>Neues Paket:</strong> ${pendingTierLabel}</p>
                 <p><strong>Gültig bis:</strong> ${pendingExpiryFormatted}</p>`,
                'Admin Panel öffnen'
              )
            });
          } catch (adminErr) {
            console.error(`Admin activation notification failed:`, adminErr);
          }
        } else {
          // No pending package – downgrade to basic
          const { error: downgradeError } = await supabase
            .from('profiles')
            .update({
              package_tier: 'basic',
              package_expires_at: null,
              package_stripe_session_id: null,
            })
            .eq('id', profile.id);

          if (downgradeError) {
            console.error(`Failed to downgrade profile ${profile.id}:`, downgradeError);
            continue;
          }

          expiredPackages++;

          // Notify user about expiry
          try {
            await sendEmailOrThrow(resend, 'cron-package-expired-customer', {
              from: emailConfig.from,
              to: profile.email,
              subject: 'Dein KursNavi Abo ist abgelaufen',
              html: generateEmailHtml(
                'Dein Abo ist abgelaufen',
                `<p>Dein <strong>${tierLabel}</strong> Paket ist am ${expiryDate} abgelaufen.</p>
                 <p>Du bist jetzt auf dem kostenlosen Basic-Plan. Um alle Features weiter zu nutzen, kannst du dein Abo jederzeit erneuern.</p>`,
                'Jetzt erneuern'
              )
            });
            emailsSent++;
          } catch (emailErr) {
            console.error(`Expiry email to ${profile.email} failed:`, emailErr);
          }

          // Notify admin
          try {
            await sendEmailOrThrow(resend, 'cron-package-expired-admin', {
              from: emailConfig.from,
              to: ADMIN_EMAIL,
              subject: `Abo abgelaufen: ${profile.email} (${tierLabel})`,
              html: generateEmailHtml(
                'Abo abgelaufen',
                `<p><strong>Kunde:</strong> ${profile.email}</p>
                 <p><strong>Paket:</strong> ${tierLabel}</p>
                 <p><strong>Abgelaufen am:</strong> ${expiryDate}</p>`,
                'Admin Panel öffnen'
              )
            });
          } catch (adminErr) {
            console.error(`Admin expiry notification failed:`, adminErr);
          }
        }
      }
    }

    // ============================================
    // PART 5: Retention – alte Leads & Contact Messages löschen
    // ============================================
    let deletedLeads = 0;
    let deletedContactMessages = 0;

    try {
      const { data: leadsResult } = await supabase.rpc('cleanup_old_leads');
      deletedLeads = leadsResult ?? 0;
    } catch (e) {
      console.error('cleanup_old_leads failed:', e);
    }

    try {
      const { data: contactResult } = await supabase.rpc('cleanup_old_contact_messages');
      deletedContactMessages = contactResult ?? 0;
    } catch (e) {
      console.error('cleanup_old_contact_messages failed:', e);
    }

    return res.status(200).json({
      success: true,
      message: "Payouts, Reminders, Expiry & Retention Processed",
      emailsSent,
      processedBookings,
      remindersSent,
      expiredPackages,
      staleAlertsSent,
      deletedLeads,
      deletedContactMessages
    });

  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
