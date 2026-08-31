const BROWSER_EXTENSION_ERROR_PATTERNS = [
  /Invalid call to runtime\.sendMessage\(\)\.\s*Tab not found\.?/i,
];

function getOriginalExceptionText(originalException) {
  if (!originalException) return '';

  if (typeof originalException === 'string') return originalException;

  return [originalException.message, originalException.stack]
    .filter(Boolean)
    .join('\n');
}

export function isBrowserExtensionError(event, hint = {}) {
  const exceptionValues = event?.exception?.values ?? [];
  const exceptionText = exceptionValues
    .flatMap((exception) => [
      exception?.type,
      exception?.value,
      ...(exception?.stacktrace?.frames ?? []).flatMap((frame) => [
        frame?.filename,
        frame?.module,
        frame?.function,
      ]),
    ])
    .filter(Boolean)
    .join('\n');

  const errorText = [
    event?.message,
    exceptionText,
    getOriginalExceptionText(hint.originalException),
  ]
    .filter(Boolean)
    .join('\n');

  return BROWSER_EXTENSION_ERROR_PATTERNS.some((pattern) => pattern.test(errorText));
}

export function filterBrowserExtensionErrors(event, hint) {
  return isBrowserExtensionError(event, hint) ? null : event;
}
