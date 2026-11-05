import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import {
  SOCIAL_CARD_HEIGHT,
  SOCIAL_CARD_NAME_LIMIT,
  SOCIAL_CARD_TEXT_LIMIT,
  SOCIAL_CARD_WIDTH,
  truncateAtWord,
} from "../domain";

/** The colors of the card, read from the design tokens by the caller. */
export interface SocialCardColors {
  /** The background of the card. */
  background: string;
  /** The color of the site name. */
  title: string;
  /** The color of the description. */
  text: string;
  /** The color of the host at the foot of the card. */
  muted: string;
  /** The color of the bar and of the mark. */
  accent: string;
}

/** What the card says: the name and the description of the site, the host it is served from, and its colors. */
export interface SocialCardInput {
  name: string;
  description: string;
  /** The host of the site, for example `user.github.io`. */
  host: string;
  colors: SocialCardColors;
}

/**
 * The fonts of the card. Satori reads TTF, OTF or WOFF, not WOFF2, so the static `.woff` files of the Latin subset
 * of Geist are used: 400 for the description and the host, 700 for the name.
 */
const FONT_FILES = {
  regular: "@fontsource/geist/files/geist-latin-400-normal.woff",
  bold: "@fontsource/geist/files/geist-latin-700-normal.woff",
} as const;

/** The family name the card asks for. Satori matches the fonts it is given by this name and weight. */
const FAMILY = "Geist";

/** The space between the card edge and its text, on the left and on the right. */
const SIDE_PADDING = 84;

/** The width of the text column: the card less the side padding on both sides. */
const CONTENT_WIDTH = SOCIAL_CARD_WIDTH - 2 * SIDE_PADDING;

/** The object tree satori reads. Its type is the one of a React node, which a tree of plain objects is not. */
type SatoriTree = Parameters<typeof satori>[0];

const resolveModule = createRequire(import.meta.url);

let fonts: Promise<{ regular: Buffer; bold: Buffer }> | undefined;

/** Reads the two font files once per build. They are resolved from the package, so a generated site finds them. */
function loadFonts(): Promise<{ regular: Buffer; bold: Buffer }> {
  fonts ??= Promise.resolve({
    regular: readFileSync(resolveModule.resolve(FONT_FILES.regular)),
    bold: readFileSync(resolveModule.resolve(FONT_FILES.bold)),
  });
  return fonts;
}

/** An element of the object tree Satori reads: a type, its style and its children. */
function element(type: string, style: Record<string, unknown>, children?: unknown[]): SatoriTree {
  return { type, props: { style, children } } as unknown as SatoriTree;
}

/** The size of the site name: a long name is set smaller so it stays on two lines. */
function nameSize(name: string): number {
  if (name.length <= 24) return 88;
  if (name.length <= 40) return 68;
  return 56;
}

/**
 * The object tree of the card. Satori lays it out in a flex column: the accent bar, then the name and the description.
 * The host and the mark sit in a row at the foot, placed absolutely. A `space-between` column was tried first and
 * moved the host out of the picture.
 */
function cardTree(input: SocialCardInput): SatoriTree {
  const { colors } = input;
  const name = truncateAtWord(input.name, SOCIAL_CARD_NAME_LIMIT);
  const description = truncateAtWord(input.description, SOCIAL_CARD_TEXT_LIMIT);
  // The mark is the cube of the kit's favicon: a hexagon outline in the accent color.
  const mark = {
    type: "svg",
    props: {
      width: 44,
      height: 44,
      viewBox: "0 0 32 32",
      children: [
        {
          type: "path",
          props: {
            d: "M16 6l9 5v10l-9 5-9-5V11z",
            fill: "none",
            stroke: colors.accent,
            strokeWidth: 2.5,
            strokeLinejoin: "round",
          },
        },
      ],
    },
  } as unknown as SatoriTree;
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: SOCIAL_CARD_WIDTH,
      height: SOCIAL_CARD_HEIGHT,
      padding: `72px ${SIDE_PADDING}px 64px`,
      backgroundColor: colors.background,
      fontFamily: FAMILY,
      color: colors.text,
    },
    [
      element("div", {
        display: "flex",
        width: 96,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.accent,
      }),
      element(
        "div",
        { display: "flex", flexDirection: "column", width: CONTENT_WIDTH, marginTop: 48 },
        [
          element(
            "div",
            {
              display: "flex",
              fontSize: nameSize(name),
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: colors.title,
            },
            [name],
          ),
          element(
            "div",
            {
              display: "flex",
              width: CONTENT_WIDTH,
              marginTop: 28,
              fontSize: 38,
              fontWeight: 400,
              lineHeight: 1.35,
              color: colors.text,
            },
            [description],
          ),
        ],
      ),
      element(
        "div",
        {
          display: "flex",
          position: "absolute",
          left: SIDE_PADDING,
          bottom: 64,
          alignItems: "center",
        },
        [
          mark,
          element("div", { display: "flex", marginLeft: 18, fontSize: 30, color: colors.muted }, [
            input.host,
          ]),
        ],
      ),
    ],
  );
}

/**
 * Draws the social card of a site as a PNG of 1200 by 630 pixels. The name and the description are cut to fit, so
 * a long text cannot push the layout out of the picture. A character that the Latin subset of Geist does not have is
 * drawn as a box, and it does not stop the build.
 *
 * @param input - The name, the description, the host and the colors of the card.
 * @returns The bytes of the PNG.
 */
export async function renderSocialCard(input: SocialCardInput): Promise<Uint8Array<ArrayBuffer>> {
  const { regular, bold } = await loadFonts();
  const svg = await satori(cardTree(input), {
    width: SOCIAL_CARD_WIDTH,
    height: SOCIAL_CARD_HEIGHT,
    fonts: [
      { name: FAMILY, data: regular, weight: 400, style: "normal" },
      { name: FAMILY, data: bold, weight: 700, style: "normal" },
    ],
  });
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  // A copy, so the bytes sit in a plain ArrayBuffer, which is what a Response takes as its body.
  return new Uint8Array(resvg.render().asPng());
}
