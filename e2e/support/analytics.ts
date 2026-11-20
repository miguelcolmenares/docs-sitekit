import type { Page } from "@playwright/test";

// The kit's own site sets Google Tag Manager in template/sitekit.config.json. The tags that the container loads are
// not part of the kit, and one of them can throw on a page of its own. So the specs that load the own site answer the
// requests of the Google tags with an empty script, and never abort them: an abort is a console error of its own.
// The snippet itself is still checked in the built HTML, by analytics.spec.ts.
export const isGoogleTag = (url: URL) =>
  url.hostname.endsWith("googletagmanager.com") || url.hostname.endsWith("google-analytics.com");

export async function answerGoogleTags(page: Page) {
  await page.route(isGoogleTag, (route) =>
    route.fulfill({
      status: 200,
      contentType:
        route.request().resourceType() === "document" ? "text/html" : "application/javascript",
      body: "",
    }),
  );
}
