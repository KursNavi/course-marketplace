/**
 * Converts browser-generated inline styles into the semantic tags accepted by
 * the server-side sanitizer. Some execCommand implementations emit spans such
 * as `<span style="font-weight: bold">` despite the editor never allowing
 * arbitrary styling.
 *
 * @param {string} html
 * @returns {string}
 */
export function normalizeInlineFormatting(html) {
  if (!html || typeof html !== 'string') return html || '';

  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('span[style]').forEach((span) => {
    const fontWeight = span.style.fontWeight.trim().toLowerCase();
    const weight = Number.parseInt(fontWeight, 10);
    const isBold = fontWeight === 'bold' || fontWeight === 'bolder' || weight >= 600;
    const fontStyle = span.style.fontStyle.trim().toLowerCase();
    const isItalic = fontStyle === 'italic' || fontStyle === 'oblique';

    if (!isBold && !isItalic) return;

    const content = document.createDocumentFragment();
    while (span.firstChild) content.appendChild(span.firstChild);

    let formatted = content;
    if (isItalic) {
      const em = document.createElement('em');
      em.appendChild(formatted);
      formatted = em;
    }
    if (isBold) {
      const strong = document.createElement('strong');
      strong.appendChild(formatted);
      formatted = strong;
    }

    span.removeAttribute('style');
    if (span.attributes.length === 0) {
      span.replaceWith(formatted);
    } else {
      span.appendChild(formatted);
    }
  });

  return template.innerHTML;
}
