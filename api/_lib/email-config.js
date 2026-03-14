const DEFAULT_FROM_EMAIL = 'info@kursnavi.ch';
const DEFAULT_FROM_NAME = 'KursNavi';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getEmailConfig() {
  const supportEmail = normalizeEmail(process.env.SUPPORT_EMAIL) || DEFAULT_FROM_EMAIL;
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL) || supportEmail;
  const from = normalizeEmail(process.env.EMAIL_FROM) || `${DEFAULT_FROM_NAME} <${supportEmail}>`;

  return {
    from,
    supportEmail,
    adminEmail
  };
}

export function logEmailAttempt(label, details) {
  const payload = Object.fromEntries(
    Object.entries(details || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  console.info(`[email] ${label}`, payload);
}

export async function sendEmailOrThrow(resend, label, options) {
  logEmailAttempt(label, {
    to: options?.to,
    from: options?.from,
    bcc: options?.bcc,
    cc: options?.cc,
    replyTo: options?.replyTo,
    subject: options?.subject
  });

  const result = await resend.emails.send(options);

  if (result?.error) {
    const error = new Error(result.error.message || `Email send failed: ${label}`);
    error.cause = result.error;
    throw error;
  }

  return result;
}

export async function resolveUserEmail(supabase, userId, profileEmail = null) {
  const normalizedProfileEmail = normalizeEmail(profileEmail);
  if (normalizedProfileEmail) {
    return normalizedProfileEmail;
  }

  if (!userId) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      console.warn('[email] auth lookup failed', { userId, message: error.message });
      return null;
    }

    return normalizeEmail(data?.user?.email) || null;
  } catch (error) {
    console.warn('[email] auth lookup exception', {
      userId,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
