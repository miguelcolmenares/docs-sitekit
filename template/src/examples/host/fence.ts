/** What a fenced block says about its code: the language, and a title for the caption bar. */
export interface FenceOptions {
  lang: string;
  /** The caption over the block. It cannot hold a double quote. */
  title?: string;
}

/** The longest run of backticks in a text. */
function longestRun(text: string): number {
  return Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
}

/**
 * A markdown fence around a piece of code, for the renderer of the site. The fence is longer than any run of
 * backticks in the code, so code that holds a fence of its own cannot end the block early. The code is not changed:
 * what the block shows, and what its copy button copies, is the text of the example file.
 */
export function fencedCode(code: string, options: FenceOptions): string {
  const fence = "`".repeat(Math.max(3, longestRun(code) + 1));
  const title = options.title ? ` title="${options.title.replaceAll('"', "'")}"` : "";
  const body = code.endsWith("\n") ? code.slice(0, -1) : code;
  return `${fence}${options.lang}${title}\n${body}\n${fence}\n`;
}
