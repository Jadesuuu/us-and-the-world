// Shared helpers for the inspiration-link feature.
//
// One regex, one extractor, one validator — the AddPinDrawer save
// path, the PinDrawer migration banner, and the LinkPreview card all
// agree on what counts as a URL and how to pull it out of free-form
// note text. Anchors only at protocol so we don't false-positive on
// "www.something" written without "https://" — too risky to rewrite
// the user's note when we're not certain.

// Matches http/https URLs with no whitespace. The non-greedy class
// stops before trailing punctuation that's typically not part of the
// URL itself (closing brackets, commas, periods at sentence ends).
// We strip a single trailing ).,;:!?'" after the match.
const URL_RE = /https?:\/\/[^\s<>"']+/i;
const TRAILING_PUNCT_RE = /[).,;:!?'"]+$/;

export function findUrlInText(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(URL_RE);
  if (!match) return null;
  return match[0].replace(TRAILING_PUNCT_RE, "");
}

// Returns the note text with the first URL removed — and any leading
// "I saw this place here:" / "look at this!" style scaffolding around
// it tidied up so we don't leave dangling colons or doubled spaces.
export function stripUrlFromText(
  text: string | null | undefined,
  url: string,
): string {
  if (!text) return "";
  const without = text.replace(url, "");
  // Collapse the kinds of orphans that the removal tends to leave —
  // " : " becomes " ", trailing colons become nothing, runs of
  // whitespace become a single space — then trim.
  return without
    .replace(/\s+:\s+/g, " ")
    .replace(/[:\-–—]\s*$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isValidUrl(value: string): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
