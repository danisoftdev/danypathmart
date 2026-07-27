/** Allowed tags for legal policy rich text. */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'OL', 'UL', 'LI', 'H2', 'H3', 'H4', 'DIV', 'SPAN',
]);

/**
 * True when body looks like HTML (from the rich editor), not legacy plain text.
 */
export function looksLikeHtml(text) {
  if (!text || typeof text !== 'string') return false;
  return /<\/?(?:p|br|strong|b|em|i|u|ol|ul|li|h[2-4])\b/i.test(text);
}

/** Escape plain text and wrap paragraphs for the editor / display. */
export function plainTextToHtml(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const blocks = escaped.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 0) return '<p><br></p>';

  return blocks
    .map((para) => {
      const withBreaks = para.replace(/\n/g, '<br>');
      return `<p>${withBreaks}</p>`;
    })
    .join('');
}

/**
 * Sanitize policy HTML to an allowlist of tags (no attributes / scripts).
 * Safe for use before dangerouslySetInnerHTML.
 */
export function sanitizePolicyHtml(html) {
  if (!html || typeof html !== 'string') return '';
  if (typeof document === 'undefined') return '';

  const template = document.createElement('template');
  template.innerHTML = html;

  const walk = (node) => {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }

      const tag = child.tagName.toUpperCase();
      if (!ALLOWED_TAGS.has(tag)) {
        // Keep text content, drop the wrapper.
        while (child.firstChild) {
          node.insertBefore(child.firstChild, child);
        }
        child.remove();
        continue;
      }

      // Strip all attributes (font, style, onclick, href, etc.)
      while (child.attributes.length > 0) {
        child.removeAttribute(child.attributes[0].name);
      }

      walk(child);
    }
  };

  walk(template.content);
  return template.innerHTML.trim();
}

/** Normalize editor output for storage. */
export function normalizePolicyBody(html) {
  const cleaned = sanitizePolicyHtml(html);
  const text = cleaned.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  if (!text) return '';
  return cleaned;
}
