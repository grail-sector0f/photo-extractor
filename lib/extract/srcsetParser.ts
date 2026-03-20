// Parses an HTML srcset attribute and returns the URL of the highest-resolution candidate.
//
// Srcset format: "url1 320w, url2 800w, url3 1600w"
//              or "url1 1x, url2 2x, url3 3x"
//              or a single URL with no descriptor (implicit 1x)
//
// Returns null if srcset is empty, whitespace-only, or produces no valid candidates.
//
// Why hand-written instead of a library: the srcset format is a simple comma-separated
// list where URLs cannot contain literal commas (they're encoded as %2C). A short parser
// handles all real-world cases without adding a dependency.

export function parseSrcset(srcset: string): string | null {
  // Short-circuit on empty or whitespace-only input
  if (!srcset.trim()) return null;

  // Split on commas — safe because spec-compliant URLs encode commas as %2C
  const candidates = srcset
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Internal type for parsed candidates
  type Candidate = { url: string; w?: number; x?: number };
  const parsed: Candidate[] = [];

  for (const candidate of candidates) {
    // Each candidate is "url [descriptor]" — split on whitespace
    const parts = candidate.split(/\s+/);
    if (parts.length === 0 || !parts[0]) continue;

    const url = parts[0];
    // Descriptor is optional; if absent, the candidate is treated as 1x
    const descriptor = parts[1] ?? '';

    if (descriptor.endsWith('w')) {
      // Width descriptor: e.g., "1600w" — numeric part before the 'w'
      const w = parseFloat(descriptor);
      // Skip malformed descriptors like "w" alone (parseFloat returns NaN)
      if (!isNaN(w)) parsed.push({ url, w });
    } else if (descriptor.endsWith('x')) {
      // Density descriptor: e.g., "2x" — numeric part before the 'x'
      const x = parseFloat(descriptor);
      if (!isNaN(x)) parsed.push({ url, x });
    } else if (descriptor === '') {
      // No descriptor — treat as 1x (implicit pixel density of 1)
      parsed.push({ url, x: 1 });
    }
    // Anything else (malformed, unknown suffix) is skipped
  }

  if (parsed.length === 0) return null;

  // Prefer w-descriptor candidates (absolute pixel width) over x-descriptors
  const wCandidates = parsed.filter((c) => c.w !== undefined);
  if (wCandidates.length > 0) {
    // Return the candidate with the largest w value
    return wCandidates.reduce((best, c) => (c.w! > best.w! ? c : best)).url;
  }

  // Fall back to x-descriptor candidates (pixel density ratio)
  const xCandidates = parsed.filter((c) => c.x !== undefined);
  if (xCandidates.length > 0) {
    return xCandidates.reduce((best, c) => (c.x! > best.x! ? c : best)).url;
  }

  return null;
}
