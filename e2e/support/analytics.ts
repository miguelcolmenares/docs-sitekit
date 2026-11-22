import type { Page } from "@playwright/test";

// The kit's own site sets Google Tag Manager in template/sitekit.config.json. The tags that the container loads are
// not part of the kit, and one of them can throw on a page of its own. So the specs that load the own site answer the
// requests of the Google tags with an empty script, and never abort them: an abort is a console error of its own.
// The snippet itself is still checked in the built HTML, by analytics.spec.ts.
const GOOGLE_TAG_DOMAINS = ["googletagmanager.com", "google-analytics.com"];

/**
 * Whether a URL belongs to Google Tag Manager or Google Analytics, by its host.
 *
 * @param url - The URL of a request.
 * @returns True for the two domains and their subdomains, and for no other host.
 */
export function isGoogleTag(url: URL): boolean {
  return GOOGLE_TAG_DOMAINS.some(
    (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
  );
}

/**
 * Answers the requests of the Google tags on a page with an empty body, so no third-party script runs in the test.
 *
 * @param page - The page whose requests are answered.
 */
export async function answerGoogleTags(page: Page): Promise<void> {
  await page.route(isGoogleTag, (route) =>
    route.fulfill({
      status: 200,
      contentType:
        route.request().resourceType() === "document" ? "text/html" : "application/javascript",
      body: "",
    }),
  );
}
