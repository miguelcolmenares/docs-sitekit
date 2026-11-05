import { absoluteUrl } from "./llms";
import { withSiteBase } from "./siteHref";

/** Name of the card the build writes at the site base when the site has no `site.image`. */
export const SOCIAL_CARD_FILE = "og.png";

/** Width of the card in pixels. Every social network shows a card of this proportion large. */
export const SOCIAL_CARD_WIDTH = 1200;

/** Height of the card in pixels, so the card is 1200 by 630. */
export const SOCIAL_CARD_HEIGHT = 630;

/** Most characters of the description the card shows: about three lines at the size the card uses. */
export const SOCIAL_CARD_TEXT_LIMIT = 150;

/** Most characters of the site name the card shows, before it is cut with an ellipsis. */
export const SOCIAL_CARD_NAME_LIMIT = 60;

/**
 * Why a value of `site.image` cannot be used, or undefined when it can. A value is either an https address, or a
 * path of the site that names a file in `public/`, such as `/social.png` or `social.png`. It has no spaces, and a
 * path does not leave the site with `..`.
 *
 * @param value - The value as written in `site.image`.
 * @returns A sentence for the person who wrote the config, or undefined.
 */
export function socialImageProblem(value: string): string | undefined {
  if (/\s/.test(value)) {
    return `"${value}" has a space in it. Use a file name without spaces, such as social.png.`;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    return /^https:\/\/[^/?#\s]+\S*$/.test(value)
      ? undefined
      : `"${value}" is not an https address. Use an https address, or a path of the site such as /social.png.`;
  }
  if (value.startsWith("//")) {
    return `"${value}" is a protocol-relative address. Write the full https address, or a path of the site such as /social.png.`;
  }
  const path = value.replace(/^\//, "");
  if (path === "" || path.endsWith("/")) {
    return `"${value}" is not a file. Name the image file, such as /social.png.`;
  }
  if (path.split("/").some((part) => part === "..")) {
    return `"${value}" leaves the site. Use a file in public/, such as /social.png.`;
  }
  return undefined;
}

/**
 * The absolute address of the social image of a site, the one `og:image` and `twitter:image` point to.
 *
 * Without `image` it is the generated card at the site base. A path of the site gets the base, as the links of
 * `nav` do. An https address is kept as it is.
 *
 * @param origin - The origin of the published site, for example `https://user.github.io`.
 * @param base - The base the site is served from, which starts and ends with `/`.
 * @param image - The value of `site.image`, when the site sets one.
 * @returns The absolute address of the image.
 */
export function socialImageUrl(origin: string, base: string, image?: string): string {
  if (image === undefined) return absoluteUrl(origin, `${base}${SOCIAL_CARD_FILE}`);
  if (/^https:\/\//i.test(image)) return image;
  return absoluteUrl(origin, withSiteBase(image.startsWith("/") ? image : `/${image}`, base));
}

/**
 * The alt text of the social image: `site.imageAlt`, or the name and the description of the site.
 *
 * @param site - The name, the description and the optional alt text of the site.
 * @returns The text, trimmed.
 */
export function socialImageAlt(site: {
  name: string;
  description: string;
  imageAlt?: string | undefined;
}): string {
  return (site.imageAlt ?? `${site.name}: ${site.description}`).trim();
}

/**
 * Shortens a text to at most `limit` characters for the card. The cut falls on a word boundary when there is one
 * in the second half of the text, and an ellipsis marks it. A text that fits is returned with its spaces collapsed.
 *
 * @param text - The text to shorten.
 * @param limit - The most characters the result may have, the ellipsis included.
 * @returns The text, or the text cut at a word and followed by an ellipsis.
 */
export function truncateAtWord(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const characters = Array.from(clean);
  if (characters.length <= limit) return clean;
  const head = characters.slice(0, limit - 1).join("");
  const space = head.lastIndexOf(" ");
  const kept = space > (limit - 1) / 2 ? head.slice(0, space) : head;
  return `${kept.replace(/[\s.,;:!?-]+$/, "")}…`;
}
