/** Lowercase, hyphenate, and cap a string for use as a URL slug component. */
export function slugify(text: string, maxLength = 120): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
}
