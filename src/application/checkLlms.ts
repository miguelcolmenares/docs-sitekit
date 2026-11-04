import { absoluteUrl, LLMS_FILE, markdownPath } from "../../template/src/domain";
import type { Document } from "../../template/src/domain";

/** What the llms.txt rules need from the built site and the content it was built from. */
export interface LlmsCheckInput {
  /** Origin of the published site, from `site.url`. */
  origin: string;
  /** Base path of the site, from `site.base`. */
  base: string;
  /** Every page of the site, as the build knows it. */
  documents: readonly Document[];
  /** Paths of every file in the build, relative to the build folder, with forward slashes. */
  built: readonly string[];
  /** Whether each page also has a Markdown copy, from `llms.markdownPages`. */
  markdownPages: boolean;
}

const FIRST_LINE_H1 = /^# \S/;

/**
 * The targets of the Markdown links in a text: what sits between `](` and the next `)`, when it holds no
 * space. One pass, without a pattern that tries again from every `](`, so a long run of them stays linear.
 */
function linkTargets(text: string): string[] {
  const targets: string[] = [];
  let at = text.indexOf("](");
  while (at !== -1) {
    const start = at + 2;
    let end = start;
    while (end < text.length && text[end] !== ")" && !/\s/.test(text[end]!)) end++;
    if (text[end] === ")" && end > start) targets.push(text.slice(start, end));
    // A later `](` before `end` would stop at the same character, so the scan goes on from there.
    at = text.indexOf("](", Math.max(end, start));
  }
  return targets;
}

/**
 * The rules llms.txt must meet when the option is on. It starts with an H1, every link in it is a
 * page or a Markdown file of the build, and every page of the site is listed. A missing page or a
 * missing Markdown copy is reported by name.
 */
export function checkLlms(text: string, input: LlmsCheckInput): string[] {
  const errors: string[] = [];
  const first = text.split("\n").find((line) => line.trim() !== "") ?? "";
  if (!FIRST_LINE_H1.test(first)) {
    errors.push(`dist/${LLMS_FILE} does not start with an H1, the name of the site.`);
  }

  const prefix = absoluteUrl(input.origin, input.base);
  for (const href of linkTargets(text)) {
    if (!href.startsWith(prefix)) {
      errors.push(`dist/${LLMS_FILE} links to ${href}, which is not an address of this site.`);
      continue;
    }
    const path = href.slice(prefix.length);
    const file = path === "" || path.endsWith("/") ? `${path}index.html` : path;
    if (!input.built.includes(file)) {
      errors.push(`dist/${LLMS_FILE} links to ${href}, but dist/${file} does not exist.`);
    }
  }

  for (const document of input.documents) {
    if (!text.includes(`](${absoluteUrl(input.origin, document.route)})`)) {
      errors.push(`dist/${LLMS_FILE} does not list the page ${document.path} (${document.route}).`);
    }
    if (input.markdownPages) {
      const copy = markdownPath(document.route, input.base);
      if (!input.built.includes(copy)) {
        errors.push(`dist/${copy} is missing, so the page ${document.path} has no Markdown copy.`);
      }
    }
  }
  return errors;
}
