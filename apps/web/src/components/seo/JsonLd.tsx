/** Renders a JSON-LD structured-data script tag. Passed as a text child
 * (not dangerouslySetInnerHTML) — React writes it as the script's
 * textContent, never interpreted as markup. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}
