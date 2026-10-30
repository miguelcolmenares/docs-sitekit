import { buildLlmsText } from "../application";
import { LLMS_FILE } from "../domain";
import { loadSite } from "../infrastructure";

/**
 * Files the build writes at the root of the output, from the site content. Each route is a path
 * that the site adds to its own pages. With `llms.enabled` off there are no paths, so nothing is written.
 */
export function getStaticPaths() {
  const site = loadSite();
  if (!site.config.llms.enabled) return [];
  return [
    {
      params: { file: LLMS_FILE },
      props: { body: buildLlmsText(site.config, site.documents) },
    },
  ];
}

export function GET({ props }: { props: { body: string } }) {
  return new Response(props.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
