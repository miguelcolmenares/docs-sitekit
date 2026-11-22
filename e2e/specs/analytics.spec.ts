import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The kit's own site sets Google Tag Manager (template/sitekit.config.json). The other specs answer the tag requests
// with an empty script, so this one reads the built pages and checks that the snippet is in them.
const PORT = Number(process.env.E2E_PORT ?? 4401);
const OWN = `http://127.0.0.1:${PORT + 1}/docs-sitekit/`;
const { analytics } = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "template", "sitekit.config.json"), "utf8"),
) as { analytics?: { provider: string; id: string } };

test.describe("the analytics of the kit's own site", () => {
  test("the config sets Google Tag Manager with a container ID", () => {
    expect(analytics).toEqual({ provider: "gtm", id: expect.stringMatching(/^GTM-/) });
  });

  for (const path of ["", "docs/options-analytics/"]) {
    test(`the built page ${path || "home"} has the head script and the noscript frame of the container`, async ({
      request,
    }) => {
      const html = await (await request.get(`${OWN}${path}`)).text();
      expect(html).toContain("https://www.googletagmanager.com/gtm.js?id=");
      expect(html).toContain(`const gtmId = "${analytics!.id}"`);
      expect(html).toContain(
        `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${analytics!.id}"`,
      );
    });
  }
});
