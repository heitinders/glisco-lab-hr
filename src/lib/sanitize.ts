/**
 * Basic input sanitization for text fields.
 * Strips HTML tags and dangerous patterns from user input.
 * For rich text, use a dedicated library like DOMPurify.
 */

const HTML_TAG_REGEX = /<[^>]*>/g;
const SCRIPT_REGEX = /javascript:|data:|vbscript:/gi;
const EVENT_HANDLER_REGEX = /\bon\w+\s*=/gi;

/**
 * Strip HTML tags and dangerous patterns from a string.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(HTML_TAG_REGEX, '')
    .replace(SCRIPT_REGEX, '')
    .replace(EVENT_HANDLER_REGEX, '');
}

/**
 * Recursively sanitize all string values in an object.
 * Useful for sanitizing entire request bodies.
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') return sanitizeText(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map(sanitizeObject) as unknown as T;
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value);
    }
    return result as T;
  }
  return obj;
}
