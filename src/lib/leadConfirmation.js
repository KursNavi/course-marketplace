export const LEAD_CONFIRMATION_PATH = '/lead-confirmation';

const SAFE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/;

function readSafeReference(value) {
  const reference = String(value || '').trim();
  return SAFE_REFERENCE_PATTERN.test(reference) ? reference : null;
}

function readSafeDeadline(value) {
  const deadline = String(value || '').trim();
  if (!deadline) return null;

  const parsed = new Date(deadline);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function buildLeadConfirmationPath({ reference, responseDeadline } = {}) {
  const params = new URLSearchParams();
  const safeReference = readSafeReference(reference);
  const safeDeadline = readSafeDeadline(responseDeadline);

  if (safeReference) params.set('ref', safeReference);
  if (safeDeadline) params.set('deadline', safeDeadline);

  const query = params.toString();
  return query ? `${LEAD_CONFIRMATION_PATH}?${query}` : LEAD_CONFIRMATION_PATH;
}

export function readLeadConfirmationParams(search = '') {
  const params = new URLSearchParams(search);
  return {
    reference: readSafeReference(params.get('ref')),
    responseDeadline: readSafeDeadline(params.get('deadline')),
  };
}
