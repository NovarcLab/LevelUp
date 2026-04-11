import YAML from 'yaml';

/**
 * A tiny YAML-frontmatter reader. The format we accept is the de-facto one:
 *
 *   ---
 *   key: value
 *   ---
 *   body markdown...
 *
 * Both the delimiters and the trailing newline are optional on input, but
 * always produced on write.
 */
export interface FrontmatterDoc<T> {
  frontmatter: T;
  body: string;
}

const DELIM = '---';

export function parseFrontmatter<T>(raw: string, fallback: T): FrontmatterDoc<T> {
  const trimmed = raw.replace(/^\uFEFF/, '');
  if (!trimmed.startsWith(DELIM)) {
    return { frontmatter: fallback, body: trimmed };
  }
  const end = trimmed.indexOf(`\n${DELIM}`, DELIM.length);
  if (end === -1) return { frontmatter: fallback, body: trimmed };
  const yamlText = trimmed.slice(DELIM.length, end).trim();
  const bodyStart = end + DELIM.length + 1;
  const body = trimmed.slice(bodyStart).replace(/^\n/, '');
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlText);
  } catch {
    return { frontmatter: fallback, body };
  }
  return {
    frontmatter: (parsed ?? fallback) as T,
    body,
  };
}

export function stringifyFrontmatter<T>(doc: FrontmatterDoc<T>): string {
  const yamlText = YAML.stringify(doc.frontmatter).trimEnd();
  return `${DELIM}\n${yamlText}\n${DELIM}\n\n${doc.body.replace(/^\n+/, '')}`;
}
