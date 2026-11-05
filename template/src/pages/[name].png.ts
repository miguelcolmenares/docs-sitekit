import type { APIRoute } from "astro";
import tokens from "../../design/tokens.json";
import { SOCIAL_CARD_FILE } from "../domain";
import { loadSite, renderSocialCard } from "../infrastructure";

/** The one file this route makes: the social card, `og.png`. The route exists only when the site has no `site.image`. */
const FILE = SOCIAL_CARD_FILE.replace(/\.png$/, "");

/** The paths of this route: the card when the site draws its own, none when it sets `site.image`. */
export function getStaticPaths() {
  return loadSite().config.site.image === undefined ? [{ params: { name: FILE } }] : [];
}

/** Draws the card from the name, the description and the host of the site, in the dark colors of the design tokens. */
export const GET: APIRoute = async () => {
  const { config } = loadSite();
  const { color } = tokens;
  const png = await renderSocialCard({
    name: config.site.name,
    description: config.site.description,
    host: new URL(config.site.url).host,
    colors: {
      background: color.bg,
      title: color["fg-bright"],
      text: color["fg-muted"],
      muted: color["fg-dim"],
      accent: color.accent,
    },
  });
  return new Response(png, { headers: { "Content-Type": "image/png" } });
};
