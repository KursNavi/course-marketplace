export function getSanitizedEnv(name) {
  const value = process.env[name];

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

export function getRequiredSanitizedEnv(name) {
  const value = getSanitizedEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
